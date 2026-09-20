// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The export is never a dead end.
 *
 * An unfinished assessment still exports: the document renders, every page
 * carries the draft mark, the first page lists what is outstanding, and the
 * conformance table says which requirements are covered and which are not.
 * A finished one carries no draft mark and states conformance plainly.
 */

import { describe, it, expect } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import {
  AssessmentReport,
  type AssessmentExportData,
} from "@/server/services/export/assessment-report";
import { exportConformance } from "@/server/services/export/assessment-conformance";
import { assessmentCompleteness } from "@/lib/assessment-completeness";
import {
  CA_OPTION,
  CCPA_TRIGGERS,
  CCPA_TRIGGER_QUESTION_ID,
  EU_OPTION,
  FRAMEWORK_QUESTION_ID,
} from "@/config/assessment-frameworks";
import { DPIA_TEMPLATE_ID, dpiaTemplateData } from "@/config/dpia-template-v2";
import { sectionsForLocale } from "@/server/services/assessment/template-locales";
import { answerMapFrom, visibleSections } from "@/lib/assessment-conditions";
import { collectText, translator } from "./pdf-text";

type Response = { questionId: string; response: string };

const bundleFor = (lang: "en" | "es") =>
  ((lang === "es" ? es : en) as unknown as { pdf: { assessmentReport: Record<string, unknown> } }).pdf
    .assessmentReport;

function build(lang: "en" | "es", responses: Response[]) {
  const localized = sectionsForLocale("DPIA", dpiaTemplateData.sections, lang);
  const sections = visibleSections(localized, answerMapFrom(responses), [
    dpiaTemplateData.sections,
  ]) as unknown as AssessmentExportData["template"]["sections"];

  const completeness = assessmentCompleteness({
    templateId: DPIA_TEMPLATE_ID,
    visibleSections: sections,
    responses,
  });
  const t = translator(bundleFor(lang));
  const { draft, conformance } = exportConformance({ completeness, sections, lang, t });

  const data: AssessmentExportData = {
    id: "a-1",
    name: "Loyalty programme DPIA",
    description: null,
    status: "IN_PROGRESS",
    riskLevel: null,
    riskScore: null,
    startedAt: new Date("2026-09-19"),
    submittedAt: null,
    completedAt: null,
    dueDate: null,
    template: {
      type: "DPIA",
      name: dpiaTemplateData.name,
      version: dpiaTemplateData.version,
      sections,
    },
    processingActivity: null,
    vendor: null,
    responses: responses.map((r) => ({
      sectionId: sections.find((s) => s.questions.some((q) => q.id === r.questionId))?.id ?? "s1",
      questionId: r.questionId,
      response: r.response,
      riskScore: null,
      notes: null,
      responder: null,
      respondedAt: new Date("2026-09-19"),
    })),
    mitigations: [],
    approvals: [],
    organization: { name: "Default client" },
    completionPercentage: 0,
    totalQuestions: 0,
    draft,
    conformance,
  };

  const element = AssessmentReport({ data, t, locale: lang });
  return { data, completeness, sections, text: collectText(element).join("\n"), element };
}

/** Every visible question answered, so nothing is outstanding. */
function answerEverything(chosen: string[], extra: Response[] = []): Response[] {
  let responses: Response[] = [
    { questionId: FRAMEWORK_QUESTION_ID, response: JSON.stringify(chosen) },
    ...extra,
  ];
  // The visible set grows as answers arrive; two passes settle it.
  for (let pass = 0; pass < 3; pass++) {
    const sections = visibleSections(
      dpiaTemplateData.sections as never,
      answerMapFrom(responses)
    ) as unknown as Array<{ questions: Array<{ id: string; options?: string[] }> }>;
    const answered = new Set(responses.map((r) => r.questionId));
    for (const s of sections) {
      for (const q of s.questions) {
        if (answered.has(q.id)) continue;
        responses = [
          ...responses,
          { questionId: q.id, response: q.options ? q.options[0] : "Recorded for the assessment." },
        ];
      }
    }
  }
  return responses;
}

