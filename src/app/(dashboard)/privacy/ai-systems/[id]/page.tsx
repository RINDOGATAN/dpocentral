"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

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
import { StatusChip } from "@/components/ui/status-chip";
import { toneBorder, toneMark, toneTint } from "@/config/status-palette";
import { toneForAiRiskLevel } from "@/config/status-tone";

// Risk level goes through the shared tones: toneForAiRiskLevel.

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

  // Read-through AI-Act status of the linked AI Sentinel system (the unified
  // "one system, both regimes" view). Null/absent simply hides the panel.
  const { data: sentinelStatus } = trpc.aiGovernance.aiSentinelSystemStatus.useQuery(
    { organizationId: orgId, systemId: id },
    {
      enabled:
        features.aiSentinelIntegrationEnabled &&
        !!orgId &&
        !!system?.aiSentinelSystemId,
    }
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

  // Base URL of the paired AI Sentinel deployment used for the "view in AI
  // Sentinel" deep-link. Defaults to the cloud instance; self-hosted suites set
  // NEXT_PUBLIC_AI_SENTINEL_URL to their own AI Sentinel so the link stays local.
  const aisUrl =
    process.env.NEXT_PUBLIC_AI_SENTINEL_URL || "https://aisentinel.todo.law";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" asChild className="shrink-0">
            <Link href="/privacy/ai-systems"><ArrowLeft className="w-4 h-4" /></Link>
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold flex items-center gap-2 min-w-0">
              <Bot className="w-6 h-6 shrink-0" />
              <span className="truncate">{system.name}</span>
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <StatusChip tone={toneForAiRiskLevel(system.riskLevel)}>
                {tList(`riskLevel.${system.riskLevel}` as `riskLevel.UNACCEPTABLE` | `riskLevel.HIGH_RISK` | `riskLevel.LIMITED` | `riskLevel.MINIMAL`)}
              </StatusChip>
              {system.aiSentinelSystemId && (
                <Badge variant="outline" className={toneBorder("info")}>
                  <Shield className={`w-3 h-3 mr-1 ${toneMark("info")}`} /> {t("linked")}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/privacy/ai-systems/${id}/edit`}>
            <Button variant="outline" size="sm">
              <Edit3 className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </Link>
          <Select
            value={system.status}
            onValueChange={(v) => updateStatus.mutate({ organizationId: orgId, id, status: v as any })}
            disabled={updateStatus.isPending}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
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
                        <StatusChip tone={toneForAiRiskLevel(model.euAiActRiskTier)} className="text-xs">
                          {tList(`riskLevel.${model.euAiActRiskTier}` as `riskLevel.UNACCEPTABLE` | `riskLevel.HIGH_RISK` | `riskLevel.LIMITED` | `riskLevel.MINIMAL`)}
                        </StatusChip>
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
                <StatusChip tone={system.euAiActCompliant ? "success" : "neutral"}>
                  {system.euAiActCompliant ? t("details.yes") : t("details.no")}
                </StatusChip>
              </div>
            )}
            {system.iso42001Certified != null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("details.iso42001")}</span>
                <StatusChip tone={system.iso42001Certified ? "success" : "neutral"}>
                  {system.iso42001Certified ? t("details.yes") : t("details.no")}
                </StatusChip>
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
        <Card className={`${toneBorder("info")} ${toneTint("info")}`}>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <Shield className={`w-5 h-5 mt-0.5 ${toneMark("info")}`} />
                <div>
                  <p className="font-medium">{t("sentinel.linkedTitle")}</p>
                  <p className="text-sm text-muted-foreground mt-1">{t("sentinel.linkedBody")}</p>
                  {system.aiSentinelSyncedAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("sentinel.lastSynced", { date: new Date(system.aiSentinelSyncedAt).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) })}
                    </p>
                  )}
                </div>
              </div>
              <Button variant="outline" size="sm" asChild>
                <a
                  href={`${aisUrl}/governance/ai-registry/${system.aiSentinelSystemId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("sentinel.openInSentinel")}
                  <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              </Button>
            </div>

            {sentinelStatus?.found && (
              <div className={`mt-4 pt-4 border-t ${toneBorder("info")}`}>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">
                  {t("sentinel.aiActStatus")} · {t("sentinel.statusFromSentinel")}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">{t("sentinel.riskTier")}</p>
                    <p className="text-sm font-semibold">
                      {sentinelStatus.riskLevel ?? t("sentinel.notAssessed")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t("sentinel.fria")}</p>
                    <p className="text-sm font-semibold">
                      {sentinelStatus.fria?.status ?? t("sentinel.notAssessed")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t("sentinel.conformity")}</p>
                    <p className="text-sm font-semibold">
                      {sentinelStatus.conformity?.status ?? t("sentinel.notAssessed")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t("sentinel.oversightOpen")}</p>
                    <p className="text-sm font-semibold">
                      {sentinelStatus.openOversightGates ?? 0}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {system.riskLevel === "UNACCEPTABLE" && (
        <Card className={`${toneBorder("danger")} ${toneTint("danger")}`}>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className={`w-5 h-5 mt-0.5 ${toneMark("danger")}`} />
              <div>
                <p className="font-medium">{t("unacceptableTitle")}</p>
                <p className="text-sm text-muted-foreground mt-1">{t("unacceptableBody")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {system.riskLevel === "HIGH_RISK" && (
        <Card className={`${toneBorder("warning")} ${toneTint("warning")}`}>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Shield className={`w-5 h-5 mt-0.5 ${toneMark("warning")}`} />
              <div>
                <p className="font-medium">{t("highRiskTitle")}</p>
                <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
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
