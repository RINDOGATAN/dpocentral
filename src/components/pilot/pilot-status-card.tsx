"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useTranslations } from "next-intl";
import { Download } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { RUN_YOUR_OWN_URL } from "@/lib/hosted";

const EXPORTS = [
  { key: "all", path: "organization-data", format: null },
  { key: "program", path: "privacy-program", format: null },
  { key: "ropa", path: "ropa", format: null },
  { key: "vendorRegister", path: "vendor-register", format: "csv" },
  { key: "breachRegister", path: "breach-register", format: "csv" },
  { key: "dsarPerformance", path: "dsar-performance", format: null },
  { key: "assessmentPortfolio", path: "assessment-portfolio", format: null },
] as const;

/**
 * Hosted pilot card for Settings: days left, records against the ceiling,
 * the two ways out, and every export. Renders nothing on the kit.
 */
export function PilotStatusCard({ organizationId }: { organizationId: string }) {
  const t = useTranslations("pilot");
  const { data: status } = trpc.organization.getPilotStatus.useQuery(
    { organizationId },
    { enabled: !!organizationId }
  );

  if (!status?.hosted) return null;

  const systems = status.usage.find((u) => u.resource === "dataAssets");
  const atCeiling = status.usage.some((u) => u.used >= u.limit);
  const links = {
    run: (chunks: React.ReactNode) => (
      <a
        href={RUN_YOUR_OWN_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline"
      >
        {chunks}
      </a>
    ),
    export: (chunks: React.ReactNode) => (
      <a href="#pilot-export" className="text-primary underline">
        {chunks}
      </a>
    ),
  };

  return (
    <Card id="pilot" data-testid="pilot-status-card">
      <CardHeader>
        <CardTitle className="text-base">
          {t("settings.summary", {
            days: status.daysLeft,
            used: systems?.used ?? 0,
            limit: systems?.limit ?? 0,
          })}
        </CardTitle>
        <CardDescription>{t("settings.description", { days: status.days })}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status.readOnly && (
          <p className="p-3 border border-destructive text-destructive text-sm">
            {t("settings.readOnly")}
          </p>
        )}
        {!status.readOnly && atCeiling && (
          <p className="p-3 border border-destructive text-destructive text-sm">
            {t("settings.limitReached")}
          </p>
        )}
        <p className="text-sm">{t.rich("settings.waysOut", links)}</p>

        <div>
          <h3 className="text-sm font-medium mb-2">{t("settings.limitsTitle")}</h3>
          <ul className="grid gap-1 sm:grid-cols-2 text-sm">
            {status.usage.map((u) => (
              <li key={u.resource} className="flex justify-between gap-4">
                <span className="text-muted-foreground">
                  {t(`settings.resources.${u.resource}`)}
                </span>
                <span className={u.used >= u.limit ? "text-destructive font-medium" : ""}>
                  {t("settings.usage", { used: u.used, limit: u.limit })}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div id="pilot-export">
          <h3 className="text-sm font-medium mb-2">{t("settings.exportTitle")}</h3>
          <ul className="flex flex-col gap-1 text-sm">
            {EXPORTS.map((e) => (
              <li key={e.key}>
                <a
                  href={`/api/export/${e.path}?organizationId=${organizationId}${e.format ? `&format=${e.format}` : ""}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-primary hover:underline"
                >
                  <Download className="w-3.5 h-3.5" />
                  {t(`settings.exports.${e.key}`)}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
