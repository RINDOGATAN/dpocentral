import {
  Zap,
  Building2,
  Sparkles,
  ShoppingCart,
  Cloud,
  Heart,
  Landmark,
  Newspaper,
  Briefcase,
  Database,
  FileText,
  ArrowRightLeft,
  Shield,
  ArrowRight,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DocSection } from "@/components/docs/doc-section";
import { FeatureMockup } from "@/components/docs/feature-mockup";
import { InfoCallout } from "@/components/docs/info-callout";
import { DocNavFooter } from "@/components/docs/doc-nav-footer";
import Link from "next/link";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  ShoppingCart,
  Cloud,
  Heart,
  Landmark,
  Newspaper,
  Briefcase,
};

// Asset, activity, and flow names are kept in English because they match
// the actual records created by the quickstart wizard.
const TEMPLATES = [
  {
    id: "ecommerce",
    icon: "ShoppingCart",
    assets: [
      { name: "Customer Database", type: "Database", elements: 7 },
      { name: "Order Management System", type: "Application", elements: 4 },
      { name: "Marketing Platform", type: "Cloud Service", elements: 4 },
      { name: "Web Analytics", type: "Cloud Service", elements: 4 },
      { name: "Payment Gateway", type: "Third-Party", elements: 4 },
    ],
    activities: [
      { name: "Customer Account Management", basis: "Contract" },
      { name: "Order Processing & Fulfillment", basis: "Contract" },
      { name: "Marketing & Promotions", basis: "Consent" },
      { name: "Website Analytics & Optimization", basis: "Legitimate Interests" },
    ],
    flows: ["Customer to Orders", "Orders to Payment", "Customer to Marketing"],
  },
  {
    id: "saas",
    icon: "Cloud",
    assets: [
      { name: "User Database", type: "Database", elements: 5 },
      { name: "Application Logs", type: "Cloud Service", elements: 4 },
      { name: "Support Ticketing System", type: "Cloud Service", elements: 3 },
      { name: "Billing System", type: "Cloud Service", elements: 4 },
      { name: "Product Analytics", type: "Cloud Service", elements: 3 },
    ],
    activities: [
      { name: "User Account Provisioning", basis: "Contract" },
      { name: "Service Delivery & Processing", basis: "Contract" },
      { name: "Subscription Billing", basis: "Contract" },
      { name: "Customer Support", basis: "Contract" },
      { name: "Product Analytics & Improvement", basis: "Legitimate Interests" },
    ],
    flows: ["User Actions to Logs", "User to Billing", "User to Analytics"],
  },
  {
    id: "healthcare",
    icon: "Heart",
    assets: [
      { name: "Electronic Health Records (EHR)", type: "Application", elements: 7 },
      { name: "Patient Portal", type: "Application", elements: 4 },
      { name: "Billing & Insurance System", type: "Application", elements: 4 },
      { name: "Staff HR System", type: "Application", elements: 4 },
    ],
    activities: [
      { name: "Patient Care & Treatment", basis: "Vital Interests" },
      { name: "Medical Billing & Insurance", basis: "Legal Obligation" },
      { name: "Staff Employment Management", basis: "Contract" },
    ],
    flows: ["EHR to Patient Portal", "EHR to Billing"],
  },
  {
    id: "fintech",
    icon: "Landmark",
    assets: [
      { name: "KYC/Identity Verification System", type: "Application", elements: 5 },
      { name: "Transaction Ledger", type: "Database", elements: 5 },
      { name: "Customer Account System", type: "Application", elements: 4 },
      { name: "Regulatory Reporting System", type: "Application", elements: 3 },
    ],
    activities: [
      { name: "Customer Onboarding & KYC", basis: "Legal Obligation" },
      { name: "Transaction Processing", basis: "Contract" },
      { name: "AML Monitoring & Regulatory Reporting", basis: "Legal Obligation" },
    ],
    flows: ["KYC to Account", "Transactions to Monitoring"],
  },
  {
    id: "media",
    icon: "Newspaper",
    assets: [
      { name: "Subscriber Database", type: "Database", elements: 5 },
      { name: "Content Management System", type: "Application", elements: 3 },
      { name: "Ad Tech Platform", type: "Cloud Service", elements: 4 },
      { name: "Newsletter Platform", type: "Cloud Service", elements: 3 },
    ],
    activities: [
      { name: "Subscription Management", basis: "Contract" },
      { name: "Programmatic Advertising", basis: "Consent" },
      { name: "Newsletter Distribution", basis: "Consent" },
      { name: "Content Personalization", basis: "Legitimate Interests" },
    ],
    flows: ["Subscribers to Ad Platform", "Subscribers to Newsletter"],
  },
  {
    id: "professional_services",
    icon: "Briefcase",
    assets: [
      { name: "Client Database", type: "Database", elements: 4 },
      { name: "Project Management System", type: "Cloud Service", elements: 4 },
      { name: "HR & Payroll System", type: "Cloud Service", elements: 5 },
      { name: "Document Management", type: "Cloud Service", elements: 3 },
    ],
    activities: [
      { name: "Client Relationship Management", basis: "Contract" },
      { name: "Service Delivery & Project Work", basis: "Contract" },
      { name: "Employee HR & Payroll", basis: "Contract" },
    ],
    flows: ["Client to Projects", "Projects to Documents"],
  },
];

