import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { tokens } from "../tokens";

const s = StyleSheet.create({
  track: {
    flexDirection: "row",
    height: 12,
    borderRadius: tokens.radius.sm,
    overflow: "hidden",
    marginBottom: tokens.space[4],
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: tokens.space[3],
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: tokens.space[6],
    marginBottom: tokens.space[2],
  },
  swatch: {
    width: 9,
    height: 9,
    borderRadius: 2,
    marginRight: tokens.space[3],
  },
  label: {
    fontSize: tokens.typography.size.micro,
    fontFamily: tokens.typography.family.sans,
    fontWeight: tokens.typography.weight.semibold,
    color: tokens.color.text.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  count: {
    fontSize: tokens.typography.size.micro,
    fontFamily: tokens.typography.family.sans,
    fontWeight: tokens.typography.weight.regular,
    color: tokens.color.text.muted,
    marginLeft: tokens.space[2],
  },
  totalLabel: {
    marginLeft: "auto",
    fontSize: tokens.typography.size.micro,
    fontWeight: tokens.typography.weight.semibold,
    color: tokens.color.text.muted,
  },
});

export interface StackedSegment {
  label: string;
  count: number;
  color: string;
}

export function StackedBar({
  segments,
  totalLabel,
}: {
  segments: StackedSegment[];
  totalLabel?: string;
}) {
  const total = segments.reduce((n, s) => n + s.count, 0);
  if (total === 0) return null;
  return (
    <View style={{ marginBottom: tokens.space[5] }}>
      <View style={s.track}>
        {segments.map((seg, i) => (
          <View
            key={i}
            style={{
              width: `${(seg.count / total) * 100}%`,
              backgroundColor: seg.color,
            }}
          />
        ))}
      </View>
      <View style={s.legend}>
        {segments.map((seg, i) => (
          <View key={i} style={s.legendItem}>
            <View style={[s.swatch, { backgroundColor: seg.color }]} />
            <Text style={s.label}>{seg.label}</Text>
            <Text style={s.count}>({seg.count})</Text>
          </View>
        ))}
        {totalLabel && <Text style={s.totalLabel}>{totalLabel}</Text>}
      </View>
    </View>
  );
}
