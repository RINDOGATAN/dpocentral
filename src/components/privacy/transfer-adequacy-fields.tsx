"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The adequacy part of a transfer form:
 *   - the destination's name and what Chapter V says about it (within the
 *     EEA, a full adequacy decision, a partial one, or none);
 *   - for a partial decision (US under the EU-US Data Privacy Framework,
 *     Canada under PIPEDA), the question the decision turns on, with a
 *     reference field (for example the DPF list entry that was checked).
 * Unanswered, a partial decision does not cover the transfer, and the other
 * safeguard (SCCs with a transfer impact assessment, for instance) applies.
 */

import { useLocale, useTranslations } from "next-intl";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusNote } from "@/components/ui/status-note";
import { canonicalCountryCode, countryName, isIsoCountryCode } from "@/lib/country-code";
import { adequacyCoverage, getAdequacyDecision } from "@/config/transfer-compliance-rules";

export interface AdequacyScopeValue {
  adequacyScopeConfirmed: boolean | null;
  adequacyScopeReference: string;
}

export function TransferAdequacyFields({
  country,
  value,
  onChange,
  idPrefix = "transfer",
}: {
  country: string;
  value: AdequacyScopeValue;
  onChange: (next: AdequacyScopeValue) => void;
  idPrefix?: string;
}) {
  const t = useTranslations("pages.transfers.adequacy");
  const locale = useLocale();
  const code = canonicalCountryCode(country);
  if (!isIsoCountryCode(code)) return null;

  const decision = getAdequacyDecision(code);
  const coverage = adequacyCoverage(code, value.adequacyScopeConfirmed);
  const name = countryName(code, locale);

  if (coverage === "EEA") {
    return (
      <p className="text-xs text-muted-foreground" data-testid="adequacy-hint" data-coverage="EEA">
        {t("withinEea", { country: name })}
      </p>
    );
  }
  if (coverage === "NONE") {
    return (
      <p className="text-xs text-muted-foreground" data-testid="adequacy-hint" data-coverage="NONE">
        {t("none", { country: name })}
      </p>
    );
  }
  if (coverage === "FULL") {
    return (
      <p className="text-xs text-muted-foreground" data-testid="adequacy-hint" data-coverage="FULL">
        {t("full", { country: name })}
      </p>
    );
  }

  // Partial decision: the question it turns on.
  const scope = decision?.partialScope ?? "DPF";
  return (
    <div className="space-y-2" data-testid="adequacy-hint" data-coverage={coverage}>
      <StatusNote tone={coverage === "PARTIAL_CONFIRMED" ? "success" : "warning"} title={t("partialTitle", { country: name })}>
        <p>{t(`partialBody.${scope}`)}</p>
      </StatusNote>
      <div className="flex items-start gap-2">
        <Checkbox
          id={`${idPrefix}-scope`}
          checked={value.adequacyScopeConfirmed === true}
          onCheckedChange={(checked) =>
            onChange({ ...value, adequacyScopeConfirmed: checked === true ? true : false })
          }
          data-testid="adequacy-scope-confirmed"
        />
        <Label htmlFor={`${idPrefix}-scope`} className="text-sm font-normal leading-snug">
          {t(`scopeQuestion.${scope}`)}
        </Label>
      </div>
      {value.adequacyScopeConfirmed === true && (
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-scope-ref`} className="text-xs">
            {t(`scopeReference.${scope}`)}
          </Label>
          <Input
            id={`${idPrefix}-scope-ref`}
            value={value.adequacyScopeReference}
            onChange={(e) => onChange({ ...value, adequacyScopeReference: e.target.value })}
            placeholder={t(`scopeReferencePlaceholder.${scope}`)}
            maxLength={2000}
          />
        </div>
      )}
    </div>
  );
}
