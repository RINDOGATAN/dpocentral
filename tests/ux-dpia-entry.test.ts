// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The DPIA after the usability review of 12 October 2026:
 *
 * - U3: the auto-fill wizard is reachable from New Assessment and from each
 *   processing activity, and respects the pilot's free DPIAs (it says so up
 *   front and stops at the first step; the server refuses a third DPIA at
 *   creation, since the wizard creates through assessment.create).
 * - U5: a new DPIA starts with its frameworks chosen from the declared
 *   jurisdictions, as an ordinary answer the person can change.
 */

import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  CA_OPTION,
  EU_OPTION,
  FRAMEWORK_QUESTION_ID,
  frameworkAnswerFor,
  frameworksForJurisdictions,
  selectedFrameworks,
} from "@/config/assessment-frameworks";
import { frameworkSectionId, preselectDpiaFrameworks } from "@/server/services/assessment/framework-preselect";

const read = (p: string) => readFileSync(path.resolve(__dirname, "..", p), "utf8");

describe("U3: the auto-fill wizard can be reached", () => {
  it("is linked from New Assessment for a DPIA", () => {
    const page = read("src/app/(dashboard)/privacy/assessments/new/page.tsx");
    expect(page).toContain('href="/privacy/assessments/auto-fill"');
    expect(page).toMatch(/selectedType === "DPIA" && \(/);
    expect(page).not.toContain("dpiaQuota");
    // Offered before the template step, not only on the final form.
    expect(page.indexOf('data-testid="dpia-auto-fill-link"')).toBeLessThan(page.indexOf("Step 2: Template picker"));
  });

  it("is linked from each activity's page with the activity chosen, for writers", () => {
    const page = read("src/app/(dashboard)/privacy/data-inventory/activities/[id]/page.tsx");
    expect(page).toContain("/privacy/assessments/auto-fill?activity=");
    expect(page).toContain("canWrite &&");
  });

  it("needs only an activity to go on: DPIAs are not capped", () => {
    const page = read("src/app/(dashboard)/privacy/assessments/auto-fill/page.tsx");
    expect(page).not.toContain("DpiaFreeNote");
    expect(page).toContain("disabled={!selectedActivityId}");
    // It creates through assessment.create, which applies no DPIA count.
    expect(page).toContain("trpc.assessment.create.useMutation()");
    const router = read("src/server/routers/privacy/assessment.ts");
    expect(router).not.toContain("assertPilotDpiaQuota");
  });
});

describe("U5: frameworks from the declared jurisdictions", () => {
  it("California only gives the California risk assessment", () => {
    expect(frameworksForJurisdictions(["CCPA"])).toEqual(["US_CCPA"]);
  });
  it("the EU gives Article 35", () => {
    expect(frameworksForJurisdictions(["GDPR", "UK-GDPR"])).toEqual(["EU_GDPR"]);
  });
  it("both give both", () => {
    expect(frameworksForJurisdictions(["CCPA", "GDPR", "VCDPA"])).toEqual(["EU_GDPR", "US_CCPA"]);
  });
  it("nothing relevant leaves the question to the person", () => {
    expect(frameworksForJurisdictions(["LGPD"])).toBeNull();
    expect(frameworksForJurisdictions([])).toBeNull();
  });
  it("stores an answer the completeness check reads back", () => {
    const answer = frameworkAnswerFor(["US_CCPA"]);
    expect(JSON.parse(answer)).toEqual([CA_OPTION]);
    expect(selectedFrameworks({ [FRAMEWORK_QUESTION_ID]: answer })).toEqual(["US_CCPA"]);
    expect(JSON.parse(frameworkAnswerFor(["EU_GDPR", "US_CCPA"]))).toEqual([EU_OPTION, CA_OPTION]);
  });

  it("writes the first question's answer with a note, in the reader's language", async () => {
    const create = vi.fn();
    const prisma = {
      organizationJurisdiction: { findMany: vi.fn().mockResolvedValue([{ jurisdiction: { code: "CCPA" } }]) },
      assessmentResponse: { create },
    };
    const sections = [{ id: "s0", questions: [{ id: FRAMEWORK_QUESTION_ID }] }];
    const done = await preselectDpiaFrameworks(prisma as never, {
      organizationId: "org",
      assessmentId: "a1",
      sections,
      userId: "u1",
      locale: "es",
    });
    expect(done).toBe(true);
    const data = create.mock.calls[0][0].data;
    expect(data).toMatchObject({ assessmentId: "a1", questionId: FRAMEWORK_QUESTION_ID, sectionId: "s0" });
    expect(data.notes).toMatch(/^Preseleccionado/);
  });

  it("the preselected answer alone leaves the outstanding list folded", () => {
    const page = read("src/app/(dashboard)/privacy/assessments/[id]/page.tsx");
    expect(page).toMatch(/nothingAnswered=\{\(assessment\?\.responses \?\? \[\]\)\.every\(/);
    expect(page).toContain("r.questionId === FRAMEWORK_QUESTION_ID");
  });

  it("does nothing for a template without the question", async () => {
    expect(frameworkSectionId([{ id: "s1", questions: [{ id: "x" }] }])).toBeNull();
  });
});
