// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * A multi-select with every option unticked is no answer: the response is
 * removed, so the question counts as unanswered (it used to count as answered
 * once all its options were unticked).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { isEmptyAnswer } from "@/lib/assessment-answer";

const read = (rel: string) => readFileSync(path.resolve(__dirname, "..", rel), "utf8");

describe("isEmptyAnswer", () => {
  it("is true for an empty multi-select, as an array or as its JSON text", () => {
    expect(isEmptyAnswer([])).toBe(true);
    expect(isEmptyAnswer("[]")).toBe(true);
    expect(isEmptyAnswer(" [ ] ")).toBe(true);
  });

  it("is false for any real answer", () => {
    expect(isEmptyAnswer(["GDPR"])).toBe(false);
    expect(isEmptyAnswer('["GDPR"]')).toBe(false);
    expect(isEmptyAnswer("Yes")).toBe(false);
    expect(isEmptyAnswer("[draft] text")).toBe(false);
    expect(isEmptyAnswer(null)).toBe(false);
  });
});

describe("saving an empty multi-select", () => {
  it("removes the stored response on the server instead of saving it", () => {
    const router = read("src/server/routers/privacy/assessment.ts");
    expect(router).toContain("if (isEmptyAnswer(input.response)) {");
    expect(router).toContain("assessmentResponse.deleteMany({");
  });

  it("drops it from the screen's counts and marks", () => {
    const page = read("src/app/(dashboard)/privacy/assessments/[id]/page.tsx");
    expect(page).toContain("const emptyAnswer = isEmptyAnswer(value);");
    expect(page).toContain("const isAnswered = !!response && !isEmptyAnswer(response.response);");
  });
});
