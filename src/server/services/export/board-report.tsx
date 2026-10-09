// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The board report as a PDF (owner's decision d12, 9 October 2026), in the
 * TODO.LAW print style of the "Inside the box" leaflets (owner's review,
 * 9 October 2026): Archivo Black display and Jost text, ink on white, a
 * steel-cyan accent, tracked uppercase labels, rounded content boxes with a
 * hairline border, a tinted rounded box for the DPO's comment, a header with
 * the wordmark and an accent rule, a hairline footer.
 *
 * Two to three pages, US Letter in English and A4 in Spanish. It prints the
 * words of src/lib/board-report-text.ts, the same as the page, so the two
 * agree; this file only lays them out. The header and footer are its own (the
 * shared ones are in English only).
 */

import React from "react";
import path from "node:path";
import { Document, Font, Page, Text, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import { brand } from "@/config/brand";
import type { BoardReportText, Row } from "@/lib/board-report-text";

// ── Fonts: the leaflets' own (SIL OFL, vendored in ./fonts) ─────────────
const fontsDir = path.join(process.cwd(), "src/server/services/export/fonts");
Font.register({
  family: "Jost",
  fonts: [
    { src: path.join(fontsDir, "Jost-Regular.ttf"), fontWeight: 400 },
    { src: path.join(fontsDir, "Jost-Medium.ttf"), fontWeight: 500 },
    { src: path.join(fontsDir, "Jost-SemiBold.ttf"), fontWeight: 600 },
    { src: path.join(fontsDir, "Jost-Bold.ttf"), fontWeight: 700 },
  ],
});
Font.register({ family: "Archivo Black", src: path.join(fontsDir, "ArchivoBlack-Regular.ttf") });
// No hyphenation, as in every other export (the same global rule as ./pdf-styles.tsx).
Font.registerHyphenationCallback((word) => [word]);

// ── Colours: the leaflets' tokens ───────────────────────────────────────
const INK = "#1a1a1a";
const MUTED = "#566065";
/** hsl(195, 53%, 56%) */
const ACCENT = "#53acca";
/** hsl(195, 62%, 29%) */
const ACCENT_DEEP = "#1c6178";
const HAIR = "#e0e5e7";
/** The accent at 9% on white. */
const TINT = "#f0f8fa";
/** The accent's own hairline inside a tinted box. */
const TINT_HAIR = "#d3e7ee";

const RADIUS = 12;

/**
 * Lets a long unbroken word (an e-mail address as an owner's name) wrap
 * inside its box instead of running out of it. The shared stylesheet turns
 * hyphenation off for every word.
 */
const breakLong = (word: string) => (word.length > 16 ? (word.match(/[^-.@_]+[-.@_]?|[-.@_]/g) ?? [word]) : [word]);

const label: Style = {
  fontFamily: "Jost",
  fontSize: 7.6,
  fontWeight: 700,
  letterSpacing: 1.4,
  textTransform: "uppercase",
  color: ACCENT_DEEP,
};

function Box({ index, title, children, style }: { index: string; title: string; children: React.ReactNode; style?: Style }) {
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: HAIR,
        borderRadius: RADIUS,
        paddingTop: 11,
        paddingBottom: 11,
        paddingHorizontal: 14,
        ...style,
      }}
    >
      <Text style={{ fontSize: 11.5, fontWeight: 600, color: INK, marginBottom: 5 }}>
        <Text style={{ color: ACCENT_DEEP, fontWeight: 700 }}>{index}</Text>
        {"  "}
        {title}
      </Text>
      {children}
    </View>
  );
}

/**
 * Label and value on one line. `numeric`: a figure at the right. `wide`: a
 * phrase in its own column (the documents not ready and what they need).
 */
