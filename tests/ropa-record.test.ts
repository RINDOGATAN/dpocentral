// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The record of processing (GDPR Art. 30): the controller block, the security
 * measures, the processor record, the CSV and XLSX table (labels, dates, byte
 * order mark, column order) and the cover figures.
 */

import { describe, expect, it, vi } from "vitest";
import AdmZip from "adm-zip";

vi.mock("next-intl/server", async () => {
  const { createTranslator: make } = await import("next-intl");
  const enM = (await import("@/messages/en.json")).default;
  const esM = (await import("@/messages/es.json")).default;
  return {
    getTranslations: async ({ locale, namespace }: { locale: string; namespace: string }) =>
      make({ locale, messages: locale === "es" ? esM : enM, namespace: namespace as never }),
  };
});

import { createTranslator } from "next-intl";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import {
  generateROPASummary,
  validateROPAEntry,
  type ROPAEntry,
} from "@/server/services/privacy/ropaGenerator";
import {
  effectiveControllerDetails,
  loadRopaData,
  type ControllerDetails,
} from "@/server/services/export/ropa/record-data";
import {
  CONTROLLER_COLUMNS_AEPD,
  CONTROLLER_COLUMNS_ART30,
  countryName,
  formatRopaDate,
  ropaTable,
  ropaText,
  tableToCsv,
} from "@/server/services/export/ropa/record-text";
import { RopaDocument } from "@/server/services/export/ropa/RopaDocument";
import { createXlsx } from "@/lib/xlsx";
import { fileTitle } from "@/server/services/export/documents/context";
import { collectText } from "./pdf-text";

const controller: ControllerDetails = {
  legalName: "Ejemplo Logística, S.L.",
  taxId: "B12345678",
  address: "Calle Mayor 1, 28001 Madrid",
  email: "privacidad@ejemplo.es",
  phone: null,
  dpoName: "Oficina del DPD",
  dpoContact: "dpd@ejemplo.es",
  representativeName: null,
  representativeContact: null,
  securityMeasures: "Cifrado en reposo; control de acceso por perfiles",
};

const entry: ROPAEntry = {
  name: "Payroll",
  purpose: "Pay staff",
  legalBasis: "CONTRACT",
  legalBasisDetail: null,
  role: "CONTROLLER",
  dataSubjects: ["Employees"],
  dataCategories: ["IDENTIFIERS", "HEALTH"],
  recipients: ["Bank"],
  retentionPeriod: null,
  retentionDays: 1825,
  securityMeasures: controller.securityMeasures,
  securityInherited: true,
  automatedDecisionMaking: false,
  systems: [{ name: "HR app", type: "APPLICATION", elements: [] }],
  transfers: [{ destination: "US", organization: "Payroll Inc", mechanism: "STANDARD_CONTRACTUAL_CLAUSES", safeguards: "SCC 2021" }],
  // A date-only value: stored at UTC midnight, it must print as that day everywhere.
  lastReviewed: new Date("2025-10-01T00:00:00.000Z"),
  nextReview: new Date("2026-10-01T00:00:00.000Z"),
};

const processorEntry: ROPAEntry = {
  ...entry,
  name: "Hosting for client",
  role: "PROCESSOR",
  purpose: "Hosting and backups",
  clientControllerName: "Cliente Uno, S.A.",
  clientControllerContact: "dpo@cliente.example",
  clientRepresentative: null,
  clientDpo: "dpo@cliente.example",
  transfers: [],
};

const RAW_CODE = /\b[A-Z]{2,}_[A-Z_]+\b|\b(CONTRACT|IDENTIFIERS|HEALTH|CONTROLLER|PROCESSOR)\b/;

describe("controller block (Art. 30(1)(a))", () => {
  it("falls back to what the app knows, and stored values win", () => {
    const empty = effectiveControllerDetails({}, { orgName: "Acme", contactEmail: "privacy@acme.example" });
    expect(empty.legalName).toBe("Acme");
    expect(empty.email).toBe("privacy@acme.example");
    expect(empty.dpoName).toBeNull();
    const filled = effectiveControllerDetails(
      { controllerLegalName: " Acme Ltd ", controllerEmail: "dpo@acme.example", dpoName: "Jane", securityMeasures: "  " },
      { orgName: "Acme", contactEmail: "privacy@acme.example" },
    );
    expect(filled.legalName).toBe("Acme Ltd");
    expect(filled.email).toBe("dpo@acme.example");
    expect(filled.securityMeasures).toBeNull();
  });

  it("is printed on the PDF cover, with the DPO and the general security measures", async () => {
    const x = await ropaText("es");
    const t = createTranslator({ locale: "es", messages: es, namespace: "pdf.ropaReport" });
    const tCommon = createTranslator({ locale: "es", messages: es, namespace: "pdf.common" });
    const tEnum = createTranslator({ locale: "es", messages: es, namespace: "pdf.enum" });
    const text = collectText(
      RopaDocument({ entries: [entry], orgName: "Ejemplo", t: t as never, tCommon: tCommon as never, tEnum: tEnum as never, controller, x }),
    ).join(" | ");
    expect(text).toContain("Ejemplo Logística, S.L.");
    expect(text).toContain("B12345678");
    expect(text).toContain("Delegado de protección de datos");
    expect(text).toContain("Oficina del DPD · dpd@ejemplo.es");
    expect(text).toContain("Representante en la Unión (artículo 27)");
    expect(text).toContain("No designado");
    expect(text).toContain("Cifrado en reposo; control de acceso por perfiles");
    // Readable values, never codes; Spanish dates; days kept.
    expect(text).toContain("Estados Unidos");
    expect(text).toContain("Cláusulas contractuales tipo");
    expect(text).toContain("1825 días");
    expect(text).toContain("1 de octubre de 2025");
    expect(text).not.toMatch(/STANDARD_CONTRACTUAL_CLAUSES|Never reviewed/);
  });
});

