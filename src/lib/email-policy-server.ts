// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Server side of the e-mail policy (src/lib/email-policy.ts).
 *
 * Accounts (sign-up, sign-in, teammate invitations) use the account rule
 * (none is refused in the community edition). The public rights-request form
 * never uses it: a data subject may write from any address.
 */

import { NextResponse } from "next/server";
import { localeFromCookieHeader } from "@/i18n/locale-cookie";
import {
  BLOCKED_EMAIL_MESSAGE_KEY,
  BLOCKED_EMAIL_MESSAGES,
  blockedEmailMessage,
  isBlockedAccountEmail,
} from "@/lib/email-policy";

/** The English refusal; the tRPC formatter localises it (serverErrors.exact.emailNotAccepted). */
export const EMAIL_NOT_ACCEPTED_MESSAGE = BLOCKED_EMAIL_MESSAGES.en;

/** True when the address may not sign in, sign up or be invited. */
export function refusesAccountEmail(email: unknown): boolean {
  return isBlockedAccountEmail(email);
}

/**
 * The 400 answer for a refused address. `url` is included because the
 * next-auth client reads the `error` parameter from it.
 */
export function emailNotAcceptedResponse(request: Request): NextResponse {
  const locale = localeFromCookieHeader(request.headers.get("cookie"));
  const url = new URL("/sign-in", request.url);
  url.searchParams.set("error", BLOCKED_EMAIL_MESSAGE_KEY);
  return NextResponse.json(
    {
      error: BLOCKED_EMAIL_MESSAGE_KEY,
      message: blockedEmailMessage(locale),
      url: url.toString(),
    },
    { status: 400 }
  );
}
