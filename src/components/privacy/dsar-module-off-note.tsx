"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { useOrganization } from "@/lib/organization-context";

/**
 * What a visitor sees where the rights-request module would have been, when it
 * is not part of this plan (NEXT_PUBLIC_DSAR_ENABLED=false,
 * src/config/features.ts). One neutral line, no price.
 */
export function DsarModuleOffNote({ children }: { children?: ReactNode }) {
  const t = useTranslations("dsarModule");
  return (
    <div className="text-center py-12 max-w-xl mx-auto" data-testid="dsar-module-off">
      <Info className="w-8 h-8 mx-auto mb-4 text-muted-foreground" aria-hidden="true" />
      <p className="font-medium">{t("off")}</p>
      {children}
    </div>
  );
}

/**
 * The same note inside the dashboard. An owner or admin of an organisation
 * that already holds rights-request records is also given the download of
 * those records (GET /api/export/rights-requests), so nothing is lost when the
 * module is switched off.
 */
export function DsarModuleOffDashboardNote() {
  const t = useTranslations("dsarModule");
  const { organization, organizations } = useOrganization();
  const role = organization
    ? (organizations.find((o) => o.id === organization.id) as { role?: string } | undefined)?.role
    : undefined;
  const isAdmin = role === "OWNER" || role === "ADMIN";
  return (
    <DsarModuleOffNote>
      {organization && isAdmin && (
        <p className="text-sm text-muted-foreground mt-4">
          {t("exportBody")}{" "}
          <a
            className="underline underline-offset-4 text-primary"
            href={`/api/export/rights-requests?organizationId=${encodeURIComponent(organization.id)}`}
          >
            {t("exportLink")}
          </a>
        </p>
      )}
    </DsarModuleOffNote>
  );
}
