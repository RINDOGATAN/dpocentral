// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard-shell";
import { SignedInPilotBanner } from "@/components/pilot/pilot-shell";
import { MENU_COOKIE, parseMenuCollapsed } from "@/lib/menu-cookie";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    // A signed-in session lasts 12 hours; once it ends (or was never there)
    // the visitor is sent to sign-in with a plain reason and comes back to the
    // page they were on. The path is set on the request by the middleware.
    const requestHeaders = await headers();
    const current = requestHeaders.get("x-pathname") ?? "/privacy";
    const params = new URLSearchParams({ callbackUrl: current, reason: "signin-required" });
    redirect(`/sign-in?${params.toString()}`);
  }

  // Whether the left menu is collapsed is a cookie, read here so the first
  // paint is already right (src/lib/menu-cookie.ts).
  const cookieStore = await cookies();
  const menuCollapsed = parseMenuCollapsed(cookieStore.get(MENU_COOKIE)?.value);

  return (
    <>
      {/* The end-of-pilot bar, only once a person is signed in, and only in
          the pilot's last days or once it is read-only. */}
      <SignedInPilotBanner />
      <DashboardShell menuCollapsed={menuCollapsed}>
        {children}
      </DashboardShell>
    </>
  );
}
