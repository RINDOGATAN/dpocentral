// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The document pack (owner's decisions, 9 October 2026, step 5): one ZIP of
 * every ready document, the drafts too on request (marked DRAFT / BORRADOR in
 * their file names, their gaps on their first page), an index and an
 * integrity manifest, built the way AI Sentinel builds its programme pack.
 *
 * - which documents go in, and why the others stay out (src/lib/document-pack.ts);
 * - the ZIP writer and the manifest;
 * - the gaps page in front of a draft PDF;
 * - the whole pack over a mocked database and mocked builders, in English
 *   and Spanish;
 * - the route: who may ask.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { createTranslator } from "next-intl";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import type { DocumentFacts, EvaluatedDocument } from "@/config/document-register";
import { evaluateRegister, registerFor } from "@/config/document-register";
import { fileSlug, packCounts, packFileName, planPack } from "@/lib/document-pack";
import { collectText } from "./pdf-text";

const mocks = vi.hoisted(() => ({
  facts: null as unknown,
  ropaAccess: true,
  builder: vi.fn(),
  prisma: {
    assessment: { findMany: vi.fn(), count: vi.fn() },
    vendorContract: { findMany: vi.fn() },
    auditLog: { create: vi.fn() },
    organizationMember: { findFirst: vi.fn() },
    businessUnitMember: { findMany: vi.fn() },
  },
  token: null as null | { email: string },
}));

