// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Which step of the assessment workflow may follow which, as data, so the
 * router, the page and the tests read the same rules.
 *
 *  DRAFT / IN_PROGRESS / REJECTED --submit--> PENDING_REVIEW
 *  PENDING_REVIEW --requestApproval--> PENDING_APPROVAL
 *  PENDING_APPROVAL --every level approved--> APPROVED
 *  PENDING_APPROVAL --any level rejected--> REJECTED
 *  APPROVED --reopen (officer)--> IN_PROGRESS (a new revision)
 *
 * Answers are frozen while an approval is pending and once approved; during
 * review only a reviewer (owner, admin or privacy officer) may correct them.
 * A decision, once taken, is never changed: a new revision is a new round.
 */

export type WorkflowStatus =
  | "DRAFT"
  | "IN_PROGRESS"
  | "PENDING_REVIEW"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "ARCHIVED";

/** Roles that review and approve assessments. */
export const REVIEWER_ROLES = ["OWNER", "ADMIN", "PRIVACY_OFFICER"] as const;

export function isReviewerRole(role: string | null | undefined): boolean {
  return !!role && (REVIEWER_ROLES as readonly string[]).includes(role);
}

/** Statuses from which an assessment may be submitted for review. */
export const SUBMITTABLE_STATUSES: WorkflowStatus[] = ["DRAFT", "IN_PROGRESS", "REJECTED"];

export function canSubmitFrom(status: string): boolean {
  return (SUBMITTABLE_STATUSES as string[]).includes(status);
}

/** Answers, measures and risks may change in this status, for this role. */
export function canEditContent(status: string, role: string | null | undefined): boolean {
  if (status === "APPROVED" || status === "PENDING_APPROVAL" || status === "ARCHIVED") return false;
  if (status === "PENDING_REVIEW") return isReviewerRole(role);
  return true;
}

/** Approval may only be requested for an assessment under review. */
export function canRequestApprovalFrom(status: string): boolean {
  return status === "PENDING_REVIEW" || status === "PENDING_APPROVAL";
}

export type ApprovalRound = "APPROVED" | "REJECTED" | "PENDING";

/**
 * The outcome of the open round of approvals: rejected as soon as one level
 * rejects, approved only when every level has approved, pending otherwise.
 */
export function approvalRoundOutcome(approvals: ReadonlyArray<{ status: string }>): ApprovalRound {
  // A delegated approval is replaced by the delegate's own and does not count.
  const live = approvals.filter((a) => a.status !== "DELEGATED");
  if (live.some((a) => a.status === "REJECTED")) return "REJECTED";
  if (live.length > 0 && live.every((a) => a.status === "APPROVED")) return "APPROVED";
  return "PENDING";
}

/**
 * The approvals of the current round: those requested since the assessment
 * was last submitted. Earlier rounds stay in the history and do not decide.
 */
export function currentRound<A extends { createdAt: Date }>(
  approvals: ReadonlyArray<A>,
  submittedAt: Date | null | undefined
): A[] {
  if (!submittedAt) return [...approvals];
  return approvals.filter((a) => a.createdAt.getTime() >= submittedAt.getTime());
}
