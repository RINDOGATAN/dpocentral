// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The assessment workflow's status guards, the risk register (inherent and
 * residual kept apart, no closing without a measure) and the frozen figures.
 */

import { describe, it, expect } from "vitest";
import {
  approvalRoundOutcome,
  canEditContent,
  canRequestApprovalFrom,
  canSubmitFrom,
  currentRound,
  isReviewerRole,
} from "@/lib/assessment-workflow";
import { closeRefusal, matrixLevel, registerRows, registerSummary } from "@/lib/assessment-risk-register";
import { dpiaTemplateData } from "@/config/dpia-template-v2";
import { calculateRiskScore, inherentAndResidual, withDerivedRisk } from "@/server/services/assessment/risk-score";
import { reviewReasons, type ActivityFingerprint } from "@/server/services/assessment/review-due";
import { workflowMessage } from "@/server/services/assessment/workflow-errors";

describe("status guards", () => {
  it("submits only a draft, an assessment in progress or a rejected one", () => {
    expect(canSubmitFrom("DRAFT")).toBe(true);
    expect(canSubmitFrom("IN_PROGRESS")).toBe(true);
    expect(canSubmitFrom("REJECTED")).toBe(true);
    // An approved assessment is never sent back to review by a member's submit.
    expect(canSubmitFrom("APPROVED")).toBe(false);
    expect(canSubmitFrom("PENDING_REVIEW")).toBe(false);
    expect(canSubmitFrom("PENDING_APPROVAL")).toBe(false);
  });

  it("freezes the content while approval is pending and once approved", () => {
    for (const role of ["OWNER", "ADMIN", "PRIVACY_OFFICER", "MEMBER"]) {
      expect(canEditContent("APPROVED", role)).toBe(false);
      expect(canEditContent("PENDING_APPROVAL", role)).toBe(false);
      expect(canEditContent("IN_PROGRESS", role)).toBe(true);
      expect(canEditContent("REJECTED", role)).toBe(true);
    }
    expect(canEditContent("PENDING_REVIEW", "MEMBER")).toBe(false);
    expect(canEditContent("PENDING_REVIEW", "PRIVACY_OFFICER")).toBe(true);
  });

  it("requests approval only after review, from a reviewer", () => {
    expect(canRequestApprovalFrom("DRAFT")).toBe(false);
    expect(canRequestApprovalFrom("IN_PROGRESS")).toBe(false);
    expect(canRequestApprovalFrom("PENDING_REVIEW")).toBe(true);
    expect(isReviewerRole("MEMBER")).toBe(false);
    expect(isReviewerRole("VIEWER")).toBe(false);
    expect(isReviewerRole("PRIVACY_OFFICER")).toBe(true);
  });

  it("approves only when every level of the round has approved", () => {
    expect(approvalRoundOutcome([{ status: "APPROVED" }, { status: "PENDING" }])).toBe("PENDING");
    expect(approvalRoundOutcome([{ status: "APPROVED" }, { status: "APPROVED" }])).toBe("APPROVED");
    expect(approvalRoundOutcome([{ status: "APPROVED" }, { status: "REJECTED" }])).toBe("REJECTED");
    expect(approvalRoundOutcome([])).toBe("PENDING");
  });

  it("decides on the current round only", () => {
    const submitted = new Date("2026-10-10T10:00:00Z");
    const old = { status: "REJECTED", createdAt: new Date("2026-10-01T10:00:00Z") };
    const now = { status: "APPROVED", createdAt: new Date("2026-10-11T10:00:00Z") };
    expect(approvalRoundOutcome(currentRound([old, now], submitted))).toBe("APPROVED");
  });

  it("refuses in the reader's language", () => {
    expect(workflowMessage("approvalDecided", "es")).toMatch(/ya se ha decidido/);
    expect(workflowMessage("art36HighResidual", "en")).toMatch(/Article 36\(1\)/);
    expect(workflowMessage("art36HighResidual", "es")).toMatch(/artículo 36\.1/);
  });
});

