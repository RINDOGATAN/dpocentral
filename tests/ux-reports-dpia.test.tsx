// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Reports and the DPIA page, after the usability review of 12 October 2026:
 *
 * - Reports holds the Overview's "Documents you can produce today" list and
 *   says how many drafted records are left out of the score; no "Great job!".
 * - The DPIA's outstanding list opens folded while nothing is answered, so the
 *   first question is on the first screen.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { CompletenessPanel } from "@/components/assessments/completeness-panel";
import type { Completeness } from "@/lib/assessment-completeness";

const read = (p: string) => readFileSync(path.resolve(__dirname, "..", p), "utf8");

const COMPLETENESS: Completeness = {
  outstandingQuestions: Array.from({ length: 30 }, (_, i) => ({
    questionId: `q${i}`,
    sectionId: "s1",
    sectionTitle: "Scope",
    text: `Question ${i}`,
  })),
  coverage: null,
  summary: [],
  frameworks: [],
  outstandingRequirements: [],
  californiaTrigger: "unknown" as Completeness["californiaTrigger"],
  complete: false,
};

function render(locale: "en" | "es", nothingAnswered: boolean) {
  return renderToStaticMarkup(
    createElement(
      NextIntlClientProvider,
      { locale, messages: locale === "en" ? en : es },
      createElement(CompletenessPanel, { completeness: COMPLETENESS, onJump: () => {}, nothingAnswered })
    )
  );
}

describe("U9: the outstanding list opens folded while nothing is answered", () => {
  it("shows one line and a Show button, not the thirty questions", () => {
    const html = render("en", true);
    expect(html).toContain("30 questions outstanding");
    expect(html).toContain("Show");
    expect(html).not.toContain("Question 29");
  });

  it("reads in Spanish too", () => {
    expect(render("es", true)).toContain("30 preguntas pendientes");
  });

  it("lists every question once something is answered", () => {
    expect(render("en", false)).toContain("Question 29");
  });

  it("words both counts", () => {
    expect(en.pages.assessmentDetail.completeness.collapsedBoth).toContain("requirements");
  });
});

describe("U2: Reports", () => {
  it("never says Great job", () => {
    expect(en.pages.reports.risk.noneTitle).not.toMatch(/great job/i);
    expect(es.pages.reports.risk.noneTitle).not.toMatch(/buen trabajo/i);
  });

  it("holds the documents list and the drafts line", () => {
    const page = read("src/app/(dashboard)/privacy/reports/page.tsx");
    expect(page).toContain("<DocumentsPanel");
    expect(page).toContain("reports-drafts-excluded");
  });
});
