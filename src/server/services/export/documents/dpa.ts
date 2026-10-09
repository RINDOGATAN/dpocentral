// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * A generated DPA, and its standalone TIA where one applies, re-rendered from
 * the fact snapshot stored on the vendor contract (`metadata.dpaEngine`), so
 * nothing binary is persisted. Used by /api/export/dpa/[id] and the document
 * pack. See ./context.ts.
 */

import { renderDpaPdf, renderTiaPdf } from "@/server/services/export/dpa/render";
import { dpaSnapshotSchema } from "@/lib/dpa-engine/snapshot";
import type { AssembleInput } from "@/lib/dpa-engine";
import { PDF, type ExportFile } from "./context";

export interface DpaContractForExport {
  metadata: unknown;
  vendor: { name: string };
}

/** The snapshot's assembly input, or null when the contract has none. */
export function dpaInput(contract: DpaContractForExport): { input: AssembleInput; effectiveDate: string } | null {
  const stored = (contract.metadata as { dpaEngine?: unknown } | null)?.dpaEngine;
  const parsed = dpaSnapshotSchema.safeParse(stored);
  if (!parsed.success) return null;
  const snapshot = parsed.data;
  return {
    effectiveDate: snapshot.effectiveDate.slice(0, 10),
    input: {
      facts: snapshot.facts,
      selections: snapshot.selections,
      context: {
        language: snapshot.language,
        effectiveDate: new Date(snapshot.effectiveDate),
        governingLaw: snapshot.governingLaw,
        controller: snapshot.controller,
        processor: snapshot.processor,
        dealName: snapshot.dealName ?? undefined,
        producedDate: new Date(snapshot.producedAt),
      },
    },
  };
}

/**
 * One document of the contract: the DPA, or the standalone TIA. Null when the
 * contract has no snapshot, or when no standalone TIA applies.
 */
export async function buildDpaExport(
  contract: DpaContractForExport,
  orgName: string,
  doc: "dpa" | "tia",
): Promise<(ExportFile & { effectiveDate: string }) | null> {
  const prepared = dpaInput(contract);
  if (!prepared) return null;
  const rendered =
    doc === "tia" ? await renderTiaPdf(prepared.input, orgName) : await renderDpaPdf(prepared.input, orgName);
  if (!rendered) return null;
  const slug = contract.vendor.name.replace(/[^a-zA-Z0-9]+/g, "-");
  return {
    data: new Uint8Array(rendered.buffer),
    filename: `${doc === "tia" ? "TIA" : "DPA"}-${slug}-${prepared.effectiveDate}.pdf`,
    contentType: PDF,
    effectiveDate: prepared.effectiveDate,
  };
}
