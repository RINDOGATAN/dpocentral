"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The dashboard: the programme at one glance (src/components/guided/
 * guided-dashboard.tsx). The Classic dashboard, with its counters, queues,
 * quick actions and its own client switcher, was retired on 9 October 2026
 * (owner's decision d11); the switcher and "New organization" live in the
 * left menu's organisation block.
 */

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { useMemberScope } from "@/lib/use-member-scope";
import { GuidedDashboard } from "@/components/guided/guided-dashboard";

export default function PrivacyDashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { organization } = useOrganization();
  const { data: stats, isLoading } = trpc.organization.getDashboardStats.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id }
  );

  // Auto-redirect brand-new orgs (all zeros) straight to quickstart
  const isEmptyOrg = !isLoading &&
    (stats?.totalAssets ?? 0) === 0 &&
    (stats?.totalActivities ?? 0) === 0 &&
    (stats?.activeVendors ?? 0) === 0;
  const fromQuickstart = searchParams.get("from") === "quickstart";

  // A member limited to departments is never sent to the quick start, an
  // organisation-wide action (src/lib/department-limit.ts).
  const { orgWide } = useMemberScope();

  useEffect(() => {
    if (!orgWide || !isEmptyOrg || fromQuickstart) return;
    // First visit only: once quickstart has been shown it sets a cookie
    // (see quickstart/page.tsx), so an empty org can still navigate to the
    // dashboard without being bounced back in a loop.
    const quickstartSeen = document.cookie
      .split("; ")
      .includes("dpo_quickstart_seen=1");
    if (quickstartSeen) return;
    router.replace("/privacy/quickstart");
  }, [orgWide, isEmptyOrg, fromQuickstart, router]);

  return <GuidedDashboard fromQuickstart={fromQuickstart} />;
}
