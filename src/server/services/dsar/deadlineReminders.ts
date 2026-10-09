// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Rights-request (DSAR) deadline reminders, run once a day by
 * /api/cron/dsar-reminders.
 *
 * For every open request (not completed, rejected or cancelled) in an
 * organisation that has not switched reminders off, the job sends one e-mail
 * when the request is 7, 3 and 1 day from its due date, and one when it
 * becomes overdue. The points are counted from the real due date
 * (`dsarReminderKind` in src/lib/dsar-deadline.ts), so a month-based
 * deadline is reminded on the right calendar day.
 *
 * Recipients: the members assigned to the request's open tasks; when nobody
 * is, the organisation's privacy officers, administrators and owners. Each
 * e-mail is in the recipient's language (`users.locale`, English when
 * unknown) and carries a link to the request. It names no requester: the
 * reference, type and dates are enough to act on.
 *
 * Never twice: a reminder is recorded in `dsar_reminders` (unique per
 * request, kind and due date) before it is sent. A request whose deadline is
 * extended gets new reminders for the new date. If no e-mail of a reminder
 * could be sent, its record is removed so the next run tries again.
 *
 * Without a mail service (no RESEND_API_KEY, as on a self-hosted kit by
 * default) the job does nothing and records nothing.
 */

import { Resend } from "resend";
import { createTranslator } from "next-intl";
import type { DSARType, OrganizationRole } from "@prisma/client";
import type { Db as AppDb } from "@/lib/prisma";
import { brand, emailFrom, emailFooterHtml } from "@/config/brand";
import { logger } from "@/lib/logger";
import {
  DSAR_CLOSED_STATUSES,
  dsarReminderKind,
  type DsarReminderKind,
} from "@/lib/dsar-deadline";
import { pilotLocale } from "@/server/services/pilot/caps";
import type { Locale } from "@/i18n/config";
import enMessages from "@/messages/en.json";
import esMessages from "@/messages/es.json";

const BUNDLES = { en: enMessages, es: esMessages } as const;

const DATE_LOCALE: Record<Locale, string> = { en: "en-US", es: "es-ES" };

/** Roles that receive a reminder when nobody is assigned to the request. */
export const REMINDER_FALLBACK_ROLES: OrganizationRole[] = ["OWNER", "ADMIN", "PRIVACY_OFFICER"];

/** Task statuses that no longer need the assignee's attention. */
const DONE_TASK_STATUSES = ["COMPLETED", "NOT_APPLICABLE"] as const;

/** The furthest reminder point: requests due later are not read at all. */
const HORIZON_DAYS = 8;

export interface ReminderMail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Sends one e-mail; throws when it was not accepted. */
export interface ReminderMailer {
  send(mail: ReminderMail): Promise<void>;
}

/** The app's transactional mail path (Resend), or null when not configured. */
export function reminderMailerFromEnv(): ReminderMailer | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  const resend = new Resend(key);
  return {
    async send(mail) {
      const result = await resend.emails.send({
        from: emailFrom(),
        to: mail.to,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      });
      if (result && "error" in result && result.error) {
        throw new Error(result.error.message ?? "The mail service refused the message");
      }
    },
  };
}

export interface ReminderEmailInput {
  locale: Locale;
  kind: DsarReminderKind;
  orgName: string;
  publicId: string;
  type: DSARType;
  receivedAt: Date;
  dueDate: Date;
  link: string;
}

