// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * How the Guided dashboard and the Guided menu read the programme (owner's
 * decisions d4, d6 and d7, 9 October 2026). Pure, and the only place these
 * readings are made, so the dashboard's documents panel, its six area tiles,
 * its "Next three actions" and the menu's state words and document lines can
 * never disagree:
 *
 * - the documents of a step, and the documents not in DPO Central yet, come
 *   from the one register (src/config/document-register.ts);
 * - a stage's state word comes from `stageWord` (src/components/guided/path.ts)
 *   with the stages that "Needs action" points at;
 * - the next actions put what waits for a person first, then the path.
 *
 * Tested in tests/document-register.test.ts.
 */

import {
  isCounted,
  isShown,
  stageWord,
  type PathConfig,
  type PathStage,
  type PathStatuses,
  type PathStep,
  type StageWord,
} from "@/components/guided/path";
import {
  documentEntry,
  registerFor,
  type DocumentEntry,
  type DocumentState,
  type EvaluatedDocument,
} from "@/config/document-register";
import type { NeedsActionItem, NeedsActionKind } from "@/lib/needs-action";
import type { PlanState, PlanWindow } from "@/components/guided/plan";

/** The stage each kind of waiting work belongs to (null: no single stage). */
export const NEEDS_ACTION_STAGE: Record<NeedsActionKind, string | null> = {
  "review-due": "inventory",
  "dsar-due": "rights",
  "breach-window": "respond",
  "breach-decision": "respond",
  "assessment-approval": "assess",
  // Drafts already show as "to confirm" on their own stages.
  "drafts-to-confirm": null,
};

/** The ids of the stages with work waiting for a person. */
export function attentionStages(items: readonly NeedsActionItem[]): string[] {
  const out = new Set<string>();
  for (const item of items) {
    const stage = NEEDS_ACTION_STAGE[item.kind];
    if (stage) out.add(stage);
  }
  return [...out];
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export interface RegisterRow {
  entry: DocumentEntry;
  doc: EvaluatedDocument;
}

/** The evaluated documents joined to their register entries, in register order. */
export function registerRows(documents: readonly EvaluatedDocument[]): RegisterRow[] {
  const rows: RegisterRow[] = [];
  for (const doc of documents) {
    const entry = documentEntry(doc.id);
    if (entry) rows.push({ entry, doc });
  }
  return rows;
}

const STATE_ORDER: Record<DocumentState, number> = { ready: 0, draft: 1, needsInput: 2, notYet: 3 };

/**
 * The dashboard panel: the documents DPO Central produces, ready first, then
 * drafts, then those waiting for an input (register order within each), and
 * the ones it does not produce yet, gathered on one line.
 */
export function panelRows(documents: readonly EvaluatedDocument[]): {
  produced: RegisterRow[];
  notYet: RegisterRow[];
} {
  const rows = registerRows(documents);
  const produced = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.doc.status.state !== "notYet")
    .sort(
      (a, b) =>
        STATE_ORDER[a.row.doc.status.state] - STATE_ORDER[b.row.doc.status.state] || a.index - b.index,
    )
    .map(({ row }) => row);
  return { produced, notYet: rows.filter((row) => row.doc.status.state === "notYet") };
}

/** The steps the menu shows with a page (the ones that can carry a document line). */
function menuSteps<C>(config: PathConfig<C>, statuses: PathStatuses | null): PathStep<C>[] {
  return config.stages.flatMap((stage) =>
    stage.steps.filter((step) => !step.coming && !!step.href && isShown(step, statuses)),
  );
}

/**
 * The menu's quiet line under each step: the documents it produces, with
 * their states. Documents not in DPO Central yet are not on these lines; they
 * are in the menu's "Not in DPO Central yet" group (`notYetRows`).
 */
