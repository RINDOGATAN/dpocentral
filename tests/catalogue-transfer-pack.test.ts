// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { describe, expect, it } from "vitest";
import {
  CATALOGUE_TRANSFER_PACKS,
  packText,
  transferPackBySource,
  transferPackFor,
} from "@/config/catalogue-transfer-packs";
import { applyCatalogueTransferPack, packTiaResponses, PACK_MARKER } from "@/server/services/catalogue-transfer-pack";
import {
  localizePackAssessment,
  localizePackTransfer,
  localizedChecklistAnswers,
} from "@/server/services/catalogue-transfer-pack-locale";
import { SCHREMS_II_CHECKLIST, SUPPLEMENTARY_MEASURES } from "@/config/transfer-compliance-rules";
import { ASSESSMENT_TEMPLATES_V2 } from "@/config/assessment-templates-v2";
import { TODOLAW_SOURCE_REF } from "@/lib/todolaw-source";
import type { Db } from "@/lib/prisma";

const tia = ASSESSMENT_TEMPLATES_V2.find((t) => t.type === "TIA") as unknown as {
  sections: { questions: { id: string; options?: { en: string; es: string }[] }[] }[];
};
const questions = new Map(tia.sections.flatMap((s) => s.questions.map((q) => [q.id, q] as const)));
const pack = transferPackFor("onetrust")!;

