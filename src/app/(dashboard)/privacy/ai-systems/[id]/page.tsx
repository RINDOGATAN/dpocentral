"use client";

import { use } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bot,
  ArrowLeft,
  Edit3,
  Shield,
  AlertTriangle,
  Building2,
  FileText,
  Eye,
  Users,
  Loader2,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { features } from "@/config/features";
import { useTranslations } from "next-intl";

const RISK_COLORS: Record<string, string> = {
  UNACCEPTABLE: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  HIGH_RISK: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  LIMITED: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  MINIMAL: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

export default function AISystemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { organization } = useOrganization();
  const orgId = organization?.id ?? "";
  const t = useTranslations("pages.aiSystemDetail");
  const tList = useTranslations("pages.aiSystems");

  const utils = trpc.useUtils();
  const { data: system, isLoading } = trpc.aiGovernance.getById.useQuery(
    { organizationId: orgId, id },
    { enabled: !!orgId && !!id }
  );

  const updateStatus = trpc.aiGovernance.update.useMutation({
    onSuccess: () => {
      utils.aiGovernance.getById.invalidate({ organizationId: orgId, id });
      utils.aiGovernance.list.invalidate();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!system) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{t("notFound")}</p>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/privacy/ai-systems"><ArrowLeft className="w-4 h-4 mr-2" /> {t("back")}</Link>
        </Button>
      </div>
    );
  }

  const aisUrl = "https://aisentinel.todo.law";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/privacy/ai-systems"><ArrowLeft className="w-4 h-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Bot className="w-6 h-6" />
              {system.name}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={RISK_COLORS[system.riskLevel] ?? ""}>
                {tList(`riskLevel.${system.riskLevel}` as `riskLevel.UNACCEPTABLE` | `riskLevel.HIGH_RISK` | `riskLevel.LIMITED` | `riskLevel.MINIMAL`)}
              </Badge>
              {system.aiSentinelSystemId && (
                <Badge variant="outline" className="text-blue-600 border-blue-600/50">
                  <Shield className="w-3 h-3 mr-1" /> {t("linked")}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <Select
          value={system.status}
          onValueChange={(v) => updateStatus.mutate({ organizationId: orgId, id, status: v as any })}
          disabled={updateStatus.isPending}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="DRAFT">{tList("status.DRAFT")}</SelectItem>
            <SelectItem value="REGISTERED">{tList("status.REGISTERED")}</SelectItem>
            <SelectItem value="UNDER_REVIEW">{tList("status.UNDER_REVIEW")}</SelectItem>
            <SelectItem value="COMPLIANT">{tList("status.COMPLIANT")}</SelectItem>
            <SelectItem value="NON_COMPLIANT">{tList("status.NON_COMPLIANT")}</SelectItem>
            <SelectItem value="DECOMMISSIONED">{tList("status.DECOMMISSIONED")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* AI Models */}
      {(() => {
        const rawModels = Array.isArray(system.aiModels) ? (system.aiModels as unknown[]) : [];
        const models = rawModels.filter(
          (m): m is { name: string; type?: string; source?: string; euAiActRiskTier?: string } =>
            typeof m === "object" && m !== null && typeof (m as { name?: unknown }).name === "string"
        );
        if (models.length === 0) return null;
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bot className="w-4 h-4" /> {t("embeddedModels", { count: models.length })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {models.map((model, i) => (
                  <div key={i} className="p-3 rounded-lg border space-y-1">
                    <p className="font-medium text-sm">{model.name}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {model.type && (
                        <Badge variant="secondary" className="text-xs">{model.type}</Badge>
                      )}
                      {model.source && (
                        <Badge variant="outline" className="text-xs">{model.source}</Badge>
                      )}
                      {model.euAiActRiskTier && (
                        <Badge className={`text-xs ${
                          model.euAiActRiskTier === "UNACCEPTABLE" ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" :
                          model.euAiActRiskTier === "HIGH_RISK" ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" :
                          model.euAiActRiskTier === "LIMITED" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" :
                          model.euAiActRiskTier === "MINIMAL" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" :
                          ""
                        }`}>
                          {tList(`riskLevel.${model.euAiActRiskTier}` as `riskLevel.UNACCEPTABLE` | `riskLevel.HIGH_RISK` | `riskLevel.LIMITED` | `riskLevel.MINIMAL`)}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("details.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {system.description && (
              <div>
                <span className="text-muted-foreground">{t("details.description")}</span>
                <p className="mt-1">{system.description}</p>
              </div>
            )}
            {system.purpose && (
              <div>
                <span className="text-muted-foreground">{t("details.purpose")}</span>
                <p className="mt-1">{system.purpose}</p>
              </div>
            )}
            {system.category && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("details.category")}</span>
                <span>{system.category}</span>
              </div>
            )}
            {system.modelType && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("details.modelType")}</span>
                <span>{system.modelType}</span>
              </div>
            )}
            {system.provider && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("details.provider")}</span>
                <span>{system.provider}</span>
              </div>
            )}
            {system.deployer && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("details.deployer")}</span>
                <span>{system.deployer}</span>
              </div>
            )}
            {system.vendor && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("details.vendor")}</span>
                <Link href={`/privacy/vendors/${system.vendor.id}`} className="text-primary hover:underline">
                  {system.vendor.name}
                </Link>
              </div>
            )}
            {system.euAiActRole && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("details.euAiActRole")}</span>
                <span>{system.euAiActRole}</span>
              </div>
            )}
            {system.euAiActCompliant != null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("details.euAiActCompliant")}</span>
                <Badge variant={system.euAiActCompliant ? "outline" : "secondary"} className={system.euAiActCompliant ? "text-green-600 border-green-600/50" : ""}>
                  {system.euAiActCompliant ? t("details.yes") : t("details.no")}
                </Badge>
              </div>
            )}
            {system.iso42001Certified != null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("details.iso42001")}</span>
                <Badge variant={system.iso42001Certified ? "outline" : "secondary"} className={system.iso42001Certified ? "text-green-600 border-green-600/50" : ""}>
                  {system.iso42001Certified ? t("details.yes") : t("details.no")}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Compliance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("compliance.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {system.humanOversight && (
              <div>
                <div className="flex items-center gap-1 text-muted-foreground mb-1">
                  <Users className="w-3 h-3" /> {t("compliance.humanOversight")}
                </div>
                <p>{system.humanOversight}</p>
              </div>
            )}
            {system.transparencyMeasures && (
              <div>
                <div className="flex items-center gap-1 text-muted-foreground mb-1">
                  <Eye className="w-3 h-3" /> {t("compliance.transparency")}
                </div>
                <p>{system.transparencyMeasures}</p>
              </div>
            )}
            {system.trainingDataSources.length > 0 && (
              <div>
                <span className="text-muted-foreground">{t("compliance.trainingData")}</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {system.trainingDataSources.map((s, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
                  ))}
                </div>
              </div>
            )}
            {system.aiCapabilities.length > 0 && (
              <div>
                <span className="text-muted-foreground">{t("compliance.capabilities")}</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {system.aiCapabilities.map((c, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{c}</Badge>
                  ))}
                </div>
              </div>
            )}
            {system.aiTechniques.length > 0 && (
              <div>
                <span className="text-muted-foreground">{t("compliance.techniques")}</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {system.aiTechniques.map((tech, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{tech}</Badge>
                  ))}
                </div>
              </div>
            )}
            {system.technicalDocUrl && (
              <div className="flex items-center gap-1">
                <FileText className="w-3 h-3 text-muted-foreground" />
                <a href={system.technicalDocUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs">
                  {t("compliance.technicalDoc")}
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Sentinel Integration Card */}
      {features.aiSentinelIntegrationEnabled && system.aiSentinelSystemId && (
        <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/30">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-700 dark:text-blue-300">{t("sentinel.linkedTitle")}</p>
                  <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">{t("sentinel.linkedBody")}</p>
                  {system.aiSentinelSyncedAt && (
                    <p className="text-xs text-blue-500 dark:text-blue-500 mt-1">
                      {t("sentinel.lastSynced", { date: new Date(system.aiSentinelSyncedAt).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) })}
                    </p>
                  )}
                </div>
              </div>
              <Button variant="outline" size="sm" asChild>
                <a
                  href={`${aisUrl}/governance/ai-systems/${system.aiSentinelSystemId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("sentinel.openInSentinel")}
                  <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {system.riskLevel === "UNACCEPTABLE" && (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <p className="font-medium text-red-700 dark:text-red-300">{t("unacceptableTitle")}</p>
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">{t("unacceptableBody")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {system.riskLevel === "HIGH_RISK" && (
        <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-orange-600 mt-0.5" />
              <div>
                <p className="font-medium text-orange-700 dark:text-orange-300">{t("highRiskTitle")}</p>
                <ul className="text-sm text-orange-600 dark:text-orange-400 mt-2 space-y-1 list-disc list-inside">
                  <li>{t("highRiskItems.riskMgmt")}</li>
                  <li>{t("highRiskItems.dataGovernance")}</li>
                  <li>{t("highRiskItems.technicalDoc")}</li>
                  <li>{t("highRiskItems.recordKeeping")}</li>
                  <li>{t("highRiskItems.oversight")}</li>
                  <li>{t("highRiskItems.accuracy")}</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
