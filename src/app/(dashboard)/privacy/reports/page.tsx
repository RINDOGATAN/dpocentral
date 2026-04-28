"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Shield,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  FileText,
  Building2,
  Database,
  Loader2,
  Download,
  Clock,
  Scale,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { ExpertHelpCta } from "@/components/privacy/expert-help-cta";

function ScoreRing({ score }: { score: number }) {
  const size = 160;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color =
    score >= 80 ? "text-green-500" : score >= 60 ? "text-yellow-500" : "text-red-500";
  const strokeColor =
    score >= 80 ? "stroke-green-500" : score >= 60 ? "stroke-yellow-500" : "stroke-red-500";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={strokeColor}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-4xl font-bold ${color}`}>{score}</span>
        <span className="text-xs text-muted-foreground">/&nbsp;100</span>
      </div>
    </div>
  );
}

function ModuleBreakdownCard({
  label,
  score,
  total,
  compliant,
  weight,
  weightLabel,
  compliantLabel,
  icon: Icon,
}: {
  label: string;
  score: number;
  total: number;
  compliant: number;
  weight: string;
  weightLabel: string;
  compliantLabel: string;
  icon: React.ElementType;
}) {
  const color =
    score >= 80 ? "text-green-500" : score >= 60 ? "text-yellow-500" : "text-red-500";

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 flex items-center justify-center border rounded">
            <Icon className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{label}</p>
            <p className="text-xs text-muted-foreground">{weightLabel}</p>
          </div>
          <span className={`text-lg font-bold ${color}`}>{score}%</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className={`h-2 rounded-full ${
              score >= 80 ? "bg-green-500" : score >= 60 ? "bg-yellow-500" : "bg-red-500"
            }`}
            style={{ width: `${Math.min(score, 100)}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">{compliantLabel}</p>
      </CardContent>
    </Card>
  );
}

