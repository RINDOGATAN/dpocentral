"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, Download } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusNote } from "@/components/ui/status-note";
import { toneMark } from "@/config/status-palette";
import { trpc } from "@/lib/trpc";
import { RUN_YOUR_OWN_URL } from "@/lib/hosted";
import { isDsarModuleEnabled } from "@/config/features";
import { useOrganization } from "@/lib/organization-context";
import { formatDateIn } from "@/lib/utils";

const ALL_EXPORTS = [
  { key: "all", path: "organization-data", format: null },
  { key: "program", path: "privacy-program", format: null },
  { key: "ropa", path: "ropa", format: null },
  { key: "vendorRegister", path: "vendor-register", format: "csv" },
  { key: "breachRegister", path: "breach-register", format: "csv" },
  { key: "dsarPerformance", path: "dsar-performance", format: null },
  { key: "assessmentPortfolio", path: "assessment-portfolio", format: null },
] as const;

type ExportLink = { key: string; path: string; format: string | null };

/**
 * The exports offered. Without the rights-request module
 * (NEXT_PUBLIC_DSAR_ENABLED=false) its report goes, and owners and admins get
 * the download of the rights-request records the organisation already holds
 * instead (GET /api/export/rights-requests).
 */
function exportsFor(dsarOn: boolean, isAdmin: boolean): readonly ExportLink[] {
  if (dsarOn) return ALL_EXPORTS;
  const rest: ExportLink[] = ALL_EXPORTS.filter((e) => e.key !== "dsarPerformance");
  return isAdmin
    ? [...rest, { key: "rightsRequests", path: "rights-requests", format: null }]
    : rest;
}

/** Every export, as links (the pilot card and the paid plan card). */
function ExportList({ organizationId, links }: { organizationId: string; links: readonly ExportLink[] }) {
  const t = useTranslations("pilot");
  return (
    <div id="pilot-export">
      <h3 className="text-sm font-medium mb-2">{t("settings.exportTitle")}</h3>
      <ul className="flex flex-col gap-1 text-sm">
        {links.map((e) => (
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
  );
}

/**
 * Hosted pilot card for Settings: days left, records against the ceiling,
 * the two ways out, and every export. On the paid EU cloud plan: the plan's
 * name, that the pilot limits do not apply, the renewal date, and every
 * export (no price). Renders nothing on the kit.
 */
export function PilotStatusCard({ organizationId }: { organizationId: string }) {
  const t = useTranslations("pilot");
  const locale = useLocale();
  const { organizations } = useOrganization();
  const role = (organizations.find((o) => o.id === organizationId) as { role?: string } | undefined)?.role;
  const exportLinks = exportsFor(isDsarModuleEnabled(), role === "OWNER" || role === "ADMIN");
  const { data: status } = trpc.organization.getPilotStatus.useQuery(
    { organizationId },
    { enabled: !!organizationId }
  );

  if (!status?.hosted) return null;

  if (status.paid) {
    return (
      <Card id="pilot" data-testid="paid-plan-card">
        <CardHeader>
          <CardTitle className="text-base">{t("settings.paid.title")}</CardTitle>
          <CardDescription>{t("settings.paid.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status.renewsAt && (
            <p className="text-sm">
              {/* Plan dates are calendar days recorded at midnight UTC. */}
              {t("settings.paid.renews", { date: formatDateIn(status.renewsAt, locale, "UTC") })}
            </p>
          )}
          <ExportList organizationId={organizationId} links={exportLinks} />
        </CardContent>
      </Card>
    );
  }

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
          <StatusNote tone="warning" className="border">
            {t("settings.readOnly")}
          </StatusNote>
        )}
        {!status.readOnly && atCeiling && (
          <StatusNote tone="warning" className="border">
            {t("settings.limitReached")}
          </StatusNote>
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
                <span className="inline-flex items-center gap-1">
                  {u.used >= u.limit && (
                    <AlertTriangle aria-hidden className={`h-3.5 w-3.5 ${toneMark("warning")}`} />
                  )}
                  <span className={u.used >= u.limit ? "font-medium" : ""}>
                    {t("settings.usage", { used: u.used, limit: u.limit })}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <ExportList organizationId={organizationId} links={exportLinks} />
      </CardContent>
    </Card>
  );
}
