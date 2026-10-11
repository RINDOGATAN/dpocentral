// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The rights-request (DSAR) module on the hosted service, per organisation
 * (owner's decisions of 11 October 2026).
 *
 *  - Self-hosted kit: unchanged. The module is open and never limited.
 *  - Hosted, pilot organisation (plan PILOT): the module is open, with at most
 *    PILOT_PUBLIC_REQUEST_CAP requests through the public form, in total.
 *  - Hosted, paid organisation (plan EU_CLOUD): the module is an add-on. With
 *    `dsarModuleStatus` ACTIVE it is open, with at most
 *    PAID_PUBLIC_REQUESTS_PER_MONTH requests through the public form per
 *    calendar month (Europe/Madrid). Otherwise ("inactive") no new request can
 *    be created (the public form and status pages show a neutral "not
 *    available" page, staff cannot add one) and every request already held
 *    stays readable and workable by staff: data already held is never hidden.
 *
 * Only requests that came through the public form count. Requests entered by
 * staff never do. Each public-form request writes one organisation audit-log
 * entry (action DSAR_PUBLIC_SUBMISSION, no personal data), which survives the
 * request's deletion or redaction, so deleting a request never frees a place.
 * Requests received before that entry existed are counted from their own
 * trail (REQUEST_SUBMITTED_PUBLIC); the larger of the two counts wins.
 *
 * At the limit, the public form shows the organisation's privacy contact
 * e-mail (DSARIntakeForm.privacyContactEmail) instead of accepting, or a
 * neutral line asking the person to contact the organisation directly.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import { isHostedDeployment } from "@/lib/hosted";
import { isPaidPlan, type PlanOrg } from "@/server/services/pilot/caps";

/** Public-form requests a pilot organisation may receive, in total. */
export const PILOT_PUBLIC_REQUEST_CAP = 3;
/** Public-form requests an organisation with the add-on may receive per calendar month. */
export const PAID_PUBLIC_REQUESTS_PER_MONTH = 10;
/** The time zone of the calendar month. */
export const DSAR_MONTH_TIME_ZONE = "Europe/Madrid";

/** The add-on's price as the menu states it: euros in Spanish, US dollars in English. */
export const DSAR_ADDON_PRICE_LINE = {
  en: "Available as an add-on: $49 a month",
  es: "Disponible como complemento: 49 € al mes",
} as const;

/** The organisation audit-log action of a request received through the public form. */
export const DSAR_PUBLIC_SUBMISSION = "DSAR_PUBLIC_SUBMISSION";

export const DSAR_MODULE_STATUSES = ["NONE", "ACTIVE", "CANCELLED"] as const;
export type DsarModuleStatusValue = (typeof DSAR_MODULE_STATUSES)[number];

export type DsarModuleOrg = PlanOrg & { dsarModuleStatus?: string | null };

/**
 *  - "open":     the kit; no limit.
 *  - "pilot":    hosted pilot; 3 public-form requests in total.
 *  - "active":   hosted paid plan with the add-on; 10 per calendar month.
 *  - "inactive": hosted paid plan without the add-on; no new requests.
 */
export type DsarModuleGate = "open" | "pilot" | "active" | "inactive";

export function dsarModuleGate(
  org: DsarModuleOrg,
  hosted: boolean = isHostedDeployment()
): DsarModuleGate {
  if (!hosted) return "open";
  if (!isPaidPlan(org)) return "pilot";
  return org.dsarModuleStatus === "ACTIVE" ? "active" : "inactive";
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
  | { gate: "inactive" }
  | {
      gate: "pilot" | "active";
      limit: number;
      used: number;
      remaining: number;
      /** "total" for the pilot; "month" with the add-on (the window's end is when it starts again). */
      period: "total" | "month";
      resetsAt: Date | null;
    };

/** The organisation's module state and, where limited, how many public-form requests are left. */
export async function getDsarModuleAccess(
  db: PublicRequestCountDb,
  org: { id: string } & DsarModuleOrg,
  now: Date = new Date(),
  hosted: boolean = isHostedDeployment()
): Promise<DsarModuleAccess> {
  const gate = dsarModuleGate(org, hosted);
  if (gate === "open" || gate === "inactive") return { gate };
  if (gate === "pilot") {
    const used = await countPublicFormRequests(db, org.id);
    const limit = PILOT_PUBLIC_REQUEST_CAP;
    return { gate, limit, used, remaining: Math.max(0, limit - used), period: "total", resetsAt: null };
  }
  const window = madridMonthWindow(now);
  const used = await countPublicFormRequests(db, org.id, window);
  const limit = PAID_PUBLIC_REQUESTS_PER_MONTH;
  return { gate, limit, used, remaining: Math.max(0, limit - used), period: "month", resetsAt: window.end };
}

/** True when the public form may take one more request. */
export function acceptsPublicRequest(access: DsarModuleAccess): boolean {
  if (access.gate === "open") return true;
  if (access.gate === "inactive") return false;
  return access.remaining > 0;
}

// ── Messages (English at the throw site; the formatter localises them) ──

export const DSAR_MODULE_MESSAGES = {
  /** A staff member adds a request while the add-on is not active. */
  inactiveCreate:
    "The rights-request module is not active for this organization. It is available as an add-on; the requests already held stay available.",
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
