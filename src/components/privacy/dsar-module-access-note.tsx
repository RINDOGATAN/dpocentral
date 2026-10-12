"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useLocale, useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { plansUrl } from "@/lib/hosted";
import { StatusNote } from "@/components/ui/status-note";
import { usePriceInSentence } from "@/components/region-provider";
import { DSAR_ADDON_MONTHLY_PRICE } from "@/lib/dsar-addon";

/**
 * Above every page of the rights-request module (hosted service only):
 *  - add-on not active on the paid plan: the price line and a link to the
 *    plans page; the requests already held stay readable below it;
 *  - pilot or add-on active: how many public-form requests are used, and
 *    that requests entered by staff do not count.
 * Nothing on the self-hosted kit (src/server/services/dsar/module.ts).
 */
export function DsarModuleAccessNote() {
  const t = useTranslations("dsarModule");
  const locale = useLocale();
  const price = usePriceInSentence();
  const { organization } = useOrganization();
  const { data: access } = trpc.dsar.moduleAccess.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id, refetchOnWindowFocus: false }
  );
  if (!access || access.gate === "open") return null;

  if (access.gate === "inactive") {
    return (
      <StatusNote tone="info" title={t("addOnTitle")} className="mb-6" data-testid="dsar-module-addon">
        {t("addOnBody", { price: price(DSAR_ADDON_MONTHLY_PRICE) })}{" "}
        <a className="underline underline-offset-4 text-primary" href={plansUrl(locale)}>
          {t("addOnLink")}
        </a>
      </StatusNote>
    );
  }

  const usage = t(access.period === "total" ? "pilotUsage" : "monthUsage", {
    used: Math.min(access.used, access.limit),
    limit: access.limit,
  });
  return (
    <p className="mb-6 text-sm text-muted-foreground" data-testid="dsar-module-usage">
      {usage} {access.remaining === 0 ? `${t("limitReached")} ` : ""}
      {t("staffNote")}
    </p>
  );
}

/**
 * False while the hosted paid plan has no rights-request add-on: the server
 * refuses new requests then (src/server/services/dsar/module.ts), so the
 * buttons that add one are not offered. True otherwise, and while loading.
 */
export function useDsarCanAddRequests(): boolean {
  const { organization } = useOrganization();
  const { data: access } = trpc.dsar.moduleAccess.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id, refetchOnWindowFocus: false }
  );
  return access?.gate !== "inactive";
}
