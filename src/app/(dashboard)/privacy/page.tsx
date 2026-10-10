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

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { useMemberScope } from "@/lib/use-member-scope";
import { GuidedDashboard } from "@/components/guided/guided-dashboard";

export default function PrivacyDashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { organization } = useOrganization();
  const tCommon = useTranslations("common");
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
  const { orgWide, limited } = useMemberScope();

  // First visit only: once quickstart has been shown it sets a cookie
  // (see quickstart/page.tsx), so an empty org can still navigate to the
  // dashboard without being bounced back in a loop. Read after mount (null
  // until then), as the cookie is not known when the page is rendered.
  const [quickstartSeen, setQuickstartSeen] = useState<boolean | null>(null);
  useEffect(() => {
    setQuickstartSeen(document.cookie.split("; ").includes("dpo_quickstart_seen=1"));
  }, []);

  useEffect(() => {
    if (!orgWide || !isEmptyOrg || fromQuickstart || quickstartSeen !== false) return;
    router.replace("/privacy/quickstart");
  }, [orgWide, isEmptyOrg, fromQuickstart, quickstartSeen, router]);

  // While it is not yet known whether this visit goes on to the quick start,
  // or while it is on its way there, the dashboard is not drawn: it used to
  // flash (with its "How it works" card) between "Get started" and the quick
  // start.
  const mayRedirect =
    !fromQuickstart &&
    quickstartSeen !== true &&
    (limited === null || orgWide) &&
    (!stats || isEmptyOrg);
  if (mayRedirect) {
    return (
      <div className="py-24 text-center text-sm text-muted-foreground" role="status">
        {tCommon("loading")}
      </div>
    );
  }

  return <GuidedDashboard fromQuickstart={fromQuickstart} />;
}
