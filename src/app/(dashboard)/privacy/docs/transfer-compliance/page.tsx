import { Globe, FileCheck, Shield, CheckCircle, Lock, FileText, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DocSection } from "@/components/docs/doc-section";
import { StepList } from "@/components/docs/step-list";
import { FeatureMockup } from "@/components/docs/feature-mockup";
import { InfoCallout } from "@/components/docs/info-callout";
import { DocNavFooter } from "@/components/docs/doc-nav-footer";

const complianceStatusColors: Record<string, string> = {
  COMPLIANT: "bg-green-100 text-green-800 border-transparent",
  NEEDS_REVIEW: "bg-yellow-100 text-yellow-800 border-transparent",
  NON_COMPLIANT: "bg-red-100 text-red-800 border-transparent",
  PENDING: "bg-gray-100 text-gray-800 border-transparent",
};

const adequacyCountries: { key: string; year: string }[] = [
  { key: "Andorra", year: "2010" },
  { key: "Argentina", year: "2003" },
  { key: "Canada", year: "2001" },
  { key: "Israel", year: "2011" },
  { key: "Japan", year: "2019" },
  { key: "NewZealand", year: "2012" },
  { key: "SouthKorea", year: "2022" },
  { key: "Switzerland", year: "2000" },
  { key: "UK", year: "2021" },
  { key: "Uruguay", year: "2012" },
  { key: "USA", year: "2023" },
];

const statusKeys = ["COMPLIANT", "NEEDS_REVIEW", "NON_COMPLIANT", "PENDING"] as const;
const stepKeys = ["know", "tool", "assess", "supplementary", "procedural", "monitor"] as const;
const supplementaryKeys = ["technical", "contractual", "organizational"] as const;
const supplementaryIcons: Record<typeof supplementaryKeys[number], typeof Lock> = {
  technical: Lock,
  contractual: FileText,
  organizational: Users,
};

export default async function DocsTransferCompliancePage() {
  const t = await getTranslations("docs.transferCompliance");

  const overviewStats: { key: string; icon: typeof Globe }[] = [
    { key: "adequacy", icon: Globe },
    { key: "scc", icon: FileCheck },
    { key: "tia", icon: Shield },
  ];

  const sccs = [
    { vendor: "CloudHost EU", destination: "US (Virginia)", expires: "2026-06-15", daysLeft: 88, status: "Active" },
    { vendor: "Analytics Corp", destination: "India", expires: "2026-04-20", daysLeft: 32, status: "Expiring Soon" },
    { vendor: "DataSync Ltd", destination: "Brazil", expires: "2026-04-01", daysLeft: 13, status: "Urgent" },
    { vendor: "Legacy Hosting", destination: "Singapore", expires: "2026-02-28", daysLeft: 0, status: "Expired" },
  ];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      <DocSection id="overview" title={t("overview.title")} description={t("overview.description")}>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          {overviewStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.key} className="hover:translate-y-0">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                  <CardTitle className="text-xs font-medium">{t(`overview.stats.${stat.key}.label`)}</CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-xl font-bold text-primary">{t(`overview.stats.${stat.key}.value`)}</div>
                  <p className="text-xs text-muted-foreground">{t(`overview.stats.${stat.key}.subtitle`)}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </DocSection>

      <DocSection id="compliance-status" title={t("complianceStatus.title")} description={t("complianceStatus.description")}>
        <FeatureMockup title={t("complianceStatus.mockupTitle")}>
          <div className="space-y-3">
            {statusKeys.map((key) => (
              <div key={key} className="flex items-start gap-3">
                <Badge variant="outline" className={`text-[10px] mt-0.5 shrink-0 ${complianceStatusColors[key]}`}>
                  {t(`complianceStatus.labels.${key}`)}
                </Badge>
                <p className="text-sm text-muted-foreground">{t(`complianceStatus.descriptions.${key}`)}</p>
              </div>
            ))}
          </div>
        </FeatureMockup>
      </DocSection>

      <DocSection id="schrems-ii" title={t("schremsIi.title")} description={t("schremsIi.description")}>
        <StepList
          steps={stepKeys.map((k) => ({
            title: t(`schremsIi.steps.${k}.title`),
            description: t(`schremsIi.steps.${k}.description`),
          }))}
        />
        <InfoCallout type="warning" title={t("schremsIi.warningTitle")}>
          {t("schremsIi.warningBody")}
        </InfoCallout>
      </DocSection>

      <DocSection id="adequacy" title={t("adequacy.title")} description={t("adequacy.description")}>
        <FeatureMockup title={t("adequacy.mockupTitle")}>
          <div className="space-y-2">
            {adequacyCountries.map((item) => (
              <div key={item.key} className="flex items-center justify-between rounded-md border px-3 py-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">{t(`adequacy.countries.${item.key}`)}</span>
                </div>
                <Badge variant="outline" className="text-[10px] bg-green-100 text-green-800 border-transparent">
                  {t("adequacy.sinceLabel", { year: item.year })}
                </Badge>
              </div>
            ))}
          </div>
        </FeatureMockup>
      </DocSection>

      <DocSection id="supplementary-measures" title={t("supplementaryMeasures.title")} description={t("supplementaryMeasures.description")}>
        <div className="grid gap-3 sm:grid-cols-3">
          {supplementaryKeys.map((key) => {
            const Icon = supplementaryIcons[key];
            return (
              <div key={key} className="flex items-start gap-3 rounded-lg border p-3">
                <div className="rounded-md bg-primary/10 p-2">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">{t(`supplementaryMeasures.items.${key}.title`)}</p>
                  <p className="text-xs text-muted-foreground">{t(`supplementaryMeasures.items.${key}.desc`)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </DocSection>

      <DocSection id="scc-tracking" title={t("sccTracking.title")} description={t("sccTracking.description")}>
        <FeatureMockup title={t("sccTracking.mockupTitle")}>
          <div className="space-y-2">
            {sccs.map((scc) => (
              <div key={scc.vendor} className="flex items-center justify-between rounded-md border px-3 py-2.5">
                <div>
                  <div className="flex items-center gap-2">
                    <FileCheck className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{scc.vendor}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 ml-6">
                    {scc.destination} — {t("sccTracking.expiresLabel", { date: scc.expires })}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={`text-[10px] ${
                    scc.status === "Active"
                      ? "bg-green-100 text-green-800 border-transparent"
                      : scc.status === "Expiring Soon"
                        ? "bg-yellow-100 text-yellow-800 border-transparent"
                        : scc.status === "Urgent"
                          ? "bg-orange-100 text-orange-800 border-transparent"
                          : "bg-red-100 text-red-800 border-transparent"
                  }`}
                >
                  {scc.status === "Expired" ? t("sccTracking.expiredLabel") : t("sccTracking.remaining", { count: scc.daysLeft })}
                </Badge>
              </div>
            ))}
          </div>
        </FeatureMockup>
        <InfoCallout type="tip" title={t("sccTracking.tipTitle")}>
          {t("sccTracking.tipBody")}
        </InfoCallout>
      </DocSection>

      <DocNavFooter
        previous={{ title: t("nav.previous"), href: "/privacy/docs/dpia-auto-fill" }}
        next={{ title: t("nav.next"), href: "/privacy/docs/regulations" }}
      />
    </div>
  );
}
