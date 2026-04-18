import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { tokens } from "../tokens";

const s = StyleSheet.create({
  chip: {
    paddingHorizontal: tokens.space[4],
    paddingVertical: 3,
    borderRadius: tokens.radius.sm,
    borderWidth: 0.75,
    borderColor: tokens.color.brand.navy,
    backgroundColor: tokens.color.surface.tint,
    marginRight: tokens.space[3],
    marginBottom: tokens.space[3],
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
  },
  text: {
    fontSize: tokens.typography.size.caption,
    fontFamily: tokens.typography.family.sans,
    fontWeight: tokens.typography.weight.medium,
    color: tokens.color.brand.navy,
  },
  count: {
    fontSize: tokens.typography.size.caption,
    fontFamily: tokens.typography.family.sans,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.color.brand.navyDeep,
    marginLeft: tokens.space[3],
  },
});

export function CategoryChip({
  label,
  count,
}: {
  label: string;
  count?: number;
}) {
  return (
    <View style={s.chip} wrap={false}>
      <Text style={s.text}>{label}</Text>
      {count !== undefined && <Text style={s.count}>{count}</Text>}
    </View>
  );
}

export function CategoryChipRow({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: tokens.space[3] }}>
      {children}
    </View>
  );
}
