"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Database, Edit, Loader2, Server, Workflow } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { useEnumLabels } from "@/lib/enum-labels";
import type { DataCategory, DataSensitivity } from "@prisma/client";
import { StatusChip } from "@/components/ui/status-chip";
import { toneForSensitivity } from "@/config/status-tone";

// Sensitivity goes through the shared tones: toneForSensitivity.

const LEGAL_BASES = new Set([
  "CONSENT",
  "CONTRACT",
  "LEGAL_OBLIGATION",
  "VITAL_INTERESTS",
  "PUBLIC_TASK",
  "LEGITIMATE_INTERESTS",
]);

export default function DataElementDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { organization } = useOrganization();
  const { label: enumLabel } = useEnumLabels();
  const t = useTranslations("pages.elementDetail");
  const tAsset = useTranslations("pages.assetDetail");
  const tBasis = useTranslations("pages.dataInventory.legalBasis");
  const basisLabel = (basis: string) => (LEGAL_BASES.has(basis) ? tBasis(basis) : basis);

  const { data: element, isLoading } = trpc.dataInventory.getElement.useQuery(
    { organizationId: organization?.id ?? "", id },
    { enabled: !!organization?.id }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!element) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <Database className="w-12 h-12 mb-4 opacity-50" />
        <p className="font-medium">{t("notFound")}</p>
        <p className="text-sm mb-4">{t("notFoundBody")}</p>
        <Link href="/privacy/data-inventory">
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t("backToInventory")}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 sm:gap-4">
        <Link href={`/privacy/data-inventory/${element.dataAsset.id}`}>
          <Button variant="ghost" size="icon" aria-label={t("back")} className="shrink-0 mt-1">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 flex items-center justify-center shrink-0">
            <Database className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-semibold font-mono truncate">{element.name}</h1>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <Badge variant="outline">{tAsset(`category.${element.category as DataCategory}`)}</Badge>
              <StatusChip tone={toneForSensitivity(element.sensitivity as string)}>
                {tAsset(`sensitivity.${element.sensitivity as DataSensitivity}`)}
              </StatusChip>
              {element.isPersonalData && <Badge variant="outline">{t("personalData")}</Badge>}
              {element.isSpecialCategory && <Badge variant="destructive">{t("specialCategory")}</Badge>}
            </div>
          </div>
        </div>
        <Link href={`/privacy/data-inventory/elements/${element.id}/edit`} className="shrink-0">
          <Button variant="outline" size="sm">
            <Edit className="w-4 h-4 mr-2" />
            {t("edit")}
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>{t("overview")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              {element.description || t("noDescription")}
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">{t("retention")}</p>
                <p className="font-medium">
                  {element.retentionDays ? t("retentionDays", { days: element.retentionDays }) : t("notSpecified")}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("legalBasis")}</p>
                <p className="font-medium">{element.legalBasis ? basisLabel(element.legalBasis) : t("notSpecified")}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("parentAsset")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href={`/privacy/data-inventory/${element.dataAsset.id}`}
              className="block border rounded-lg p-3 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{element.dataAsset.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {enumLabel("dataAssetType", element.dataAsset.type)}
                      {element.dataAsset.vendor ? ` · ${element.dataAsset.vendor}` : ""}
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("linkedTitle")}</CardTitle>
          <CardDescription>{t("linkedDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {element.linkedActivities.length > 0 ? (
            <div className="space-y-2">
              {element.linkedActivities.map(({ linkId, activity }: { linkId: string; activity: { id: string; name: string; purpose: string; legalBasis: string; isActive: boolean } }) => (
                <Link
                  key={linkId}
                  href={`/privacy/data-inventory/activities/${activity.id}`}
                  className="block border rounded-lg p-3 hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Workflow className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{activity.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {basisLabel(activity.legalBasis)}
                          {activity.purpose && ` · ${activity.purpose}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!activity.isActive && (
                        <Badge variant="outline" className="text-xs">{t("inactive")}</Badge>
                      )}
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Workflow className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{t("noLinked")}</p>
              <p className="text-sm">{t("noLinkedHint")}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
