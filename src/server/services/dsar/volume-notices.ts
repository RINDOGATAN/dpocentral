// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Hosted service only: the notices that come with the public form's monthly
 * ceiling (src/server/services/dsar/module.ts).
 *
 * After each request received through the public form, the month's count is
 * read again. When it has reached 50, 75 or 90 per cent of the ceiling, or
 * the ceiling itself, and that step has not been told this month, the
 * organisation's owners and administrators (and the form's privacy contact,
 * when one is set) receive one e-mail, in their language: how many requests
 * have arrived, the month's limit, what happens at the limit and, below the
 * 1,000 ceiling, that the volume upgrade raises it. At the ceiling our own
 * inbox is told as well.
 *
 * Each step is recorded first, in the organisation's audit log
 * (DSAR_VOLUME_NOTICE, with the step and the month, no personal data), so it
 * is never sent twice in a month, even if the e-mail fails. This function
 * never throws: the request is already stored.
 */

import { createTranslator } from "next-intl";
import type { OrganizationRole, Prisma } from "@prisma/client";
import { brand, emailFooterHtml } from "@/config/brand";
import { logger } from "@/lib/logger";
import type { Locale } from "@/i18n/config";
import enMessages from "@/messages/en.json";
import esMessages from "@/messages/es.json";
import { pilotLocale } from "@/server/services/pilot/caps";
import type { ReminderMailer } from "@/server/services/dsar/deadlineReminders";
import { escapeHtml, sendInternalNotice } from "@/server/services/notifications/internal-inbox";
import {
  UPGRADED_PUBLIC_REQUESTS_PER_MONTH,
  getDsarModuleAccess,
  madridMonthWindow,
  type DsarModuleOrg,
  type PublicRequestCountDb,
} from "@/server/services/dsar/module";

const BUNDLES = { en: enMessages, es: esMessages } as const;
const DATE_LOCALE: Record<Locale, string> = { en: "en-US", es: "es-ES" };

/** The organisation audit-log action of one volume notice. */
export const DSAR_VOLUME_NOTICE = "DSAR_VOLUME_NOTICE";
/** Who is told. */
export const VOLUME_NOTICE_ROLES: OrganizationRole[] = ["OWNER", "ADMIN"];

/**
 * What this reads and writes. The two reads are typed loosely (Prisma infers
 * their rows from the `select`), and their rows are read as the shapes below.
 */
export type VolumeNoticeDb = PublicRequestCountDb & {
  auditLog: PublicRequestCountDb["auditLog"] & {
    findMany: (args: object) => Promise<unknown>;
    create: (args: { data: Prisma.AuditLogUncheckedCreateInput }) => Promise<unknown>;
  };
  organizationMember: {
    findMany: (args: object) => Promise<unknown>;
  };
};

type NoticeRow = { metadata: Prisma.JsonValue };
type MemberRow = { user: { email: string | null; locale: string | null } };

export type VolumeNoticeOrg = { id: string; name: string } & DsarModuleOrg;

export interface VolumeNoticeResult {
  /** The step told now (50, 75, 90 or 100), or null when nothing was due. */
  step: number | null;
  emails: number;
}

/** "YYYY-MM" of the calendar month (Madrid) that contains `now`. */
function monthKey(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  return `${parts.find((p) => p.type === "year")?.value}-${parts.find((p) => p.type === "month")?.value}`;
}

function stepOf(metadata: Prisma.JsonValue): number | null {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    const step = (metadata as Record<string, unknown>).step;
    return typeof step === "number" ? step : null;
  }
  return null;
}

