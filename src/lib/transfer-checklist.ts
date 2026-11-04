// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Answers to the Schrems II checklist of a transfer, kept in the transfer's
 * `metadata.schremsChecklist` (no column of their own): one entry per item,
 * done / not applicable / pending, with an optional note. Other metadata keys
 * are left as they are.
 *
 * Pure: no Prisma, no React.
 */

export const CHECKLIST_STATES = ["DONE", "NA", "PENDING"] as const;
export type ChecklistState = (typeof CHECKLIST_STATES)[number];

export interface ChecklistAnswer {
  state: ChecklistState;
  note?: string;
  /** ISO time of the answer. */
  at?: string;
}

export type ChecklistAnswers = Record<string, ChecklistAnswer>;

const KEY = "schremsChecklist";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The answers recorded in a transfer's metadata; malformed entries are skipped. */
export function checklistAnswersOf(metadata: unknown): ChecklistAnswers {
  if (!isRecord(metadata) || !isRecord(metadata[KEY])) return {};
  const out: ChecklistAnswers = {};
  for (const [id, raw] of Object.entries(metadata[KEY] as Record<string, unknown>)) {
    if (!isRecord(raw)) continue;
    const state = raw.state;
    if (typeof state !== "string" || !(CHECKLIST_STATES as readonly string[]).includes(state)) continue;
    out[id] = {
      state: state as ChecklistState,
      ...(typeof raw.note === "string" && raw.note ? { note: raw.note } : {}),
      ...(typeof raw.at === "string" ? { at: raw.at } : {}),
    };
  }
  return out;
}

/** The metadata with one answer set, every other key kept. */
export function withChecklistAnswer(
  metadata: unknown,
  itemId: string,
  answer: ChecklistAnswer
): Record<string, unknown> {
  const base = isRecord(metadata) ? { ...metadata } : {};
  const answers = checklistAnswersOf(base);
  answers[itemId] = {
    state: answer.state,
    ...(answer.note ? { note: answer.note } : {}),
    ...(answer.at ? { at: answer.at } : {}),
  };
  return { ...base, [KEY]: answers };
}

/** Items still to answer: no answer yet, or answered "pending". */
export function pendingChecklistItems(itemIds: readonly string[], answers: ChecklistAnswers): string[] {
  return itemIds.filter((id) => !answers[id] || answers[id].state === "PENDING");
}

/** The section of the checklist an item belongs to, from its id (s2_<n>_...). */
const SECTION_BY_STEP: Record<string, string> = {
  "1": "know",
  "2": "tool",
  "3": "law",
  "4": "measures",
  "5": "procedural",
  "6": "monitor",
};

export function checklistSection(itemId: string): string {
  const step = /^s2_(\d)_/.exec(itemId)?.[1];
  return (step && SECTION_BY_STEP[step]) || "know";
}

/** Where the work behind an item is done on the transfer page or elsewhere. */
export type ChecklistTarget = "transfers" | "edit" | "measures" | "tia";

export function checklistTarget(itemId: string): ChecklistTarget {
  switch (checklistSection(itemId)) {
    case "know":
      return "transfers";
    case "tool":
      return "edit";
    case "measures":
      return "measures";
    default:
      return "tia";
  }
}
