// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The auto-fill refuses rather than guesses.
 *
 * Its answers are keyed to the standard DPIA template's question ids. Where
 * that template is absent it used to take the first DPIA template on the list,
 * which wrote answers against questions that template never asks.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { autoFillTemplate } from "@/lib/auto-fill-template";
import { DPIA_TEMPLATE_ID, dpiaTemplateSections } from "@/config/dpia-template-v2";
import { HEALTH_ADTECH_TEMPLATE_ID } from "@/config/health-adtech-template";
import {
  AUTO_FILL_TARGETS,
  LEGAL_BASIS_OPTIONS,
  SENSITIVITY_SPECIAL_CATEGORY,
} from "@/config/dpia-auto-fill-targets";

const standard = { id: DPIA_TEMPLATE_ID, name: "DPIA" };
const global = { id: HEALTH_ADTECH_TEMPLATE_ID, name: "Health data in advertising" };

type Question = { id: string; type?: string; options?: string[] };
const sections = dpiaTemplateSections as unknown as Array<{ id: string; questions: Question[] }>;
const questions = new Map<string, Question>();
const sectionOf = new Map<string, string>();
for (const section of sections) {
  for (const question of section.questions) {
    questions.set(question.id, question);
    sectionOf.set(question.id, section.id);
  }
}

describe("the template the auto-fill writes against", () => {
  it("is the standard DPIA, wherever it sits in the list", () => {
    expect(autoFillTemplate([global, standard])).toBe(standard);
    expect(autoFillTemplate([standard, global])).toBe(standard);
  });

  it("is nothing at all when the standard DPIA is absent", () => {
    expect(autoFillTemplate([global])).toBeNull();
    expect(autoFillTemplate([])).toBeNull();
    expect(autoFillTemplate(undefined)).toBeNull();
  });

  it("matters: the global template asks its own questions", () => {
    const standardIds = new Set(questions.keys());
    for (const id of ["hd1_1", "hd8_2"]) {
      expect(standardIds.has(id), id).toBe(false);
    }
  });
});

/**
 * Every auto-filled answer must land on a question the template asks. An
 * answer saved under an id no question carries is invisible in the app,
 * counts for nothing in the completeness figure and prints nowhere, while the
 * wizard reports that it wrote the answer.
 */
describe("where an auto-filled answer is written", () => {
  for (const [name, target] of Object.entries(AUTO_FILL_TARGETS)) {
    it(`${name} names a question the standard DPIA asks`, () => {
      const question = questions.get(target.questionId);
      expect(question, target.questionId).toBeDefined();
      expect(sectionOf.get(target.questionId)).toBe(target.sectionId);
    });
  }

  it("offers the legal basis as an option that question actually has", () => {
    const options = questions.get(AUTO_FILL_TARGETS.legalBasis.questionId)?.options ?? [];
    for (const option of Object.values(LEGAL_BASIS_OPTIONS)) {
      expect(options, option).toContain(option);
    }
  });

  it("records the sensitivity as an option that question actually has", () => {
    const options = questions.get(AUTO_FILL_TARGETS.sensitivity.questionId)?.options ?? [];
    expect(options).toContain(SENSITIVITY_SPECIAL_CATEGORY);
  });

  it("writes prose only where the question takes prose", () => {
    for (const key of ["purpose", "dataCategories", "recipients", "retention", "transfers", "minimisation", "risks"] as const) {
      const question = questions.get(AUTO_FILL_TARGETS[key].questionId);
      expect(question?.type, key).toBe("textarea");
    }
  });

  it("is the rule the wizard applies, with no fallback left", () => {
    const page = readFileSync(
      path.resolve(__dirname, "..", "src/app/(dashboard)/privacy/assessments/auto-fill/page.tsx"),
      "utf8"
    );
    expect(page).toContain("autoFillTemplate(templates)");
    expect(page).not.toContain("?? templates[0]");
    expect(page).toContain("missingTemplateTitle");
  });
});
