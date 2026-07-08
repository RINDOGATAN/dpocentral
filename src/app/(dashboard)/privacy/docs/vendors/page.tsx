// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { Building2, FileCheck, MessageSquare, ShieldAlert, Clock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DocSection } from "@/components/docs/doc-section";
import { StepList } from "@/components/docs/step-list";
import { FeatureMockup } from "@/components/docs/feature-mockup";
import { InfoCallout } from "@/components/docs/info-callout";
import { DocNavFooter } from "@/components/docs/doc-nav-footer";

const vendorStatusColors: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800 border-transparent",
  UNDER_REVIEW: "bg-yellow-100 text-yellow-800 border-transparent",
  SUSPENDED: "bg-red-100 text-red-800 border-transparent",
};

const riskTierColors: Record<string, string> = {
  LOW: "bg-green-100 text-green-800 border-transparent",
  MEDIUM: "bg-yellow-100 text-yellow-800 border-transparent",
  HIGH: "bg-orange-100 text-orange-800 border-transparent",
  CRITICAL: "bg-red-100 text-red-800 border-transparent",
};

export default async function DocsVendorsPage() {
  const t = await getTranslations("docs.vendors");

  const stats: { key: string; value: string; icon: typeof Building2 }[] = [
    { key: "total", value: "18", icon: Building2 },
    { key: "active", value: "14", icon: Building2 },
    { key: "highRisk", value: "3", icon: ShieldAlert },
    { key: "pendingReview", value: "2", icon: Clock },
  ];

  const vendorCards: { name: string; status: string; risk: string; categoryKey: string }[] = [
    { name: "Acme Cloud Services", status: "ACTIVE", risk: "LOW", categoryKey: "cloudInfra" },
    { name: "DataTech Analytics", status: "ACTIVE", risk: "HIGH", categoryKey: "analytics" },
    { name: "SecureMail Pro", status: "UNDER_REVIEW", risk: "MEDIUM", categoryKey: "email" },
    { name: "Legacy CRM Inc.", status: "SUSPENDED", risk: "CRITICAL", categoryKey: "crm" },
  ];

  const stepKeys = ["navigate", "click", "details", "risk", "contract", "questionnaire"] as const;

  const contracts: { vendor: string; type: string; start: string; end: string; statusKey: "Active" | "ExpiringSoon" | "Expired"; badgeVariant: "success" | "warning" | "destructive" }[] = [
    { vendor: "Acme Cloud Services", type: "DPA", start: "2024-01-01", end: "2025-12-31", statusKey: "Active", badgeVariant: "success" },
    { vendor: "DataTech Analytics", type: "DPA + SCC", start: "2024-06-15", end: "2025-06-14", statusKey: "ExpiringSoon", badgeVariant: "warning" },
    { vendor: "SecureMail Pro", type: "DPA", start: "2023-03-01", end: "2024-02-28", statusKey: "Expired", badgeVariant: "destructive" },
  ];

  const questionnaires: { vendor: string; sent: string; statusKey: "Completed" | "InProgress" | "Sent"; score: string; badgeVariant: "success" | "info" | "secondary" }[] = [
    { vendor: "Acme Cloud Services", sent: "2024-12-01", statusKey: "Completed", score: "92%", badgeVariant: "success" },
    { vendor: "DataTech Analytics", sent: "2025-01-05", statusKey: "InProgress", score: "—", badgeVariant: "info" },
    { vendor: "SecureMail Pro", sent: "2025-01-10", statusKey: "Sent", score: "—", badgeVariant: "secondary" },
  ];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      <DocSection id="adding" title={t("adding.title")} description={t("adding.description")}>
        <FeatureMockup title={t("adding.statsMockupTitle")}>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.key} className="hover:translate-y-0">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                    <CardTitle className="text-xs font-medium">{t(`adding.stats.${stat.key}`)}</CardTitle>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="text-xl font-bold text-primary">{stat.value}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </FeatureMockup>

        <FeatureMockup title={t("adding.cardsMockupTitle")}>
          <div className="space-y-2">
            {vendorCards.map((vendor) => (
              <div key={vendor.name} className="flex items-center justify-between rounded-md border px-3 py-2.5">
                <div>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{vendor.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 ml-6">{t(`adding.categories.${vendor.categoryKey}`)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-[10px] ${riskTierColors[vendor.risk]}`}>
                    {vendor.risk} {t("adding.riskSuffix")}
                  </Badge>
                  <Badge variant="outline" className={`text-[10px] ${vendorStatusColors[vendor.status]}`}>
                    {t(`adding.statusLabels.${vendor.status}`)}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </FeatureMockup>

        <StepList
          steps={stepKeys.map((k) => ({
            title: t(`adding.steps.${k}.title`),
            description: t(`adding.steps.${k}.description`),
          }))}
        />
      </DocSection>

      <DocSection id="contracts" title={t("contracts.title")} description={t("contracts.description")}>
        <FeatureMockup title={t("contracts.mockupTitle")}>
          <div className="space-y-2">
            {contracts.map((contract) => (
              <div key={contract.vendor} className="flex items-center justify-between rounded-md border px-3 py-2">
                <div className="flex items-center gap-3">
                  <FileCheck className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{contract.vendor}</p>
                    <p className="text-xs text-muted-foreground">
                      {contract.type} — {contract.start} {t("contracts.dateRangeSeparator")} {contract.end}
                    </p>
                  </div>
                </div>
                <Badge variant={contract.badgeVariant} className="text-[10px]">
                  {t(`contracts.statuses.${contract.statusKey}`)}
                </Badge>
              </div>
            ))}
          </div>
        </FeatureMockup>
        <InfoCallout type="warning" title={t("contracts.calloutTitle")}>
          {t("contracts.calloutBody")}
        </InfoCallout>
      </DocSection>

      <DocSection id="questionnaires" title={t("questionnaires.title")} description={t("questionnaires.description")}>
        <FeatureMockup title={t("questionnaires.mockupTitle")}>
          <div className="space-y-2">
            {questionnaires.map((q) => (
              <div key={q.vendor} className="flex items-center justify-between rounded-md border px-3 py-2">
                <div className="flex items-center gap-3">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{q.vendor}</p>
                    <p className="text-xs text-muted-foreground">{t("questionnaires.sentLabel", { date: q.sent })}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {q.score !== "—" && <span className="text-xs font-medium text-primary">{q.score}</span>}
                  <Badge variant={q.badgeVariant} className="text-[10px]">
                    {t(`questionnaires.statuses.${q.statusKey}`)}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </FeatureMockup>
        <InfoCallout type="tip" title={t("questionnaires.calloutTitle")}>
          {t("questionnaires.calloutBody")}
        </InfoCallout>
      </DocSection>

      <DocSection id="risk-reviews" title={t("riskReviews.title")} description={t("riskReviews.description")}>
        <InfoCallout type="info" title={t("riskReviews.infoTitle")}>
          {t("riskReviews.infoBody")}
        </InfoCallout>
        <InfoCallout type="note" title={t("riskReviews.noteTitle")}>
          {t("riskReviews.notePrefix")}
          <a href="/privacy/docs/premium#vendor-risk" className="text-primary underline">{t("riskReviews.noteLink")}</a>
          {t("riskReviews.noteSuffix")}
        </InfoCallout>
      </DocSection>

      <DocNavFooter
        previous={{ title: t("nav.previous"), href: "/privacy/docs/incidents" }}
        next={{ title: t("nav.next"), href: "/privacy/docs/premium" }}
      />
    </div>
  );
}
