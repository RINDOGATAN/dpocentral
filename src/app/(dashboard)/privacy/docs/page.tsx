// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import {
  Building2,
  Download,
  FileText,
  ListChecks,
  Lock,
  Sparkles,
  Zap,
  ArrowRight,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import type { StatusTone } from "@/config/status-tone";
import { DocSection } from "@/components/docs/doc-section";
import { FeatureMockup } from "@/components/docs/feature-mockup";
import { InfoCallout } from "@/components/docs/info-callout";
import { DocNavFooter } from "@/components/docs/doc-nav-footer";
import { DPO_CENTRAL_PATH } from "@/components/guided/path-config";
import Link from "next/link";
import { isDsarModuleEnabled } from "@/config/features";

/**
 * Getting started: the dashboard, the documents panel, the next actions and
 * deadlines, the quick start, the menu and the roles, as the product shows
 * them since the Classic layout was retired (9 October 2026). Stage, step,
 * state and list names are read from the product's own translations (the
 * `guided`, `views` and `documentRegister` namespaces), and the stages from
 * the path itself, so the guide names what the screens name.
 */
export default async function DocsGettingStartedPage() {
  const t = await getTranslations("docs.gettingStarted");
  const tg = await getTranslations("guided");
  const tv = await getTranslations("views");
  const td = await getTranslations("documentRegister");
  // Without the rights-request module (src/config/features.ts) the guide
  // leaves it out of the menu, the next actions and the deadlines.
  const dsarOn = isDsarModuleEnabled();

  // A sample of the six area tiles, one of each state word.
  const sampleAreas: { stage: string; word: string; tone: StatusTone }[] = [
    { stage: "setup", word: "done", tone: "success" },
    { stage: "people", word: "coming", tone: "neutral" },
    { stage: "inventory", word: "toConfirm", tone: "warning" },
    { stage: "assess", word: "started", tone: "info" },
    { stage: "rights", word: "todo", tone: "neutral" },
    { stage: "respond", word: "action", tone: "danger" },
  ];

  const dashboardParts = ["firstRun", "figure", "areas", "documents", "next", "missing"] as const;

  const documentStates: { key: "ready" | "draft" | "needsInput" | "notYet"; tone: StatusTone }[] = [
    { key: "ready", tone: "success" },
    { key: "draft", tone: "info" },
    { key: "needsInput", tone: "warning" },
    { key: "notYet", tone: "neutral" },
  ];

  const needsActionKinds = [
    "drafts-to-confirm",
    "review-due",
    "dsar-due",
    "breach-window",
    "breach-decision",
    "assessment-approval",
  ].filter((kind) => dsarOn || kind !== "dsar-due");

  const libraryItems = ["needsAction", "incomplete", "reports", "auditTrail", "experts", "skills", "help", "settings"] as const;

  const roleRows = ["OWNER", "ADMIN", "PRIVACY_OFFICER", "MEMBER", "VIEWER"] as const;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      <DocSection id="dashboard" title={t("dashboard.title")} description={t("dashboard.description")}>
        <FeatureMockup title={t("dashboard.mockupTitle")}>
          <div className="space-y-3">
            <Card className="hover:translate-y-0">
              <CardContent className="p-4 space-y-1">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {tg("overallLabel")}
                </p>
                <p className="text-lg font-semibold">{tg("figure.line", { done: 4, total: 10 })}</p>
                <p className="text-xs text-muted-foreground">
                  {tg("figure.toConfirm", { count: 1 })} · {tg("figure.started", { count: 2 })} ·{" "}
                  {tg("figure.notStarted", { count: 3 })}
                </p>
              </CardContent>
            </Card>
            <ul className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {sampleAreas.map((area, i) => (
                <li key={area.stage} className="rounded-lg border p-3 flex items-start justify-between gap-2">
                  <span className="min-w-0 text-sm font-medium break-words">
                    <span className="tabular-nums text-muted-foreground mr-1.5">{i + 1}</span>
                    {tg(`stages.${area.stage}`)}
                  </span>
                  <StatusChip tone={area.tone} className="text-xs shrink-0">
                    {tg(`stageState.${area.word}`)}
                  </StatusChip>
                </li>
              ))}
            </ul>
          </div>
        </FeatureMockup>
        <ul className="list-disc ml-5 space-y-1.5 text-sm text-muted-foreground">
          {dashboardParts.map((part) => (
            <li key={part}>{t(`dashboard.parts.${part}`)}</li>
          ))}
        </ul>
        <InfoCallout type="tip" title={t("dashboard.calloutTitle")}>
          {t("dashboard.calloutBody")}
        </InfoCallout>
        <InfoCallout type="info" title={t("dashboard.limitedTitle")}>
          {t("dashboard.limitedBody")}
        </InfoCallout>
      </DocSection>

      <DocSection id="documents" title={t("documents.title")} description={t("documents.description")}>
        <div className="rounded-lg border divide-y">
          {documentStates.map((state) => (
            <div key={state.key} className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4 p-3">
              <StatusChip tone={state.tone} className="text-xs shrink-0 self-start">
                {td(`state.${state.key}`)}
              </StatusChip>
              <p className="text-sm text-muted-foreground">{t(`documents.states.${state.key}`)}</p>
            </div>
          ))}
        </div>
        <div className="flex items-start gap-3 rounded-lg border p-3">
          <div className="rounded-md bg-primary/10 p-2">
            <Download className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="font-medium text-sm">{td("pack.button")}</p>
            <p className="text-xs text-muted-foreground">{t("documents.packBody")}</p>
          </div>
        </div>
      </DocSection>

      <DocSection id="next-actions" title={t("nextActions.title")} description={t("nextActions.description")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border p-3">
            <p className="font-medium text-sm">{tg("nextActions.title")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("nextActions.nextBody")}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="font-medium text-sm">{tg("deadlines.title")}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {dsarOn ? t("nextActions.deadlinesBody") : t("nextActions.deadlinesBodyNoDsar")}
            </p>
          </div>
        </div>
        <div className="rounded-lg border p-3 space-y-2">
          <p className="font-medium text-sm flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-primary" />
            {tv("needsAction.title")}
          </p>
          <p className="text-xs text-muted-foreground">{t("nextActions.needsBody")}</p>
          <ul className="list-disc ml-5 space-y-1 text-xs text-muted-foreground">
            {needsActionKinds.map((kind) => (
              <li key={kind}>
                <span className="font-medium text-foreground">{tv(`needsAction.kind.${kind}`)}</span>:{" "}
                {tv(`needsAction.hint.${kind}`)}
              </li>
            ))}
          </ul>
        </div>
        {dsarOn && (
          <InfoCallout type="info" title={t("nextActions.dsarTitle")}>
            {t("nextActions.dsarBody")}
          </InfoCallout>
        )}
      </DocSection>

      <DocSection id="quickstart" title={t("quickstart.title")} description={t("quickstart.description")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <div className="rounded-md bg-primary/10 p-2">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">{t("quickstart.importVendors.title")}</p>
              <p className="text-xs text-muted-foreground">{t("quickstart.importVendors.desc")}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <div className="rounded-md bg-primary/10 p-2">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">{t("quickstart.industryTemplate.title")}</p>
              <p className="text-xs text-muted-foreground">{t("quickstart.industryTemplate.desc")}</p>
            </div>
          </div>
        </div>
        <InfoCallout type="tip" title={t("quickstart.vendorWatchTitle")}>
          {t("quickstart.vendorWatchBody")}
        </InfoCallout>
        <InfoCallout type="info" title={t("quickstart.nonDestructiveTitle")}>
          {t("quickstart.nonDestructiveBody")}
        </InfoCallout>
        <div className="mt-2 flex flex-wrap gap-3">
          <Link href="/privacy/quickstart">
            <Button className="gap-2 whitespace-normal h-auto min-h-9 text-left">
              <Zap className="w-4 h-4" />
              {t("quickstart.openWizard")}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link href="/privacy/docs/quickstart">
            <Button variant="outline" className="gap-2 whitespace-normal h-auto min-h-9 text-left">
              {t("quickstart.fullGuide")}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </DocSection>

      <DocSection id="navigation" title={t("navigation.title")} description={t("navigation.description")}>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>{t("navigation.organisation")}</p>
          <p>{t("navigation.stages")}</p>
        </div>
        <ol className="grid gap-3 sm:grid-cols-2">
          {DPO_CENTRAL_PATH.stages.map((stage, i) => {
            const steps = stage.steps.filter((step) => !step.coming);
            return (
              <li key={stage.id} className="rounded-lg border p-3">
                <p className="font-medium text-sm">
                  <span className="tabular-nums text-muted-foreground mr-1.5">{i + 1}</span>
                  {tg(`stages.${stage.id}`)}
                </p>
                {steps.length === 0 ? (
                  <p className="text-xs text-muted-foreground mt-1">{tg("stageState.coming")}</p>
                ) : (
                  <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    {steps.map((step) => (
                      <li key={step.id}>
                        {tg(`steps.${step.id}.label`)}
                        {step.optional && ` (${tg("stepStatus.optional")})`}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
        <ul className="list-disc ml-5 space-y-1.5 text-sm text-muted-foreground">
          <li>{t("navigation.states")}</li>
          <li>{t("navigation.documentLines")}</li>
          <li>{t("navigation.optional")}</li>
          <li>{t("navigation.notYet")}</li>
        </ul>
        <InfoCallout type="info" title={t("navigation.lockTitle")}>
          <span className="inline-flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {t("navigation.lockBody")}
          </span>
        </InfoCallout>
        <div className="space-y-2">
          <p className="font-medium text-sm">{t("navigation.libraryTitle")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {libraryItems.map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-lg border p-3">
                <div className="rounded-md bg-primary/10 p-2">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">{tg(`library.${item}`)}</p>
                  <p className="text-xs text-muted-foreground">{t(`navigation.library.${item}`)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{t("navigation.phone")}</p>
      </DocSection>

      <DocSection id="roles" title={t("roles.title")} description={t("roles.description")}>
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left font-medium px-4 py-2">{t("roles.columnRole")}</th>
                <th className="text-left font-medium px-4 py-2">{t("roles.columnPermissions")}</th>
              </tr>
            </thead>
            <tbody>
              {roleRows.map((role, i) => (
                <tr key={role} className={i % 2 ? "bg-muted/20" : ""}>
                  <td className="px-4 py-2">
                    <Badge variant="outline" className="font-mono text-xs">{role}</Badge>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{t(`roles.rows.${role}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <InfoCallout type="info" title={t("roles.inheritanceTitle")}>
          {t("roles.inheritanceBody")}
        </InfoCallout>
      </DocSection>

      <DocNavFooter
        next={{ title: t("nav.next"), href: "/privacy/docs/quickstart" }}
      />
    </div>
  );
}
