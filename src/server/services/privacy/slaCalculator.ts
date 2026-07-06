import { addDays, differenceInDays, differenceInHours } from "date-fns";
import { JURISDICTION_CORE_DATA } from "@/config/jurisdiction-data";

export interface SLAResult {
  dueDate: Date;
  daysRemaining: number;
  isOverdue: boolean;
  isAtRisk: boolean; // Within 7 days
  status: "on_track" | "at_risk" | "overdue";
}

/**
 * Calculate DSAR due date based on jurisdiction deadline
 */
export function calculateDSARDueDate(
  receivedAt: Date,
  deadlineDays: number
): Date {
  return addDays(receivedAt, deadlineDays);
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
 * source of truth in src/config/jurisdiction-data.ts.
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
