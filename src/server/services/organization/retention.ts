// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Hosted service only: the deletions the Cloud Plan terms (clause 9) and the
 * data processing agreement (clause 13) promise, run once a day by
 * /api/cron/org-retention. The self-hosted kit is never touched.
 *
 *  A. The paid plan has ended. "When the Plan ends you have thirty (30) days
 *     to export it; afterwards we delete it." The end is the latest plan
 *     change of the organisation (PLAN_CHANGE, from EU_CLOUD to PILOT, written
 *     by the automatic upgrade and by the operator's script alike), while the
 *     organisation is still on the pilot. The owners and administrators are
 *     told once at once (deletion on the 30th day after the end, and never
 *     less than 7 days after the notice) and again 7 days before.
 *  B. A pilot organisation nobody has used for twelve months. "If no member
 *     of a Pilot organisation signs in for twelve (12) months, we delete the
 *     organisation and its data, after telling its administrators by e-mail
 *     at least thirty (30) days before; a sign-in during that period keeps
 *     it." Last use is the latest of: a member's last sign-in
 *     (User.lastSignInAt, recorded since 25 October 2026), any entry a member
 *     wrote in the organisation's audit trail, the start of the pilot and the
 *     organisation's creation. So the clock never starts before something the
 *     records prove, and any member's action keeps the organisation. The
 *     notice goes 30 days before the twelve months are up (never less than
 *     30 days before the deletion), and again 7 days before.
 *
 * A notice is an ORG_RETENTION_NOTICE entry in the organisation's trail, with
 * the rule, the date it is based on and the deletion date; it carries no
 * content. A notice counts only for the date it was based on: a new paid plan
 * or a member's sign-in makes it void, and nothing is deleted.
 *
 * No notice, no deletion: an organisation with no owner or administrator to
 * write to, or whose e-mails were all refused, is reported and kept.
 *
 * Switched off unless ORG_RETENTION_ENABLED is exactly "true". Off, the job
 * reads, works out what it would do, logs the counts and the organisation ids
 * (never a name), and writes and sends nothing.
 *
 * The deletion itself is deleteOrganizationCompletely (delete.ts), the same
 * path as the owner's and the platform administrator's.
 */

import { createTranslator } from "next-intl";
import type { OrganizationRole, Prisma } from "@prisma/client";
import { brand, emailFooterHtml } from "@/config/brand";
import { logger } from "@/lib/logger";
import { isHostedDeployment } from "@/lib/hosted";
import { pilotLocale } from "@/server/services/pilot/caps";
import { PLAN_CHANGE } from "@/server/services/pilot/plan";
import type { ReminderMailer } from "@/server/services/dsar/deadlineReminders";
import type { Locale } from "@/i18n/config";
import enMessages from "@/messages/en.json";
import esMessages from "@/messages/es.json";
import { deleteOrganizationCompletely, ORG_RETENTION_NOTICE, type DeleteOrgDb } from "./delete";

const BUNDLES = { en: enMessages, es: esMessages } as const;
const DATE_LOCALE: Record<Locale, string> = { en: "en-US", es: "es-ES" };
const DAY = 86_400_000;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
const later = (a: Date, b: Date) => (a.getTime() >= b.getTime() ? a : b);

/** Days after the end of the plan before deletion (terms clause 9). */
export const PLAN_ENDED_DELETE_DAYS = 30;
/** Days without use before a pilot organisation is deleted (DPA clause 13). */
export const PILOT_INACTIVE_DELETE_DAYS = 365;
/** The first notice of an inactive pilot, at least this long before deletion. */
export const PILOT_INACTIVE_NOTICE_DAYS = 30;
/** The last reminder, this long before deletion. */
export const REMINDER_DAYS_BEFORE = 7;
/** Who is told. */
export const RETENTION_NOTICE_ROLES: OrganizationRole[] = ["OWNER", "ADMIN"];

export type RetentionRule = "plan-ended" | "pilot-inactive";
type Step = "first" | "reminder";

export function retentionEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.ORG_RETENTION_ENABLED === "true";
}

type AuditRow = { organizationId: string | null; action: string; createdAt: Date; userId: string | null; changes: Prisma.JsonValue };

type OrgRow = {
  id: string;
  name: string;
  plan: string;
  createdAt: Date;
  pilotStartedAt: Date | null;
  members: { role: OrganizationRole; user: { email: string | null; locale: string | null; lastSignInAt: Date | null } }[];
};

export interface RetentionDb extends DeleteOrgDb {
  organization: { findMany: (args: object) => Promise<OrgRow[]> };
  auditLog: {
    findMany: (args: object) => Promise<AuditRow[]>;
    create: (args: { data: Prisma.AuditLogUncheckedCreateInput }) => Promise<unknown>;
  };
}

export type RetentionAction =
  | { organizationId: string; rule: RetentionRule; action: "notice" | "reminder"; deleteOn: string }
  | { organizationId: string; rule: RetentionRule; action: "delete" };

export interface RetentionSummary {
  skipped?: "not-hosted" | "email-not-configured";
  enabled: boolean;
  checked: number;
  planned: RetentionAction[];
  noticesSent: number;
  emails: number;
  deleted: number;
  noRecipients: number;
  errors: number;
}

