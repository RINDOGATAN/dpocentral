"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardCheck,
  Plus,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Lock,
  Download,
} from "lucide-react";
import { ListPageSkeleton } from "@/components/skeletons/list-page-skeleton";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { StatusChip, StatusMark } from "@/components/ui/status-chip";
import { toneForRiskTier } from "@/config/status-tone";
import { ExpertHelpCta } from "@/components/privacy/expert-help-cta";
import { features } from "@/config/features";
import { useTranslations } from "next-intl";
import { ListFilterBar } from "@/components/privacy/list-filter-bar";
import { useListFilters } from "@/lib/use-list-filters";
import { sortByListSort, DEFAULT_LIST_SORT } from "@/lib/list-sort";
import { useEnumLabels } from "@/lib/enum-labels";
import { PageHeader } from "@/components/privacy/page-header";
import { useHostedPilot } from "@/components/pilot/hosted-pilot";
import { sellingEnabled } from "@/lib/premium-gate";

const statusColors: Record<string, string> = {
  DRAFT: "border-muted-foreground text-muted-foreground",
  IN_PROGRESS: "border-primary text-primary",
  PENDING_REVIEW: "border-muted-foreground text-muted-foreground",
  PENDING_APPROVAL: "border-muted-foreground text-muted-foreground",
  APPROVED: "border-primary bg-primary text-primary-foreground",
  REJECTED: "border-muted-foreground text-muted-foreground",
};

// Risk level goes through the shared tones, so each level shows its own icon
// beside its own word. The old map printed CRITICAL as white on mid grey, which
// was 2.59 to 1 and unreadable.

