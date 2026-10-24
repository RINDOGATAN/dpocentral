// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The dashboard says no more than is true: an area met only by "ready when
 * needed" steps is "ready", not "done"; a document waiting only for an event
 * (a breach, a rights request) is on standby, not missing data; a document
 * that needs a module or a setting says so; and a step nobody can complete
 * is not counted.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { DPO_CENTRAL_PATH, EMPTY_PATH_COUNTS } from "@/components/guided/path-config";
import { evaluatePath, programFigure, stageProgress } from "@/components/guided/path";
import {
  DOCUMENT_REGISTER,
  evaluateRegister,
  isStandby,
  registerFor,
  type DocumentFacts,
  type DocumentStatus,
} from "@/config/document-register";
import { documentBadge } from "@/components/guided/document-words";
import { nextActions, panelRows } from "@/lib/programme-overview";
import { documentSplit, topRisks } from "@/lib/board-report";

const read = (p: string) => readFileSync(path.join(__dirname, "..", p), "utf8");

const FACTS: DocumentFacts = {
  ...EMPTY_PATH_COUNTS,
  activitiesIncomplete: 0,
  dpiaAssessments: 0,
  dpiaApproved: 0,
  dpiaAccess: "module",
  dpaContracts: 0,
  incidentsMissingImpact: 0,
  incidentNotifications: 0,
  aiAssistOn: false,
  dsarCompleted: 0,
};

describe("an area met only by steps ready for when they are needed", () => {
  const respond = DPO_CENTRAL_PATH.stages.find((s) => s.id === "respond")!;

  it("reads 'ready', not 'done', until the event has happened", () => {
    const ready = evaluatePath(DPO_CENTRAL_PATH, { ...EMPTY_PATH_COUNTS, processingActivitiesComplete: 1 });
    expect(ready.incidents).toBe("ready");
    expect(stageProgress(respond, ready).state).toBe("ready");
    const done = evaluatePath(DPO_CENTRAL_PATH, { ...EMPTY_PATH_COUNTS, processingActivitiesComplete: 1, incidents: 1 });
    expect(stageProgress(respond, done).state).toBe("done");
  });

  it("has a lower-case label in both languages", () => {
    expect(es.guided.stageState.ready).toBe("a punto");
    expect(en.guided.stageState.ready).toBe("ready");
    expect(es.guided.areas.ready).toBeTruthy();
    expect(en.guided.areas.ready).toBeTruthy();
  });
});

describe("documents on standby", () => {
  const docs = (over: Partial<DocumentFacts>) =>
    evaluateRegister(registerFor({ dsarEnabled: true }), { ...FACTS, ...over });
  const status = (list: ReturnType<typeof docs>, id: string) => list.find((d) => d.id === id)!.status;

  it("the breach register is on standby while no incident is recorded: a breach cannot be made to happen", () => {
    expect(isStandby(status(docs({}), "breachRegister"))).toBe(true);
    expect(documentBadge(status(docs({ processingActivitiesComplete: 1 }), "breachRegister"))).toBe("standby");
  });

  it("the rights report is on standby while no request has arrived, set up or not", () => {
    expect(documentBadge(status(docs({ dsarIntakeConfigured: true }), "dsarPerformance"))).toBe("standby");
    expect(documentBadge(status(docs({ dsarIntakeConfigured: false }), "dsarPerformance"))).toBe("standby");
  });

  it("the breach notification draft: standby without an incident; AI assistance is an optional note, not a gap", () => {
    expect(documentBadge(status(docs({ aiAssistOn: false }), "breachNotification"))).toBe("standby");
    expect(documentBadge(status(docs({ incidents: 1, aiAssistOn: false }), "breachNotification"))).toBe("needsSetting");
    for (const bundle of [en, es]) expect(bundle.documentRegister.settingLine.aiAssist).toBeTruthy();
    expect(es.documentRegister.state.needsSetting).toBe("opcional");
  });

  it("are listed after the ready documents and are not gaps on the board report", () => {
    const list = docs({ processingActivitiesComplete: 1, jurisdictions: 1 });
    const order = panelRows(list).produced.map((r) => documentBadge(r.doc.status));
    expect(order.indexOf("standby")).toBeLessThan(order.indexOf("needsInput"));
    expect(documentSplit(list).missing.map((d) => d.id)).not.toContain("breachRegister");
    expect(topRisks([], list, 20).map((r) => (r.kind === "document" ? r.id : r.kind))).not.toContain("breachRegister");
  });
});

describe("what a waiting document needs", () => {
  const needs = (input: string): DocumentStatus => ({ state: "needsInput", input } as DocumentStatus);

  it("a module or a setting is not called missing data", () => {
    expect(documentBadge(needs("dpiaModule"))).toBe("needsModule");
    expect(documentBadge(needs("dpiaModuleHosted"))).toBe("needsModule");
    expect(documentBadge(needs("aiAssist"))).toBe("needsSetting");
    expect(documentBadge(needs("incident"))).toBe("needsInput");
  });

  it("every badge has words in both languages, and the fold line counts in plural", () => {
    for (const bundle of [en, es]) {
      for (const key of ["standby", "needsModule", "needsSetting"] as const) {
        expect(bundle.documentRegister.state[key], key).toBeTruthy();
        expect(bundle.documentRegister.legend[key], key).toBeTruthy();
      }
      expect(bundle.documentRegister.waitingLine).toMatch(/plural/);
    }
  });
});

describe("a step nobody can complete", () => {
  it("vendor due diligence is not counted and never a next action while its module is announced", () => {
    const statuses = evaluatePath(DPO_CENTRAL_PATH, EMPTY_PATH_COUNTS);
    expect(statuses.vendorDueDiligence).toBe("coming");
    // The figure counts the five stages with a page; the policies stage is all to come.
    expect(programFigure(DPO_CENTRAL_PATH, statuses).total).toBe(5);
    const ids = nextActions(DPO_CENTRAL_PATH, statuses, [], 20).map((a) => (a.kind === "step" ? a.step.id : a.kind));
    expect(ids).not.toContain("vendorDueDiligence");
    // Named once, in the documents panel's "not in DPO Central yet" line.
    expect(DOCUMENT_REGISTER.filter((d) => d.stepId === "vendorDueDiligence").map((d) => d.id)).toEqual([
      "vendorReviewReport",
    ]);
  });
});

describe("the dashboard and the menu say things once", () => {
  it("the needs-action page lists the program's next steps when nothing waits", () => {
    const page = read("src/app/(dashboard)/privacy/needs-action/page.tsx");
    expect(page).toContain('data-testid="needs-action-next-steps"');
    expect(es.views.needsAction.empty).not.toMatch(/nada pendiente/);
  });

  it("deadlines are upcoming, not 'at risk'", () => {
    expect(es.guided.deadlines.title).toBe("Próximos plazos");
    expect(en.guided.deadlines.title).toBe("Upcoming deadlines");
  });

  it("the welcome card shows on the first visit only", () => {
    const card = read("src/components/help/first-run-card.tsx");
    expect(card).toContain("markIntroSeen()");
  });

  it("section and card headings use the body face in the app", () => {
    const css = read("src/app/globals.css");
    expect(css).toMatch(/\.app-shell :is\(h2, h3, h4, h5, h6\)/);
    expect(read("src/components/guided/guided-layout.tsx")).toContain('className="app-shell');
  });
});