function formatDate(date: Date, locale: Locale): string {
  return date.toLocaleDateString(DATE_LOCALE[locale], {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Subject, HTML and plain text of one reminder, in `locale`. */
export function renderReminderEmail(input: ReminderEmailInput): Omit<ReminderMail, "to"> {
  const messages = BUNDLES[input.locale];
  const t = createTranslator({ locale: input.locale, messages, namespace: "dsarReminderEmail" });
  const tType = createTranslator({
    locale: input.locale,
    messages,
    namespace: "dsarPublic.status.typeLabels",
  });
  const dueDate = formatDate(input.dueDate, input.locale);
  const receivedDate = formatDate(input.receivedAt, input.locale);
  const typeLabel = tType(input.type);

  const subject = t("subject", { kind: input.kind, orgName: input.orgName });
  const heading = t("heading", { kind: input.kind });
  const body = t("body", { kind: input.kind, orgName: input.orgName, dueDate });
  const whyYou = t("whyYou", { orgName: input.orgName });
  const switchOff = t("switchOff");
  const rows: [string, string][] = [
    [t("referenceLabel"), input.publicId],
    [t("typeLabel"), typeLabel],
    [t("receivedLabel"), receivedDate],
    [t("dueLabel"), dueDate],
  ];

  const c = brand.colors;
  const html = `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; background: ${c.background}; border-radius: 12px; overflow: hidden;">
          <div style="padding: 24px 24px 16px; border-bottom: 1px solid ${c.border};">
            <span style="font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: 0.05em;">${brand.nameUppercase}</span>
          </div>
          <div style="padding: 32px 24px;">
            <p style="color: ${c.foreground}; font-size: 18px; font-weight: 600; margin: 0 0 12px;">${escapeHtml(heading)}</p>
            <p style="color: ${c.foreground}; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">${escapeHtml(body)}</p>
            <div style="background: ${c.muted}; border-radius: 8px; padding: 16px 20px; margin: 0 0 24px;">
              ${rows
                .map(
                  ([label, value]) => `
              <p style="color: ${c.mutedForeground}; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 4px;">${escapeHtml(label)}</p>
              <p style="color: ${c.foreground}; font-size: 15px; font-weight: 600; margin: 0 0 12px; word-break: break-all;">${escapeHtml(value)}</p>`
                )
                .join("")}
            </div>
            <a href="${escapeHtml(input.link)}" style="display: inline-block; background: ${c.primary}; color: ${c.primaryForeground}; padding: 12px 28px; text-decoration: none; font-weight: 600; font-size: 14px; border-radius: 24px;">${escapeHtml(t("ctaText"))}</a>
            <p style="color: ${c.mutedForeground}; font-size: 13px; line-height: 1.6; margin: 28px 0 0;">${escapeHtml(whyYou)} ${escapeHtml(switchOff)}</p>
          </div>
          <div style="padding: 16px 24px; border-top: 1px solid ${c.border};">
            <p style="color: #666666; font-size: 11px; margin: 0;">${emailFooterHtml()}</p>
          </div>
        </div>
      `;

  const text = [
    heading,
    "",
    body,
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    `${t("ctaText")}: ${input.link}`,
    "",
    `${whyYou} ${switchOff}`,
  ].join("\n");

  return { subject, html, text };
}

export interface ReminderRunSummary {
  /** Set when the job did nothing because e-mail is not configured. */
  skipped?: "email-not-configured";
  checked: number;
  sent: number;
  emails: number;
  alreadySent: number;
  noRecipients: number;
  errors: number;
}

interface Recipient {
  userId: string;
  email: string;
  locale: Locale;
}

type Db = Pick<AppDb, "dSARRequest" | "organizationMember" | "dsarReminder" | "dSARAuditLog">;

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}

/** One run of the daily job. `now` and the mailer are injected for tests. */
export async function runDsarDeadlineReminders(
  db: Db,
  mailer: ReminderMailer | null,
  now: Date = new Date()
): Promise<ReminderRunSummary> {
  const summary: ReminderRunSummary = {
    checked: 0,
    sent: 0,
    emails: 0,
    alreadySent: 0,
    noRecipients: 0,
    errors: 0,
  };
  if (!mailer) {
    logger.info("DSAR reminders: e-mail is not configured; nothing sent");
    return { ...summary, skipped: "email-not-configured" };
  }

  const horizon = new Date(now.getTime() + HORIZON_DAYS * 24 * 60 * 60 * 1000);
  const requests = await db.dSARRequest.findMany({
    where: {
      status: { notIn: [...DSAR_CLOSED_STATUSES] },
      dueDate: { lte: horizon },
      organization: { dsarRemindersEnabled: true },
    },
    select: {
      id: true,
      organizationId: true,
      publicId: true,
      type: true,
      receivedAt: true,
      dueDate: true,
      organization: { select: { name: true } },
      tasks: {
        where: { status: { notIn: [...DONE_TASK_STATUSES] }, assigneeId: { not: null } },
        select: { assigneeId: true },
      },
      reminders: { select: { kind: true, dueDate: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  const membersByOrg = new Map<string, { userId: string; role: OrganizationRole; email: string; locale: Locale }[]>();
  async function membersOf(organizationId: string) {
    let members = membersByOrg.get(organizationId);
    if (!members) {
      const rows = await db.organizationMember.findMany({
        where: { organizationId },
        select: { userId: true, role: true, user: { select: { email: true, locale: true } } },
      });
      members = rows
        .filter((m) => !!m.user?.email)
        .map((m) => ({
          userId: m.userId,
          role: m.role,
          email: m.user.email,
          locale: pilotLocale(m.user.locale ?? undefined),
        }));
      membersByOrg.set(organizationId, members);
    }
    return members;
  }

  const appUrl = brand.appUrl.replace(/\/$/, "");

  for (const request of requests) {
    summary.checked++;
    const kind = dsarReminderKind(request.dueDate, now);
    if (!kind) continue;
    const due = request.dueDate.getTime();
    if (request.reminders.some((r) => r.kind === kind && r.dueDate.getTime() === due)) {
      summary.alreadySent++;
      continue;
    }

    try {
      const members = await membersOf(request.organizationId);
      const assigned = new Set(request.tasks.map((t) => t.assigneeId).filter((id): id is string => !!id));
      let recipients: Recipient[] = members.filter((m) => assigned.has(m.userId));
      if (recipients.length === 0) {
        recipients = members.filter((m) => REMINDER_FALLBACK_ROLES.includes(m.role));
      }
      if (recipients.length === 0) {
        summary.noRecipients++;
        continue;
      }

      // Claim the reminder first: a second run (or a concurrent one) hits
      // the unique key and sends nothing.
      let claimId: string;
      try {
        const claim = await db.dsarReminder.create({
          data: {
            dsarRequestId: request.id,
            kind,
            dueDate: request.dueDate,
            recipientCount: recipients.length,
          },
          select: { id: true },
        });
        claimId = claim.id;
      } catch (err) {
        if (isUniqueViolation(err)) {
          summary.alreadySent++;
          continue;
        }
        throw err;
      }

      const link = `${appUrl}/privacy/dsar/${request.id}`;
      let delivered = 0;
      for (const recipient of recipients) {
        const mail = renderReminderEmail({
          locale: recipient.locale,
          kind,
          orgName: request.organization.name,
          publicId: request.publicId,
          type: request.type,
          receivedAt: request.receivedAt,
          dueDate: request.dueDate,
          link,
        });
        try {
          await mailer.send({ to: recipient.email, ...mail });
          delivered++;
        } catch (err) {
          logger.error("DSAR reminder e-mail failed", err, { dsarRequestId: request.id, kind });
        }
      }

      if (delivered === 0) {
        await db.dsarReminder.delete({ where: { id: claimId } });
        summary.errors++;
        continue;
      }

      await db.dSARAuditLog.create({
        data: {
          dsarRequestId: request.id,
          action: "DEADLINE_REMINDER_SENT",
          performedBy: "SYSTEM",
          details: { kind, dueDate: request.dueDate.toISOString(), recipients: delivered },
        },
      });
      summary.sent++;
      summary.emails += delivered;
    } catch (err) {
      logger.error("DSAR reminder failed", err, { dsarRequestId: request.id });
      summary.errors++;
    }
  }

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
