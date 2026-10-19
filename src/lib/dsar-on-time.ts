// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The one on-time measure for rights requests (DSARs), read by every report
 * that prints one (the rights-request performance report, the programme
 * report, the regulatory landscape and the board report), so they cannot
 * disagree for the same data.
 *
 *   on-time rate = completed by the deadline
 *                  / (completed by the deadline + completed late + open and overdue)
 *
 * The deadline is the extended one where it was extended. An open request past
 * its deadline counts against the rate: it is never "on time". Rejected and
 * cancelled requests, and open requests still within their deadline, are not
 * measured. With nothing to measure the rate is null and the reports print
 * "N/A" ("N/D"), never 100 %.
 *
 * Pure; tested in tests/dsar-on-time.test.ts.
 */

export const CLOSED_DSAR_STATUSES = ["COMPLETED", "REJECTED", "CANCELLED"] as const;

export interface DsarTimingRow {
  status: string;
  dueDate: Date | null;
  extendedDueDate?: Date | null;
  completedAt?: Date | null;
  /** Used for a completed request with no completion date recorded. */
  updatedAt?: Date | null;
}

export interface DsarOnTime {
  completedOnTime: number;
  completedLate: number;
  openOverdue: number;
  openInTime: number;
  /** Rejected or cancelled. */
  closedOther: number;
  /** completedOnTime + completedLate + openOverdue */
  measured: number;
  /** 0 to 100, or null when nothing can be measured. */
  rate: number | null;
}

/** The deadline that applies: the extended one where there is one. */
export function dsarDeadline(row: Pick<DsarTimingRow, "dueDate" | "extendedDueDate">): Date | null {
  return row.extendedDueDate ?? row.dueDate ?? null;
}

export function dsarOnTime(rows: readonly DsarTimingRow[], now: Date = new Date()): DsarOnTime {
  const out = { completedOnTime: 0, completedLate: 0, openOverdue: 0, openInTime: 0, closedOther: 0 };
  for (const r of rows) {
    const due = dsarDeadline(r);
    if (r.status === "COMPLETED") {
      const done = r.completedAt ?? r.updatedAt ?? null;
      if (due && done && done.getTime() > due.getTime()) out.completedLate++;
      else out.completedOnTime++;
    } else if (r.status === "REJECTED" || r.status === "CANCELLED") {
      out.closedOther++;
    } else if (due && due.getTime() < now.getTime()) {
      out.openOverdue++;
    } else {
      out.openInTime++;
    }
  }
  const measured = out.completedOnTime + out.completedLate + out.openOverdue;
  return { ...out, measured, rate: measured > 0 ? Math.round((out.completedOnTime / measured) * 100) : null };
}
