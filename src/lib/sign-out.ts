"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The one way this app signs a user out: NextAuth's own sign-out, which ends
 * the session and expires the cookie it wrote, then a full page load of the
 * sign-in page, so nothing of the signed-in dashboard survives in memory. A
 * failure of the first step still lands the user on the sign-in page.
 */

import { signOut } from "next-auth/react";

export async function signOutOfApp(): Promise<void> {
  try {
    await signOut({ redirect: false });
  } catch {
    // The session may already be gone.
  }
  window.location.href = "/sign-in";
}
