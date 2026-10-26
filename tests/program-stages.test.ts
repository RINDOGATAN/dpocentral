// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The programme figure counts the stages of the path the menu shows ("3 of 5
 * stages done"); the line under it says the stage the organisation is in, never
 * a day of a timetable. The assessments step needs an approved DPIA only where
 * the organisation's own answers say a DPIA applies.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { DPO_CENTRAL_PATH, EMPTY_PATH_COUNTS, type PathCounts } from "@/components/guided/path-config";
import { currentPhase, evaluatePath, programFigure } from "@/components/guided/path";
import { stepFinishText } from "@/components/guided/step-finish";

const read = (p: string) => readFileSync(path.resolve(__dirname, "..", p), "utf8");
const statuses = (over: Partial<PathCounts>) => evaluatePath(DPO_CENTRAL_PATH, { ...EMPTY_PATH_COUNTS, ...over });

/** The demo bank of 24 Oct 2026: set up, data known, breaches ready; assessments, transfers and rights open. */
const BANK: Partial<PathCounts> = {
  quickstartCompleted: true,
  jurisdictions: 2,
  dataAssets: 4,
  dataAssetsComplete: 4,
  processingActivities: 3,
  processingActivitiesComplete: 3,
  vendors: 5,
  vendorsComplete: 5,
  assessments: 2,
  transfers: 2,
};

describe("the programme figure in stages", () => {
  it("counts the five stages with a page, a stage done when every counted step is met", () => {
    const figure = programFigure(DPO_CENTRAL_PATH, statuses(BANK));
    expect(figure.total).toBe(5);
    // Set up, Know your data, and Respond (the breach register, ready when needed).
    expect(figure.confirmed).toBe(3);
    // Assess the risk is in progress; Rights and transparency not started.
    expect(figure.started).toBe(1);
    expect(figure.notStarted).toBe(1);
    expect(figure.confirmed + figure.toConfirm + figure.started + figure.notStarted).toBe(figure.total);
  });

  it("is zero for a new organisation and five when every stage is done", () => {
    expect(programFigure(DPO_CENTRAL_PATH, statuses({})).confirmed).toBe(0);
    const all = statuses({
      ...BANK,
      assessmentsApproved: 1,
      transfersComplete: 1,
      dsarIntakeConfigured: true,
      dsarIntakeActive: true,
    });
    expect(programFigure(DPO_CENTRAL_PATH, all)).toMatchObject({ confirmed: 5, total: 5 });
    expect(currentPhase(DPO_CENTRAL_PATH, all)).toBeNull();
  });
});

describe("the line under the figure", () => {
  it("names the stage holding the next step, numbered as in the menu", () => {
    const phase = currentPhase(DPO_CENTRAL_PATH, statuses(BANK))!;
    expect(phase.stage.id).toBe("assess");
    expect(phase.number).toBe(3);
    expect(phase.total).toBe(5);
    expect(es.guided.phase.now.replace("{number}", "3").replace("{stage}", es.guided.stages.assess)).toBe(
      "Ahora: fase 3, Evalúa el riesgo",
    );
    expect(es.guided.phase.complete).toBe("Programa completo");
    expect(en.guided.phase.complete).toBe("Program complete");
  });

  it("replaces the day plan everywhere: no plan module, no plan words, no plan dates", () => {
    const layout = read("src/components/guided/guided-layout.tsx");
    expect(layout).toContain("currentPhase(menuProps.config, menuProps.statuses)");
    expect(layout).not.toMatch(/planDayText|usePlanState/);
    for (const file of [
      "src/components/guided/guided-dashboard.tsx",
      "src/components/guided/next-step-card.tsx",
      "src/app/(dashboard)/privacy/clients/page.tsx",
      "src/lib/board-report.ts",
      "src/server/services/program/board-report.ts",
      "src/server/routers/privacy/programPath.ts",
      "src/server/routers/privacy/clients.ts",
    ]) {
      expect(read(file), file).not.toMatch(/PLAN_WINDOWS|planState|planMilestone|planStart|plan-text/);
    }
    for (const bundle of [en, es]) {
      expect((bundle.guided as Record<string, unknown>).plan).toBeUndefined();
      expect((bundle.guided.deadlines as Record<string, unknown>).plan).toBeUndefined();
      expect((bundle.boardReport.actions as Record<string, unknown>).plan).toBeUndefined();
      expect(bundle.boardReport.actions.ownerNote).not.toMatch(/30|60|90/);
    }
  });
});

describe("the assessments step and the DPIA", () => {
  it("an approved assessment finishes it when the answers do not require a DPIA", () => {
    expect(statuses({ assessments: 1, assessmentsApproved: 1, dpiaApproved: 0 }).assessments).toBe("done");
    expect(statuses({ assessments: 1, assessmentsApproved: 1, dpiaApproved: 0, dpiaDuty: "check" }).assessments).toBe("done");
  });

  it("an approved DPIA is the bar where the answers say a DPIA applies", () => {
    const general = { assessments: 2, assessmentsApproved: 1, dpiaApproved: 0, dpiaDuty: "applies" as const };
    expect(statuses(general).assessments).toBe("started");
    expect(statuses({ ...general, dpiaApproved: 1 }).assessments).toBe("done");
    expect(statuses({ dpiaDuty: "applies" }).assessments).toBe("todo");
  });

  it("says exactly what finishes it, in both languages", () => {
    const t = (bundle: typeof en) => (key: string) => {
      const [group, id] = key.split(".");
      return (bundle.guided as unknown as Record<string, Record<string, string>>)[group][id];
    };
    expect(stepFinishText(t(es), "assessments", "applies")).toBe(
      "Aprueba una EIPD: tus respuestas indican que es obligatoria, así que ninguna otra evaluación completa este paso.",
    );
    expect(stepFinishText(t(es), "assessments", null)).toBe(
      "Aprueba una evaluación. Cuenta cualquier tipo, también una evaluación de impacto de transferencia.",
    );
    expect(stepFinishText(t(en), "assessments", "check")).toContain("consider a DPIA");
    expect(stepFinishText(t(es), "transfers", null)).toContain("transferencia internacional");
    for (const bundle of [en, es]) {
      for (const text of Object.values(bundle.guided.finish)) {
        expect(text).not.toContain("—");
        expect(text).not.toMatch(/\busted\b/i);
      }
    }
  });
});