type Notice = { rule: RetentionRule; step: Step; basis: string; deleteOn: string; at: Date };

function noticesOf(entries: AuditRow[]): Notice[] {
  const out: Notice[] = [];
  for (const e of entries) {
    if (e.action !== ORG_RETENTION_NOTICE) continue;
    const c = (e.changes ?? {}) as Partial<Notice>;
    if ((c.rule === "plan-ended" || c.rule === "pilot-inactive") && typeof c.basis === "string" && typeof c.deleteOn === "string") {
      out.push({ rule: c.rule, step: c.step === "reminder" ? "reminder" : "first", basis: c.basis, deleteOn: c.deleteOn, at: e.createdAt });
    }
  }
  return out;
}

/** When the paid plan ended, if the latest plan change was that end; else null. */
export function planEndedAt(entries: AuditRow[]): Date | null {
  const changes = entries
    .filter((e) => e.action === PLAN_CHANGE)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const latest = changes[0];
  if (!latest) return null;
  const c = (latest.changes ?? {}) as { before?: { plan?: string }; after?: { plan?: string } };
  return c.before?.plan === "EU_CLOUD" && c.after?.plan === "PILOT" ? latest.createdAt : null;
}

/** The organisation's last proven use (rule B). */
export function lastUseOf(org: OrgRow, entries: AuditRow[]): Date {
  const dates = [org.createdAt];
  if (org.pilotStartedAt) dates.push(org.pilotStartedAt);
  for (const m of org.members) if (m.user.lastSignInAt) dates.push(m.user.lastSignInAt);
  for (const e of entries) if (e.userId) dates.push(e.createdAt);
  return dates.reduce(later);
}

/** What the rules say to do today for one organisation, or null. */
export function decide(
  org: OrgRow,
  entries: AuditRow[],
  now: Date
): { rule: RetentionRule; basis: Date; step: Step | "delete"; deleteOn: Date } | null {
  if (org.plan !== "PILOT") return null;
  const notices = noticesOf(entries);

  const ended = planEndedAt(entries);
  let rule: RetentionRule;
  let basis: Date;
  let firstDue: Date;
  let earliestDelete: Date;
  let minNoticeDays: number;
  if (ended) {
    rule = "plan-ended";
    basis = ended;
    earliestDelete = addDays(ended, PLAN_ENDED_DELETE_DAYS);
    firstDue = ended;
    minNoticeDays = REMINDER_DAYS_BEFORE;
  } else {
    rule = "pilot-inactive";
    basis = lastUseOf(org, entries);
    earliestDelete = addDays(basis, PILOT_INACTIVE_DELETE_DAYS);
    firstDue = addDays(earliestDelete, -PILOT_INACTIVE_NOTICE_DAYS);
    minNoticeDays = PILOT_INACTIVE_NOTICE_DAYS;
  }
  if (now.getTime() < firstDue.getTime()) return null;

  const mine = notices.filter((n) => n.rule === rule && n.basis === basis.toISOString());
  const first = mine.find((n) => n.step === "first");
  if (!first) {
    return { rule, basis, step: "first", deleteOn: later(earliestDelete, addDays(now, minNoticeDays)) };
  }
  const deleteOn = new Date(first.deleteOn);
  if (now.getTime() >= deleteOn.getTime()) return { rule, basis, step: "delete", deleteOn };
  const reminderDue = addDays(deleteOn, -REMINDER_DAYS_BEFORE);
  const reminded = mine.some((n) => n.step === "reminder");
  // A first notice already within the last week needs no reminder.
  if (!reminded && now.getTime() >= reminderDue.getTime() && first.at.getTime() < reminderDue.getTime()) {
    return { rule, basis, step: "reminder", deleteOn };
  }
  return null;
}

function formatDate(date: Date, locale: Locale): string {
  return date.toLocaleDateString(DATE_LOCALE[locale], { year: "numeric", month: "long", day: "numeric" });
}

export function renderRetentionNotice(input: {
  locale: Locale;
  rule: RetentionRule;
  step: Step;
  orgName: string;
  deleteOn: Date;
  link: string;
}) {
  const t = createTranslator({ locale: input.locale, messages: BUNDLES[input.locale], namespace: "orgRetentionEmail" });
  const date = formatDate(input.deleteOn, input.locale);
  const key = input.rule === "plan-ended" ? "planEnded" : "pilotInactive";
  const subject = t(`${key}.subject`, { orgName: input.orgName, date });
  const heading = t(input.step === "reminder" ? "headingReminder" : "heading", { orgName: input.orgName });
  const body = t(`${key}.body`, { orgName: input.orgName, date });
  const keep = t(`${key}.keep`);
  const whyYou = t("whyYou", { orgName: input.orgName });
  const text = [heading, "", body, "", keep, "", `${t("ctaText")}: ${input.link}`, "", whyYou].join("\n");
  const html = `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111111;">
          <p style="font-size: 18px; font-weight: 600; margin: 0 0 12px;">${escapeHtml(heading)}</p>
          <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px;">${escapeHtml(body)}</p>
          <p style="font-size: 15px; line-height: 1.6; margin: 0 0 24px;">${escapeHtml(keep)}</p>
          <p style="margin: 0 0 24px;"><a href="${escapeHtml(input.link)}">${escapeHtml(t("ctaText"))}</a></p>
          <p style="color: #666666; font-size: 13px; line-height: 1.6; margin: 0 0 16px;">${escapeHtml(whyYou)}</p>
          <p style="color: #666666; font-size: 11px; margin: 0;">${emailFooterHtml()}</p>
        </div>
      `;
  return { subject, text, html };
}

