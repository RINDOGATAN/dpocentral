// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Human-facing CSV registers (vendors, breaches): the English file is
 * unchanged (English column names, raw codes); a Spanish export has Spanish
 * column names and the screens' labels for every code. The record of
 * processing has its own table, with labels in both languages
 * (tests/ropa-record.test.ts).
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl/server", async () => {
  const { createTranslator: make } = await import("next-intl");
  const enM = (await import("@/messages/en.json")).default;
  const esM = (await import("@/messages/es.json")).default;
  return {
    getTranslations: async ({ locale, namespace }: { locale: string; namespace: string }) =>
      make({ locale, messages: locale === "es" ? esM : enM, namespace: namespace as never }),
  };
});

import en from "@/messages/en.json";
import { csvLabelsFor } from "@/server/services/export/csv-labels-i18n";
import { VENDOR_CSV_EN, VENDOR_CSV_KEYS, vendorsToCSV, type VendorCsvRow } from "@/server/services/export/vendor-register/csv";
import { BREACH_CSV_EN, BREACH_CSV_KEYS, incidentsToCSV, type IncidentExportData } from "@/server/services/export/breach-register";

const vendor: VendorCsvRow = {
  id: "v1",
  name: "Acme Mail",
  description: null,
  website: "https://mail.example",
  status: "ACTIVE",
  riskTier: "HIGH",
  riskScore: 70,
  primaryContact: null,
  contactEmail: null,
  categories: ["Email"],
  dataProcessed: ["IDENTIFIERS"],
  countries: ["US"],
  certifications: ["ISO 27001"],
  lastAssessedAt: null,
  nextReviewAt: null,
  contracts: [{ name: "DPA 2026", type: "DPA", status: "ACTIVE", startDate: null, endDate: null }],
};
const vendorNoDpa: VendorCsvRow = { ...vendor, name: "Beta", riskTier: null, contracts: [] };

const incident = {
  id: "i1",
  publicId: "INC-1",
  title: "Lost laptop",
  description: "A laptop was lost",
  type: "DATA_LOSS",
  severity: "HIGH",
  status: "CONTAINED",
  discoveredAt: new Date("2026-03-01T10:00:00Z"),
  discoveredBy: null,
  discoveryMethod: null,
  affectedRecords: 12,
  affectedSubjects: ["Customers"],
  dataCategories: ["HEALTH"],
  containedAt: null,
  containmentActions: null,
  rootCause: null,
  resolvedAt: null,
  resolutionNotes: null,
  lessonsLearned: null,
  notificationRequired: true,
  notificationDeadline: null,
  createdAt: new Date("2026-03-01T10:00:00Z"),
  notifications: [],
  timeline: [],
} as unknown as IncidentExportData;

const lines = (csv: string) => csv.split("\n");

describe("English CSV registers are unchanged", () => {
  it("English locale gives no labels, so the generators keep their own text", async () => {
    expect(await csvLabelsFor("vendors", VENDOR_CSV_KEYS, "en")).toBeUndefined();
  });

  it("the English catalogue matches the built-in English text", () => {
    const m = (en as unknown as { pdf: { csv: Record<string, Record<string, string>> } }).pdf.csv;
    expect(m.vendors).toEqual(VENDOR_CSV_EN.headers);
    expect(m.breaches).toEqual(BREACH_CSV_EN.headers);
    expect(m.words).toEqual(VENDOR_CSV_EN.words);
  });

  it("vendor register", () => {
    const out = lines(vendorsToCSV([vendor, vendorNoDpa]));
    expect(out[0]).toBe(
      "Name,Status,Risk Tier,Risk Score,Website,Primary Contact,Contact Email,Categories,Data Processed,Countries,Certifications,Last Assessed,Next Review,Contract Names,DPA Status",
    );
    expect(out[1]).toBe(
      '"Acme Mail","ACTIVE","HIGH","70","https://mail.example","","","Email","IDENTIFIERS","US","ISO 27001","","","DPA 2026","ACTIVE"',
    );
    expect(out[2]).toMatch(/"No DPA"$/);
  });

  it("breach register", () => {
    const out = lines(incidentsToCSV([incident]));
    expect(out[0]).toBe(
      "ID,Title,Type,Severity,Status,Description,Discovered At,Discovered By,Affected Records,Affected Subjects,Data Categories,Contained At,Root Cause,Resolved At,Notification Required,Notification Deadline",
    );
    expect(out[1]).toContain('"INC-1","Lost laptop","DATA_LOSS","HIGH","CONTAINED"');
    expect(out[1]).toContain('"Customers","HEALTH"');
    expect(out[1]).toContain('"Yes"');
  });
});

describe("Spanish CSV registers", () => {
  it("vendor register: Spanish columns and codes", async () => {
    const labels = await csvLabelsFor("vendors", VENDOR_CSV_KEYS, "es");
    const out = lines(vendorsToCSV([vendor, vendorNoDpa], labels));
    expect(out[0].split(",")).toEqual([
      "Nombre", "Estado", "Nivel de riesgo", "Puntuación de riesgo", "Sitio web", "Contacto principal",
      "Correo electrónico de contacto", "Categorías", "Datos tratados", "Países", "Certificaciones",
      "Última evaluación", "Próxima revisión", "Contratos", "Estado del contrato de encargo",
    ]);
    expect(out[1]).toContain('"Activo","Alto","70"');
    expect(out[1]).toContain('"Identificadores"');
    expect(out[1]).toMatch(/"Activo"$/);
    expect(out[2]).toMatch(/"Sin contrato de encargo"$/);
  });

  it("breach register: Spanish columns and codes", async () => {
    const labels = await csvLabelsFor("breaches", BREACH_CSV_KEYS, "es");
    const out = lines(incidentsToCSV([incident], labels));
    expect(out[0].startsWith("ID,Título,Tipo,Gravedad,Estado,Descripción")).toBe(true);
    expect(out[1]).toContain('"INC-1","Lost laptop","Pérdida de datos","Alta","Contenido"');
    expect(out[1]).toContain('"Datos de salud"');
    expect(out[1]).toContain('"Sí"');
  });

  it("no raw upper-case code is left in a Spanish file", async () => {
    const vend = vendorsToCSV([vendor], await csvLabelsFor("vendors", VENDOR_CSV_KEYS, "es"));
    const brea = incidentsToCSV([incident], await csvLabelsFor("breaches", BREACH_CSV_KEYS, "es"));
    for (const csv of [vend, brea]) expect(csv).not.toMatch(/\b[A-Z]{3,}_[A-Z_]+\b|"(CONTRACT|IDENTIFIERS|ACTIVE|HIGH|HEALTH)"/);
  });
});
