"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useLocale, useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { brand } from "@/config/brand";
import { useChargeCurrency, usePriceInSentence } from "@/components/region-provider";
import { DSAR_VOLUME_UPGRADE_MONTHLY_PRICE, UPGRADED_PUBLIC_REQUESTS_PER_MONTH } from "@/lib/dsar-addon";

/**
 * Above every page of the rights-request module (hosted service only), and
 * only once the public form has received half of its monthly ceiling
 * (src/server/services/dsar/module.ts): one quiet line with the month's count,
 * what happens at the limit and, below the 1,000 ceiling, the volume upgrade
 * (its price in the currency the customer is charged in, and its payment link
 * when one is set; otherwise our address). Nothing below half the ceiling,
 * and nothing on the self-hosted kit.
 */
export function DsarModuleAccessNote() {
  const t = useTranslations("dsarModule");
  const locale = useLocale();
  const price = usePriceInSentence();
  const currency = useChargeCurrency();
  const { organization } = useOrganization();
  const { data: access } = trpc.dsar.moduleAccess.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id, refetchOnWindowFocus: false }
  );
  if (!access || access.gate === "open" || access.warningPercent === 0) return null;

  const resets = new Date(access.resetsAt).toLocaleDateString(locale.startsWith("es") ? "es-ES" : "en-US", {
    timeZone: "Europe/Madrid",
    day: "numeric",
    month: "long",
  });
  const usage = t("volumeUsage", { used: Math.min(access.used, access.limit), limit: access.limit, date: resets });
  const atLimit = access.remaining === 0;
  const link = access.upgrade ? access.upgrade[currency] : null;

  return (
    <p className="mb-6 text-sm text-muted-foreground" data-testid="dsar-module-usage">
      {usage} {atLimit ? `${t("limitReached")} ` : ""}
      {access.gate === "standard" ? (
        <>
          {t("volumeUpgrade", {
            upgraded: UPGRADED_PUBLIC_REQUESTS_PER_MONTH,
            price: price(DSAR_VOLUME_UPGRADE_MONTHLY_PRICE),
          })}{" "}
          {!access.canBuy ? (
            t("volumeUpgradeAskAdmin")
          ) : link ? (
            <a className="underline underline-offset-4 text-primary" href={link}>
              {t("volumeUpgradeLink")}
            </a>
          ) : (
            <a className="underline underline-offset-4 text-primary" href={`mailto:${brand.supportEmail}`}>
              {t("volumeUpgradeWrite", { email: brand.supportEmail })}
            </a>
          )}
          .
        </>
      ) : (
        t("volumeMore")
      )}{" "}
      {t("staffNote")}
    </p>
  );
}
