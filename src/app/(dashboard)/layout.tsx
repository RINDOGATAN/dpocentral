// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard-shell";
import { SignedInPilotBanner } from "@/components/pilot/pilot-shell";
import { MENU_COOKIE, parseMenuCollapsed } from "@/lib/menu-cookie";
import { inAppPlanOffer } from "@/lib/plan-upgrade";
import { ChargeCurrencyProvider } from "@/components/region-provider";

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

  // Whether the left menu is collapsed is a cookie, read here so the first
  // paint is already right (src/lib/menu-cookie.ts).
  const cookieStore = await cookies();
  const menuCollapsed = parseMenuCollapsed(cookieStore.get(MENU_COOKIE)?.value);

  // One decision from the request headers (src/lib/plan-upgrade.ts): the
  // currency the customer will be charged, which every in-app price hint
  // shows, and whether "Move to the paid plan" is offered (automatic upgrade
  // switched on and a payment link set for that same currency), yearly and,
  // when its link is set, monthly too.
  const offer = inAppPlanOffer(await headers());
  const upgrade = offer.link !== null;
  const upgradeMonthly = offer.monthlyLink !== null;

  return (
    <ChargeCurrencyProvider currency={offer.currency}>
      {/* The pilot bar, only once a person is signed in: for the whole pilot,
          the stronger wording in its last days, and once it is read-only. */}
      <SignedInPilotBanner upgrade={upgrade} upgradeMonthly={upgradeMonthly} />
      <DashboardShell menuCollapsed={menuCollapsed}>
        {children}
      </DashboardShell>
    </ChargeCurrencyProvider>
  );
}
