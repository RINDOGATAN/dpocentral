"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Plus,
  FileText,
  Clock,
  Database,
  Lock,
  Mail,
  Sparkles,
  Download,
  FileSpreadsheet,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ListPageSkeleton } from "@/components/skeletons/list-page-skeleton";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { EnableFeatureModal } from "@/components/premium/enable-feature-modal";
import { SKILL_PACKAGE_IDS, SKILL_DISPLAY_NAMES } from "@/config/skill-packages";
import { features } from "@/config/features";
import { useHostedPilot } from "@/components/pilot/hosted-pilot";
import { brand } from "@/config/brand";
import { formatPrice } from "@/lib/currency";
import { ExpertHelpCta } from "@/components/privacy/expert-help-cta";
import { useTranslations, useLocale } from "next-intl";
import { ListFilterBar } from "@/components/privacy/list-filter-bar";
import { useListFilters } from "@/lib/use-list-filters";
import { sortByListSort, DEFAULT_LIST_SORT } from "@/lib/list-sort";
import { TemplateBadge } from "@/components/privacy/template-badge";
import { PageHeader } from "@/components/privacy/page-header";
import { StatusChip, StatusMark } from "@/components/ui/status-chip";
import { toneBorder, toneMark, toneTint } from "@/config/status-palette";
import { toneForRiskTier } from "@/config/status-tone";

import { formatDateIn } from "@/lib/utils";
const statusColors: Record<string, string> = {
  PROSPECTIVE: "border-muted-foreground text-muted-foreground",
  ACTIVE: "border-primary bg-primary text-primary-foreground",
  UNDER_REVIEW: "border-muted-foreground text-muted-foreground",
  SUSPENDED: "border-muted-foreground text-muted-foreground",
  TERMINATED: "border-muted-foreground text-muted-foreground",
};

// Risk tier goes through the shared tones, the same ones the vendor register
// report prints. The old map was 2.59 to 1 at CRITICAL.

