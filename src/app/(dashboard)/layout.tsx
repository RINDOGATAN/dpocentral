// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard-shell";
import { SignedInPilotBanner } from "@/components/pilot/pilot-shell";
import { MENU_COOKIE, SKIN_COOKIE, parseMenuCollapsed, parseSkin } from "@/lib/skin";

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

  // The layout choice is a cookie, read here so the first paint is already in
  // the chosen layout (src/lib/skin.ts). No cookie is Guided, so a new
  // visitor's very first render is already Guided.
  const cookieStore = await cookies();
  const skin = parseSkin(cookieStore.get(SKIN_COOKIE)?.value);
  const menuCollapsed = parseMenuCollapsed(cookieStore.get(MENU_COOKIE)?.value);

  return (
    <>
      <DashboardShell skin={skin} menuCollapsed={menuCollapsed}>
        {children}
      </DashboardShell>
      {/* The pilot banner is shown only once a person is signed in */}
      <SignedInPilotBanner />
    </>
  );
}
