// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Hosted service only: open rights requests with no activity for 30 days are
 * deleted, after an e-mail notice to the organisation's owners and
 * administrators 7 days before. Run once
 * a day by /api/cron/dsar-inactive. The self-hosted kit is never touched.
 *
 * Activity: the latest of the request's own last change, any change to one of
 * its tasks, and any message. Opening the request, a deadline reminder or the
 * notice itself is not activity.
 *
 *  1. Notice. When an open request has had no activity for 23 days and no
 *     notice was sent for that same last activity, every owner and
 *     administrator with an e-mail address is told, in their language, with
 *     the date of deletion (30 days after the last activity, and never less
 *     than 7 days after the notice). The notice is recorded in the request's
 *     trail (INACTIVITY_NOTICE_SENT) only if at least one e-mail was accepted.
 *  2. Deletion. When that date has come and there has been no activity since
 *     the notice, the request is deleted with its tasks, messages and trail.
 *     Before that, the organisation's "created" entry for it (which copied
 *     the form) is cleared, and one contentless entry is written in the
 *     organisation's audit log: reference, type, status, dates. No name, no
 *     address, no text.
 *
 * No notice, no deletion: without a mail service the job does nothing.
 */

import { max as maxDate } from "date-fns";
import { createTranslator } from "next-intl";
import type { OrganizationRole, Prisma } from "@prisma/client";
import { brand, emailFooterHtml } from "@/config/brand";
import { logger } from "@/lib/logger";
import { isHostedDeployment } from "@/lib/hosted";
import { DSAR_CLOSED_STATUSES } from "@/lib/dsar-deadline";
import { pilotLocale } from "@/server/services/pilot/caps";
import type { ReminderMailer } from "@/server/services/dsar/deadlineReminders";
import { INACTIVE_DELETE_DAYS, INACTIVE_NOTICE_DAYS_BEFORE } from "@/server/services/dsar/module";
import type { Locale } from "@/i18n/config";
import enMessages from "@/messages/en.json";
import esMessages from "@/messages/es.json";

const BUNDLES = { en: enMessages, es: esMessages } as const;
const DATE_LOCALE: Record<Locale, string> = { en: "en-US", es: "es-ES" };

export const INACTIVITY_NOTICE_SENT = "INACTIVITY_NOTICE_SENT";
export const DSAR_DELETED_INACTIVE = "DSAR_DELETED_INACTIVE";
/** Who is told before the deletion. */
export const INACTIVITY_NOTICE_ROLES: OrganizationRole[] = ["OWNER", "ADMIN"];

const NOTICE_AFTER_DAYS = INACTIVE_DELETE_DAYS - INACTIVE_NOTICE_DAYS_BEFORE;

/** Whole 24-hour days, independent of the server's time zone and clock changes. */
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86_400_000);

type InactiveRequestRow = {
  id: string;
  organizationId: string;
  publicId: string;
  type: string;
  status: string;
  receivedAt: Date;
  dueDate: Date;
  updatedAt: Date;
  organization: { name: string };
  tasks: { updatedAt: Date }[];
  communications: { sentAt: Date }[];
  auditLog: { createdAt: Date; details: Prisma.JsonValue }[];
};

export type InactiveDb = {
  dSARRequest: {
    findMany: (args: object) => Promise<InactiveRequestRow[]>;
    delete: (args: { where: { id: string } }) => Promise<unknown>;
  };
  organizationMember: {
    findMany: (args: object) => Promise<
      { userId: string; role: OrganizationRole; user: { email: string | null; locale: string | null } }[]
    >;
  };
  dSARAuditLog: { create: (args: { data: Prisma.DSARAuditLogUncheckedCreateInput }) => Promise<unknown> };
  auditLog: {
    create: (args: { data: Prisma.AuditLogUncheckedCreateInput }) => Promise<unknown>;
    updateMany: (args: Prisma.AuditLogUpdateManyArgs) => Promise<unknown>;
  };
};

export interface InactiveRunSummary {
  skipped?: "not-hosted" | "email-not-configured";
  checked: number;
  noticesSent: number;
  emails: number;
  deleted: number;
  noRecipients: number;
  errors: number;
}

/** The request's last activity: its own last change, a task's, or a message. */
export function lastActivityOf(row: Pick<InactiveRequestRow, "updatedAt" | "tasks" | "communications">): Date {
  return maxDate([
    row.updatedAt,
    ...row.tasks.map((t) => t.updatedAt),
    ...row.communications.map((c) => c.sentAt),
  ]);
}

type NoticeDetails = { lastActivityAt: string; deleteOn: string };

function noticeFor(row: InactiveRequestRow, lastActivity: Date): NoticeDetails | null {
  for (const entry of row.auditLog) {
    const d = entry.details as Partial<NoticeDetails> | null;
    if (d && d.lastActivityAt === lastActivity.toISOString() && typeof d.deleteOn === "string") {
      return d as NoticeDetails;
    }
  }
  return null;
}

function formatDate(date: Date, locale: Locale): string {
  return date.toLocaleDateString(DATE_LOCALE[locale], { year: "numeric", month: "long", day: "numeric" });
}

