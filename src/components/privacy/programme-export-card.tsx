"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Settings: "Take your programme with you". The whole programme as one ZIP in
 * the open programme format (GET /api/export/programme). Owners and admins
 * only. Rights requests, which hold personal data of the people who made
 * them, are added only when the separate box with that warning is ticked.
 */

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { PackageOpen, Download } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { isDsarModuleEnabled } from "@/config/features";

export function programmeExportHref(organizationId: string, locale: string, includeRightsRequests: boolean): string {
  const params = new URLSearchParams({ organizationId, locale: locale === "es" ? "es" : "en" });
  if (includeRightsRequests) {
    params.set("includeRightsRequests", "1");
    params.set("acknowledgePersonalData", "1");
  }
  return `/api/export/programme?${params.toString()}`;
}

export function ProgrammeExportCard({ organizationId }: { organizationId: string }) {
  const t = useTranslations("pages.settings.portability.export");
  const locale = useLocale();
  const [withRequests, setWithRequests] = useState(false);
  const dsarOn = isDsarModuleEnabled();

  return (
    <Card data-testid="programme-export-card">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <PackageOpen className="w-4 h-4 text-primary" aria-hidden="true" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("lead")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{t("contents")}</p>
        {dsarOn && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
            <Checkbox
              id="export-include-rights"
              checked={withRequests}
              onCheckedChange={(v) => setWithRequests(v === true)}
              className="mt-0.5"
            />
            <label htmlFor="export-include-rights" className="text-sm leading-snug cursor-pointer">
              <span className="font-medium">{t("includeRights")}</span>
              <span className="block text-xs text-muted-foreground mt-0.5">{t("includeRightsWarning")}</span>
            </label>
          </div>
        )}
        <Button asChild size="sm">
          <a
            href={programmeExportHref(organizationId, locale, dsarOn && withRequests)}
            download
            onClick={() => toast.success(t("started"))}
            data-testid="programme-export-download"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
            {t("button")}
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
