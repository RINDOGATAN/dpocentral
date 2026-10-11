// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Choosing and filling a model reply (src/config/dsar-model-replies.ts).
 * Pure: shared by the request page, the server's send check and the tests.
 *
 * The app fills what it knows: the requester's name, the reference, the
 * dates (received, due, extended), the organisation's name, the status link
 * and the privacy contact e-mail when the organisation set one. Everything
 * else (reasons, details, information needed, data changed, and any value the
 * app does not have) stays as a placeholder for staff to complete, and a
 * message that still holds a placeholder cannot be sent.
 */

import {
  DSAR_MODEL_REPLIES,
  MODEL_REPLY_PLACEHOLDERS,
  type ModelReply,
  type ModelReplyLanguage,
  type ModelReplyPlaceholder,
} from "@/config/dsar-model-replies";

export type ModelReplyValues = Partial<Record<ModelReplyPlaceholder, string | null | undefined>>;

/** The replies offered for a request of this type, in the approved order. */
export function modelRepliesFor(type: string): ModelReply[] {
  return DSAR_MODEL_REPLIES.filter((r) => r.appliesTo === "all" || r.appliesTo.includes(type as never));
}

const PLACEHOLDER_RE = new RegExp(`\\{(${MODEL_REPLY_PLACEHOLDERS.join("|")})\\}`, "g");

/** Replaces each placeholder that has a non-empty value; leaves the others as they are. */
export function fillPlaceholders(text: string, values: ModelReplyValues): string {
  return text.replace(PLACEHOLDER_RE, (whole, name: ModelReplyPlaceholder) => {
    const v = values[name];
    return typeof v === "string" && v.trim() !== "" ? v : whole;
  });
}

/** The placeholders still in the text, each once, in order of appearance. */
export function remainingPlaceholders(...texts: string[]): string[] {
  const found = new Set<string>();
  for (const text of texts) for (const m of text.matchAll(PLACEHOLDER_RE)) found.add(`{${m[1]}}`);
  return [...found];
}

/** The reply's subject and body in `language`, with the known values filled. */
export function fillModelReply(
  reply: ModelReply,
  language: ModelReplyLanguage,
  values: ModelReplyValues
): { subject: string; body: string } {
  const { subject, body } = reply.text[language];
  return { subject: fillPlaceholders(subject, values), body: fillPlaceholders(body, values) };
}

const DATE_LOCALE: Record<ModelReplyLanguage, string> = { en: "en-GB", es: "es-ES" };

/** A date as the letters write it: "15 January 2027", "15 de enero de 2027". */
export function letterDate(date: Date | string | null | undefined, language: ModelReplyLanguage): string | undefined {
  if (!date) return undefined;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString(DATE_LOCALE[language], { day: "numeric", month: "long", year: "numeric" });
}

/** What the request page knows about a request, for the placeholders. */
export interface ModelReplyRequestFacts {
  requesterName: string;
  publicId: string;
  receivedAt: Date | string;
  dueDate: Date | string;
  extendedDueDate?: Date | string | null;
  /** The due date before an extension (from the request's trail), when extended. */
  originalDueDate?: Date | string | null;
  organizationName: string;
  statusLink: string;
  privacyContact?: string | null;
}

export function modelReplyValues(facts: ModelReplyRequestFacts, language: ModelReplyLanguage): ModelReplyValues {
  const extended = !!facts.extendedDueDate;
  return {
    requester_name: facts.requesterName,
    reference: facts.publicId,
    received_date: letterDate(facts.receivedAt, language),
    // The first period's end: the due date before any extension.
    due_date: letterDate(extended ? facts.originalDueDate : facts.dueDate, language),
    // Known once the deadline has been extended; otherwise staff fill it.
    new_due_date: extended ? letterDate(facts.extendedDueDate, language) : undefined,
    controller_name: facts.organizationName,
    status_link: facts.statusLink,
    privacy_contact: facts.privacyContact ?? undefined,
  };
}

/** The server's check before a message is sent (English; localised by the formatter). */
export const UNFILLED_PLACEHOLDERS_MESSAGE =
  "Complete every placeholder in braces in the message before sending it.";
