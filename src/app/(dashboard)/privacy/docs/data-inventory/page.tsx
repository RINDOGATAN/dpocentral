import { Database, Globe, ArrowRightLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DocSection } from "@/components/docs/doc-section";
import { StepList } from "@/components/docs/step-list";
import { FeatureMockup } from "@/components/docs/feature-mockup";
import { InfoCallout } from "@/components/docs/info-callout";
import { DocNavFooter } from "@/components/docs/doc-nav-footer";

export default async function DocsDataInventoryPage() {
  const t = await getTranslations("docs.dataInventory");

  const assets = [
    { name: "Customer CRM", type: "DATABASE", elements: 12, activities: 3 },
    { name: "HR Portal", type: "APPLICATION", elements: 8, activities: 2 },
    { name: "Marketing Cloud", type: "CLOUD_SERVICE", elements: 15, activities: 4 },
    { name: "Backup Server", type: "PHYSICAL_STORAGE", elements: 6, activities: 1 },
  ];

  const stepKeys = ["navigate", "add", "details", "link", "save"] as const;

  const elements: { key: string; sensitivity: string; color: string }[] = [
    { key: "company", sensitivity: "PUBLIC", color: "bg-green-100 text-green-800" },
    { key: "email", sensitivity: "INTERNAL", color: "bg-blue-100 text-blue-800" },
    { key: "address", sensitivity: "CONFIDENTIAL", color: "bg-yellow-100 text-yellow-800" },
    { key: "nationalId", sensitivity: "RESTRICTED", color: "bg-orange-100 text-orange-800" },
    { key: "health", sensitivity: "SPECIAL_CATEGORY", color: "bg-red-100 text-red-800" },
  ];

  const transfers: { from: string; to: string; mechanism: string; statusKey: "Active" | "UnderReview"; badgeVariant: "success" | "warning" }[] = [
    { from: "EU (Ireland)", to: "US (Virginia)", mechanism: "SCCs", statusKey: "Active", badgeVariant: "success" },
    { from: "EU (Germany)", to: "UK", mechanism: "Adequacy Decision", statusKey: "Active", badgeVariant: "success" },
    { from: "EU (France)", to: "India", mechanism: "BCRs", statusKey: "UnderReview", badgeVariant: "warning" },
  ];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      <DocSection id="assets" title={t("assets.title")} description={t("assets.description")}>
        <FeatureMockup title={t("assets.mockupTitle")}>
          <div className="grid gap-3 sm:grid-cols-2">
            {assets.map((asset) => (
              <Card key={asset.name} className="hover:translate-y-0">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">{asset.name}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{asset.type.replace("_", " ")}</Badge>
                  </div>
                  <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                    <span>{t("assets.elementsLabel", { count: asset.elements })}</span>
                    <span>{t("assets.activitiesLabel", { count: asset.activities })}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </FeatureMockup>

        <StepList
          steps={stepKeys.map((k) => ({
            title: t(`assets.steps.${k}.title`),
            description: t(`assets.steps.${k}.description`),
          }))}
        />
      </DocSection>

      <DocSection id="data-elements" title={t("elements.title")} description={t("elements.description")}>
        <FeatureMockup title={t("elements.mockupTitle")}>
          <div className="space-y-2">
            {elements.map((el) => (
              <div key={el.key} className="flex items-center justify-between rounded-md border px-3 py-2">
                <span className="text-sm">{t(`elements.items.${el.key}`)}</span>
                <Badge variant="outline" className={`text-[10px] ${el.color} border-transparent`}>
                  {el.sensitivity.replace("_", " ")}
                </Badge>
              </div>
            ))}
          </div>
        </FeatureMockup>
        <InfoCallout type="info" title={t("elements.calloutTitle")}>
          {t("elements.calloutBody")}
        </InfoCallout>
      </DocSection>

      <DocSection id="processing-activities" title={t("activities.title")} description={t("activities.description")}>
        <FeatureMockup title={t("activities.mockupTitle")}>
          <Card className="hover:translate-y-0">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{t("activities.sampleTitle")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("activities.sampleDesc")}</p>
                </div>
                <Badge variant="outline" className="text-[10px]">LEGITIMATE_INTEREST</Badge>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(["email", "name", "history"] as const).map((el) => (
                  <Badge key={el} variant="secondary" className="text-[10px]">{t(`activities.sampleElements.${el}`)}</Badge>
                ))}
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>{t("activities.assetsLabel")}</span>
                <span>{t("activities.elementsLabel")}</span>
                <span>{t("activities.retentionLabel")}</span>
              </div>
            </CardContent>
          </Card>
        </FeatureMockup>
        <InfoCallout type="note" title={t("activities.calloutTitle")}>
          {t("activities.calloutBody")}
        </InfoCallout>
      </DocSection>

      <DocSection id="data-flows" title={t("flows.title")} description={t("flows.description")}>
        <FeatureMockup title={t("flows.mockupTitle")}>
          <div className="flex items-center justify-center gap-4 py-4">
            <div className="text-center">
              <div className="rounded-lg border-2 border-primary/50 bg-primary/5 p-3 mb-1">
                <Database className="h-5 w-5 text-primary mx-auto" />
              </div>
              <p className="text-xs font-medium">{t("flows.nodes.crm")}</p>
            </div>
            <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
            <div className="text-center">
              <div className="rounded-lg border-2 border-primary/50 bg-primary/5 p-3 mb-1">
                <Database className="h-5 w-5 text-primary mx-auto" />
              </div>
              <p className="text-xs font-medium">{t("flows.nodes.marketing")}</p>
            </div>
            <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
            <div className="text-center">
              <div className="rounded-lg border-2 border-blue-500/50 bg-blue-500/5 p-3 mb-1">
                <Globe className="h-5 w-5 text-blue-500 mx-auto" />
              </div>
              <p className="text-xs font-medium">{t("flows.nodes.analytics")}</p>
            </div>
          </div>
        </FeatureMockup>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            <strong>{t("flows.body1Bold")}</strong>
            {t("flows.body1Rest")}
            <em>{t("flows.body1ManageAssets")}</em>
            {t("flows.body1Mid")}
            <em>{t("flows.body1ManageActivities")}</em>
            {t("flows.body1End")}
          </p>
          <p>
            {t("flows.body2Start")}
            <strong>{t("flows.body2GenerateFlows")}</strong>
            {t("flows.body2End")}
          </p>
        </div>
        <InfoCallout type="tip" title={t("flows.tipTitle")}>
          {t("flows.tipBody")}
        </InfoCallout>
      </DocSection>

      <DocSection id="transfers" title={t("transfers.title")} description={t("transfers.description")}>
        <FeatureMockup title={t("transfers.mockupTitle")}>
          <div className="space-y-2">
            {transfers.map((tr) => (
              <div key={`${tr.from}-${tr.to}`} className="flex items-center justify-between rounded-md border px-3 py-2">
                <div className="flex items-center gap-2 text-sm">
                  <span>{tr.from}</span>
                  <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
                  <span>{tr.to}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">{tr.mechanism}</Badge>
                  <Badge variant={tr.badgeVariant} className="text-[10px]">
                    {t(`transfers.statuses.${tr.statusKey}`)}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </FeatureMockup>
        <InfoCallout type="warning" title={t("transfers.warningTitle")}>
          {t("transfers.warningBody")}
        </InfoCallout>
        <InfoCallout type="tip" title={t("transfers.tipTitle")}>
          {t("transfers.tipBody")}
        </InfoCallout>
      </DocSection>

      <DocNavFooter
        previous={{ title: t("nav.previous"), href: "/privacy/docs/quickstart" }}
        next={{ title: t("nav.next"), href: "/privacy/docs/dsar" }}
      />
    </div>
  );
}
