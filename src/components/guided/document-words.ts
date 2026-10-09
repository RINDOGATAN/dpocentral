// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The words for a document of the register (src/config/document-register.ts),
 * in one place for the dashboard panel and the menu lines: the same name and
 * the same state word wherever a document is shown. Keys under
 * `documentRegister`.
 */

import type { DocumentGap, DocumentStatus } from "@/config/document-register";
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

/** The quiet line under a menu step: "Vendor register · draft; DPA with a vendor · needs: ...". */
export function stepNoteText(t: Translate, rows: readonly RegisterRow[]): string {
  return rows
    .map((row) => `${documentName(t, row.entry.id)} · ${documentStateText(t, row.doc.status)}`)
    .join("; ");
}
