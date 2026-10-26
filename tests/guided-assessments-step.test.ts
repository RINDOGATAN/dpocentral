// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The assessments step of the guided path. Any approved assessment finishes
 * it (an approved transfer impact assessment included, the one prepared for
 * the service's own transfer too), unless the organisation's applicability
 * answers make a DPIA required ("dpiaLikely" in state "applies"): then only
 * an approved DPIA does. While it is not done, the step says what is missing.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { DPO_CENTRAL_PATH, EMPTY_PATH_COUNTS, assessmentsStatus, type PathCounts } from "@/components/guided/path-config";
import { evaluatePath } from "@/components/guided/path";
import { stepFinishText } from "@/components/guided/step-finish";
import { loadPathCounts } from "@/server/services/program/path-counts";
import { TODOLAW_SOURCE_REF } from "@/server/services/todolaw-processor";

const step = (over: Partial<PathCounts>) => assessmentsStatus({ ...EMPTY_PATH_COUNTS, ...over });
const read = (p: string) => readFileSync(path.resolve(__dirname, "..", p), "utf8");

describe("the assessments step rule", () => {
  it("is done with an approved transfer impact assessment when no DPIA is required", () => {
    // A TIA is not a risk assessment (DPIA or PIA), so the risk counts stay at zero.
    const tiaApproved = { assessmentsAny: 1, assessmentsAnyApproved: 1 };
    expect(step(tiaApproved)).toBe("done");
    expect(step({ ...tiaApproved, dpiaDuty: "check" })).toBe("done");
    expect(step({ ...tiaApproved, dpiaDuty: null })).toBe("done");
    expect(evaluatePath(DPO_CENTRAL_PATH, { ...EMPTY_PATH_COUNTS, ...tiaApproved }).assessments).toBe("done");
  });

  it("is not done until a DPIA is approved where the answers make a DPIA required", () => {
    const required = { dpiaDuty: "applies" as const, assessmentsAny: 2, assessmentsAnyApproved: 1, dpiaApproved: 0 };
    expect(step(required)).toBe("started");
    expect(step({ ...required, assessments: 1, assessmentsApproved: 0 })).toBe("started");
    expect(step({ ...required, dpiaApproved: 1 })).toBe("done");
    expect(step({ dpiaDuty: "applies" })).toBe("todo");
  });

  it("is not done while nothing is approved", () => {
    expect(step({})).toBe("todo");
    expect(step({ assessmentsAny: 3, assessmentsAnyApproved: 0 })).toBe("started");
    expect(step({ assessments: 1, assessmentsApproved: 0 })).toBe("started");
  });

  it("still reads the risk counts where the newer counts are absent", () => {
    expect(step({ assessments: 1, assessmentsApproved: 1 })).toBe("done");
  });
});

describe("what the step says while it is not done", () => {
  const t = (bundle: typeof en) => (key: string) => {
    const [group, id] = key.split(".");
    return (bundle.guided as unknown as Record<string, Record<string, string>>)[group][id];
  };

  it("names the approval it waits for, in both languages", () => {
    expect(stepFinishText(t(en), "assessments", null)).toBe("Approve one assessment of any type, a transfer assessment included.");
    expect(stepFinishText(t(es), "assessments", null)).toBe("Aprueba una evaluación de cualquier tipo, también una de transferencia.");
    expect(stepFinishText(t(en), "assessments", "applies")).toBe("Approve one DPIA: your answers require one. Nothing else counts.");
    expect(stepFinishText(t(es), "assessments", "applies")).toBe("Aprueba una EIPD: tus respuestas la exigen. Ninguna otra cuenta.");
    expect(en.guided.menuNote).toEqual({ assessments: "Approve one assessment", assessmentsDpia: "Needs an approved DPIA" });
    expect(es.guided.menuNote).toEqual({ assessments: "Aprueba una evaluación", assessmentsDpia: "Necesita una EIPD aprobada" });
  });

  it("says in the band which answers make the DPIA required, with the way to them", () => {
    const band = read("src/components/guided/step-band.tsx");
    expect(band).toContain('dpiaDuty === "applies" && dpiaReasons.length > 0');
    expect(band).toContain("ta(`reasons.${r}`)");
    expect(read("src/components/privacy/applicability-check.tsx")).toContain('id="applicability"');
    expect(read("src/components/guided/guided-layout.tsx")).toContain('"menuNote.assessmentsDpia" : "menuNote.assessments"');
    expect(read("src/server/routers/privacy/programPath.ts")).toContain("dpiaReasons: counts.dpiaReasons ?? []");
  });
});

describe("the counts behind the step", () => {
  type Where = Record<string, unknown>;
  const isSystemAssessment = (w: Where) =>
    JSON.stringify(w.metadata ?? null) === JSON.stringify({ path: ["source"], equals: TODOLAW_SOURCE_REF });

  /** An organisation holding only the service's own transfer assessment, approved or waiting. */
  function fakeDb(approved: boolean, settings: Record<string, unknown> = {}) {
    const count = (model: string) => async ({ where }: { where: Where }) => {
      if (model !== "assessment") return 0;
      if (isSystemAssessment(where)) return approved ? 0 : 1; // waiting for approval
      if (where.template) return 0; // not a DPIA, PIA, LIA or vendor review
      if (where.status === "APPROVED") return approved ? 1 : 0;
      if (where.status === "DRAFT") return 0; // no untouched automatic draft
      return 1;
    };
    const model = (name: string) => ({
      count: count(name),
      findMany: async () => (name === "organizationJurisdiction" ? [{ jurisdiction: { code: "GDPR" } }] : []),
      findFirst: async () => (name === "organization" ? { settings } : null),
    });
    return new Proxy({}, { get: (_t, name: string) => model(name) }) as never;
  }

  it("leaves the service's transfer assessment out while it waits, and counts it once approved", async () => {
    const waiting = await loadPathCounts(fakeDb(false), "org");
    expect(waiting.assessmentsAny).toBe(0);
    expect(waiting.assessmentsAnyApproved).toBe(0);
    expect(evaluatePath(DPO_CENTRAL_PATH, waiting).assessments).toBe("todo");

    const approved = await loadPathCounts(fakeDb(true), "org");
    expect(approved.assessmentsAnyApproved).toBe(1);
    expect(approved.assessmentsApproved).toBe(0);
    expect(evaluatePath(DPO_CENTRAL_PATH, approved).assessments).toBe("done");
  });

  it("does not count the approved transfer assessment where the answers make a DPIA required", async () => {
    // Large-scale monitoring of a public area is an Art. 35(3)(c) case on its own.
    const settings = { applicability: { largeScaleMonitoring: "YES" } };
    const counts = await loadPathCounts(fakeDb(true, settings), "org");
    expect(counts.dpiaDuty).toBe("applies");
    expect(counts.dpiaReasons).toContain("largeScaleMonitoring");
    expect(evaluatePath(DPO_CENTRAL_PATH, counts).assessments).toBe("started");
  });
});
