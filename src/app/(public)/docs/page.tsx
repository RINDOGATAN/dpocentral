import type { Metadata } from "next";
import Link from "next/link";
import {
  Database,
  FileText,
  ClipboardCheck,
  AlertTriangle,
  Building2,
  Shield,
  ArrowRight,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("docs.publicOverview");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: "/docs" },
    openGraph: {
      title: t("ogTitle"),
      description: t("ogDescription"),
      url: "/docs",
    },
  };
}

export default async function DocsOverviewPage() {
  const t = await getTranslations("docs.publicOverview");

  const modules: { key: string; href: string; icon: typeof Database }[] = [
    { key: "inventory", href: "/docs/data-inventory", icon: Database },
    { key: "dsar", href: "/docs/dsar", icon: FileText },
    { key: "assessments", href: "/docs/assessments", icon: ClipboardCheck },
    { key: "incidents", href: "/docs/incidents", icon: AlertTriangle },
    { key: "vendors", href: "/docs/vendors", icon: Building2 },
  ];

  const roleKeys = ["Owner", "Admin", "PrivacyOfficer", "Member", "Viewer"] as const;
  const reportKeys = [
    "assessmentExport",
    "portfolio",
    "dsar",
    "regulatory",
    "inventory",
    "ropa",
    "vendor",
    "breach",
  ] as const;
  const coreItems = ["inventory", "dsar", "incidents", "assessments", "vendors"] as const;
  const premiumItems = ["assessments", "vendor", "catalog", "audit"] as const;

  return (
    <div className="space-y-12">
      {/* Hero */}
      <div>
        <h1 className="text-3xl font-display uppercase tracking-wide text-foreground mb-4">{t("heroTitle")}</h1>
        <p className="text-lg text-muted-foreground max-w-2xl">{t("heroSubtitle")}</p>
      </div>

      {/* Quick Start */}
      <div className="card-brutal">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">{t("quickstart.title")}</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div className="space-y-3">
            {(["step1", "step2"] as const).map((step, i) => (
              <div key={step} className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                  {i + 1}
                </span>
                <div>
                  <p className="font-medium text-foreground">{t(`quickstart.${step}.label`)}</p>
                  <p className="text-muted-foreground">{t(`quickstart.${step}.desc`)}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            {(["step3", "step4"] as const).map((step, i) => (
              <div key={step} className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                  {i + 3}
                </span>
                <div>
                  <p className="font-medium text-foreground">{t(`quickstart.${step}.label`)}</p>
                  <p className="text-muted-foreground">{t(`quickstart.${step}.desc`)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* User Roles */}
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-4">{t("roles.title")}</h2>
        <p className="text-sm text-muted-foreground mb-4">{t("roles.intro")}</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {roleKeys.map((key) => (
            <div key={key} className="p-3 rounded-lg border border-border bg-card">
              <p className="text-sm font-semibold text-primary">{t(`roles.items.${key}.role`)}</p>
              <p className="text-xs text-muted-foreground mt-1">{t(`roles.items.${key}.desc`)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Modules */}
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-6">{t("modulesTitle")}</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link key={mod.href} href={mod.href} className="group card-brutal flex flex-col">
                <div className="flex items-center gap-3 mb-2">
                  <Icon className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-foreground">{t(`modules.${mod.key}.title`)}</h3>
                  <ArrowRight className="w-4 h-4 text-muted-foreground ml-auto group-hover:text-primary transition-colors" />
                </div>
                <p className="text-sm text-muted-foreground">{t(`modules.${mod.key}.description`)}</p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Reports & Exports */}
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-4">{t("reports.title")}</h2>
        <p className="text-sm text-muted-foreground mb-4">{t("reports.intro")}</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {reportKeys.map((key) => (
            <div key={key} className="p-3 rounded-lg border border-border bg-card">
              <p className="text-sm font-semibold text-foreground">{t(`reports.items.${key}.name`)}</p>
              <p className="text-xs text-muted-foreground mt-1">{t(`reports.items.${key}.desc`)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Licensing */}
      <div className="p-6 rounded-2xl border border-amber-500/30 bg-amber-500/5">
        <h2 className="text-lg font-semibold text-foreground mb-2">{t("licensing.title")}</h2>
        <p className="text-sm text-muted-foreground mb-4">{t("licensing.intro")}</p>
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-medium text-foreground mb-2">{t("licensing.coreTitle")}</p>
            <ul className="space-y-1 text-muted-foreground">
              {coreItems.map((k) => (
                <li key={k}>&#8226; {t(`licensing.coreItems.${k}`)}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-medium text-foreground mb-2">{t("licensing.premiumTitle")}</p>
            <ul className="space-y-1 text-muted-foreground">
              {premiumItems.map((k) => (
                <li key={k}>&#8226; {t(`licensing.premiumItems.${k}`)}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
