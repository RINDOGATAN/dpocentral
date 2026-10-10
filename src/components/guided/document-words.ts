// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The words for a document of the register (src/config/document-register.ts),
 * in one place for the dashboard panel and the menu lines: the same name and
 * the same state word wherever a document is shown. Keys under
 * `documentRegister`.
 */

import type { CountedStepId, DocumentGap, DocumentStatus, RecordCounts } from "@/config/document-register";
import type { RegisterRow } from "@/lib/programme-overview";

type Translate = (key: string, values?: Record<string, string | number>) => string;

export function documentName(t: Translate, id: string): string {
  return t(`items.${id}`);
}

/** "ready", "draft", "needs: the DPIA module", "not in DPO Central yet". */
export function documentStateText(t: Translate, status: DocumentStatus): string {
  if (status.state === "needsInput") return t("needs", { input: t(`inputs.${status.input}`) });
  return t(`state.${status.state}`);
}

/** The gaps of a draft, in words: "7 records to confirm; 2 records miss a required field". */
export function gapsText(t: Translate, gaps: readonly DocumentGap[]): string {
  return gaps.map((g) => t(`gaps.${g.key}`, { count: g.count })).join("; ");
}

const COUNT_KEY: Record<CountedStepId, string> = {
  dataInventory: "assets",
  ropa: "activities",
  vendors: "vendors",
};

/**
 * The counts of a step's records, stated precisely: "1 confirmed, 2 in draft",
 * with "1 with missing details" added for confirmed records that miss a
 * required field. Null when there is nothing to state (no record, or, with
 * `onlyIfDrafts`, nothing waiting).
 */
export function recordCountsText(
  t: Translate,
  stepId: CountedStepId,
  counts: RecordCounts,
  options: { onlyIfDrafts?: boolean } = {},
): string | null {
  const key = COUNT_KEY[stepId];
  const waiting = counts.drafts > 0 || counts.incomplete > 0;
  if (counts.confirmed + counts.drafts === 0) return null;
  if (!waiting && options.onlyIfDrafts) return null;
  const parts = [t(`counts.${key}.confirmed`, { count: counts.confirmed })];
  if (counts.drafts > 0) parts.push(t(`counts.${key}.draft`, { count: counts.drafts }));
  if (counts.incomplete > 0) parts.push(t(`counts.${key}.incomplete`, { count: counts.incomplete }));
  return parts.join(", ");
}

/**
 * The quiet line under a menu step: "Vendor register · draft; DPA with a vendor · needs: ...".
 * With `counts`, the register of a counted step states its numbers instead of
 * the word "draft" (the tick and the figure are unchanged).
 */
export function stepNoteText(
  t: Translate,
  rows: readonly RegisterRow[],
  counts?: Partial<Record<CountedStepId, RecordCounts>>,
): string {
  return rows
    .map((row) => {
      const stepId = row.entry.stepId as CountedStepId | null;
      const stepCounts = stepId && COUNTED_REGISTERS[stepId] === row.entry.id ? counts?.[stepId] : undefined;
      const stated =
        row.doc.status.state === "draft" && stepId && stepCounts ? recordCountsText(t, stepId, stepCounts) : null;
      return `${documentName(t, row.entry.id)} · ${stated ?? documentStateText(t, row.doc.status)}`;
    })
    .join("; ");
}

/** The register document whose state word the counts replace, per counted step. */
const COUNTED_REGISTERS: Partial<Record<string, string>> = { ropa: "ropa", vendors: "vendorRegister" };
