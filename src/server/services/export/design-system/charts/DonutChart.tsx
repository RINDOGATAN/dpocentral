import React from "react";
import { View, Text, StyleSheet, Svg, Circle, Path } from "@react-pdf/renderer";
import { tokens } from "../tokens";
import { arcPath } from "./svg-helpers";

const s = StyleSheet.create({
  wrap: {
    alignItems: "center",
    marginVertical: tokens.space[3],
  },
  centerLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  value: {
    fontSize: tokens.typography.size.h1,
    fontFamily: tokens.typography.family.sans,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.color.brand.navyDeep,
    letterSpacing: tokens.typography.letterSpacing.tight,
    lineHeight: tokens.typography.lineHeight.tight,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  valueSuffix: {
    fontSize: tokens.typography.size.h3,
    fontFamily: tokens.typography.family.sans,
    fontWeight: tokens.typography.weight.semibold,
    color: tokens.color.brand.navyDeep,
    marginLeft: 1,
  },
  subValue: {
    fontSize: tokens.typography.size.micro,
    color: tokens.color.text.muted,
    fontWeight: tokens.typography.weight.medium,
    marginTop: 2,
  },
  caption: {
    marginTop: tokens.space[3],
    fontSize: tokens.typography.size.micro,
    fontFamily: tokens.typography.family.sans,
    fontWeight: tokens.typography.weight.semibold,
    color: tokens.color.text.muted,
    textTransform: "uppercase",
    letterSpacing: tokens.typography.letterSpacing.caps,
    textAlign: "center",
    maxWidth: 160,
  },
  subCaption: {
    marginTop: 2,
    fontSize: tokens.typography.size.caption,
    color: tokens.color.text.secondary,
    textAlign: "center",
    maxWidth: 160,
  },
});

export function DonutChart({
  value,
  max,
  color,
  size = tokens.chart.donut.size,
  thickness = tokens.chart.donut.thickness,
  label,
  sublabel,
  displayMode = "percent",
  subValue,
}: {
  /** Current value */
  value: number;
  /** Max value for 100% fill */
  max: number;
  /** Fill color; defaults to navy */
  color?: string;
  size?: number;
  thickness?: number;
  /** Caption below the chart (uppercase) */
  label?: string;
  /** Secondary caption line */
  sublabel?: string;
  /** What to show in the center: "percent" or "count" or "custom" */
  displayMode?: "percent" | "count" | "custom";
  /** Only used when displayMode==="custom" */
  subValue?: string;
}) {
  const fillColor = color ?? tokens.color.brand.navy;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 1; // small inset so stroke never clips edge
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const endAngle = pct * 360;
  const path = pct > 0 && pct < 1 ? arcPath(cx, cy, radius, thickness, 0, endAngle) : null;

  const centerText =
    displayMode === "percent"
      ? Math.round(pct * 100).toString()
      : displayMode === "count"
        ? value.toString()
        : "";
  const centerSuffix = displayMode === "percent" ? "%" : "";

  return (
    <View style={s.wrap}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Track — full ring in neutral bg */}
          <Circle
            cx={cx}
            cy={cy}
            r={radius - thickness / 2}
            stroke={tokens.color.surface.subtleAlt}
            strokeWidth={thickness}
            fill="none"
          />
          {/* Filled portion — either partial arc or full ring */}
          {pct === 1 && (
            <Circle
              cx={cx}
              cy={cy}
              r={radius - thickness / 2}
              stroke={fillColor}
              strokeWidth={thickness}
              fill="none"
            />
          )}
          {path && <Path d={path} fill={fillColor} />}
        </Svg>
        <View style={s.centerLayer}>
          <View style={s.valueRow}>
            <Text style={s.value}>{displayMode === "custom" ? (subValue ?? "") : centerText}</Text>
            {centerSuffix && <Text style={s.valueSuffix}>{centerSuffix}</Text>}
          </View>
          {/*
            The center subvalue (small "X / Y" under the big number) is locale-
            insensitive: a slash beats a translated "of" / "de" / "sur" / "von".
          */}
          {displayMode !== "custom" && max > 0 && (
            <Text style={s.subValue}>
              {displayMode === "percent" ? `${value} / ${max}` : `/ ${max}`}
            </Text>
          )}
        </View>
      </View>
      {label && <Text style={s.caption}>{label}</Text>}
      {sublabel && <Text style={s.subCaption}>{sublabel}</Text>}
    </View>
  );
}
