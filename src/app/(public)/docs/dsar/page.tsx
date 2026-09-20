// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { FlowDiagram } from "../components/FlowDiagram";
import { WorkflowStep } from "../components/WorkflowStep";
import { brand } from "@/config/brand";
import { StatusChip, StatusMark } from "@/components/ui/status-chip";
import { toneBorder, toneTint } from "@/config/status-palette";
import type { StatusTone } from "@/config/status-tone";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("docs.publicDsar");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: "/docs/dsar" },
    openGraph: {
      title: t("ogTitle"),
      description: t("ogDescription"),
      url: "/docs/dsar",
    },
  };
}

// The documentation shows the same tones the product paints, and reads the
// same way without them: every chip and panel carries its icon and its word.
const statusTones: { status: string; tone: StatusTone }[] = [
  { status: "SUBMITTED", tone: "info" },
  { status: "IDENTITY_PENDING", tone: "warning" },
  { status: "IN_PROGRESS", tone: "info" },
  { status: "ON_HOLD", tone: "warning" },
  { status: "COMPLETED", tone: "success" },
  { status: "REJECTED", tone: "danger" },
];

const privacyItems: { key: string; tone: StatusTone }[] = [
  { key: "min", tone: "success" },
  { key: "consent", tone: "success" },
  { key: "auto", tone: "info" },
  { key: "pii", tone: "info" },
  { key: "manual", tone: "warning" },
  { key: "audit", tone: "warning" },
];

const requestTypes = ["ACCESS", "ERASURE", "RECTIFICATION", "PORTABILITY", "OBJECTION", "RESTRICTION"] as const;

