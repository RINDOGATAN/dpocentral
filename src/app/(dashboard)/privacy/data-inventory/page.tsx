"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Database,
  Plus,
  Server,
  Cloud,
  Building2,
  FileSpreadsheet,
  ArrowRight,
  Loader2,
  Lock,
  Download,
  FileText,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { useTranslations } from "next-intl";
import { ExpertHelpCta } from "@/components/privacy/expert-help-cta";
import { ListFilterBar } from "@/components/privacy/list-filter-bar";
import { useListFilters } from "@/lib/use-list-filters";
import { sortByListSort, DEFAULT_LIST_SORT } from "@/lib/list-sort";
import { TemplateBadge } from "@/components/privacy/template-badge";
import { DraftBadge, DraftsNotice } from "@/components/privacy/draft-confirm";
import { PageHeader } from "@/components/privacy/page-header";
import { ListPageSkeleton } from "@/components/skeletons/list-page-skeleton";
import { EnableFeatureModal } from "@/components/premium/enable-feature-modal";
import { useHostedPilot } from "@/components/pilot/hosted-pilot";
import { useOrgRole } from "@/lib/use-org-role";


const DataFlowVisualization = dynamic(
  () => import("@/components/privacy/data-flow/DataFlowVisualization").then((m) => m.DataFlowVisualization),
  { loading: () => <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> }
);

const assetTypeIcons: Record<string, any> = {
  DATABASE: Server,
  APPLICATION: Database,
  CLOUD_SERVICE: Cloud,
  THIRD_PARTY: Building2,
  FILE_SYSTEM: FileSpreadsheet,
};

/** The tabs an address can open directly (`?tab=flows`). */
const INVENTORY_TABS = ["assets", "flows"] as const;

/** The one home of processing activities and of transfers. */
const ACTIVITIES_HREF = "/privacy/data-inventory/processing-activities";
const TRANSFERS_HREF = "/privacy/transfers";

