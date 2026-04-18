import React from "react";
import { Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { tokens } from "../tokens";

const s = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingRight: 56,
    paddingBottom: 56,
    paddingLeft: 56,
    fontFamily: tokens.typography.family.sans,
    color: tokens.color.text.primary,
    backgroundColor: tokens.color.surface.page,
  },
  wordmarkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  wordmarkMark: {
    width: 18,
    height: 18,
    borderRadius: 3,
    backgroundColor: tokens.color.brand.navy,
    marginRight: 10,
  },
  wordmarkBrand: {
    flexDirection: "row",
    alignItems: "center",
  },
  wordmarkText: {
    fontSize: tokens.typography.size.h4,
    fontFamily: tokens.typography.family.sans,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.color.brand.navy,
    letterSpacing: tokens.typography.letterSpacing.caps,
  },
  wordmarkSubtle: {
    fontSize: tokens.typography.size.micro,
    color: tokens.color.text.muted,
    textTransform: "uppercase",
    letterSpacing: tokens.typography.letterSpacing.capsWide,
    fontWeight: tokens.typography.weight.medium,
  },
});

/**
 * CoverFrame differs from PageFrame: no repeating header/footer, a simple
 * top-left wordmark, and the page body flows freely. Children provide their
 * own hero title, stat tiles, and content blocks.
 */
export function CoverFrame({
  children,
  rightEyebrow,
}: {
  children: React.ReactNode;
  rightEyebrow?: string;
}) {
  return (
    <Page size={tokens.page.size} style={s.page} wrap={false}>
      <View style={s.wordmarkRow}>
        <View style={s.wordmarkBrand}>
          <View style={s.wordmarkMark} />
          <Text style={s.wordmarkText}>DPO CENTRAL</Text>
        </View>
        {rightEyebrow && <Text style={s.wordmarkSubtle}>{rightEyebrow}</Text>}
      </View>
      {children}
    </Page>
  );
}
