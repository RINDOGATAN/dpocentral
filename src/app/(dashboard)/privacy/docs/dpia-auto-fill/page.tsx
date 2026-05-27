import { Sparkles, Bot, CheckCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { DocSection } from "@/components/docs/doc-section";
import { StepList } from "@/components/docs/step-list";
import { FeatureMockup } from "@/components/docs/feature-mockup";
import { InfoCallout } from "@/components/docs/info-callout";
import { DocNavFooter } from "@/components/docs/doc-nav-footer";

const confidenceColors: Record<string, string> = {
  HIGH: "bg-green-100 text-green-800 border-transparent",
  MEDIUM: "bg-yellow-100 text-yellow-800 border-transparent",
  LOW: "bg-orange-100 text-orange-800 border-transparent",
};

const autoFillRows: { key: string; confidence: string }[] = [
  { key: "processing", confidence: "HIGH" },
  { key: "basis", confidence: "HIGH" },
  { key: "categories", confidence: "HIGH" },
  { key: "special", confidence: "HIGH" },
  { key: "subjects", confidence: "HIGH" },
  { key: "retention", confidence: "HIGH" },
  { key: "security", confidence: "MEDIUM" },
  { key: "transfers", confidence: "MEDIUM" },
  { key: "risk", confidence: "MEDIUM" },
];

const confidenceLevels: { level: "HIGH" | "MEDIUM" | "LOW"; color: string }[] = [
  { level: "HIGH", color: confidenceColors.HIGH },
  { level: "MEDIUM", color: confidenceColors.MEDIUM },
  { level: "LOW", color: confidenceColors.LOW },
];

export default async function DocsDpiaAutoFillPage() {
  const t = await getTranslations("docs.dpiaAutoFill");

  const overviewItems: { key: string; icon: typeof Sparkles }[] = [
    { key: "rule", icon: Sparkles },
    { key: "ai", icon: Bot },
  ];

  const stepKeys = ["select", "preview", "review", "create"] as const;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      <DocSection id="overview" title={t("overview.title")} description={t("overview.description")}>
        <div className="grid gap-3 sm:grid-cols-2">
          {overviewItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.key} className="flex items-start gap-3 rounded-lg border p-3">
                <div className="rounded-md bg-primary/10 p-2">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">{t(`overview.items.${item.key}.label`)}</p>
                  <p className="text-xs text-muted-foreground">{t(`overview.items.${item.key}.desc`)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </DocSection>

      <DocSection id="wizard-steps" title={t("steps.title")}>
        <StepList
          steps={stepKeys.map((k) => ({
            title: t(`steps.items.${k}.title`),
            description: t(`steps.items.${k}.description`),
          }))}
        />
      </DocSection>

      <DocSection id="auto-fill-sources" title={t("sources.title")} description={t("sources.description")}>
        <FeatureMockup title={t("sources.mockupTitle")}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground">{t("sources.columnSection")}</th>
                  <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground">{t("sources.columnQuestion")}</th>
                  <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground">{t("sources.columnSource")}</th>
                  <th className="pb-2 text-xs font-medium text-muted-foreground">{t("sources.columnConfidence")}</th>
                </tr>
              </thead>
              <tbody>
                {autoFillRows.map((row) => (
                  <tr key={row.key} className="border-b last:border-0">
                    <td className="py-2 pr-4 text-xs font-medium">{t(`sources.rows.${row.key}.section`)}</td>
                    <td className="py-2 pr-4 text-xs text-muted-foreground">{t(`sources.rows.${row.key}.question`)}</td>
                    <td className="py-2 pr-4 text-xs text-muted-foreground">{t(`sources.rows.${row.key}.source`)}</td>
                    <td className="py-2">
                      <Badge variant="outline" className={`text-[10px] ${confidenceColors[row.confidence]}`}>
                        {row.confidence}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FeatureMockup>
      </DocSection>

      <DocSection id="confidence-levels" title={t("confidence.title")} description={t("confidence.description")}>
        <div className="space-y-3">
          {confidenceLevels.map((item) => (
            <div key={item.level} className="flex items-start gap-3">
              <Badge variant="outline" className={`text-[10px] mt-0.5 shrink-0 ${item.color}`}>
                {item.level}
              </Badge>
              <p className="text-sm text-muted-foreground">{t(`confidence.items.${item.level}`)}</p>
            </div>
          ))}
        </div>
        <InfoCallout type="tip" title={t("confidence.tipTitle")}>
          {t("confidence.tipBody")}
        </InfoCallout>
      </DocSection>

      <DocSection id="ai-integration" title={t("ai.title")} description={t("ai.description")}>
        <div className="space-y-2">
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <div className="rounded-md bg-primary/10 p-2">
              <CheckCircle className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">{t("ai.providersTitle")}</p>
              <p className="text-xs text-muted-foreground">
                {t("ai.providersPrefix")}
                <code className="rounded bg-muted px-1 py-0.5 text-[11px]">OPENAI_API_KEY</code>
                {t("ai.providersOr")}
                <code className="rounded bg-muted px-1 py-0.5 text-[11px]">ANTHROPIC_API_KEY</code>
                {t("ai.providersSuffix")}
              </p>
            </div>
          </div>
        </div>
        <InfoCallout type="info" title={t("ai.fallbackTitle")}>
          {t("ai.fallbackBody")}
        </InfoCallout>
        <InfoCallout type="note" title={t("ai.privacyTitle")}>
          {t("ai.privacyBody")}
        </InfoCallout>
      </DocSection>

      <DocNavFooter
        previous={{ title: t("nav.previous"), href: "/privacy/docs/reports" }}
        next={{ title: t("nav.next"), href: "/privacy/docs/transfer-compliance" }}
      />
    </div>
  );
}
