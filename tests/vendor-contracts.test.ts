// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * When a processor contract is in force, and the coverage every report
 * prints from it (src/lib/vendor-contracts.ts): the vendor register, the
 * programme report and the executive report count the same vendors with the
 * same contracts, so they print the same figure.
 */

import { describe, it, expect } from "vitest";
import { createTranslator } from "next-intl";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import {
  displayedDpa,
  dpaCoverage,
  dpaDisplayStatus,
  dpaInForceWhere,
  dpaTone,
  hasDpaInForce,
  isContractInForce,
} from "@/lib/vendor-contracts";
import { VendorRegisterDocument } from "@/server/services/export/vendor-register/VendorRegisterDocument";
import { vendorsToCSV, type VendorCsvRow } from "@/server/services/export/vendor-register/csv";
import { computeCoverageBars, computeVendorStats, type ProgramInput, type PdfT } from "@/server/services/export/privacy-program/data-mapping";
import { withPdfLocale } from "@/server/services/export/pdf-locale";
import { collectText } from "./pdf-text";

const NOW = new Date("2026-10-19T12:00:00Z");
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("a processor contract in force", () => {
  it("is ACTIVE or RENEWED and not past its end date", () => {
    expect(isContractInForce({ status: "ACTIVE", endDate: null }, NOW)).toBe(true);
    expect(isContractInForce({ status: "RENEWED", endDate: day("2027-01-01") }, NOW)).toBe(true);
    expect(isContractInForce({ status: "ACTIVE", endDate: day("2026-06-01") }, NOW)).toBe(false);
    for (const status of ["DRAFT", "PENDING_SIGNATURE", "EXPIRED", "TERMINATED"]) {
      expect(isContractInForce({ status, endDate: null }, NOW), status).toBe(false);
    }
  });

  it("shows an ACTIVE contract past its end date as expired, in red", () => {
    const lapsed = { type: "DPA", status: "ACTIVE", endDate: day("2026-06-01") };
    expect(dpaDisplayStatus(lapsed, NOW)).toBe("EXPIRED");
    expect(dpaTone(lapsed, NOW)).toBe("danger");
    expect(dpaTone({ status: "EXPIRED" }, NOW)).toBe("danger");
    expect(dpaTone({ status: "PENDING_SIGNATURE" }, NOW)).toBe("warning");
    expect(dpaTone({ status: "ACTIVE" }, NOW)).toBe("success");
  });

  it("prefers the contract in force when a vendor holds several", () => {
    const contracts = [
      { type: "DPA", status: "EXPIRED", endDate: day("2025-12-31") },
      { type: "MSA", status: "ACTIVE", endDate: null },
      { type: "DPA", status: "ACTIVE", endDate: day("2027-12-31") },
    ];
    expect(displayedDpa(contracts, NOW)?.status).toBe("ACTIVE");
    expect(hasDpaInForce(contracts, NOW)).toBe(true);
    expect(hasDpaInForce([{ type: "MSA", status: "ACTIVE" }], NOW)).toBe(false);
  });

  it("filters the database the same way", () => {
    expect(dpaInForceWhere(NOW)).toEqual({
      type: "DPA",
      status: { in: ["ACTIVE", "RENEWED"] },
      OR: [{ endDate: null }, { endDate: { gte: NOW } }],
    });
  });

  it("counts confirmed vendors in use, drafts and vendors not in use left out", () => {
    const coverage = dpaCoverage(
      [
        { status: "ACTIVE", riskTier: "HIGH", contracts: [{ type: "DPA", status: "EXPIRED" }] },
        { status: "ACTIVE", contracts: [{ type: "DPA", status: "ACTIVE" }] },
        { status: "ACTIVE", isDraft: true, contracts: [] },
        { status: "PROSPECTIVE", contracts: [] },
      ],
      NOW,
    );
    expect(coverage).toEqual({ active: 2, withDpa: 1, withoutDpa: 1, highRiskWithoutDpa: 1 });
  });
});

