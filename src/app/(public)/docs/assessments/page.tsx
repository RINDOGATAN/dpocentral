// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { FlowDiagram } from "../components/FlowDiagram";
import { WorkflowStep } from "../components/WorkflowStep";
import {
  DPIA_FRAMEWORK_ELEMENTS,
  FRAMEWORK_CITATIONS,
  FRAMEWORK_IDS,
  FRAMEWORK_LABELS,
} from "@/config/assessment-frameworks";
import { StatusChip, StatusMark } from "@/components/ui/status-chip";
import { toneBorder, toneTint } from "@/config/status-palette";
import { toneForRiskTier } from "@/config/status-tone";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("docs.publicAssessments");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: "/docs/assessments" },
    openGraph: {
      title: t("ogTitle"),
      description: t("ogDescription"),
      url: "/docs/assessments",
    },
  };
}

/**
 * The types the product offers, with the tier the mark describes.
 *
 * A type is offered only once a template exists for it, which is what
 * getEntitledAssessmentTypes reports; PIA and VENDOR have no template and are
 * not offered on any build, so they are not listed here either. The tier is
 * the one the licence gate uses: PREMIUM_ASSESSMENT_TYPES in
 * server/services/licensing/entitlement.ts, where TIA is free.
 */
const templateData: { type: string; tier: "Core" | "Premium" }[] = [
  { type: "LIA", tier: "Core" },
  { type: "CUSTOM", tier: "Core" },
  { type: "TIA", tier: "Core" },
  { type: "DPIA", tier: "Premium" },
];

// The documentation shows the same tones the product paints, each with the
// icon that says the same thing as the hue.
const riskLevels = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

const MITIGATION_TONE = {
  Implemented: "success",
  InProgress: "warning",
  Planned: "info",
} as const;

const mitigationItems: { key: string; statusKey: "Implemented" | "Planned" | "InProgress" }[] = [
  { key: "encryption", statusKey: "Implemented" },
  { key: "access", statusKey: "Implemented" },
  { key: "vendor", statusKey: "Planned" },
  { key: "dlp", statusKey: "InProgress" },
];

/** The DPIA walkthrough, in the order of the real screens. */
const walkthroughSteps = [
  { key: "start", actor: "dpo" },
  { key: "create", actor: "dpo", details: 2 },
  { key: "frameworks", actor: "dpo", details: 2 },
  { key: "european", actor: "dpo" },
  { key: "california", actor: "dpo" },
  { key: "outstanding", actor: "dpo" },
  { key: "approve", actor: "approver" },
  { key: "export", actor: "dpo" },
] as const;

