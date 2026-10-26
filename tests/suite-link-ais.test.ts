// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { aiSentinelApiUrl, HOSTED_AI_SENTINEL_URL } from "@/server/services/ai-sentinel/client";
import { safeAiSentinelReturn } from "@/lib/suite-return";
import { applyAisRecords, buildLinkPayload, readAisLink, syncWithAiSentinel } from "@/server/services/suite/link-ais";

type Row = Record<string, any>;
const getPath = (o: any, p: string[]) => p.reduce((x, k) => (x && typeof x === "object" ? x[k] : undefined), o);
function matches(row: Row, where: any): boolean {
  if (!where) return true;
  return Object.entries(where).every(([k, v]: [string, any]) => {
    if (k === "OR") return (v as any[]).some((w) => matches(row, w));
    if (v && typeof v === "object" && "path" in v) return getPath(row[k], v.path) === v.equals;
    if (v && typeof v === "object" && "in" in v) {
      const set = (v.in as any[]).map((x) => (v.mode === "insensitive" ? String(x).toLowerCase() : x));
      return set.includes(v.mode === "insensitive" ? String(row[k]).toLowerCase() : row[k]);
    }
    if (v && typeof v === "object" && "not" in v) return row[k] !== v.not;
    if (v && typeof v === "object" && "startsWith" in v) return String(row[k] ?? "").startsWith(v.startsWith);
    if (v && typeof v === "object" && "equals" in v) return String(row[k]).toLowerCase() === String(v.equals).toLowerCase();
    if (v && typeof v === "object") return true;
    return row[k] === v;
  });
}
function table(rows: Row[], prefix: string) {
  return {
    rows,
    findFirst: async ({ where }: any) => rows.find((r) => matches(r, where)) ?? null,
    findMany: async ({ where }: any = {}) => rows.filter((r) => matches(r, where)),
    findUnique: async ({ where }: any) => rows.find((r) => r.id === where.id) ?? null,
    count: async ({ where }: any = {}) => rows.filter((r) => matches(r, where)).length,
    create: async ({ data }: any) => {
      const row = { id: `${prefix}-${rows.length + 1}`, ...data };
      rows.push(row);
      return row;
    },
    update: async ({ where, data }: any) => Object.assign(rows.find((r) => r.id === where.id)!, data),
    updateMany: async ({ where, data }: any) => {
      rows.filter((r) => matches(r, where)).forEach((r) => Object.assign(r, data));
      return { count: 1 };
    },
  };
}

