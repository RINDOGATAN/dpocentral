// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * A draft's gaps on its first page (owner's decision d4, 9 October 2026:
 * "draft (gaps on page one)"). The assessment report has always listed what
 * is outstanding on its cover; every other generated PDF gets this generic
 * page in front of it when it goes out as a draft in the document pack. The
 * gaps are the register's own (src/config/document-register.ts), in words, so
 * the page says exactly what the dashboard panel says.
 */

import React from "react";
import { Page, Text, View } from "@react-pdf/renderer";
import { s } from "./pdf-styles";

export interface DraftNote {
  /** "DRAFT" / "BORRADOR", the mark in the corner. */
  mark: string;
  /** The document's name. */
  title: string;
  /** One sentence: why this is a draft and what to do. */
  intro: string;
  /** The heading over the list. */
  gapsTitle: string;
  /** Each gap in words ("7 records to confirm"). */
  gaps: string[];
  /** "Generated 2026-10-09". */
  generated: string;
}

export function DraftGapsPage({ note }: { note: DraftNote }) {
  return (
    <Page size="A4" style={s.page}>
      <Text style={s.draftMark}>{note.mark}</Text>
      <View style={{ marginTop: 40 }}>
        <Text style={s.coverTitle}>{note.title}</Text>
        <Text style={{ fontSize: 10, color: "#666666", marginTop: 8, marginBottom: 24 }}>{note.generated}</Text>
        <View style={s.calloutBox}>
          <Text style={s.calloutTitle}>{note.gapsTitle}</Text>
          <Text style={s.calloutText}>{note.intro}</Text>
          <View style={{ marginTop: 6 }}>
            {note.gaps.map((gap, i) => (
              <Text key={i} style={s.calloutText}>
                {"•"}  {gap}
              </Text>
            ))}
          </View>
        </View>
      </View>
    </Page>
  );
}

/**
 * The document with the gaps page in front of it. `doc` is what a document
 * component returns: a react-pdf <Document> element whose children are its
 * pages. Without a note the document is returned untouched.
 */
export function withDraftGapsPage<E extends React.ReactElement>(doc: E, note: DraftNote | null | undefined): E {
  if (!note) return doc;
  const children = (doc.props as { children?: React.ReactNode }).children;
  return React.cloneElement(
    doc,
    undefined,
    <DraftGapsPage key="draft-gaps" note={note} />,
    ...React.Children.toArray(children),
  ) as E;
}
