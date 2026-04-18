import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { tokens } from "../tokens";

const s = StyleSheet.create({
  container: {
    marginBottom: tokens.space[5],
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: tokens.space[3],
  },
  label: {
    width: 88,
    fontSize: tokens.typography.size.body,
    fontFamily: tokens.typography.family.sans,
    fontWeight: tokens.typography.weight.semibold,
    color: tokens.color.text.primary,
  },
  trackWrap: {
    flex: 1,
    height: 18,
    backgroundColor: tokens.color.surface.subtleAlt,
    borderRadius: tokens.radius.sm,
    overflow: "hidden",
    marginRight: tokens.space[4],
    position: "relative",
  },
  fill: {
    height: 18,
    borderRadius: tokens.radius.sm,
    alignItems: "flex-start",
    justifyContent: "center",
    paddingHorizontal: tokens.space[3],
  },
  countText: {
    fontSize: tokens.typography.size.caption,
    fontFamily: tokens.typography.family.sans,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.color.text.inverse,
  },
  percentText: {
    width: 34,
    textAlign: "right",
    fontSize: tokens.typography.size.caption,
    fontFamily: tokens.typography.family.sans,
    fontWeight: tokens.typography.weight.semibold,
    color: tokens.color.text.secondary,
  },
});

export interface BarRow {
  label: string;
  value: number;
  color?: string;
  /** Override the label color (e.g. criticality colors matching the fill) */
  labelColor?: string;
}

export function HorizontalBarChart({
  rows,
  max,
  showPercentage = true,
  showEmptyAsZero = true,
  labelWidth,
}: {
  rows: BarRow[];
  max?: number;
  showPercentage?: boolean;
  /** If true, empty rows still render with a minimal empty track + "0" */
  showEmptyAsZero?: boolean;
  labelWidth?: number;
}) {
  const total = rows.reduce((n, r) => n + r.value, 0);
  const effectiveMax = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <View style={s.container}>
      {rows.map((r, i) => {
        const ratio = effectiveMax > 0 ? r.value / effectiveMax : 0;
        const pct = total > 0 ? r.value / total : 0;
        const fillPct = Math.max(r.value === 0 && !showEmptyAsZero ? 0 : ratio * 100, r.value > 0 ? 8 : 3);
        const fillColor = r.color ?? tokens.color.brand.navy;
        const labelColor = r.labelColor ?? tokens.color.text.primary;
        return (
          <View key={i} style={s.row} wrap={false}>
            <Text style={[s.label, { color: labelColor, width: labelWidth ?? s.label.width }]}>
              {r.label}
            </Text>
            <View style={s.trackWrap}>
              <View
                style={[
                  s.fill,
                  {
                    width: `${fillPct}%`,
                    backgroundColor: r.value === 0 ? tokens.color.surface.subtleAlt : fillColor,
                  },
                ]}
              >
                {r.value > 0 && (
                  <Text style={s.countText}>{r.value}</Text>
                )}
                {r.value === 0 && (
                  <Text style={[s.countText, { color: tokens.color.text.muted }]}>0</Text>
                )}
              </View>
            </View>
            {showPercentage && (
              <Text style={s.percentText}>
                {total > 0 ? `${Math.round(pct * 100)}%` : "—"}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}