export function renderInactivityNotice(input: {
  locale: Locale;
  orgName: string;
  publicId: string;
  lastActivity: Date;
  deleteOn: Date;
  days: number;
  link: string;
}) {
  const t = createTranslator({ locale: input.locale, messages: BUNDLES[input.locale], namespace: "dsarInactivityEmail" });
  const date = formatDate(input.deleteOn, input.locale);
  const subject = t("subject", { orgName: input.orgName, date });
  const heading = t("heading", { days: input.days });
  const body = t("body", {
    reference: input.publicId,
    orgName: input.orgName,
    lastActivity: formatDate(input.lastActivity, input.locale),
    date,
  });
  const action = t("action");
  const whyYou = t("whyYou", { orgName: input.orgName });
  const text = [heading, "", body, "", action, "", `${t("ctaText")}: ${input.link}`, "", whyYou].join("\n");
  const html = `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111111;">
          <p style="font-size: 18px; font-weight: 600; margin: 0 0 12px;">${escapeHtml(heading)}</p>
          <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px;">${escapeHtml(body)}</p>
          <p style="font-size: 15px; line-height: 1.6; margin: 0 0 24px;">${escapeHtml(action)}</p>
          <p style="margin: 0 0 24px;"><a href="${escapeHtml(input.link)}">${escapeHtml(t("ctaText"))}</a></p>
          <p style="color: #666666; font-size: 13px; line-height: 1.6; margin: 0 0 16px;">${escapeHtml(whyYou)}</p>
          <p style="color: #666666; font-size: 11px; margin: 0;">${emailFooterHtml()}</p>
        </div>
      `;
  return { subject, text, html };
}

export async function runInactiveDsarCleanup(
  db: InactiveDb,
  mailer: ReminderMailer | null,
  now: Date = new Date(),
  hosted: boolean = isHostedDeployment()
): Promise<InactiveRunSummary> {
  const summary: InactiveRunSummary = { checked: 0, noticesSent: 0, emails: 0, deleted: 0, noRecipients: 0, errors: 0 };
  if (!hosted) return { ...summary, skipped: "not-hosted" };
  if (!mailer) {
    logger.info("Inactive DSAR cleanup: e-mail is not configured; no notice, no deletion");
    return { ...summary, skipped: "email-not-configured" };
  }

  const noticeCutoff = addDays(now, -NOTICE_AFTER_DAYS);
  const rows = await db.dSARRequest.findMany({
    where: {
      status: { notIn: [...DSAR_CLOSED_STATUSES] },
      // A request changed since the cut-off has had activity: not read at all.
      updatedAt: { lte: noticeCutoff },
    },
    select: {
      id: true,
      organizationId: true,
      publicId: true,
      type: true,
      status: true,
      receivedAt: true,
      dueDate: true,
      updatedAt: true,
      organization: { select: { name: true } },
      tasks: { select: { updatedAt: true } },
      communications: { select: { sentAt: true } },
      auditLog: {
        where: { action: INACTIVITY_NOTICE_SENT },
        select: { createdAt: true, details: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const appUrl = brand.appUrl.replace(/\/$/, "");

  for (const row of rows) {
    summary.checked++;
    try {
      const lastActivity = lastActivityOf(row);
      if (lastActivity > noticeCutoff) continue;
      const notice = noticeFor(row, lastActivity);

      if (notice) {
        if (now.getTime() < new Date(notice.deleteOn).getTime()) continue;
        // Contentless record first, then the copy of the form is cleared,
        // then the request goes (tasks, messages and trail with it).
        await db.auditLog.create({
          data: {
            organizationId: row.organizationId,
            entityType: "DSARRequest",
            entityId: row.id,
            action: DSAR_DELETED_INACTIVE,
            changes: {
              publicId: row.publicId,
              type: row.type,
              status: row.status,
              receivedAt: row.receivedAt.toISOString(),
              dueDate: row.dueDate.toISOString(),
              lastActivityAt: lastActivity.toISOString(),
              noticeSentFor: notice.deleteOn,
            },
            metadata: { source: "cron/dsar-inactive", inactiveDays: INACTIVE_DELETE_DAYS },
          },
        });
        await db.auditLog.updateMany({
          where: { organizationId: row.organizationId, entityType: "DSARRequest", entityId: row.id, action: "CREATE" },
          data: { changes: { redacted: true } },
        });
        await db.dSARRequest.delete({ where: { id: row.id } });
        summary.deleted++;
        continue;
      }

      const deleteOn = maxDate([addDays(lastActivity, INACTIVE_DELETE_DAYS), addDays(now, INACTIVE_NOTICE_DAYS_BEFORE)]);
      const members = await db.organizationMember.findMany({
        where: { organizationId: row.organizationId, role: { in: INACTIVITY_NOTICE_ROLES } },
        select: { userId: true, role: true, user: { select: { email: true, locale: true } } },
      });
      const recipients = members.filter((m) => !!m.user?.email);
      if (recipients.length === 0) {
        summary.noRecipients++;
        continue;
      }
      const days = Math.floor((now.getTime() - lastActivity.getTime()) / 86_400_000);
      let delivered = 0;
      for (const m of recipients) {
        const locale = pilotLocale(m.user.locale ?? undefined);
        const mail = renderInactivityNotice({
          locale,
          orgName: row.organization.name,
          publicId: row.publicId,
          lastActivity,
          deleteOn,
          days,
          link: `${appUrl}/privacy/dsar/${row.id}`,
        });
        try {
          await mailer.send({ to: m.user.email!, ...mail });
          delivered++;
        } catch (err) {
          logger.error("Inactive DSAR notice e-mail failed", err, { dsarRequestId: row.id });
        }
      }
      if (delivered === 0) {
        summary.errors++;
        continue;
      }
      await db.dSARAuditLog.create({
        data: {
          dsarRequestId: row.id,
          action: INACTIVITY_NOTICE_SENT,
          performedBy: "SYSTEM",
          details: {
            lastActivityAt: lastActivity.toISOString(),
            deleteOn: deleteOn.toISOString(),
            recipients: delivered,
          },
        },
      });
      summary.noticesSent++;
      summary.emails += delivered;
    } catch (err) {
      logger.error("Inactive DSAR cleanup failed for a request", err, { dsarRequestId: row.id });
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
