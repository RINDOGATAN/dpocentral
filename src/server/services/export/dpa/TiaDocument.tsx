// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * PDF rendering for the standalone Transfer Impact Assessment (Annex IV
 * reproduced without modification, preceded by its identification header —
 * INSTRUCTIONS.md §8).
 */

import React from "react";
import { Text, Document, StyleSheet, View } from "@react-pdf/renderer";
import "../design-system/fonts";
import { PageFrame, tokens } from "../design-system";
import { Paragraphs } from "./DpaDocument";
import type { TiaDocumentModel } from "@/lib/dpa-engine";

const s = StyleSheet.create({
  title: {
    fontSize: tokens.typography.size.h2,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.color.brand.navyDeep,
    marginBottom: tokens.space[5],
  },
  headerBlock: {
    borderLeftWidth: 2,
    borderLeftColor: tokens.color.brand.tealAccent,
    paddingLeft: tokens.space[4],
    marginBottom: tokens.space[6],
  },
  headerLine: {
    fontSize: tokens.typography.size.body,
    lineHeight: tokens.typography.lineHeight.relaxed,
    color: tokens.color.text.secondary,
    marginBottom: tokens.space[2],
  },
  annexTitle: {
    fontSize: tokens.typography.size.h3,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.color.brand.navyDeep,
    marginBottom: tokens.space[4],
  },
});

export function TiaDocument({
  model,
  orgName,
  date,
}: {
  model: TiaDocumentModel;
  orgName: string;
  /** Production date shown in the page chrome. */
  date: string;
}) {
  return (
    <Document
      title={model.title}
      author={orgName}
      language={model.language === "es" ? "es-ES" : "en-US"}
    >
      <PageFrame eyebrow={model.title} orgName={orgName} date={date}>
        <Text style={s.title}>{model.title}</Text>
        <View style={s.headerBlock}>
          {model.header.map((line, i) => (
            <Text key={i} style={s.headerLine}>
              {line}
            </Text>
          ))}
        </View>
        <Text style={s.annexTitle}>{model.annexTitle}</Text>
        <Paragraphs text={model.body} />
      </PageFrame>
    </Document>
  );
}