describe("the consent-platform transfer pack (content)", () => {
  it("is found by its catalogue slug and by its source, and TODO.LAW has none", () => {
    expect(pack).not.toBeNull();
    expect(transferPackBySource(pack.sourceRef)).toBe(pack);
    expect(transferPackFor(TODOLAW_SOURCE_REF)).toBeNull();
    expect(transferPackFor("unknown-vendor")).toBeNull();
  });

  it("uses only options the TIA template offers", () => {
    for (const [qid, choice] of Object.entries(pack.tia.choices)) {
      const q = questions.get(qid);
      expect(q, qid).toBeDefined();
      if (typeof choice === "boolean") continue;
      for (const c of Array.isArray(choice) ? choice : [choice]) {
        expect(q!.options?.map((o) => o.en), `${qid}: ${c}`).toContain(c);
      }
    }
  });

  it("leaves the customer's own judgment open: likelihood, severity, verdict, conditions and requests in practice", () => {
    for (const qid of ["tiav2_2_3", "tiav2_4_1", "tiav2_4_2", "tiav2_4_3", "tiav2_4_4"]) {
      expect(pack.tia.choices[qid], qid).toBeUndefined();
      expect(pack.tia.text.en[qid], qid).toBeUndefined();
    }
    const answered = packTiaResponses(pack, "en").map((r) => r.questionId);
    expect(answered).not.toContain("tiav2_4_3");
  });

  it("has every text in English and Spanish", () => {
    expect(Object.keys(pack.tia.text.es).sort()).toEqual(Object.keys(pack.tia.text.en).sort());
    for (const b of [pack.transfer.name, pack.transfer.description, pack.transfer.safeguards, pack.tia.title.name, pack.tia.title.description, pack.product]) {
      expect(b.en.length).toBeGreaterThan(0);
      expect(b.es.length).toBeGreaterThan(0);
      expect(b.es).not.toBe(b.en);
    }
    for (const c of Object.values(pack.checklist)) {
      expect(c.note.en).toBeTruthy();
      expect(c.note.es).toBeTruthy();
    }
  });

  it("names only existing checklist points and measures", () => {
    const points = SCHREMS_II_CHECKLIST.map((c) => c.id);
    for (const id of Object.keys(pack.checklist)) expect(points).toContain(id);
    const measures = SUPPLEMENTARY_MEASURES.map((m) => m.id);
    for (const m of pack.supplementaryMeasures) expect(measures).toContain(m);
  });

  it("relies on the Data Privacy Framework with the SCC as fallback, never claims keys the importer cannot reach, and has no long dashes", () => {
    expect(pack.transfer.mechanism).toBe("ADEQUACY_DECISION");
    expect(pack.tia.choices.tiav2_2_1).toBe("Yes, partial adequacy");
    expect(pack.transfer.adequacyScopeReference).toMatch(/^https:\/\/www\.dataprivacyframework\.gov\/participant\/\d+$/);
    expect(pack.transfer.safeguards.en).toMatch(/2021\/914/);
    expect(pack.tia.choices.tiav2_3_1).not.toContain("Encryption at rest, importer cannot access the keys");
    const all = JSON.stringify(CATALOGUE_TRANSFER_PACKS);
    expect(all).not.toContain("—");
    expect(all).not.toMatch(/\bCCT\b/);
    expect(all).not.toMatch(/\busted\b/i);
  });

  it("dates every source", () => {
    expect(pack.sources.length).toBeGreaterThan(3);
    for (const s of pack.sources) {
      expect(s.url).toMatch(/^https:\/\//);
      expect(s.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

// ── A small in-memory stand-in for the calls the service makes ───────────

type Row = Record<string, unknown>;

function fakeDb(opts: { quickstartTransfer?: boolean; withTemplate?: boolean } = {}) {
  const transfers: Row[] = [];
  const assessments: Row[] = [];
  const responses: Row[] = [];
  const approvals: Row[] = [];
  const vendors: Row[] = [{ id: "v1", organizationId: "o1" }];
  const members = [
    { organizationId: "o1", userId: "admin", role: "ADMIN", joinedAt: 1 },
    { organizationId: "o1", userId: "owner", role: "OWNER", joinedAt: 2 },
  ];
  if (opts.quickstartTransfer) {
    transfers.push({ id: "t0", organizationId: "o1", vendorId: "v1", destinationCountry: "US", metadata: null, processingActivityId: "pa1", createdAt: 0 });
  }
  let seq = 0;
  const matches = (row: Row, where: Row): boolean =>
    Object.entries(where).every(([k, v]) => {
      if (k === "metadata" && v && typeof v === "object") {
        const m = (row.metadata ?? {}) as Row;
        const { path, equals } = v as { path: string[]; equals: unknown };
        return m[path[0]!] === equals;
      }
      return row[k] === v;
    });
  const dataTransfer = {
    findFirst: async ({ where }: { where: Row }) => {
      const t = transfers.find((r) => matches(r, where));
      return t ? { ...t, _count: { assessments: assessments.filter((a) => a.dataTransferId === t.id).length } } : null;
    },
    create: async ({ data }: { data: Row }) => {
      const row = { id: `t${++seq}`, createdAt: seq, ...data };
      transfers.push(row);
      return row;
    },
    update: async ({ where, data }: { where: { id: string }; data: Row }) => {
      const row = transfers.find((r) => r.id === where.id)!;
      Object.assign(row, data);
      return row;
    },
  };
  const tx = {
    dataTransfer,
    assessment: {
      create: async ({ data }: { data: Row }) => {
        const row = { id: `a${++seq}`, ...data };
        assessments.push(row);
        return row;
      },
    },
    assessmentResponse: { createMany: async ({ data }: { data: Row[] }) => void responses.push(...data) },
    organizationMember: {
      findMany: async ({ where }: { where: { organizationId: string; role: { in: string[] } } }) =>
        members
          .filter((m) => m.organizationId === where.organizationId && where.role.in.includes(m.role))
          .sort((a, b) => a.joinedAt - b.joinedAt),
    },
    assessmentApproval: { create: async ({ data }: { data: Row }) => void approvals.push(data) },
  };
  const db = {
    ...tx,
    vendor: { findFirst: async ({ where }: { where: Row }) => vendors.find((v) => matches(v, where)) ?? null },
    assessmentTemplate: { findFirst: async () => (opts.withTemplate === false ? null : { id: "tpl-tia" }) },
    $transaction: async <T>(fn: (t: typeof tx) => Promise<T>) => fn(tx),
  };
  return { db: db as unknown as Db, transfers, assessments, responses, approvals };
}

describe("applying the pack when the vendor is added", () => {
  const now = new Date("2026-10-26T10:00:00Z");

  it("creates the transfer, measures, checklist and a TIA waiting for the owner's approval", async () => {
    const f = fakeDb();
    const r = await applyCatalogueTransferPack(f.db, { organizationId: "o1", vendorId: "v1", slug: "onetrust", locale: "es", now });
    expect(r.applied).toBe(true);
    expect(f.transfers).toHaveLength(1);
    const t = f.transfers[0]!;
    expect(t.mechanism).toBe("ADEQUACY_DECISION");
    expect(t.complianceStatus).toBe("PENDING");
    expect(t.name).toBe(pack.transfer.name.es);
    expect(t.adequacyScopeReference).toBe(pack.transfer.adequacyScopeReference);
    expect((t.metadata as Row).source).toBe(pack.sourceRef);
    expect((t.metadata as Row)[PACK_MARKER]).toBe(pack.version);
    expect(Object.keys(t.supplementaryMeasures as Row).sort()).toEqual([...pack.supplementaryMeasures].sort());
    expect(f.assessments).toHaveLength(1);
    expect(f.assessments[0]!.status).toBe("PENDING_APPROVAL");
    expect(f.approvals).toEqual([{ assessmentId: f.assessments[0]!.id, approverId: "owner", level: 1, status: "PENDING" }]);
    const tool = f.responses.find((x) => x.questionId === "tiav2_1_1");
    expect(tool?.response).toBe("Decisión de adecuación (art. 45)");
  });

  it("reuses the transfer the quick start created for the vendor, keeping its activity", async () => {
    const f = fakeDb({ quickstartTransfer: true });
    await applyCatalogueTransferPack(f.db, { organizationId: "o1", vendorId: "v1", slug: "onetrust", locale: "en", now });
    expect(f.transfers).toHaveLength(1);
    expect(f.transfers[0]!.id).toBe("t0");
    expect(f.assessments[0]!.processingActivityId).toBe("pa1");
  });

  it("never duplicates: adding the vendor again leaves everything as it is", async () => {
    const f = fakeDb();
    await applyCatalogueTransferPack(f.db, { organizationId: "o1", vendorId: "v1", slug: "onetrust", locale: "en", now });
    const again = await applyCatalogueTransferPack(f.db, { organizationId: "o1", vendorId: "v1", slug: "onetrust", locale: "en", now });
    expect(again).toEqual({ applied: false, reason: "done" });
    expect(f.transfers).toHaveLength(1);
    expect(f.assessments).toHaveLength(1);
  });

  it("does nothing for a vendor without a pack, or a vendor of another organisation", async () => {
    const f = fakeDb();
    expect(await applyCatalogueTransferPack(f.db, { organizationId: "o1", vendorId: "v1", slug: "acme", locale: "en" })).toEqual({ applied: false, reason: "no-pack" });
    expect(await applyCatalogueTransferPack(f.db, { organizationId: "o2", vendorId: "v1", slug: "onetrust", locale: "en" })).toEqual({ applied: false, reason: "no-vendor" });
    expect(f.transfers).toHaveLength(0);
  });

  it("still records the transfer when no TIA template is installed", async () => {
    const f = fakeDb({ withTemplate: false });
    const r = await applyCatalogueTransferPack(f.db, { organizationId: "o1", vendorId: "v1", slug: "onetrust", locale: "en", now });
    expect(r).toMatchObject({ applied: true, assessmentId: null });
    expect(f.transfers).toHaveLength(1);
    expect(f.assessments).toHaveLength(0);
  });
});

describe("showing the pack's records in the reader's language", () => {
  const meta = { source: pack.sourceRef };

  it("shows an unedited transfer in the reader's language and an edited one as typed", () => {
    const stored = { metadata: meta, name: pack.transfer.name.es, description: pack.transfer.description.es, safeguards: "Mi texto" };
    const shown = localizePackTransfer(stored, "en");
    expect(shown.name).toBe(pack.transfer.name.en);
    expect(shown.description).toBe(pack.transfer.description.en);
    expect(shown.safeguards).toBe("Mi texto");
    const other = { metadata: { source: TODOLAW_SOURCE_REF }, name: "x", safeguards: "y" };
    expect(localizePackTransfer(other, "en")).toBe(other);
  });

  it("shows the checklist notes in the reader's language", () => {
    const metadata = {
      ...meta,
      schremsChecklist: { s2_3_assess_laws: { state: "DONE", note: pack.checklist.s2_3_assess_laws!.note.en } },
    };
    expect(localizedChecklistAnswers(metadata, "es").s2_3_assess_laws?.note).toBe("Consulta la EIT, paso 2.");
  });

  it("shows the assessment's title, options and texts in the reader's language", () => {
    const responses = packTiaResponses(pack, "es");
    const shown = localizePackAssessment(
      { metadata: meta, name: pack.tia.title.name.es, description: pack.tia.title.description.es, responses },
      "en",
    );
    expect(shown.name).toBe(pack.tia.title.name.en);
    expect(shown.responses!.find((r) => r.questionId === "tiav2_1_1")?.response).toBe("Adequacy decision (Art. 45)");
    expect(shown.responses!.find((r) => r.questionId === "tiav2_3_2")?.response).toEqual(pack.tia.choices.tiav2_3_2);
    expect(shown.responses!.find((r) => r.questionId === "tiav2_1_4")?.response).toBe(pack.tia.text.en.tiav2_1_4);
  });

  it("packText keeps empty and edited values", () => {
    const b = { en: "Hello", es: "Hola" };
    expect(packText(null, b, "en")).toBeNull();
    expect(packText("Hola", b, "en")).toBe("Hello");
    expect(packText("Hola, editado", b, "en")).toBe("Hola, editado");
  });
});
