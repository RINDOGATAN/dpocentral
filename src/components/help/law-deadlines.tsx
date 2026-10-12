"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The help panel's "Deadlines of your laws" on rights-request pages: one line
 * per law the organisation declared, with the answer period DPO Central applies
 * to a new request under it (src/server/services/privacy/slaCalculator.ts,
 * dsarDeadlineRuleFor), and, where the CCPA is declared, its own clocks for
 * opt-out and limit requests and for confirming receipt. The extension is
 * named only where the catalog records one; nothing is said where it does not.
 */

import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { dsarDeadlineRuleFor } from "@/server/services/privacy/slaCalculator";
import { JURISDICTION_CATALOG } from "@/config/jurisdiction-catalog";
import { JURISDICTION_CATALOG_ES } from "@/config/jurisdiction-catalog-es";
import type { DeadlinePeriod } from "@/lib/dsar-deadline";

/** The short name of a law in the reader's language ("CCPA/CPRA", "RGPD"). */
export function lawShortName(code: string, locale: "en" | "es"): string {
  const es = locale === "es" ? JURISDICTION_CATALOG_ES[code]?.shortName : undefined;
  return es ?? JURISDICTION_CATALOG.find((j) => j.code === code)?.shortName ?? code;
}

export function LawDeadlines({ locale }: { locale: "en" | "es" }) {
  const t = useTranslations("help.deadlines");
  const { organization } = useOrganization();
  const { data, isLoading } = trpc.regulations.listApplied.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id }
  );

  const period = (p: DeadlinePeriod) =>
    p.unit === "months"
      ? t("months", { count: p.amount })
      : p.unit === "businessDays"
        ? t("businessDays", { count: p.amount })
        : t("days", { count: p.amount });

  if (isLoading) return <p className="text-muted-foreground">{t("loading")}</p>;

  // Rights-request deadlines only: AI-governance entries carry none.
  const laws = (data?.jurisdictions ?? []).filter((j) => j.code !== "EU_AI_ACT");
  if (laws.length === 0) {
    return <p className="text-muted-foreground leading-relaxed" data-testid="help-deadlines-none">{t("none")}</p>;
  }

  const hasCcpa = laws.some((j) => j.code === "CCPA");
  return (
    <ul className="flex flex-col gap-1.5 text-muted-foreground leading-relaxed" data-testid="help-deadlines">
      {laws.map((j) => {
        const rule = dsarDeadlineRuleFor(j.code, j.dsarDeadlineDays);
        const law = lawShortName(j.code, locale);
        return (
          <li key={j.id}>
            {rule.extension
              ? t("periodWithExtension", { law, period: period(rule.deadline), extension: period(rule.extension) })
              : t("period", { law, period: period(rule.deadline) })}
          </li>
        );
      })}
      {hasCcpa && <li>{t("ccpaConfirm")}</li>}
      {hasCcpa && <li>{t("ccpaFifteen")}</li>}
      {laws.length > 1 && <li>{t("strictest")}</li>}
    </ul>
  );
}