export default async function AssessmentsPage() {
  const t = await getTranslations("docs.publicAssessments");
  const lang = (await getLocale()) === "es" ? "es" : "en";

  const approvalSteps = ["draft", "progress", "review", "approved"] as const;
  const individualFeatures = [
    "conformance",
    "draft",
    "cover",
    "stats",
    "qa",
    "mitigation",
    "history",
  ] as const;
  const portfolioFeatures = ["status", "type", "highRisk", "mitigation", "perType"] as const;

  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display uppercase tracking-wide text-foreground mb-4">{t("title")}</h1>
        <p className="text-lg text-muted-foreground max-w-2xl">{t("subtitle")}</p>
      </div>

      {/* Assessment Types */}
      <section id="templates" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">{t("templates.title")}</h2>
        <p className="text-sm text-muted-foreground mb-6">{t("templates.intro")}</p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {templateData.map((tmpl) => (
            <div key={tmpl.type} className="p-4 rounded-lg border border-border bg-card">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">
                  {tmpl.type}
                </span>
                {tmpl.tier === "Premium" && (
                  <StatusChip tone="warning" hideIcon className="text-[10px] px-2 py-0.5">
                    {t("templates.premiumBadge")}
                  </StatusChip>
                )}
              </div>
              <p className="text-sm font-medium text-foreground">{t(`templates.items.${tmpl.type}.name`)}</p>
              <p className="text-xs text-muted-foreground mt-1">{t(`templates.items.${tmpl.type}.desc`)}</p>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground mt-4">{t("templates.hostedNote")}</p>
      </section>

      {/* Approval Workflow */}
      <section id="approvals" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">{t("approvals.title")}</h2>
        <p className="text-sm text-muted-foreground mb-6">{t("approvals.intro")}</p>

        <div className="card-brutal">
          <FlowDiagram
            steps={approvalSteps.map((k) => ({
              label: t(`approvals.steps.${k}.label`),
              description: t(`approvals.steps.${k}.description`),
            }))}
          />
        </div>
      </section>

      {/* Risk Scoring */}
      <section id="risk-scoring" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">{t("riskScoring.title")}</h2>
        <p className="text-sm text-muted-foreground mb-6">{t("riskScoring.intro")}</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {riskLevels.map((level) => (
            <div
              key={level}
              className={`p-3 rounded-lg border text-center ${toneBorder(toneForRiskTier(level))} ${toneTint(toneForRiskTier(level))}`}
            >
              <p className="text-sm font-semibold text-foreground flex items-center justify-center gap-2">
                <StatusMark tone={toneForRiskTier(level)} />
                {level}
              </p>
            </div>
          ))}
        </div>

        <p className="text-sm text-muted-foreground">{t("riskScoring.outro")}</p>
      </section>

      {/* Mitigations */}
      <section id="mitigations" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">{t("mitigations.title")}</h2>
        <p className="text-sm text-muted-foreground mb-6">{t("mitigations.intro")}</p>

        <div className="card-brutal">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">{t("mitigations.exampleLabel")}</p>
          <div className="space-y-2">
            {mitigationItems.map((m) => (
              <div key={m.key} className="flex items-center justify-between p-2 rounded-lg bg-background/50 border border-border/50">
                <span className="text-sm text-foreground">{t(`mitigations.items.${m.key}`)}</span>
                <StatusChip tone={MITIGATION_TONE[m.statusKey]} className="text-xs shrink-0 ml-3 px-2 py-0.5">
                  {t(`mitigations.statuses.${m.statusKey}`)}
                </StatusChip>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Run a DPIA, step by step, on the real screens */}
      <section id="walkthrough" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">{t("walkthrough.title")}</h2>
        <p className="text-sm text-muted-foreground mb-6">{t("walkthrough.intro")}</p>
        {walkthroughSteps.map((step, i) => (
          <WorkflowStep
            key={step.key}
            number={i + 1}
            title={t(`walkthrough.steps.${step.key}.title`)}
            description={t(`walkthrough.steps.${step.key}.description`)}
            actor={t(`walkthrough.actors.${step.actor}`)}
            details={
              "details" in step
                ? [
                    t(`walkthrough.steps.${step.key}.detail1`),
                    t(`walkthrough.steps.${step.key}.detail2`),
                  ]
                : undefined
            }
          />
        ))}
      </section>

      {/* The conformance table, rendered from the product's own requirement data */}
      <section id="conformance" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">{t("conformance.title")}</h2>
        <p className="text-sm text-muted-foreground mb-6">{t("conformance.intro")}</p>

        <div className="space-y-6">
          {FRAMEWORK_IDS.map((framework) => (
            <div key={framework} className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-semibold text-foreground">
                {FRAMEWORK_LABELS[framework][lang]}
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                {FRAMEWORK_CITATIONS[framework][lang]}
              </p>
              <div className="flex flex-col gap-2">
                {DPIA_FRAMEWORK_ELEMENTS.filter((e) => e.framework === framework).map((e) => (
                  <div key={e.id} className="flex items-start gap-3 text-sm">
                    <span className="shrink-0 font-mono text-xs text-primary w-28">
                      {e.citation[lang]}
                    </span>
                    <span className="text-muted-foreground">{e.label[lang]}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground mt-4">{t("conformance.note")}</p>
        <p className="text-xs text-muted-foreground mt-2">{t("conformance.disclaimer")}</p>
      </section>

      {/* PDF Exports */}
      <section id="exports" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">{t("exports.title")}</h2>
        <p className="text-sm text-muted-foreground mb-6">{t("exports.intro")}</p>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg border border-border bg-card">
            <p className="text-sm font-semibold text-foreground mb-2">{t("exports.individualTitle")}</p>
            <p className="text-xs text-muted-foreground mb-3">{t("exports.individualDesc")}</p>
            <div className="space-y-1">
              {individualFeatures.map((f) => (
                <p key={f} className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span className="text-primary">&#10003;</span> {t(`exports.individualFeatures.${f}`)}
                </p>
              ))}
            </div>
          </div>
          <div className="p-4 rounded-lg border border-border bg-card">
            <p className="text-sm font-semibold text-foreground mb-2">{t("exports.portfolioTitle")}</p>
            <p className="text-xs text-muted-foreground mb-3">{t("exports.portfolioDesc")}</p>
            <div className="space-y-1">
              {portfolioFeatures.map((f) => (
                <p key={f} className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span className="text-primary">&#10003;</span> {t(`exports.portfolioFeatures.${f}`)}
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
