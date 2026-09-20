// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * One completion figure.
 *
 * A template whose questions appear only when an earlier answer calls for
 * them has two possible counts: every question it holds, or the questions the
 * answers actually show. The assessment page and the single export use the
 * second; the portfolio export used the first, so the same assessment was
 * reported at two different percentages. Both read the same module now.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { assessmentProgress } from "@/server/services/assessment/progress";
import { dpiaTemplateData, dpiaTemplateSections } from "@/config/dpia-template-v2";
import { CA_OPTION, FRAMEWORK_QUESTION_ID } from "@/config/assessment-frameworks";

const template = { type: "DPIA", sections: dpiaTemplateData.sections };

/** Every question the template holds, hidden ones included. */
const allQuestions = (dpiaTemplateSections as unknown as Array<{ questions?: unknown[] }>).reduce(
  (sum, s) => sum + (s.questions?.length ?? 0),
  0
);

describe("the completion figure", () => {
  const responses = [{ questionId: FRAMEWORK_QUESTION_ID, response: JSON.stringify([CA_OPTION]) }];

  it("counts the questions the answers show, not every question the template holds", () => {
    const { totalQuestions } = assessmentProgress(template, responses);
    expect(totalQuestions).toBeGreaterThan(0);
    expect(totalQuestions).toBeLessThan(allQuestions);
  });

  it("would report a different percentage on the naive count", () => {
    const { completionPercentage } = assessmentProgress(template, responses);
    const naive = Math.round((responses.length / allQuestions) * 100);
    expect(completionPercentage).not.toBe(naive);
  });

  it("is the calculation both exports use", () => {
    const source = (rel: string) => readFileSync(path.resolve(__dirname, "..", rel), "utf8");
    for (const route of [
      "src/app/api/export/assessment/[id]/route.ts",
      "src/app/api/export/assessment-portfolio/route.ts",
    ]) {
      expect(source(route), route).toContain("assessmentProgress(");
    }
    expect(source("src/app/api/export/assessment-portfolio/route.ts")).not.toContain(
      "_count.responses"
    );
  });
});
