"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The overview: one card per module with its figures and a link to it.
 */

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Database, FileText, ShieldAlert, Truck, UserCheck, type LucideIcon } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { PageHeader } from "@/components/privacy/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { isDsarModuleEnabled } from "@/config/features";

interface ModuleCard {
  href: string;
  title: string;
  figure: number | undefined;
  line: string;
  icon: LucideIcon;
}

export default function PrivacyDashboardPage() {
  const { organization } = useOrganization();
  const tPages = useTranslations("pages");
  const tDash = useTranslations("dashboard");
  const t = useTranslations("overview");
  const { data: stats } = trpc.organization.getDashboardStats.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id }
  );

  const cards: ModuleCard[] = [
    {
      href: "/privacy/data-inventory",
      title: tPages("dataInventory.title"),
      figure: stats?.totalAssets,
      line: t("systems", { count: stats?.totalAssets ?? 0 }),
      icon: Database,
    },
    {
      href: "/privacy/data-inventory/processing-activities",
      title: tPages("processingActivities.title"),
      figure: stats?.totalActivities,
      line: t("activities", { count: stats?.totalActivities ?? 0 }),
      icon: FileText,
    },
    ...(isDsarModuleEnabled()
      ? [
          {
            href: "/privacy/dsar",
            title: tPages("dsar.title"),
            figure: stats?.openDSARs,
            line: t("openRequests", { count: stats?.openDSARs ?? 0, overdue: stats?.overdueDSARs ?? 0 }),
            icon: UserCheck,
          },
        ]
      : []),
    {
      href: "/privacy/vendors",
      title: tPages("vendors.title"),
      figure: stats?.totalVendors,
      line: t("vendors", { count: stats?.totalVendors ?? 0, active: stats?.activeVendors ?? 0 }),
      icon: Truck,
    },
    {
      href: "/privacy/incidents",
      title: tPages("incidents.title"),
      figure: stats?.openIncidents,
      line: t("openIncidents", { count: stats?.openIncidents ?? 0 }),
      icon: ShieldAlert,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={tDash("overview")} description={organization?.name} />
      <ul className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3" data-testid="overview-cards">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <li key={card.href}>
              <Link href={card.href} className="block h-full">
                <Card className="h-full hover:border-primary/60 transition-colors">
                  <CardContent className="p-5 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Icon className="w-4 h-4 text-primary" aria-hidden="true" />
                      {card.title}
                    </div>
                    <p className="text-3xl font-semibold tabular-nums">{card.figure ?? 0}</p>
                    <p className="text-sm text-muted-foreground">{card.line}</p>
                  </CardContent>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