vi.mock("next-intl/server", async () => {
  const { createTranslator: make } = await import("next-intl");
  const enM = (await import("@/messages/en.json")).default;
  const esM = (await import("@/messages/es.json")).default;
  return {
    getTranslations: async ({ locale, namespace }: { locale: string; namespace: string }) =>
      make({ locale, messages: locale === "es" ? esM : enM, namespace: namespace as never }),
  };
});
vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/session-cookie", () => ({ getSessionToken: async () => mocks.token }));
vi.mock("@/i18n/server-locale", () => ({ getCookieLocale: async () => null }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/server/services/program/document-facts", () => ({ loadDocumentFacts: async () => mocks.facts }));
vi.mock("@/server/services/licensing/entitlement", () => ({ hasRopaExportAccess: async () => mocks.ropaAccess }));
for (const [file, fn] of [
  ["regulatory-landscape", "buildRegulatoryLandscapeExport"],
  ["ropa", "buildRopaExport"],
  ["vendor-register", "buildVendorRegisterExport"],
  ["assessment-portfolio", "buildAssessmentPortfolioExport"],
  ["dsar-performance", "buildDsarPerformanceExport"],
  ["breach-register", "buildBreachRegisterExport"],
  ["privacy-program", "buildPrivacyProgramExport"],
] as const) {
  vi.doMock(`@/server/services/export/documents/${file}`, () => ({
    [fn]: (args: unknown) => mocks.builder(file, args),
  }));
}
vi.mock("@/server/services/export/documents/assessment", () => ({
  ASSESSMENT_EXPORT_INCLUDE: {},
  buildAssessmentExport: async (a: { name: string }) => ({
    data: new TextEncoder().encode(`assessment ${a.name}`),
    filename: "x.pdf",
    contentType: "application/pdf",
    draft: false,
  }),
}));
vi.mock("@/server/services/export/documents/dpa", () => ({
  buildDpaExport: async (c: { vendor: { name: string } }, _org: string, kind: "dpa" | "tia") =>
    kind === "tia"
      ? null
      : {
          data: new TextEncoder().encode(`dpa ${c.vendor.name}`),
          filename: `DPA-${c.vendor.name}-2026-10-01.pdf`,
          contentType: "application/pdf",
          effectiveDate: "2026-10-01",
        },
}));

/** Facts for a client part of the way: a jurisdiction, confirmed records, one draft vendor. */
function facts(over: Partial<DocumentFacts> = {}): DocumentFacts {
  return {
    quickstartCompleted: true,
    jurisdictions: 1,
    dataAssets: 2,
    dataAssetsDrafts: 0,
    processingActivities: 2,
    processingActivitiesDrafts: 0,
    vendors: 3,
    vendorsDrafts: 1,
    assessments: 2,
    assessmentsApproved: 1,
    dsarRequests: 0,
    incidents: 0,
    activitiesIncomplete: 0,
    dpiaAssessments: 0,
    dpiaApproved: 0,
    dpiaAccess: "module",
    dpaContracts: 1,
    incidentsMissingImpact: 0,
    incidentNotifications: 0,
    aiAssistOn: false,
    dsarCompleted: 0,
    ...over,
  } as DocumentFacts;
}

function docs(f: DocumentFacts, dsarEnabled = true): EvaluatedDocument[] {
  return evaluateRegister(registerFor({ dsarEnabled }), f);
}

/** Reads a stored ZIP back: names and contents. */
function readZip(zip: Uint8Array): Map<string, Uint8Array> {
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const endAt = zip.length - 22;
  expect(v.getUint32(endAt, true)).toBe(0x06054b50);
  const count = v.getUint16(endAt + 10, true);
  let p = v.getUint32(endAt + 16, true);
  const out = new Map<string, Uint8Array>();
  for (let i = 0; i < count; i++) {
    const size = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true);
    const local = v.getUint32(p + 42, true);
    const name = new TextDecoder().decode(zip.subarray(p + 46, p + 46 + nameLen));
    const localNameLen = v.getUint16(local + 26, true);
    out.set(name, zip.subarray(local + 30 + localNameLen, local + 30 + localNameLen + size));
    p += 46 + nameLen;
  }
  return out;
}

const text = (b: Uint8Array | undefined) => new TextDecoder().decode(b);

describe("planPack: which documents go in", () => {
  const f = facts();
  const documents = docs(f);

  it("takes only the ready documents unless drafts are asked for, and says why the rest stay out", () => {
    const plan = planPack(documents, { includeDrafts: false, dsarAllowed: true });
    expect(plan.include.every((d) => d.state === "ready")).toBe(true);
    expect(plan.include.map((d) => d.entry.id)).toEqual(
      expect.arrayContaining(["regulatoryReport", "ropa", "dpa", "assessmentReport"]),
    );
    const why = Object.fromEntries(plan.leftOut.map((l) => [l.entry.id, l.reason]));
    expect(why.vendorRegister).toBe("draftsNotRequested");
    expect(why.dsarPerformance).toBe("needsInput");
    expect(why.dpia).toBe("needsInput");
    expect(why.privacyNotice).toBe("notYet");
    expect(why.breachNotification).toBe("needsInput");
  });

  it("adds the drafts with their gaps when asked", () => {
    const plan = planPack(documents, { includeDrafts: true, dsarAllowed: true });
    const vendor = plan.include.find((d) => d.entry.id === "vendorRegister")!;
    expect(vendor.state).toBe("draft");
    expect(vendor.gaps).toEqual([{ key: "toConfirm", count: 1 }]);
  });

  it("never packs a document shown on screen only, and leaves the DPIA to the assessment reports", () => {
    const ready = docs(facts({ aiAssistOn: true, incidents: 1, incidentNotifications: 1, dpiaAccess: "available", dpiaAssessments: 1, dpiaApproved: 1 }));
    const plan = planPack(ready, { includeDrafts: true, dsarAllowed: true });
    expect(plan.leftOut.find((l) => l.entry.id === "breachNotification")?.reason).toBe("screenOnly");
    expect(plan.include.find((d) => d.entry.id === "dpia")).toBeUndefined();
    expect(plan.leftOut.find((l) => l.entry.id === "dpia")).toBeUndefined();
  });

  it("respects the rights-request switch and who handles requests", () => {
    const withRequests = facts({ dsarRequests: 2, dsarCompleted: 1 });
    expect(planPack(docs(withRequests, false), { includeDrafts: true, dsarAllowed: true }).include.map((d) => d.entry.id)).not.toContain(
      "dsarPerformance",
    );
    const member = planPack(docs(withRequests), { includeDrafts: true, dsarAllowed: false });
    expect(member.leftOut.find((l) => l.entry.id === "dsarPerformance")?.reason).toBe("notForThisMember");
    const handler = planPack(docs(withRequests), { includeDrafts: true, dsarAllowed: true });
    expect(handler.include.map((d) => d.entry.id)).toContain("dsarPerformance");
  });

  it("leaves out an export this installation does not include", () => {
    const plan = planPack(documents, { includeDrafts: false, dsarAllowed: true, notEntitled: ["ropa"] });
    expect(plan.leftOut.find((l) => l.entry.id === "ropa")?.reason).toBe("notEntitled");
  });

  it("counts for the dashboard's button", () => {
    expect(packCounts(documents, { dsarAllowed: true })).toEqual({ ready: 4, drafts: 3 });
  });
});

describe("file names", () => {
  it("number the file and mark a draft in the reader's language", () => {
    expect(packFileName({ number: 3, name: "Vendor register", extension: "pdf", draft: false, draftMark: "DRAFT" })).toBe(
      "03-vendor-register.pdf",
    );
    expect(packFileName({ number: 3, name: "Registro de proveedores", extension: "csv", draft: true, draftMark: "BORRADOR" })).toBe(
      "03-BORRADOR-registro-de-proveedores.csv",
    );
    expect(fileSlug("Registro de actividades de tratamiento (RAT)")).toBe("registro-de-actividades-de-tratamiento-rat");
  });
});

describe("zip and manifest", () => {
  it("round-trips names and contents, and the manifest digests every file", async () => {
    const { createZip, crc32 } = await import("@/lib/zip");
    const { renderManifest, sha256 } = await import("@/server/services/export/integrity");
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    const files = readZip(createZip([{ name: "00-ÍNDICE.md", data: "Índice" }, { name: "a/b.pdf", data: new Uint8Array([1, 2]) }]));
    expect([...files.keys()]).toEqual(["00-ÍNDICE.md", "a/b.pdf"]);
    expect(text(files.get("00-ÍNDICE.md"))).toBe("Índice");
    const manifest = renderManifest(
      { generatedAt: "2026-10-09T10:00:00.000Z", appVersion: "1.0.0", commit: "abc1234" },
      [{ name: "a/b.pdf", bytes: 2, sha256: sha256(new Uint8Array([1, 2])) }],
      "es",
    );
    expect(manifest).toContain("MANIFIESTO DE INTEGRIDAD");
    expect(manifest).toContain(`${sha256(new Uint8Array([1, 2]))} | 2 | a/b.pdf`);
    expect(manifest).toContain("Versión de la aplicación: 1.0.0 (abc1234)");
  });
});

describe("a draft's gaps on its first page", () => {
  it("puts a page with the gaps in front of the document's own pages", async () => {
    const { Document, Page, Text } = await import("@react-pdf/renderer");
    const { withDraftGapsPage } = await import("@/server/services/export/draft-gaps-page");
    const doc = React.createElement(Document, null, React.createElement(Page, null, React.createElement(Text, null, "Cover")));
    const note = {
      mark: "BORRADOR",
      title: "Registro de proveedores",
      intro: "Falta lo siguiente:",
      gapsTitle: "Este documento es un borrador",
      gaps: ["1 registro por confirmar"],
      generated: "Generado el 2026-10-09",
    };
    const drafted = withDraftGapsPage(doc, note);
    const pages = React.Children.toArray((drafted.props as { children: React.ReactNode }).children);
    expect(pages).toHaveLength(2);
    const first = collectText(pages[0]).join(" ");
    expect(first).toContain("BORRADOR");
    expect(first).toContain("1 registro por confirmar");
    expect(collectText(pages[1]).join(" ")).toContain("Cover");
    expect(withDraftGapsPage(doc, null)).toBe(doc);

    const { renderToBuffer } = await import("@react-pdf/renderer");
    const buffer = await renderToBuffer(drafted);
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
  });
});

describe("buildDocumentPack", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.facts = facts();
    mocks.ropaAccess = true;
    mocks.builder.mockImplementation(async (file: string, args: { format?: string; draftNote?: unknown; audit?: boolean }) => ({
      data: `${file} ${args.format} ${args.draftNote ? "with-gaps-page" : "plain"} audit=${args.audit}`,
      filename: `${file}.${args.format}`,
      contentType: "application/pdf",
    }));
    mocks.prisma.assessment.findMany.mockImplementation(async ({ where }: { where: { status: unknown } }) =>
      [
        { name: "Loyalty", status: "APPROVED", template: { type: "LIA" }, completedAt: new Date("2026-09-30T00:00:00Z"), updatedAt: new Date() },
        { name: "Payroll", status: "IN_PROGRESS", template: { type: "DPIA" }, completedAt: null, updatedAt: new Date("2026-10-02T00:00:00Z") },
      ].filter((a) => (where.status === "APPROVED" ? a.status === "APPROVED" : true)),
    );
    mocks.prisma.assessment.count.mockResolvedValue(1);
    mocks.prisma.vendorContract.findMany.mockResolvedValue([{ metadata: {}, vendor: { name: "Mailer" } }]);
  });

  async function build(locale: "en" | "es", includeDrafts: boolean) {
    const { buildDocumentPack } = await import("@/server/services/export/document-pack");
    return buildDocumentPack(mocks.prisma as never, {
      organizationId: "org-1",
      orgName: "Harbour Bakery",
      userId: "user-1",
      locale,
      includeDrafts,
      dsarAllowed: true,
    });
  }

  it("holds the ready documents, an index and a manifest", async () => {
    const pack = await build("en", false);
    const files = readZip(pack.zip);
    expect(pack.files[0]).toBe("00-INDEX.md");
    expect(pack.files.at(-1)).toBe("99-MANIFEST.txt");
    expect(pack.files).toEqual(
      expect.arrayContaining([
        "01-regulatory-report.pdf",
        "02-records-of-processing-ropa.pdf",
        "02-records-of-processing-ropa.csv",
        "03-dpa/DPA-Mailer-2026-10-01.pdf",
        "04-assessments/legitimate-interest-assessment-loyalty.pdf",
      ]),
    );
    expect(pack.files.some((f) => f.includes("DRAFT"))).toBe(false);
    expect(pack.files.some((f) => f.includes("payroll"))).toBe(false);
    // The builders render without their own audit entry; the pack writes one.
    expect(text(files.get("01-regulatory-report.pdf"))).toBe("regulatory-landscape pdf plain audit=false");
    expect(mocks.prisma.auditLog.create).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.auditLog.create.mock.calls[0][0].data.action).toBe("EXPORT_DOCUMENT_PACK");

    const index = text(files.get("00-INDEX.md"));
    expect(index).toContain("# Document pack: Harbour Bakery");
    expect(index).toContain("| Regulatory report | ready |");
    expect(index).toContain("| Legitimate Interest Assessment: Loyalty | ready | 2026-09-30 |");
    expect(index).toContain("| DPA with Mailer | ready | 2026-10-01 |");
    expect(index).toContain("- Vendor register: draft (1 record to confirm); drafts were not asked for");
    expect(index).toContain("- DPIA: needs: the DPIA module");
    expect(index).toContain("- Privacy notice: not in DPO Central yet");
    expect(index).toContain("1 assessment is not approved yet: drafts were not asked for");

    const manifest = text(files.get("99-MANIFEST.txt"));
    for (const name of pack.files.slice(0, -1)) expect(manifest).toContain(` | ${name}`);
  });

  it("adds the drafts marked as drafts, with the gaps page on the PDFs only, in Spanish", async () => {
    const pack = await build("es", true);
    const files = readZip(pack.zip);
    expect(pack.files[0]).toBe("00-INDICE.md");
    expect(pack.files.at(-1)).toBe("99-MANIFIESTO.txt");
    const vendorPdf = pack.files.find((f) => f.endsWith("BORRADOR-registro-de-proveedores.pdf"))!;
    const vendorCsv = pack.files.find((f) => f.endsWith("BORRADOR-registro-de-proveedores.csv"))!;
    expect(text(files.get(vendorPdf))).toBe("vendor-register pdf with-gaps-page audit=false");
    expect(text(files.get(vendorCsv))).toBe("vendor-register csv plain audit=false");
    const note = mocks.builder.mock.calls.find((c) => c[0] === "vendor-register" && c[1].format === "pdf")![1].draftNote;
    expect(note).toMatchObject({ mark: "BORRADOR", title: "Registro de proveedores", gaps: ["1 registro por confirmar"] });
    // The assessment not approved yet goes in as a draft; its own cover lists what is outstanding.
    expect(pack.files.filter((f) => f.startsWith("05-evaluaciones/"))).toHaveLength(2);
    expect(pack.files.filter((f) => f.startsWith("05-evaluaciones/BORRADOR-"))).toHaveLength(1);
    const index = text(files.get("00-INDICE.md"));
    expect(index).toContain("# Paquete de documentos: Harbour Bakery");
    expect(index).toContain("| Registro de proveedores | borrador: 1 registro por confirmar |");
    expect(index).toContain("BORRADOR");
    expect(pack.filename).toMatch(/^Paquete-de-documentos-harbour-bakery-\d{4}-\d{2}-\d{2}\.zip$/);
  });

  it("leaves out the records of processing where its export is not installed", async () => {
    mocks.ropaAccess = false;
    const pack = await build("en", false);
    expect(pack.files.some((f) => f.includes("records-of-processing"))).toBe(false);
    expect(text(readZip(pack.zip).get("00-INDEX.md"))).toContain(
      "- Records of processing (ROPA): its export is not included in this installation",
    );
  });
});

