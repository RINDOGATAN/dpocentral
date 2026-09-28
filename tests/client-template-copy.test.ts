// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * "Start from another client" (directive stage 2b), proved against an in-memory
 * database with two organisations:
 *
 *  - the copy scope: each part copies what it names and nothing more, as
 *    drafts, with requests, incidents, contracts, people and dates left behind;
 *  - the never-copy list: no write ever reaches a table on it, whatever is
 *    ticked (the one audit entry in the target is the copy's own);
 *  - the scrub: the source's name is replaced, other pointers are flagged;
 *  - confidentiality: nothing written to the target names or points at the
 *    source by id or slug, and the audit entry names nothing about it;
 *  - the permission rule: owner or admin of both, and never the same one.
 *
 * All names are invented. Ported from AI Sentinel's copy test.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { COPY_PARTS, NEVER_COPY } from "@/config/client-template";
import { DEFAULT_INTAKE_FORM } from "@/server/services/dsar/defaultIntakeForm";
import {
  applyClientTemplate,
  assertTemplatePermission,
  planClientTemplate,
} from "@/server/services/client-template/copy";

type Row = Record<string, unknown>;

const SRC = "org-src-7f3a";
const TGT = "org-tgt-19c2";
const USER = "user-1";
const NOW = new Date("2026-09-25T10:00:00Z");

function seed() {
  return {
    organization: [
      { id: SRC, name: "Northwind Holdings Ltd", slug: "northwind-holdings", domain: "northwind.example" },
      { id: TGT, name: "Bluefield Partners", slug: "bluefield", domain: null },
    ] as Row[],
    organizationMember: [
      { organizationId: SRC, userId: USER, role: "OWNER" },
      { organizationId: TGT, userId: USER, role: "ADMIN" },
    ] as Row[],
    organizationJurisdiction: [
      { id: "oj-1", organizationId: SRC, jurisdictionId: "jur-gdpr", isPrimary: true, createdAt: new Date(1) },
      { id: "oj-2", organizationId: SRC, jurisdictionId: "jur-ccpa", isPrimary: false, createdAt: new Date(2) },
    ] as Row[],
    dataAsset: [
      {
        id: "da-1", organizationId: SRC, name: "Customer CRM database",
        description: "Managed by Northwind Holdings Ltd; write to privacy@northwind.example.",
        type: "DATABASE", owner: "IT", location: "EU", hostingType: "Cloud", vendor: null,
        isProduction: true, metadata: null, createdAt: new Date(1),
      },
    ] as Row[],
    dataElement: [
      {
        id: "de-1", organizationId: SRC, dataAssetId: "da-1", name: "email", description: null,
        category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false,
        retentionDays: 365, legalBasis: "CONTRACT", metadata: null, createdAt: new Date(1),
      },
    ] as Row[],
    processingActivity: [
      {
        id: "pa-1", organizationId: SRC, name: "Customer onboarding",
        description: "Onboarding for Northwind Holdings Ltd customers", purpose: "Onboard new customers",
        legalBasis: "CONTRACT", legalBasisDetail: null, dataSubjects: ["Customers"], categories: ["IDENTIFIERS"],
        recipients: [], retentionPeriod: null, retentionDays: null, automatedDecisionMaking: false,
        automatedDecisionDetail: null, isActive: true, metadata: null, createdAt: new Date(1),
      },
    ] as Row[],
    processingActivityAsset: [
      { id: "paa-1", processingActivityId: "pa-1", dataAssetId: "da-1", purpose: "Store contact details" },
    ] as Row[],
    vendor: [
      {
        id: "ven-1", organizationId: SRC, name: "ChatTool", description: "LLM assistant",
        website: "https://chattool.example", status: "ACTIVE", riskTier: "HIGH", riskScore: 40,
        primaryContact: "A Person", contactEmail: "a@northwind.example", contactPhone: null, address: null,
        categories: ["AI"], dataProcessed: ["IDENTIFIERS"], countries: ["US"], certifications: ["SOC2"],
        metadata: null, createdAt: new Date(1),
      },
    ] as Row[],
    vendorContract: [{ id: "vc-1", vendorId: "ven-1", type: "DPA", name: "DPA" }] as Row[],
    vendorReview: [{ id: "vr-1", vendorId: "ven-1", findings: "ok" }] as Row[],
    assessmentTemplate: [
      {
        id: "tpl-1", organizationId: SRC, isSystem: false, type: "DPIA", name: "Vendor DPIA", description: null,
        version: "1.0", sections: [{ title: "Scope", questions: [{ text: "Used at Northwind?" }] }],
        scoringLogic: null, createdAt: new Date(1),
      },
      { id: "tpl-sys", organizationId: null, isSystem: true, type: "DPIA", name: "System DPIA", sections: [], createdAt: new Date(0) },
    ] as Row[],
    dSARIntakeForm: [
      {
        id: "f-1", organizationId: SRC, name: "Public intake", slug: "dsar", title: "Make a request",
        description: "Questions to privacy@northwind.example", fields: {}, enabledTypes: ["ACCESS"],
        customCss: null, thankYouMessage: null, privacyNoticeUrl: "https://northwind.example/privacy",
        retentionDays: 90, isActive: true, createdAt: new Date(1),
      },
    ] as Row[],
    auditLog: [] as Row[],
  };
}

/** An org's auto-seeded default intake form (pristine, as ensureDefaultIntakeForm writes it). */
function seedDefaultForm(orgId: string): Row {
  return {
    id: `def-${orgId}`,
    organizationId: orgId,
    name: DEFAULT_INTAKE_FORM.name,
    slug: DEFAULT_INTAKE_FORM.slug,
    title: DEFAULT_INTAKE_FORM.title,
    description: DEFAULT_INTAKE_FORM.description,
    fields: [],
    enabledTypes: [...DEFAULT_INTAKE_FORM.enabledTypes],
    customCss: null,
    thankYouMessage: DEFAULT_INTAKE_FORM.thankYouMessage,
    privacyNoticeUrl: null,
    retentionDays: 90,
    isActive: true,
    createdAt: new Date(1),
  };
}

type Store = ReturnType<typeof seed>;

function matches(row: Row, where: Row = {}): boolean {
  for (const [k, v] of Object.entries(where)) {
    if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
      const cond = v as Row;
      if ("not" in cond && row[k] === cond.not) return false;
      if ("in" in cond && !(cond.in as unknown[]).includes(row[k])) return false;
      continue;
    }
    if (row[k] !== v) return false;
  }
  return true;
}

