// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The applicability questions by jurisdiction (src/config/applicability.ts,
 * version 2026.10.1): which questions are asked for which declared laws, the
 * GDPR Art. 3 grounds, the nine WP248 DPIA criteria, and that an organisation
 * that answered the first version's questions keeps exactly the same result.
 */

import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import {
  APPLICABILITY_QUESTIONS,
  DPIA_NEW_QUESTIONS,
  EMPTY_APPLICABILITY_ANSWERS,
  EU_TERRITORY_QUESTIONS,
  LEGACY_QUESTIONS,
  UK_TERRITORY_QUESTIONS,
  applicabilityQuestionsFor,
  evaluateApplicability,
  readApplicabilityAnswers,
  readAskedQuestions,
  type ApplicabilityAnswers,
  type ApplicabilityItemId,
} from "@/config/applicability";

const answers = (over: Partial<ApplicabilityAnswers> = {}): ApplicabilityAnswers => ({
  ...EMPTY_APPLICABILITY_ANSWERS,
  ...over,
});
const byId = (items: ReturnType<typeof evaluateApplicability>, id: ApplicabilityItemId) =>
  items.find((i) => i.id === id);
const sectionIds = (codes: string[]) => applicabilityQuestionsFor(codes).map((s) => s.id);
const asked = (codes: string[]) => applicabilityQuestionsFor(codes).flatMap((s) => s.questions);

describe("questions follow the declared laws", () => {
  it("with nothing declared, the first version's questions as before", () => {
    expect(sectionIds([])).toEqual(["role", "general"]);
    expect([...asked([])].sort()).toEqual([...LEGACY_QUESTIONS].sort());
  });

  it("the EU asks Art. 3 and the DPIA indicators, never the US size threshold", () => {
    expect(sectionIds(["GDPR"])).toEqual(["role", "eu", "risk"]);
    const qs = asked(["GDPR"]);
    for (const q of EU_TERRITORY_QUESTIONS) expect(qs).toContain(q);
    for (const q of DPIA_NEW_QUESTIONS) expect(qs).toContain(q);
    expect(qs).not.toContain("largeVolume");
    expect(qs).not.toContain("establishedUk");
  });

  it("Spain alone (LOPDGDD) is asked as the EU", () => {
    expect(sectionIds(["LOPDGDD"])).toEqual(["role", "eu", "risk"]);
  });

  it("the UK asks its own Art. 3 questions", () => {
    expect(sectionIds(["UK-GDPR"])).toEqual(["role", "uk", "risk"]);
  });

  it("the US asks only the size threshold, sensitive data and minors", () => {
    expect(sectionIds(["CCPA"])).toEqual(["role", "us"]);
    expect(asked(["VCDPA"])).toEqual(["actAsController", "actAsProcessor", "largeVolume", "sensitiveData", "children"]);
  });

  it("EU and US together: shared questions once", () => {
    const qs = asked(["GDPR", "CCPA"]);
    expect(qs.filter((q) => q === "sensitiveData")).toHaveLength(1);
    expect(qs.filter((q) => q === "children")).toHaveLength(1);
    expect(qs).toContain("largeVolume");
  });
});

describe("existing organisations keep their result", () => {
  // Answers stored before 2026.10: only the legacy keys are present.
  const legacy = { actAsController: "YES", actAsProcessor: "NO", largeVolume: "NO", sensitiveData: "YES", children: "NO", largeScaleMonitoring: "NO", publicAuthority: "NO", version: "2026.09.1" };

  it("reads the new questions as not asked yet", () => {
    expect(readAskedQuestions(legacy)).toEqual([...LEGACY_QUESTIONS]);
    expect(readAskedQuestions({ ...legacy, largeScale: "UNSURE" })).toContain("largeScale");
  });

  it("produces the same items as the first version would (Spain: GDPR + LOPDGDD)", () => {
    const items = evaluateApplicability(["GDPR", "LOPDGDD"], readApplicabilityAnswers(legacy), readAskedQuestions(legacy));
    expect(items.map((i) => [i.id, i.state])).toEqual([
      ["gdpr", "applies"],
      ["dpoRequired", "check"],
      ["dpiaLikely", "check"],
    ]);
    expect(byId(items, "gdpr")!.reasons).toEqual(["operatesEu", "controller"]);
    expect(byId(items, "dpiaLikely")!.reasons).toEqual(["sensitiveData", "twoCriteria"]);
  });

  it("an all-no legacy organisation gets no new 'check' from unasked questions", () => {
    const allNo = Object.fromEntries(LEGACY_QUESTIONS.map((q) => [q, "NO"]));
    const items = evaluateApplicability(["GDPR"], readApplicabilityAnswers({ ...allNo, actAsController: "YES" }), readAskedQuestions({ ...allNo, actAsController: "YES" }));
    expect(byId(items, "dpiaLikely")).toBeUndefined();
    expect(byId(items, "dpoRequired")).toBeUndefined();
  });
});