describe("GET /api/export/document-pack", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.facts = facts();
    mocks.builder.mockResolvedValue({ data: "x", filename: "x.pdf", contentType: "application/pdf" });
    mocks.prisma.assessment.findMany.mockResolvedValue([]);
    mocks.prisma.assessment.count.mockResolvedValue(0);
    mocks.prisma.vendorContract.findMany.mockResolvedValue([]);
  });

  const call = async (query: string) => {
    const { GET } = await import("@/app/api/export/document-pack/route");
    return GET(new Request(`http://localhost/api/export/document-pack?${query}`));
  };

  it("asks for a session and a membership", async () => {
    mocks.token = null;
    expect((await call("organizationId=org-1")).status).toBe(401);
    mocks.token = { email: "a@example.com" };
    mocks.prisma.organizationMember.findFirst.mockResolvedValue(null);
    expect((await call("organizationId=org-1")).status).toBe(403);
    expect((await call("")).status).toBe(400);
  });

  it("refuses a member limited to departments, as the dashboard shows them no documents", async () => {
    mocks.token = { email: "b@example.com" };
    mocks.prisma.organizationMember.findFirst.mockResolvedValue({
      id: "m-1",
      userId: "u-1",
      role: "MEMBER",
      organization: { name: "Harbour Bakery" },
    });
    mocks.prisma.businessUnitMember.findMany.mockResolvedValue([{ businessUnitId: "bu-1" }]);
    expect((await call("organizationId=org-1")).status).toBe(403);
  });

  it("answers a ZIP to a member of the whole organisation", async () => {
    mocks.token = { email: "c@example.com" };
    mocks.prisma.organizationMember.findFirst.mockResolvedValue({
      id: "m-2",
      userId: "u-2",
      role: "OWNER",
      organization: { name: "Harbour Bakery" },
    });
    mocks.prisma.businessUnitMember.findMany.mockResolvedValue([]);
    const res = await call("organizationId=org-1&drafts=1&locale=es");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/zip");
    expect(res.headers.get("Content-Disposition")).toContain("Paquete-de-documentos-harbour-bakery");
    const names = [...readZip(new Uint8Array(await res.arrayBuffer())).keys()];
    expect(names[0]).toBe("00-INDICE.md");
  });
});

// The messages the pack and the button read exist in both languages.
describe("messages", () => {
  it("are in English and Spanish, with no long dash", () => {
    for (const [m, locale] of [[en, "en"], [es, "es"]] as const) {
      const t = createTranslator({ locale, messages: m, namespace: "pdf.documentPack" });
      expect(t("index.title", { org: "X" })).not.toContain("—");
      expect(m.documentRegister.pack.button.length).toBeGreaterThan(0);
    }
    expect(es.documentRegister.pack.button).toBe("Descargar documentos listos");
    expect(en.documentRegister.pack.button).toBe("Download ready documents");
  });
});
