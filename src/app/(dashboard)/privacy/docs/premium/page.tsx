"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import Link from "next/link";
import { Lock, Shield, Globe, Building2, Search, Sparkles, Mail, CreditCard } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DocSection } from "@/components/docs/doc-section";
import { InfoCallout } from "@/components/docs/info-callout";
import { PremiumBadge } from "@/components/docs/premium-badge";
import { DocNavFooter } from "@/components/docs/doc-nav-footer";
import { features } from "@/config/features";
import { brand } from "@/config/brand";
import { formatPrice } from "@/lib/currency";

export default function DocsPremiumPage() {
  const t = useTranslations("docs.premium");
  const price = formatPrice(9);

  const dpiaWhenKeys = ["profiling", "special", "monitoring", "tech", "rights"] as const;
  const dpiaWorkflowKeys = ["describe", "assess", "identify", "measures", "document", "consult"] as const;
  const piaDiffKeys = ["scope", "org", "flex", "cases"] as const;
  const tiaEvalKeys = ["legal", "surveillance", "supplementary", "technical", "org", "contractual"] as const;
  const tiaSafeguardKeys = ["sccs", "bcrs", "adequacy", "consent", "encryption"] as const;
  const vendorCoversKeys = ["scope", "security", "sub", "incident", "retention", "transfer"] as const;
  const vendorCatalogFeatureKeys = ["profiles", "certs", "details", "sub", "dpa", "import"] as const;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-1">{t("subtitle", { price })}</p>
      </div>

      <Card className="border-dashed border-amber-500/50 bg-amber-500/5 hover:translate-y-0">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className="rounded-lg border-2 border-amber-500 p-2.5 shrink-0">
              <Lock className="h-5 w-5 text-amber-500" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold">{t("cardTitle")}</h3>
                <PremiumBadge />
              </div>
              <p className="text-sm text-muted-foreground">
                {t("cardBodyPrefix")}{price}{t("cardBodyMid")}
                {features.selfServiceUpgrade ? t("cardSelfService") : t("cardContact")}
              </p>
              {features.selfServiceUpgrade ? (
                <Button variant="outline" size="sm" className="mt-3" asChild>
                  <Link href="/privacy/billing">
                    <CreditCard className="h-4 w-4 mr-2" />
                    {t("viewAddons")}
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" className="mt-3" asChild>
                  <a href={`mailto:${brand.supportEmail}`}>
                    <Mail className="h-4 w-4 mr-2" />
                    {t("contactUs")}
                  </a>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <DocSection id="dpia" title={t("dpia.title")} description={t("dpia.description")}>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-medium">{t("dpia.badge")}</span>
            <PremiumBadge />
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-sm font-medium">{t("dpia.whenTitle")}</p>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc ml-4">
              {dpiaWhenKeys.map((k) => (
                <li key={k}>{t(`dpia.whenItems.${k}`)}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-sm font-medium">{t("dpia.workflowTitle")}</p>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc ml-4">
              {dpiaWorkflowKeys.map((k) => (
                <li key={k}>{t(`dpia.workflowItems.${k}`)}</li>
              ))}
            </ul>
          </div>
        </div>
        <InfoCallout type="info" title={t("dpia.infoTitle")}>
          {features.selfServiceUpgrade ? (
            <>
              {t("dpia.infoSelfPrefix")}
              <Link href="/privacy/billing" className="text-primary underline">{t("dpia.infoSelfLink")}</Link>
              {t("dpia.infoSelfSuffix")}
            </>
          ) : (
            <>
              {t("dpia.infoContactPrefix")}{brand.supportEmail}{t("dpia.infoContactSuffix")}
            </>
          )}
        </InfoCallout>
      </DocSection>

      <DocSection id="pia" title={t("pia.title")} description={t("pia.description")}>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-medium">{t("pia.badge")}</span>
            <PremiumBadge />
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-sm font-medium">{t("pia.diffTitle")}</p>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc ml-4">
              {piaDiffKeys.map((k) => (
                <li key={k}>
                  <strong>{t(`pia.diffItems.${k}Label`)}</strong>{t(`pia.diffItems.${k}Body`)}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <InfoCallout type="info" title={t("pia.infoTitle")}>
          {features.selfServiceUpgrade ? (
            <>
              {t("pia.infoSelfPrefix")}
              <Link href="/privacy/billing" className="text-primary underline">{t("pia.infoSelfLink")}</Link>
              {t("pia.infoSelfSuffix")}
            </>
          ) : (
            <>
              {t("pia.infoContactPrefix")}{brand.supportEmail}{t("pia.infoContactSuffix")}
            </>
          )}
        </InfoCallout>
      </DocSection>

      <DocSection id="tia" title={t("tia.title")} description={t("tia.description")}>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <span className="font-medium">{t("tia.badge")}</span>
            <PremiumBadge />
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-sm font-medium">{t("tia.evalTitle")}</p>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc ml-4">
              {tiaEvalKeys.map((k) => (
                <li key={k}>{t(`tia.evalItems.${k}`)}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-sm font-medium">{t("tia.safeguardsTitle")}</p>
            <div className="flex flex-wrap gap-2">
              {tiaSafeguardKeys.map((k) => (
                <Badge key={k} variant="outline" className="text-xs">{t(`tia.safeguards.${k}`)}</Badge>
              ))}
            </div>
          </div>
        </div>
        <InfoCallout type="info" title={t("tia.infoTitle")}>
          {features.selfServiceUpgrade ? (
            <>
              {t("tia.infoSelfPrefix")}
              <Link href="/privacy/billing" className="text-primary underline">{t("tia.infoSelfLink")}</Link>
              {t("tia.infoSelfSuffix")}
            </>
          ) : (
            <>
              {t("tia.infoContactPrefix")}{brand.supportEmail}{t("tia.infoContactSuffix")}
            </>
          )}
        </InfoCallout>
      </DocSection>

      <DocSection id="vendor-risk" title={t("vendorRisk.title")} description={t("vendorRisk.description")}>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <span className="font-medium">{t("vendorRisk.badge")}</span>
            <PremiumBadge />
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-sm font-medium">{t("vendorRisk.coversTitle")}</p>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc ml-4">
              {vendorCoversKeys.map((k) => (
                <li key={k}>{t(`vendorRisk.coversItems.${k}`)}</li>
              ))}
            </ul>
          </div>
        </div>
        <InfoCallout type="tip" title={t("vendorRisk.tipTitle")}>
          {t("vendorRisk.tipBody")}
        </InfoCallout>
        <InfoCallout type="info" title={t("vendorRisk.infoTitle")}>
          {features.selfServiceUpgrade ? (
            <>
              {t("vendorRisk.infoSelfPrefix")}
              <Link href="/privacy/billing" className="text-primary underline">{t("vendorRisk.infoSelfLink")}</Link>
              {t("vendorRisk.infoSelfSuffix")}
            </>
          ) : (
            <>
              {t("vendorRisk.infoContactPrefix")}{brand.supportEmail}{t("vendorRisk.infoContactSuffix")}
            </>
          )}
        </InfoCallout>
      </DocSection>

      <DocSection id="vendor-catalog" title={t("vendorCatalog.title")} description={t("vendorCatalog.description")}>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            <span className="font-medium">{t("vendorCatalog.badge")}</span>
            <PremiumBadge />
          </div>

          <Card className="border-primary/50 bg-primary/5 hover:translate-y-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <Sparkles className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-sm">{t("vendorCatalog.cardTitle")}</p>
                  <p className="text-xs text-muted-foreground">{t("vendorCatalog.cardSubtitle")}</p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {vendorCatalogFeatureKeys.map((k) => (
                  <div key={k} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    {t(`vendorCatalog.features.${k}`)}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        <InfoCallout type="info" title={t("vendorCatalog.infoTitle")}>
          {features.selfServiceUpgrade ? (
            <>
              {t("vendorCatalog.infoSelfPrefix")}
              <Link href="/privacy/billing" className="text-primary underline">{t("vendorCatalog.infoSelfLink")}</Link>
              {t("vendorCatalog.infoSelfSuffix")}
            </>
          ) : (
            <>
              {t("vendorCatalog.infoContactPrefix")}{brand.supportEmail}{t("vendorCatalog.infoContactSuffix")}
            </>
          )}
        </InfoCallout>
      </DocSection>

      <DocNavFooter
        previous={{ title: t("nav.previous"), href: "/privacy/docs/ai-governance" }}
      />
    </div>
  );
}
