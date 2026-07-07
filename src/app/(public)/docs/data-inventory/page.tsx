// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { FlowDiagram } from "../components/FlowDiagram";
import { WorkflowStep } from "../components/WorkflowStep";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("docs.publicDataInventory");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: "/docs/data-inventory" },
    openGraph: {
      title: t("ogTitle"),
      description: t("ogDescription"),
      url: "/docs/data-inventory",
    },
  };
}

const assetTypes = ["DATABASE", "APPLICATION", "FILE_SYSTEM", "CLOUD_SERVICE", "API", "PHYSICAL"] as const;

const sensitivities = [
  { level: "PUBLIC", color: "bg-green-500/10 text-green-400 border-green-500/20" },
  { level: "INTERNAL", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  { level: "CONFIDENTIAL", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  { level: "RESTRICTED", color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  { level: "SPECIAL_CATEGORY", color: "bg-red-500/10 text-red-400 border-red-500/20" },
];

const legalBases = [
  "CONSENT",
  "CONTRACT",
  "LEGAL_OBLIGATION",
  "VITAL_INTERESTS",
  "PUBLIC_TASK",
  "LEGITIMATE_INTERESTS",
];

export default async function DataInventoryPage() {
  const t = await getTranslations("docs.publicDataInventory");

  const flowSteps = ["collection", "processing", "analytics", "archival"] as const;
  const transferKeys = ["adequacy", "sccs", "bcrs"] as const;
  const howToSteps = ["navigate", "click", "fill", "link", "save"] as const;

  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display uppercase tracking-wide text-foreground mb-4">{t("title")}</h1>
        <p className="text-lg text-muted-foreground max-w-2xl">{t("subtitle")}</p>
      </div>

      {/* Data Assets */}
      <section id="assets" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">{t("assets.title")}</h2>
        <p className="text-sm text-muted-foreground mb-6">{t("assets.intro")}</p>

        <div className="grid sm:grid-cols-2 gap-3 mb-6">
          {assetTypes.map((type) => (
            <div key={type} className="p-4 rounded-lg border border-border bg-card">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">
                  {type.replace("_", " ")}
                </span>
              </div>
              <p className="text-sm font-medium text-foreground mt-2">{t(`assets.items.${type}.example`)}</p>
              <p className="text-xs text-muted-foreground mt-1">{t(`assets.items.${type}.desc`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Data Elements */}
      <section id="data-elements" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">{t("elements.title")}</h2>
        <p className="text-sm text-muted-foreground mb-6">{t("elements.intro")}</p>

        <div className="flex flex-wrap gap-2 mb-6">
          {sensitivities.map((s) => (
            <span key={s.level} className={`text-xs px-3 py-1 rounded-full border ${s.color}`}>
              {s.level.replace("_", " ")}
            </span>
          ))}
        </div>

        <p className="text-sm text-muted-foreground">{t("elements.examples")}</p>
      </section>

      {/* Processing Activities */}
      <section id="processing-activities" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">{t("activities.title")}</h2>
        <p className="text-sm text-muted-foreground mb-6">{t("activities.intro")}</p>

        <div className="card-brutal mb-6">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">{t("activities.legalBasesLabel")}</p>
          <div className="flex flex-wrap gap-2">
            {legalBases.map((basis) => (
              <span key={basis} className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                {basis.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>

        <p className="text-sm text-muted-foreground">{t("activities.outro")}</p>
      </section>

      {/* Data Flows */}
      <section id="data-flows" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">{t("flows.title")}</h2>
        <p className="text-sm text-muted-foreground mb-6">{t("flows.intro")}</p>

        <div className="card-brutal">
          <FlowDiagram
            steps={flowSteps.map((k) => ({
              label: t(`flows.steps.${k}.label`),
              description: t(`flows.steps.${k}.description`),
            }))}
          />
        </div>
      </section>

      {/* Cross-Border Transfers */}
      <section id="transfers" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">{t("transfers.title")}</h2>
        <p className="text-sm text-muted-foreground mb-6">{t("transfers.intro")}</p>

        <div className="grid sm:grid-cols-3 gap-3">
          {transferKeys.map((k) => (
            <div key={k} className="p-3 rounded-lg border border-border bg-card">
              <p className="text-sm font-medium text-foreground">{t(`transfers.items.${k}.mechanism`)}</p>
              <p className="text-xs text-muted-foreground mt-1">{t(`transfers.items.${k}.desc`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How to Add a Data Asset */}
      <section id="how-to" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-6">{t("howTo.title")}</h2>
        {howToSteps.map((step, i) => (
          <WorkflowStep
            key={step}
            number={i + 1}
            title={t(`howTo.steps.${step}.title`)}
            description={t(`howTo.steps.${step}.description`)}
            actor={t("howTo.actorDpo")}
            details={
              step === "fill"
                ? [
                    t("howTo.steps.fill.detail1"),
                    t("howTo.steps.fill.detail2"),
                    t("howTo.steps.fill.detail3"),
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

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg border border-border bg-card">
            <p className="text-sm font-semibold text-foreground mb-2">{t("exports.inventoryTitle")}</p>
            <p className="text-xs text-muted-foreground">{t("exports.inventoryDesc")}</p>
          </div>
          <div className="p-4 rounded-lg border border-border bg-card">
            <p className="text-sm font-semibold text-foreground mb-2">{t("exports.ropaTitle")}</p>
            <p className="text-xs text-muted-foreground">{t("exports.ropaDesc")}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
