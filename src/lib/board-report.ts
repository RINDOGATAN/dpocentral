// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * THE BOARD REPORT: a short, plain
 * report a DPO gives to the board or to management, for a chosen period, from
 * data already in DPO Central (no AI, no new data entry beyond the DPO's own
 * comment). Neutral facts: no legal advice and no claim that anything
 * "complies".
 *
 * This file is pure (no React, no Prisma, no Next): the period rules, the
 * shape the server sends, and the two readings the report makes over the
 * programme (the top three risks or gaps, and the next three actions with an
 * owner and a date). The page (src/app/(dashboard)/privacy/board-report) and
 * the PDF (src/server/services/export/board-report.tsx) both print what the
 * server assembles here (src/server/services/program/board-report.ts), so the
 * screen and the PDF cannot disagree.
 *
 * Tested in tests/board-report.test.ts.
 */

import { isOptionalSetting, isStandby, type DocumentGap, type DocumentStatus, type EvaluatedDocument } from "@/config/document-register";
import {
  isCounted,
  isShown,
  stepSequence,
  type PathConfig,
  type PathStatuses,
  type ProgramFigure,
  type StageWord,
  type StepStatus,
} from "@/components/guided/path";
import type { NeedsActionItem, NeedsActionKind } from "@/lib/needs-action";
import { nextActions, type RecordDeadline } from "@/lib/programme-overview";

// ---------------------------------------------------------------------------
// The period
// ---------------------------------------------------------------------------

/** A period of whole days, both ends included, as YYYY-MM-DD (UTC). */
export interface BoardPeriod {
  from: string;
  to: string;
}

export const PERIOD_PRESETS = ["lastQuarter", "thisQuarter", "lastMonth", "last12Months"] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