export function stepDocumentRows<C>(
  config: PathConfig<C>,
  statuses: PathStatuses | null,
  documents: readonly EvaluatedDocument[],
): Record<string, RegisterRow[]> {
  const out: Record<string, RegisterRow[]> = {};
  const steps = new Set(menuSteps(config, statuses).map((s) => s.id));
  for (const row of registerRows(documents)) {
    if (row.doc.status.state === "notYet") continue;
    if (!row.entry.stepId || !steps.has(row.entry.stepId)) continue;
    (out[row.entry.stepId] ??= []).push(row);
  }
  return out;
}

/** The panel's last line: the documents not in DPO Central yet, as evaluated. */
export function notYetRows(documents: readonly EvaluatedDocument[]): RegisterRow[] {
  return panelRows(documents).notYet;
}

/**
 * The menu's "Not in DPO Central yet" group. A document is "not yet" by the
 * register alone (it has no rule), so the menu reads it straight from the
 * register: shown before the states arrive, and to a member limited to
 * departments. The same entries as the panel's last line (tested).
 */
export function notYetEntries(options: { dsarEnabled: boolean }): DocumentEntry[] {
  return registerFor(options).filter((entry) => !entry.evaluate);
}

// ---------------------------------------------------------------------------
// Areas (the six tiles) and next actions
// ---------------------------------------------------------------------------

export type AreaAction =
  | { kind: "needsAction"; item: NeedsActionItem }
  | { kind: "confirm" }
  | { kind: "step"; step: PathStep<unknown> }
  | { kind: "done" }
  | { kind: "coming" };

export interface Area<C> {
  stage: PathStage<C>;
  number: number;
  word: StageWord;
  action: AreaAction;
}

/** The first counted step of a stage that is not done, as the menu and next step read it. */
function firstOpenStep<C>(stage: PathStage<C>, statuses: PathStatuses): PathStep<C> | null {
  return (
    stage.steps.find(
      (s) => isCounted(s) && isShown(s, statuses) && !!s.href && statuses[s.id] !== "done",
    ) ?? null
  );
}

/**
 * One tile per stage (owner's decision d7: six area tiles, each with its state
 * and its next action). The state word is the menu's; the action is the work
 * waiting in the stage, else confirming its drafts, else its first open step.
 */
export function programmeAreas<C>(
  config: PathConfig<C>,
  statuses: PathStatuses,
  needsAction: readonly NeedsActionItem[],
): Area<C>[] {
  const attention = attentionStages(needsAction);
  return config.stages.map((stage, index) => {
    const word = stageWord(stage, statuses, attention);
    const waiting = needsAction.find((item) => NEEDS_ACTION_STAGE[item.kind] === stage.id);
    const open = firstOpenStep(stage, statuses);
    const action: AreaAction =
      word === "coming"
        ? { kind: "coming" }
        : waiting
          ? { kind: "needsAction", item: waiting }
          : open && statuses[open.id] === "toConfirm"
            ? { kind: "confirm" }
            : open
              ? { kind: "step", step: open as PathStep<unknown> }
              : { kind: "done" };
    return { stage, number: index + 1, word, action };
  });
}

/** Most urgent first: deadlines in law, then approvals, drafts and reviews. */
const NEEDS_ACTION_PRIORITY: NeedsActionKind[] = [
  "breach-window",
  "breach-decision",
  "dsar-due",
  "assessment-approval",
  "drafts-to-confirm",
  "review-due",
];

export type NextAction =
  | { kind: "needsAction"; item: NeedsActionItem }
  | { kind: "step"; step: PathStep<unknown>; stageIndex: number; toConfirm: boolean };

/**
 * "Next three actions" (owner's decision d7, folding in Recent activity and
 * Quick actions): what waits for a person first, most urgent first, then the
 * path's open steps in order. A step met only by drafts is left out when
 * confirming the drafts is already on the list.
 */
