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
import { Circle, Document, Font, Page, Path, Svg, Text, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import { brand } from "@/config/brand";
import type { BoardReportText, Kpi, Row } from "@/lib/board-report-text";

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

/** The one warning tone: text #92400e (7.0:1 on white) with a #d97706 mark, as the other reports. */
const WARN_TEXT = "#92400e";
const WARN_MARK = "#d97706";

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

// ── "At a glance": the main figures, presiding over the report ──────────

/** The SVG path of an arc on a circle, from 12 o'clock, clockwise, `ratio` of the way round. */
function arcPath(cx: number, cy: number, r: number, ratio: number): string {
  const a = Math.min(0.9999, Math.max(0, ratio)) * 2 * Math.PI;
  const x = cx + r * Math.sin(a);
  const y = cy - r * Math.cos(a);
  return `M ${cx} ${cy - r} A ${r} ${r} 0 ${a > Math.PI ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)}`;
}

function HeroRing({ kpi }: { kpi: Kpi }) {
  const size = 76;
  const stroke = 8;
  const r = (size - stroke) / 2;
  return (
    <View style={{ width: 96, alignItems: "center" }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={HAIR} strokeWidth={stroke} fill="none" />
          {(kpi.ratio ?? 0) > 0 && (
            <Path d={arcPath(size / 2, size / 2, r, kpi.ratio ?? 0)} stroke={ACCENT} strokeWidth={stroke} strokeLinecap="round" fill="none" />
          )}
        </Svg>
        <View style={{ position: "absolute", top: 0, left: 0, width: size, height: size, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontFamily: "Archivo Black", fontSize: 22, color: INK }}>{kpi.value}</Text>
          {kpi.of && <Text style={{ fontSize: 8.5, fontWeight: 500, color: MUTED, marginTop: -2 }}>{kpi.of}</Text>}
        </View>
      </View>
      <Text style={{ fontSize: 8.5, fontWeight: 600, color: INK, marginTop: 5, textAlign: "center" }}>{kpi.label}</Text>
    </View>
  );
}

function Tile({ kpi }: { kpi: Kpi }) {
  return (
    <View style={{ paddingVertical: 2 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
        <Text style={{ fontFamily: "Archivo Black", fontSize: 18, color: INK, lineHeight: 1 }}>{kpi.value}</Text>
        {kpi.of && <Text style={{ fontSize: 9, fontWeight: 500, color: MUTED, marginLeft: 4, marginBottom: 1 }}>{kpi.of}</Text>}
      </View>
      <Text style={{ fontSize: 8, color: MUTED, marginTop: 3 }}>{kpi.label}</Text>
      {kpi.ratio !== null && (
        <View style={{ height: 4, backgroundColor: HAIR, borderRadius: 2, marginTop: 5 }}>
          <View style={{ height: 4, width: `${Math.round(kpi.ratio * 100)}%`, backgroundColor: ACCENT, borderRadius: 2 }} />
        </View>
      )}
      {kpi.flag && (
        <View style={{ flexDirection: "row", alignItems: "flex-start", marginTop: 5 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: WARN_MARK, marginRight: 4, marginTop: 2.5 }} />
          <Text style={{ flex: 1, fontSize: 7.6, fontWeight: 600, color: WARN_TEXT }}>{kpi.flag}</Text>
        </View>
      )}
    </View>
  );
}

function KpiStrip({ kpis }: { kpis: BoardReportText["kpis"] }) {
  return (
    <View style={{ marginTop: 12, borderWidth: 1, borderColor: HAIR, borderRadius: RADIUS, paddingVertical: 11, paddingHorizontal: 14 }} wrap={false}>
      <Text style={{ ...label, marginBottom: 6 }}>{kpis.title}</Text>
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <HeroRing kpi={kpis.hero} />
        {kpis.tiles.map((kpi) => (
          <View key={kpi.id} style={{ flex: 1, marginLeft: 10, paddingLeft: 10, borderLeftWidth: 1, borderLeftColor: HAIR, alignSelf: "stretch" }}>
            <Tile kpi={kpi} />
          </View>
        ))}
      </View>
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
        <View style={{ marginTop: 2 }}>
          <Text style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2.4, textTransform: "uppercase", color: ACCENT_DEEP }}>
            {t.organization}
          </Text>
          <Text style={{ fontFamily: "Archivo Black", fontSize: 24, lineHeight: 1.05, textTransform: "uppercase", color: INK, marginTop: 4 }}>
            {t.title}
          </Text>
          <Text style={{ fontSize: 12, fontWeight: 500, color: INK, marginTop: 6 }}>{t.periodLine}</Text>
          <Text style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>{t.generatedLine}</Text>
          <Text style={{ fontSize: 8.5, color: MUTED, marginTop: 4 }}>{t.scopeNote}</Text>
        </View>

        <KpiStrip kpis={t.kpis} />

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
