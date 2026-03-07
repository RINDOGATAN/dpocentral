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
