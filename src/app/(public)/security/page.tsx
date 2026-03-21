"use client";

import {
  Shield,
  Lock,
  KeyRound,
  Users,
  FileCheck,
  Globe,
  Eye,
  Server,
  CreditCard,
  ScrollText,
  CheckCircle,
  Layers,
  ShieldCheck,
  Fingerprint,
  Mail,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// ---------------------------------------------------------------------------
// Structure (icons + keys — all text comes from translations)
// ---------------------------------------------------------------------------

interface SectionDef {
  id: string;
  icon: React.ElementType;
  titleKey: string;
  badgeKey?: string;
  badgeClass?: string;
  itemKeys: string[];
  highlightKey?: string;
  highlightType?: "tip" | "info";
}

interface CategoryDef {
  titleKey: string;
  descKey: string;
  icon: React.ElementType;
  sections: SectionDef[];
}

const categories: CategoryDef[] = [
  {
    titleKey: "categories.identityAccess",
    descKey: "categories.identityAccessDesc",
    icon: Fingerprint,
    sections: [
      {
        id: "authentication",
        icon: Lock,
        titleKey: "sections.authentication",
        badgeKey: "badges.zeroKnowledge",
        badgeClass: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 border-transparent",
        itemKeys: ["items.auth1", "items.auth2", "items.auth3", "items.auth4", "items.auth5"],
        highlightKey: "items.authHighlight",
        highlightType: "tip",
      },
      {
        id: "authorization",
        icon: Users,
        titleKey: "sections.authorization",
        badgeKey: "badges.fiveTierRbac",
        badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 border-transparent",
        itemKeys: ["items.authz1", "items.authz2", "items.authz3", "items.authz4", "items.authz5"],
        highlightKey: "items.authzHighlight",
        highlightType: "info",
      },
    ],
  },
  {
    titleKey: "categories.appSecurity",
    descKey: "categories.appSecurityDesc",
    icon: ShieldCheck,
    sections: [
      {
        id: "input-validation",
        icon: FileCheck,
        titleKey: "sections.inputValidation",
        itemKeys: ["items.input1", "items.input2", "items.input3", "items.input4"],
      },
      {
        id: "api-security",
        icon: KeyRound,
        titleKey: "sections.apiSecurity",
        itemKeys: ["items.api1", "items.api2", "items.api3", "items.api4"],
        highlightKey: "items.apiHighlight",
        highlightType: "info",
      },
      {
        id: "rate-limiting",
        icon: Shield,
        titleKey: "sections.rateLimiting",
        badgeKey: "badges.perEndpoint",
        badgeClass: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100 border-transparent",
        itemKeys: ["items.rate1", "items.rate2", "items.rate3", "items.rate4"],
      },
    ],
  },
  {
    titleKey: "categories.dataProtection",
    descKey: "categories.dataProtectionDesc",
    icon: Lock,
    sections: [
      {
        id: "transport",
        icon: Globe,
        titleKey: "sections.transport",
        badgeKey: "badges.sixHeaders",
        badgeClass: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 border-transparent",
        itemKeys: ["items.transport1", "items.transport2", "items.transport3", "items.transport4", "items.transport5"],
        highlightKey: "items.transportHighlight",
        highlightType: "tip",
      },
      {
        id: "audit",
        icon: ScrollText,
        titleKey: "sections.audit",
        itemKeys: ["items.audit1", "items.audit2", "items.audit3"],
      },
      {
        id: "minimization",
        icon: Eye,
        titleKey: "sections.minimization",
        itemKeys: ["items.min1", "items.min2", "items.min3"],
      },
      {
        id: "payment",
        icon: CreditCard,
        titleKey: "sections.payment",
        badgeKey: "badges.stripeVerified",
        badgeClass: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100 border-transparent",
        itemKeys: ["items.pay1", "items.pay2", "items.pay3"],
      },
    ],
  },
  {
    titleKey: "categories.infrastructure",
    descKey: "categories.infrastructureDesc",
    icon: Server,
    sections: [
      {
        id: "infrastructure",
        icon: Server,
        titleKey: "sections.hosting",
        badgeKey: "badges.edgeNetwork",
        badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 border-transparent",
        itemKeys: ["items.infra1", "items.infra2", "items.infra3", "items.infra4"],
      },
    ],
  },
];

const statDefs = [
  { labelKey: "stats.layers", value: "10", icon: Layers },
  { labelKey: "stats.headers", value: "6", icon: Globe },
  { labelKey: "stats.roles", value: "5", icon: Users },
  { labelKey: "stats.hsts", value: "2 yr", icon: ShieldCheck },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SecurityPage() {
  const t = useTranslations("security");

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-12">
      {/* ── Hero ────────────────────────────────────────────────────── */}
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/15 border border-primary/20">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <Badge variant="outline" className="text-[10px] bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 border-transparent">
              {t("badge")}
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {t("title")}
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm sm:text-base leading-relaxed">
            {t("subtitle")}
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {statDefs.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.labelKey} className="hover:translate-y-0">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                  <CardTitle className="text-xs font-medium">{t(stat.labelKey)}</CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-xl font-bold text-primary">{stat.value}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ── Categories ──────────────────────────────────────────────── */}
      {categories.map((category) => {
        const CatIcon = category.icon;
        return (
          <section key={category.titleKey} className="space-y-4">
            {/* Category header */}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/10">
                <CatIcon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold tracking-tight">{t(category.titleKey)}</h2>
                <p className="text-xs text-muted-foreground">{t(category.descKey)}</p>
              </div>
            </div>

            {/* Accordion sections */}
            <div className="rounded-xl border bg-background overflow-hidden">
              {/* Mockup-style header bar */}
              <div className="flex items-center gap-2 border-b px-4 py-2 bg-muted/30">
                <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">{t("controlsLabel")}</span>
                <span className="text-xs text-muted-foreground">—</span>
                <span className="text-xs text-muted-foreground">{t(category.titleKey)}</span>
              </div>

              <div className="px-4">
                <Accordion type="multiple" defaultValue={category.sections.map((s) => s.id)}>
                  {category.sections.map((section) => {
                    const SectionIcon = section.icon;
                    return (
                      <AccordionItem key={section.id} value={section.id} className="last:border-b-0">
                        <AccordionTrigger className="hover:no-underline gap-3 py-3.5">
                          <div className="flex items-center gap-3">
                            <SectionIcon className="h-4 w-4 text-primary shrink-0" />
                            <span className="text-sm font-medium">{t(section.titleKey)}</span>
                            {section.badgeKey && (
                              <Badge variant="outline" className={`text-[10px] ${section.badgeClass}`}>
                                {t(section.badgeKey)}
                              </Badge>
                            )}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pl-7">
                          <ul className="space-y-2 mb-3">
                            {section.itemKeys.map((key) => (
                              <li key={key} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                                <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                                {t(key)}
                              </li>
                            ))}
                          </ul>
                          {section.highlightKey && (
                            <div
                              className={`border-l-4 rounded-r-lg p-3 mt-2 ${
                                section.highlightType === "tip"
                                  ? "border-primary bg-primary/5"
                                  : "border-blue-500 bg-blue-500/5"
                              }`}
                            >
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                {t(section.highlightKey)}
                              </p>
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </div>
            </div>
          </section>
        );
      })}

      {/* ── Responsible Disclosure ────────────────────────────────── */}
      <div className="border-l-4 border-primary bg-primary/5 rounded-r-lg p-5">
        <div className="flex gap-3">
          <Mail className="h-5 w-5 shrink-0 mt-0.5 text-primary" />
          <div className="space-y-1.5">
            <p className="font-medium text-sm">{t("disclosure.title")}</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("disclosure.body")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
