import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { tokens } from "../tokens";

const s = StyleSheet.create({
  container: {
    marginTop: tokens.space[8],
    marginBottom: tokens.space[5],
  },
  containerFirst: {
    marginTop: 0,
    marginBottom: tokens.space[5],
  },
  eyebrow: {
    fontSize: tokens.typography.size.micro,
    fontFamily: tokens.typography.family.sans,
    fontWeight: tokens.typography.weight.semibold,
    color: tokens.color.text.muted,
    textTransform: "uppercase",
    letterSpacing: tokens.typography.letterSpacing.caps,
    marginBottom: tokens.space[2],
  },
  titleH1: {
    fontSize: tokens.typography.size.display,
    fontFamily: tokens.typography.family.sans,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.color.brand.navyDeep,
    letterSpacing: tokens.typography.letterSpacing.tight,
    lineHeight: tokens.typography.lineHeight.tight,
    marginBottom: tokens.space[3],
  },
  titleH2: {
    fontSize: tokens.typography.size.h2,
    fontFamily: tokens.typography.family.sans,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.color.brand.navy,
    letterSpacing: tokens.typography.letterSpacing.tight,
    marginBottom: tokens.space[2],
  },
  titleH3: {
    fontSize: tokens.typography.size.h3,
    fontFamily: tokens.typography.family.sans,
    fontWeight: tokens.typography.weight.semibold,
    color: tokens.color.text.primary,
    marginBottom: tokens.space[1],
  },
  underlineH1: {
    height: 2,
    width: 72,
    backgroundColor: tokens.color.brand.navy,
    marginBottom: tokens.space[3],
  },
  underlineH2: {
    height: 1,
    backgroundColor: tokens.color.brand.navy,
    marginBottom: tokens.space[3],
  },
  underlineH3: {
    height: 0.5,
    backgroundColor: tokens.color.border.hairline,
    marginBottom: tokens.space[3],
  },
  lead: {
    fontSize: tokens.typography.size.bodyLg,
    fontFamily: tokens.typography.family.sans,
    fontWeight: tokens.typography.weight.regular,
    color: tokens.color.text.secondary,
    lineHeight: tokens.typography.lineHeight.normal,
    marginBottom: tokens.space[5],
  },
});

export function SectionHeading({
  eyebrow,
  title,
  lead,
  level = 2,
  first = false,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  level?: 1 | 2 | 3;
  first?: boolean;
}) {
  const titleStyle =
    level === 1 ? s.titleH1 : level === 2 ? s.titleH2 : s.titleH3;
  const underlineStyle =
    level === 1 ? s.underlineH1 : level === 2 ? s.underlineH2 : s.underlineH3;
  return (
    <View style={first ? s.containerFirst : s.container}>
      {eyebrow && <Text style={s.eyebrow}>{eyebrow}</Text>}
      <Text style={titleStyle}>{title}</Text>
      <View style={underlineStyle} />
      {lead && <Text style={s.lead}>{lead}</Text>}
    </View>
  );
}
