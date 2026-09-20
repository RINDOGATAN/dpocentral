// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import React from "react";
import { View, Text } from "@react-pdf/renderer";
import {
  ContentPage,
  DataTable,
  MetadataBlock,
  StatCard,
  s,
  PDF_COLORS,
} from "./pdf-styles";
import type { PdfT } from "./privacy-program/data-mapping";
import { tx, type HealthAdtechResult, type Lang } from "@/lib/health-adtech/results";

/**
 * Result pages of the "Health data in advertising" assessment: the table by
 * jurisdiction (consent model, obligations with sources, findings), the
 * five-factor band, the mitigation choice and decision, and the signature
 * block. `t` is scoped to the `healthAdtechReport` messages.
 */
export function HealthAdtechPages({
  result,
  lang,
  t,
  title,
  orgName,
  date,
  draftLabel,
}: {
  result: HealthAdtechResult;
  lang: Lang;
  t: PdfT;
  title: string;
  orgName: string;
  date: string;
  /** Marks these pages a draft, like every other page of the document. */
  draftLabel?: string;
}) {
  const none = t("notRecorded");
  const severity = (key: string) => t(`severity.${key}`);

  const rows = result.jurisdictions.map((j) => [
    tx(j.name, lang),
    tx(j.consentModel, lang),
    j.obligations
      .map(
        (o) =>
          `• ${tx(o.text, lang)}${o.toVerify ? ` ${t("toVerify")}` : ""}\n  ${t("source")}: ${tx(o.source, lang)}`
      )
      .join("\n"),
    j.findings.length
      ? j.findings.map((f) => `• ${severity(f.severity)}: ${tx(f.text, lang)}`).join("\n")
      : t("noFindings"),
  ]);

  return (
    <>
      <ContentPage title={title} orgName={orgName} date={date} draftLabel={draftLabel}>
        <Text style={s.sectionTitle}>{t("title")}</Text>
        <Text style={s.paragraph}>{t("subtitle")}</Text>

        {result.blocking && (
          <View
            style={[s.calloutBox, { backgroundColor: "#fef2f2", borderColor: "#fecaca" }]}
          >
            <Text style={[s.calloutTitle, { color: "#b91c1c", marginBottom: 0 }]}>
              {t("blockingSummary")}
            </Text>
          </View>
        )}

        {rows.length === 0 ? (
          <Text style={s.paragraph}>{t("noJurisdictions")}</Text>
        ) : (
          <DataTable
            headers={[t("jurisdiction"), t("consentModel"), t("obligations"), t("findings")]}
            colWidths={[1.3, 1.8, 3.4, 2.5]}
            rows={rows}
          />
        )}
      </ContentPage>

      <ContentPage title={title} orgName={orgName} date={date} draftLabel={draftLabel}>
        <Text style={s.sectionTitle}>{t("fiveFactorTitle")}</Text>
        <View style={s.statsGrid}>
          <StatCard
            value={
              result.fiveFactor.band
                ? `${result.fiveFactor.score} / ${result.fiveFactor.max}`
                : `${result.fiveFactor.answered} / 5`
            }
            label={
              result.fiveFactor.band
                ? t("scoreLabel")
                : t("fiveFactorPending", { answered: result.fiveFactor.answered })
            }
          />
        </View>
        {result.fiveFactor.bandLabel && (
          <View style={s.calloutBox}>
            <Text style={[s.calloutTitle, { marginBottom: 0 }]}>
              {tx(result.fiveFactor.bandLabel, lang)}
            </Text>
          </View>
        )}

        <Text style={[s.sectionTitle, { marginTop: 16 }]}>{t("decisionTitle")}</Text>
        <MetadataBlock
          items={[
            { label: t("mitigation"), value: tx(result.mitigation, lang) || none },
            { label: t("residualRisk"), value: tx(result.residualRisk, lang) || none },
            { label: t("determination"), value: tx(result.determination, lang) || none },
            ...(result.priorConsultation
              ? [{ label: t("priorConsultation"), value: tx(result.priorConsultation.text, lang) }]
              : []),
          ]}
        />

        <View wrap={false} style={{ marginTop: 16 }}>
          <Text style={s.sectionTitle}>{t("signatureTitle")}</Text>
          <MetadataBlock
            items={[
              { label: t("signer"), value: result.signature.signer ?? none },
              { label: t("signedOn"), value: result.signature.date ?? none },
              { label: t("reviewDate"), value: result.signature.reviewDate ?? none },
            ]}
          />
          <View
            style={{
              marginTop: 36,
              width: 220,
              borderTopWidth: 1,
              borderTopColor: PDF_COLORS.DARK,
              paddingTop: 4,
            }}
          >
            <Text style={{ fontSize: 8, color: PDF_COLORS.MUTED }}>
              {t("signatureLine")}
              {result.signature.signer ? `: ${result.signature.signer}` : ""}
            </Text>
          </View>
        </View>
      </ContentPage>
    </>
  );
}
