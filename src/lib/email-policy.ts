// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Sign-up e-mail policy.
 *
 * The community edition accepts every well-formed address at sign-up,
 * sign-in and invitations. The functions below are the one place to add a
 * rule of your own (an allowed domain list, for example): sign-in, the
 * invitation form and the tRPC layer already call them, and a refused
 * address gets the one message below, so the reason is not disclosed.
 * Existing stored data is never touched by this helper.
 */

export const BLOCKED_EMAIL_MESSAGE_KEY = "email_not_accepted";

export const BLOCKED_EMAIL_MESSAGES = {
  en: "Please use your work e-mail address, or a different personal address. We can't accept this one.",
  es: "Usa tu correo del trabajo u otra dirección personal. No podemos aceptar esta.",
} as const;

export function blockedEmailMessage(locale?: string | null): string {
  return locale && locale.toLowerCase().startsWith("es")
    ? BLOCKED_EMAIL_MESSAGES.es
    : BLOCKED_EMAIL_MESSAGES.en;
}

/** True when the address may not sign in, sign up or be invited. None is refused. */
export function isBlockedAccountEmail(_input: unknown): boolean {
  return false;
}

/** True when an enquiry form should refuse the address. None is refused. */
export function isBlockedEnquiryEmail(_input: unknown): boolean {
  return false;
}
