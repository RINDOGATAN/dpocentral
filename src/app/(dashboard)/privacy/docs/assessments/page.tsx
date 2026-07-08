// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { ClipboardCheck, ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DocSection } from "@/components/docs/doc-section";
import { StepList } from "@/components/docs/step-list";
import { FeatureMockup } from "@/components/docs/feature-mockup";
import { InfoCallout } from "@/components/docs/info-callout";
import { PremiumBadge } from "@/components/docs/premium-badge";
import { DocNavFooter } from "@/components/docs/doc-nav-footer";

const typeConfig: Record<string, { premium: boolean; color: string }> = {
  LIA: { premium: false, color: "bg-green-100 text-green-800 border-transparent" },
  CUSTOM: { premium: false, color: "bg-gray-100 text-gray-800 border-transparent" },
  DPIA: { premium: true, color: "bg-purple-100 text-purple-800 border-transparent" },
  PIA: { premium: true, color: "bg-indigo-100 text-indigo-800 border-transparent" },
  TIA: { premium: true, color: "bg-blue-100 text-blue-800 border-transparent" },
  VENDOR: { premium: true, color: "bg-orange-100 text-orange-800 border-transparent" },
};

const riskConfig: Record<string, string> = {
  LOW: "bg-green-100 text-green-800 border-transparent",
  MEDIUM: "bg-yellow-100 text-yellow-800 border-transparent",
  HIGH: "bg-orange-100 text-orange-800 border-transparent",
  CRITICAL: "bg-red-100 text-red-800 border-transparent",
};

export default async function DocsAssessmentsPage() {
  const t = await getTranslations("docs.assessments");

  const stepKeys = ["select", "fill", "answer", "score", "mitigate", "submit"] as const;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      <DocSection id="templates" title={t("templates.title")} description={t("templates.description")}>
        <FeatureMockup title={t("templates.mockupTitle")}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(typeConfig).map(([key, config]) => (
              <Card key={key} className="hover:translate-y-0">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <ClipboardCheck className="h-4 w-4 text-primary" />
                    <Badge variant="outline" className={`text-[10px] ${config.color}`}>{key}</Badge>
                    {config.premium && <PremiumBadge />}
                  </div>
                  <p className="text-sm font-medium">
                    {t(`templates.labels.${key}`)} {t("templates.labelSuffix")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t(`templates.descs.${key}`)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </FeatureMockup>
        <InfoCallout type="info" title={t("templates.calloutTitle")}>
          <strong>{t("templates.calloutFreeLabel")}</strong>{t("templates.calloutFreeBody")}
          <strong>{t("templates.calloutPremiumLabel")}</strong>{t("templates.calloutPremiumBody")}
          {t("templates.calloutSeeMorePrefix")}
          <a href="/privacy/docs/premium" className="text-primary underline">{t("templates.calloutSeeMoreLink")}</a>
          {t("templates.calloutSeeMoreSuffix")}
        </InfoCallout>
      </DocSection>

      <DocSection id="creating" title={t("creating.title")} description={t("creating.description")}>
        <StepList
          steps={stepKeys.map((k) => ({
            title: t(`creating.steps.${k}.title`),
            description: t(`creating.steps.${k}.description`),
          }))}
        />
      </DocSection>

      <DocSection id="risk-scoring" title={t("riskScoring.title")} description={t("riskScoring.description")}>
        <FeatureMockup title={t("riskScoring.mockupTitle")}>
          <div className="flex flex-wrap gap-3">
            {Object.entries(riskConfig).map(([level, color]) => (
              <div key={level} className="flex items-center gap-2">
                <Badge variant="outline" className={`${color}`}>{level}</Badge>
                <span className="text-xs text-muted-foreground">
                  {t(`riskScoring.levels.${level}`)}
                </span>
              </div>
            ))}
          </div>
        </FeatureMockup>
      </DocSection>

      <DocSection id="mitigations" title={t("mitigations.title")} description={t("mitigations.description")}>
        <InfoCallout type="tip" title={t("mitigations.calloutTitle")}>
          {t("mitigations.calloutBody")}
        </InfoCallout>
      </DocSection>

      <DocSection id="approvals" title={t("approvals.title")} description={t("approvals.description")}>
        <FeatureMockup title={t("approvals.mockupTitle")}>
          <div className="flex items-center justify-center gap-2 flex-wrap py-2">
            {["DRAFT", "IN_PROGRESS", "PENDING_REVIEW", "APPROVED"].map((status, i) => (
              <div key={status} className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={`text-[10px] ${
                    status === "APPROVED"
                      ? "bg-primary text-primary-foreground border-transparent"
                      : status === "IN_PROGRESS"
                        ? "bg-primary/20 text-primary border-transparent"
                        : ""
                  }`}
                >
                  {status.replace("_", " ")}
                </Badge>
                {i < 3 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
              </div>
            ))}
          </div>
        </FeatureMockup>
        <InfoCallout type="note" title={t("approvals.rejectionTitle")}>
          {t("approvals.rejectionBody")}
        </InfoCallout>
      </DocSection>

      <DocNavFooter
        previous={{ title: t("nav.previous"), href: "/privacy/docs/dsar" }}
        next={{ title: t("nav.next"), href: "/privacy/docs/incidents" }}
      />
    </div>
  );
}