/** The longest period the report covers: about three years. */
export const MAX_PERIOD_DAYS = 3 * 366;

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function utcDay(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

/** A YYYY-MM-DD string as a date at UTC midnight, or null when it is not a real day. */
export function parseDay(value: string | null | undefined): Date | null {
  if (!value || !ISO_DAY.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || isoDay(date) !== value ? null : date;
}

/**
 * The period a preset names, for `now`:
 * - `lastQuarter`   the last full calendar quarter (the default)
 * - `thisQuarter`   from the first day of this quarter to today
 * - `lastMonth`     the last full calendar month
 * - `last12Months`  the twelve full months before this one
 */
export function presetPeriod(preset: PeriodPreset, now: Date): BoardPeriod {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const quarterStart = m - (m % 3);
  switch (preset) {
    case "thisQuarter":
      return { from: isoDay(utcDay(y, quarterStart, 1)), to: isoDay(utcDay(y, m, now.getUTCDate())) };
    case "lastMonth":
      return { from: isoDay(utcDay(y, m - 1, 1)), to: isoDay(utcDay(y, m, 0)) };
    case "last12Months":
      return { from: isoDay(utcDay(y, m - 12, 1)), to: isoDay(utcDay(y, m, 0)) };
    case "lastQuarter":
    default:
      return { from: isoDay(utcDay(y, quarterStart - 3, 1)), to: isoDay(utcDay(y, quarterStart, 0)) };
  }
}

/** The preset a period matches for `now`, or "custom". */
export function periodPreset(period: BoardPeriod, now: Date): PeriodPreset | "custom" {
  for (const preset of PERIOD_PRESETS) {
    const p = presetPeriod(preset, now);
    if (p.from === period.from && p.to === period.to) return preset;
  }
  return "custom";
}

/**
 * The period asked for, or the last full quarter when it is missing or not
 * valid: both ends real days, the start not after the end, the end not after
 * today, and no longer than `MAX_PERIOD_DAYS`.
 */
export function resolvePeriod(from: string | null | undefined, to: string | null | undefined, now: Date): BoardPeriod {
  const start = parseDay(from);
  const end = parseDay(to);
  const today = parseDay(isoDay(now))!;
  if (
    !start ||
    !end ||
    start.getTime() > end.getTime() ||
    end.getTime() > today.getTime() ||
    (end.getTime() - start.getTime()) / DAY_MS + 1 > MAX_PERIOD_DAYS
  ) {
    return presetPeriod("lastQuarter", now);
  }
  return { from: from!, to: to! };
}

/** The instants a period covers: from its first day's midnight to (not including) the day after its last. */
export function periodBounds(period: BoardPeriod): { start: Date; end: Date } {
  const start = parseDay(period.from)!;
  const last = parseDay(period.to)!;
  return { start, end: new Date(last.getTime() + DAY_MS) };
}

/** The key a saved report is kept under: one report per period. */
export function periodKey(period: BoardPeriod): string {
  return `${period.from}_${period.to}`;
}

/** The DPO's comment: plain text, at most this many characters. */
export const COMMENT_MAX = 2000;

/** At most this many saved reports are kept; the oldest saved goes first. */
export const SAVED_REPORTS_MAX = 40;

// ---------------------------------------------------------------------------
// What the server sends (one shape for the page and the PDF)
// ---------------------------------------------------------------------------

export interface BoardIncidents {
  /** Incidents discovered in the period. */
  inPeriod: number;
  /** Of those, notified to the supervisory authority within 72 hours of discovery. */
  notifiedWithin72h: number;
  /** Of those, notified to the authority after 72 hours. */
  notifiedLate: number;
  /** Of those, marked as requiring notification and not notified to the authority yet. */
  notNotifiedYet: number;
  /** Incidents open on the date the report is generated, from any period. */
  openNow: number;
  /**
   * Open incidents marked as requiring notification and not notified to the
   * authority yet, on the date generated, from any period. Optional for
   * reports assembled before it was counted.
   */
  toNotifyNow?: number;
  /**
   * The DPO's breach-readiness confirmation (step 5): when it was given and
   * whether it still covers the laws declared now. Null when none is on
   * record; absent for reports assembled before it existed.
   */
  breachReadiness?: { confirmedAt: string; current: boolean } | null;
}

export interface BoardRights {
  /** Rights requests received in the period. */
  received: number;
  /** Of those, completed by their deadline (the extended one where it was extended). */
  completedOnTime: number;
  /** Of those, completed after their deadline. */
  completedLate: number;
  /** Of those, still open and past their deadline. */
  openOverdue: number;
  /** Of those, still open and within their deadline. */
  openInTime: number;
  /** Of those, rejected or cancelled. */
  closedOther: number;
  /** Open and past their deadline on the date generated, from any period. Optional, as above. */
  overdueNow?: number;
}

export interface BoardVendors {
  /** Vendors a person has confirmed, not terminated. */
  total: number;
  /**
   * Of those, in use (status ACTIVE): the vendors the coverage is counted over,
   * as in the vendor register (src/lib/vendor-contracts.ts). Optional for
   * reports assembled before it was counted, which used `total`.
   */
  active?: number;
  /** Of those in use, with a data processing agreement in force (src/lib/vendor-contracts.ts). */
  withDpa: number;
  /** Of those, rated high or critical risk with no such agreement. */
  highRiskWithoutDpa: number;
  /** Drafted vendors waiting to be confirmed: not counted above. */
  drafts: number;
}

export interface BoardAssessments {
  dpiaApproved: number;
  dpiaPending: number;
  /** General risk assessments (PIA). Optional for reports assembled before they were counted. */
  piaApproved?: number;
  piaPending?: number;
  liaApproved: number;
  liaPending: number;
}

/** One counted step of the path with its state, in path order ("3.1"). */
export interface BoardStep {
  stepId: string;
  /** "3.1": the stage's number, then the step's place in it, as in the menu. */
  number: string;
  status: StepStatus;
  /** For a step started but not done: the fields that would finish it (field keys only). */
  missing?: string[];
}

/**
 * The organisation's records on the date generated, from any period: the
 * stable counts two reports of different dates are compared on.
 */
export interface BoardRecords {
  /** Confirmed data assets (systems). */
  dataAssets: number;
  /** Confirmed processing activities, and of those the ones with the minimum record fields. */
  activities: number;
  activitiesComplete: number;
  /** International transfers, and of those the ones with a recorded compliance status. */
  transfers: number;
  transfersAssessed: number;
  /** Rights requests received, and completed, since the start. */
  rightsReceived: number | null;
  rightsCompleted: number | null;
  /** Incidents recorded since the start. */
  incidents: number;
}

/** A risk or gap: work waiting for a person, or a document that is not ready. */
export type BoardRisk =
  | { kind: "needsAction"; needsKind: NeedsActionKind; count: number }
  | { kind: "document"; id: string; status: DocumentStatus };

/** One of the next three actions. Serialisable: a step is named by its id. */
export type BoardActionItem =
  | { kind: "needsAction"; needsKind: NeedsActionKind; count: number }
  | { kind: "step"; stepId: string; toConfirm: boolean };

export interface BoardAction {
  item: BoardActionItem;
  /** The person who holds it: the organisation's privacy officer (or its owner). Null when none is named. */
  owner: string | null;
  /** YYYY-MM-DD: the record's own deadline in law. Null when there is none. */
  date: string | null;
  /** Where the date comes from. */
  dateSource: "deadline" | null;
  /** The deadline had passed on the date the report was generated. */
  overdue?: boolean;
}

export interface BoardComment {
  text: string;
  savedAt: string;
  /** The name (or address) of the person who saved it. */
  savedBy: string | null;
}

export interface BoardReport {
  organizationName: string;
  period: BoardPeriod;
  /** ISO instant the report was generated. */
  generatedAt: string;
  /** Stages done of the stages counted: the menu's figure. */
  figure: ProgramFigure;
  /** The stages in path order, each with its one state word. */
  areas: { stageId: string; word: StageWord }[];
  /** Every counted step with its state and what finishes it. Optional for older shapes. */
  steps?: BoardStep[];
  /** What the organisation's answers say about a DPIA (the assessments step's bar). */
  dpiaDuty?: "applies" | "check" | null;
  /** The stable counts of records on the date generated. Optional for older shapes. */
  records?: BoardRecords;
  /** Every document of the register for this deployment, with its state. */
  documents: EvaluatedDocument[];
  incidents: BoardIncidents;
  /** Null when the rights-request module is off, or this member does not handle requests. */
  rights: BoardRights | null;
  vendors: BoardVendors;
  assessments: BoardAssessments;
  risks: BoardRisk[];
  actions: BoardAction[];
  comment: BoardComment | null;
  /** This member may save the comment (owner, admin or privacy officer). */
  canSave: boolean;
}

// ---------------------------------------------------------------------------
// Readings
// ---------------------------------------------------------------------------

/** Ready documents and the others DPO Central produces (drafts and those waiting for an input). */
export function documentSplit(documents: readonly EvaluatedDocument[]): {
  ready: EvaluatedDocument[];
  missing: EvaluatedDocument[];
} {
  return {
    ready: documents.filter((d) => d.status.state === "ready"),
    // A document on standby (waiting only for a breach or a request, with the
    // means in place), or waiting only for an optional setting, is not missing.
    missing: documents.filter(
      (d) =>
        d.status.state === "draft" ||
        (d.status.state === "needsInput" && !isStandby(d.status) && !isOptionalSetting(d.status)),
    ),
  };
}

/** Most serious first: deadlines in law, then approvals, reviews and drafts. */
const RISK_PRIORITY: NeedsActionKind[] = [
  "breach-window",
  "dsar-due",
  "breach-decision",
  "review-due",
  "assessment-review",
  "assessment-approval",
  "drafts-to-confirm",
];

/**
 * Documents whose absence a board would ask about first: the records the law
 * asks for, then the breach register and the assessments.
 */
const DOCUMENT_PRIORITY = [
  "ropa",
  "breachRegister",
  "vendorRegister",
  "dpia",
  "dpa",
  "assessmentReport",
  "regulatoryReport",
  "dsarPerformance",
  "assessmentPortfolio",
  "programmeReport",
];

/**
 * The top three risks or gaps: what waits for a person (from Needs action),
 * most serious first, then the documents that are not ready (from the
 * register), the ones a board would ask about first. The board report itself
 * and the documents shown on screen only are not listed.
 */
export function topRisks(
  needsAction: readonly NeedsActionItem[],
  documents: readonly EvaluatedDocument[],
  limit = 3,
): BoardRisk[] {
  const out: BoardRisk[] = [];
  const waiting = [...needsAction].sort(
    (a, b) => RISK_PRIORITY.indexOf(a.kind) - RISK_PRIORITY.indexOf(b.kind),
  );
  for (const item of waiting) out.push({ kind: "needsAction", needsKind: item.kind, count: item.count });
  const rank = (id: string) => {
    const i = DOCUMENT_PRIORITY.indexOf(id);
    return i < 0 ? DOCUMENT_PRIORITY.length : i;
  };
  const gaps = documents
    .filter((d) => d.status.state === "draft" || (d.status.state === "needsInput" && !isStandby(d.status)))
    .filter((d) => DOCUMENT_PRIORITY.includes(d.id))
    // Waiting for an input is a bigger gap than a draft.
    .sort(
      (a, b) =>
        Number(b.status.state === "needsInput") - Number(a.status.state === "needsInput") || rank(a.id) - rank(b.id),
    );
  for (const doc of gaps) out.push({ kind: "document", id: doc.id, status: doc.status });
  return out.slice(0, limit);
}

/** The gaps of a draft, for a reader that needs them (the PDF and the page). */
export function draftGaps(status: DocumentStatus): DocumentGap[] {
  return status.state === "draft" ? status.gaps : [];
}

/**
 * Every counted step shown for this organisation, in path order and numbered
 * as in the menu ("3.1"), with its state and, for a step started but not done,
 * the fields that would finish it. The same steps the figure's stages are
 * made of, so the report's list and its figure cannot disagree.
 */
export function boardSteps<C>(
  config: PathConfig<C>,
  statuses: PathStatuses,
  missing: Partial<Record<string, string[]>> = {},
): BoardStep[] {
  return stepSequence(config, statuses)
    .filter((entry) => isCounted(entry.step) && isShown(entry.step, statuses))
    .map((entry) => {
      const status = statuses[entry.step.id] ?? "todo";
      const fields = status === "started" ? (missing[entry.step.id] ?? []) : [];
      return {
        stepId: entry.step.id,
        number: entry.number,
        status,
        ...(fields.length > 0 ? { missing: fields } : {}),
      };
    });
}

/** The kind of record deadline that dates each kind of waiting work. */
const DEADLINE_OF: Partial<Record<NeedsActionKind, RecordDeadline["kind"]>> = {
  "breach-window": "breachNotify",
  "breach-decision": "breachDecision",
  "dsar-due": "dsarDue",
};

/**
 * The next three actions, as the dashboard lists them (src/lib/programme-overview.ts
 * nextActions: what waits for a person first, most urgent first, then the
 * path's open steps), each with an owner and a date:
 *
 * - owner: the person the organisation has as its privacy officer (else its
 *   owner); DPO Central has no other owner for programme work;
 * - date: the earliest deadline in law of the records behind it (a breach's
 *   72-hour window, a rights request's due date), else none. The organisation
 *   sets its own pace on the path, so a step carries no invented date.
 */
export function boardActions<C>(
  config: PathConfig<C>,
  statuses: PathStatuses,
  needsAction: readonly NeedsActionItem[],
  context: {
    owner: string | null;
    deadlines: readonly RecordDeadline[];
    /** The day the report is generated, to tell an overdue deadline. */
    now?: Date;
  },
  limit = 3,
): BoardAction[] {
  return nextActions(config, statuses, needsAction, limit).map((action) => {
    if (action.kind === "needsAction") {
      const deadlineKind = DEADLINE_OF[action.item.kind];
      const deadline = deadlineKind
        ? context.deadlines
            .filter((d) => d.kind === deadlineKind)
            .map((d) => d.at)
            .sort()[0]
        : undefined;
      const overdue = !!deadline && !!context.now && new Date(deadline).getTime() < context.now.getTime();
      return {
        item: { kind: "needsAction", needsKind: action.item.kind, count: action.item.count },
        owner: context.owner,
        date: deadline ? deadline.slice(0, 10) : null,
        dateSource: deadline ? "deadline" : null,
        ...(overdue ? { overdue: true } : {}),
      };
    }
    return {
      item: { kind: "step", stepId: action.step.id, toConfirm: action.toConfirm },
      owner: context.owner,
      date: null,
      dateSource: null,
    };
  });
}
