"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ClipboardCheck,
  Plus,
  Search,
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
import { useDebounce } from "@/hooks/use-debounce";
import { ExpertHelpCta } from "@/components/privacy/expert-help-cta";
import { useTranslations } from "next-intl";

const statusColors: Record<string, string> = {
  DRAFT: "border-muted-foreground text-muted-foreground",
  IN_PROGRESS: "border-primary text-primary",
  PENDING_REVIEW: "border-muted-foreground text-muted-foreground",
  PENDING_APPROVAL: "border-muted-foreground text-muted-foreground",
  APPROVED: "border-primary bg-primary text-primary-foreground",
  REJECTED: "border-muted-foreground text-muted-foreground",
};

const riskColors: Record<string, string> = {
  LOW: "border-primary text-primary",
  MEDIUM: "border-muted-foreground text-muted-foreground",
  HIGH: "border-muted-foreground bg-muted-foreground/20 text-foreground",
  CRITICAL: "border-muted-foreground bg-muted-foreground text-foreground",
};

export default function AssessmentsPage() {
  const t = useTranslations("pages.assessments");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery);
  const [activeTab, setActiveTab] = useState("all");
  const { organization } = useOrganization();

  const { data: assessmentsData, isLoading } = trpc.assessment.list.useQuery(
    { organizationId: organization?.id ?? "", search: debouncedSearch || undefined },
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

  const filteredAssessments = (() => {
    switch (activeTab) {
      case "dpia":
        return assessments.filter((a) => a.template?.type === "DPIA");
      case "vendor":
        return assessments.filter((a) => a.template?.type === "VENDOR");
      case "tia":
        return assessments.filter((a) => a.template?.type === "TIA");
      default:
        return assessments;
    }
  })();

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex gap-2">
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
        </div>
      </div>

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
            <div className={`text-xl sm:text-2xl font-bold ${highRiskCount > 0 ? "text-amber-400" : "text-foreground"}`}>
              {highRiskCount}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">{t("stats.highRisk")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("search")}
          className="pl-9"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">{t("tabs.all")}</TabsTrigger>
          <TabsTrigger value="dpia">{t("tabs.dpia")}</TabsTrigger>
          <TabsTrigger value="vendor">{t("tabs.vendor")}</TabsTrigger>
          <TabsTrigger value="tia">{t("tabs.tia")}</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Assessment List */}
      {isLoading ? (
        <ListPageSkeleton />
      ) : filteredAssessments.length > 0 ? (
        <div className="flex flex-col gap-4">
          {filteredAssessments.map((assessment) => (
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
                        {assessment.template?.type ? t(`type.${assessment.template.type}`) : assessment.template?.type}
                      </Badge>
                      {assessment.riskLevel && (
                        <Badge variant="outline" className={`text-xs ${riskColors[assessment.riskLevel] || ""}`}>
                          {t("card.riskBadge", { level: t(`riskLevel.${assessment.riskLevel}`) })}
                        </Badge>
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
                        <Badge variant="outline">{assessment.template?.type ? t(`type.${assessment.template.type}`) : assessment.template?.type}</Badge>
                        <Badge variant="outline" className={statusColors[assessment.status] || ""}>
                          {t(`status.${assessment.status}`)}
                        </Badge>
                        {assessment.riskLevel && (
                          <Badge variant="outline" className={riskColors[assessment.riskLevel] || ""}>
                            {t("card.riskBadge", { level: t(`riskLevel.${assessment.riskLevel}`) })}
                          </Badge>
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
      ) : activeTab === "all" ? (
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
            <p>
              {activeTab === "dpia" && t("emptyDpia")}
              {activeTab === "vendor" && t("emptyVendor")}
              {activeTab === "tia" && t("emptyTia")}
            </p>
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
              { type: "DPIA", nameKey: "dpia", premium: true },
            ].map((item) => (
              <Link key={item.type} href={`/privacy/assessments/new?type=${item.type}`}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline">{item.type}</Badge>
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
