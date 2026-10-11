// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The e-mail a requester receives when the organisation extends the deadline
 * of their request (dsar.extendDeadline). Plain: it states the new date, the
 * reference, and that the organisation will send the reasons. It never
 * carries the reason the officer typed, nor anything from the request itself.
 * In the requester's language (stored with a public-form request), English
 * when unknown.
 */

import { Resend } from "resend";
import { createTranslator } from "next-intl";
import { brand, emailFrom, emailFooterHtml } from "@/config/brand";
import { logger } from "@/lib/logger";
import { pilotLocale } from "@/server/services/pilot/caps";
import type { Locale } from "@/i18n/config";
import enMessages from "@/messages/en.json";
import esMessages from "@/messages/es.json";

const BUNDLES = { en: enMessages, es: esMessages } as const;
const DATE_LOCALE: Record<Locale, string> = { en: "en-US", es: "es-ES" };

export interface DSARExtensionEmailInput {
  to: string;
  requesterName: string;
  organizationName: string;
  publicId: string;
  newDueDate: Date;
  locale?: string;
}

/** Subject, plain text and HTML of the e-mail, in the requester's language. */
export function renderExtensionEmail(input: Omit<DSARExtensionEmailInput, "to">) {
  const locale = pilotLocale(input.locale);
  const t = createTranslator({ locale, messages: BUNDLES[locale], namespace: "dsarPublic.extensionEmail" });
  const newDate = input.newDueDate.toLocaleDateString(DATE_LOCALE[locale], {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const statusUrl = `${brand.appUrl.replace(/\/$/, "")}/dsar/status/${input.publicId}`;
  const subject = t("subject", { orgName: input.organizationName });
  const greeting = t("greeting", { name: input.requesterName });
  const body = t("body", { orgName: input.organizationName, newDate });
  const reasons = t("reasons", { orgName: input.organizationName });
  const reference = `${t("referenceLabel")}: ${input.publicId}`;
  const link = `${t("statusLabel")}: ${statusUrl}`;
  const text = [greeting, "", body, "", reasons, "", reference, link].join("\n");
  const html = `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111111;">
          <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px;">${escapeHtml(greeting)}</p>
          <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px;">${escapeHtml(body)}</p>
          <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px;">${escapeHtml(reasons)}</p>
          <p style="font-size: 14px; line-height: 1.6; margin: 0 0 4px;">${escapeHtml(reference)}</p>
          <p style="font-size: 14px; line-height: 1.6; margin: 0 0 24px;"><a href="${escapeHtml(statusUrl)}">${escapeHtml(t("statusLabel"))}</a></p>
          <p style="color: #666666; font-size: 11px; margin: 0;">${emailFooterHtml()}</p>
        </div>
      `;
  return { subject, text, html };
}

/** Sends the e-mail. True when the mail service accepted it; never throws. */
export async function sendDSARExtensionEmail(input: DSARExtensionEmailInput): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    logger.warn("RESEND_API_KEY not configured; skipping DSAR extension email", { publicId: input.publicId });
    return false;
  }
  const mail = renderExtensionEmail(input);
  try {
    const result = await new Resend(key).emails.send({ from: emailFrom(), to: input.to, ...mail });
    if (result && "error" in result && result.error) throw new Error(result.error.message ?? "refused");
    return true;
  } catch (error) {
    logger.error("Failed to send DSAR extension email", error, { publicId: input.publicId });
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
