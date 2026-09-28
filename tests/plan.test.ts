// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The 30/60/90-day plan over the privacy path: the day computation and the
 * plan states. Stage 1 shipped the plan pipeline; this guards its arithmetic
 * and the "on plan / behind / complete / remaining" decision, and the plan
 * over DPO Central's own windows.
 */

import { describe, expect, it } from "vitest";
import { planDay, planState } from "@/components/guided/plan";
import { DPO_CENTRAL_PATH, PLAN_WINDOWS, EMPTY_PATH_COUNTS } from "@/components/guided/path-config";
import { evaluatePath, type PathConfig, type PathStatuses } from "@/components/guided/path";

const utc = (s: string) => new Date(`${s}T12:00:00.000Z`);

describe("planDay", () => {
  it("is day 1 on the start day", () => {
    expect(planDay(utc("2026-01-01"), utc("2026-01-01"))).toBe(1);
  });
  it("counts whole calendar days in UTC", () => {
    expect(planDay(utc("2026-01-01"), utc("2026-01-02"))).toBe(2);
    expect(planDay(utc("2026-01-01"), utc("2026-01-31"))).toBe(31);
  });
  it("reads a future start as day 1", () => {
    expect(planDay(utc("2026-02-01"), utc("2026-01-01"))).toBe(1);
  });
});

describe("planState over the DPO Central windows", () => {
  const allDone: PathStatuses = Object.fromEntries(
    DPO_CENTRAL_PATH.stages.flatMap((s) =>
      s.steps.map((step) => [step.id, step.coming ? "coming" : "done"] as const),
    ),
  );
  const nothingDone = evaluatePath(DPO_CENTRAL_PATH, EMPTY_PATH_COUNTS);
  const config = DPO_CENTRAL_PATH as unknown as PathConfig<unknown>;

  it("is notStarted without a start date", () => {
    expect(planState(config, PLAN_WINDOWS, nothingDone, null, utc("2026-01-10")).kind).toBe(
      "notStarted",
    );
  });

  it("is complete when every planned stage is done, whatever the day", () => {
    const s = planState(config, PLAN_WINDOWS, allDone, utc("2026-01-01"), utc("2026-01-05"));
    expect(s.kind).toBe("complete");
  });

  it("is on plan early on (behindBy 0)", () => {
    const s = planState(config, PLAN_WINDOWS, nothingDone, utc("2026-01-01"), utc("2026-01-10"));
    expect(s.kind).toBe("running");
    if (s.kind === "running") expect(s.behindBy).toBe(0);
  });

  it("is behind once a window has passed with its stages still open", () => {
    // Day 45: the first window (day 30, stages setup + people) has passed and
    // nothing is done, so the plan is behind by 15 days.
    const s = planState(config, PLAN_WINDOWS, nothingDone, utc("2026-01-01"), utc("2026-02-14"));
    expect(s.kind).toBe("running");
    if (s.kind === "running") expect(s.behindBy).toBe(15);
  });

  it("shows the remaining stages past day 90", () => {
    const s = planState(config, PLAN_WINDOWS, nothingDone, utc("2026-01-01"), utc("2026-05-01"));
    expect(s.kind).toBe("remaining");
    if (s.kind === "remaining") expect(s.stageNumbers.length).toBeGreaterThan(0);
  });
});
