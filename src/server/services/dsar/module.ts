// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The rights-request (DSAR) module on the hosted service, per organisation.
 *
 *  - Self-hosted kit: unchanged. The module is open and never limited.
 *  - Hosted, every organisation (pilot or paid plan): the module is open and
 *    works fully. One ceiling guards our costs against floods: at most
 *    STANDARD_PUBLIC_REQUESTS_PER_MONTH requests through the public form per
 *    calendar month (Europe/Madrid), or UPGRADED_PUBLIC_REQUESTS_PER_MONTH
 *    with the volume upgrade (`dsarModuleStatus` ACTIVE, set by its payment
 *    through src/server/services/dsar/volume-sync.ts, or by the operator's
 *    script scripts/set-dsar-module.ts for a correction).
 *
 * Only requests that came through the public form count. Requests entered by
 * staff never do. Each public-form request writes one organisation audit-log
 * entry (action DSAR_PUBLIC_SUBMISSION, no personal data), which survives the
 * request's deletion or redaction, so deleting a request never frees a place.
 * Requests received before that entry existed are counted from their own
 * trail (REQUEST_SUBMITTED_PUBLIC); the larger of the two counts wins.
 *
 * Nobody sees a counter under normal use. At 50, 75 and 90 per cent of the
 * month's ceiling, and at the ceiling, the organisation's owners and
 * administrators are told once each per month
 * (src/server/services/dsar/volume-notices.ts); from 50 per cent a one-line
 * note on the module's pages says the same. At the ceiling the public form
 * shows the organisation's privacy contact e-mail
 * (DSARIntakeForm.privacyContactEmail) instead of accepting, or a neutral
 * line asking the person to contact the organisation directly, and our own
 * inbox is told.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import { isHostedDeployment } from "@/lib/hosted";

import { STANDARD_PUBLIC_REQUESTS_PER_MONTH, UPGRADED_PUBLIC_REQUESTS_PER_MONTH } from "@/lib/dsar-addon";

/** The monthly ceilings (100, and 1,000 with the volume upgrade): src/lib/dsar-addon.ts. */
export { STANDARD_PUBLIC_REQUESTS_PER_MONTH, UPGRADED_PUBLIC_REQUESTS_PER_MONTH };
/** The shares of the month's ceiling, in per cent, at which the owners are told. */
export const VOLUME_WARNING_PERCENTS = [50, 75, 90] as const;
/** The time zone of the calendar month. */
export const DSAR_MONTH_TIME_ZONE = "Europe/Madrid";

/** The volume upgrade's monthly price; the messages take it as {price}. */
export { DSAR_VOLUME_UPGRADE_MONTHLY_PRICE } from "@/lib/dsar-addon";

/** The organisation audit-log action of a request received through the public form. */
export const DSAR_PUBLIC_SUBMISSION = "DSAR_PUBLIC_SUBMISSION";

export const DSAR_MODULE_STATUSES = ["NONE", "ACTIVE", "CANCELLED"] as const;
export type DsarModuleStatusValue = (typeof DSAR_MODULE_STATUSES)[number];

export type DsarModuleOrg = { dsarModuleStatus?: string | null };

/**
 *  - "open":     the kit; no limit.
 *  - "standard": hosted; 100 public-form requests per calendar month.
 *  - "upgraded": hosted with the volume upgrade; 1,000 per calendar month.
 */
export type DsarModuleGate = "open" | "standard" | "upgraded";

export function dsarModuleGate(
  org: DsarModuleOrg,
  hosted: boolean = isHostedDeployment()
): DsarModuleGate {
  if (!hosted) return "open";
  return org.dsarModuleStatus === "ACTIVE" ? "upgraded" : "standard";
}

/** The month's ceiling of a limited gate. */
export function monthlyCeiling(gate: "standard" | "upgraded"): number {
  return gate === "upgraded" ? UPGRADED_PUBLIC_REQUESTS_PER_MONTH : STANDARD_PUBLIC_REQUESTS_PER_MONTH;
}

/** The request counts at which the owners are told: 50, 75 and 90 per cent of `limit`. */
export function warningThresholds(limit: number): number[] {
  return VOLUME_WARNING_PERCENTS.map((pct) => Math.ceil((limit * pct) / 100));
}

export type VolumeWarningPercent = 0 | 50 | 75 | 90 | 100;

/** The highest warning step `used` has reached: 100 at the ceiling, 0 below the first. */
export function warningPercentOf(used: number, limit: number): VolumeWarningPercent {
  if (used >= limit) return 100;
  const thresholds = warningThresholds(limit);
  let reached: VolumeWarningPercent = 0;
  VOLUME_WARNING_PERCENTS.forEach((pct, i) => {
    if (used >= thresholds[i]!) reached = pct;
  });
  return reached;
}