export default function ReportsPage() {
  const { organization } = useOrganization();
  const t = useTranslations("toasts");
  const tp = useTranslations("pages.reports");

  const { data: complianceData, isLoading: isLoadingScore } =
    trpc.reports.getComplianceScore.useQuery(
      { organizationId: organization?.id ?? "" },
      { enabled: !!organization?.id }
    );

  const { data: moduleStats, isLoading: isLoadingStats } =
    trpc.reports.getModuleStats.useQuery(
      { organizationId: organization?.id ?? "" },
      { enabled: !!organization?.id }
    );

  const { data: trendData } = trpc.reports.getComplianceTrend.useQuery(
    { organizationId: organization?.id ?? "", months: 6 },
    { enabled: !!organization?.id }
  );

  const createSnapshot = trpc.reports.createSnapshot.useMutation({
    onSuccess: () => toast.success(t("reports.snapshotSaved")),
    onError: (error) => toast.error(error.message || t("reports.snapshotSaveFailed")),
  });

  const isLoading = isLoadingScore || isLoadingStats;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const score = complianceData?.score ?? 0;
  const breakdown = complianceData?.breakdown;
  const riskIndicators = complianceData?.riskIndicators ?? [];

  const scoreLabel =
    score >= 80 ? tp("score.strong") : score >= 60 ? tp("score.moderate") : tp("score.needsAttention");
  const scoreBadgeVariant =
    score >= 80 ? "default" : score >= 60 ? "secondary" : "destructive";

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">{tp("title")}</h1>
          <p className="text-sm text-muted-foreground">{tp("subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              organization?.id && createSnapshot.mutate({ organizationId: organization.id })
            }
            disabled={createSnapshot.isPending}
          >
            {createSnapshot.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            {tp("saveSnapshot")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              organization?.id &&
              window.open(
                `/api/export/regulatory-landscape?organizationId=${organization.id}`,
                "_blank"
              )
            }
          >
            <Scale className="w-4 h-4 mr-2" />
            {tp("regulatoryReport")}
          </Button>
        </div>
      </div>

      {/* Compliance Score Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <ScoreRing score={score} />
            <div className="flex-1 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
                <h2 className="text-lg font-semibold">{tp("score.title")}</h2>
                <Badge variant={scoreBadgeVariant as any}>{scoreLabel}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-4">{tp("score.subtitle")}</p>
              {trendData && trendData.length > 1 && (
                <div className="flex items-center gap-2 text-sm">
                  {trendData[trendData.length - 1].score >= trendData[trendData.length - 2].score ? (
                    <>
                      <TrendingUp className="w-4 h-4 text-green-500" />
                      <span className="text-green-500">
                        {tp("score.trendUp", { points: Math.round(trendData[trendData.length - 1].score - trendData[trendData.length - 2].score) })}
                      </span>
                      <span className="text-muted-foreground">{tp("score.vsLastMonth")}</span>
                    </>
                  ) : (
                    <>
                      <TrendingDown className="w-4 h-4 text-red-500" />
                      <span className="text-red-500">
                        {tp("score.trendDown", { points: Math.round(trendData[trendData.length - 1].score - trendData[trendData.length - 2].score) })}
                      </span>
                      <span className="text-muted-foreground">{tp("score.vsLastMonth")}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Module Breakdown Grid */}
      {breakdown && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">{tp("breakdown.heading")}</h3>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
            <ModuleBreakdownCard
              label={tp("breakdown.ropa")}
              score={breakdown.ropa.score}
              total={breakdown.ropa.total}
              compliant={breakdown.ropa.compliant}
              weight="25%"
              weightLabel={tp("breakdown.weight", { value: "25%" })}
              compliantLabel={tp("breakdown.compliantOf", { compliant: breakdown.ropa.compliant, total: breakdown.ropa.total })}
              icon={Database}
            />
            <ModuleBreakdownCard
              label={tp("breakdown.assessments")}
              score={breakdown.assessment.score}
              total={breakdown.assessment.total}
              compliant={breakdown.assessment.compliant}
              weight="20%"
              weightLabel={tp("breakdown.weight", { value: "20%" })}
              compliantLabel={tp("breakdown.compliantOf", { compliant: breakdown.assessment.compliant, total: breakdown.assessment.total })}
              icon={FileText}
            />
            <ModuleBreakdownCard
              label={tp("breakdown.dsarSla")}
              score={breakdown.dsar.score}
              total={breakdown.dsar.total}
              compliant={breakdown.dsar.compliant}
              weight="25%"
              weightLabel={tp("breakdown.weight", { value: "25%" })}
              compliantLabel={tp("breakdown.compliantOf", { compliant: breakdown.dsar.compliant, total: breakdown.dsar.total })}
              icon={Clock}
            />
            <ModuleBreakdownCard
              label={tp("breakdown.incidentResponse")}
              score={breakdown.incident.score}
              total={breakdown.incident.total}
              compliant={breakdown.incident.compliant}
              weight="15%"
              weightLabel={tp("breakdown.weight", { value: "15%" })}
              compliantLabel={tp("breakdown.compliantOf", { compliant: breakdown.incident.compliant, total: breakdown.incident.total })}
              icon={Shield}
            />
            <ModuleBreakdownCard
              label={tp("breakdown.vendorReviews")}
              score={breakdown.vendor.score}
              total={breakdown.vendor.total}
              compliant={breakdown.vendor.compliant}
              weight="15%"
              weightLabel={tp("breakdown.weight", { value: "15%" })}
              compliantLabel={tp("breakdown.compliantOf", { compliant: breakdown.vendor.compliant, total: breakdown.vendor.total })}
              icon={Building2}
            />
          </div>
        </div>
      )}

      {/* Risk Indicators */}
      {riskIndicators.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              {tp("risk.title")}
            </CardTitle>
            <CardDescription>{tp("risk.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {riskIndicators.map((indicator, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 text-sm p-2 rounded border border-yellow-500/20 bg-yellow-500/5"
                >
                  <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />
                  <span>{indicator}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {riskIndicators.length === 0 && complianceData && (
        <Card>
          <CardContent className="py-6 text-center">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500" />
            <p className="text-sm text-muted-foreground">{tp("risk.noneTitle")}</p>
          </CardContent>
        </Card>
      )}

      {/* Module Stats Grid */}
      {moduleStats && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">{tp("modules.heading")}</h3>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {/* Data Inventory */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  {tp("modules.dataInventory")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-2xl font-bold">{moduleStats.dataInventory.assets}</p>
                    <p className="text-xs text-muted-foreground">{tp("modules.assets")}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{moduleStats.dataInventory.elements}</p>
                    <p className="text-xs text-muted-foreground">{tp("modules.elements")}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{moduleStats.dataInventory.activities}</p>
                    <p className="text-xs text-muted-foreground">{tp("modules.activities")}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{moduleStats.dataInventory.flows}</p>
                    <p className="text-xs text-muted-foreground">{tp("modules.flows")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* DSAR */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  {tp("modules.dsarTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-2xl font-bold">{moduleStats.dsar.total}</p>
                    <p className="text-xs text-muted-foreground">{tp("modules.dsarTotal")}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{moduleStats.dsar.open}</p>
                    <p className="text-xs text-muted-foreground">{tp("modules.dsarOpen")}</p>
                  </div>
                  <div>
                    <p className={`text-2xl font-bold ${moduleStats.dsar.overdue > 0 ? "text-red-500" : ""}`}>
                      {moduleStats.dsar.overdue}
                    </p>
                    <p className="text-xs text-muted-foreground">{tp("modules.dsarOverdue")}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{tp("modules.daysShort", { days: moduleStats.dsar.avgResolutionDays })}</p>
                    <p className="text-xs text-muted-foreground">{tp("modules.dsarAvgResolution")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Assessments */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  {tp("modules.assessmentsTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-2xl font-bold">{moduleStats.assessment.total}</p>
                    <p className="text-xs text-muted-foreground">{tp("modules.assessmentTotal")}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-500">{moduleStats.assessment.approved}</p>
                    <p className="text-xs text-muted-foreground">{tp("modules.assessmentApproved")}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{moduleStats.assessment.inProgress}</p>
                    <p className="text-xs text-muted-foreground">{tp("modules.assessmentInProgress")}</p>
                  </div>
                  <div>
                    <p className={`text-2xl font-bold ${moduleStats.assessment.highRisk > 0 ? "text-yellow-500" : ""}`}>
                      {moduleStats.assessment.highRisk}
                    </p>
                    <p className="text-xs text-muted-foreground">{tp("modules.assessmentHighRisk")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Incidents */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  {tp("modules.incidentsTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-2xl font-bold">{moduleStats.incident.total}</p>
                    <p className="text-xs text-muted-foreground">{tp("modules.incidentTotal")}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{moduleStats.incident.open}</p>
                    <p className="text-xs text-muted-foreground">{tp("modules.incidentOpen")}</p>
                  </div>
                  <div>
                    <p className={`text-2xl font-bold ${moduleStats.incident.critical > 0 ? "text-red-500" : ""}`}>
                      {moduleStats.incident.critical}
                    </p>
                    <p className="text-xs text-muted-foreground">{tp("modules.incidentCritical")}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{tp("modules.daysShort", { days: moduleStats.incident.avgResolutionDays })}</p>
                    <p className="text-xs text-muted-foreground">{tp("modules.incidentAvgResolution")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Vendors */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  {tp("modules.vendorsTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-2xl font-bold">{moduleStats.vendor.total}</p>
                    <p className="text-xs text-muted-foreground">{tp("modules.vendorTotal")}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{moduleStats.vendor.active}</p>
                    <p className="text-xs text-muted-foreground">{tp("modules.vendorActive")}</p>
                  </div>
                  <div>
                    <p className={`text-2xl font-bold ${moduleStats.vendor.highRisk > 0 ? "text-yellow-500" : ""}`}>
                      {moduleStats.vendor.highRisk}
                    </p>
                    <p className="text-xs text-muted-foreground">{tp("modules.vendorHighRisk")}</p>
                  </div>
                  <div>
                    <p className={`text-2xl font-bold ${moduleStats.vendor.withoutReview > 0 ? "text-red-500" : ""}`}>
                      {moduleStats.vendor.withoutReview}
                    </p>
                    <p className="text-xs text-muted-foreground">{tp("modules.vendorNoReview")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Trend */}
            {trendData && trendData.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    {tp("modules.scoreHistory")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {trendData.map((snapshot) => (
                      <div key={snapshot.id} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {new Date(snapshot.month).toLocaleDateString(undefined, {
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-muted rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                snapshot.score >= 80
                                  ? "bg-green-500"
                                  : snapshot.score >= 60
                                  ? "bg-yellow-500"
                                  : "bg-red-500"
                              }`}
                              style={{ width: `${Math.min(snapshot.score, 100)}%` }}
                            />
                          </div>
                          <span className="font-medium w-8 text-right">{Math.round(snapshot.score)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {trendData.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      {tp("modules.noSnapshots")}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      <ExpertHelpCta context="general" />
    </div>
  );
}
