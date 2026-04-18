import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { tokens, type SemanticTone } from "../tokens";

const s = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: tokens.color.surface.subtle,
    borderRadius: tokens.radius.md,
    padding: tokens.space[5],
  },
  value: {
    fontSize: tokens.typography.size.h1,
    fontFamily: tokens.typography.family.sans,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.color.brand.navyDeep,
    letterSpacing: tokens.typography.letterSpacing.tight,
    lineHeight: tokens.typography.lineHeight.tight,
  },
  valueInline: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  suffix: {
    fontSize: tokens.typography.size.h3,
    fontFamily: tokens.typography.family.sans,
    fontWeight: tokens.typography.weight.semibold,
    color: tokens.color.brand.navyDeep,
    marginLeft: 2,
  },
  label: {
    fontSize: tokens.typography.size.micro,
    fontFamily: tokens.typography.family.sans,
    fontWeight: tokens.typography.weight.semibold,
    color: tokens.color.text.muted,
    textTransform: "uppercase",
    letterSpacing: tokens.typography.letterSpacing.caps,
    marginTop: tokens.space[2],
  },
});

const TONE_VALUE_COLOR: Record<SemanticTone | "default", string> = {
  default: tokens.color.brand.navyDeep,
  success: tokens.color.semantic.success.solid,
  warning: tokens.color.semantic.warning.solid,
  danger:  tokens.color.semantic.danger.solid,
  info:    tokens.color.semantic.info.solid,
  neutral: tokens.color.text.muted,
};

export function StatTile({
  value,
  label,
  suffix,
  tone = "default",
}: {
  value: string | number;
  label: string;
  suffix?: string;
  tone?: SemanticTone | "default";
}) {
  const valueColor = TONE_VALUE_COLOR[tone];
  return (
    <View style={s.tile}>
      <View style={s.valueInline}>
        <Text style={[s.value, { color: valueColor }]}>{value}</Text>
        {suffix && (
          <Text style={[s.suffix, { color: valueColor }]}>{suffix}</Text>
        )}
      </View>
      <Text style={s.label}>{label}</Text>
    </View>
  );
}

export function StatTileRow({ children, gap = tokens.space[5] }: { children: React.ReactNode; gap?: number }) {
  return (
    <View style={{ flexDirection: "row", gap, marginBottom: tokens.space[5] }}>
      {children}
    </View>
  );
}
