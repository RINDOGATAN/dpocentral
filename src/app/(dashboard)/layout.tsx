// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NOINDEX } from "@/config/seo";
import { headers } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard-shell";

// The signed-in application: never a search result.
export const metadata: Metadata = { robots: NOINDEX };

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  // E-mail policy: a session carried over from a sibling app for a refused
  // address is not accepted here (src/lib/auth.ts, jwt callback).
  if (session?.emailNotAccepted) {
    redirect("/auth-error?error=email_not_accepted");
  }

  if (!session) {
    // A signed-in session lasts 12 hours; once it ends (or was never there)
    // the visitor is sent to sign-in with a plain reason and comes back to the
    // page they were on. The path is set on the request by the middleware.
    const requestHeaders = await headers();
    const current = requestHeaders.get("x-pathname") ?? "/privacy";
    const params = new URLSearchParams({ callbackUrl: current, reason: "signin-required" });
    redirect(`/sign-in?${params.toString()}`);
  }

  return <DashboardShell>{children}</DashboardShell>;
}
