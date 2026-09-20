// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { FlowDiagram } from "../components/FlowDiagram";
import { WorkflowStep } from "../components/WorkflowStep";
import { StatusMark } from "@/components/ui/status-chip";
import { toneBorder, toneTint } from "@/config/status-palette";
import { toneForRiskTier, type StatusTone } from "@/config/status-tone";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("docs.publicVendors");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: "/docs/vendors" },
    openGraph: {
      title: t("ogTitle"),
      description: t("ogDescription"),
      url: "/docs/vendors",
    },
  };
}

// The documentation shows the same tones the product paints, and reads the
// same way without them: every panel carries its icon and its word.
const vendorStatuses = [
  { key: "ACTIVE", tone: "success" },
  { key: "UNDER_REVIEW", tone: "warning" },
  { key: "SUSPENDED", tone: "danger" },
  { key: "OFFBOARDED", tone: "neutral" },
] as const satisfies ReadonlyArray<{ key: string; tone: StatusTone }>;

const riskTiers = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

const dashboardStats: { key: string; value: string; tone: StatusTone | null }[] = [
  { key: "total", value: "24", tone: null },
  { key: "active", value: "18", tone: "success" },
  { key: "highRisk", value: "3", tone: "warning" },
  { key: "pendingReview", value: "5", tone: "info" },
];

