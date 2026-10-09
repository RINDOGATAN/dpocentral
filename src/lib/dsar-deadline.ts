// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Rights-request (DSAR) deadline arithmetic.
 *
 * Some laws state the answer period in days (CCPA/CPRA: 45 days, extendable
 * by 45; LGPD: 15 days), others in months (GDPR art. 12(3): one month from
 * receipt, extendable by two further months). A month is not 30 days, so a
 * period carries its unit and is added to a date with the matching
 * arithmetic.
 *
 * Month arithmetic follows Regulation (EEC, Euratom) No 1182/71, art. 3(2)(c):
 * the period ends on the same day number in the target month; when that day
 * does not exist there, it ends on the last day of that month
 * (31 January + 1 month = 28 February, or 29 February in a leap year).
 *
 * Pure functions only: no database, no server imports, safe in the browser.
 */

import { addDays, addMonths } from "date-fns";

export type DeadlineUnit = "days" | "months";

export interface DeadlinePeriod {
  amount: number;
  unit: DeadlineUnit;
}

export interface DsarDeadlineRule {
  /** Period to answer, counted from receipt. */
  deadline: DeadlinePeriod;
  /** Further period the law allows, or null when it allows none. */
  extension: DeadlinePeriod | null;
}

/** Add a period to a date (calendar months clamp to the end of the month). */
export function addPeriod(date: Date, period: DeadlinePeriod): Date {
  return period.unit === "months"
    ? addMonths(date, period.amount)
    : addDays(date, period.amount);
}

/** Due date of a request received at `receivedAt` under `rule`. */
export function dsarDueDate(receivedAt: Date, rule: DsarDeadlineRule): Date {
  return addPeriod(receivedAt, rule.deadline);
}

/**
 * Due date once the law's extension is applied, counted from receipt
 * (GDPR: one month + two further months = three months from receipt, so
 * 31 January runs to 30 April, not to 28 April). Never earlier than
 * `currentDueDate`, so a request whose stored due date predates this rule
 * cannot be shortened by an extension. Returns null when the law allows no
 * extension.
 */
export function dsarExtendedDueDate(
  receivedAt: Date,
  currentDueDate: Date,
  rule: DsarDeadlineRule
): Date | null {
  const ext = rule.extension;
  if (!ext || ext.amount <= 0) return null;
  const extended =
    ext.unit === rule.deadline.unit
      ? addPeriod(receivedAt, { amount: rule.deadline.amount + ext.amount, unit: ext.unit })
      : addPeriod(addPeriod(receivedAt, rule.deadline), ext);
  return extended.getTime() > currentDueDate.getTime() ? extended : currentDueDate;
}

/**
 * The most restrictive of several rules for the same request: the one whose
 * due date comes first, compared as dates (one month and 30 days are not the
 * same period). Ties keep the earlier rule in the list. Returns null for an
 * empty list.
 */
export function earliestDsarDeadline<R extends DsarDeadlineRule>(
  receivedAt: Date,
  rules: readonly R[]
): { rule: R; dueDate: Date; index: number } | null {
  let best: { rule: R; dueDate: Date; index: number } | null = null;
  rules.forEach((rule, index) => {
    const dueDate = dsarDueDate(receivedAt, rule);
    if (!best || dueDate.getTime() < best.dueDate.getTime()) {
      best = { rule, dueDate, index };
    }
  });
  return best;
}

/** Whole days left until `dueDate` (negative once overdue), rounded up. */
export function daysUntilDue(dueDate: Date, now: Date = new Date()): number {
  return Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/** Days-left thresholds at which a request is flagged as due soon. */
export const DSAR_REMINDER_DAYS = [7, 3, 1] as const;

/** SLA status from the actual due date (at risk within 7 days). */
export function dsarSlaStatus(
  dueDate: Date,
  now: Date = new Date()
): "on_track" | "at_risk" | "overdue" {
  const days = daysUntilDue(dueDate, now);
  if (days < 0) return "overdue";
  if (days <= DSAR_REMINDER_DAYS[0]) return "at_risk";
  return "on_track";
}

/**
 * The reminder threshold (7, 3 or 1 days) a request has reached, or null
 * when it is further away or already overdue. Works on the due date itself,
 * so a month-based deadline reminds on the right calendar day.
 */
export function dsarReminderThreshold(
  dueDate: Date,
  now: Date = new Date()
): (typeof DSAR_REMINDER_DAYS)[number] | null {
  const days = daysUntilDue(dueDate, now);
  if (days < 0) return null;
  let hit: (typeof DSAR_REMINDER_DAYS)[number] | null = null;
  for (const t of DSAR_REMINDER_DAYS) if (days <= t) hit = t;
  return hit;
}

/** The reminder e-mails the daily job can send for one due date. */
export type DsarReminderKind = "DAYS_7" | "DAYS_3" | "DAYS_1" | "OVERDUE";

/**
 * The reminder a request is due for today: the threshold it has reached
 * (7, 3 or 1 days left), or OVERDUE once the due date has passed; null when
 * it is further away. Only the threshold reached now is returned, so a job
 * that missed a day sends the nearer reminder, not every skipped one.
 */
export function dsarReminderKind(dueDate: Date, now: Date = new Date()): DsarReminderKind | null {
  if (daysUntilDue(dueDate, now) < 0) return "OVERDUE";
  const t = dsarReminderThreshold(dueDate, now);
  return t === null ? null : (`DAYS_${t}` as DsarReminderKind);
}

/** Statuses after which a request needs no reminder and no extension. */
export const DSAR_CLOSED_STATUSES = ["COMPLETED", "REJECTED", "CANCELLED"] as const;

export function isDsarClosed(status: string): boolean {
  return (DSAR_CLOSED_STATUSES as readonly string[]).includes(status);
}

export type DsarExtensionState =
  | { allowed: true; newDueDate: Date; tellBy: Date }
  | { allowed: false; reason: "closed" | "no_extension" | "already_extended" };

/**
 * Whether the law's own extension can be applied to a request, and to what
 * date. Refused when the request is closed, when the law allows none
 * (LGPD, for example), or when the request was already extended. `tellBy`
 * is the current due date: the person must be told of the extension, with
 * the reasons, within the first period (GDPR art. 12(3); CCPA: within the
 * first 45 days).
 */
export function dsarExtensionState(
  request: { status: string; receivedAt: Date; dueDate: Date; extendedDueDate: Date | null },
  rule: DsarDeadlineRule
): DsarExtensionState {
  if (isDsarClosed(request.status)) return { allowed: false, reason: "closed" };
  if (!rule.extension || rule.extension.amount <= 0) return { allowed: false, reason: "no_extension" };
  if (request.extendedDueDate) return { allowed: false, reason: "already_extended" };
  const extended = dsarExtendedDueDate(request.receivedAt, request.dueDate, rule);
  if (!extended || extended.getTime() <= request.dueDate.getTime()) {
    return { allowed: false, reason: "already_extended" };
  }
  return { allowed: true, newDueDate: extended, tellBy: request.dueDate };
}
