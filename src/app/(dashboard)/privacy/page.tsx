"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Database,
  FileText,
  ClipboardCheck,
  AlertTriangle,
  Building2,
  ArrowRight,
  Clock,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Sparkles,
  Plus,
  Check,
  Download,
  Lock,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { useDsarAccess } from "@/lib/use-dsar-access";
import { ExpertHelpCta } from "@/components/privacy/expert-help-cta";
import { DeploymentExpertCta } from "@/components/privacy/deployment-expert-cta";
import { useLocale, useTranslations } from "next-intl";
import { formatDateTimeIn } from "@/lib/utils";
import { useEnumLabels } from "@/lib/enum-labels";
import { StatusChip, StatusMark } from "@/components/ui/status-chip";
import { toneForRiskTier } from "@/config/status-tone";
import { useSkin } from "@/components/guided/skin-context";
import { NextStepCard } from "@/components/guided/next-step-card";
import { FirstRunCard } from "@/components/help/first-run-card";
import { useHostedPilot } from "@/components/pilot/hosted-pilot";
import { isAssessmentTypeLocked } from "@/lib/premium-gate";
import { DpiaFreeNote } from "@/components/pilot/dpia-free-note";
import { useMemberScope } from "@/lib/use-member-scope";
import { formatRequestRef } from "@/lib/request-ref";
import { NewOrganizationDialog } from "@/components/privacy/new-organization-dialog";