export default async function VendorsPage() {
  const t = await getTranslations("docs.publicVendors");

  const contractKeys = ["dpa", "sccs", "sub", "security"] as const;
  const topicKeys = ["scope", "security", "incident", "sub", "retention", "transfers", "training", "certs"] as const;
  const reviewSteps = ["onboarding", "questionnaire", "contract", "approved", "periodic"] as const;
  const howToSteps = [
    { key: "add", actor: "dpo" },
    { key: "send", actor: "dpo" },
    { key: "review", actor: "officer", hasDetails: true },
    { key: "execute", actor: "legal" },
    { key: "approve", actor: "dpo" },
  ] as const;
  const dpaSteps = [
    { key: "open" },
    { key: "review" },
    { key: "confirm" },
    { key: "generate" },
    { key: "download" },
  ] as const;

  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display uppercase tracking-wide text-foreground mb-4">{t("title")}</h1>
        <p className="text-lg text-muted-foreground max-w-2xl">{t("subtitle")}</p>
      </div>

      {/* Vendor Register */}
      <section id="adding" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">{t("register.title")}</h2>
        <p className="text-sm text-muted-foreground mb-6">{t("register.intro")}</p>

        <div className="grid sm:grid-cols-2 gap-3 mb-6">
          {vendorStatuses.map((s) => (
            <div
              key={s.key}
              className={`p-4 rounded-lg border ${toneBorder(s.tone)} ${toneTint(s.tone)}`}
            >
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                <StatusMark tone={s.tone} />
                {t(`register.statuses.${s.key}.label`)}
              </p>
              <p className="text-xs mt-1 text-muted-foreground">{t(`register.statuses.${s.key}.desc`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Risk Tiers */}
      <section id="risk-tiers" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">{t("riskTiers.title")}</h2>
        <p className="text-sm text-muted-foreground mb-6">{t("riskTiers.intro")}</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {riskTiers.map((tier) => (
            <div
              key={tier}
              className={`p-3 rounded-lg border text-center ${toneBorder(toneForRiskTier(tier))} ${toneTint(toneForRiskTier(tier))}`}
            >
              <p className="text-sm font-semibold text-foreground flex items-center justify-center gap-2">
                <StatusMark tone={toneForRiskTier(tier)} />
                {tier}
              </p>
            </div>
          ))}
        </div>

        <p className="text-sm text-muted-foreground">{t("riskTiers.outro")}</p>
      </section>

      {/* Vendor Dashboard */}
      <section id="dashboard" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">{t("dashboard.title")}</h2>
        <p className="text-sm text-muted-foreground mb-6">{t("dashboard.intro")}</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {dashboardStats.map((stat) => (
            <div key={stat.key} className="p-4 rounded-lg border border-border bg-card text-center">
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1">
                {stat.tone && <StatusMark tone={stat.tone} className="h-3 w-3" />}
                {t(`dashboard.stats.${stat.key}`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Contracts */}
      <section id="contracts" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">{t("contracts.title")}</h2>
        <p className="text-sm text-muted-foreground mb-6">{t("contracts.intro")}</p>

        <div className="card-brutal">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">{t("contracts.label")}</p>
          <div className="space-y-2">
            {contractKeys.map((key) => (
              <div key={key} className="flex items-start justify-between p-2 rounded-lg bg-background/50 border border-border/50 gap-3">
                <span className="text-sm font-medium text-foreground">{t(`contracts.items.${key}.doc`)}</span>
                <span className="text-xs text-muted-foreground shrink-0 text-right">{t(`contracts.items.${key}.purpose`)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Generating a DPA + TIA */}
      <section id="dpa-tia" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">{t("dpa.title")}</h2>
        <p className="text-sm text-muted-foreground mb-6">{t("dpa.intro")}</p>

        <div className="grid sm:grid-cols-2 gap-3 mb-8">
          <div className="p-4 rounded-lg border border-border bg-card">
            <p className="text-sm font-semibold text-foreground mb-2">{t("dpa.artifacts.dpaTitle")}</p>
            <p className="text-xs text-muted-foreground">{t("dpa.artifacts.dpaDesc")}</p>
          </div>
          <div className="p-4 rounded-lg border border-border bg-card">
            <p className="text-sm font-semibold text-foreground mb-2">{t("dpa.artifacts.tiaTitle")}</p>
            <p className="text-xs text-muted-foreground">{t("dpa.artifacts.tiaDesc")}</p>
          </div>
        </div>

        {dpaSteps.map((step, i) => (
          <WorkflowStep
            key={step.key}
            number={i + 1}
            title={t(`dpa.steps.${step.key}.title`)}
            description={t(`dpa.steps.${step.key}.description`)}
            actor={t("howTo.actors.officer")}
            details={
              step.key === "review"
                ? [
                    t("dpa.steps.review.detail1"),
                    t("dpa.steps.review.detail2"),
                    t("dpa.steps.review.detail3"),
                  ]
                : undefined
            }
          />
        ))}

        <div className={`p-4 rounded-lg border mt-6 ${toneBorder("warning")} ${toneTint("warning")}`}>
          <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            <StatusMark tone="warning" />
            {t("dpa.honesty.title")}
          </p>
          <p className="text-xs text-muted-foreground">{t("dpa.honesty.desc")}</p>
        </div>
        <div className="p-4 rounded-lg border border-border bg-card mt-3">
          <p className="text-sm font-semibold text-foreground mb-2">{t("dpa.afterTitle")}</p>
          <p className="text-xs text-muted-foreground">{t("dpa.afterDesc")}</p>
        </div>
      </section>

      {/* Questionnaires */}
      <section id="questionnaires" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">{t("questionnaires.title")}</h2>
        <p className="text-sm text-muted-foreground mb-6">{t("questionnaires.intro")}</p>

        <div className="card-brutal">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">{t("questionnaires.label")}</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {topicKeys.map((topic) => (
              <div key={topic} className="flex items-center gap-2 text-sm text-foreground">
                <span className="text-primary text-xs">&#9679;</span>
                {t(`questionnaires.topics.${topic}`)}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Vendor Review Workflow */}
      <section id="risk-reviews" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">{t("review.title")}</h2>
        <p className="text-sm text-muted-foreground mb-6">{t("review.intro")}</p>

        <div className="card-brutal mb-8">
          <FlowDiagram
            steps={reviewSteps.map((k) => ({
              label: t(`review.steps.${k}.label`),
              description: t(`review.steps.${k}.description`),
            }))}
          />
        </div>
      </section>

      {/* Adding a Vendor */}
      <section id="how-to" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-6">{t("howTo.title")}</h2>
        {howToSteps.map((step, i) => (
          <WorkflowStep
            key={step.key}
            number={i + 1}
            title={t(`howTo.steps.${step.key}.title`)}
            description={t(`howTo.steps.${step.key}.description`)}
            actor={t(`howTo.actors.${step.actor}`)}
            details={
              step.key === "review"
                ? [
                    t("howTo.steps.review.detail1"),
                    t("howTo.steps.review.detail2"),
                    t("howTo.steps.review.detail3"),
                  ]
                : undefined
            }
          />
        ))}
      </section>

      {/* PDF Exports */}
      <section id="exports" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">{t("exports.title")}</h2>
        <p className="text-sm text-muted-foreground mb-6">{t("exports.intro")}</p>

        <div className="p-4 rounded-lg border border-border bg-card">
          <p className="text-sm font-semibold text-foreground mb-2">{t("exports.registerTitle")}</p>
          <p className="text-xs text-muted-foreground">{t("exports.registerDesc")}</p>
        </div>
      </section>
    </div>
  );
}