function vendor(over: Partial<VendorCsvRow>): VendorCsvRow {
  return {
    id: "v",
    name: "Vendor",
    description: null,
    website: null,
    status: "ACTIVE",
    riskTier: "LOW",
    riskScore: null,
    primaryContact: null,
    contactEmail: null,
    categories: [],
    dataProcessed: [],
    countries: [],
    certifications: [],
    lastAssessedAt: null,
    nextReviewAt: null,
    contracts: [],
    ...over,
  };
}

const VENDORS: VendorCsvRow[] = [
  vendor({ id: "1", name: "Shopify", categories: ["E-commerce"], contracts: [{ name: "DPA", type: "DPA", status: "ACTIVE", startDate: day("2025-01-15"), endDate: day("2027-01-15") }] }),
  vendor({ id: "2", name: "Klaviyo", contracts: [{ name: "DPA", type: "DPA", status: "ACTIVE", startDate: null, endDate: day("2026-06-01") }] }),
  vendor({ id: "3", name: "Zendesk", contracts: [{ name: "DPA", type: "DPA", status: "EXPIRED", startDate: null, endDate: day("2025-12-31") }] }),
  vendor({ id: "4", name: "Draft Co", isDraft: true }),
];

const t = (bundle: typeof en, locale: string, namespace: string) =>
  createTranslator({ locale, messages: bundle, namespace: namespace as never }) as unknown as PdfT;

describe("the vendor register counts and colours contracts as in force or not", () => {
  it("prints the coverage over confirmed vendors in use, and an expired contract in red", () => {
    for (const [bundle, locale] of [[en, "en"], [es as unknown as typeof en, "es"]] as const) {
      const doc = withPdfLocale(locale, () =>
        VendorRegisterDocument({
          vendors: VENDORS,
          orgName: "Org",
          t: t(bundle, locale, "pdf.vendorRegister"),
          tCommon: t(bundle, locale, "pdf.common"),
          tEnum: t(bundle, locale, "pdf.enum"),
          locale,
          now: NOW,
        }),
      );
      const text = withPdfLocale(locale, () => collectText(doc).join("\n"));
      // Shopify only: Klaviyo's contract ended, Zendesk's expired, the draft is not counted.
      expect(text).toContain(locale === "es" ? "Contratos de encargo en vigor" : "DPA in force");
      expect(text).toMatch(locale === "es" ? /VENCIDO/ : /EXPIRED/);
      expect(text).toContain(locale === "es" ? "Sin categoría" : "Uncategorized");
      expect(text).toContain(locale === "es" ? "15/01/2025 a 15/01/2027" : "2025-01-15 to 2027-01-15");
    }
  });

  it("matches the programme report's figure for the same vendors", () => {
    const input = {
      assets: [],
      activities: [],
      aiSystems: [],
      counts: { openDsars: 0, overdueDsars: 0, completedDsarsOnTime: 0, completedDsarsTotal: 0, openIncidents: 0, activeAssessments: 0 },
      vendors: VENDORS.map((v) => ({
        id: v.id,
        name: v.name,
        status: v.status,
        riskTier: v.riskTier,
        categories: v.categories,
        countries: v.countries,
        certifications: v.certifications,
        hasDpa: hasDpaInForce(v.contracts, NOW),
        dpaStatus: null,
        isDraft: v.isDraft,
        nextReview: null,
      })),
    } as ProgramInput;
    const coverage = dpaCoverage(VENDORS, NOW);
    expect(coverage).toMatchObject({ active: 3, withDpa: 1 });
    expect(computeVendorStats(input)).toMatchObject({ counted: 3, withDpa: 1 });
    const bar = computeCoverageBars(input, (k: string) => k).at(-1)!;
    expect([bar.value, bar.total]).toEqual([1, 3]);
  });

  it("the CSV shows a lapsed contract as expired and guards against formulas", () => {
    const csv = vendorsToCSV(
      [VENDORS[1]!, vendor({ name: "=HYPERLINK(\"http://x\")", website: "+1 555", contracts: [] })],
      undefined,
      NOW,
    ).split("\n");
    expect(csv[1]).toMatch(/"EXPIRED"$/);
    expect(csv[2]).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(csv[2]).toContain(`"'+1 555"`);
  });
});
