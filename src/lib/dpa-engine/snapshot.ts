// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The fact snapshot stored on a generated DPA's VendorContract
 * (`metadata.dpaEngine`). One schema shared by the writer
 * (vendor.generateDpa) and the reader (GET /api/export/dpa/[id]) so the
 * two can never drift apart silently.
 */

import { z } from "zod";

export const dpaSnapshotPartySchema = z.object({
  name: z.string().optional(),
  address: z.string().optional(),
  taxId: z.string().optional(),
  signatoryName: z.string().optional(),
  signatoryTitle: z.string().optional(),
});

export const dpaSnapshotSchema = z.object({
  version: z.number(),
  language: z.enum(["en", "es"]),
  governingLaw: z.enum(["CALIFORNIA", "ENGLAND_WALES", "SPAIN"]),
  facts: z.record(z.string(), z.string()),
  selections: z.record(z.string(), z.string()),
  controller: dpaSnapshotPartySchema,
  processor: dpaSnapshotPartySchema,
  dealName: z.string().nullable(),
  effectiveDate: z.string(),
  producedAt: z.string(),
});

/** What the download route needs; the writer stores a superset (warnings,
 *  obligations, requestId, …) that the reader ignores. */
export type DpaSnapshot = z.infer<typeof dpaSnapshotSchema>;

import type { DerivedObligation } from "./obligations";

/** The full object vendor.generateDpa writes to metadata.dpaEngine. */
export interface DpaSnapshotStored extends DpaSnapshot {
  confirmedIssues: string[];
  requestId: string | null;
  warnings: string[];
  tiaIncluded: boolean;
  obligations: DerivedObligation[];
}
