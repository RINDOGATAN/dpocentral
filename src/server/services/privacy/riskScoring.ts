import { RiskLevel } from "@prisma/client";

export interface RiskScoreResult {
  score: number; // 0-100
  level: RiskLevel;
  factors: RiskFactor[];
}

export interface RiskFactor {
  id: string;
  name: string;
  weight: number;
  value: number; // 0-1 normalized
  impact: "increases" | "decreases";
}

/**
 * Calculate overall risk score from factors
 */
export function calculateRiskScore(factors: RiskFactor[]): number {
  if (factors.length === 0) return 0;

  let totalWeight = 0;
  let weightedSum = 0;

  for (const factor of factors) {
    const contribution = factor.impact === "increases"
      ? factor.value
      : (1 - factor.value);
    weightedSum += contribution * factor.weight;
    totalWeight += factor.weight;
  }

  return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : 0;
}

/**
 * Convert numeric score to risk level
 */
export function scoreToRiskLevel(score: number): RiskLevel {
  if (score <= 25) return RiskLevel.LOW;
  if (score <= 50) return RiskLevel.MEDIUM;
  if (score <= 75) return RiskLevel.HIGH;
  return RiskLevel.CRITICAL;
}

/**
 * Calculate vendor risk score based on various factors
 */
export function calculateVendorRiskScore(params: {
  dataVolume: "low" | "medium" | "high" | "very_high";
  dataTypes: string[];
  hasSpecialCategory: boolean;
  certifications: string[];
  hasDataProcessingAgreement: boolean;
  countries: string[];
  hasEUAdequacyDecision: boolean;
}): RiskScoreResult {
  const factors: RiskFactor[] = [];

  // Data volume factor
  const volumeScores = { low: 0.2, medium: 0.4, high: 0.7, very_high: 1.0 };
  factors.push({
    id: "data_volume",
    name: "Data Volume",
    weight: 1.5,
    value: volumeScores[params.dataVolume],
    impact: "increases",
  });

  // Special category data
  factors.push({
    id: "special_category",
    name: "Special Category Data",
    weight: 2.0,
    value: params.hasSpecialCategory ? 1.0 : 0.0,
    impact: "increases",
  });

  // Certifications (more is better)
  const certificationScore = Math.min(params.certifications.length / 3, 1);
  factors.push({
    id: "certifications",
    name: "Security Certifications",
    weight: 1.5,
    value: certificationScore,
    impact: "decreases",
  });

  // DPA in place
  factors.push({
    id: "dpa",
    name: "Data Processing Agreement",
    weight: 1.5,
    value: params.hasDataProcessingAgreement ? 1.0 : 0.0,
    impact: "decreases",
  });

  // International transfers
  const hasInternationalTransfer = params.countries.length > 1 ||
    params.countries.some(c => !["US", "EU", "GB", "CA", "AU"].includes(c));
  factors.push({
    id: "international_transfer",
    name: "International Transfers",
    weight: 1.0,
    value: hasInternationalTransfer ? (params.hasEUAdequacyDecision ? 0.3 : 0.8) : 0.0,
    impact: "increases",
  });

  const score = calculateRiskScore(factors);

  return {
    score,
    level: scoreToRiskLevel(score),
    factors,
  };
}

/**
 * Calculate assessment risk score based on responses
 */
export function calculateAssessmentRiskScore(
  responses: Array<{ questionId: string; riskScore?: number | null }>,
  template: { scoringLogic?: any }
): RiskScoreResult {
  const scoredResponses = responses.filter(r => r.riskScore != null);

  if (scoredResponses.length === 0) {
    return {
      score: 0,
      level: RiskLevel.LOW,
      factors: [],
    };
  }

  const factors: RiskFactor[] = scoredResponses.map((r, i) => ({
    id: r.questionId,
    name: `Question ${i + 1}`,
    weight: 1,
    value: (r.riskScore || 0) / 100,
    impact: "increases" as const,
  }));

  const score = calculateRiskScore(factors);

  return {
    score,
    level: scoreToRiskLevel(score),
    factors,
  };
}

/**
 * Determine if incident requires notification based on risk factors
 */
export function assessBreachNotificationRequirement(params: {
  severity: string;
  affectedRecords?: number;
  dataCategories: string[];
  hasSpecialCategory: boolean;
}): {
  required: boolean;
  reason: string;
} {
  // Critical or high severity always requires notification
  if (params.severity === "CRITICAL" || params.severity === "HIGH") {
    return {
      required: true,
      reason: `${params.severity} severity incident`,
    };
  }

  // Special category data always requires notification
  if (params.hasSpecialCategory) {
    return {
      required: true,
      reason: "Special category personal data involved",
    };
  }

  // Large number of affected records
  if (params.affectedRecords && params.affectedRecords >= 500) {
    return {
      required: true,
      reason: `Large number of affected records (${params.affectedRecords})`,
    };
  }

  // Sensitive data categories
  const sensitiveCategories = ["FINANCIAL", "HEALTH", "BIOMETRIC", "CRIMINAL"];
  const hasSensitive = params.dataCategories.some(c => sensitiveCategories.includes(c));
  if (hasSensitive) {
    return {
      required: true,
      reason: "Sensitive data categories involved",
    };
  }

  return {
    required: false,
    reason: "Risk assessment indicates low likelihood of harm",
  };
}
