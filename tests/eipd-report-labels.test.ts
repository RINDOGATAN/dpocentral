// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The DPIA report's labels: an approved assessment is never stamped a draft,
 * yes/no answers print Yes/No (Sí/No), enum codes have labels in both
 * languages, every type has a legal reference key, and the Spanish file name
 * says EIPD.
 */

import { describe, it, expect } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { dpiaTemplateData } from "@/config/dpia-template-v2";
import { answerFormatter } from "@/server/services/assessment/template-locales";
import { exportConformance } from "@/server/services/export/assessment-conformance";
import { assessmentCompleteness } from "@/lib/assessment-completeness";
import { assessmentNameWithoutType, assessmentTypeShort } from "@/lib/assessment-file-name";
import { nameForFile } from "@/server/services/export/documents/context";
import { reportDate } from "@/server/services/export/documents/assessment";

const sections = dpiaTemplateData.sections as never;

describe("yes/no answers", () => {
  for (const [locale, yes] of [["en", "Yes"], ["es", "Sí"]] as const) {
    it(`print ${yes} and No, never true or false (${locale})`, () => {
      const fmt = answerFormatter("DPIA", sections, locale, { yes, no: "No" });
      expect(fmt("q5_1", true)).toBe(yes);
      expect(fmt("q5_1", false)).toBe("No");
      expect(fmt("q5_1", "true")).toBe(yes);
      expect(fmt("q5_1", "Yes")).toBe(yes);
      expect(fmt("q5_1", "No")).toBe("No");
    });
  }
});

describe("an approved assessment", () => {
  const t = ((key: string, v?: Record<string, unknown>) => `${key}${v ? JSON.stringify(v) : ""}`) as never;

  it("is never marked a draft; what the template gained later is listed under the approval", () => {
    const completeness = assessmentCompleteness({
      templateId: "system-dpia-template",
      visibleSections: [{ id: "s7", title: "Conclusion", questions: [{ id: "q7_4", text: "Review", required: true }] }],
      responses: [],
    });
    expect(completeness.complete).toBe(false);
    const approved = exportConformance({ completeness, sections: [], lang: "es", t, approvedOn: "18/10/2026" });
    expect(approved.draft).toBeUndefined();
    expect(approved.approved?.date).toBe("18/10/2026");
    expect(approved.approved?.laterRequirements.length).toBeGreaterThan(0);

    const draft = exportConformance({ completeness, sections: [], lang: "es", t });
    expect(draft.draft).toBeDefined();
    expect(draft.approved).toBeUndefined();
  });
});

describe("message keys the report uses", () => {
  for (const [name, bundle] of [["en", en], ["es", es]] as const) {
    const m = bundle as unknown as {
      enums: Record<string, Record<string, string>>;
      pdf: { assessmentReport: { articleRefs: Record<string, string>; assessmentTypes: Record<string, string> } };
    };
    it(`has a legal reference key for every type (${name})`, () => {
      for (const type of ["DPIA", "PIA", "TIA", "LIA", "VENDOR", "CUSTOM"]) {
        expect(m.pdf.assessmentReport.articleRefs[type], type).toBeTypeOf("string");
      }
    });
    it(`labels every status the report prints (${name})`, () => {
      for (const v of ["IDENTIFIED", "PLANNED", "IN_PROGRESS", "IMPLEMENTED", "VERIFIED", "NOT_REQUIRED"]) {
        expect(m.enums.mitigationStatus[v], v).toBeTruthy();
      }
      for (const v of ["OPEN", "CLOSED"]) expect(m.enums.assessmentRiskStatus[v], v).toBeTruthy();
      for (const v of ["APPROVED", "PENDING_REVIEW", "IN_PROGRESS"]) expect(m.enums.assessmentStatus[v]).toBeTruthy();
      for (const v of ["LOW", "MEDIUM", "HIGH", "CRITICAL"]) expect(m.enums.riskLevel[v]).toBeTruthy();
    });
  }

  it("calls the DPIA EIPD in Spanish and the LIA the legitimate interest assessment", () => {
    const a = (es as unknown as { pdf: { assessmentReport: { assessmentTypes: Record<string, string> } } }).pdf.assessmentReport.assessmentTypes;
    expect(a.DPIA).toBe("Evaluación de Impacto relativa a la Protección de Datos");
    expect(a.LIA).toBe("Evaluación del interés legítimo");
    expect(JSON.stringify(es)).not.toMatch(/\(DPIA\)/);
  });
});

describe("file names and dates", () => {
  it("names the type once, EIPD in Spanish, and keeps accents as plain letters", () => {
    const name = "EIPD: Programa de fidelización";
    expect(assessmentTypeShort("DPIA", "es")).toBe("EIPD");
    expect(assessmentTypeShort("LIA", "es")).toBe("EIL");
    expect(nameForFile(assessmentNameWithoutType(name))).toBe("Programa-de-fidelizacion");
    expect(assessmentNameWithoutType("DPIA — KYC checks")).toBe("KYC checks");
    expect(assessmentNameWithoutType("Customer analytics")).toBe("Customer analytics");
  });

  it("prints Spanish dates as dd/mm/yyyy", () => {
    expect(reportDate(new Date("2026-10-19T08:00:00Z"), "es")).toBe("19/10/2026");
    expect(reportDate(new Date("2026-10-19T08:00:00Z"), "en")).toBe("2026-10-19");
    expect(reportDate(null, "es")).toBe("");
  });
});