let n = 0;
/** A fake Prisma that records every write, by delegate. */
function fakeDb(store: Store) {
  const writes: { delegate: string; method: string; data: unknown }[] = [];
  const delegate = (name: keyof Store) => ({
    findFirst: async ({ where }: { where: Row }) => store[name].find((r) => matches(r, where)) ?? null,
    findMany: async ({ where, select }: { where: Row; select?: Row }) =>
      store[name]
        .filter((r) => matches(r, where))
        .map((r) => {
          const out: Row = { ...r };
          if (name === "dataAsset" && select?.dataElements) {
            out.dataElements = store.dataElement.filter((e) => e.dataAssetId === r.id);
          }
          if (name === "processingActivity" && select?.assets) {
            out.assets = store.processingActivityAsset
              .filter((a) => a.processingActivityId === r.id)
              .map((a) => ({
                purpose: a.purpose,
                dataAsset: store.dataAsset.find((d) => d.id === a.dataAssetId) ?? null,
              }));
          }
          return out;
        }),
    create: async ({ data }: { data: Row }) => {
      writes.push({ delegate: name, method: "create", data });
      const row = { id: `new-${++n}`, ...data };
      store[name].push(row);
      return row;
    },
    update: async ({ where, data }: { where: Row; data: Row }) => {
      writes.push({ delegate: name, method: "update", data: { where, data } });
      const row = store[name].find((r) => matches(r, where))!;
      Object.assign(row, data);
      return row;
    },
  });
  const db = Object.fromEntries(Object.keys(store).map((k) => [k, delegate(k as keyof Store)]));
  return { db: db as never, writes };
}

let store: Store;
let db: never;
let writes: { delegate: string; method: string; data: unknown }[];

beforeEach(() => {
  store = seed();
  ({ db, writes } = fakeDb(store));
});

