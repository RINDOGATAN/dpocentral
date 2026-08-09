// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * PDF rendering for the DPA document model produced by the dpa-engine.
 * Pure presentation: every string arrives assembled and interpolated; this
 * layer only lays out cover, articles, signature block and per-page annexes.
 */

import React from "react";
import { Document, View, Text, StyleSheet } from "@react-pdf/renderer";
import "../design-system/fonts";
import { CoverFrame, PageFrame, tokens } from "../design-system";
import type { DpaDocumentModel, DpaLang } from "@/lib/dpa-engine";

const s = StyleSheet.create({
  coverTitle: {
    fontSize: tokens.typography.size.h1,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.color.brand.navyDeep,
    letterSpacing: tokens.typography.letterSpacing.tight,
    lineHeight: tokens.typography.lineHeight.tight,
    marginTop: tokens.space[9],
    marginBottom: tokens.space[7],
  },
  coverPartyLabel: {
    fontSize: tokens.typography.size.caption,
    fontWeight: tokens.typography.weight.semibold,
    color: tokens.color.text.muted,
    textTransform: "uppercase",
    letterSpacing: tokens.typography.letterSpacing.caps,
    marginBottom: 2,
  },
  coverPartyName: {
    fontSize: tokens.typography.size.h3,
    fontWeight: tokens.typography.weight.medium,
    color: tokens.color.text.primary,
    marginBottom: tokens.space[5],
  },
  coverMeta: {
    fontSize: tokens.typography.size.body,
    color: tokens.color.text.secondary,
    marginBottom: tokens.space[2],
  },
  paragraph: {
    fontSize: tokens.typography.size.body,
    lineHeight: tokens.typography.lineHeight.relaxed,
    color: tokens.color.text.primary,
    marginBottom: tokens.space[3],
  },
  articleTitle: {
    fontSize: tokens.typography.size.h4,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.color.brand.navyDeep,
    marginTop: tokens.space[6],
    marginBottom: tokens.space[2],
  },
  definitionTerm: {
    fontWeight: tokens.typography.weight.semibold,
  },
  signature: {
    fontSize: tokens.typography.size.body,
    lineHeight: tokens.typography.lineHeight.relaxed,
    color: tokens.color.text.primary,
    marginTop: tokens.space[6],
  },
  annexTitle: {
    fontSize: tokens.typography.size.h3,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.color.brand.navyDeep,
    marginBottom: tokens.space[4],
  },
});

/** Render assembled text: blank-line-separated paragraphs, inner \n kept. */
export function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p, i) => (
          <Text key={i} style={s.paragraph}>
            {p}
          </Text>
        ))}
    </>
  );
}

const LABELS: Record<DpaLang, { definitions: string; article: string }> = {
  en: { definitions: "Definitions", article: "Article" },
  es: { definitions: "Definiciones", article: "Artículo" },
};

export function DpaDocument({
  model,
  orgName,
}: {
  model: DpaDocumentModel;
  orgName: string;
}) {
  const labels = LABELS[model.language];
  const date = model.cover.effectiveDate;
  // Continuous article numbering: Definitions is article 1, then every
  // article in assembly order (standard clauses, negotiated terms, the
  // governing-law article, general provisions, jurisdiction provision).
  let n = 1;

  return (
    <Document
      title={model.title}
      author={orgName}
      language={model.language === "es" ? "es-ES" : "en-US"}
    >
      <CoverFrame rightEyebrow={date}>
        <Text style={s.coverTitle}>{model.cover.title}</Text>
        <View>
          <Text style={s.coverPartyLabel}>{model.cover.partyALabel}</Text>
          <Text style={s.coverPartyName}>{model.cover.partyAName}</Text>
          <Text style={s.coverPartyLabel}>{model.cover.partyBLabel}</Text>
          <Text style={s.coverPartyName}>{model.cover.partyBName}</Text>
        </View>
        <Text style={s.coverMeta}>{date}</Text>
        <Text style={s.coverMeta}>{model.cover.governingLaw}</Text>
      </CoverFrame>

      <PageFrame eyebrow={model.title} orgName={orgName} date={date}>
        <Paragraphs text={model.preamble} />
        <Paragraphs text={model.background} />

        <Text style={s.articleTitle}>{`${n++}. ${labels.definitions}`}</Text>
        {model.definitions.map((d, i) => (
          <Text key={i} style={s.paragraph}>
            <Text style={s.definitionTerm}>{d.term}: </Text>
            {d.definition}
          </Text>
        ))}

        {model.articles.map((a, i) => (
          <View key={i}>
            <Text style={s.articleTitle}>{`${n++}. ${a.title}`}</Text>
            <Paragraphs text={a.body} />
          </View>
        ))}

        <Text style={s.signature}>{model.signatureBlock}</Text>
      </PageFrame>

      {model.annexes.map((annex, i) => (
        <PageFrame key={i} eyebrow={model.title} orgName={orgName} date={date}>
          <Text style={s.annexTitle}>{annex.title}</Text>
          <Paragraphs text={annex.body} />
        </PageFrame>
      ))}
    </Document>
  );
}