describe("processor record (Art. 30(2))", () => {
  it("has its own Spanish title and the controller on whose behalf", async () => {
    const x = await ropaText("es");
    const t = createTranslator({ locale: "es", messages: es, namespace: "pdf.ropaReport" });
    const tCommon = createTranslator({ locale: "es", messages: es, namespace: "pdf.common" });
    const tEnum = createTranslator({ locale: "es", messages: es, namespace: "pdf.enum" });
    const text = collectText(
      RopaDocument({
        entries: [processorEntry],
        orgName: "Ejemplo",
        kind: "processor",
        t: t as never,
        tCommon: tCommon as never,
        tEnum: tEnum as never,
        controller,
        x,
      }),
    ).join(" | ");
    expect(text).toContain("Registro de actividades de tratamiento como encargado");
    expect(text).toContain("Encargado del tratamiento");
    expect(text).toContain("Cliente Uno, S.A.");
    expect(text).toContain("Categorías de tratamientos efectuados");
    expect(text).toContain("Hosting and backups");
  });

  it("table: processor, each controller, categories of processing, transfers and security", async () => {
    const x = await ropaText("en");
    const table = ropaTable("processor", [processorEntry], controller, x);
    expect(table.headers.slice(0, 9)).toEqual([
      "Processor",
      "Processor contact details",
      "Data protection officer",
      "Representative in the Union",
      "Controller on whose behalf we act",
      "Controller contact details",
      "Controller's representative",
      "Controller's data protection officer",
      "Processing activity",
    ]);
    const row = Object.fromEntries(table.headers.map((h, i) => [h, table.rows[0][i]]));
    expect(row["Controller on whose behalf we act"]).toBe("Cliente Uno, S.A.");
    expect(row["Categories of processing carried out"]).toBe("Hosting and backups");
    expect(row["International transfers and safeguards"]).toBe("No international transfers");
    expect(row["Technical and organizational security measures"]).toBe(controller.securityMeasures);
  });

  it("the loader puts each role in its record and applies the department limit", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const prisma = {
      organization: { findUnique: async () => ({ name: "Acme", securityMeasures: "Org measures" }) },
      dSARIntakeForm: { findFirst: async () => null },
      processingActivity: {
        findMany: async (args: { where: Record<string, unknown> }) => {
          calls.push(args.where);
          return [];
        },
      },
      dataTransfer: { findMany: async () => [{ destinationCountry: "US", destinationOrg: null, mechanism: "OTHER", safeguards: null, tiaCompleted: false, tiaDate: null }] },
    } as never;
    const ctl = await loadRopaData(prisma, "org1");
    expect(calls[0]).toMatchObject({ organizationId: "org1", isActive: true, role: { in: ["CONTROLLER", "JOINT_CONTROLLER"] } });
    expect(ctl.unassignedTransfers).toHaveLength(1);
    expect(ctl.controller.securityMeasures).toBe("Org measures");

    const proc = await loadRopaData(prisma, "org1", { kind: "processor", scope: { all: false, businessUnitIds: ["bu1"] } });
    expect(calls[1]).toMatchObject({ role: { in: ["PROCESSOR"] }, AND: [{ businessUnitId: { in: ["bu1"] } }] });
    // Organisation-wide transfers are not shown to a department-limited reader.
    expect(proc.unassignedTransfers).toEqual([]);
  });
});

