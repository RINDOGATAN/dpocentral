"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useEffect } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Plus,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Settings,
  ExternalLink,
  Lock,
  Download,
} from "lucide-react";
import { COMING_SOON_SKILL_IDS, SKILL_PACKAGE_IDS } from "@/config/skill-packages";
import { ListPageSkeleton } from "@/components/skeletons/list-page-skeleton";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { ExpertHelpCta } from "@/components/privacy/expert-help-cta";
import { useTranslations, useLocale } from "next-intl";
import { ListFilterBar } from "@/components/privacy/list-filter-bar";
import { useListFilters } from "@/lib/use-list-filters";
import { sortByListSort, DEFAULT_LIST_SORT } from "@/lib/list-sort";
import { PageHeader } from "@/components/privacy/page-header";
import { StatusChip, StatusMark } from "@/components/ui/status-chip";
import { toneMark } from "@/config/status-palette";

import { formatDateIn } from "@/lib/utils";
const statusColors: Record<string, string> = {
  SUBMITTED: "border-primary text-primary",
  IDENTITY_PENDING: "border-muted-foreground text-muted-foreground",
  IDENTITY_VERIFIED: "border-primary text-primary",
  IN_PROGRESS: "border-primary text-primary",
  DATA_COLLECTED: "border-primary text-primary",
  REVIEW_PENDING: "border-muted-foreground text-muted-foreground",
  COMPLETED: "border-primary bg-primary text-primary-foreground",
  REJECTED: "border-muted-foreground text-muted-foreground",
};

const isPortalComingSoon = COMING_SOON_SKILL_IDS.has(SKILL_PACKAGE_IDS.DSAR_PORTAL);

