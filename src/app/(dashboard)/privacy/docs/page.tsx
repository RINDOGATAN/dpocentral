import {
  Database,
  FileText,
  ClipboardCheck,
  AlertTriangle,
  Building2,
  Shield,
  LayoutDashboard,
  Plus,
  Zap,
  Sparkles,
  ArrowRight,
  Scale,
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

export default async function DocsGettingStartedPage() {
  const t = await getTranslations("docs.gettingStarted");

  const navItems: { icon: typeof LayoutDashboard; key: string }[] = [
    { icon: LayoutDashboard, key: "dashboard" },
    { icon: Database, key: "dataInventory" },
    { icon: FileText, key: "dsar" },
    { icon: ClipboardCheck, key: "assessments" },
    { icon: AlertTriangle, key: "incidents" },
    { icon: Building2, key: "vendors" },
    { icon: Shield, key: "reports" },
    { icon: Scale, key: "regulations" },
    { icon: Shield, key: "aiSystems" },
  ];

  const roleRows = ["OWNER", "ADMIN", "PRIVACY_OFFICER", "MEMBER", "VIEWER"] as const;

  const quickActions: { icon: typeof Database; key: string }[] = [
    { icon: Database, key: "addAsset" },
    { icon: FileText, key: "newDsar" },
    { icon: ClipboardCheck, key: "startAssessment" },
    { icon: AlertTriangle, key: "reportIncident" },
    { icon: Building2, key: "addVendor" },
    { icon: Shield, key: "runAudit" },
  ];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      <DocSection id="dashboard" title={t("dashboard.title")} description={t("dashboard.description")}>
        <FeatureMockup title={t("dashboard.mockupTitle")}>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <Card className="hover:translate-y-0">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                <CardTitle className="text-xs font-medium">{t("dashboard.cards.dataInventory.label")}</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-xl font-bold text-primary">{t("dashboard.cards.dataInventory.value")}</div>
                <p className="text-xs text-muted-foreground">{t("dashboard.cards.dataInventory.sub")}</p>
              </CardContent>
            </Card>
            <Card className="hover:translate-y-0">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                <CardTitle className="text-xs font-medium">{t("dashboard.cards.openDsars.label")}</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-xl font-bold text-primary">{t("dashboard.cards.openDsars.value")}</div>
                <p className="text-xs text-muted-foreground">{t("dashboard.cards.openDsars.sub")}</p>
              </CardContent>
            </Card>
            <Card className="hover:translate-y-0">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                <CardTitle className="text-xs font-medium">{t("dashboard.cards.assessments.label")}</CardTitle>
                <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-xl font-bold text-primary">{t("dashboard.cards.assessments.value")}</div>
                <p className="text-xs text-muted-foreground">{t("dashboard.cards.assessments.sub")}</p>
              </CardContent>
            </Card>
            <Card className="hover:translate-y-0">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                <CardTitle className="text-xs font-medium">{t("dashboard.cards.incidents.label")}</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-xl font-bold text-primary">{t("dashboard.cards.incidents.value")}</div>
                <p className="text-xs text-muted-foreground">{t("dashboard.cards.incidents.sub")}</p>
              </CardContent>
            </Card>
          </div>
        </FeatureMockup>
        <InfoCallout type="tip" title={t("dashboard.calloutTitle")}>
          {t("dashboard.calloutBody")}
        </InfoCallout>
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
        <div className="mt-2 flex gap-3">
          <Link href="/privacy/quickstart">
            <Button className="gap-2">
              <Zap className="w-4 h-4" />
              {t("quickstart.openWizard")}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link href="/privacy/docs/quickstart">
            <Button variant="outline" className="gap-2">
              {t("quickstart.fullGuide")}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </DocSection>

      <DocSection id="navigation" title={t("navigation.title")} description={t("navigation.description")}>
        <div className="grid gap-3 sm:grid-cols-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.key} className="flex items-start gap-3 rounded-lg border p-3">
                <div className="rounded-md bg-primary/10 p-2">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">{t(`navigation.items.${item.key}.label`)}</p>
                  <p className="text-xs text-muted-foreground">{t(`navigation.items.${item.key}.desc`)}</p>
                </div>
              </div>
            );
          })}
        </div>
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

      <DocSection id="quick-actions" title={t("quickActions.title")} description={t("quickActions.description")}>
        <FeatureMockup title={t("quickActions.mockupTitle")}>
          <Card className="hover:translate-y-0">
            <CardHeader className="p-4">
              <CardTitle className="text-base">{t("quickActions.panelTitle")}</CardTitle>
              <CardDescription className="text-xs">{t("quickActions.panelSubtitle")}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 grid-cols-1 sm:grid-cols-2 p-4 pt-0">
              {quickActions.map((item) => {
                const Icon = item.icon;
                return (
                  <Button key={item.key} variant="outline" className="w-full justify-start h-11">
                    <Icon className="w-4 h-4 mr-2 shrink-0" />
                    <span className="truncate">{t(`quickActions.actions.${item.key}`)}</span>
                    <Plus className="w-3 h-3 ml-auto text-muted-foreground" />
                  </Button>
                );
              })}
            </CardContent>
          </Card>
        </FeatureMockup>
      </DocSection>

      <DocNavFooter
        next={{ title: t("nav.next"), href: "/privacy/docs/quickstart" }}
      />
    </div>
  );
}
