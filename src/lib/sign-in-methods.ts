// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { features } from "@/config/features";

/**
 * The sign-in methods this server actually offers (F11 of the September
 * browser round). The sign-in page shows only these: a self-hosted instance
 * with local sign-in and no mail key or Google client used to show the local
 * form, a second e-mail form that could send nothing, and a Google button that
 * led nowhere.
 *
 * The provider rules are the ones src/lib/auth.ts registers providers by, and
 * that file calls these same functions. Server-only: the keys are not public,
 * and they are read at request time, so a self-hosted image picks up the
 * values its own environment sets.
 */

type Env = Record<string, string | undefined>;

/** Google OAuth: both the client id and the secret are set. */
export function googleConfigured(env: Env = process.env): boolean {
  return !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET;
}

/** The e-mail magic link: a mail key is set. */
export function emailConfigured(env: Env = process.env): boolean {
  return !!env.RESEND_API_KEY;
}

export interface SignInMethods {
  /** The local (passwordless credentials) form. */
  local: boolean;
  /** The magic-link e-mail form. */
  email: boolean;
  /** The Google button. */
  google: boolean;
}

/**
 * A method is shown when the server registers it, and the build has not
 * switched it off (NEXT_PUBLIC_EMAIL_AUTH_ENABLED / NEXT_PUBLIC_GOOGLE_AUTH_ENABLED
 * = "false" hide a method that is configured).
 */
export function signInMethods(
  env: Env = process.env,
  flags: Pick<typeof features, "devAuthEnabled" | "emailAuthEnabled" | "googleAuthEnabled"> = features,
): SignInMethods {
  return {
    local: flags.devAuthEnabled,
    email: flags.emailAuthEnabled && emailConfigured(env),
    google: flags.googleAuthEnabled && googleConfigured(env),
  };
}
