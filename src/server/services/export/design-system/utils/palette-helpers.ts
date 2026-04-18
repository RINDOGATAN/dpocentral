import { tokens, type CriticalityLevel, type SemanticTone } from "../tokens";

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
 * Risk-tier → semantic tone mapping (for PillBadge).
 * Kept separate from criticality so the mapping can evolve per report context.
 */
export function toneForRiskTier(tier: string | null | undefined): SemanticTone {
  switch (tier) {
    case "CRITICAL": return "danger";
    case "HIGH":     return "warning";
    case "MEDIUM":   return "info";
    case "LOW":      return "success";
    default:         return "neutral";
  }
}

export function toneForVendorStatus(status: string): SemanticTone {
  switch (status) {
    case "ACTIVE":       return "success";
    case "SUSPENDED":
    case "TERMINATED":   return "danger";
    case "UNDER_REVIEW":
    case "PENDING":      return "warning";
    default:             return "neutral";
  }
}
