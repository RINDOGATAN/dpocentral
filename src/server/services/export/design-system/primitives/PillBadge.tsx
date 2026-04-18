import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { tokens, type SemanticTone } from "../tokens";

const s = StyleSheet.create({
  pillSolid: {
    paddingHorizontal: tokens.space[4],
    paddingVertical: 2,
    borderRadius: tokens.radius.pill,
    alignSelf: "flex-start",
  },
  pillOutline: {
    paddingHorizontal: tokens.space[4],
    paddingVertical: 2,
    borderRadius: tokens.radius.pill,
    borderWidth: 0.75,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: tokens.typography.size.micro,
    fontFamily: tokens.typography.family.sans,
    fontWeight: tokens.typography.weight.semibold,
    letterSpacing: 0.3,
  },
  textUpper: {
    textTransform: "uppercase",
    letterSpacing: tokens.typography.letterSpacing.caps,
  },
});

export function PillBadge({
  children,
  tone = "neutral",
  outline = false,
  uppercase = false,
}: {
  children: React.ReactNode;
  tone?: SemanticTone;
  outline?: boolean;
  uppercase?: boolean;
}) {
  const palette = tokens.color.semantic[tone];
  const containerStyle = outline
    ? [s.pillOutline, { borderColor: palette.solid, backgroundColor: tokens.color.surface.page }]
    : [s.pillSolid, { backgroundColor: palette.bg }];
  const textColor = palette.fg;
  const textStyle = uppercase
    ? [s.text, s.textUpper, { color: textColor }]
    : [s.text, { color: textColor }];
  return (
    <View style={containerStyle}>
      <Text style={textStyle}>{children}</Text>
    </View>
  );
}