export function nextActions<C>(
  config: PathConfig<C>,
  statuses: PathStatuses,
  needsAction: readonly NeedsActionItem[],
  limit = 3,
): NextAction[] {
  const out: NextAction[] = [];
  const waiting = [...needsAction].sort(
    (a, b) => NEEDS_ACTION_PRIORITY.indexOf(a.kind) - NEEDS_ACTION_PRIORITY.indexOf(b.kind),
  );
  for (const item of waiting) out.push({ kind: "needsAction", item });
  const confirmListed = waiting.some((item) => item.kind === "drafts-to-confirm");
  for (const [stageIndex, stage] of config.stages.entries()) {
    for (const step of stage.steps) {
      if (!isCounted(step) || !isShown(step, statuses) || !step.href) continue;
      const status = statuses[step.id];
      if (status === "done") continue;
      if (status === "toConfirm" && confirmListed) continue;
      out.push({
        kind: "step",
        step: step as PathStep<unknown>,
        stageIndex,
        toConfirm: status === "toConfirm",
      });
    }
  }
  return out.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Deadlines and the firm view (owner's decision d9)
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

/** A deadline at risk, as the server sends it (src/server/services/program/deadlines.ts). */
export interface RecordDeadline {
  kind: "breachDecision" | "breachNotify" | "dsarDue";
  /** ISO date the deadline falls on. */
  at: string;
  publicId: string;
  href: string;
}

/** A deadline of the firm view: a record's, or the plan's next milestone. */
export type ClientDeadline = RecordDeadline | { kind: "plan"; at: string; day: number };

/**
 * The plan's next milestone (day 30, 60 or 90) while the plan runs: the last
 * day of the window the plan is in. Null before the plan starts and after it
 * ends. The dashboard's deadlines card and the firm view both read it here.
 */
export function planMilestone(
  windows: readonly PlanWindow[],
  planStart: string | Date | null,
  plan: PlanState | null,
): { day: number; at: Date } | null {
  if (!planStart || plan?.kind !== "running") return null;
  const window = windows.find((w) => w.untilDay >= plan.day);
  if (!window) return null;
  const start = typeof planStart === "string" ? new Date(planStart) : planStart;
  return { day: window.untilDay, at: new Date(start.getTime() + (window.untilDay - 1) * DAY_MS) };
}

/**
 * The nearest deadline of one client: the earliest of its breach windows,
 * its rights requests due and its plan's next milestone. An overdue one is
 * the earliest of all, so it comes first.
 */
export function nearestDeadline(
  deadlines: readonly RecordDeadline[],
  milestone: { day: number; at: Date } | null,
): ClientDeadline | null {
  const all: ClientDeadline[] = [...deadlines];
  if (milestone) all.push({ kind: "plan", at: milestone.at.toISOString(), day: milestone.day });
  if (all.length === 0) return null;
  return all.reduce((a, b) => (new Date(b.at).getTime() < new Date(a.at).getTime() ? b : a));
}

/**
 * The firm view's order (owner's decision d9): by the nearest deadline, the
 * soonest (or most overdue) first; the clients with no deadline after them,
 * by name.
 */
export function sortByNearestDeadline<T extends { name: string; deadline: { at: string } | null }>(
  rows: readonly T[],
  locale = "en",
): T[] {
  return [...rows].sort((a, b) => {
    if (a.deadline && b.deadline) {
      const diff = new Date(a.deadline.at).getTime() - new Date(b.deadline.at).getTime();
      if (diff !== 0) return diff;
    } else if (a.deadline) return -1;
    else if (b.deadline) return 1;
    return a.name.localeCompare(b.name, locale);
  });
}

/**
 * "4 of 11 ready": the documents DPO Central produces for this deployment
 * (the ones not in DPO Central yet are not counted) and how many are ready.
 */
export function documentsReady(documents: readonly EvaluatedDocument[]): { ready: number; total: number } {
  const produced = documents.filter((d) => d.status.state !== "notYet");
  return { ready: produced.filter((d) => d.status.state === "ready").length, total: produced.length };
}
