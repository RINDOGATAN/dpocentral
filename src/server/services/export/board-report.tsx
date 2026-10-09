// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The board report as a PDF (owner's decision d12, 9 October 2026): two to
 * three A4 pages, no cover, in the reader's language. It prints the words of
 * src/lib/board-report-text.ts, the same as the page, so the two agree. The
 * header and footer are its own (the shared ones are in English only).
 */

import React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { PDF_COLORS, s } from "./pdf-styles";
import type { BoardReportText, Row } from "@/lib/board-report-text";

const { PRIMARY, DARK, MUTED, BORDER, LIGHT_BG } = PDF_COLORS;

/**
 * Lets a long unbroken word (an e-mail address as an owner's name) wrap
 * inside its cell instead of running into the next one. The shared
 * stylesheet turns hyphenation off for every word.
 */
const breakLong = (word: string) => (word.length > 16 ? word.match(/.{1,12}/g) ?? [word] : [word]);

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 12 }} wrap={false}>
      <Text style={{ fontSize: 11.5, fontWeight: 700, color: DARK, marginBottom: 5 }}>{title}</Text>
      {children}
    </View>
  );
}

function Rows({ rows }: { rows: Row[] }) {
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: BORDER }}>
      {rows.map((row, i) => (
        <View
          key={i}
          style={{
            flexDirection: "row",
            paddingVertical: 3.5,
            paddingHorizontal: 4,
            borderBottomWidth: 1,
            borderBottomColor: BORDER,
            backgroundColor: i % 2 === 1 ? LIGHT_BG : undefined,
          }}
        >
          <Text style={{ flex: 1, paddingRight: 8 }}>{row.label}</Text>
          <Text style={{ width: 150, textAlign: "right", fontWeight: 600 }}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

function Pairs({ rows }: { rows: Row[] }) {
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: BORDER }}>
      {rows.map((row, i) => (
        <View
          key={i}
          style={{
            flexDirection: "row",
            paddingVertical: 3.5,
            paddingHorizontal: 4,
            borderBottomWidth: 1,
            borderBottomColor: BORDER,
            backgroundColor: i % 2 === 1 ? LIGHT_BG : undefined,
          }}
        >
          <Text style={{ flex: 1, paddingRight: 8 }}>{row.label}</Text>
          <Text style={{ flex: 1.4, color: MUTED }}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

function Table({ headers, rows, widths }: { headers: string[]; rows: string[][]; widths: number[] }) {
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: BORDER }}>
      <View style={{ flexDirection: "row", paddingVertical: 3.5, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: BORDER }}>
        {headers.map((h, i) => (
          <Text key={i} style={{ flex: widths[i], fontWeight: 600, color: MUTED, fontSize: 8, paddingRight: 6 }}>
            {h}
          </Text>
        ))}
      </View>
      {rows.map((row, ri) => (
        <View
          key={ri}
          style={{
            flexDirection: "row",
            paddingVertical: 3.5,
            paddingHorizontal: 4,
            borderBottomWidth: 1,
            borderBottomColor: BORDER,
            backgroundColor: ri % 2 === 1 ? LIGHT_BG : undefined,
          }}
        >
          {row.map((cell, ci) => (
            <Text key={ci} style={{ flex: widths[ci], paddingRight: 6 }} hyphenationCallback={breakLong}>
              {cell}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <Text style={{ fontSize: 8, color: MUTED, marginTop: 4 }}>{children}</Text>;
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
  return (
    <Document language={locale} title={`${t.title}: ${t.organization}`} author={t.organization} creator="DPO Central">
      <Page size="A4" style={[s.page, { paddingBottom: 78 }]} wrap>
        <View style={s.pageHeader} fixed>
          <Text>{t.title}</Text>
          <Text>{t.organization}</Text>
        </View>

        {/* Title block */}
        <View style={{ marginBottom: 12 }}>
          <View style={{ width: 40, height: 2, backgroundColor: PRIMARY, marginBottom: 8 }} />
          <Text style={{ fontSize: 20, fontWeight: 700, color: DARK }}>{t.title}</Text>
          <Text style={{ fontSize: 12, fontWeight: 500, color: DARK, marginTop: 3 }}>{t.organization}</Text>
          <Text style={{ fontSize: 9.5, color: DARK, marginTop: 6 }}>{t.periodLine}</Text>
          <Text style={{ fontSize: 9.5, color: MUTED, marginTop: 2 }}>{t.generatedLine}</Text>
          <Note>{t.scopeNote}</Note>
        </View>

        <Section title={t.programme.title}>
          <Text style={{ fontSize: 13, fontWeight: 700, color: DARK }}>{t.programme.figure}</Text>
          {t.programme.parts ? <Text style={{ color: MUTED, marginTop: 2, marginBottom: 6 }}>{t.programme.parts}</Text> : <View style={{ height: 6 }} />}
          <Table
            headers={t.programme.headers}
            widths={[2, 1]}
            rows={t.programme.areas.map((a) => [a.label, a.value])}
          />
        </Section>

        <Section title={t.documents.title}>
          <Text style={{ fontWeight: 600, marginBottom: 4 }}>{t.documents.line}</Text>
          <Text style={{ fontSize: 8, color: MUTED, fontWeight: 600, marginTop: 2 }}>{t.documents.readyTitle}</Text>
          <Text style={{ marginTop: 2, marginBottom: 5 }}>
            {t.documents.ready.length > 0 ? t.documents.ready.join(" · ") : t.documents.noneReady}
          </Text>
          <Text style={{ fontSize: 8, color: MUTED, fontWeight: 600, marginBottom: 2 }}>{t.documents.missingTitle}</Text>
          {t.documents.missing.length > 0 ? (
            <Pairs rows={t.documents.missing} />
          ) : (
            <Text>{t.documents.noneMissing}</Text>
          )}
        </Section>

        <Section title={t.incidents.title}>
          <Rows rows={t.incidents.rows} />
        </Section>

        {t.rights && (
          <Section title={t.rights.title}>
            <Rows rows={t.rights.rows} />
          </Section>
        )}

        <Section title={t.vendors.title}>
          <Rows rows={t.vendors.rows} />
          {t.vendors.note && <Note>{t.vendors.note}</Note>}
        </Section>

        <Section title={t.assessments.title}>
          <Table headers={t.assessments.headers} widths={[3, 1, 1]} rows={t.assessments.rows} />
        </Section>

        <Section title={t.risks.title}>
          {t.risks.items.length > 0 ? (
            t.risks.items.map((item, i) => (
              <Text key={i} style={{ marginBottom: 3 }}>
                {`${i + 1}. ${item}`}
              </Text>
            ))
          ) : (
            <Text>{t.risks.empty}</Text>
          )}
        </Section>

        <Section title={t.actions.title}>
          {t.actions.rows.length > 0 ? (
            <Table
              headers={t.actions.headers}
              widths={[2.4, 1.3, 1.3]}
              rows={t.actions.rows.map((r, i) => [`${i + 1}. ${r.action}`, r.owner, r.date])}
            />
          ) : (
            <Text>{t.actions.empty}</Text>
          )}
          <Note>{t.actions.note}</Note>
        </Section>

        <View style={{ marginBottom: 12 }} wrap={false}>
          <Text style={{ fontSize: 11.5, fontWeight: 700, color: DARK, marginBottom: 5 }}>{t.comment.title}</Text>
          <View style={{ borderLeftWidth: 2, borderLeftColor: PRIMARY, paddingLeft: 8, paddingVertical: 2 }}>
            <Text style={{ color: t.comment.text ? DARK : MUTED }}>{t.comment.text ?? t.comment.none}</Text>
          </View>
          {t.comment.saved && <Note>{t.comment.saved}</Note>}
        </View>

        <View style={s.pageFooter} fixed>
          <Text style={{ marginBottom: 3 }}>{t.disclaimer}</Text>
          <View style={s.pageFooterRow}>
            <Text>{preparedWith}</Text>
            <Text render={({ pageNumber, totalPages }) => pageLabel(pageNumber, totalPages)} />
          </View>
        </View>
      </Page>
    </Document>
  );
}
