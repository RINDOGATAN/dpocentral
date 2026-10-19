"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The data map as a page of its own (also a tab of Data inventory): every
 * system, the flows between them, the vendors no system stands for, and the
 * transfers outside the EEA with their safeguard and status.
 */

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Globe, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/privacy/page-header";
import { DataFlowVisualization } from "@/components/privacy/data-flow";
import { useOrganization } from "@/lib/organization-context";

export default function DataMapPage() {
  const { organization } = useOrganization();
  const t = useTranslations("pages.dataMap");
  return (
    <div className="space-y-4">
      <PageHeader
        icon={Network}
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Link href="/privacy/transfers">
            <Button variant="outline">
              <Globe className="w-4 h-4 mr-2" aria-hidden />
              {t("transfers")}
            </Button>
          </Link>
        }
      />
      {organization?.id && (
        <DataFlowVisualization mode="all" organizationId={organization.id} height="640px" />
      )}
    </div>
  );
}
