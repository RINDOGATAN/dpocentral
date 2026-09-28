// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The applicability check's mapping: posture answers plus declared
 * jurisdictions turned into "applies" and "worth checking". Guards the
 * doctrine that an unanswered question never produces "applies", and that a
 * law turning on a threshold these questions do not settle is only ever a
 * check.
 */

import { describe, expect, it } from "vitest";
import {
  APPLICABILITY_QUESTIONS,
  EMPTY_APPLICABILITY_ANSWERS,
  evaluateApplicability,
  readApplicabilityAnswers,
  hasAnyApplicabilityAnswer,
  type ApplicabilityAnswers,
  type ApplicabilityItemId,
} from "@/config/applicability";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

const answers = (over: Partial<ApplicabilityAnswers> = {}): ApplicabilityAnswers => ({
  ...EMPTY_APPLICABILITY_ANSWERS,
  ...over,
});

const ids = (items: { id: ApplicabilityItemId }[]) => items.map((i) => i.id);
const byId = (items: { id: ApplicabilityItemId; state: string }[], id: ApplicabilityItemId) =>
  items.find((i) => i.id === id);

describe("evaluateApplicability", () => {
  it("lists nothing when no jurisdiction is declared", () => {
    // The role-only duties still need a GDPR/UK jurisdiction to attach to.
    expect(evaluateApplicability([], answers({ actAsController: "YES" }))).toEqual([]);
  });

  it("applies GDPR to an EU controller", () => {
    const items = evaluateApplicability(["GDPR"], answers({ actAsController: "YES" }));
    expect(byId(items, "gdpr")?.state).toBe("applies");
  });

  it("applies UK GDPR when UK is declared", () => {
    const items = evaluateApplicability(["UK-GDPR"], answers({ actAsProcessor: "YES" }));
    expect(byId(items, "ukGdpr")?.state).toBe("applies");
  });

  it("checks the role when it is unsure", () => {
    const items = evaluateApplicability(["GDPR"], answers());
    expect(byId(items, "gdpr")?.state).toBe("check");
  });

  it("does not list GDPR when the org is neither controller nor processor", () => {
    const items = evaluateApplicability(
      ["GDPR"],
      answers({ actAsController: "NO", actAsProcessor: "NO" }),
    );
    expect(ids(items)).not.toContain("gdpr");
  });

  it("raises processor duties for a processor", () => {
    const items = evaluateApplicability(["GDPR"], answers({ actAsProcessor: "YES" }));
    expect(byId(items, "processorDuties")?.state).toBe("applies");
  });

  it("requires a DPO for a public authority or large-scale monitoring", () => {
    expect(
      byId(evaluateApplicability(["GDPR"], answers({ actAsController: "YES", publicAuthority: "YES" })), "dpoRequired")
        ?.state,
    ).toBe("applies");
    expect(
      byId(
        evaluateApplicability(["GDPR"], answers({ actAsController: "YES", largeScaleMonitoring: "YES" })),
        "dpoRequired",
      )?.state,
    ).toBe("applies");
  });

  it("only checks a DPO for special category data (large scale is not settled here)", () => {
    const items = evaluateApplicability(
      ["GDPR"],
      answers({ actAsController: "YES", sensitiveData: "YES", publicAuthority: "NO", largeScaleMonitoring: "NO" }),
    );
    expect(byId(items, "dpoRequired")?.state).toBe("check");
  });

  it("marks a DPIA likely for monitoring, special category or children", () => {
    for (const q of ["largeScaleMonitoring", "sensitiveData", "children"] as const) {
      const items = evaluateApplicability(["GDPR"], answers({ actAsController: "YES", [q]: "YES" }));
      expect(byId(items, "dpiaLikely")?.state, q).toBe("applies");
    }
  });

  it("only checks the CCPA (its thresholds decide), never applies on unsure", () => {
    const unsure = evaluateApplicability(["CCPA"], answers({ largeVolume: "UNSURE" }));
    expect(byId(unsure, "ccpa")?.state).toBe("check");
    const meets = evaluateApplicability(["CCPA"], answers({ largeVolume: "YES" }));
    expect(byId(meets, "ccpa")?.state).toBe("applies");
    const below = evaluateApplicability(["CCPA"], answers({ largeVolume: "NO" }));
    expect(ids(below)).not.toContain("ccpa");
  });

  it("only ever checks the other US state laws", () => {
    const items = evaluateApplicability(["VCDPA"], answers({ actAsController: "YES" }));
    expect(byId(items, "usStates")?.state).toBe("check");
  });

  it("never turns 'not sure yet' into 'applies'", () => {
    const items = evaluateApplicability(["GDPR", "UK-GDPR", "CCPA", "VCDPA"], answers());
    expect(items.every((i) => i.state === "check")).toBe(true);
  });
});

describe("readApplicabilityAnswers", () => {
  it("fills unknown or missing values with 'not sure yet'", () => {
    expect(readApplicabilityAnswers(null)).toEqual(EMPTY_APPLICABILITY_ANSWERS);
    expect(readApplicabilityAnswers({ actAsController: "YES", bogus: "x" }).actAsController).toBe("YES");
    expect(readApplicabilityAnswers({ actAsController: "MAYBE" }).actAsController).toBe("UNSURE");
  });

  it("hasAnyApplicabilityAnswer is false only when everything is unsure", () => {
    expect(hasAnyApplicabilityAnswer(EMPTY_APPLICABILITY_ANSWERS)).toBe(false);
    expect(hasAnyApplicabilityAnswer(answers({ children: "NO" }))).toBe(true);
  });
});

describe("the applicability i18n is complete in both locales", () => {
  const items: ApplicabilityItemId[] = [
    "gdpr", "ukGdpr", "processorDuties", "dpoRequired", "dpiaLikely", "ccpa", "usStates",
  ];
  const reasons = [
    "operatesEu", "operatesUk", "operatesCalifornia", "operatesUsStates", "controller",
    "processor", "roleUnsure", "publicAuthority", "largeScaleMonitoring", "sensitiveData",
    "children", "largeVolume", "thresholds", "answerUnsure",
  ];
  for (const [name, bundle] of [["en", en], ["es", es]] as const) {
    const a = (bundle as unknown as { applicability: Record<string, Record<string, unknown>> }).applicability;
    it(`${name} carries every question, item, reason and answer`, () => {
      for (const q of APPLICABILITY_QUESTIONS) {
        expect((a.questions as Record<string, { label?: string }>)[q]?.label, `questions.${q}.label`).toBeTruthy();
      }
      for (const id of items) expect(a.items[id], `items.${id}`).toBeTruthy();
      for (const r of reasons) expect(a.reasons[r], `reasons.${r}`).toBeTruthy();
      for (const ans of ["YES", "NO", "UNSURE"]) expect(a.answer[ans], `answer.${ans}`).toBeTruthy();
    });
  }
});