async function copy(parts: readonly (typeof COPY_PARTS)[number][]) {
  const plan = await planClientTemplate(db, {
    sourceOrganizationId: SRC,
    targetOrganizationId: TGT,
    targetName: "Bluefield Partners",
    parts,
  });
  const result = await applyClientTemplate(db, plan, { targetOrganizationId: TGT, userId: USER, now: NOW });
  return { plan, result };
}

const inTarget = <K extends keyof Store>(k: K) => store[k].filter((r) => r.organizationId === TGT);

describe("the copy scope", () => {
  it("copies jurisdictions only into a client that has declared none", async () => {
    await copy(["jurisdictions"]);
    const links = inTarget("organizationJurisdiction");
    expect(links.map((l) => l.jurisdictionId).sort()).toEqual(["jur-ccpa", "jur-gdpr"]);
    expect(links.find((l) => l.jurisdictionId === "jur-gdpr")?.isPrimary).toBe(true);
  });

  it("copies data assets with their elements, marked as a template copy", async () => {
    await copy(["dataAssets"]);
    const [asset] = inTarget("dataAsset");
    expect(asset).toMatchObject({ name: "Customer CRM database", type: "DATABASE", owner: "IT" });
    expect(asset.description).toContain("Bluefield Partners");
    expect(asset.metadata).toEqual({ templateCopy: { pending: true, copiedAt: NOW.toISOString() } });
    const [element] = inTarget("dataElement");
    expect(element).toMatchObject({ name: "email", dataAssetId: asset.id, category: "IDENTIFIERS" });
  });

  it("copies processing activities as inactive drafts", async () => {
    await copy(["processingActivities"]);
    const [activity] = inTarget("processingActivity");
    expect(activity).toMatchObject({ name: "Customer onboarding", isActive: false });
    expect(activity.metadata).toEqual({ templateCopy: { pending: true, copiedAt: NOW.toISOString() } });
    expect(inTarget("processingActivityAsset")).toEqual([]);
  });

  it("relinks an activity to a copied asset by name when both are chosen", async () => {
    await copy(["dataAssets", "processingActivities"]);
    const [asset] = inTarget("dataAsset");
    const [link] = store.processingActivityAsset.filter((l) => String(l.id).startsWith("new-"));
    expect(link).toMatchObject({ dataAssetId: asset.id, purpose: "Store contact details" });
  });

  it("copies vendors without contacts or the client's own risk score, marked for review", async () => {
    await copy(["vendors"]);
    const [vendor] = inTarget("vendor");
    expect(vendor).toMatchObject({ name: "ChatTool", status: "UNDER_REVIEW", riskTier: "HIGH" });
    for (const field of ["primaryContact", "contactEmail", "contactPhone", "riskScore"]) {
      expect(vendor[field], field).toBeUndefined();
    }
    expect(vendor.metadata).toEqual({ templateCopy: { pending: true, copiedAt: NOW.toISOString() } });
  });

  it("copies the organisation's own assessment templates, not the built-in ones", async () => {
    await copy(["assessmentTemplates"]);
    const templates = inTarget("assessmentTemplate");
    expect(templates.map((t) => t.name)).toEqual(["Vendor DPIA"]);
    expect(templates[0].isSystem).toBe(false);
  });

  it("copies the DSAR intake form as an inactive draft", async () => {
    await copy(["dsarIntake"]);
    const [form] = inTarget("dSARIntakeForm");
    expect(form).toMatchObject({ name: "Public intake", slug: "dsar", isActive: false });
  });

  it("replaces the target's untouched seeded default in place, left inactive", async () => {
    store.dSARIntakeForm.push(seedDefaultForm(TGT));
    const { plan } = await copy(["dsarIntake"]);
    expect(plan.counts.dsarIntake).toBe(1);
    expect(plan.dsarIntakeSkippedEdited).toBe(false);
    // The default is overwritten in place, so the target still has exactly one form.
    const forms = inTarget("dSARIntakeForm");
    expect(forms).toHaveLength(1);
    expect(forms[0].id).toBe(`def-${TGT}`);
    expect(forms[0]).toMatchObject({ name: "Public intake", slug: "dsar", title: "Make a request", isActive: false });
  });

  it("leaves a person-edited intake form as it is and says so", async () => {
    const edited = seedDefaultForm(TGT);
    edited.title = "Send us your data request"; // a person changed the public title
    store.dSARIntakeForm.push(edited);
    const { plan } = await copy(["dsarIntake"]);
    expect(plan.counts.dsarIntake).toBe(0);
    expect(plan.dsarIntakeSkippedEdited).toBe(true);
    const forms = inTarget("dSARIntakeForm");
    expect(forms).toHaveLength(1);
    expect(forms[0].title).toBe("Send us your data request");
    expect(forms[0].id).toBe(`def-${TGT}`);
  });

  it("never overwrites an asset the target already has", async () => {
    store.dataAsset.push({ id: "own", organizationId: TGT, name: "Customer CRM database", type: "DATABASE" });
    const { plan } = await copy(["dataAssets"]);
    expect(plan.skipped.dataAssets).toBe(1);
    expect(inTarget("dataAsset")).toHaveLength(1);
  });

  it("does not copy jurisdictions into a client that already declares some", async () => {
    store.organizationJurisdiction.push({ id: "own", organizationId: TGT, jurisdictionId: "jur-uk", isPrimary: true });
    const { plan } = await copy(["jurisdictions"]);
    expect(plan.skipped.jurisdictions).toBe(2);
    expect(inTarget("organizationJurisdiction")).toHaveLength(1);
  });
});

