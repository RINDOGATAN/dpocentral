"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useEffect } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Plus,
  Clock,
  AlertCircle,
  Download,
  FileSpreadsheet,
  FileText,
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
import { ExpertHelpCta } from "@/components/privacy/expert-help-cta";
import { useTranslations } from "next-intl";
import { ListFilterBar } from "@/components/privacy/list-filter-bar";
import { useListFilters } from "@/lib/use-list-filters";
import { sortByListSort, DEFAULT_LIST_SORT } from "@/lib/list-sort";
import { PageHeader } from "@/components/privacy/page-header";
import { StatusChip, StatusMark } from "@/components/ui/status-chip";
import { toneForRiskTier } from "@/config/status-tone";

// Severity goes through the shared tones. The old map printed CRITICAL as
// white on mid grey, 2.59 to 1, and told the four levels apart by weight alone.

const statusColors: Record<string, string> = {
  REPORTED: "border-primary text-primary",
  INVESTIGATING: "border-primary text-primary",
  CONTAINED: "border-muted-foreground text-muted-foreground",
  ERADICATED: "border-primary text-primary",
  RECOVERING: "border-muted-foreground text-muted-foreground",
  CLOSED: "border-primary bg-primary text-primary-foreground",
  FALSE_POSITIVE: "border-muted-foreground text-muted-foreground",
};

export default function IncidentsPage() {
  const t = useTranslations("pages.incidents");
  const { def, filters, setFilter, applyAll, clearAll } = useListFilters("incidents");
  const { organization } = useOrganization();

  const {
    data: incidentsPages,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = trpc.incident.list.useInfiniteQuery(
    { organizationId: organization?.id ?? "", search: filters.q || undefined, limit: 100 },
    {
      enabled: !!organization?.id,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const incidentsData = { incidents: incidentsPages?.pages.flatMap((p) => p.incidents) ?? [] };

  const { data: statsData } = trpc.incident.getStats.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id }
  );

  const incidents = incidentsData?.incidents ?? [];
  const bySeverity = statsData?.bySeverity as Record<string, number> | undefined;
  const stats = {
    total: statsData?.total ?? 0,
    open: statsData?.open ?? 0,
    critical: bySeverity?.CRITICAL ?? 0,
    pendingNotification: statsData?.overdueNotifications ?? 0,
  };

  const filteredIncidents = incidents.filter(
    (i) =>
      (!filters.status || i.status === filters.status) &&
      (!filters.severity || i.severity === filters.severity) &&
      (!filters.type || i.type === filters.type),
  );

  const sortedIncidents = sortByListSort(filteredIncidents, filters.sort ?? DEFAULT_LIST_SORT, {
    date: (i) => i.createdAt,
    name: (i) => i.title,
  });

  const noFilters = !filters.q && !filters.status && !filters.severity && !filters.type;

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
              <DropdownMenuItem onClick={() => window.open(`/api/export/breach-register?organizationId=${organization?.id}`, "_blank")}>
                <FileText className="w-4 h-4 mr-2" />
                {t("exportPdf")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.open(`/api/export/breach-register?organizationId=${organization?.id}&format=csv`, "_blank")}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                {t("exportCsv")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Link href="/privacy/incidents/new" className="flex-1 sm:flex-none">
            <Button className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              {t("reportIncident")}
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
            <div className="text-xl sm:text-2xl font-bold text-foreground">
              {stats.critical}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 inline-flex items-center gap-1">
              {stats.critical > 0 && <StatusMark tone="danger" className="h-3.5 w-3.5" />}
              {t("stats.critical")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:pt-6">
            <div className="text-xl sm:text-2xl font-bold text-foreground">{stats.pendingNotification}</div>
            <p className="text-xs sm:text-sm text-muted-foreground">{t("stats.pendingDpa")}</p>
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

      {/* Incident List */}
      {isLoading ? (
        <ListPageSkeleton />
      ) : sortedIncidents.length > 0 ? (
        <div className="flex flex-col gap-4">
          {sortedIncidents.map((incident) => (
            <Link key={incident.id} href={`/privacy/incidents/${incident.id}`} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardContent className="p-4">
                  {/* Mobile Layout - Stacked */}
                  <div className="flex flex-col gap-3 sm:hidden">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium font-mono text-primary text-sm">{incident.publicId}</span>
                      <StatusChip tone={toneForRiskTier(incident.severity)} className="text-xs shrink-0">
                        {t(`severity.${incident.severity}`)}
                      </StatusChip>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {incident.title}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">{t(`type.${incident.type}`)}</Badge>
                      <Badge variant="outline" className={`text-xs ${statusColors[incident.status] || ""}`}>
                        {t(`status.${incident.status}`)}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{t("card.recordsShort", { count: incident.affectedRecords ?? 0 })}</span>
                      <span>
                        <Clock className="inline h-3 w-3 mr-1" />
                        {new Date(incident.discoveredAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Desktop Layout - Horizontal */}
                  <div className="hidden sm:flex items-center gap-6">
                    <div className={`w-10 h-10 flex items-center justify-center border-2 shrink-0 ${
                      incident.severity === "CRITICAL" ? "border-muted-foreground bg-muted-foreground/30" :
                      incident.severity === "HIGH" ? "border-muted-foreground bg-muted-foreground/20" :
                      incident.severity === "MEDIUM" ? "border-muted-foreground" :
                      "border-primary"
                    }`}>
                      {incident.severity === "CRITICAL" || incident.severity === "HIGH" ? (
                        <AlertTriangle className="w-5 h-5 text-foreground" />
                      ) : (
                        <AlertCircle className={`w-5 h-5 ${
                          incident.severity === "MEDIUM" ? "text-muted-foreground" : "text-primary"
                        }`} />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium font-mono text-primary">{incident.publicId}</span>
                        <Badge variant="outline">{t(`type.${incident.type}`)}</Badge>
                        <StatusChip tone={toneForRiskTier(incident.severity)}>
                          {t(`severity.${incident.severity}`)}
                        </StatusChip>
                        <Badge variant="outline" className={statusColors[incident.status] || ""}>
                          {t(`status.${incident.status}`)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate mt-1">
                        {incident.title}
                      </p>
                    </div>

                    <div className="text-center shrink-0">
                      <p className="text-lg font-semibold text-primary">
                        {incident.affectedRecords?.toLocaleString() ?? 0}
                      </p>
                      <p className="text-xs text-muted-foreground">{t("card.records")}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-sm text-muted-foreground">
                        <Clock className="inline w-3 h-3 mr-1" />
                        {new Date(incident.discoveredAt).toLocaleDateString()}
                      </p>
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
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>{t("emptyAll.title")}</p>
            <p className="text-sm mb-4">{t("emptyAll.subtitle")}</p>
            <Link href="/privacy/incidents/new">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                {t("reportIncident")}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>{t("emptyFiltered")}</p>
          </CardContent>
        </Card>
      )}

      <ExpertHelpCta context="incident" />
    </div>
  );
}