let db: any;
beforeEach(() => {
  const vendor = { id: "v1", organizationId: "o1", name: "OpenAI", website: "https://openai.com", description: null, sourceRef: null };
  db = {
    organization: table(
      [
        {
          id: "o1",
          name: "Acme",
          settings: {},
          jurisdictions: [
            { isPrimary: true, jurisdiction: { code: "GDPR", region: "EU" } },
            { isPrimary: false, jurisdiction: { code: "LOPDGDD", region: "ES" } },
          ],
        },
      ],
      "org",
    ),
    aISystem: table(
      [
        { id: "s1", organizationId: "o1", name: "Support assistant", vendorId: "v1", vendor, catalogSlug: "openai", aiCapabilities: [], aiTechniques: [], metadata: null, aiSentinelSystemId: null, riskLevel: "LIMITED" },
      ],
      "sys",
    ),
    vendor: table([vendor], "ven"),
    dataAsset: table(
      [
        {
          id: "a1",
          organizationId: "o1",
          vendor: "openai",
          processingActivityAssets: [
            { processingActivity: { id: "pa1", name: "Customer support", categories: ["IDENTIFIERS"], dataSubjects: ["Customers"], legalBasis: "CONTRACT" } },
          ],
        },
      ],
      "asset",
    ),
    assessment: table([{ id: "dp1", organizationId: "o1", processingActivityId: "pa1", status: "APPROVED", template: { type: "DPIA" } }], "as"),
    auditLog: table([], "audit"),
  };
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("where AI Sentinel is", () => {
  it("uses the explicit address, the hosted one when only the key is set on the hosted service, or none", () => {
    expect(aiSentinelApiUrl({ AI_SENTINEL_API_URL: "https://ais.example/" })).toBe("https://ais.example");
    expect(aiSentinelApiUrl({ AI_SENTINEL_API_KEY: "k", VERCEL_ENV: "production" })).toBe(HOSTED_AI_SENTINEL_URL);
    expect(aiSentinelApiUrl({ AI_SENTINEL_API_KEY: "k" })).toBeNull();
    expect(aiSentinelApiUrl({ VERCEL_ENV: "production" })).toBeNull();
  });

  it("follows a way back only to AI Sentinel itself", () => {
    expect(safeAiSentinelReturn("https://aisentinel.todo.law/governance/quickstart")).toBe("https://aisentinel.todo.law/governance/quickstart");
    expect(safeAiSentinelReturn("https://evil.example/x")).toBeNull();
    expect(safeAiSentinelReturn("javascript:alert(1)")).toBeNull();
    expect(safeAiSentinelReturn(null)).toBeNull();
  });
});

describe("what AI Sentinel receives", () => {
  it("sends the laws, the AI vendor with its catalogue slug, and each system's processing and DPIA in both languages", async () => {
    const p = await buildLinkPayload(db, "o1", "https://dpc.example");
    expect(p.dpcOrganization).toMatchObject({ id: "o1", name: "Acme", country: "EU" });
    expect(p.dpcOrganization.laws).toHaveLength(2);
    expect(p.vendors).toEqual([{ dpcId: "v1", name: "OpenAI", website: "https://openai.com", description: null, catalogSlug: "openai" }]);
    const s = p.systems[0];
    expect(s.processing.activities).toEqual([{ id: "pa1", name: "Customer support" }]);
    expect(s.processing.legalBases[0].code).toBe("CONTRACT");
    expect(s.processing.legalBases[0].es).not.toBe("");
    expect(s.processing.dataSubjects).toEqual(["Customers"]);
    expect(s.dpia).toEqual({ state: "approved", url: "https://dpc.example/privacy/assessments/dp1" });
  });

  it("does not send back as new what came from AI Sentinel", async () => {
    db.aISystem.rows.push({ id: "s2", organizationId: "o1", name: "From AIS", vendor: null, metadata: { importedFrom: "aisentinel" }, aiSentinelSystemId: "ais-9", aiCapabilities: [], aiTechniques: [] });
    const p = await buildLinkPayload(db, "o1", "https://dpc.example");
    expect(p.systems.map((x) => x.dpcId)).toEqual(["s1"]);
    expect(p.knownAisSystemIds).toEqual(["ais-9"]);
  });
});

describe("what comes back from AI Sentinel", () => {
  const link = { active: true, aisOrganizationId: "ais-org", aisOrganizationName: "Acme AI", linkedAt: "", linkedByUserId: "u1", linkedByEmail: "o@x.test" };

  it("creates drafts once, links the vendor, and notes a copy whose original is gone, never deleting it", async () => {
    const r = {
      linked: true,
      aisSystems: [{ aisId: "ais-1", name: "Contract reviewer", description: null, purpose: null, vendorAisId: "aisv-1", vendorName: "Anthropic" }],
      aisVendors: [{ aisId: "aisv-1", name: "Anthropic", website: null, description: null, catalogSlug: "anthropic" }],
      presentAisSystemIds: ["ais-1"],
    };
    const first = await applyAisRecords(db, "o1", link, r);
    expect(first).toEqual({ createdSystems: 1, createdVendors: 1 });
    const created = db.aISystem.rows.find((x: Row) => x.aiSentinelSystemId === "ais-1");
    expect(created).toMatchObject({ status: "DRAFT", metadata: { importedFrom: "aisentinel" } });
    expect(db.vendor.rows.find((v: Row) => v.name === "Anthropic")).toMatchObject({ provenance: "IMPORTED", status: "PROSPECTIVE" });

    const again = await applyAisRecords(db, "o1", link, r);
    expect(again).toEqual({ createdSystems: 0, createdVendors: 0 });

    await applyAisRecords(db, "o1", link, { ...r, aisSystems: [], aisVendors: [], presentAisSystemIds: [] });
    const copy = db.aISystem.rows.find((x: Row) => x.aiSentinelSystemId === "ais-1");
    expect(copy.metadata.suiteNote.kind).toBe("removedInAiSentinel");
  });

  it("stops here too when AI Sentinel says the link is gone", async () => {
    db.organization.rows[0].settings = { aiSentinelLink: link };
    vi.stubEnv("AI_SENTINEL_API_URL", "https://ais.example");
    vi.stubEnv("AI_SENTINEL_API_KEY", "k");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ linked: false }), { status: 200 })));
    const out = await syncWithAiSentinel(db, "o1", "https://dpc.example");
    expect(out).toMatchObject({ unlinked: true });
    expect(readAisLink(db.organization.rows[0].settings)?.active).toBe(false);
  });
});