describe("the never-copy list", () => {
  it("writes to none of its tables whatever is ticked, apart from the copy's own audit entry", async () => {
    await copy(COPY_PARTS);
    const touched = new Set(writes.map((w) => w.delegate));
    for (const table of NEVER_COPY) {
      if (table === "auditLog") continue;
      expect(touched.has(table), table).toBe(false);
    }
    expect(writes.filter((w) => w.delegate === "auditLog")).toHaveLength(1);
    for (const w of writes) {
      const data = w.data as Row;
      if ("organizationId" in data) expect(data.organizationId).toBe(TGT);
    }
  });
});

describe("confidentiality between clients", () => {
  it("records the copy in the target's audit trail, dated, naming nothing about the source", async () => {
    await copy(COPY_PARTS);
    const [entry] = store.auditLog;
    expect(entry).toMatchObject({ organizationId: TGT, userId: USER, action: "CREATE_FROM_TEMPLATE" });
    expect((entry.changes as Row).note).toBe("Created from a template on 2026-09-25");
    const text = JSON.stringify(entry);
    for (const secret of [SRC, "Northwind", "northwind"]) expect(text).not.toContain(secret);
  });

  it("writes no reference to the source's id or slug anywhere in the target", async () => {
    await copy(COPY_PARTS);
    const text = JSON.stringify(writes);
    expect(text).not.toContain(SRC);
    expect(text).not.toContain("northwind-holdings");
  });

  it("replaces the full name and lists the other pointers for review", async () => {
    const { plan, result } = await copy(COPY_PARTS);
    expect(plan.replacements).toBeGreaterThanOrEqual(2);
    const byPart = Object.fromEntries(result.flagged.map((f) => [f.part, f]));
    expect(byPart.dataAssets.flags.map((f) => f.term)).toContain("northwind.example");
    expect(byPart.dataAssets.id).toBe(inTarget("dataAsset")[0].id);
    expect(byPart.dsarIntake.flags.map((f) => f.term)).toContain("northwind.example");
  });
});

describe("the permission rule", () => {
  it("allows an owner or admin of both", async () => {
    await expect(assertTemplatePermission(db, USER, SRC, TGT)).resolves.toBeUndefined();
    await expect(assertTemplatePermission(db, USER, SRC, null)).resolves.toBeUndefined();
  });

  for (const role of ["PRIVACY_OFFICER", "MEMBER", "VIEWER"]) {
    it(`refuses a ${role} of the source`, async () => {
      store.organizationMember[0].role = role;
      await expect(assertTemplatePermission(db, USER, SRC, TGT)).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
    it(`refuses a ${role} of the target`, async () => {
      store.organizationMember[1].role = role;
      await expect(assertTemplatePermission(db, USER, SRC, TGT)).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  }

  it("refuses someone who is not a member of the source", async () => {
    await expect(assertTemplatePermission(db, "user-2", SRC, TGT)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("refuses the same organisation as source and target", async () => {
    await expect(assertTemplatePermission(db, USER, TGT, TGT)).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
