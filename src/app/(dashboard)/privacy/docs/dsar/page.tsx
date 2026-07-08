// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { Settings, CheckCircle2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DocSection } from "@/components/docs/doc-section";
import { StepList } from "@/components/docs/step-list";
import { FeatureMockup } from "@/components/docs/feature-mockup";
import { InfoCallout } from "@/components/docs/info-callout";
import { DocNavFooter } from "@/components/docs/doc-nav-footer";

const statusColors: Record<string, string> = {
  SUBMITTED: "bg-blue-100 text-blue-800 border-transparent",
  IDENTITY_PENDING: "bg-yellow-100 text-yellow-800 border-transparent",
  IN_PROGRESS: "bg-primary/20 text-primary border-transparent",
  COMPLETED: "bg-green-100 text-green-800 border-transparent",
};

export default async function DocsDsarPage() {
  const t = await getTranslations("docs.dsar");

  const requests = [
    { id: "DSAR-2025-0042", type: "ACCESS", status: "IN_PROGRESS", subject: "john.doe@example.com", daysLeft: 12 },
    { id: "DSAR-2025-0041", type: "ERASURE", status: "IDENTITY_PENDING", subject: "jane.smith@example.com", daysLeft: 25 },
    { id: "DSAR-2025-0040", type: "PORTABILITY", status: "SUBMITTED", subject: "bob.wilson@example.com", daysLeft: 28 },
    { id: "DSAR-2025-0039", type: "RECTIFICATION", status: "COMPLETED", subject: "alice.jones@example.com", daysLeft: 0 },
  ];

  const requestTypes = ["ACCESS", "ERASURE", "RECTIFICATION", "PORTABILITY", "OBJECTION", "RESTRICTION"];

  const stepKeys = ["verify", "scope", "assign", "collect", "review", "close"] as const;

  const slas = [
    { id: "DSAR-2025-0042", days: 18, total: 30 },
    { id: "DSAR-2025-0041", days: 24, total: 30 },
    { id: "DSAR-2025-0038", days: 30, total: 30 },
  ];

  const intakeItems = ["autoAck", "identity", "types", "custom"] as const;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      <DocSection id="creating" title={t("creating.title")} description={t("creating.description")}>
        <FeatureMockup title={t("creating.mockupTitle")}>
          <div className="space-y-2">
            {requests.map((req) => (
              <div key={req.id} className="flex items-center justify-between rounded-md border px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{req.id}</span>
                      <Badge variant="outline" className="text-[10px]">{req.type}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{req.subject}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {req.status !== "COMPLETED" && (
                    <span className="text-xs text-muted-foreground">{req.daysLeft}{t("creating.daysLeftSuffix")}</span>
                  )}
                  <Badge variant="outline" className={`text-[10px] ${statusColors[req.status]}`}>
                    {req.status.replace("_", " ")}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </FeatureMockup>

        <div className="space-y-2">
          <p className="text-sm font-medium">{t("creating.typesLabel")}</p>
          <div className="flex flex-wrap gap-2">
            {requestTypes.map((type) => (
              <Badge key={type} variant="outline" className="text-xs">{type}</Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{t("creating.typesCaption")}</p>
        </div>
      </DocSection>

      <DocSection id="tasks" title={t("tasks.title")} description={t("tasks.description")}>
        <StepList
          steps={stepKeys.map((k) => ({
            title: t(`tasks.steps.${k}.title`),
            description: t(`tasks.steps.${k}.description`),
          }))}
        />
      </DocSection>

      <DocSection id="sla" title={t("sla.title")} description={t("sla.description")}>
        <FeatureMockup title={t("sla.mockupTitle")}>
          <div className="space-y-4">
            {slas.map((sla) => {
              const overdue = sla.days >= sla.total;
              return (
                <div key={sla.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{sla.id}</span>
                    <span className={`text-xs ${overdue ? "text-destructive font-medium" : sla.days > 20 ? "text-yellow-600" : "text-muted-foreground"}`}>
                      {overdue ? t("sla.overdueLabel") : t("sla.daysRemaining", { count: sla.total - sla.days })}
                    </span>
                  </div>
                  <Progress value={(sla.days / sla.total) * 100} className="h-2" />
                </div>
              );
            })}
          </div>
        </FeatureMockup>
        <InfoCallout type="warning" title={t("sla.warningTitle")}>
          {t("sla.warningBody")}
        </InfoCallout>
      </DocSection>

      <DocSection id="portal" title={t("portal.title")} description={t("portal.description")}>
        <FeatureMockup title={t("portal.mockupTitle")}>
          <Card className="hover:translate-y-0 max-w-md mx-auto">
            <CardHeader className="p-4">
              <CardTitle className="text-base">{t("portal.cardTitle")}</CardTitle>
              <CardDescription className="text-xs">{t("portal.cardSubtitle")}</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">john.doe@example.com</div>
              <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">{t("portal.sampleType")}</div>
              <div className="rounded-md border px-3 py-2 h-16 text-sm text-muted-foreground">{t("portal.samplePlaceholder")}</div>
              <Button className="w-full" size="sm">{t("portal.submitButton")}</Button>
            </CardContent>
          </Card>
        </FeatureMockup>
        <InfoCallout type="tip" title={t("portal.tipTitle")}>
          {t("portal.tipPrefix")}
          <code className="text-xs bg-muted px-1 rounded">/dsar/your-org-slug</code>
          {t("portal.tipSuffix")}
        </InfoCallout>
      </DocSection>

      <DocSection id="intake-config" title={t("intakeConfig.title")} description={t("intakeConfig.description")}>
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-md border px-3 py-2">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{t("intakeConfig.settingsLabel")}</p>
              <p className="text-xs text-muted-foreground">{t("intakeConfig.settingsDesc")}</p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 text-sm">
            {intakeItems.map((key) => (
              <div key={key} className="flex items-start gap-2 rounded-md border p-2.5">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-xs">{t(`intakeConfig.items.${key}.label`)}</p>
                  <p className="text-xs text-muted-foreground">{t(`intakeConfig.items.${key}.desc`)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DocSection>

      <DocNavFooter
        previous={{ title: t("nav.previous"), href: "/privacy/docs/data-inventory" }}
        next={{ title: t("nav.next"), href: "/privacy/docs/assessments" }}
      />
    </div>
  );
}
