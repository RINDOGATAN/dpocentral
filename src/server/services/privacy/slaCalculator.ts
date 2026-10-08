// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { differenceInDays, differenceInHours } from "date-fns";
import { JURISDICTION_CORE_DATA, JURISDICTION_CORE_BY_CODE } from "@/config/jurisdiction-data";
import { JURISDICTION_CATALOG } from "@/config/jurisdiction-catalog";
import { dsarDueDate, type DsarDeadlineRule } from "@/lib/dsar-deadline";

export interface SLAResult {
  dueDate: Date;
  daysRemaining: number;
  isOverdue: boolean;
  isAtRisk: boolean; // Within 7 days
  status: "on_track" | "at_risk" | "overdue";
}

/** GDPR's rule, used when an organisation has no jurisdiction set. */
export const DEFAULT_DSAR_RULE: DsarDeadlineRule = {
  deadline: { amount: 1, unit: "months" },
  extension: { amount: 2, unit: "months" },
};

/**
 * The answer period and extension a framework's law gives, in the unit the
 * law uses. Months come from dsarDeadlineMonths / dsarExtensionMonths in the
 * shared jurisdiction data or the catalog; every other framework keeps its
 * days, taking `storedDays` (the Jurisdiction row's dsarDeadlineDays) first
 * as before. No code and no stored days fall back to the GDPR rule.
 */
export function dsarDeadlineRuleFor(
  code: string | null | undefined,
  storedDays?: number | null
): DsarDeadlineRule {
  if (!code) {
    return storedDays != null
      ? { deadline: { amount: storedDays, unit: "days" }, extension: null }
      : DEFAULT_DSAR_RULE;
  }
  const core = JURISDICTION_CORE_BY_CODE[code];
  const cat = JURISDICTION_CATALOG.find((j) => j.code === code);
  const months = core?.dsarDeadlineMonths ?? cat?.dsarDeadlineMonths;
  // Days: the stored row wins, as before this rule existed.
  const days = storedDays ?? core?.dsarDeadlineDays ?? cat?.dsarDeadlineDays;
  if (months == null && days == null) return DEFAULT_DSAR_RULE;
  const extMonths = core?.dsarExtensionMonths ?? cat?.dsarExtensionMonths;
  const extDays = core?.dsarExtensionDays;
  return {
    deadline: months != null ? { amount: months, unit: "months" } : { amount: days!, unit: "days" },
    extension:
      extMonths != null && extMonths > 0
        ? { amount: extMonths, unit: "months" }
        : extDays != null && extDays > 0
          ? { amount: extDays, unit: "days" }
          : null,
  };
}

/** Months of the framework's answer period when its law states months, else null. */
export function dsarDeadlineMonths(
  code: string | null | undefined,
  storedDays?: number | null
): number | null {
  const d = dsarDeadlineRuleFor(code, storedDays).deadline;
  return d.unit === "months" ? d.amount : null;
}

/**
 * Calculate DSAR due date under a framework's rule (calendar months where
 * the law says months, days otherwise).
 */
export function calculateDSARDueDate(
  receivedAt: Date,
  rule: DsarDeadlineRule
): Date {
  return dsarDueDate(receivedAt, rule);
}

/**
 * Calculate SLA status for a DSAR request
 */
export function calculateDSARSLA(dueDate: Date): SLAResult {
  const now = new Date();
  const daysRemaining = differenceInDays(dueDate, now);
  const isOverdue = daysRemaining < 0;
  const isAtRisk = !isOverdue && daysRemaining <= 7;

  let status: "on_track" | "at_risk" | "overdue";
  if (isOverdue) {
    status = "overdue";
  } else if (isAtRisk) {
    status = "at_risk";
  } else {
    status = "on_track";
  }

  return {
    dueDate,
    daysRemaining,
    isOverdue,
    isAtRisk,
    status,
  };
}

/**
 * Jurisdiction-specific DSAR deadlines (days), derived from the shared
 * source of truth in src/config/jurisdiction-data.ts. Day figures only: for
 * a law stated in months use dsarDeadlineRuleFor() to compute due dates.
 */
export const JURISDICTION_DEADLINES: Record<string, number> = Object.fromEntries(
  JURISDICTION_CORE_DATA.map((j) => [j.code, j.dsarDeadlineDays])
);

/**
 * Jurisdiction-specific breach notification deadlines (hours), derived from
 * the shared source of truth in src/config/jurisdiction-data.ts.
 * 0 = no fixed statutory clock ("without undue delay" regimes).
 * Note: LGPD is 3 business days per ANPD Res. 15/2024 (72h approximation —
 * the legal clock runs in business days).
 */
export const BREACH_NOTIFICATION_DEADLINES: Record<string, number> = Object.fromEntries(
  JURISDICTION_CORE_DATA.map((j) => [j.code, j.breachNotificationHours])
);

/**
 * Calculate breach notification deadline
 */
export function calculateBreachNotificationDeadline(
  discoveredAt: Date,
  jurisdictionCode: string
): Date | null {
  const hours = BREACH_NOTIFICATION_DEADLINES[jurisdictionCode];
  if (hours === undefined || hours === 0) {
    return null; // No specific deadline
  }
  return new Date(discoveredAt.getTime() + hours * 60 * 60 * 1000);
}

/**
 * Check if breach notification is overdue
 */
export function isBreachNotificationOverdue(
  discoveredAt: Date,
  jurisdictionCode: string
): boolean {
  const deadline = calculateBreachNotificationDeadline(discoveredAt, jurisdictionCode);
  if (!deadline) return false;
  return new Date() > deadline;
}

/**
 * Get hours remaining for breach notification
 */
export function getBreachNotificationHoursRemaining(
  discoveredAt: Date,
  jurisdictionCode: string
): number | null {
  const deadline = calculateBreachNotificationDeadline(discoveredAt, jurisdictionCode);
  if (!deadline) return null;
  return differenceInHours(deadline, new Date());
}
