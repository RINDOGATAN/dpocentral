import React from "react";
import { Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { tokens } from "../tokens";

const s = StyleSheet.create({
  page: {
    paddingTop: tokens.page.margin.top,
    paddingRight: tokens.page.margin.right,
    paddingBottom: tokens.page.margin.bottom,
    paddingLeft: tokens.page.margin.left,
    fontFamily: tokens.typography.family.sans,
    fontSize: tokens.typography.size.body,
    color: tokens.color.text.primary,
    backgroundColor: tokens.color.surface.page,
  },
  topRule: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: tokens.color.brand.navy,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingBottom: tokens.space[3],
    marginBottom: tokens.space[6],
    borderBottomWidth: 0.5,
    borderBottomColor: tokens.color.border.hairline,
  },
  headerLeft: {
    fontSize: tokens.typography.size.micro,
    fontFamily: tokens.typography.family.sans,
    fontWeight: tokens.typography.weight.semibold,
    color: tokens.color.text.muted,
    textTransform: "uppercase",
    letterSpacing: tokens.typography.letterSpacing.caps,
  },
  headerRight: {
    fontSize: tokens.typography.size.caption,
    color: tokens.color.text.secondary,
    fontWeight: tokens.typography.weight.medium,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: tokens.page.margin.left,
    right: tokens.page.margin.right,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: tokens.typography.size.micro,
    color: tokens.color.text.muted,
    borderTopWidth: 0.5,
    borderTopColor: tokens.color.border.hairline,
    paddingTop: tokens.space[3],
  },
  footerLabel: {
    fontSize: tokens.typography.size.micro,
    color: tokens.color.text.muted,
    textTransform: "uppercase",
    letterSpacing: tokens.typography.letterSpacing.caps,
    fontWeight: tokens.typography.weight.medium,
  },
});

export function PageFrame({
  eyebrow,
  orgName,
  date,
  children,
  showTopRule = true,
}: {
  eyebrow: string;
  orgName: string;
  date: string;
  children: React.ReactNode;
  showTopRule?: boolean;
}) {
  return (
    <Page size={tokens.page.size} style={s.page} wrap>
      {showTopRule && <View style={s.topRule} fixed />}
      <View style={s.header} fixed>
        <Text style={s.headerLeft}>{eyebrow}</Text>
        <Text style={s.headerRight}>{orgName}</Text>
      </View>
      {children}
      <View style={s.footer} fixed>
        <Text style={s.footerLabel}>DPO Central</Text>
        <Text style={s.footerLabel}>{date}</Text>
        <Text
          style={s.footerLabel}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
        />
      </View>
    </Page>
  );
}
