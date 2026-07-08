// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { AlertTriangle, Clock, Bell, CheckSquare } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DocSection } from "@/components/docs/doc-section";
import { StepList } from "@/components/docs/step-list";
import { FeatureMockup } from "@/components/docs/feature-mockup";
import { InfoCallout } from "@/components/docs/info-callout";
import { DocNavFooter } from "@/components/docs/doc-nav-footer";

const severityColors: Record<string, string> = {
  LOW: "bg-green-100 text-green-800 border-transparent",
  MEDIUM: "bg-yellow-100 text-yellow-800 border-transparent",
  HIGH: "bg-orange-100 text-orange-800 border-transparent",
  CRITICAL: "bg-red-100 text-red-800 border-transparent",
};

const statusColors: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-800 border-transparent",
  INVESTIGATING: "bg-yellow-100 text-yellow-800 border-transparent",
  CONTAINED: "bg-orange-100 text-orange-800 border-transparent",
  RESOLVED: "bg-green-100 text-green-800 border-transparent",
  CLOSED: "bg-gray-100 text-gray-800 border-transparent",
};

export default async function DocsIncidentsPage() {
  const t = await getTranslations("docs.incidents");

  const statCards: { key: string; value: string; icon: typeof AlertTriangle }[] = [
    { key: "total", value: "7", icon: AlertTriangle },
    { key: "open", value: "2", icon: Clock },
    { key: "critical", value: "1", icon: AlertTriangle },
    { key: "pendingDpa", value: "1", icon: Bell },
  ];

  const incidentCards: { key: string; severity: string; status: string; date: string }[] = [
    { key: "email", severity: "HIGH", status: "INVESTIGATING", date: "2025-01-15" },
    { key: "export", severity: "MEDIUM", status: "CONTAINED", date: "2025-01-10" },
    { key: "api", severity: "CRITICAL", status: "OPEN", date: "2025-01-18" },
    { key: "usb", severity: "LOW", status: "RESOLVED", date: "2024-12-20" },
  ];

  const stepKeys = ["report", "assess", "assign", "investigate", "notify", "resolve"] as const;

  const timelineEntries: { time: string; key: string; user: string }[] = [
    { time: "Jan 18, 09:30", key: "reported", user: "admin@acme.com" },
    { time: "Jan 18, 09:45", key: "severity", user: "admin@acme.com" },
    { time: "Jan 18, 10:00", key: "investigation", user: "dpo@acme.com" },
    { time: "Jan 18, 11:30", key: "rootCause", user: "dpo@acme.com" },
    { time: "Jan 18, 14:00", key: "notification", user: "admin@acme.com" },
  ];

  const tasks: { key: string; assigneeKey: string; done: boolean }[] = [
    { key: "identify", assigneeKey: "dpo", done: true },
    { key: "contain", assigneeKey: "itSecurity", done: true },
    { key: "prepare", assigneeKey: "dpo", done: false },
    { key: "notifyIndividuals", assigneeKey: "communications", done: false },
    { key: "document", assigneeKey: "dpo", done: false },
  ];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      <DocSection id="reporting" title={t("reporting.title")} description={t("reporting.description")}>
        <FeatureMockup title={t("reporting.statsMockupTitle")}>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.key} className="hover:translate-y-0">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                    <CardTitle className="text-xs font-medium">{t(`reporting.stats.${stat.key}`)}</CardTitle>
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

        <FeatureMockup title={t("reporting.cardsMockupTitle")}>
          <div className="space-y-2">
            {incidentCards.map((incident) => (
              <div key={incident.key} className="flex items-center justify-between rounded-md border px-3 py-2.5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{t(`reporting.cards.${incident.key}`)}</span>
                    <Badge variant="outline" className={`text-[10px] ${severityColors[incident.severity]}`}>
                      {incident.severity}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("reporting.reportedLabel", { date: incident.date })}
                  </p>
                </div>
                <Badge variant="outline" className={`text-[10px] ${statusColors[incident.status]}`}>
                  {incident.status}
                </Badge>
              </div>
            ))}
          </div>
        </FeatureMockup>

        <StepList
          steps={stepKeys.map((k) => ({
            title: t(`reporting.steps.${k}.title`),
            description: t(`reporting.steps.${k}.description`),
          }))}
        />
      </DocSection>

      <DocSection id="timeline" title={t("timeline.title")} description={t("timeline.description")}>
        <FeatureMockup title={t("timeline.mockupTitle")}>
          <div className="space-y-3 border-l-2 border-primary/30 ml-4 pl-4">
            {timelineEntries.map((entry, i) => (
              <div key={i} className="relative">
                <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background" />
                <p className="text-xs text-muted-foreground">{entry.time} — {entry.user}</p>
                <p className="text-sm">{t(`timeline.entries.${entry.key}`)}</p>
              </div>
            ))}
          </div>
        </FeatureMockup>
      </DocSection>

      <DocSection id="notifications" title={t("notifications.title")} description={t("notifications.description")}>
        <InfoCallout type="warning" title={t("notifications.warningTitle")}>
          {t("notifications.warningBody")}
        </InfoCallout>
        <InfoCallout type="tip" title={t("notifications.tipTitle")}>
          {t("notifications.tipBody")}
        </InfoCallout>
      </DocSection>

      <DocSection id="tasks" title={t("tasks.title")} description={t("tasks.description")}>
        <FeatureMockup title={t("tasks.mockupTitle")}>
          <div className="space-y-2">
            {tasks.map((item, i) => (
              <div key={i} className="flex items-center justify-between rounded-md border px-3 py-2">
                <div className="flex items-center gap-2">
                  <CheckSquare className={`h-4 w-4 ${item.done ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={`text-sm ${item.done ? "line-through text-muted-foreground" : ""}`}>
                    {t(`tasks.items.${item.key}`)}
                  </span>
                </div>
                <Badge variant="secondary" className="text-[10px]">{t(`tasks.assignees.${item.assigneeKey}`)}</Badge>
              </div>
            ))}
          </div>
        </FeatureMockup>
      </DocSection>

      <DocNavFooter
        previous={{ title: t("nav.previous"), href: "/privacy/docs/assessments" }}
        next={{ title: t("nav.next"), href: "/privacy/docs/vendors" }}
      />
    </div>
  );
}