export default function VendorsPage() {
  const t = useTranslations("pages.vendors");
  const locale = useLocale();
  const { def, filters, setFilter, applyAll, clearAll } = useListFilters("vendors");
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const { organization } = useOrganization();

  const {
    data: vendorsPages,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = trpc.vendor.list.useInfiniteQuery(
    { organizationId: organization?.id ?? "", search: filters.q || undefined, limit: 100 },
    {
      enabled: !!organization?.id,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  const vendorsData = { vendors: vendorsPages?.pages.flatMap((p) => p.vendors) ?? [] };

  const { data: statsData } = trpc.vendor.getStats.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id }
  );

  const { data: catalogAccess } = trpc.vendor.hasVendorCatalogAccess.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id }
  );

  // The hosted pilot includes the catalogue: never show its lock or price there,
  // not even while the access query loads.
  const hosted = useHostedPilot();
  const hasVendorCatalog = hosted || (catalogAccess?.hasAccess ?? false);

  const vendors = vendorsData?.vendors ?? [];
  const byStatus = statsData?.byStatus as Record<string, number> | undefined;
  const byRiskTier = statsData?.byRiskTier as Record<string, number> | undefined;
  const stats = {
    total: statsData?.total ?? 0,
    active: byStatus?.ACTIVE ?? 0,
    highRisk: (byRiskTier?.HIGH ?? 0) + (byRiskTier?.CRITICAL ?? 0),
    pendingReview: byStatus?.UNDER_REVIEW ?? 0,
  };

  const filteredVendors = vendors.filter(
    (v) =>
      (!filters.status || v.status === filters.status) &&
      (!filters.riskTier || v.riskTier === filters.riskTier),
  );

  const sortedVendors = sortByListSort(filteredVendors, filters.sort ?? DEFAULT_LIST_SORT, {
    date: (v) => v.createdAt,
    name: (v) => v.name,
  });

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
              <Button variant="outline" size="icon" aria-label={t("exportRegister")} className="shrink-0 sm:size-auto sm:px-4 sm:py-2">
                <Download className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">{t("exportRegister")}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => window.open(`/api/export/vendor-register?organizationId=${organization?.id}`, "_blank")}>
                <FileText className="w-4 h-4 mr-2" />
                {t("exportPdf")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.open(`/api/export/vendor-register?organizationId=${organization?.id}&format=csv`, "_blank")}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                {t("exportCsv")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Link href="/privacy/vendors/questionnaires" className="sm:flex-none">
            <Button variant="outline" size="icon" aria-label={t("questionnaires")} className="shrink-0 sm:size-auto sm:px-4 sm:py-2">
              <FileText className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">{t("questionnaires")}</span>
            </Button>
          </Link>
          <Link href="/privacy/vendors/new" className="flex-1 sm:flex-none">
            <Button className="w-full sm:w-auto">
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">{t("addVendor")}</span>
              <span className="sm:hidden">{t("addVendorShort")}</span>
            </Button>
          </Link>
          </>
        }
      />

      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4 sm:pt-6">
            <div className="text-xl sm:text-2xl font-bold text-foreground">{stats.total}</div>
            <p className="text-xs sm:text-sm text-muted-foreground">{t("stats.total")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:pt-6">
            <div className="text-xl sm:text-2xl font-bold text-foreground">{stats.active}</div>
            <p className="text-xs sm:text-sm text-muted-foreground">{t("stats.active")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:pt-6">
            <div className="text-xl sm:text-2xl font-bold text-foreground">{stats.highRisk}</div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 inline-flex items-center gap-1">
              {stats.highRisk > 0 && <StatusMark tone="warning" className="h-3.5 w-3.5" />}
              {t("stats.highRisk")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:pt-6">
            <div className="text-xl sm:text-2xl font-bold text-foreground">{stats.pendingReview}</div>
            <p className="text-xs sm:text-sm text-muted-foreground">{t("stats.pendingReview")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Vendor Catalog Feature Card */}
      {hasVendorCatalog ? (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 border-2 border-primary flex items-center justify-center shrink-0">
                  <Database className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm sm:text-base">{t("catalog.title")}</h3>
                    <Badge className="bg-primary">{t("catalog.active")}</Badge>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {t("catalog.subtitle")}
                  </p>
                </div>
              </div>
              <Link href="/privacy/vendors/new?catalog=true">
                <Button className="w-full sm:w-auto">
                  <Sparkles className="w-4 h-4 mr-2" />
                  {t("catalog.addFromCatalog")}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className={`border-dashed ${toneBorder("warning")} ${toneTint("warning")}`}>
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 border-2 flex items-center justify-center shrink-0 ${toneBorder("warning")}`}>
                  <Lock className={`w-5 h-5 sm:w-6 sm:h-6 ${toneMark("warning")}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm sm:text-base">{t("catalog.title")}</h3>
                    <StatusChip tone="warning" hideIcon>
                      {formatPrice(9)}{t("catalog.perMonth")}
                    </StatusChip>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {t("catalog.lockedSubtitle")}
                  </p>
                </div>
              </div>
              {features.selfServiceUpgrade ? (
                <Button variant="outline" className="w-full sm:w-auto" onClick={() => setUpgradeModalOpen(true)}>
                  <Sparkles className="w-4 h-4 mr-2" />
                  {t("catalog.enable")}
                </Button>
              ) : (
                <Button variant="outline" className="w-full sm:w-auto" asChild>
                  <a href={`mailto:${brand.supportEmail}?subject=${encodeURIComponent(brand.name + " Vendor Catalog")}`}>
                    <Mail className="w-4 h-4 mr-2" />
                    {t("catalog.contactUs")}
                  </a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters, search, sort and saved views (all in the URL) */}
      <ListFilterBar
        def={def}
        organizationId={organization?.id ?? ""}
        filters={filters}
        setFilter={setFilter}
        applyAll={applyAll}
        clearAll={clearAll}
      />

      {/* Vendor List */}
      {isLoading ? (
        <ListPageSkeleton />
      ) : sortedVendors.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {sortedVendors.map((vendor) => (
            <Link key={vendor.id} href={`/privacy/vendors/${vendor.id}`} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 h-full">
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 border-2 border-primary flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline" className={statusColors[vendor.status] || ""}>
                        {t(`status.${vendor.status}`)}
                      </Badge>
                      {vendor.riskTier && (
                        <StatusChip tone={toneForRiskTier(vendor.riskTier)}>
                          {t("card.riskBadge", { level: t(`riskTier.${vendor.riskTier}`) })}
                        </StatusChip>
                      )}
                    </div>
                  </div>
                  <CardTitle className="mt-3">{vendor.name}</CardTitle>
                  <CardDescription>
                    {(vendor.categories as string[])?.join(" - ") || t("card.noCategories")}
                  </CardDescription>
                  <TemplateBadge metadata={vendor.metadata} className="mt-1 w-fit text-xs" />
                </CardHeader>
                <CardContent className="space-y-3">
                  {vendor.dataProcessed && (vendor.dataProcessed as string[]).length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">{t("card.dataProcessed")}</p>
                      <div className="flex flex-wrap gap-1">
                        {(vendor.dataProcessed as string[]).slice(0, 3).map((data) => (
                          <Badge key={data} variant="outline" className="text-xs">
                            {data.replace("_", " ")}
                          </Badge>
                        ))}
                        {(vendor.dataProcessed as string[]).length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            {t("card.moreItems", { count: (vendor.dataProcessed as string[]).length - 3 })}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t border-border">
                    <span>
                      <Clock className="inline w-3 h-3 mr-1" />
                      {t("card.added", { date: formatDateIn(new Date(vendor.createdAt), locale) })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : !filters.status && !filters.riskTier && !filters.q ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>{t("emptyAll.title")}</p>
            <p className="text-sm mb-4">{t("emptyAll.subtitle")}</p>
            <Link href="/privacy/vendors/new">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                {t("addVendor")}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>{t("emptyFiltered")}</p>
          </CardContent>
        </Card>
      )}

      <ExpertHelpCta context="vendor" />

      {/* Enable Feature Modal */}
      <EnableFeatureModal
        open={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        organizationId={organization?.id ?? ""}
        skillPackageId={SKILL_PACKAGE_IDS.VENDOR_CATALOG}
        skillName={SKILL_DISPLAY_NAMES.VENDOR_CATALOG}
        skillDescription={t("catalog.modalDescription")}
      />
    </div>
  );
}
