import { Bot, AlertTriangle, CheckCircle2, Clock, ShieldCheck, Eye, BookOpen, Users, Database, Building2, ClipboardCheck, Shield, ArrowRightLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DocSection } from "@/components/docs/doc-section";
import { StepList } from "@/components/docs/step-list";
import { FeatureMockup } from "@/components/docs/feature-mockup";
import { InfoCallout } from "@/components/docs/info-callout";
import { DocNavFooter } from "@/components/docs/doc-nav-footer";

const riskColors: Record<string, string> = {
  UNACCEPTABLE: "bg-red-100 text-red-800 border-transparent",
  HIGH: "bg-orange-100 text-orange-800 border-transparent",
  LIMITED: "bg-yellow-100 text-yellow-800 border-transparent",
  MINIMAL: "bg-green-100 text-green-800 border-transparent",
};

const riskLevels = ["UNACCEPTABLE", "HIGH", "LIMITED", "MINIMAL"] as const;

export default async function DocsAiGovernancePage() {
  const t = await getTranslations("docs.aiGovernance");

  const statCards: { key: string; value: string; icon: typeof Bot; color: string }[] = [
    { key: "total", value: "12", icon: Bot, color: "" },
    { key: "highRisk", value: "3", icon: AlertTriangle, color: "text-orange-600" },
    { key: "compliant", value: "9", icon: CheckCircle2, color: "text-green-600" },
    { key: "review", value: "2", icon: Clock, color: "text-yellow-600" },
  ];

  const stepKeys = ["details", "classify", "document", "review"] as const;

  const suggestionExamples: { key: string; suggested: string }[] = [
    { key: "recruitment", suggested: "HIGH" },
    { key: "chatbot", suggested: "LIMITED" },
    { key: "spam", suggested: "MINIMAL" },
  ];

  const obligationItems: { key: string; icon: typeof ShieldCheck }[] = [
    { key: "risk", icon: ShieldCheck },
    { key: "data", icon: Database },
    { key: "doc", icon: BookOpen },
    { key: "records", icon: ClipboardCheck },
    { key: "human", icon: Users },
    { key: "accuracy", icon: Eye },
  ];

  const linkItems: { key: string; icon: typeof Building2 }[] = [
    { key: "vendors", icon: Building2 },
    { key: "assessments", icon: ClipboardCheck },
    { key: "inventory", icon: Database },
  ];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      <DocSection id="overview" title={t("overview.title")} description={t("overview.description")}>
        <FeatureMockup title={t("overview.mockupTitle")}>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.key} className="hover:translate-y-0">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                    <CardTitle className="text-xs font-medium">{t(`overview.stats.${stat.key}`)}</CardTitle>
                    <Icon className={`h-4 w-4 ${stat.color || "text-muted-foreground"}`} />
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="text-xl font-bold text-primary">{stat.value}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </FeatureMockup>
      </DocSection>

      <DocSection id="risk-levels" title={t("riskLevels.title")}>
        <FeatureMockup title={t("riskLevels.badgesMockupTitle")}>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              {riskLevels.map((key) => (
                <div key={key} className="flex items-center gap-2">
                  <Badge variant="outline" className={riskColors[key]}>{t(`riskLevels.labels.${key}`)}</Badge>
                  <span className="text-xs text-muted-foreground">{t(`riskLevels.descriptions.${key}`)}</span>
                </div>
              ))}
            </div>
          </div>
        </FeatureMockup>

        <FeatureMockup title={t("riskLevels.examplesMockupTitle")}>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left font-medium px-4 py-2">{t("riskLevels.columnLevel")}</th>
                  <th className="text-left font-medium px-4 py-2">{t("riskLevels.columnExamples")}</th>
                </tr>
              </thead>
              <tbody>
                {riskLevels.map((key, i) => (
                  <tr key={key} className={i % 2 === 1 ? "bg-muted/20" : ""}>
                    <td className="px-4 py-2">
                      <Badge variant="outline" className={`text-[10px] ${riskColors[key]}`}>
                        {t(`riskLevels.labels.${key}`)}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{t(`riskLevels.examples.${key}`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FeatureMockup>
      </DocSection>

      <DocSection id="registration" title={t("registration.title")} description={t("registration.description")}>
        <StepList
          steps={stepKeys.map((k) => ({
            title: t(`registration.steps.${k}.title`),
            description: t(`registration.steps.${k}.description`),
          }))}
        />
        <InfoCallout type="tip" title={t("registration.tipTitle")}>
          {t("registration.tipBody")}
        </InfoCallout>
      </DocSection>

      <DocSection id="risk-suggestion" title={t("suggestion.title")} description={t("suggestion.description")}>
        <FeatureMockup title={t("suggestion.mockupTitle")}>
          <div className="space-y-2">
            {suggestionExamples.map((system) => (
              <div key={system.key} className="flex items-center justify-between rounded-md border px-3 py-2.5">
                <div>
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{t(`suggestion.examples.${system.key}.name`)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 ml-6">{t(`suggestion.examples.${system.key}.purpose`)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{t("suggestion.suggestedLabel")}</span>
                  <Badge variant="outline" className={`text-[10px] ${riskColors[system.suggested]}`}>
                    {t(`riskLevels.labels.${system.suggested}`)}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </FeatureMockup>
        <InfoCallout type="info" title={t("suggestion.infoTitle")}>
          {t("suggestion.infoBody")}
        </InfoCallout>
      </DocSection>

      <DocSection id="obligations" title={t("obligations.title")} description={t("obligations.description")}>
        <FeatureMockup title={t("obligations.mockupTitle")}>
          <div className="space-y-2">
            {obligationItems.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.key} className="flex items-center gap-3 rounded-md border px-3 py-2.5">
                  <Icon className="h-4 w-4 text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{t(`obligations.items.${item.key}.title`)}</p>
                    <p className="text-xs text-muted-foreground">{t(`obligations.items.${item.key}.description`)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </FeatureMockup>
        <InfoCallout type="note" title={t("obligations.transparencyTitle")}>
          {t("obligations.transparencyBody")}
        </InfoCallout>
        <InfoCallout type="warning" title={t("obligations.deadlineTitle")}>
          {t("obligations.deadlineBody")}
        </InfoCallout>
      </DocSection>

      <DocSection id="linking" title={t("linking.title")} description={t("linking.description")}>
        <div className="grid gap-3 sm:grid-cols-3">
          {linkItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.key} className="flex items-start gap-3 rounded-lg border p-3">
                <div className="rounded-md bg-primary/10 p-2">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">{t(`linking.items.${item.key}.label`)}</p>
                  <p className="text-xs text-muted-foreground">{t(`linking.items.${item.key}.desc`)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </DocSection>

      <DocSection id="ai-sentinel" title={t("sentinel.title")} description={t("sentinel.description")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <div className="rounded-md bg-primary/10 p-2">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">{t("sentinel.importTitle")}</p>
              <p className="text-xs text-muted-foreground">{t("sentinel.importDesc")}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <div className="rounded-md bg-primary/10 p-2">
              <ArrowRightLeft className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">{t("sentinel.exportTitle")}</p>
              <p className="text-xs text-muted-foreground">{t("sentinel.exportDesc")}</p>
            </div>
          </div>
        </div>

        <FeatureMockup title={t("sentinel.mockupTitle")}>
          <div className="flex flex-col sm:flex-row items-center gap-4 text-sm">
            <div className="rounded-lg border p-3 text-center flex-1">
              <Database className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <p className="font-medium">{t("sentinel.stage1.title")}</p>
              <p className="text-xs text-muted-foreground">{t("sentinel.stage1.subtitle")}</p>
            </div>
            <span className="text-muted-foreground hidden sm:block">&rarr;</span>
            <span className="text-muted-foreground sm:hidden">&darr;</span>
            <div className="rounded-lg border border-primary/50 bg-primary/5 p-3 text-center flex-1">
              <Bot className="h-5 w-5 mx-auto text-primary mb-1" />
              <p className="font-medium">{t("sentinel.stage2.title")}</p>
              <p className="text-xs text-muted-foreground">{t("sentinel.stage2.subtitle")}</p>
            </div>
            <span className="text-muted-foreground hidden sm:block">&rarr;</span>
            <span className="text-muted-foreground sm:hidden">&darr;</span>
            <div className="rounded-lg border p-3 text-center flex-1">
              <Shield className="h-5 w-5 mx-auto text-blue-600 mb-1" />
              <p className="font-medium">{t("sentinel.stage3.title")}</p>
              <p className="text-xs text-muted-foreground">{t("sentinel.stage3.subtitle")}</p>
            </div>
          </div>
        </FeatureMockup>

        <InfoCallout type="info" title={t("sentinel.configTitle")}>
          {t("sentinel.configBody")}
        </InfoCallout>
      </DocSection>

      <DocNavFooter
        previous={{ title: t("nav.previous"), href: "/privacy/docs/regulations" }}
        next={{ title: t("nav.next"), href: "/privacy/docs/premium" }}
      />
    </div>
  );
}