export default function AssessmentsPage() {
  const t = useTranslations("pages.assessments");
  const { def, filters, setFilter, applyAll, clearAll } = useListFilters("assessments");
  const { label: enumLabel } = useEnumLabels();
  const { organization } = useOrganization();
  const hosted = useHostedPilot();

  const { data: assessmentsData, isLoading } = trpc.assessment.list.useQuery(
    { organizationId: organization?.id ?? "", search: filters.q || undefined },
    { enabled: !!organization?.id }
  );

  const { data: templatesData } = trpc.assessment.listTemplates.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id }
  );

  const { data: statsData } = trpc.assessment.getStats.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id }
  );

  const assessments = assessmentsData?.assessments ?? [];
  const templates = templatesData ?? [];

  const byStatus = statsData?.byStatus as Record<string, number> | undefined;
  const byRiskLevel = statsData?.byRiskLevel as Record<string, number> | undefined;
  const inProgressCount = (byStatus?.DRAFT ?? 0) + (byStatus?.IN_PROGRESS ?? 0);
  const pendingReviewCount = (byStatus?.PENDING_REVIEW ?? 0) + (byStatus?.PENDING_APPROVAL ?? 0);
  const highRiskCount = (byRiskLevel?.HIGH ?? 0) + (byRiskLevel?.CRITICAL ?? 0);

  const filteredAssessments = assessments.filter(
    (a) =>
      (!filters.type || a.template?.type === filters.type) &&
      (!filters.status || a.status === filters.status),
  );

  const sortedAssessments = sortByListSort(filteredAssessments, filters.sort ?? DEFAULT_LIST_SORT, {
    date: (a) => a.createdAt,
    name: (a) => a.name,
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
            aria-label={t("exportPortfolio")}
            className="shrink-0 sm:size-auto sm:px-4 sm:py-2"
            onClick={() =>
              organization?.id &&
              window.open(
                `/api/export/assessment-portfolio?organizationId=${organization.id}`,
                "_blank"
              )
            }
            disabled={!assessments.length}
          >
            <Download className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">{t("exportPortfolio")}</span>
          </Button>
          <Link href="/privacy/assessments/templates" className="sm:flex-none">
            <Button variant="outline" size="icon" aria-label={t("templates")} className="shrink-0 sm:size-auto sm:px-4 sm:py-2">
              <FileText className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">{t("templates")}</span>
            </Button>
          </Link>
          <Link href="/privacy/assessments/new" className="flex-1 sm:flex-none">
            <Button className="w-full sm:w-auto">
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">{t("newAssessment")}</span>
              <span className="sm:hidden">{t("newAssessmentShort")}</span>
            </Button>
          </Link>
          </>
        }
      />

      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4 sm:pt-6">
            <div className="text-xl sm:text-2xl font-bold text-foreground">{assessments.length}</div>
            <p className="text-xs sm:text-sm text-muted-foreground">{t("stats.total")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:pt-6">
            <div className="text-xl sm:text-2xl font-bold text-foreground">{inProgressCount}</div>
            <p className="text-xs sm:text-sm text-muted-foreground">{t("stats.inProgress")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:pt-6">
            <div className="text-xl sm:text-2xl font-bold text-foreground">{pendingReviewCount}</div>
            <p className="text-xs sm:text-sm text-muted-foreground">{t("stats.pendingReview")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:pt-6">
            <div className="text-xl sm:text-2xl font-bold text-foreground">{highRiskCount}</div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 inline-flex items-center gap-1">
              {highRiskCount > 0 && <StatusMark tone="warning" className="h-3.5 w-3.5" />}
              {t("stats.highRisk")}
            </p>
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

      {/* Assessment List */}
      {isLoading ? (
        <ListPageSkeleton />
      ) : sortedAssessments.length > 0 ? (
        <div className="flex flex-col gap-4">
          {sortedAssessments.map((assessment) => (
            <Link key={assessment.id} href={`/privacy/assessments/${assessment.id}`} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardContent className="p-4">
                  {/* Mobile Layout - Stacked */}
                  <div className="flex flex-col gap-2 sm:hidden">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-sm">{assessment.name}</span>
                      <Badge variant="outline" className={`text-xs shrink-0 ${statusColors[assessment.status] || ""}`}>
                        {t(`status.${assessment.status}`)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {enumLabel("assessmentType", assessment.template?.type)}
                      </Badge>
                      {assessment.riskLevel && (
                        <StatusChip tone={toneForRiskTier(assessment.riskLevel)} className="text-xs">
                          {t("card.riskBadge", { level: t(`riskLevel.${assessment.riskLevel}`) })}
                        </StatusChip>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {assessment.template?.name || t("card.templateUnknown")}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{t("card.responsesShort", { count: assessment._count?.responses ?? 0 })}</span>
                      <span>
                        <Clock className="inline h-3 w-3 mr-1" />
                        {new Date(assessment.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Desktop Layout - Horizontal */}
                  <div className="hidden sm:flex items-center gap-6">
                    <div className={`w-10 h-10 flex items-center justify-center border-2 shrink-0 ${
                      assessment.status === "APPROVED" ? "border-primary bg-primary" :
                      assessment.status === "PENDING_APPROVAL" ? "border-muted-foreground" :
                      "border-primary"
                    }`}>
                      {assessment.status === "APPROVED" ? (
                        <CheckCircle2 className="w-5 h-5 text-primary-foreground" />
                      ) : assessment.status === "PENDING_APPROVAL" ? (
                        <AlertCircle className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ClipboardCheck className="w-5 h-5 text-primary" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{assessment.name}</span>
                        <Badge variant="outline">{enumLabel("assessmentType", assessment.template?.type)}</Badge>
                        <Badge variant="outline" className={statusColors[assessment.status] || ""}>
                          {t(`status.${assessment.status}`)}
                        </Badge>
                        {assessment.riskLevel && (
                          <StatusChip tone={toneForRiskTier(assessment.riskLevel)}>
                            {t("card.riskBadge", { level: t(`riskLevel.${assessment.riskLevel}`) })}
                          </StatusChip>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {t("card.templatePrefix", { name: assessment.template?.name || t("card.templateUnknown") })}
                      </p>
                    </div>

                    <div className="text-center shrink-0">
                      <p className="text-lg font-semibold text-primary">
                        {assessment._count?.responses ?? 0}
                      </p>
                      <p className="text-xs text-muted-foreground">{t("card.responses")}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-sm text-muted-foreground">
                        <Clock className="inline w-3 h-3 mr-1" />
                        {new Date(assessment.createdAt).toLocaleDateString()}
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
            <ClipboardCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>{t("emptyAll.title")}</p>
            <p className="text-sm mb-4">{t("emptyAll.subtitle")}</p>
            <Link href="/privacy/assessments/new">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                {t("newAssessment")}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <ClipboardCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>{t("emptyFiltered")}</p>
          </CardContent>
        </Card>
      )}

      <ExpertHelpCta context="assessment" />

      {/* Quick Start Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("quickStart.title")}</CardTitle>
          <CardDescription>{t("quickStart.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {[
              { type: "LIA", nameKey: "lia", premium: false },
              { type: "CUSTOM", nameKey: "custom", premium: false },
              // DPIA is premium only where something is sold: never on the
              // hosted pilot, and not on self-host (Stripe off) — see
              // allFeaturesFree in server/services/licensing/entitlement.ts
              // — so a lock badge there would be false.
              { type: "DPIA", nameKey: "dpia", premium: sellingEnabled(features.stripeEnabled, hosted) },
            ].map((item) => (
              <Link key={item.type} href={`/privacy/assessments/new?type=${item.type}`}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline">{enumLabel("assessmentType", item.type)}</Badge>
                      {item.premium && (
                        <Badge variant="secondary" className="gap-1">
                          <Lock className="w-3 h-3" />
                          {t("quickStart.premium")}
                        </Badge>
                      )}
                    </div>
                    <h4 className="font-medium">{t(`quickStart.${item.nameKey}` as `quickStart.lia` | `quickStart.custom` | `quickStart.dpia`)}</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      {templates.find((tpl) => tpl.type === item.type)
                        ? t("quickStart.sectionsCount", { count: (templates.find((tpl) => tpl.type === item.type)!.sections as any[])?.length || 0 })
                        : t("quickStart.systemTemplate")}
                    </p>
                    <div className="mt-2 w-full inline-flex items-center justify-center gap-2 text-sm font-medium text-primary hover:underline">
                      {t("quickStart.useTemplate")} <ArrowRight className="w-4 h-4" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