export default function DSARPage() {
  const t = useTranslations("pages.dsar");
  const locale = useLocale();
  const { def, filters, setFilter, applyAll, clearAll } = useListFilters("dsar");
  const { organization } = useOrganization();

  const {
    data: dsarPages,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = trpc.dsar.list.useInfiniteQuery(
    { organizationId: organization?.id ?? "", search: filters.q || undefined, limit: 100 },
    {
      enabled: !!organization?.id,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  const dsarData = { requests: dsarPages?.pages.flatMap((p) => p.requests) ?? [] };

  const { data: statsData } = trpc.dsar.getStats.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id }
  );

  const requests = dsarData?.requests ?? [];
  const byStatus = statsData?.byStatus as Record<string, number> | undefined;
  const stats = {
    total: statsData?.total ?? 0,
    open: (byStatus?.SUBMITTED ?? 0) +
          (byStatus?.IDENTITY_PENDING ?? 0) +
          (byStatus?.IDENTITY_VERIFIED ?? 0) +
          (byStatus?.IN_PROGRESS ?? 0) +
          (byStatus?.DATA_COLLECTED ?? 0) +
          (byStatus?.REVIEW_PENDING ?? 0),
    overdue: statsData?.overdue ?? 0,
    atRisk: 0,
  };

  const filteredRequests = requests.filter(
    (r) =>
      (!filters.type || r.type === filters.type) &&
      (!filters.status || r.status === filters.status),
  );

  const sortedRequests = sortByListSort(filteredRequests, filters.sort ?? DEFAULT_LIST_SORT, {
    date: (r) => r.createdAt,
    name: (r) => r.requesterName ?? "",
  });

  const noFilters = !filters.q && !filters.type && !filters.status;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <>
          <Button
            variant="outline"
            size="icon"
            aria-label={t("exportReport")}
            className="shrink-0 sm:size-auto sm:px-4 sm:py-2"
            onClick={() =>
              organization?.id &&
              window.open(
                `/api/export/dsar-performance?organizationId=${organization.id}`,
                "_blank"
              )
            }
          >
            <Download className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">{t("exportReport")}</span>
          </Button>
          {isPortalComingSoon ? (
            <div className="sm:flex-none">
              <Button variant="outline" size="icon" aria-label={t("settings")} className="shrink-0 sm:size-auto sm:px-4 sm:py-2" disabled>
                <Lock className={`w-4 h-4 sm:mr-2 ${toneMark("warning")}`} />
                <span className="hidden sm:inline">{t("settings")}</span>
                <StatusChip tone="warning" className="ml-2 text-[10px] px-1.5 py-0 hidden sm:inline-flex">{t("comingSoon")}</StatusChip>
              </Button>
            </div>
          ) : (
            <Link href="/privacy/dsar/settings" className="sm:flex-none">
              <Button variant="outline" size="icon" aria-label={t("settings")} className="shrink-0 sm:size-auto sm:px-4 sm:py-2">
                <Settings className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">{t("settings")}</span>
              </Button>
            </Link>
          )}
          <Link href="/privacy/dsar/new" className="flex-1 sm:flex-none">
            <Button className="w-full sm:w-auto">
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">{t("newRequest")}</span>
              <span className="sm:hidden">{t("newRequestShort")}</span>
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
            <div className="text-xl sm:text-2xl font-bold text-foreground">{stats.open}</div>
            <p className="text-xs sm:text-sm text-muted-foreground">{t("stats.open")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:pt-6">
            <div className="text-xl sm:text-2xl font-bold text-foreground">{stats.overdue}</div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 inline-flex items-center gap-1">
              {stats.overdue > 0 && <StatusMark tone="warning" className="h-3.5 w-3.5" />}
              {t("stats.overdue")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:pt-6">
            <div className="text-xl sm:text-2xl font-bold text-foreground">{stats.atRisk}</div>
            <p className="text-xs sm:text-sm text-muted-foreground">{t("stats.atRisk")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters, search, sort and saved views (all in the URL) */}
      <ListFilterBar
        def={def}
        organizationId={organization?.id ?? ""}
        filters={filters}
        setFilter={setFilter}
        applyAll={applyAll}
        clearAll={clearAll}
      />

      {/* Request List */}
      {isLoading ? (
        <ListPageSkeleton />
      ) : sortedRequests.length > 0 ? (
        <div className="flex flex-col gap-4">
          {sortedRequests.map((request) => (
            <Link key={request.id} href={`/privacy/dsar/${request.id}`} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardContent className="p-4">
                  {/* Mobile Layout - Stacked */}
                  <div className="flex flex-col gap-3 sm:hidden">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="font-medium font-mono text-primary text-sm break-all min-w-0">{request.publicId}</span>
                        <Badge variant="outline" className="text-xs">{t(`type.${request.type}`)}</Badge>
                      </div>
                      <Badge variant="outline" className={`text-xs shrink-0 ${statusColors[request.status] || ""}`}>
                        {t(`status.${request.status}`)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {request.requesterName} - {request.requesterEmail}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{t("card.tasksShort", { count: request._count?.tasks ?? 0 })}</span>
                      {request.status === "COMPLETED" || request.status === "REJECTED" ? (
                        <span>
                          <Clock className="inline h-3 w-3 mr-1" />
                          {formatDateIn(new Date(request.dueDate), locale)}
                        </span>
                      ) : (
                        <span className={request.slaStatus === "overdue" ? "font-medium" : ""}>
                          {request.slaStatus === "overdue" ? (
                            <StatusMark tone="warning" className="inline h-3 w-3 mr-1" />
                          ) : (
                            <Clock className="inline h-3 w-3 mr-1" />
                          )}
                          {request.slaStatus === "overdue"
                            ? t("card.daysOverdueShort", { count: Math.abs(request.daysUntilDue ?? 0) })
                            : request.daysUntilDue === 0
                              ? t("card.dueToday")
                              : t("card.daysLeftShort", { count: request.daysUntilDue ?? 0 })
                          }
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Desktop Layout - Horizontal */}
                  <div className="hidden sm:flex items-center gap-6">
                    <div className={`w-10 h-10 flex items-center justify-center border-2 shrink-0 ${
                      request.status === "COMPLETED"
                        ? "border-primary bg-primary"
                        : request.status === "REJECTED"
                          ? "border-muted-foreground"
                          : request.slaStatus === "overdue"
                            ? "border-muted-foreground bg-muted-foreground/20"
                            : "border-primary"
                    }`}>
                      {request.status === "COMPLETED" ? (
                        <CheckCircle2 className="w-5 h-5 text-primary-foreground" />
                      ) : request.status === "REJECTED" ? (
                        <FileText className="w-5 h-5 text-muted-foreground" />
                      ) : request.slaStatus === "overdue" ? (
                        <AlertTriangle className="w-5 h-5 text-foreground" />
                      ) : (
                        <Clock className="w-5 h-5 text-primary" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium font-mono text-primary">{request.publicId}</span>
                        <Badge variant="outline">{t(`type.${request.type}`)}</Badge>
                        <Badge variant="outline" className={statusColors[request.status] || ""}>
                          {t(`status.${request.status}`)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {request.requesterName} - {request.requesterEmail}
                      </p>
                    </div>

                    <div className="text-center shrink-0">
                      <p className="text-lg font-semibold text-primary">
                        {request._count?.tasks ?? 0}
                      </p>
                      <p className="text-xs text-muted-foreground">{t("card.tasks")}</p>
                    </div>

                    <div className="text-right shrink-0">
                      {request.status === "COMPLETED" || request.status === "REJECTED" ? (
                        <>
                          <p className="text-sm font-medium text-muted-foreground">
                            {request.status === "COMPLETED" ? t("card.completed") : t("card.rejected")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {request.dueDate ? formatDateIn(new Date(request.dueDate), locale) : t("card.naDate")}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-muted-foreground">
                            {request.slaStatus === "overdue"
                              ? (
                                <span className="inline-flex items-center gap-1 font-medium text-foreground">
                                  <StatusMark tone="warning" className="h-3.5 w-3.5" />
                                  {t("card.daysOverdue", { count: Math.abs(request.daysUntilDue ?? 0) })}
                                </span>
                              )
                              : request.daysUntilDue === 0
                                ? t("card.dueToday")
                                : t("card.daysLeft", { count: request.daysUntilDue ?? 0 })
                            }
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t("card.due", { date: request.dueDate ? formatDateIn(new Date(request.dueDate), locale) : t("card.naDate") })}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : noFilters ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>{t("emptyAll.title")}</p>
            <p className="text-sm mb-4">{t("emptyAll.subtitle")}</p>
            <Link href="/privacy/dsar/new">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                {t("newRequest")}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>{t("emptyFiltered")}</p>
          </CardContent>
        </Card>
      )}

      {/* Public Portal Link */}
      <Card>
        <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {isPortalComingSoon ? (
            <>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm sm:text-base">{t("publicPortal.title")}</p>
                  <StatusChip tone="warning" className="text-[10px] px-1.5 py-0">{t("comingSoon")}</StatusChip>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {t("publicPortal.comingSoonSubtitle")}
                </p>
              </div>
              <Button variant="outline" className="w-full sm:w-auto" disabled>
                <Lock className={`w-4 h-4 mr-2 ${toneMark("warning")}`} />
                {t("publicPortal.open")}
              </Button>
            </>
          ) : (
            <>
              <div>
                <p className="font-medium text-sm sm:text-base">{t("publicPortal.title")}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {t("publicPortal.subtitle")}
                </p>
              </div>
              <a href={`/dsar/${organization?.slug || ""}`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="w-full sm:w-auto">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  {t("publicPortal.open")}
                </Button>
              </a>
            </>
          )}
        </CardContent>
      </Card>

      <ExpertHelpCta context="dsar" />
    </div>
  );
}