describe("the table (CSV and XLSX)", () => {
  it("English follows Art. 30 order, Spanish the authority's published order", async () => {
    const enT = ropaTable("controller", [entry], controller, await ropaText("en"));
    const esT = ropaTable("controller", [entry], controller, await ropaText("es"));
    expect(enT.headers).toHaveLength(CONTROLLER_COLUMNS_ART30.length);
    expect(enT.headers.slice(0, 2)).toEqual(["Processing activity", "Controller"]);
    expect(enT.headers.indexOf("Legal basis")).toBeGreaterThan(enT.headers.indexOf("Technical and organizational security measures"));
    expect(esT.headers).toHaveLength(CONTROLLER_COLUMNS_AEPD.length);
    expect(esT.headers.indexOf("Base jurídica")).toBe(esT.headers.indexOf("Fines del tratamiento") + 1);
    expect(esT.headers).toContain("Medidas técnicas y organizativas de seguridad");
  });

  it("labels, never codes, in both languages", async () => {
    for (const locale of ["en", "es"] as const) {
      const table = ropaTable("controller", [entry], controller, await ropaText(locale));
      expect(table.rows[0].join(" | ")).not.toMatch(RAW_CODE);
    }
    const enRow = ropaTable("controller", [entry], controller, await ropaText("en")).rows[0].join(" | ");
    expect(enRow).toContain("Contract");
    expect(enRow).toContain("United States: Payroll Inc (Standard contractual clauses; SCC 2021)");
    expect(enRow).toContain("1,825 days");
    expect(enRow).toContain("Health");
  });

  it("CSV: byte order mark, the Spanish separator and UTC dates", async () => {
    const csv = tableToCsv(ropaTable("controller", [entry], controller, await ropaText("es")), "es");
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const [head, row] = csv.slice(1).split("\r\n");
    expect(head.split(";")[0]).toBe("Actividad de tratamiento");
    expect(row).toContain("01/10/2025");
    expect(row).toContain("01/10/2026");
    const enCsv = tableToCsv(ropaTable("controller", [entry], controller, await ropaText("en")), "en");
    expect(enCsv.charCodeAt(0)).toBe(0xfeff);
    expect(enCsv).toContain("2025-10-01");
  });

  it("dates never move a day, whatever the time zone", () => {
    expect(formatRopaDate(new Date("2025-10-01T00:00:00.000Z"), "es")).toBe("01/10/2025");
    expect(formatRopaDate("2025-10-01", "en")).toBe("2025-10-01");
  });

  it("a cell a spreadsheet would read as a formula is neutralised", async () => {
    const evil = { ...entry, name: "=HYPERLINK(\"x\")" };
    const csv = tableToCsv(ropaTable("controller", [evil], controller, await ropaText("en")), "en");
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });

  it("country names in each language", () => {
    expect(countryName("US", "es")).toBe("Estados Unidos");
    expect(countryName("GB", "en")).toBe("United Kingdom");
    expect(countryName("UK", "en")).toBe("United Kingdom");
    expect(countryName("Mumbai, India", "en")).toBe("Mumbai, India");
  });

  it("XLSX: a valid workbook with the header and every value as text", async () => {
    const table = ropaTable("controller", [entry], controller, await ropaText("es"));
    const bytes = createXlsx([
      { name: "RAT", rows: [table.headers, ...table.rows], header: true },
      { name: "Responsable", rows: [["Campo", "Valor"], ["NIF", "B12345678"]], header: true },
    ]);
    const zip = new AdmZip(Buffer.from(bytes));
    const names = zip.getEntries().map((e) => e.entryName);
    expect(names).toEqual(
      expect.arrayContaining(["[Content_Types].xml", "xl/workbook.xml", "xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml", "xl/styles.xml"]),
    );
    const sheet = zip.readAsText("xl/worksheets/sheet1.xml");
    expect(sheet).toContain('<pane ySplit="1"');
    expect(sheet).toContain("Actividad de tratamiento");
    expect(sheet).toContain("Logística");
    expect(sheet).not.toMatch(/<f>/);
    expect(zip.readAsText("xl/workbook.xml")).toContain('name="Responsable"');
  });
});

describe("cover figures and warnings", () => {
  it("a fresh record counts every never-reviewed activity as pending review", () => {
    const fresh = [1, 2, 3].map((i) => ({ ...entry, name: `A${i}`, lastReviewed: null, nextReview: null }));
    const s = generateROPASummary(fresh);
    expect(s.needingReview).toBe(3);
    expect(s.neverReviewed).toBe(3);
  });

  it("reviewed with a future date is not pending; a past date is", () => {
    const now = new Date("2026-06-01T00:00:00Z");
    expect(generateROPASummary([entry], now).needingReview).toBe(0);
    expect(generateROPASummary([{ ...entry, nextReview: new Date("2026-01-01T00:00:00Z") }], now).needingReview).toBe(1);
  });

  it("retention in days alone is enough; warnings are codes with translations", () => {
    const v = validateROPAEntry({ ...entry, lastReviewed: null, securityMeasures: null });
    expect(v.isValid).toBe(true);
    expect(v.warnings).toEqual(["securityMissing", "neverReviewed"]);
    const enW = (en as unknown as { pdf: { ropaRecord: { warnings: Record<string, string> } } }).pdf.ropaRecord.warnings;
    const esW = (es as unknown as { pdf: { ropaRecord: { warnings: Record<string, string> } } }).pdf.ropaRecord.warnings;
    expect(Object.keys(esW).sort()).toEqual(Object.keys(enW).sort());
    expect(esW.neverReviewed).toBe("Nunca se ha revisado");
  });

  it("file names: RAT in Spanish", () => {
    expect(fileTitle("ROPA", "es")).toBe("RAT-Registro-de-Actividades-de-Tratamiento");
    expect(fileTitle("ROPA-Processor", "es")).toBe("RAT-Encargado-Registro-de-Actividades-de-Tratamiento");
    expect(fileTitle("ROPA", "en")).toBe("ROPA");
  });
});
