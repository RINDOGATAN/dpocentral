import { addDays, differenceInDays, differenceInHours } from "date-fns";

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
 * Get jurisdiction-specific DSAR deadline
 */
export const JURISDICTION_DEADLINES: Record<string, number> = {
  GDPR: 30,
  CCPA: 45,
  CPRA: 45,
  LGPD: 15,
  PIPEDA: 30,
  POPIA: 30,
  "PDPA-SG": 30,
  APPI: 14,
};

/**
 * Get jurisdiction-specific breach notification deadline (hours)
 */
export const BREACH_NOTIFICATION_DEADLINES: Record<string, number> = {
  GDPR: 72,
  CCPA: 0, // "Without unreasonable delay"
  CPRA: 0,
  LGPD: 48,
  PIPEDA: 0, // "As soon as feasible"
  POPIA: 0,
  "PDPA-SG": 72,
  APPI: 72,
};

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