// ── The calendar month in Madrid ─────────────────────────────────────────

/** Offset of `zone` from UTC at `instant`, in milliseconds. */
function zoneOffsetMs(instant: Date, zone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Midnight at the start of day 1 of (year, month) in `zone`, as an instant. */
function zonedMonthStart(year: number, month: number, zone: string): Date {
  const guess = Date.UTC(year, month, 1);
  // Two passes settle the offset (it differs on either side of a change).
  let start = guess - zoneOffsetMs(new Date(guess), zone);
  start = guess - zoneOffsetMs(new Date(start), zone);
  return new Date(start);
}

/** The calendar month (Europe/Madrid) that contains `now`: [start, end). */
export function madridMonthWindow(now: Date): { start: Date; end: Date } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: DSAR_MONTH_TIME_ZONE,
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value) - 1;
  return {
    start: zonedMonthStart(year, month, DSAR_MONTH_TIME_ZONE),
    end: zonedMonthStart(month === 11 ? year + 1 : year, (month + 1) % 12, DSAR_MONTH_TIME_ZONE),
  };
}

// ── Counting public-form requests ────────────────────────────────────────

type CountDelegate = { count: (args: { where: object }) => Promise<number> };
export type PublicRequestCountDb = { auditLog: CountDelegate; dSARRequest: CountDelegate };

/** Public-form requests received by the organisation, in the window when one is given. */
export async function countPublicFormRequests(
  db: PublicRequestCountDb,
  organizationId: string,
  window?: { start: Date; end: Date }
): Promise<number> {
  const createdAt = window ? { gte: window.start, lt: window.end } : undefined;
  const [logged, held] = await Promise.all([
    db.auditLog.count({
      where: { organizationId, action: DSAR_PUBLIC_SUBMISSION, ...(createdAt && { createdAt }) },
    }),
    db.dSARRequest.count({
      where: {
        organizationId,
        auditLog: { some: { action: "REQUEST_SUBMITTED_PUBLIC" } },
        ...(createdAt && { receivedAt: createdAt }),
      },
    }),
  ]);
  return Math.max(logged, held);
}

export type DsarModuleAccess =
  | { gate: "open" }
  | {
      gate: "standard" | "upgraded";
      limit: number;
      used: number;
      remaining: number;
      /** When the count starts again: the start of the next calendar month (Madrid). */
      resetsAt: Date;
      /** The highest warning step reached this month (see warningPercentOf). */
      warningPercent: VolumeWarningPercent;
    };

/** The organisation's module state and, on the hosted service, this month's public-form count. */
export async function getDsarModuleAccess(
  db: PublicRequestCountDb,
  org: { id: string } & DsarModuleOrg,
  now: Date = new Date(),
  hosted: boolean = isHostedDeployment()
): Promise<DsarModuleAccess> {
  const gate = dsarModuleGate(org, hosted);
  if (gate === "open") return { gate };
  const window = madridMonthWindow(now);
  const used = await countPublicFormRequests(db, org.id, window);
  const limit = monthlyCeiling(gate);
  return {
    gate,
    limit,
    used,
    remaining: Math.max(0, limit - used),
    resetsAt: window.end,
    warningPercent: warningPercentOf(used, limit),
  };
}

/** True when the public form may take one more request. */
export function acceptsPublicRequest(access: DsarModuleAccess): boolean {
  if (access.gate === "open") return true;
  return access.remaining > 0;
}

// ── Messages (English at the throw site; the formatter localises them) ──

export const DSAR_MODULE_MESSAGES = {
  /** The public form is at its limit. */
  formClosed: "This form is not taking requests at the moment. Please contact the organization directly.",
} as const;

// ── Retention on the hosted service ──────────────────────────────────────

/** Days after closing before a closed request's personal data is removed, on the hosted service (fixed). */
export const HOSTED_RETENTION_DAYS = 30;
/** Days without activity after which an open request is deleted, on the hosted service. */
export const INACTIVE_DELETE_DAYS = 30;
/** Days before that deletion when the organisation's owners and administrators are told. */
export const INACTIVE_NOTICE_DAYS_BEFORE = 7;

/**
 * Retention after closing: fixed on the hosted service, the form's setting
 * (1 to 3650 days, default 90) on the kit.
 */
export function effectiveRetentionDays(
  formRetentionDays: number | null | undefined,
  hosted: boolean = isHostedDeployment()
): number {
  if (hosted) return HOSTED_RETENTION_DAYS;
  return formRetentionDays ?? 90;
}
