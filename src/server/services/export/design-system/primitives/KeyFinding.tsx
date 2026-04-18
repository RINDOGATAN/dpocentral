import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { tokens, type SemanticTone } from "../tokens";

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: tokens.space[4],
    paddingHorizontal: tokens.space[5],
    borderRadius: tokens.radius.md,
    marginBottom: tokens.space[3],
  },
  bullet: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginTop: 4,
    marginRight: tokens.space[5],
  },
  text: {
    flex: 1,
    fontSize: tokens.typography.size.bodyLg,
    fontFamily: tokens.typography.family.sans,
    fontWeight: tokens.typography.weight.medium,
    color: tokens.color.text.primary,
    lineHeight: tokens.typography.lineHeight.normal,
  },
});

const TONE_BG: Record<SemanticTone, string> = {
  success: tokens.color.surface.tintGreen,
  warning: tokens.color.surface.tintAmber,
  danger:  tokens.color.surface.tintRed,
  info:    tokens.color.surface.tint,
  neutral: tokens.color.surface.subtle,
};

export function KeyFinding({
  tone = "info",
  text,
}: {
  tone?: SemanticTone;
  text: string;
}) {
  const bg = TONE_BG[tone];
  const bulletColor = tokens.color.semantic[tone].solid;
  return (
    <View style={[s.row, { backgroundColor: bg }]} wrap={false}>
      <View style={[s.bullet, { backgroundColor: bulletColor }]} />
      <Text style={s.text}>{text}</Text>
    </View>
  );
}