export default async function DSARPage() {
  const t = await getTranslations("docs.publicDsar");

  const lifecycleSteps = ["submitted", "identity", "progress", "review", "completed"] as const;
  const portalSettings = ["title", "types", "css", "thanks", "retention", "notice"] as const;
  const taskItems = ["verify", "crm", "email", "compile", "redact", "deliver"] as const;
  const slaStats = ["days", "auto", "alerts"] as const;
  const slaTones: Record<typeof slaStats[number], StatusTone> = {
    days: "success",
    auto: "warning",
    alerts: "danger",
  };
  const retentionSteps = ["completed", "period", "auto", "anon"] as const;
  const redactedKeys = ["contact", "description", "comms", "data"] as const;
  const preservedKeys = ["type", "status", "audit", "stats"] as const;
  const reportingSections = ["exec", "volume", "status", "sla", "trend", "aging"] as const;
  const workflowSteps = [
    { key: "receive", actor: "system" },
    { key: "verify", actor: "officer", hasDetails: true },
    { key: "assign", actor: "officer" },
    { key: "collect", actor: "team" },
    { key: "deliver", actor: "officer" },
  ] as const;

  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display uppercase tracking-wide text-foreground mb-4">{t("title")}</h1>
        <p className="text-lg text-muted-foreground max-w-2xl">{t("subtitle")}</p>
      </div>

      {/* Request Lifecycle */}
      <section id="lifecycle" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">{t("lifecycle.title")}</h2>
        <p className="text-sm text-muted-foreground mb-6">{t("lifecycle.intro")}</p>

        <div className="card-brutal">
          <FlowDiagram
            steps={lifecycleSteps.map((k) => ({
              label: t(`lifecycle.steps.${k}.label`),
              description: t(`lifecycle.steps.${k}.description`),
            }))}
          />
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {statusTones.map((s) => (
            <StatusChip key={s.status} tone={s.tone} className="px-3 py-1">
              {s.status.replace(/_/g, " ")}
            </StatusChip>
          ))}
        </div>
      </section>

      {/* Privacy by Design */}
      <section id="privacy" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">{t("privacy.title")}</h2>
        <p className="text-sm text-muted-foreground mb-6">{t("privacy.intro")}</p>

        <div className="grid sm:grid-cols-2 gap-3">
          {privacyItems.map((item) => (
            <div
              key={item.key}
              className={`p-4 rounded-lg border ${toneBorder(item.tone)} ${toneTint(item.tone)}`}
            >
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                <StatusMark tone={item.tone} />
                {t(`privacy.items.${item.key}.title`)}
              </p>
              <p className="text-xs mt-1 text-muted-foreground">{t(`privacy.items.${item.key}.desc`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Request Types */}
      <section id="request-types" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">{t("types.title")}</h2>
        <p className="text-sm text-muted-foreground mb-6">{t("types.intro")}</p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {requestTypes.map((type) => (
            <div key={type} className="p-4 rounded-lg border border-border bg-card">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">
                {type}
              </span>
              <p className="text-xs text-muted-foreground mt-2">{t(`types.items.${type}`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Public Portal */}
      <section id="portal" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">{t("portal.title")}</h2>
        <p className="text-sm text-muted-foreground mb-6">{t("portal.intro")}</p>

        <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
          <p className="text-xs text-primary font-medium mb-2">{t("portal.urlLabel")}</p>
          <code className="text-sm text-muted-foreground">
            {brand.appUrl}/dsar/your-org-slug
          </code>
          <p className="text-xs text-muted-foreground mt-2">{t("portal.urlExplain")}</p>
        </div>

        <div className="mt-6 card-brutal">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">{t("portal.configLabel")}</p>
          <div className="space-y-2">
            {portalSettings.map((key) => (
              <div key={key} className="flex items-center justify-between p-2 rounded-lg bg-background/50 border border-border/50">
                <span className="text-sm text-foreground">{t(`portal.settings.${key}.setting`)}</span>
                <span className="text-xs text-muted-foreground shrink-0 ml-3">{t(`portal.settings.${key}.detail`)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Task Management */}
      <section id="tasks" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">{t("tasks.title")}</h2>
        <p className="text-sm text-muted-foreground mb-6">{t("tasks.intro")}</p>

        <div className="card-brutal">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">{t("tasks.exampleLabel")}</p>
          <div className="space-y-2">
            {taskItems.map((key) => (
              <div key={key} className="flex items-center justify-between p-2 rounded-lg bg-background/50 border border-border/50">
                <span className="text-sm text-foreground">{t(`tasks.items.${key}.task`)}</span>
                <span className="text-xs text-muted-foreground shrink-0 ml-3">{t(`tasks.items.${key}.assignee`)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SLA Tracking */}
      <section id="sla" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">{t("sla.title")}</h2>
        <p className="text-sm text-muted-foreground mb-6">{t("sla.intro")}</p>

        <div className="card-brutal">
          <div className="grid sm:grid-cols-3 gap-4">
            {slaStats.map((key) => (
              <div key={key} className="text-center">
                <p className="text-2xl font-bold text-foreground">{t(`sla.stats.${key}.value`)}</p>
                <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <StatusMark tone={slaTones[key]} className="h-3 w-3" />
                  {t(`sla.stats.${key}.label`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Data Retention & Redaction */}
      <section id="retention" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">{t("retention.title")}</h2>
        <p className="text-sm text-muted-foreground mb-6">{t("retention.intro")}</p>

        <div className="card-brutal">
          <FlowDiagram
            steps={retentionSteps.map((k) => ({
              label: t(`retention.steps.${k}.label`),
              description: t(`retention.steps.${k}.description`),
            }))}
          />
        </div>

        <div className="mt-6 grid sm:grid-cols-2 gap-3">
          <div className="p-4 rounded-lg border border-border bg-card">
            <p className="text-sm font-semibold text-foreground">{t("retention.redactedTitle")}</p>
            <ul className="text-xs text-muted-foreground mt-2 space-y-1">
              {redactedKeys.map((k) => (
                <li key={k}>{t(`retention.redactedItems.${k}`)}</li>
              ))}
            </ul>
          </div>
          <div className="p-4 rounded-lg border border-border bg-card">
            <p className="text-sm font-semibold text-foreground">{t("retention.preservedTitle")}</p>
            <ul className="text-xs text-muted-foreground mt-2 space-y-1">
              {preservedKeys.map((k) => (
                <li key={k}>{t(`retention.preservedItems.${k}`)}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Performance Report */}
      <section id="reporting" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">{t("reporting.title")}</h2>
        <p className="text-sm text-muted-foreground mb-6">{t("reporting.intro")}</p>

        <div className="card-brutal">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">{t("reporting.sectionsLabel")}</p>
          <div className="space-y-2">
            {reportingSections.map((key) => (
              <div key={key} className="flex items-center justify-between p-2 rounded-lg bg-background/50 border border-border/50">
                <span className="text-sm text-foreground">{t(`reporting.sections.${key}.section`)}</span>
                <span className="text-xs text-muted-foreground shrink-0 ml-3">{t(`reporting.sections.${key}.detail`)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Processing Workflow */}
      <section id="workflow" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-6">{t("workflow.title")}</h2>
        {workflowSteps.map((step, i) => (
          <WorkflowStep
            key={step.key}
            number={i + 1}
            title={t(`workflow.steps.${step.key}.title`)}
            description={t(`workflow.steps.${step.key}.description`)}
            actor={t(`workflow.actors.${step.actor}`)}
            details={
              step.key === "verify"
                ? [
                    t("workflow.steps.verify.detail1"),
                    t("workflow.steps.verify.detail2"),
                  ]
                : undefined
            }
          />
        ))}
      </section>
    </div>
  );
}
