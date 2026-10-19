// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The one on-time measure for rights requests (src/lib/dsar-on-time.ts), and
 * the reports that print it: an open request past its deadline is never on
 * time, and with nothing to measure the reports print "N/A" ("N/D"), never
 * 100 %.
 */

import { describe, it, expect } from "vitest";
import { createTranslator } from "next-intl";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { dsarOnTime } from "@/lib/dsar-on-time";
import { DSARPerformanceReport, type DSARPerformanceData } from "@/server/services/export/dsar-performance-report";
import { RegulatoryLandscapeReport, type RegulatoryLandscapeData } from "@/server/services/export/regulatory-landscape-report";
import { computeHeroStats, type ProgramInput, type PdfT } from "@/server/services/export/privacy-program/data-mapping";
import { withPdfLocale } from "@/server/services/export/pdf-locale";
import { collectText } from "./pdf-text";

const NOW = new Date("2026-10-19T12:00:00Z");
const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

// The retail demo's shape: one completed on time, three open and months overdue, one rejected.
const ROWS = [
  { status: "COMPLETED", dueDate: d("2026-03-01"), completedAt: d("2026-02-20") },
  { status: "IN_PROGRESS", dueDate: d("2026-02-15"), completedAt: null },
  { status: "SUBMITTED", dueDate: d("2026-02-15"), completedAt: null },
  { status: "VERIFIED", dueDate: d("2026-02-15"), completedAt: null },
  { status: "REJECTED", dueDate: d("2026-02-15"), completedAt: null },
];

describe("the shared on-time measure", () => {
  it("counts open overdue requests against the rate", () => {
    expect(dsarOnTime(ROWS, NOW)).toEqual({
      completedOnTime: 1,
      completedLate: 0,
      openOverdue: 3,
      openInTime: 0,
      closedOther: 1,
      measured: 4,
      rate: 25,
    });
  });

  it("uses the extended deadline where there is one", () => {
    const r = dsarOnTime(
      [
        { status: "COMPLETED", dueDate: d("2026-08-30"), extendedDueDate: d("2026-10-30"), completedAt: d("2026-09-20") },
        { status: "IN_PROGRESS", dueDate: d("2026-09-01"), extendedDueDate: d("2026-11-01"), completedAt: null },
      ],
      NOW,
    );
    expect(r).toMatchObject({ completedOnTime: 1, openOverdue: 0, openInTime: 1, rate: 100 });
  });

  it("has no rate when nothing can be measured", () => {
    expect(dsarOnTime([], NOW).rate).toBeNull();
    expect(dsarOnTime([{ status: "SUBMITTED", dueDate: d("2026-11-30"), completedAt: null }], NOW).rate).toBeNull();
  });
});

const tr = (bundle: typeof en, locale: string, ns: string) =>
  createTranslator({ locale, messages: bundle, namespace: ns as never }) as unknown as PdfT;

function dsarData(onTimeRate: number | null, status: string): DSARPerformanceData {
  return {
    organization: { name: "Org" },
    generatedAt: "19 de octubre de 2026",
    primaryJurisdiction: null,
    primaryDeadlineDays: 30,
    primaryDeadlineMonths: 1,
    stats: { total: 0, completed: 0, overdue: 3, open: 3, onTimeRate, avgResolutionDays: 0, completedLast30Days: 0, redacted: 0 },
    byType: [],
    byStatus: [],
    jurisdictionSLA: [{ name: "RGPD", deadlineDays: 30, deadlineMonths: 1, status }],
    monthlyTrend: [{ month: "nov 2025", received: 1, completed: 0 }],
    aging: [
      { band: "0-7", count: 0 },
      { band: "30+", count: 3 },
    ],
  };
}

describe("the rights-request performance report", () => {
  it("prints N/D with nothing to measure, and 'No se cumple' when a request is overdue", () => {
    const esBundle = es as unknown as typeof en;
    const text = withPdfLocale("es", () =>
      collectText(DSARPerformanceReport({ data: dsarData(null, "Not met"), t: tr(esBundle, "es", "pdf.dsarPerformance"), locale: "es" })).join("\n"),
    );
    expect(text).toContain("N/D");
    expect(text).not.toContain("100 %");
    expect(text).toContain("No se cumple");
    expect(text).toContain("Más de 30 días");
    expect(text).not.toMatch(/\d+\+? days/);
  });

  it("prints the rate in English with no space before the sign", () => {
    const text = collectText(
      DSARPerformanceReport({ data: dsarData(25, "Not met"), t: tr(en, "en", "pdf.dsarPerformance"), locale: "en" }),
    ).join("\n");
    expect(text).toContain("25%");
    expect(text).toContain("Not met");
    expect(text).toContain("More than 30 days");
  });
});

describe("the programme report and the regulatory landscape read the same measure", () => {
  it("programme: completed on time over the measured requests", () => {
    const m = dsarOnTime(ROWS, NOW);
    const input = {
      assets: [],
      activities: [],
      vendors: [],
      aiSystems: [],
      counts: { openDsars: 3, overdueDsars: m.openOverdue, completedDsarsOnTime: m.completedOnTime, completedDsarsTotal: m.measured, openIncidents: 0, activeAssessments: 0 },
    } as ProgramInput;
    expect(computeHeroStats(input).dsarOnTimePct).toBe(25);
  });

  it("regulatory landscape: N/D and 'No se cumple'", () => {
    const data: RegulatoryLandscapeData = {
      organization: { name: "Org" },
      generatedAt: "19 de octubre de 2026",
      jurisdictions: [
        {
          code: "GDPR",
          name: "RGPD",
          region: "EU",
          regionLabel: "UE",
          country: "EU",
          dsarDeadlineDays: 30,
          dsarDeadlineMonths: 1,
          breachNotificationHours: 72,
          keyRequirements: [],
          penalties: "x",
          category: "comprehensive",
          isPrimary: true,
        },
      ],
      complianceScore: 50,
      moduleStats: {
        assets: 0, activities: 0, dsarTotal: 4, dsarOverdue: 3, dsarAvgDays: 0, incidentTotal: 0, incidentOpen: 0,
        incidentCritical: 0, assessmentTotal: 0, assessmentApproved: 0, vendorTotal: 0, vendorHighRisk: 0, transferTotal: 1,
      },
      transfersByCountry: [{ country: "US", count: 1, mechanisms: ["STANDARD_CONTRACTUAL_CLAUSES"], hasAdequacy: false, partialAdequacy: true }],
      vendorsByCountry: [],
      dsarOnTimeRate: null,
      dsarStatus: "notMet",
      breachNotificationCompliance: 100,
    };
    const esBundle = es as unknown as typeof en;
    const text = withPdfLocale("es", () =>
      collectText(RegulatoryLandscapeReport({ data, t: tr(esBundle, "es", "pdf.regulatoryLandscape"), locale: "es" })).join("\n"),
    );
    expect(text).toContain("N/D");
    expect(text).toContain("No se cumple");
    expect(text).toContain("72 horas");
    expect(text).not.toContain("3 días");
    expect(text).toContain("Estados Unidos");
    expect(text).toContain("Cláusulas contractuales tipo");
    expect(text).toContain("Parcial (solo destinatarios certificados");
    expect(text).not.toContain("European Union");
    expect(text).toContain("todavía no hay nada que medir");
  });
});