function Rows({ rows, numeric = false, wide = false }: { rows: Row[]; numeric?: boolean; wide?: boolean }) {
  return (
    <View>
      {rows.map((row, i) => (
        <View
          key={i}
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            paddingVertical: 3.2,
            borderTopWidth: i === 0 ? 0 : 0.75,
            borderTopColor: HAIR,
          }}
        >
          <Text style={{ flex: 1, paddingRight: 8, color: MUTED }} hyphenationCallback={breakLong}>
            {row.label}
          </Text>
          <Text
            style={
              numeric
                ? { fontWeight: 600, color: INK }
                : wide
                  ? { flex: 1.15, fontWeight: 500, color: INK }
                  : { fontWeight: 500, color: INK, textAlign: "right" }
            }
            hyphenationCallback={breakLong}
          >
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Table({ headers, rows, widths }: { headers: string[]; rows: string[][]; widths: number[] }) {
  return (
    <View>
      <View style={{ flexDirection: "row", paddingBottom: 4 }}>
        {headers.map((h, i) => (
          <Text key={i} style={{ ...label, letterSpacing: 0.6, flex: widths[i], paddingRight: 6 }}>
            {h}
          </Text>
        ))}
      </View>
      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: "row", paddingVertical: 4.5, borderTopWidth: 0.75, borderTopColor: HAIR }}>
          {row.map((cell, ci) => (
            <Text
              key={ci}
              style={{ flex: widths[ci], paddingRight: 8, color: ci === 0 ? INK : MUTED, fontWeight: ci === 0 ? 500 : 400 }}
              hyphenationCallback={breakLong}
            >
              {cell}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <Text style={{ fontSize: 8, color: MUTED, marginTop: 6 }}>{children}</Text>;
}

const GAP = 10;

/** Two boxes side by side (one alone spans the width); kept together on a page. */
function BoxRow({ children }: { children: React.ReactNode[] }) {
  const boxes = children.filter(Boolean);
  return (
    <View style={{ flexDirection: "row", marginTop: GAP }} wrap={false}>
      {boxes.map((child, i) => (
        <View key={i} style={{ flex: 1, marginLeft: i === 0 ? 0 : GAP }}>
          {child}
        </View>
      ))}
    </View>
  );
}

export function BoardReportDocument({
  text,
  locale,
  pageLabel,
  preparedWith,
}: {
  text: BoardReportText;
  locale: string;
  /** "Page {page} of {total}" with the numbers filled in. */
  pageLabel: (page: number, total: number) => string;
  preparedWith: string;
}) {
  const t = text;

  // The half-width boxes, in reading order, paired two by two.
  const halves: React.ReactElement[] = [
    <Box key="programme" index="" title={t.programme.title}>
      <Text style={{ fontSize: 15, fontWeight: 600, color: INK }}>{t.programme.figure}</Text>
      {t.programme.parts ? <Text style={{ color: MUTED, marginTop: 1, marginBottom: 6 }}>{t.programme.parts}</Text> : <View style={{ height: 6 }} />}
      <Rows rows={t.programme.areas} />
    </Box>,
    <Box key="documents" index="" title={t.documents.title}>
      <Text style={{ fontSize: 11, fontWeight: 600, color: INK, marginBottom: 6 }}>{t.documents.line}</Text>
      <Text style={label}>{t.documents.readyTitle}</Text>
      <Text style={{ marginTop: 3, marginBottom: 8, color: INK }}>
        {t.documents.ready.length > 0 ? t.documents.ready.join(" · ") : t.documents.noneReady}
      </Text>
      <Text style={{ ...label, marginBottom: 2 }}>{t.documents.missingTitle}</Text>
      {t.documents.missing.length > 0 ? <Rows rows={t.documents.missing} wide /> : <Text>{t.documents.noneMissing}</Text>}
    </Box>,
    <Box key="incidents" index="" title={t.incidents.title}>
      <Rows rows={t.incidents.rows} numeric />
    </Box>,
    ...(t.rights
      ? [
          <Box key="rights" index="" title={t.rights.title}>
            <Rows rows={t.rights.rows} numeric />
          </Box>,
        ]
      : []),
    <Box key="vendors" index="" title={t.vendors.title}>
      <Rows rows={t.vendors.rows} numeric />
      {t.vendors.note && <Note>{t.vendors.note}</Note>}
    </Box>,
    <Box key="assessments" index="" title={t.assessments.title}>
      <Table headers={t.assessments.headers} widths={[1.5, 1, 1]} rows={t.assessments.rows} />
    </Box>,
  ];
  // Number the boxes in reading order: 01, 02, ...
  let n = 0;
  const ix = () => String(++n).padStart(2, "0");
  const numbered = halves.map((box) => React.cloneElement(box as React.ReactElement<{ index: string }>, { index: ix() }));
  const pairs: React.ReactElement[][] = [];
  for (let i = 0; i < numbered.length; i += 2) pairs.push(numbered.slice(i, i + 2));
  const risksIx = ix();
  const actionsIx = ix();

  return (
    <Document language={locale} title={`${t.title}: ${t.organization}`} author={t.organization} creator={brand.name}>
      <Page
        size={locale === "en" ? "LETTER" : "A4"}
        style={{
          fontFamily: "Jost",
          fontSize: 9.5,
          color: INK,
          paddingTop: 92,
          paddingBottom: 76,
          paddingHorizontal: 50,
          backgroundColor: "#ffffff",
        }}
        wrap
      >
        {/* Header: wordmark, the report's name and the page, the accent rule. */}
        <View style={{ position: "absolute", top: 40, left: 50, right: 50 }} fixed>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", paddingBottom: 9 }}>
            <Text>
              <Text style={{ fontFamily: "Archivo Black", fontSize: 11, color: INK }}>{brand.companyName}</Text>
              <Text style={{ fontSize: 8.5, fontWeight: 600, letterSpacing: 1.6, color: MUTED }}>{`  ${brand.nameUppercase}`}</Text>
            </Text>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontSize: 8, fontWeight: 600, letterSpacing: 1.6, textTransform: "uppercase", color: INK }}>{t.title}</Text>
              <Text
                style={{ fontSize: 8, fontWeight: 500, letterSpacing: 1.1, textTransform: "uppercase", color: ACCENT_DEEP, marginTop: 2 }}
                render={({ pageNumber, totalPages }) => pageLabel(pageNumber, totalPages)}
              />
            </View>
          </View>
          <View style={{ height: 3.5, backgroundColor: ACCENT, borderRadius: 2 }} />
        </View>

        {/* The name block and the period. */}
        <View style={{ marginTop: 6 }}>
          <Text style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2.4, textTransform: "uppercase", color: ACCENT_DEEP }}>
            {t.organization}
          </Text>
          <Text style={{ fontFamily: "Archivo Black", fontSize: 26, lineHeight: 1.05, textTransform: "uppercase", color: INK, marginTop: 4 }}>
            {t.title}
          </Text>
          <Text style={{ fontSize: 12.5, fontWeight: 500, color: INK, marginTop: 8 }}>{t.periodLine}</Text>
          <Text style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>{t.generatedLine}</Text>
          <Text style={{ fontSize: 8.5, color: MUTED, marginTop: 6 }}>{t.scopeNote}</Text>
        </View>

        {pairs.map((pair, i) => (
          <BoxRow key={i}>{pair}</BoxRow>
        ))}

        <View style={{ marginTop: GAP }} wrap={false}>
          <Box index={risksIx} title={t.risks.title}>
            {t.risks.items.length > 0 ? (
              t.risks.items.map((item, i) => (
                <View key={i} style={{ flexDirection: "row", paddingVertical: 3.5, borderTopWidth: i === 0 ? 0 : 0.75, borderTopColor: HAIR }}>
                  <Text style={{ width: 16, fontWeight: 700, color: ACCENT_DEEP }}>{`${i + 1}.`}</Text>
                  <Text style={{ flex: 1, color: INK }}>{item}</Text>
                </View>
              ))
            ) : (
              <Text style={{ color: MUTED }}>{t.risks.empty}</Text>
            )}
          </Box>
        </View>

        <View style={{ marginTop: GAP }} wrap={false}>
          <Box index={actionsIx} title={t.actions.title}>
            {t.actions.rows.length > 0 ? (
              <Table
                headers={t.actions.headers}
                widths={[2, 1.6, 1.4]}
                rows={t.actions.rows.map((r, i) => [`${i + 1}. ${r.action}`, r.owner, r.date])}
              />
            ) : (
              <Text style={{ color: MUTED }}>{t.actions.empty}</Text>
            )}
            <Note>{t.actions.note}</Note>
          </Box>
        </View>

        {/* The DPO's comment, in the leaflets' tinted box. */}
        <View style={{ marginTop: GAP, backgroundColor: TINT, borderRadius: RADIUS, paddingVertical: 13, paddingHorizontal: 17 }} wrap={false}>
          <Text style={label}>{t.comment.title}</Text>
          <Text style={{ fontSize: 10.2, fontWeight: 500, color: t.comment.text ? INK : MUTED, marginTop: 5 }}>
            {t.comment.text ?? t.comment.none}
          </Text>
          {t.comment.saved && (
            <Text style={{ fontSize: 8, color: MUTED, marginTop: 7, paddingTop: 5, borderTopWidth: 0.75, borderTopColor: TINT_HAIR }}>
              {t.comment.saved}
            </Text>
          )}
        </View>

        {/* Footer: a hairline, the organisation and the disclaimer, the maker. */}
        <View
          style={{
            position: "absolute",
            bottom: 28,
            left: 50,
            right: 50,
            borderTopWidth: 1,
            borderTopColor: HAIR,
            paddingTop: 8,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
          fixed
        >
          <View style={{ flex: 1, paddingRight: 18 }}>
            <Text style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.5, color: INK }}>{t.organization}</Text>
            <Text style={{ fontSize: 7.6, color: MUTED, marginTop: 2 }}>{t.disclaimer}</Text>
          </View>
          <Text style={{ fontSize: 8, fontWeight: 600, color: INK }}>{preparedWith}</Text>
        </View>
      </Page>
    </Document>
  );
}