describe("GDPR Art. 3", () => {
  it("names the ground answered yes", () => {
    const items = evaluateApplicability(["GDPR"], answers({ actAsController: "YES", targetsEu: "YES" }));
    expect(byId(items, "gdpr")).toMatchObject({ state: "applies", reasons: ["targetsEu", "controller"] });
  });

  it("three clear noes make it worth checking, never applies", () => {
    const items = evaluateApplicability(
      ["GDPR"],
      answers({ actAsController: "YES", establishedEu: "NO", targetsEu: "NO", monitorsEu: "NO" }),
    );
    expect(byId(items, "gdpr")).toMatchObject({ state: "check", reasons: ["territoryNotMetEu", "controller"] });
  });

  it("not sure leaves the declared place as the reason", () => {
    const items = evaluateApplicability(["GDPR"], answers({ actAsController: "YES" }));
    expect(byId(items, "gdpr")).toMatchObject({ state: "applies", reasons: ["operatesEu", "controller"] });
  });

  it("the UK follows its own answers", () => {
    const items = evaluateApplicability(["UK-GDPR"], answers({ actAsProcessor: "YES", establishedUk: "YES" }));
    expect(byId(items, "ukGdpr")).toMatchObject({ state: "applies", reasons: ["establishedUk", "processor"] });
  });

  it("audience size never decides GDPR scope", () => {
    const yes = evaluateApplicability(["GDPR"], answers({ actAsController: "YES", largeVolume: "YES" }));
    const no = evaluateApplicability(["GDPR"], answers({ actAsController: "YES", largeVolume: "NO" }));
    expect(byId(yes, "gdpr")).toEqual(byId(no, "gdpr"));
  });
});

describe("the nine WP248 criteria", () => {
  const base = { actAsController: "YES" as const };
  const allNo = Object.fromEntries(
    ["largeScaleMonitoring", "sensitiveData", "children", ...DPIA_NEW_QUESTIONS].map((q) => [q, "NO"]),
  ) as Partial<ApplicabilityAnswers>;

  it("two criteria apply", () => {
    const items = evaluateApplicability(["GDPR"], answers({ ...base, ...allNo, scoring: "YES", largeScale: "YES" }));
    expect(byId(items, "dpiaLikely")).toMatchObject({ state: "applies", reasons: ["scoring", "largeScale"] });
  });

  it("one criterion is worth checking", () => {
    const items = evaluateApplicability(["GDPR"], answers({ ...base, ...allNo, innovativeTech: "YES" }));
    expect(byId(items, "dpiaLikely")).toMatchObject({ state: "check", reasons: ["innovativeTech", "twoCriteria"] });
  });

  it("criteria 4 and 7 count once whichever question is a yes", () => {
    const four = evaluateApplicability(["GDPR"], answers({ ...base, ...allNo, sensitiveData: "YES", criminalData: "YES" }));
    expect(byId(four, "dpiaLikely")!.state).toBe("check");
    const seven = evaluateApplicability(["GDPR"], answers({ ...base, ...allNo, children: "YES", vulnerableSubjects: "YES" }));
    expect(byId(seven, "dpiaLikely")!.state).toBe("check");
  });

  it("large-scale systematic monitoring applies on its own (Art. 35(3)(c))", () => {
    const items = evaluateApplicability(["GDPR"], answers({ ...base, ...allNo, largeScaleMonitoring: "YES" }));
    expect(byId(items, "dpiaLikely")!.state).toBe("applies");
  });

  it("all no: no DPIA item; any not sure: a check", () => {
    expect(byId(evaluateApplicability(["GDPR"], answers({ ...base, ...allNo })), "dpiaLikely")).toBeUndefined();
    expect(byId(evaluateApplicability(["GDPR"], answers({ ...base, ...allNo, blocksRights: "UNSURE" })), "dpiaLikely")).toMatchObject({ state: "check", reasons: ["answerUnsure"] });
  });

  it("criminal data makes a DPO worth checking (Art. 37(1)(c))", () => {
    const items = evaluateApplicability(["GDPR"], answers({ ...base, ...allNo, publicAuthority: "NO", criminalData: "YES" }));
    expect(byId(items, "dpoRequired")).toMatchObject({ state: "check", reasons: ["criminalData", "thresholds"] });
  });
});

describe("texts in both languages", () => {
  const reasons = [
    "establishedEu", "targetsEu", "monitorsEu", "territoryNotMetEu", "establishedUk", "targetsUk",
    "monitorsUk", "territoryNotMetUk", "criminalData", "vulnerableSubjects", "largeScale", "scoring",
    "automatedDecisions", "combiningDatasets", "innovativeTech", "blocksRights",
  ];
  for (const [name, bundle] of [["en", en], ["es", es]] as const) {
    const a = (bundle as unknown as { applicability: Record<string, Record<string, unknown>> }).applicability;
    it(`${name}: every question, section and reason, with no long dashes`, () => {
      for (const q of [...APPLICABILITY_QUESTIONS, ...UK_TERRITORY_QUESTIONS]) {
        const entry = (a.questions as Record<string, { label?: string; hint?: string }>)[q];
        expect(entry?.label, q).toBeTruthy();
        expect(entry?.hint, q).toBeTruthy();
      }
      for (const s of ["role", "eu", "uk", "risk", "us", "general"]) expect(a.sections[s], s).toBeTruthy();
      for (const r of reasons) expect(a.reasons[r], r).toBeTruthy();
      expect(JSON.stringify(a)).not.toMatch(/[–—]/);
    });
  }

  it("the US size question says it does not decide the GDPR", () => {
    const lv = (en as unknown as { applicability: { questions: { largeVolume: { label: string; hint: string } } } }).applicability.questions.largeVolume;
    expect(lv.label).toMatch(/US state laws/);
    expect(lv.hint).toMatch(/does not decide/);
  });
});