/** A link that sits in the tab row and looks like a tab. */
const TAB_LINK_CLASS =
  "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-xs sm:text-sm font-medium text-muted-foreground transition-all hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function DataInventoryPage() {
  const t = useTranslations("pages.dataInventory");
  // Asset type labels live with the create-asset form; reuse them rather than
  // rendering the raw enum, which showed as English on the Spanish UI.
  const tAssetType = useTranslations("pages.newAsset.assetType");
  const { def, filters, setFilter, applyAll, clearAll } = useListFilters("data-inventory");
  const { organization } = useOrganization();
  const { canWrite } = useOrgRole();
  const router = useRouter();
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  // `?tab=` opens a tab directly (the quick start links the flows). The old
  // activities and transfers tabs, and `?new=activity`, now live on their
  // own pages: an old address is sent there.
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab = (INVENTORY_TABS as readonly string[]).includes(tabParam ?? "") ? tabParam! : "assets";
  const wantsNewActivity = searchParams.get("new") === "activity";
  useEffect(() => {
    if (tabParam === "activities" || wantsNewActivity) {
      router.replace(wantsNewActivity ? `${ACTIVITIES_HREF}?new=activity` : ACTIVITIES_HREF);
    } else if (tabParam === "transfers") {
      router.replace(TRANSFERS_HREF);
    }
  }, [tabParam, wantsNewActivity, router]);

  const { data: ropaAccess } = trpc.dataInventory.hasRopaExportAccess.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id }
  );
  // The hosted pilot includes the export: no lock or price there.
  const hosted = useHostedPilot();
  const hasRopaAccess = hosted || (ropaAccess?.hasAccess ?? false);

  const {
    data: assetsPages,
    isLoading: assetsLoading,
    hasNextPage: hasMoreAssets,
    fetchNextPage: fetchMoreAssets,
    isFetchingNextPage: fetchingMoreAssets,
  } = trpc.dataInventory.listAssets.useInfiniteQuery(
    {
      organizationId: organization?.id ?? "",
      search: filters.q || undefined,
      department: filters.dept || undefined,
      limit: 50,
    },
    {
      enabled: !!organization?.id,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  // Counts only, for the links to Records of processing and Transfers.
  const { data: activitiesPage } = trpc.dataInventory.listActivities.useQuery(
    { organizationId: organization?.id ?? "", limit: 50 },
    { enabled: !!organization?.id }
  );
  const activitiesCount = activitiesPage?.activities.length ?? 0;
  const hasMoreActivities = !!activitiesPage?.nextCursor;

  const { data: transfers } = trpc.dataInventory.listTransfers.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id }
  );

  const rawAssets = assetsPages?.pages.flatMap((p) => p.assets) ?? [];
  const dataAssets = sortByListSort(
    filters.assetType ? rawAssets.filter((a) => a.type === filters.assetType) : rawAssets,
    filters.sort ?? DEFAULT_LIST_SORT,
    { date: (a) => a.createdAt, name: (a) => a.name },
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label={t("export")} className="shrink-0 sm:size-auto sm:px-4 sm:py-2">
                <Download className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">{t("export")}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => window.open(`/api/export/privacy-program?organizationId=${organization?.id}`, "_blank")}>
                <FileText className="w-4 h-4 mr-2" />
                {t("exportPrivacyProgram")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  if (hasRopaAccess) {
                    router.push("/privacy/data-inventory/processing-activities");
                  } else {
                    setUpgradeModalOpen(true);
                  }
                }}
              >
                {hasRopaAccess ? (
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                ) : (
                  <Lock className="w-4 h-4 mr-2 text-amber-500" />
                )}
                {t("exportRopa")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {canWrite && (
            <Link href="/privacy/data-inventory/new" className="flex-1 sm:flex-none">
              <Button className="w-full sm:w-auto">
                <Plus className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">{t("addAsset")}</span>
                <span className="sm:hidden">{t("addAssetShort")}</span>
              </Button>
            </Link>
          )}
          </>
        }
      />

      {/* Filters, search, sort, department and saved views (all in the URL) */}
      {/* Drafts the quick start or a template made: they count once confirmed. */}
      <DraftsNotice />

      <ListFilterBar
        def={def}
        organizationId={organization?.id ?? ""}
        filters={filters}
        setFilter={setFilter}
        applyAll={applyAll}
        clearAll={clearAll}
      />

      {/* Tabs */}
      <Tabs defaultValue={initialTab}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="assets" className="text-xs sm:text-sm">
            {/* More systems than this page holds: say so instead of a short count. */}
            {t("tabs.assets", { count: hasMoreAssets ? `${dataAssets.length}+` : dataAssets.length })}
          </TabsTrigger>
          <TabsTrigger value="flows" className="text-xs sm:text-sm">
            {t("tabs.flows")}
          </TabsTrigger>
          {/* Activities and transfers each have one home, in the menu: these
              two look like tabs and open those pages. */}
          <Link
            href={ACTIVITIES_HREF}
            className={TAB_LINK_CLASS}
            data-testid="inventory-activities-link"
          >
            {t("tabs.activities", { count: hasMoreActivities ? `${activitiesCount}+` : activitiesCount })}
            <ArrowRight className="w-3 h-3 ml-1" aria-hidden="true" />
          </Link>
          <Link href={TRANSFERS_HREF} className={TAB_LINK_CLASS} data-testid="inventory-transfers-link">
            {transfers?.length
              ? t("tabs.transfersWithCount", { count: transfers.length })
              : t("tabs.transfers")}
            <ArrowRight className="w-3 h-3 ml-1" aria-hidden="true" />
          </Link>
        </TabsList>

        <TabsContent value="assets" className="mt-4">
          {assetsLoading ? (
            <ListPageSkeleton />
          ) : dataAssets.length > 0 ? (
            <>
              <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {dataAssets.map((asset) => {
                  const Icon = assetTypeIcons[asset.type] || Database;
                  return (
                    <Link key={asset.id} href={`/privacy/data-inventory/${asset.id}`} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 h-full">
                      <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                        <CardHeader className="pb-3 p-4 sm:p-6 sm:pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-primary/10 flex items-center justify-center shrink-0">
                              <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                            </div>
                            <Badge variant="outline" className="text-xs shrink-0">
                              {tAssetType(asset.type)}
                            </Badge>
                          </div>
                          <CardTitle className="mt-3 text-base sm:text-lg line-clamp-1">{asset.name}</CardTitle>
                          <CardDescription className="text-xs sm:text-sm">{asset.owner || t("asset.ownerEmpty")}</CardDescription>
                          <TemplateBadge metadata={asset.metadata} className="mt-1 w-fit text-xs" />
                          <DraftBadge record={asset} className="mt-1 w-fit text-xs" />
                        </CardHeader>
                        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                          <div className="flex justify-between text-xs sm:text-sm">
                            <span className="text-muted-foreground">
                              {t("asset.elements", { count: asset._count?.dataElements ?? 0 })}
                            </span>
                            <span className="text-muted-foreground">
                              {t("asset.activities", { count: asset._count?.processingActivityAssets ?? 0 })}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2 truncate">
                            {asset.location || t("asset.locationEmpty")}
                          </p>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
              {hasMoreAssets && (
                <div className="flex justify-center mt-4">
                  <Button
                    variant="outline"
                    onClick={() => fetchMoreAssets()}
                    disabled={fetchingMoreAssets}
                  >
                    {fetchingMoreAssets && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    {t("loadMore")}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{t("emptyAssets.title")}</p>
                <p className="text-sm mb-4">{t("emptyAssets.subtitle")}</p>
                {canWrite && (
                  <Link href="/privacy/data-inventory/new">
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      {t("addAsset")}
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="flows" className="mt-4">
          <DataFlowVisualization
            mode="all"
            organizationId={organization?.id ?? ""}
          />
        </TabsContent>

      </Tabs>

      {dataAssets.length === 0 && activitiesCount === 0 && (
        <ExpertHelpCta context="empty-state" />
      )}


      {/* ROPA Export Premium Gating */}
      <EnableFeatureModal
        open={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        organizationId={organization?.id ?? ""}
        skillPackageId="skill-ropa-export"
        skillName="ROPA Export"
      />
    </div>
  );
}
