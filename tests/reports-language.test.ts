// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The reports' language: one date helper for every PDF (dd/mm/yyyy or
 * "19 de octubre de 2026" in Spanish), the competent supervisory authority
 * rather than the EDPB, Spanish names in the regulatory catalogue, the
 * Spanish file names of the processor contract and the transfer impact
 * assessment, the settings the full data export carries, and the regulations
 * checklist in the reader's language.
 */

import { describe, it, expect } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { pdfDate, pdfNumber, withPdfLocale, pdfChrome } from "@/server/services/export/pdf-locale";
import { JURISDICTION_CATALOG, localizeJurisdiction } from "@/config/jurisdiction-catalog";
import { dpaFileTitle } from "@/server/services/export/documents/dpa";
import { exportedSettings } from "@/server/services/portability/organization-settings";

describe("one date helper for the reports", () => {
  it("writes Spanish dates as dd/mm/yyyy or in words, read in UTC", () => {
    const date = new Date("2026-10-19T00:00:00Z");
    expect(pdfDate(date, "short", "es")).toBe("19/10/2026");
    expect(pdfDate(date, "long", "es")).toBe("19 de octubre de 2026");
    expect(pdfDate("2025-11-01", "month", "es")).toMatch(/^nov\.? 2025$/);
    expect(pdfDate(date, "short", "en")).toBe("2026-10-19");
    expect(pdfDate(date, "long", "en")).toBe("19 October 2026");
    expect(pdfDate(null)).toBe("");
  });

  it("follows the report's language inside withPdfLocale", () => {
    const date = new Date("2026-02-15T00:00:00Z");
    expect(withPdfLocale("es", () => pdfDate(date))).toBe("15/02/2026");
    expect(withPdfLocale("en", () => pdfDate(date))).toBe("2026-02-15");
    expect(pdfNumber(15000, "es")).toBe("15.000");
    expect(pdfNumber(2500, "es")).toBe("2.500");
    expect(pdfNumber(15000, "en")).toBe("15,000");
  });

  it("gives the Spanish processor contract and assessment their footer in Spanish", () => {
    expect(withPdfLocale("es", () => pdfChrome().disclaimer)).toBe(es.footer.disclaimer);
  });
});

describe("the regulatory catalogue", () => {
  const gdpr = JURISDICTION_CATALOG.find((j) => j.code === "GDPR")!;

  it("names the national supervisory authority, not the EDPB, for the GDPR", () => {
    expect(gdpr.dpaName).not.toMatch(/European Data Protection Board/);
    expect(gdpr.dpaName).toContain("national supervisory authority");
    expect(gdpr.dpaName).toContain("AEPD");
    const esGdpr = localizeJurisdiction(gdpr, "es");
    expect(esGdpr.dpaName).toContain("Agencia Española de Protección de Datos (AEPD)");
    expect(esGdpr.dpaName).not.toMatch(/Comité Europeo/);
    expect(esGdpr.dpaUrl).toBe("https://www.aepd.es");
  });

  it("names the UK GDPR and the US authorities in Spanish", () => {
    const uk = localizeJurisdiction(JURISDICTION_CATALOG.find((j) => j.code === "UK-GDPR")!, "es");
    expect(uk.name).toBe("RGPD del Reino Unido (UK GDPR)");
    const ccpa = localizeJurisdiction(JURISDICTION_CATALOG.find((j) => j.code === "CCPA")!, "es");
    expect(ccpa.dpaName).toBe("Agencia de Protección de la Privacidad de California (CPPA) y fiscal general de California");
    expect(ccpa.penalties).toContain("2.663 USD");
    const va = localizeJurisdiction(JURISDICTION_CATALOG.find((j) => j.code === "VCDPA")!, "es");
    expect(va.dpaName).toBe("Fiscal general de Virginia");
    const nj = localizeJurisdiction(JURISDICTION_CATALOG.find((j) => j.code === "NJDPA")!, "es");
    expect(nj.dpaName).toBe("División de Asuntos del Consumidor de Nueva Jersey");
  });

  it("states the CCPA amounts as adjusted from January 2025", () => {
    const ccpa = JURISDICTION_CATALOG.find((j) => j.code === "CCPA")!;
    expect(ccpa.penalties).toContain("$2,663");
    expect(ccpa.penalties).toContain("$7,988");
  });
});

describe("file names of the processor contract and the transfer impact assessment", () => {
  it("are Spanish for a Spanish document", () => {
    expect(dpaFileTitle("dpa", "es")).toBe("Contrato-de-encargo");
    expect(dpaFileTitle("tia", "es")).toBe("EIT");
    expect(dpaFileTitle("dpa", "en")).toBe("DPA");
    expect(dpaFileTitle("tia", "en")).toBe("TIA");
  });
});

describe("the full data export", () => {
  it("carries only the listed settings: no invitations, no webhook", () => {
    expect(
      exportedSettings({
        programName: "P",
        quickstart: { completedAt: "x" },
        pendingInvites: [{ email: "a@example.test" }],
        slackWebhookUrl: "https://hooks.example.test/secret",
      }),
    ).toEqual({ programName: "P", quickstart: { completedAt: "x" } });
    expect(exportedSettings(null)).toEqual({});
  });
});

describe("the regulations checklist in the reader's language", () => {
  it("has every detail message in both languages", () => {
    const keys = Object.keys(en.pages.regulations.checklist).filter((k) => k.startsWith("detail"));
    expect(keys.length).toBeGreaterThanOrEqual(17);
    const esChecklist = es.pages.regulations.checklist as Record<string, string>;
    for (const k of keys) expect(esChecklist[k], k).toBeTruthy();
  });

  it("the router names a message for every detail it returns", async () => {
    const { readFileSync } = await import("fs");
    const src = readFileSync("src/server/routers/privacy/regulations.ts", "utf8");
    const used = [...src.matchAll(/detailKey: "(detail\w+)"/g)].map((m) => m[1]!);
    expect(used.length).toBeGreaterThan(10);
    const checklist = en.pages.regulations.checklist as Record<string, string>;
    for (const k of used) expect(checklist[k], k).toBeTruthy();
  });
});
