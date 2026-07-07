// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import {
  Database,
  Users,
  ClipboardCheck,
  AlertTriangle,
  Building2,
  FileDown,
  Camera,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DocSection } from "@/components/docs/doc-section";
import { FeatureMockup } from "@/components/docs/feature-mockup";
import { InfoCallout } from "@/components/docs/info-callout";
import { DocNavFooter } from "@/components/docs/doc-nav-footer";
import { PremiumBadge } from "@/components/docs/premium-badge";

export default async function DocsReportsPage() {
  const t = await getTranslations("docs.reports");

  const weights: { key: string; value: string; icon: typeof Database }[] = [
    { key: "ROPA", value: "25%", icon: Database },
    { key: "DSAR", value: "25%", icon: Users },
    { key: "Assessments", value: "20%", icon: ClipboardCheck },
    { key: "Incidents", value: "15%", icon: AlertTriangle },
    { key: "Vendors", value: "15%", icon: Building2 },
  ];

  const moduleItems: { key: string; icon: typeof Database }[] = [
    { key: "inventory", icon: Database },
    { key: "dsar", icon: Users },
    { key: "assessments", icon: ClipboardCheck },
    { key: "incidents", icon: AlertTriangle },
    { key: "vendors", icon: Building2 },
  ];

  const riskKeys = ["dsar", "vendors", "contracts", "ropa", "incidents"] as const;

  const trends: { key: string; score: number; change: string; color: string }[] = [
    { key: "march", score: 82, change: "+4", color: "bg-green-100 text-green-800 border-transparent" },
    { key: "february", score: 78, change: "+2", color: "bg-green-100 text-green-800 border-transparent" },
    { key: "january", score: 76, change: "-3", color: "bg-red-100 text-red-800 border-transparent" },
    { key: "december", score: 79, change: "+5", color: "bg-green-100 text-green-800 border-transparent" },
    { key: "november", score: 74, change: "+1", color: "bg-green-100 text-green-800 border-transparent" },
  ];

  const boardKeys = ["executive", "breakdown", "trend", "indicators", "dsar", "incident", "vendor"] as const;
  const pdfReports = [
    { label: "inventoryLabel", desc: "inventoryDesc" },
    { label: "ropaLabel", desc: "ropaDesc" },
    { label: "vendorLabel", desc: "vendorDesc" },
    { label: "breachLabel", desc: "breachDesc" },
    { label: "dsarLabel", desc: "dsarDesc" },
    { label: "portfolioLabel", desc: "portfolioDesc" },
    { label: "assessmentLabel", desc: "assessmentDesc" },
    { label: "regulatoryLabel", desc: "regulatoryDesc" },
  ] as const;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      <DocSection
        id="compliance-score"
        title={t("score.title")}
        description={t("score.description")}
      >
        <FeatureMockup title={t("score.mockupTitle")}>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
            {weights.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.key} className="hover:translate-y-0">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                    <CardTitle className="text-xs font-medium">{t(`score.modules.${stat.key}`)}</CardTitle>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="text-xl font-bold text-primary">{stat.value}</div>
                    <p className="text-xs text-muted-foreground">{t("score.weightSubtitle")}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </FeatureMockup>

        <div className="space-y-3 text-sm text-muted-foreground">
          <p>{t("score.intro")}</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="text-[10px] bg-green-100 text-green-800 border-transparent">
              {t("score.bands.strong")}
            </Badge>
            <Badge variant="outline" className="text-[10px] bg-yellow-100 text-yellow-800 border-transparent">
              {t("score.bands.attention")}
            </Badge>
            <Badge variant="outline" className="text-[10px] bg-red-100 text-red-800 border-transparent">
              {t("score.bands.risk")}
            </Badge>
          </div>
        </div>
      </DocSection>

      <DocSection
        id="module-breakdown"
        title={t("modules.title")}
        description={t("modules.description")}
      >
        <FeatureMockup title={t("modules.mockupTitle")}>
          <div className="space-y-3">
            {moduleItems.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.key} className="flex items-start gap-3 rounded-lg border p-3">
                  <div className="rounded-md bg-primary/10 p-2">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{t(`modules.items.${item.key}.module`)}</p>
                    <p className="text-xs text-muted-foreground">{t(`modules.items.${item.key}.metric`)}</p>
                    <p className="text-xs text-muted-foreground italic mt-0.5">
                      {t("modules.exampleLabel", { text: t(`modules.items.${item.key}.example`) })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </FeatureMockup>
      </DocSection>

      <DocSection
        id="risk-indicators"
        title={t("risk.title")}
        description={t("risk.description")}
      >
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>{t("risk.intro")}</p>
          <ul className="list-disc ml-5 space-y-1">
            {riskKeys.map((key) => (
              <li key={key}>
                <strong>{t(`risk.items.${key}.label`)}</strong> &mdash; {t(`risk.items.${key}.example`)}
              </li>
            ))}
          </ul>
        </div>
        <InfoCallout type="warning" title={t("risk.warningTitle")}>
          {t("risk.warningBody")}
        </InfoCallout>
      </DocSection>

      <DocSection
        id="snapshots"
        title={t("snapshots.title")}
        description={t("snapshots.description")}
      >
        <FeatureMockup title={t("snapshots.mockupTitle")}>
          <div className="space-y-2">
            {trends.map((item) => (
              <div key={item.key} className="flex items-center justify-between rounded-md border px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <Camera className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{t(`snapshots.months.${item.key}`)}</p>
                    <p className="text-xs text-muted-foreground">{t("snapshots.scoreLabel", { score: item.score })}</p>
                  </div>
                </div>
                <Badge variant="outline" className={`text-[10px] ${item.color}`}>
                  {item.change}
                </Badge>
              </div>
            ))}
          </div>
        </FeatureMockup>
        <InfoCallout type="tip" title={t("snapshots.tipTitle")}>
          {t("snapshots.tipBody")}
        </InfoCallout>
      </DocSection>

      <DocSection
        id="board-reports"
        title={t("board.title")}
        description={t("board.description")}
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FileDown className="h-5 w-5 text-primary" />
            <span className="font-medium">{t("board.pdfLabel")}</span>
            <PremiumBadge />
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-sm font-medium">{t("board.boardIncludes")}</p>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc ml-4">
              {boardKeys.map((key) => (
                <li key={key}>{t(`board.boardItems.${key}`)}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-sm font-medium">{t("board.allPdfsTitle")}</p>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc ml-4">
              {pdfReports.map((r) => (
                <li key={r.label}>
                  <strong>{t(`board.allPdfs.${r.label}`)}</strong>{t(`board.allPdfs.${r.desc}`)}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <InfoCallout type="tip" title={t("board.flowTipTitle")}>
          {t("board.flowTipBody")}
        </InfoCallout>

        <InfoCallout type="info" title={t("board.premiumTitle")}>
          {t("board.premiumBody")}
        </InfoCallout>
      </DocSection>

      <DocNavFooter
        previous={{ title: t("nav.previous"), href: "/privacy/docs/experts" }}
        next={{ title: t("nav.next"), href: "/privacy/docs/dpia-auto-fill" }}
      />
    </div>
  );
}