export default async function DocsQuickstartPage() {
  const t = await getTranslations("docs.quickstart");

  const vendorWatchItems = ["asset", "elements", "activity", "transfers"] as const;
  const afterItems = ["review", "legal", "vendors", "assessments"] as const;

  const vendorWatchIcons: Record<typeof vendorWatchItems[number], typeof Database> = {
    asset: Database,
    elements: FileText,
    activity: Shield,
    transfers: ArrowRightLeft,
  };

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      {/* HOW IT WORKS */}
      <DocSection id="how-it-works" title={t("howItWorks.title")} description={t("howItWorks.description")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-lg border p-4">
            <div className="rounded-md bg-primary/10 p-2 shrink-0">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">{t("howItWorks.importVendors.title")}</p>
              <p className="text-xs text-muted-foreground mt-1">{t("howItWorks.importVendors.desc")}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border p-4">
            <div className="rounded-md bg-primary/10 p-2 shrink-0">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">{t("howItWorks.industryTemplate.title")}</p>
              <p className="text-xs text-muted-foreground mt-1">{t("howItWorks.industryTemplate.desc")}</p>
            </div>
          </div>
        </div>
        <InfoCallout type="info" title={t("howItWorks.nonDestructiveTitle")}>
          {t("howItWorks.nonDestructiveBody")}
        </InfoCallout>
      </DocSection>

      {/* VENDOR.WATCH PORTFOLIO */}
      <DocSection id="vendor-watch" title={t("vendorWatch.title")} description={t("vendorWatch.description")}>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("vendorWatch.intro")}</p>
          <FeatureMockup title={t("vendorWatch.mockupTitle")}>
            <div className="grid gap-2 sm:grid-cols-2">
              {vendorWatchItems.map((key) => {
                const Icon = vendorWatchIcons[key];
                return (
                  <div key={key} className="flex items-start gap-2 p-3 rounded-lg border">
                    <Icon className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium">{t(`vendorWatch.items.${key}.label`)}</p>
                      <p className="text-xs text-muted-foreground">{t(`vendorWatch.items.${key}.desc`)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </FeatureMockup>
          <InfoCallout type="tip" title={t("vendorWatch.tipTitle")}>
            {t("vendorWatch.tipBody")}
          </InfoCallout>
        </div>
      </DocSection>

      {/* INDUSTRY TEMPLATES */}
      <DocSection id="industry-templates" title={t("industryTemplates.title")} description={t("industryTemplates.description")}>
        <p className="text-sm text-muted-foreground">{t("industryTemplates.intro")}</p>

        <div className="space-y-6 mt-2">
          {TEMPLATES.map((template) => {
            const Icon = ICON_MAP[template.icon] ?? Sparkles;
            const totalElements = template.assets.reduce((sum, a) => sum + a.elements, 0);
            return (
              <div key={template.id} id={`template-${template.id}`} className="scroll-mt-20">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-md bg-primary/10 p-2">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-base">{t(`industryTemplates.templates.${template.id}.name`)}</CardTitle>
                        <CardDescription className="text-xs">{t(`industryTemplates.templates.${template.id}.description`)}</CardDescription>
                      </div>
                      <div className="hidden sm:flex gap-2">
                        <Badge variant="secondary" className="text-xs">{t("industryTemplates.badges.assets", { count: template.assets.length })}</Badge>
                        <Badge variant="secondary" className="text-xs">{t("industryTemplates.badges.elements", { count: totalElements })}</Badge>
                        <Badge variant="secondary" className="text-xs">{t("industryTemplates.badges.activities", { count: template.activities.length })}</Badge>
                        <Badge variant="secondary" className="text-xs">{t("industryTemplates.badges.flows", { count: template.flows.length })}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Summary badges on mobile */}
                    <div className="flex flex-wrap gap-2 sm:hidden">
                      <Badge variant="secondary" className="text-xs">{t("industryTemplates.badges.assets", { count: template.assets.length })}</Badge>
                      <Badge variant="secondary" className="text-xs">{t("industryTemplates.badges.elements", { count: totalElements })}</Badge>
                      <Badge variant="secondary" className="text-xs">{t("industryTemplates.badges.activities", { count: template.activities.length })}</Badge>
                      <Badge variant="secondary" className="text-xs">{t("industryTemplates.badges.flows", { count: template.flows.length })}</Badge>
                    </div>

                    {/* Assets */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                        <Database className="h-3.5 w-3.5" />
                        {t("industryTemplates.assetsSection")}
                      </p>
                      <div className="grid gap-1.5">
                        {template.assets.map((asset) => (
                          <div key={asset.name} className="flex items-center justify-between text-xs rounded border px-3 py-2">
                            <span className="font-medium">{asset.name}</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] font-normal">{asset.type}</Badge>
                              <span className="text-muted-foreground">{t("industryTemplates.badges.elementsCount", { count: asset.elements })}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Activities */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5" />
                        {t("industryTemplates.activitiesSection")}
                      </p>
                      <div className="grid gap-1.5">
                        {template.activities.map((activity) => (
                          <div key={activity.name} className="flex items-center justify-between text-xs rounded border px-3 py-2">
                            <span className="font-medium">{activity.name}</span>
                            <Badge variant="outline" className="text-[10px] font-normal">{activity.basis}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Flows */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                        {t("industryTemplates.flowsSection")}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {template.flows.map((flow) => (
                          <Badge key={flow} variant="secondary" className="text-xs font-normal">{flow}</Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      </DocSection>

      {/* AFTER QUICKSTART */}
      <DocSection id="after-quickstart" title={t("afterQuickstart.title")} description={t("afterQuickstart.description")}>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("afterQuickstart.intro")}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {afterItems.map((key) => (
              <div key={key} className="flex items-start gap-2 p-3 rounded-lg border">
                <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium">{t(`afterQuickstart.items.${key}.label`)}</p>
                  <p className="text-xs text-muted-foreground">{t(`afterQuickstart.items.${key}.desc`)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DocSection>

      <div className="mt-2">
        <Link href="/privacy/quickstart">
          <Button className="gap-2">
            <Zap className="w-4 h-4" />
            {t("openWizard")}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>

      <DocNavFooter
        previous={{ title: t("nav.previous"), href: "/privacy/docs" }}
        next={{ title: t("nav.next"), href: "/privacy/docs/data-inventory" }}
      />
    </div>
  );
}
