// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AlertTriangle, Building2, Database, FileText } from "lucide-react";
import { DocSection } from "@/components/docs/doc-section";
import { DocNavFooter } from "@/components/docs/doc-nav-footer";
import { RolePermissions } from "@/components/docs/role-permissions";
import { isDsarModuleEnabled } from "@/config/features";

/**
 * Getting started: what the community edition holds, one link per module,
 * and the roles.
 */
export default async function DocsGettingStartedPage() {
  const t = await getTranslations("docs.gettingStarted");
  const toc = await getTranslations("docs.toc");
  const modules = [
    { href: "/privacy/docs/data-inventory", key: "dataInventory", icon: Database },
    ...(isDsarModuleEnabled() ? [{ href: "/privacy/docs/dsar", key: "dsar", icon: FileText }] : []),
    { href: "/privacy/docs/incidents", key: "incidents", icon: AlertTriangle },
    { href: "/privacy/docs/vendors", key: "vendors", icon: Building2 },
  ] as const;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-1">{t("communitySubtitle")}</p>
      </div>

      <DocSection id="modules" title={t("modulesTitle")} description={t("modulesDescription")}>
        <ul className="grid gap-3 sm:grid-cols-2">
          {modules.map((m) => {
            const Icon = m.icon;
            return (
              <li key={m.href}>
                <Link href={m.href} className="flex items-start gap-3 rounded-lg border p-3 hover:bg-muted">
                  <span className="rounded-md bg-primary/10 p-2">
                    <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                  </span>
                  <span className="font-medium text-sm">{toc(`${m.key}.label`)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </DocSection>

      <DocSection id="roles" title={t("roles.title")} description={t("roles.description")}>
        <RolePermissions />
      </DocSection>

      <DocNavFooter next={{ title: toc("dataInventory.label"), href: "/privacy/docs/data-inventory" }} />
    </div>
  );
}
