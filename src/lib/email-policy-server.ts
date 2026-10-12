// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Server side of the e-mail policy (src/lib/email-policy.ts).
 *
 * Accounts (sign-up, sign-in, teammate invitations) use both rules; enquiry
 * forms use rule 1 only. The public rights-request form never uses either:
 * a data subject may write from any address.
 *
 * Existing accounts are left alone: an address that already has an account
 * keeps signing in. Only an address with no account yet is refused, so the
 * policy applies to new accounts and stored data is never touched.
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

/** The one query the policy needs (any Prisma client, extended or not). */
type UserLookup = {
  user: {
    findFirst(args: {
      where: { email: { equals: string; mode: "insensitive" } };
      select: { id: true };
    }): PromiseLike<{ id: string } | null>;
  };
};

/** True when the address may not open a NEW account (no account exists for it yet). */
export async function refusesNewAccountEmail(prisma: UserLookup, email: unknown): Promise<boolean> {
  if (!isBlockedAccountEmail(email)) return false;
  const existing = await prisma.user.findFirst({
    where: { email: { equals: String(email).trim(), mode: "insensitive" } },
    select: { id: true },
  });
  return !existing;
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