const FRAMEWORK_ONLY: Response[] = [
  { questionId: FRAMEWORK_QUESTION_ID, response: JSON.stringify([EU_OPTION, CA_OPTION]) },
];

describe("an unfinished assessment still exports", () => {
  for (const lang of ["en", "es"] as const) {
    const labels = bundleFor(lang) as Record<string, string>;

    it(`renders, and marks the document a draft (${lang})`, async () => {
      const { data, text, element } = build(lang, FRAMEWORK_ONLY);
      expect(data.draft).toBeDefined();
      expect(text).toContain(labels.draftMark);
      expect(text).toContain(labels.draftTitle);
      const buffer = await renderToBuffer(element);
      expect(buffer.length).toBeGreaterThan(1000);
    });

    it(`lists the outstanding items on the first page (${lang})`, () => {
      const { completeness, text } = build(lang, FRAMEWORK_ONLY);
      expect(completeness.outstandingQuestions.length).toBeGreaterThan(10);
      expect(text).toContain(labels.draftQuestions);
      expect(text).toContain(labels.draftRequirements);
      // The first outstanding requirement, by its primary citation.
      expect(text).toContain(lang === "es" ? "art. 35(7)(a)" : "Art. 35(7)(a)");
      expect(text).toContain("11 CCR 7150(b)");
    });

    it(`prints a conformance table that claims nothing (${lang})`, () => {
      const { text } = build(lang, FRAMEWORK_ONLY);
      expect(text).toContain(labels.conformanceTitle);
      expect(text).toContain(labels.conformanceOutstanding);
      expect(text).not.toContain(labels.conformanceCovered);
      expect(text).toContain(labels.conformanceDisclaimer);
    });
  }
});

describe("a finished assessment", () => {
  it("carries no draft mark and reports both frameworks covered", async () => {
    const responses = answerEverything([EU_OPTION, CA_OPTION]);
    const { data, completeness, text, element } = build("en", responses);
    expect(completeness.complete).toBe(true);
    expect(data.draft).toBeUndefined();
    const labels = bundleFor("en") as Record<string, string>;
    expect(text).not.toContain(labels.draftTitle);
    expect(text).toContain(labels.conformanceCovered);
    expect(text).not.toContain(labels.conformanceOutstanding);
    expect(text).toContain("European Union: every requirement covered (8 of 8).");
    expect(text).toContain("California: every requirement covered (12 of 12).");
    await expect(renderToBuffer(element)).resolves.toBeDefined();
  });

  it("says in that many words when one framework is finished and the other is not", () => {
    const responses = answerEverything([EU_OPTION, CA_OPTION]).filter(
      (r) => r.questionId !== "q8_4"
    );
    const { text } = build("en", responses);
    expect(text).toContain("European Union: every requirement covered (8 of 8).");
    expect(text).toContain(
      "California: 11 of 12 requirements covered. This assessment does not conform to the rules of California until the rest are answered."
    );
  });

  it("says plainly when no California trigger applies", () => {
    const responses = answerEverything([EU_OPTION, CA_OPTION]).map((r) =>
      r.questionId === CCPA_TRIGGER_QUESTION_ID
        ? { ...r, response: JSON.stringify([CCPA_TRIGGERS.en[6]]) }
        : r
    );
    const { data, text } = build("en", responses);
    expect(data.conformance?.californiaNotRequired).toBe(true);
    expect(text).toContain(
      "No triggering activity applies, so 11 CCR 7150(b) does not require a California risk assessment"
    );
  });
});

describe("only the frameworks chosen are reported on", () => {
  it("prints the European rows alone when California is not chosen", () => {
    const responses = answerEverything([EU_OPTION]);
    const { data } = build("en", responses);
    expect(data.conformance?.rows).toHaveLength(8);
    expect(data.conformance?.rows.every((r) => r.citation.startsWith("Art."))).toBe(true);
  });

  it("prints the Californian rows alone when the European framework is not chosen", () => {
    const responses = answerEverything([CA_OPTION]);
    const { data } = build("en", responses);
    expect(data.conformance?.rows).toHaveLength(12);
    expect(data.conformance?.rows.every((r) => r.citation.startsWith("11 CCR"))).toBe(true);
  });
});
