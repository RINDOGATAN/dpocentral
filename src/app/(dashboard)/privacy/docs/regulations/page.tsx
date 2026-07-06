import { Scale, Shield, Bot, Globe, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DocSection } from "@/components/docs/doc-section";
import { StepList } from "@/components/docs/step-list";
import { FeatureMockup } from "@/components/docs/feature-mockup";
import { InfoCallout } from "@/components/docs/info-callout";
import { DocNavFooter } from "@/components/docs/doc-nav-footer";

const jurisdictions = [
  { name: "GDPR", region: "European Union", regionColor: "bg-blue-100 text-blue-800 border-transparent", dsar: "30 days", breach: "72 hours" },
  { name: "CCPA/CPRA", region: "California", regionColor: "bg-yellow-100 text-yellow-800 border-transparent", dsar: "45 days", breach: "Expedient" },
  { name: "LGPD", region: "Brazil", regionColor: "bg-green-100 text-green-800 border-transparent", dsar: "15 days", breach: "3 business days" },
  { name: "PIPL", region: "China", regionColor: "bg-red-100 text-red-800 border-transparent", dsar: "Timely (no fixed deadline)", breach: "Immediately" },
  { name: "POPIA", region: "South Africa", regionColor: "bg-purple-100 text-purple-800 border-transparent", dsar: "30 days", breach: "As soon as possible" },
  { name: "EU AI Act", region: "European Union", regionColor: "bg-blue-100 text-blue-800 border-transparent", dsar: "N/A", breach: "Serious incidents: 15 days (Art. 73)" },
];

export default async function DocsRegulationsPage() {
  const t = await getTranslations("docs.regulations");

  const stepKeys = ["location", "identify", "review", "configure"] as const;
  const categoryKeys = ["comprehensive", "sectoral", "ai", "emerging"] as const;
  const categoryIcons: Record<typeof categoryKeys[number], typeof Scale> = {
    comprehensive: Scale,
    sectoral: Shield,
    ai: Bot,
    emerging: Globe,
  };
  const impactStats: { key: string; icon: typeof Clock }[] = [
    { key: "dsar", icon: Clock },
    { key: "breach", icon: AlertTriangle },
    { key: "monitoring", icon: CheckCircle2 },
  ];

  const managementRows: { name: string; statusKey: "Applied" | "NotApplied"; primary: boolean }[] = [
    { name: "GDPR", statusKey: "Applied", primary: true },
    { name: "CCPA/CPRA", statusKey: "Applied", primary: false },
    { name: "LGPD", statusKey: "NotApplied", primary: false },
  ];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      <DocSection id="catalog" title={t("catalog.title")} description={t("catalog.description")}>
        <FeatureMockup title={t("catalog.mockupTitle")}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {jurisdictions.map((j) => (
              <div key={j.name} className="flex items-start gap-3 rounded-lg border p-3">
                <div className="rounded-md bg-primary/10 p-2">
                  <Scale className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{j.name}</p>
                    <Badge variant="outline" className={`text-[10px] ${j.regionColor}`}>{j.region}</Badge>
                  </div>
                  <div className="mt-1.5 space-y-0.5">
                    <p className="text-xs text-muted-foreground">
                      {t("catalog.dsarLabel")} <span className="font-medium text-foreground">{j.dsar}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("catalog.breachLabel")} <span className="font-medium text-foreground">{j.breach}</span>
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </FeatureMockup>
      </DocSection>

      <DocSection id="applicability" title={t("applicability.title")} description={t("applicability.description")}>
        <StepList
          steps={stepKeys.map((k) => ({
            title: t(`applicability.steps.${k}.title`),
            description: t(`applicability.steps.${k}.description`),
          }))}
        />
        <InfoCallout type="tip" title={t("applicability.tipTitle")}>
          {t("applicability.tipBody")}
        </InfoCallout>
      </DocSection>

      <DocSection id="categories" title={t("categories.title")}>
        <div className="grid gap-3 sm:grid-cols-2">
          {categoryKeys.map((key) => {
            const Icon = categoryIcons[key];
            return (
              <div key={key} className="flex items-start gap-3 rounded-lg border p-3">
                <div className="rounded-md bg-primary/10 p-2">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">{t(`categories.items.${key}.title`)}</p>
                  <p className="text-xs text-muted-foreground">{t(`categories.items.${key}.desc`)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </DocSection>

      <DocSection id="managing" title={t("managing.title")}>
        <p className="text-sm text-muted-foreground">{t("managing.intro")}</p>
        <FeatureMockup title={t("managing.mockupTitle")}>
          <div className="space-y-2">
            {managementRows.map((j) => (
              <div key={j.name} className="flex items-center justify-between rounded-md border px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Scale className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{j.name}</span>
                  {j.primary && (
                    <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-transparent">
                      {t("managing.primaryBadge")}
                    </Badge>
                  )}
                </div>
                <Badge
                  variant="outline"
                  className={`text-[10px] ${
                    j.statusKey === "Applied"
                      ? "bg-green-100 text-green-800 border-transparent"
                      : "bg-gray-100 text-gray-800 border-transparent"
                  }`}
                >
                  {t(`managing.statuses.${j.statusKey}`)}
                </Badge>
              </div>
            ))}
          </div>
        </FeatureMockup>
        <InfoCallout type="info" title={t("managing.infoTitle")}>
          {t("managing.infoBody")}
        </InfoCallout>
      </DocSection>

      <DocSection id="impact" title={t("impact.title")} description={t("impact.description")}>
        <FeatureMockup title={t("impact.mockupTitle")}>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
            {impactStats.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.key} className="hover:translate-y-0">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                    <CardTitle className="text-xs font-medium">{t(`impact.stats.${stat.key}.label`)}</CardTitle>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="text-xl font-bold text-primary">{t(`impact.stats.${stat.key}.value`)}</div>
                    <p className="text-xs text-muted-foreground">{t(`impact.stats.${stat.key}.subtitle`)}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </FeatureMockup>
        <InfoCallout type="note" title={t("impact.noteTitle")}>
          {t("impact.noteBody")}
        </InfoCallout>
      </DocSection>

      <DocNavFooter
        previous={{ title: t("nav.previous"), href: "/privacy/docs/transfer-compliance" }}
        next={{ title: t("nav.next"), href: "/privacy/docs/ai-governance" }}
      />
    </div>
  );
}
