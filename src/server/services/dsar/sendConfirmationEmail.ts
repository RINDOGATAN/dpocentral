// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { Resend } from "resend";
import { getTranslations } from "next-intl/server";
import type { DSARType } from "@prisma/client";
import { brand, emailFrom, emailFooterHtml } from "@/config/brand";
import { logger } from "@/lib/logger";
import { defaultLocale, isValidLocale, type Locale } from "@/i18n/config";
import { formatRequestRef } from "@/lib/request-ref";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const DATE_LOCALE: Record<Locale, string> = {
  en: "en-US",
  es: "es-ES",
};

export interface DSARConfirmationEmailInput {
  to: string;
  requesterName: string;
  organizationName: string;
  publicId: string;
  type: DSARType;
  dueDate: Date;
  locale?: string;
}

/**
 * Sends the acknowledgement of a public rights request. Resolves to true only
 * when the mail was handed to the mailer: false when no mailer is configured
 * or the send fails, so the thank-you screen never says a confirmation was
 * sent when none was. The reference shown is the short one staff read
 * (formatRequestRef); the status link keeps the full publicId as its token.
 */
export async function sendDSARConfirmationEmail(
  input: DSARConfirmationEmailInput
): Promise<boolean> {
  if (!resend) {
    logger.warn("RESEND_API_KEY not configured; skipping DSAR confirmation email", {
      publicId: input.publicId,
    });
    return false;
  }

  const locale: Locale =
    input.locale && isValidLocale(input.locale) ? input.locale : defaultLocale;

  const tEmail = await getTranslations({ locale, namespace: "dsarPublic.email" });
  const tTypes = await getTranslations({ locale, namespace: "dsarPublic.status.typeLabels" });

  const statusUrl = `${brand.appUrl}/dsar/status/${input.publicId}`;
  const reference = formatRequestRef(input.publicId, locale);
  const dueDateLabel = input.dueDate.toLocaleDateString(DATE_LOCALE[locale], {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const requestTypeLabel = tTypes(input.type);

  try {
    await resend.emails.send({
      from: emailFrom(),
      to: input.to,
      subject: tEmail("subject", { orgName: input.organizationName }),
      html: `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; background: ${brand.colors.background}; border-radius: 12px; overflow: hidden;">
          <div style="padding: 24px 24px 16px; border-bottom: 1px solid ${brand.colors.border};">
            <span style="font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: 0.05em;">${brand.nameUppercase}</span>
          </div>
          <div style="padding: 32px 24px;">
            <p style="color: ${brand.colors.foreground}; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">${escapeHtml(tEmail("greeting"))}</p>
            <p style="color: ${brand.colors.foreground}; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
              ${escapeHtml(tEmail("body", { orgName: input.organizationName, requestType: requestTypeLabel, dueDate: dueDateLabel }))}
            </p>
            <div style="background: ${brand.colors.muted}; border-radius: 8px; padding: 16px 20px; margin: 0 0 24px;">
              <p style="color: ${brand.colors.mutedForeground}; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 6px;">${escapeHtml(tEmail("referenceLabel"))}</p>
              <p style="color: ${brand.colors.foreground}; font-family: 'SFMono-Regular', Consolas, monospace; font-size: 16px; font-weight: 600; margin: 0; word-break: break-all;">${escapeHtml(reference)}</p>
            </div>
            <a href="${statusUrl}" style="display: inline-block; background: ${brand.colors.primary}; color: ${brand.colors.primaryForeground}; padding: 12px 28px; text-decoration: none; font-weight: 600; font-size: 14px; border-radius: 24px;">${escapeHtml(tEmail("ctaText"))}</a>
            <p style="color: ${brand.colors.mutedForeground}; font-size: 13px; line-height: 1.6; margin: 28px 0 0;">
              ${escapeHtml(tEmail("footer"))}
            </p>
          </div>
          <div style="padding: 16px 24px; border-top: 1px solid ${brand.colors.border};">
            <p style="color: #666666; font-size: 11px; margin: 0;">${emailFooterHtml()}</p>
          </div>
        </div>
      `,
    });
    return true;
  } catch (error) {
    logger.error("Failed to send DSAR confirmation email", error, {
      publicId: input.publicId,
    });
    return false;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
