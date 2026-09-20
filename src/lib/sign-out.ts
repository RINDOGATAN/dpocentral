"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The one way this app signs a user out.
 *
 * Three steps, in this order, because each covers what the others cannot:
 *
 *   1. NextAuth's own sign-out. It is the only step that ends the session as
 *      the library understands it: it clears the client session state and
 *      expires the cookie it wrote, under its own configuration. Sending the
 *      user to the sign-in page without it left a live session behind.
 *   2. The cross-logout route, which expires every session cookie name this
 *      host can reach, host-only and domain-wide (src/lib/suite-logout.ts).
 *      This is what removes a cookie NextAuth does not know it wrote, such as
 *      a host-only one left by an older release.
 *   3. A full page load of the suite walk, which expires this host's cookies
 *      again on its very first response, sends the browser through each
 *      sibling product's cross-logout endpoint, and lands on the sign-in
 *      page. Signing out of one product signs the user out of the suite, and
 *      nothing of the signed-in dashboard survives in memory.
 *
 * Neither network step may block the third: a failure there must still leave
 * the user signed out and on the sign-in page, never back in the dashboard.
 */

import { signOut } from "next-auth/react";
import { CROSS_LOGOUT_PATH, SUITE_LOGOUT_PATH } from "@/lib/suite-logout";

export async function signOutOfSuite(): Promise<void> {
  try {
    await signOut({ redirect: false });
  } catch {
    // The session may already be gone; the cookie sweep below still runs.
  }
  try {
    await fetch(CROSS_LOGOUT_PATH, { method: "POST", cache: "no-store" });
  } catch {
    // Offline or refused: land the user on the sign-in page regardless.
  }
  window.location.href = SUITE_LOGOUT_PATH;
}
