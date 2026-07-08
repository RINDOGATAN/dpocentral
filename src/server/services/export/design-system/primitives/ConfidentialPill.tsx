// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { tokens } from "../tokens";

const s = StyleSheet.create({
  pill: {
    paddingHorizontal: tokens.space[4],
    paddingVertical: 3,
    borderRadius: tokens.radius.sm,
    borderWidth: 0.75,
    borderColor: tokens.color.brand.navy,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: tokens.typography.size.micro,
    fontFamily: tokens.typography.family.sans,
    fontWeight: tokens.typography.weight.semibold,
    color: tokens.color.brand.navy,
    textTransform: "uppercase",
    letterSpacing: tokens.typography.letterSpacing.caps,
  },
});

export function ConfidentialPill({ label = "CONFIDENTIAL" }: { label?: string }) {
  return (
    <View style={s.pill}>
      <Text style={s.text}>{label}</Text>
    </View>
  );
}
