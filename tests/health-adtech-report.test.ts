/**
 * The assessment PDF renders the health-data advertising result in both
 * languages: the jurisdiction table, the five-factor band, the mitigation
 * choice and the signature block.
 *
 * Set WRITE_PDF_SAMPLES=<dir> to also write the rendered PDFs for review.
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import {
  AssessmentReport,
  type AssessmentExportData,
} from "@/server/services/export/assessment-report";
import { HealthAdtechPages } from "@/server/services/export/health-adtech-report";
import { computeHealthAdtechResult } from "@/lib/health-adtech/results";
import {
  HEALTH_ADTECH_SECTIONS,
  JURISDICTIONS,
  healthAdtechTemplateData,
} from "@/config/health-adtech-template";
import {
  answerFormatter,
  sectionsForLocale,
} from "@/server/services/assessment/template-locales";
import { visibleSections, answerMapFrom } from "@/lib/assessment-conditions";
import { collectText, translator } from "./pdf-text";


const option = (id: string, index: number, lang: "en" | "es" = "en") => {
  const q = HEALTH_ADTECH_SECTIONS.flatMap((s) => s.questions).find((x) => x.id === id)!;
  return q.options![lang][index];
};

const responses = [
  { questionId: "hd1_1", response: JSON.stringify([JURISDICTIONS[0].en, JURISDICTIONS[2].en, JURISDICTIONS[3].en]) },
  { questionId: "hd2_1", response: "Retargeting visitors of the pharmacy's allergy pages." },
  ...["hd6_1", "hd6_2", "hd6_3", "hd6_4", "hd6_5"].map((id) => ({ questionId: id, response: option(id, 2) })),
  { questionId: "hd7_1", response: option("hd7_1", 1) },
  { questionId: "hd8_1", response: "No" },
  { questionId: "hd8_3", response: "No" },
  { questionId: "hd8_5", response: "Yes" },
  { questionId: "hd9_1", response: option("hd9_1", 2) },
  { questionId: "hd9_2", response: option("hd9_2", 2) },
  { questionId: "hd10_1", response: "Chief Executive Officer" },
  { questionId: "hd10_2", response: "2026-09-17" },
  { questionId: "hd10_3", response: "2027-09-17" },
];

function reportData(lang: "en" | "es"): AssessmentExportData {
  const pdfLabels = ((lang === "es" ? es : en) as any).pdf.assessmentReport;
  const format = answerFormatter("DPIA", healthAdtechTemplateData.sections, lang, {
    yes: pdfLabels.yes,
    no: pdfLabels.no,
  });
  const sections = visibleSections(
    sectionsForLocale("DPIA", healthAdtechTemplateData.sections, lang),
    answerMapFrom(responses),
    [healthAdtechTemplateData.sections]
  ) as AssessmentExportData["template"]["sections"];
  return {
    id: "a-1",
    name: "Health data DPIA",
    description: null,
    status: "IN_PROGRESS",
    riskLevel: "HIGH",
    riskScore: 63,
    startedAt: new Date("2026-09-17"),
    submittedAt: null,
    completedAt: null,
    dueDate: null,
    template: { type: "DPIA", name: "Health data", version: "1.0", sections },
    processingActivity: null,
    vendor: null,
    responses: responses.map((r) => ({
      sectionId: `hd${r.questionId.slice(2).split("_")[0]}`,
      questionId: r.questionId,
      response: format(r.questionId, r.response),
      riskScore: null,
      notes: null,
      responder: null,
      respondedAt: new Date("2026-09-17"),
    })),
    mitigations: [],
    approvals: [],
    organization: { name: "Default client" },
    completionPercentage: 40,
    totalQuestions: 40,
  };
}

describe("health-data advertising report", () => {
  const result = computeHealthAdtechResult(responses);

  for (const [lang, bundle] of [["en", en], ["es", es]] as const) {
    const t = translator((bundle as Record<string, Record<string, unknown>>).healthAdtechReport);

    it(`prints the jurisdiction table, band, mitigation and signature (${lang})`, () => {
      const text = collectText(
        HealthAdtechPages({ result, lang, t, title: "Health data DPIA", orgName: "Org", date: "2026-09-17" })
      ).join("\n");
      const labels = (bundle as any).healthAdtechReport;
      for (const key of ["title", "jurisdiction", "consentModel", "obligations", "findings", "fiveFactorTitle", "decisionTitle", "signatureTitle", "signer"]) {
        expect(text, key).toContain(labels[key]);
      }
      for (const j of result.jurisdictions) expect(text).toContain(j.name[lang]);
      expect(text).toContain(result.fiveFactor.bandLabel![lang]);
      expect(text).toContain(result.mitigation![lang]);
      expect(text).toContain("Chief Executive Officer");
      expect(text).toContain("RCW 19.373.030");
      expect(text).toContain("11 CCR 7157(b)(5), 7157(c)");
      expect(text).toContain(lang === "es" ? "Fuente primaria (comprobada el 16 de septiembre de 2026)" : "Primary source (checked 16 September 2026)");
      expect(text).toContain(lang === "es" ? "art. 36" : "Art. 36");
    });

    it(`renders the whole assessment PDF (${lang})`, async () => {
      const buffer = await renderToBuffer(
        AssessmentReport({
          data: reportData(lang),
          t: translator((bundle as any).pdf.assessmentReport),
          locale: lang,
          healthAdtech: { result, t },
        })
      );
      expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
      expect(buffer.length).toBeGreaterThan(10_000);
      const dir = process.env.WRITE_PDF_SAMPLES;
      if (dir) {
        mkdirSync(dir, { recursive: true });
        writeFileSync(path.join(dir, `health-adtech-${lang}.pdf`), buffer);
      }
    }, 30_000);
  }

  it("prints saved answers in the report's language", () => {
    const stored = healthAdtechTemplateData.sections;
    const toEs = answerFormatter("DPIA", stored, "es", { yes: "Sí", no: "No" });
    const toEn = answerFormatter("DPIA", stored, "en", { yes: "Yes", no: "No" });
    expect(toEs("hd1_1", responses[0].response)).toBe(
      "UE/EEE (RGPD); California (CCPA/CPRA); Washington (My Health My Data Act)"
    );
    expect(toEs("hd9_1", "High")).toBe("Alto");
    expect(toEs("hd8_5", "Yes")).toBe("Sí");
    expect(toEs("hd2_1", "Free text")).toBe("Free text");
    // Saved in Spanish, printed in English.
    expect(toEn("hd9_1", "Muy alto")).toBe("Very high");
    // Other templates keep working: unknown questions print as saved.
    expect(toEs("q1_1", "[\"a\"]")).toBe("[\"a\"]");
  });

  it("changes the printed table when the jurisdictions change", () => {
    const t = translator((en as any).healthAdtechReport);
    const other = computeHealthAdtechResult([
      { questionId: "hd1_1", response: JSON.stringify([JURISDICTIONS[5].en]) },
      ...responses.slice(1),
    ]);
    const a = collectText(HealthAdtechPages({ result, lang: "en", t, title: "x", orgName: "o", date: "d" })).join("\n");
    const b = collectText(HealthAdtechPages({ result: other, lang: "en", t, title: "x", orgName: "o", date: "d" })).join("\n");
    expect(a).toContain("Washington");
    expect(b).not.toContain("Washington");
    expect(b).toContain("Maryland (MODPA)");
    expect(a).toContain("RCW 19.373.080");
    expect(b).not.toContain("RCW 19.373.080");
    expect(b).toContain("selling sensitive data is prohibited (Com. Law 14-4607(a)(2))");
  });

  it("prints the mark next to an item that is still unsourced", () => {
    const t = translator((en as any).healthAdtechReport);
    const ct = computeHealthAdtechResult([
      { questionId: "hd1_1", response: JSON.stringify([JURISDICTIONS[6].en]) },
      ...responses.slice(1),
    ]);
    const text = collectText(HealthAdtechPages({ result: ct, lang: "en", t, title: "x", orgName: "o", date: "d" })).join("\n");
    expect(text).toContain("Offer the right to opt out (including targeted advertising and sale) [to verify]");
  });
});

/**
 * The banner over a blocking finding says only what the product does. Nothing
 * stops a submission, an approval or an export because of a finding, so the
 * sentence must not claim the processing cannot go ahead. What does happen,
 * the risk escalation, is still there and is still stated.
 */
describe("the blocking banner", () => {
  const blocking = computeHealthAdtechResult([
    // Washington: a sale of consumer health data without a signed authorisation.
    { questionId: "hd1_1", response: JSON.stringify([JURISDICTIONS[3].en]) },
    { questionId: "hd8_2", response: "No" },
  ]);

  it("is raised by a finding the answers produce", () => {
    expect(blocking.blocking).toBe(true);
  });

  it("raises the risk level to at least High", () => {
    expect(blocking.riskLevel).toBe("HIGH");
  });

  for (const [lang, bundle] of [["en", en], ["es", es]] as const) {
    it(`does not claim the processing is stopped (${lang})`, () => {
      const text = (bundle as any).healthAdtechReport.blockingSummary as string;
      for (const claim of [
        "before the processing can go ahead",
        "antes de que el tratamiento pueda seguir adelante",
      ]) {
        expect(text).not.toContain(claim);
      }
      expect(text.length).toBeGreaterThan(40);
    });
  }
});
