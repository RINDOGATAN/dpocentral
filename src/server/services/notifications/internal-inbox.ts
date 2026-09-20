// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Our own inbox.
 *
 * Some things a user sends are addressed to us, not to another user. A request
 * for technical help is the one that comes this way: a person is waiting for
 * an answer, so the request is mailed the moment it arrives. In-app feedback
 * is deliberately NOT sent from here — it is a note to read tomorrow, and the
 * storefront's daily digest already reads the feedback table and mails it to
 * CONTACT_EMAIL. Sending it twice only makes the same inbox noisier.
 *
 * This module is the single place that answers two questions: where our inbox
 * is, and how a plain notice gets there. Three rules hold for every caller:
 *
 *   1. The record is stored first and kept whatever happens here. This
 *      function never throws, and a mail failure must never roll back or
 *      discard what was stored.
 *   2. A failure is logged at error level with enough of the record to act on,
 *      never swallowed. "The mail service is not configured" is a failure, not
 *      a quiet skip.
 *   3. Every user-supplied value is escaped before it enters the message. No
 *      images, no tracking, no marketing.
 */

import { Resend } from "resend";
import { emailFrom } from "@/config/brand";
import { logger } from "@/lib/logger";

/** Where things go when neither CONTACT_EMAIL nor ADMIN_EMAILS is set. */
export const DEFAULT_INTERNAL_INBOX = "info@todo.law";

function addressList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean);
}

/**
 * Our inbox, resolved in one order and one order only:
 *
 *   1. CONTACT_EMAIL — the same variable the daily digest already mails to,
 *      so a request lands where the operator is already reading, without
 *      anyone having to type an address into a second setting.
 *   2. ADMIN_EMAILS — the people who operate this instance. A self-hoster's
 *      copy reaches the self-hoster, not us.
 *   3. The standing address, so a copy is never addressed to nobody.
 *
 * Each variable may hold several comma-separated addresses.
 */
export function internalInboxAddresses(): string[] {
  const contact = addressList(process.env.CONTACT_EMAIL);
  if (contact.length > 0) return contact;

  const admins = addressList(process.env.ADMIN_EMAILS);
  if (admins.length > 0) return admins;

  return [DEFAULT_INTERNAL_INBOX];
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

let cachedClient: { key: string; client: Resend } | null = null;

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (cachedClient?.key !== key) {
    cachedClient = { key, client: new Resend(key) };
  }
  return cachedClient.client;
}

export interface InternalNoticeField {
  label: string;
  value: string | null | undefined;
}

export interface InternalNotice {
  /** Subject line. Not escaped into HTML; keep user values out of it. */
  subject: string;
  /** One sentence saying what happened. */
  intro: string;
  /** Label/value rows. Values are escaped. Empty values are dropped. */
  fields: InternalNoticeField[];
  /** A longer free-text block, shown last. Escaped, newlines preserved. */
  body?: string | null;
  /** Reply-To, so answering the notice answers the person. */
  replyTo?: string | null;
  /**
   * What the caller already stored, named in the failure log so a lost copy
   * can still be traced back to a row. Keep it to identifiers, not content.
   */
  record: Record<string, unknown>;
}

export interface InternalNoticeResult {
  delivered: boolean;
  to: string[];
}

/**
 * Send one plain message to our inbox. Never throws: the caller has already
 * stored the record and must not lose it because mail is down.
 */
export async function sendInternalNotice(
  notice: InternalNotice
): Promise<InternalNoticeResult> {
  const to = internalInboxAddresses();
  const client = getResend();

  if (!client) {
    logger.error(
      "RESEND_API_KEY is not configured, so no copy of this reached our inbox. The record is stored and must be read from the database.",
      undefined,
      { subject: notice.subject, to, ...notice.record }
    );
    return { delivered: false, to };
  }

  const rows = notice.fields
    .filter((field) => field.value != null && String(field.value).trim() !== "")
    .map(
      (field) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;font-size:13px;vertical-align:top;white-space:nowrap;">${escapeHtml(field.label)}</td>` +
        `<td style="padding:4px 0;font-size:13px;color:#111827;">${escapeHtml(String(field.value))}</td></tr>`
    )
    .join("");

  const bodyBlock = notice.body
    ? `<div style="margin-top:16px;padding:12px 16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;">` +
      `<p style="margin:0;font-size:14px;color:#374151;white-space:pre-wrap;">${escapeHtml(notice.body)}</p></div>`
    : "";

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
      <p style="margin:0 0 16px;font-size:14px;color:#111827;">${escapeHtml(notice.intro)}</p>
      <table style="border-collapse:collapse;">${rows}</table>
      ${bodyBlock}
    </div>
  `.trim();

  try {
    const res = await client.emails.send({
      from: emailFrom(),
      to,
      ...(notice.replyTo ? { replyTo: notice.replyTo } : {}),
      subject: notice.subject,
      html,
    });

    if (res.error) {
      logger.error(
        "The mail service rejected the copy to our inbox. The record is stored and must be read from the database.",
        undefined,
        { error: JSON.stringify(res.error), subject: notice.subject, to, ...notice.record }
      );
      return { delivered: false, to };
    }

    logger.info("Copy sent to our inbox", { subject: notice.subject, to, id: res.data?.id });
    return { delivered: true, to };
  } catch (error) {
    logger.error(
      "Sending the copy to our inbox failed. The record is stored and must be read from the database.",
      error,
      { subject: notice.subject, to, ...notice.record }
    );
    return { delivered: false, to };
  }
}
