import { Building2, Briefcase } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { DocSection } from "@/components/docs/doc-section";
import { InfoCallout } from "@/components/docs/info-callout";
import { DocNavFooter } from "@/components/docs/doc-nav-footer";

export default async function DocsExpertsPage() {
  const t = await getTranslations("docs.experts");

  const directoryItems = ["search", "specialization", "countryLang", "certifications", "contact"] as const;
  const clientItems = ["dsars", "assessments", "incidents", "vendors", "lastActivity", "attention"] as const;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      <DocSection
        id="personas"
        title={t("personas.title")}
        description={t("personas.description")}
      >
        <div className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-start gap-3">
            <Building2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">{t("personas.businessOwner.label")}</p>
              <p>{t("personas.businessOwner.desc")}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Briefcase className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">{t("personas.privacyProfessional.label")}</p>
              <p>{t("personas.privacyProfessional.desc")}</p>
            </div>
          </div>
        </div>
        <InfoCallout type="tip">
          {t("personas.tipPrefix")}
          <strong>{t("personas.tipSettings")}</strong>
          {t("personas.tipSuffix")}
        </InfoCallout>
      </DocSection>

      <DocSection
        id="expert-directory"
        title={t("directory.title")}
        description={t("directory.description")}
      >
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>{t("directory.intro")}</p>
          <ul className="list-disc ml-5 space-y-1">
            {directoryItems.map((item) => (
              <li key={item}>{t(`directory.items.${item}`)}</li>
            ))}
          </ul>
        </div>
      </DocSection>

      <DocSection
        id="client-dashboard"
        title={t("clientDashboard.title")}
        description={t("clientDashboard.description")}
      >
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>{t("clientDashboard.intro")}</p>
          <ul className="list-disc ml-5 space-y-1">
            {clientItems.map((item) => (
              <li key={item}>{t(`clientDashboard.items.${item}`)}</li>
            ))}
          </ul>
          <p>{t("clientDashboard.outro")}</p>
        </div>
      </DocSection>

      <DocSection
        id="settings"
        title={t("settings.title")}
        description={t("settings.description")}
      >
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            {t("settings.bodyPrefix")}
            <strong>{t("settings.bodyPath")}</strong>
            {t("settings.bodySuffix")}
          </p>
        </div>
      </DocSection>

      <DocNavFooter
        previous={{ href: "/privacy/docs/vendors", title: t("nav.previous") }}
        next={{ href: "/privacy/docs/reports", title: t("nav.next") }}
      />
    </div>
  );
}
