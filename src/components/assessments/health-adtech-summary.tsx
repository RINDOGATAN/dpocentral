"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  computeHealthAdtechResult,
  sourcesAgeMonths,
  sourcesAreStale,
  SOURCES_CHECKED_LABEL,
  tx,
  type Finding,
  type Lang,
} from "@/lib/health-adtech/results";

const severityClass: Record<Finding["severity"], string> = {
  blocking: "border-destructive bg-destructive/10 text-destructive",
  gap: "border-amber-500 text-amber-700 dark:text-amber-400",
  note: "border-muted-foreground text-muted-foreground",
};

/**
 * Live result of the "Health data in advertising" assessment: the table by
 * jurisdiction, the five-factor band, the decision and the approval. The PDF
 * export prints the same result.
 */
export function HealthAdtechSummary({
  responses,
}: {
  responses: ReadonlyArray<{ questionId: string; response: unknown }>;
}) {
  const t = useTranslations("healthAdtechReport");
  const lang: Lang = useLocale() === "es" ? "es" : "en";
  const result = useMemo(() => computeHealthAdtechResult(responses), [responses]);
  const orNone = (value: string | null | undefined) => (value ? value : t("notRecorded"));

  return (
    <Card data-testid="health-adtech-summary">
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* How old the sources are, rather than a fixed date left to speak
            for itself. */}
        <p className="text-xs text-muted-foreground">
          {t("sourcesChecked", { date: SOURCES_CHECKED_LABEL[lang] })}
          {sourcesAreStale() && (
            <span className="text-amber-700 dark:text-amber-400">
              {" "}
              {t("sourcesStale", { months: sourcesAgeMonths() })}
            </span>
          )}
        </p>

        {result.blocking && (
          <p className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            {t("blockingSummary")}
          </p>
        )}

        {result.jurisdictions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noJurisdictions")}</p>
        ) : (
          <div className="flex flex-col gap-4">
            {result.jurisdictions.map((j) => (
              <div key={j.code} className="rounded-lg border p-4">
                <h4 className="font-medium">{tx(j.name, lang)}</h4>
                <p className="mt-1 text-sm">
                  <span className="text-muted-foreground">{t("consentModel")}: </span>
                  {tx(j.consentModel, lang)}
                </p>
                <p className="mt-3 text-xs font-medium uppercase text-muted-foreground">
                  {t("obligations")}
                </p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                  {j.obligations.map((o, i) => (
                    <li key={i}>
                      {tx(o.text, lang)}
                      {o.toVerify && <span className="text-amber-700 dark:text-amber-400"> {t("toVerify")}</span>}
                      <span className="block text-xs text-muted-foreground">
                        {t("source")}: {tx(o.source, lang)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs font-medium uppercase text-muted-foreground">
                  {t("findings")}
                </p>
                {j.findings.length === 0 ? (
                  <p className="mt-1 text-sm text-muted-foreground">{t("noFindings")}</p>
                ) : (
                  <ul className="mt-1 flex flex-col gap-1 text-sm">
                    {j.findings.map((f, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Badge variant="outline" className={`shrink-0 ${severityClass[f.severity]}`}>
                          {t(`severity.${f.severity}` as "severity.blocking" | "severity.gap" | "severity.note")}
                        </Badge>
                        <span>{tx(f.text, lang)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border p-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">{t("fiveFactorTitle")}</p>
            <p className="mt-2 font-medium">
              {result.fiveFactor.bandLabel
                ? tx(result.fiveFactor.bandLabel, lang)
                : t("fiveFactorPending", { answered: result.fiveFactor.answered })}
            </p>
            {result.fiveFactor.band && (
              <p className="text-sm text-muted-foreground">
                {t("fiveFactorScore", { score: result.fiveFactor.score, max: result.fiveFactor.max })}
              </p>
            )}
          </div>
          <div className="rounded-lg border p-4 text-sm">
            <p className="text-xs font-medium uppercase text-muted-foreground">{t("decisionTitle")}</p>
            <p className="mt-2"><span className="text-muted-foreground">{t("mitigation")}: </span>{orNone(tx(result.mitigation, lang))}</p>
            <p><span className="text-muted-foreground">{t("residualRisk")}: </span>{orNone(tx(result.residualRisk, lang))}</p>
            <p><span className="text-muted-foreground">{t("determination")}: </span>{orNone(tx(result.determination, lang))}</p>
            {result.priorConsultation && (
              <p><span className="text-muted-foreground">{t("priorConsultation")}: </span>{tx(result.priorConsultation.text, lang)}</p>
            )}
          </div>
          <div className="rounded-lg border p-4 text-sm">
            <p className="text-xs font-medium uppercase text-muted-foreground">{t("signatureTitle")}</p>
            <p className="mt-2"><span className="text-muted-foreground">{t("signer")}: </span>{orNone(result.signature.signer)}</p>
            <p><span className="text-muted-foreground">{t("signedOn")}: </span>{orNone(result.signature.date)}</p>
            <p><span className="text-muted-foreground">{t("reviewDate")}: </span>{orNone(result.signature.reviewDate)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
