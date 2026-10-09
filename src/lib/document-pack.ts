// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Which documents go into the document pack, and which stay out and why
 * (owner's decisions, 9 October 2026, step 5: one click on the dashboard's
 * documents panel gives one ZIP of every document in the "ready" state, and,
 * as an option, the drafts too, marked as drafts in their file names).
 *
 * The states come from the one register (src/config/document-register.ts),
 * so the pack holds exactly what the panel calls ready. Pure: the dashboard
 * button counts with it and the server builds the archive with it.
 * Tested in tests/document-pack.test.ts.
 */

import type { DocumentEntry, DocumentGap, EvaluatedDocument } from "@/config/document-register";
import { documentEntry } from "@/config/document-register";

/** Why a document of the register is not in the pack. */
export type LeftOutReason =
  /** It is a draft and drafts were not asked for. */
  | "draftsNotRequested"
  /** It waits for an input (named by the register). */
  | "needsInput"
  /** DPO Central does not produce it yet. */
  | "notYet"
  /** It is shown on screen only (the breach notification draft). */
  | "screenOnly"
  /** This deployment does not include its export (a module not installed). */
  | "notEntitled"
  /** Its records belong to a module this member does not handle. */
  | "notForThisMember";

export interface PackDocument {
  entry: DocumentEntry;
  state: "ready" | "draft";
  /** A draft's gaps, as the register names them. */
  gaps: DocumentGap[];
}

export interface PackLeftOut {
  entry: DocumentEntry;
  reason: LeftOutReason;
  doc: EvaluatedDocument;
}

export interface PackPlan {
  include: PackDocument[];
  leftOut: PackLeftOut[];
}

export interface PackOptions {
  includeDrafts: boolean;
  /** The member handles rights requests (src/lib/dsar-access.ts). */
  dsarAllowed: boolean;
  /** Register ids whose export this deployment does not include. */
  notEntitled?: readonly string[];
}

/**
 * The register's documents split into the pack and the rest, in register
 * order. The DPIA is not packed on its own: approved DPIAs are assessments,
 * and the assessment reports carry them.
 */
export function planPack(documents: readonly EvaluatedDocument[], options: PackOptions): PackPlan {
  const include: PackDocument[] = [];
  const leftOut: PackLeftOut[] = [];
  for (const doc of documents) {
    const entry = documentEntry(doc.id);
    if (!entry) continue;
    const status = doc.status;
    const out = (reason: LeftOutReason) => leftOut.push({ entry, reason, doc });
    if (status.state === "notYet") out("notYet");
    else if (status.state === "needsInput") out("needsInput");
    else if (entry.module === "dsar" && !options.dsarAllowed) out("notForThisMember");
    else if (options.notEntitled?.includes(entry.id)) out("notEntitled");
    else if (status.state === "draft" && !options.includeDrafts) out("draftsNotRequested");
    else if (entry.formats.every((f) => f === "screen")) out("screenOnly");
    else if (entry.id === "dpia") continue;
    else include.push({ entry, state: status.state, gaps: status.state === "draft" ? status.gaps : [] });
  }
  return { include, leftOut };
}

/** How many documents a pack would hold, for the dashboard's button. */
export function packCounts(
  documents: readonly EvaluatedDocument[],
  options: Omit<PackOptions, "includeDrafts">,
): { ready: number; drafts: number } {
  const plan = planPack(documents, { ...options, includeDrafts: true });
  return {
    ready: plan.include.filter((d) => d.state === "ready").length,
    drafts: plan.include.filter((d) => d.state === "draft").length,
  };
}

/** A file name from any text: lower case, ASCII letters and digits, hyphens. */
export function fileSlug(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "item"
  );
}

/**
 * A file's name in the pack: its number, the draft mark when it is a draft
 * ("DRAFT" / "BORRADOR"), and the document's name in the reader's language.
 */
export function packFileName(args: {
  number: number;
  name: string;
  extension: string;
  draft: boolean;
  draftMark: string;
}): string {
  const prefix = String(args.number).padStart(2, "0");
  return `${prefix}-${args.draft ? `${args.draftMark}-` : ""}${fileSlug(args.name)}.${args.extension}`;
}