export default function PrivacyDashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tp = useTranslations("pages.dashboard");
  const locale = useLocale();
  const { label: enumLabel } = useEnumLabels();
  const { organization, organizations, setOrganization } = useOrganization();
  const { canHandle: canHandleDsars } = useDsarAccess();
  const { skin } = useSkin();
  const [createOrgOpen, setCreateOrgOpen] = useState(false);
  const { data: stats, isLoading } = trpc.organization.getDashboardStats.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id }
  );

  const { data: dsarList } = trpc.dsar.list.useQuery(
    { organizationId: organization?.id ?? "", limit: 3 },
    { enabled: !!organization?.id }
  );

  const { data: vendorList } = trpc.vendor.list.useQuery(
    { organizationId: organization?.id ?? "", limit: 3 },
    { enabled: !!organization?.id }
  );

  // Show quickstart card for orgs that haven't built out their privacy program yet
  const showQuickstart = !isLoading &&
    (stats?.totalAssets ?? 0) <= 5 &&
    (stats?.totalActivities ?? 0) <= 3 &&
    (stats?.activeVendors ?? 0) <= 3;

  // Auto-redirect brand-new orgs (all zeros) straight to quickstart
  const isEmptyOrg = !isLoading &&
    (stats?.totalAssets ?? 0) === 0 &&
    (stats?.totalActivities ?? 0) === 0 &&
    (stats?.activeVendors ?? 0) === 0;
  const fromQuickstart = searchParams.get("from") === "quickstart";

  // A member limited to departments does not see the quick start, the
  // organisation-wide progress or the organisation-wide actions
  // (src/lib/department-limit.ts). Shown only once known not to be limited.
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

  // The "Start a DPIA" quick action says when the type is gated, by the same
  // rule as the type grid on the new-assessment page.
  const hosted = useHostedPilot();
  const { data: entitled } = trpc.assessment.getEntitledTypes.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id }
  );
  const dpiaGated =
    !!entitled &&
    isAssessmentTypeLocked({ type: "DPIA", entitledTypes: entitled.entitledTypes, hosted });

  // Read only by the Classic quick start card below; Guided never asks.
  const { data: portfolio } = trpc.quickstart.getPortfolio.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id && showQuickstart === true && skin !== "guided" && orgWide }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const dashboardStats = {
    dataAssets: stats?.totalAssets ?? 0,
    processingActivities: stats?.totalActivities ?? 0,
    openDSARs: stats?.openDSARs ?? 0,
    overdueDSARs: stats?.overdueDSARs ?? 0,
    activeAssessments: stats?.activeAssessments ?? 0,
    openIncidents: stats?.openIncidents ?? 0,
    activeVendors: stats?.activeVendors ?? 0,
    totalVendors: stats?.totalVendors ?? 0,
  };

  const recentActivity = stats?.recentAuditLogs ?? [];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Guided only: the one-minute introduction on the first visit (dismissed
          per browser), then the first step on the path that is not done. */}
      {skin === "guided" && <FirstRunCard />}
      {skin === "guided" && orgWide && <NextStepCard waitForFresh={fromQuickstart} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold truncate">{organization?.name || tp("subtitle")}</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            {tp("subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* The whole programme's report: an organisation-wide action. */}
          {orgWide && (
          <Button
            size="sm"
            className="gap-2"
            onClick={() =>
              window.open(
                `/api/export/privacy-program?organizationId=${organization?.id}`,
                "_blank"
              )
            }
            disabled={!organization?.id}
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">{tp("exportReport")}</span>
            <span className="sm:hidden">{tp("exportReportShort")}</span>
          </Button>
          )}
        {/* One client switcher: Guided carries it in the left menu (the client
            switcher block), so the page-header switch is Classic-only. */}
        {skin !== "guided" && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 shrink-0">
              <Building2 className="w-4 h-4" />
              <span className="hidden sm:inline">{tp("switchOrg")}</span>
              <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[240px]">
            {organizations.map((org) => (
              <DropdownMenuItem
                key={org.id}
                onClick={() => setOrganization(org)}
                className="flex items-center gap-2"
              >
                <span className="truncate flex-1">{org.name}</span>
                {org.id === organization?.id && (
                  <Check className="w-4 h-4 shrink-0 text-primary" />
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setCreateOrgOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              {tp("newOrgDialog.title")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        )}
        </div>
      </div>

      {/* Quickstart Card — shown when org has few records. Guided leads to the
          quick start through the one "Next step" card above, so this second
          call to action is Classic-only: one card at the top. */}
      {skin !== "guided" && showQuickstart && orgWide &&
        (portfolio?.hasPortfolio ? (
          /* VW portfolio detected — show tailored card */
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="p-4 sm:p-6 space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm sm:text-base">
                    {tp("vwQuickstartTitle")}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    {tp.rich("vwQuickstartDesc", {
                      count: portfolio.vendors.length,
                      b: (chunks) => <strong>{chunks}</strong>,
                    })}
                  </p>
                </div>
                <Link href="/privacy/quickstart?from=vendorwatch">
                  <Button size="sm" className="shrink-0 gap-2">
                    <Sparkles className="w-4 h-4" />
                    <span>{tp("vwQuickstartCta")}</span>
                  </Button>
                </Link>
              </div>
              <div className="flex flex-wrap gap-2 ml-0 sm:ml-12">
                {portfolio.vendors.slice(0, 5).map((v) => (
                  <Badge key={v!.slug} variant="secondary" className="text-xs">
                    {v!.name}
                  </Badge>
                ))}
                {portfolio.vendors.length > 5 && (
                  <Badge variant="outline" className="text-xs">
                    {tp("moreVendors", { count: portfolio.vendors.length - 5 })}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          /* No VW portfolio — show generic quickstart card */
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm sm:text-base">
                  {tp("quickstartTitle")}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  {tp("quickstartDesc")}
                </p>
              </div>
              <Link href="/privacy/quickstart">
                <Button size="sm" className="shrink-0 gap-2">
                  <Sparkles className="w-4 h-4" />
                  <span>{tp("quickstartCta")}</span>
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}

      <ExpertHelpCta context="general" />
      <DeploymentExpertCta />

      {/* Quick Stats - 2 columns on mobile, 4 on desktop */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">{tp("stats.dataInventory")}</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            {/* Two lines, each with its noun: the assets, then the activities. */}
            <div className="text-xl sm:text-2xl font-bold text-foreground" data-testid="kpi-assets">
              {tp("stats.assetsCount", { count: dashboardStats.dataAssets })}
            </div>
            <p className="text-xs text-muted-foreground mt-1" data-testid="kpi-activities">
              {tp("stats.activitiesCount", { count: dashboardStats.processingActivities })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">{tp("stats.openDsars")}</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold text-foreground">{dashboardStats.openDSARs}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {dashboardStats.overdueDSARs > 0 ? (
                <span className="inline-flex items-center gap-1 font-medium">
                  <StatusMark tone="warning" className="h-3.5 w-3.5" />
                  {tp("stats.overdueCount", { count: dashboardStats.overdueDSARs })}
                </span>
              ) : (
                tp("stats.allOnTrack")
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">{tp("stats.assessments")}</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold text-foreground">{dashboardStats.activeAssessments}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {tp("stats.inProgress")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">{tp("stats.incidents")}</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold text-foreground">{dashboardStats.openIncidents}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {tp("stats.openCases")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        {/* DSAR Queue */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <CardTitle className="text-base sm:text-lg">{tp("dsarQueue.title")}</CardTitle>
                <CardDescription className="text-xs sm:text-sm">{tp("dsarQueue.subtitle")}</CardDescription>
              </div>
              <Link href="/privacy/dsar">
                <Button variant="ghost" size="sm" className="shrink-0">
                  <span className="hidden sm:inline">{tp("dsarQueue.viewAll")}</span>
                  <ArrowRight className="sm:ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
            {dsarList?.requests && dsarList.requests.length > 0 ? (
              dsarList.requests.map((dsar) => (
                <Link key={dsar.id} href={`/privacy/dsar/${dsar.id}`} className="block rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  <div className="flex items-start sm:items-center gap-3 sm:gap-4 p-2 -mx-2 hover:bg-muted/50 transition-colors">
                    <div className="flex-1 space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* A short reference, not the database identifier (kept in the tooltip). */}
                        <span className="font-medium font-mono text-primary text-sm" title={dsar.publicId}>
                          {formatRequestRef(dsar.publicId, locale)}
                        </span>
                        <Badge variant="outline" className="text-xs">{enumLabel("dsarType", dsar.type)}</Badge>
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">{dsar.requesterName}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {dsar.status === "COMPLETED" ? (
                        <Badge variant="outline" className="text-xs border-primary bg-primary text-primary-foreground">
                          <CheckCircle2 className="inline h-3 w-3 mr-1" />
                          {tp("dsarQueue.done")}
                        </Badge>
                      ) : dsar.slaStatus === "overdue" ? (
                        <p className="text-xs sm:text-sm font-medium">
                          <Clock className="inline h-3 w-3 mr-1" />
                          <span className="text-foreground">{tp("dsarQueue.overdue")}</span>
                        </p>
                      ) : (
                        <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                          <Clock className="inline h-3 w-3 mr-1" />
                          {tp("dsarQueue.daysShort", { count: dsar.daysUntilDue ?? 0 })}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">{tp("dsarQueue.empty")}</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">{tp("recentActivity.title")}</CardTitle>
            <CardDescription className="text-xs sm:text-sm">{tp("recentActivity.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
            {recentActivity.length > 0 ? (
              recentActivity.slice(0, 4).map((activity) => (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className="mt-0.5 p-1.5 border border-muted-foreground text-muted-foreground shrink-0">
                    <Clock className="h-3 w-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm truncate">
                      {enumLabel("auditAction", activity.action)} · {enumLabel("auditEntity", activity.entityType)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTimeIn(activity.createdAt, locale)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">{tp("recentActivity.empty")}</p>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">{tp("quickActions.title")}</CardTitle>
            <CardDescription className="text-xs sm:text-sm">{tp("quickActions.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 grid-cols-1 sm:grid-cols-2 p-4 pt-0 sm:p-6 sm:pt-0">
            {/* Two clicks to a new DPIA: here, then Create. The type is
                pre-selected, so the form opens straight on the details. */}
            {/* A gated type is labelled, not hidden (the owner decides later
                whether it is offered); the form repeats the label. */}
            {/* On the pilot tier the action says the two DPIAs are free for a
                limited time (the server count; nothing off the pilot tier). */}
            {/* When gated, the label and the badge both stay whole: the button
                grows and the badge wraps under the label in a narrow column,
                rather than cutting the label to "Start a ...". */}
            <div>
              <Link href="/privacy/assessments/new?type=DPIA">
                <Button
                  variant="outline"
                  className="w-full justify-start h-auto sm:h-auto min-h-11 py-2 whitespace-normal text-left flex-wrap gap-y-1"
                >
                  <ClipboardCheck className="w-4 h-4 mr-2 shrink-0" />
                  <span className="min-w-0">{tp("quickActions.newDpia")}</span>
                  {dpiaGated && (
                    <Badge
                      variant="secondary"
                      className="ml-auto shrink-0 whitespace-nowrap bg-amber-100 text-amber-800 hover:bg-amber-100 text-xs"
                      data-testid="quick-action-dpia-gated"
                    >
                      <Lock className="w-3 h-3 mr-1" aria-hidden="true" />
                      {tp("quickActions.premium")}
                    </Badge>
                  )}
                </Button>
              </Link>
              <DpiaFreeNote className="mt-1 px-1" />
            </div>
            <Link href="/privacy/data-inventory/new">
              <Button variant="outline" className="w-full justify-start h-11">
                <Database className="w-4 h-4 mr-2 shrink-0" />
                <span className="truncate">{tp("quickActions.addAsset")}</span>
              </Button>
            </Link>
            {canHandleDsars !== false && (
              <Link href="/privacy/dsar">
                <Button variant="outline" className="w-full justify-start h-11">
                  <FileText className="w-4 h-4 mr-2 shrink-0" />
                  <span className="truncate">{tp("quickActions.newDsar")}</span>
                </Button>
              </Link>
            )}
            <Link href="/privacy/incidents/new">
              <Button variant="outline" className="w-full justify-start h-11">
                <AlertTriangle className="w-4 h-4 mr-2 shrink-0" />
                <span className="truncate">{tp("quickActions.reportIncident")}</span>
              </Button>
            </Link>
            <Link href="/privacy/vendors/new">
              <Button variant="outline" className="w-full justify-start h-11">
                <Building2 className="w-4 h-4 mr-2 shrink-0" />
                <span className="truncate">{tp("quickActions.addVendor")}</span>
              </Button>
            </Link>
            {orgWide && (
            <Link href="/privacy/quickstart">
              <Button variant="outline" className="w-full justify-start h-11">
                <Sparkles className="w-4 h-4 mr-2 shrink-0" />
                <span className="truncate">{tp("quickActions.quickstart")}</span>
              </Button>
            </Link>
            )}
          </CardContent>
        </Card>

        {/* Vendor Overview */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base sm:text-lg">{tp("vendors.title")}</CardTitle>
                <CardDescription className="text-xs sm:text-sm">{tp("vendors.countLine", { total: dashboardStats.totalVendors, active: dashboardStats.activeVendors })}</CardDescription>
              </div>
              <Link href="/privacy/vendors">
                <Button variant="ghost" size="sm" className="shrink-0">
                  <span className="hidden sm:inline">{tp("dsarQueue.viewAll")}</span>
                  <ArrowRight className="sm:ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
            {vendorList?.vendors && vendorList.vendors.length > 0 ? (
              vendorList.vendors.map((vendor) => (
                <Link key={vendor.id} href={`/privacy/vendors/${vendor.id}`} className="block rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  <div className="flex items-center gap-3 p-2 -mx-2 hover:bg-muted/50 transition-colors">
                    <div className="p-1.5 border border-primary/50 text-primary shrink-0">
                      <Building2 className="h-3 w-3" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{vendor.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{vendor.categories?.[0] || tp("vendors.categoryFallback")}</p>
                    </div>
                    {vendor.riskTier && (
                      <StatusChip tone={toneForRiskTier(vendor.riskTier)} className="text-xs shrink-0">
                        {enumLabel("riskLevel", vendor.riskTier)}
                      </StatusChip>
                    )}
                  </div>
                </Link>
              ))
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs sm:text-sm">{tp("vendors.empty")}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Organization Dialog (Classic's switcher; Guided reaches the
          same dialog from "Add a client" on All clients). */}
      <NewOrganizationDialog open={createOrgOpen} onOpenChange={setCreateOrgOpen} />
    </div>
  );
}