export function renderVolumeNotice(input: {
  locale: Locale;
  orgName: string;
  step: number;
  used: number;
  limit: number;
  resetsAt: Date;
  /** False with the upgrade already in place (1,000 a month). */
  canUpgrade: boolean;
  link: string;
}) {
  const t = createTranslator({ locale: input.locale, messages: BUNDLES[input.locale], namespace: "dsarVolumeEmail" });
  const resets = input.resetsAt.toLocaleDateString(DATE_LOCALE[input.locale], {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const atLimit = input.step >= 100;
  const subject = atLimit
    ? t("subjectLimit", { orgName: input.orgName })
    : t("subject", { orgName: input.orgName, used: input.used, limit: input.limit });
  const heading = atLimit ? t("headingLimit", { limit: input.limit }) : t("heading", { used: input.used, limit: input.limit });
  const body = atLimit ? t("bodyLimit", { date: resets }) : t("body", { limit: input.limit, date: resets });
  const upgrade = input.canUpgrade ? t("upgrade", { upgraded: UPGRADED_PUBLIC_REQUESTS_PER_MONTH }) : t("moreVolume");
  const cta = t("ctaText");
  const whyYou = t("whyYou", { orgName: input.orgName });
  const text = [heading, "", body, "", upgrade, "", `${cta}: ${input.link}`, "", whyYou].join("\n");
  const html = `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111111;">
          <p style="font-size: 18px; font-weight: 600; margin: 0 0 12px;">${escapeHtml(heading)}</p>
          <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px;">${escapeHtml(body)}</p>
          <p style="font-size: 15px; line-height: 1.6; margin: 0 0 24px;">${escapeHtml(upgrade)}</p>
          <p style="margin: 0 0 24px;"><a href="${escapeHtml(input.link)}">${escapeHtml(cta)}</a></p>
          <p style="color: #666666; font-size: 13px; line-height: 1.6; margin: 0 0 16px;">${escapeHtml(whyYou)}</p>
          <p style="color: #666666; font-size: 11px; margin: 0;">${emailFooterHtml()}</p>
        </div>
      `;
  return { subject, text, html };
}

/**
 * Tells the owners and administrators when the month's count has reached a
 * new step. Call after a public-form request is stored. Never throws.
 */
export async function notifyVolumeStep(
  db: VolumeNoticeDb,
  org: VolumeNoticeOrg,
  privacyContactEmail: string | null | undefined,
  mailer: ReminderMailer | null,
  now: Date = new Date(),
  hosted?: boolean
): Promise<VolumeNoticeResult> {
  const result: VolumeNoticeResult = { step: null, emails: 0 };
  try {
    const access = await getDsarModuleAccess(db, org, now, hosted);
    if (access.gate === "open" || access.warningPercent === 0) return result;
    const step = access.warningPercent;

    const window = madridMonthWindow(now);
    const told = (await db.auditLog.findMany({
      where: {
        organizationId: org.id,
        action: DSAR_VOLUME_NOTICE,
        createdAt: { gte: window.start, lt: window.end },
      },
      select: { metadata: true },
    })) as NoticeRow[];
    const highestTold = Math.max(0, ...told.map((row) => stepOf(row.metadata) ?? 0));
    if (step <= highestTold) return result;

    // Recorded before sending: a failed e-mail is logged, never re-sent.
    await db.auditLog.create({
      data: {
        organizationId: org.id,
        userId: null,
        entityType: "Organization",
        entityId: org.id,
        action: DSAR_VOLUME_NOTICE,
        metadata: { step, month: monthKey(now), used: access.used, limit: access.limit },
      },
    });
    result.step = step;

    const members = (await db.organizationMember.findMany({
      where: { organizationId: org.id, role: { in: VOLUME_NOTICE_ROLES } },
      select: { user: { select: { email: true, locale: true } } },
    })) as MemberRow[];
    const recipients = new Map<string, Locale>();
    for (const m of members) {
      const email = m.user.email?.trim().toLowerCase();
      if (email && !recipients.has(email)) recipients.set(email, pilotLocale(m.user.locale ?? undefined));
    }
    const contact = privacyContactEmail?.trim().toLowerCase();
    if (contact && !recipients.has(contact)) {
      // The contact has no account of its own: the first owner's language.
      const first = recipients.values().next();
      recipients.set(contact, first.done ? "en" : first.value);
    }

    const link = `${brand.appUrl.replace(/\/$/, "")}/privacy/dsar`;
    const canUpgrade = access.gate === "standard";
    if (!mailer) {
      logger.error("Rights-request volume notice not sent: e-mail is not configured", undefined, {
        organizationId: org.id,
        step,
      });
    } else {
      for (const [to, locale] of recipients) {
        try {
          const mail = renderVolumeNotice({
            locale,
            orgName: org.name,
            step,
            used: access.used,
            limit: access.limit,
            resetsAt: access.resetsAt,
            canUpgrade,
            link,
          });
          await mailer.send({ to, ...mail });
          result.emails += 1;
        } catch (error) {
          logger.error("Rights-request volume notice: one e-mail was not accepted", error, {
            organizationId: org.id,
            step,
          });
        }
      }
    }

    if (step >= 100) {
      await sendInternalNotice({
        subject: "Rights-request form at its monthly limit",
        intro:
          "An organisation's public rights-request form has reached its monthly limit and now shows the organisation's privacy contact instead of taking requests.",
        fields: [
          { label: "Organisation id", value: org.id },
          { label: "Requests this month", value: String(access.used) },
          { label: "Monthly limit", value: String(access.limit) },
          { label: "Volume upgrade", value: canUpgrade ? "not active" : "active" },
          { label: "Month", value: monthKey(now) },
        ],
        record: { organizationId: org.id, action: DSAR_VOLUME_NOTICE, step },
      });
    }
  } catch (error) {
    logger.error("Rights-request volume notice failed", error, { organizationId: org.id });
  }
  return result;
}