export async function runOrganizationRetention(
  db: RetentionDb,
  mailer: ReminderMailer | null,
  now: Date = new Date(),
  options: { hosted?: boolean; enabled?: boolean } = {}
): Promise<RetentionSummary> {
  const hosted = options.hosted ?? isHostedDeployment();
  const enabled = options.enabled ?? retentionEnabled();
  const summary: RetentionSummary = {
    enabled,
    checked: 0,
    planned: [],
    noticesSent: 0,
    emails: 0,
    deleted: 0,
    noRecipients: 0,
    errors: 0,
  };
  if (!hosted) return { ...summary, skipped: "not-hosted" };
  if (enabled && !mailer) {
    logger.info("Organisation retention: e-mail is not configured; no notice, no deletion");
    return { ...summary, skipped: "email-not-configured" };
  }

  const orgs = await db.organization.findMany({
    where: { plan: "PILOT" },
    select: {
      id: true,
      name: true,
      plan: true,
      createdAt: true,
      pilotStartedAt: true,
      members: {
        select: { role: true, user: { select: { email: true, locale: true, lastSignInAt: true } } },
      },
    },
  });
  const ids = orgs.map((o) => o.id);
  const entries = ids.length
    ? await db.auditLog.findMany({
        where: {
          organizationId: { in: ids },
          OR: [{ action: { in: [PLAN_CHANGE, ORG_RETENTION_NOTICE] } }, { userId: { not: null } }],
        },
        select: { organizationId: true, action: true, createdAt: true, userId: true, changes: true },
      })
    : [];
  const byOrg = new Map<string, AuditRow[]>();
  for (const e of entries) {
    if (!e.organizationId) continue;
    const list = byOrg.get(e.organizationId) ?? [];
    list.push(e);
    byOrg.set(e.organizationId, list);
  }

  const appUrl = brand.appUrl.replace(/\/$/, "");

  for (const org of orgs) {
    summary.checked++;
    try {
      const d = decide(org, byOrg.get(org.id) ?? [], now);
      if (!d) continue;
      summary.planned.push(
        d.step === "delete"
          ? { organizationId: org.id, rule: d.rule, action: "delete" }
          : { organizationId: org.id, rule: d.rule, action: d.step === "first" ? "notice" : "reminder", deleteOn: d.deleteOn.toISOString() }
      );
      if (!enabled) continue;

      if (d.step === "delete") {
        const result = await deleteOrganizationCompletely(db, org.id, { by: "retention", rule: d.rule }, now);
        if (result.deleted) summary.deleted++;
        logger.info("Organisation deleted by the retention job", { organizationId: org.id, rule: d.rule });
        continue;
      }

      const recipients = org.members.filter((m) => RETENTION_NOTICE_ROLES.includes(m.role) && !!m.user.email);
      if (recipients.length === 0) {
        summary.noRecipients++;
        logger.warn("Organisation retention: nobody to tell; kept", { organizationId: org.id, rule: d.rule });
        continue;
      }
      let delivered = 0;
      for (const m of recipients) {
        const mail = renderRetentionNotice({
          locale: pilotLocale(m.user.locale ?? undefined),
          rule: d.rule,
          step: d.step,
          orgName: org.name,
          deleteOn: d.deleteOn,
          link: `${appUrl}/privacy/settings`,
        });
        try {
          await mailer!.send({ to: m.user.email!, ...mail });
          delivered++;
        } catch (err) {
          logger.error("Organisation retention notice e-mail failed", err, { organizationId: org.id });
        }
      }
      if (delivered === 0) {
        summary.errors++;
        continue;
      }
      await db.auditLog.create({
        data: {
          organizationId: org.id,
          userId: null,
          entityType: "Organization",
          entityId: org.id,
          action: ORG_RETENTION_NOTICE,
          changes: {
            rule: d.rule,
            step: d.step,
            basis: d.basis.toISOString(),
            deleteOn: d.deleteOn.toISOString(),
            recipients: delivered,
          },
        },
      });
      summary.noticesSent++;
      summary.emails += delivered;
    } catch (err) {
      logger.error("Organisation retention failed for an organisation", err, { organizationId: org.id });
      summary.errors++;
    }
  }

  logger.info("Organisation retention run", {
    enabled,
    checked: summary.checked,
    planned: summary.planned.length,
    plannedOrganizations: summary.planned.map((p) => `${p.organizationId}:${p.rule}:${p.action}`),
    noticesSent: summary.noticesSent,
    deleted: summary.deleted,
    noRecipients: summary.noRecipients,
    errors: summary.errors,
  });
  return summary;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
