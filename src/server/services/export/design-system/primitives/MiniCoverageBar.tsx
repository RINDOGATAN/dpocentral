import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { tokens, type SemanticTone } from "../tokens";

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: tokens.space[3],
  },
  label: {
    width: "35%",
    fontSize: tokens.typography.size.body,
    fontFamily: tokens.typography.family.sans,
    fontWeight: tokens.typography.weight.medium,
    color: tokens.color.text.secondary,
  },
  track: {
    flex: 1,
    height: 6,
    backgroundColor: tokens.color.surface.subtleAlt,
    borderRadius: tokens.radius.sm,
    marginHorizontal: tokens.space[4],
    overflow: "hidden",
  },
  fill: {
    height: 6,
    borderRadius: tokens.radius.sm,
  },
  count: {
    width: 50,
    textAlign: "right",
    fontSize: tokens.typography.size.caption,
    fontFamily: tokens.typography.family.sans,
    fontWeight: tokens.typography.weight.semibold,
    color: tokens.color.text.secondary,
  },
});

const TONE_FOR_COVERAGE = (pct: number): SemanticTone => {
  if (pct >= 0.8) return "success";
  if (pct >= 0.5) return "warning";
  if (pct >= 0.2) return "warning";
  return "danger";
};

export function MiniCoverageBar({
  label,
  value,
  total,
  tone,
  format = "fraction",
}: {
  label: string;
  value: number;
  total: number;
  tone?: SemanticTone;
  format?: "fraction" | "percent";
}) {
  const pct = total > 0 ? Math.min(1, value / total) : 0;
  const autoTone = tone ?? TONE_FOR_COVERAGE(pct);
  const fillColor = tokens.color.semantic[autoTone].solid;
  const display =
    format === "percent"
      ? `${Math.round(pct * 100)}%`
      : `${value}/${total}`;
  return (
    <View style={s.row} wrap={false}>
      <Text style={s.label}>{label}</Text>
      <View style={s.track}>
        <View style={[s.fill, { width: `${pct * 100}%`, backgroundColor: fillColor }]} />
      </View>
      <Text style={s.count}>{display}</Text>
    </View>
  );
}