describe("the risk register", () => {
  const risk = (over: Partial<{ id: string; likelihood: number; severity: number; residualLikelihood: number | null; residualSeverity: number | null }>) => ({
    id: "r1",
    likelihood: 4,
    severity: 4,
    residualLikelihood: null,
    residualSeverity: null,
    status: "OPEN",
    ...over,
  });

  it("grades a pair on the 4 x 4 matrix", () => {
    expect(matrixLevel(1, 1)).toBe("LOW");
    expect(matrixLevel(4, 4)).toBe("CRITICAL");
    expect(matrixLevel(3, 4)).toBe("HIGH");
    expect(matrixLevel(0, 2)).toBeNull();
  });

  it("keeps inherent and residual apart, and assumes no reduction nobody graded", () => {
    const rows = registerRows([risk({}), risk({ id: "r2", likelihood: 2, severity: 2, residualLikelihood: 1, residualSeverity: 1 })], []);
    const summary = registerSummary(rows);
    expect(summary.inherent).toBe("CRITICAL");
    // r1 has no residual grade: it counts at its inherent level.
    expect(summary.residual).toBe("CRITICAL");
  });

  it("flags a large reduction with no implemented measure", () => {
    const r = risk({ residualLikelihood: 1, residualSeverity: 1 });
    expect(registerSummary(registerRows([r], [])).unsupportedReductions).toEqual(["r1"]);
    expect(registerSummary(registerRows([r], [{ riskId: "r1", status: "IMPLEMENTED" }])).unsupportedReductions).toEqual([]);
  });

  it("cannot close a risk without a measure, or without a graded residual", () => {
    expect(closeRefusal(risk({ residualLikelihood: 1, residualSeverity: 2 }), [])).toBe("NO_MEASURE");
    expect(closeRefusal(risk({}), [{ riskId: "r1", status: "PLANNED" }])).toBe("NO_RESIDUAL");
    expect(closeRefusal(risk({ residualLikelihood: 1, residualSeverity: 2 }), [{ riskId: "r1", status: "PLANNED" }])).toBeNull();
    // A measure of another risk does not count.
    expect(closeRefusal(risk({ residualLikelihood: 1, residualSeverity: 2 }), [{ riskId: "r9", status: "VERIFIED" }])).toBe("NO_MEASURE");
  });
});

describe("risk figures", () => {
  const dpia = { type: "DPIA", sections: dpiaTemplateData.sections, scoringLogic: dpiaTemplateData.scoringLogic };
  const answers = (m: Record<string, unknown>) => Object.entries(m).map(([questionId, response]) => ({ questionId, response }));
  const worst = {
    q2_1: "Includes special category data (Art. 9) or criminal offence data (Art. 10)",
    q5_1: true,
    q5_2: true,
    q5_3: true,
    q5_4: true,
    q5_5: true,
    q7_1: "Low",
  };

  it("does not bend the inherent score to the stated residual level", () => {
    const split = inherentAndResidual(dpia, answers(worst));
    expect(split.inherentScore).toBeGreaterThan(75);
    expect(split.inherentLevel).toBe("CRITICAL");
    expect(split.residualLevel).toBe("LOW");
  });

  it("takes the register's highest levels into account", () => {
    const split = inherentAndResidual(dpia, answers({ q7_1: "Low" }), { inherent: "HIGH", residual: "MEDIUM" });
    expect(split.inherentLevel).toBe("HIGH");
    expect(split.residualLevel).toBe("MEDIUM");
  });

  it("stores nothing scored as not assessed, never as low", () => {
    expect(calculateRiskScore([], dpia)).toBeNull();
  });

  it("never re-scores figures frozen at approval", () => {
    const frozen = { riskLevel: "HIGH" as const, riskScore: 70, riskFrozenAt: new Date() };
    expect(withDerivedRisk(frozen, dpia, answers({ q7_1: "Low" }))).toEqual(frozen);
  });
});

describe("review due after approval", () => {
  const base: ActivityFingerprint = {
    purpose: "Loyalty",
    legalBasis: "CONTRACT",
    special: [],
    recipients: ["Marketing"],
    systems: ["a1"],
    transfers: [],
    automatedDecisionMaking: false,
  };

  it("is not due when nothing that matters changed", () => {
    expect(reviewReasons(base, { ...base, recipients: [] })).toEqual([]);
  });

  it("names each change that matters", () => {
    expect(
      reviewReasons(base, {
        ...base,
        special: ["HEALTH"],
        recipients: ["Marketing", "Insurer"],
        transfers: ["t1:US"],
        purpose: "Loyalty and profiling",
      })
    ).toEqual(["SPECIAL_CATEGORY", "RECIPIENT", "TRANSFER", "PURPOSE"]);
  });
});
