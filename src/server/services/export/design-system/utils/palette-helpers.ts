// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { tokens, type CriticalityLevel, type SemanticTone } from "../tokens";
import {
  toneForRiskTier as sharedToneForRiskTier,
  toneForVendorStatus as sharedToneForVendorStatus,
} from "@/config/status-tone";

export function colorForCriticality(level: string | null | undefined): string {
  if (!level) return tokens.color.semantic.neutral.solid;
  const c = tokens.color.criticality[level as CriticalityLevel];
  return c ?? tokens.color.semantic.neutral.solid;
}

export function colorForAssetType(type: string): string {
  return (
    tokens.color.assetType[type as keyof typeof tokens.color.assetType] ??
    tokens.color.assetType.OTHER
  );
}

export function semanticTone(tone: SemanticTone) {
  return tokens.color.semantic[tone];
}

/**
 * Risk tier and vendor status to semantic tone (for PillBadge).
 *
 * The mapping now lives in src/config/status-tone.ts, so the screen and the
 * printed report reach the same tone for the same vendor. Re-exported here
 * because the report primitives have always imported it from this module.
 */
export const toneForRiskTier: (tier: string | null | undefined) => SemanticTone =
  sharedToneForRiskTier;

export const toneForVendorStatus: (status: string) => SemanticTone = sharedToneForVendorStatus;
