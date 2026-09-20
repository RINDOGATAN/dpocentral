// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Points on the assessment path where a user could once be left with nothing
 * to do next.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describeUnanswered } from "@/server/services/assessment/progress";
import { dpiaTemplateData } from "@/config/dpia-template-v2";

const source = (rel: string) => readFileSync(path.resolve(__dirname, "..", rel), "utf8");

describe("a refusal says what is missing", () => {
  const template = { type: "DPIA", sections: dpiaTemplateData.sections };

  it("names the questions rather than counting them", () => {
    const text = describeUnanswered(template, ["q1_1", "q3_2"]);
    expect(text).toContain("What categories of personal data will be processed?");
    expect(text).toContain("What alternatives were considered");
  });

  it("cuts a long list short with a count", () => {
    const text = describeUnanswered(template, ["q1_1", "q1_2", "q1_3", "q1_6", "q3_1"]);
    expect(text).toContain("and 2 more");
  });

  it("resolves a repeatable section's composite id", () => {
    expect(describeUnanswered(template, ["q1_1::r0"])).toContain("What categories");
  });

  it("is what the router sends", () => {
    const router = source("src/server/routers/privacy/assessment.ts");
    expect(router).toContain("describeUnanswered(assessment.template, unanswered)");
    expect(router).not.toContain("Please answer all required questions");
  });
});

describe("a rejected assessment can be worked on again", () => {
  it("is editable on the page, as the server already allows", () => {
    const page = source("src/app/(dashboard)/privacy/assessments/[id]/page.tsx");
    expect(page).toMatch(/canSubmit =[\s\S]{0,200}"REJECTED"/);

    // The server locks an approved assessment and nothing else.
    const router = source("src/server/routers/privacy/assessment.ts");
    expect(router).toContain("Cannot modify an approved assessment");
    expect(router).not.toContain("Cannot modify a rejected assessment");
  });
});
