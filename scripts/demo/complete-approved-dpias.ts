// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Brings the approved demo DPIAs up to the current template, so a demo never
 * shows an approved assessment with requirements outstanding:
 *
 *  - answers the questions the template gained after the demo answers were
 *    written (the framework choice, the views of data subjects, the review
 *    trigger, the legitimate interest where the basis is Art. 6(1)(f));
 *  - fills the risk register (one row per risk, graded before and after the
 *    measures) and links the existing measures to it;
 *  - freezes the approval as the app does: a version holding the answers, the
 *    register, the figures and the activity's baseline for "review due".
 *
 * Only demo data is touched: the organisation passed in, DPIA template only.
 */

import type { PrismaClient } from "@prisma/client";
import { EU_OPTION, FRAMEWORK_QUESTION_ID } from "../../src/config/assessment-frameworks";
import { unansweredRequired } from "../../src/server/services/assessment/progress";
import { calculateRiskScore, inherentAndResidual } from "../../src/server/services/assessment/risk-score";
import { registerRows, registerSummary } from "../../src/lib/assessment-risk-register";
import { FINGERPRINT_INCLUDE, activityFingerprint } from "../../src/server/services/assessment/review-due";

const SECTION_OF: Record<string, string> = {
  [FRAMEWORK_QUESTION_ID]: "s0",
  q1_7: "s1",
  q4_3: "s4",
  q7_4: "s7",
  q7_5: "s7",
};

function answerFor(questionId: string, approvedAt: Date): string | null {
  const reviewBy = new Date(approvedAt);
  reviewBy.setUTCFullYear(reviewBy.getUTCFullYear() + 1);
  switch (questionId) {
    case FRAMEWORK_QUESTION_ID:
      return JSON.stringify([EU_OPTION]);
    case "q1_7":
      return "Running and improving the service the customers signed up for, and preventing fraud against them and the company. The processing is limited to what that interest requires, and customers can object at any time.";
    case "q4_3":
      return "Views were sought from the customer advisory panel and from staff representatives. Their comments on transparency led to a clearer privacy notice and an easier way to object.";
    case "q7_4":
      return `Review by ${reviewBy.toISOString().slice(0, 10)}, or earlier if the purpose, the recipients, the categories of data or the technology change, or after a personal data breach.`;
    default:
      return null;
  }
}

const DEMO_RISKS = [
  {
    title: "Unauthorised access to personal data",
    description: "Access by staff or attackers beyond what their role requires, through weak access control or a compromised account.",
    rightsAffected: "Privacy; protection of personal data",
    likelihood: 3,
    severity: 3,
    residualLikelihood: 1,
    residualSeverity: 3,
  },
  {
    title: "Use beyond the stated purpose",
    description: "The data is reused for purposes the data subjects were not told about, such as profiling for unrelated marketing.",
    rightsAffected: "Information; objection; non-discrimination",
    likelihood: 2,
    severity: 3,
    residualLikelihood: 1,
    residualSeverity: 2,
  },
];

export async function completeApprovedDpias(prisma: PrismaClient, organizationId: string): Promise<number> {
  const assessments = await prisma.assessment.findMany({
    where: { organizationId, status: "APPROVED", template: { type: "DPIA" } },
    include: { template: true, responses: true, mitigations: true, risks: true },
  });

  for (const a of assessments) {
    if (!a.template) continue;
    const approvedAt = a.completedAt ?? a.updatedAt;
    const responderId = a.responses[0]?.responderId ?? null;

    // 1. The questions the template gained since the demo answers were written.
    for (let round = 0; round < 3; round++) {
      const responses = await prisma.assessmentResponse.findMany({ where: { assessmentId: a.id } });
      const missing = unansweredRequired(a.template, responses);
      let added = 0;
      for (const questionId of missing) {
        const response = answerFor(questionId, approvedAt);
        if (response == null) continue;
        await prisma.assessmentResponse.create({
          data: {
            assessmentId: a.id,
            questionId,
            sectionId: SECTION_OF[questionId] ?? "s7",
            response,
            responderId,
            respondedAt: approvedAt,
          },
        });
        added++;
      }
      if (added === 0) break;
    }

    // 2. The risk register, with the existing measures linked to it.
    if (a.risks.length === 0) {
      const created = [];
      for (const risk of DEMO_RISKS) {
        created.push(
          await prisma.assessmentRisk.create({
            data: { ...risk, assessmentId: a.id, status: "CLOSED", closedAt: approvedAt },
          })
        );
      }
      const measures = a.mitigations;
      if (measures.length === 0) {
        for (const risk of created) {
          await prisma.assessmentMitigation.create({
            data: {
              assessmentId: a.id,
              riskId: risk.id,
              title: risk.title.startsWith("Unauthorised")
                ? "Role-based access control with multi-factor authentication"
                : "Purpose limitation in the privacy notice and in the data access policy",
              status: "IMPLEMENTED",
              priority: 2,
              completedAt: approvedAt,
            },
          });
        }
      } else {
        for (const [i, m] of measures.entries()) {
          await prisma.assessmentMitigation.update({
            where: { id: m.id },
            data: { riskId: created[i % created.length].id },
          });
        }
      }
    }

    // 3. Freeze the approval as the app does.
    const responses = await prisma.assessmentResponse.findMany({ where: { assessmentId: a.id } });
    const risks = await prisma.assessmentRisk.findMany({ where: { assessmentId: a.id } });
    const measures = await prisma.assessmentMitigation.findMany({
      where: { assessmentId: a.id },
      select: { id: true, riskId: true, status: true, title: true },
    });
    const summary = registerSummary(registerRows(risks, measures));
    const combined = calculateRiskScore(responses, a.template);
    const split = inherentAndResidual(a.template, responses, summary);
    const activity = a.processingActivityId
      ? await prisma.processingActivity.findFirst({ where: { id: a.processingActivityId }, include: FINGERPRINT_INCLUDE })
      : null;
    const figures = {
      riskScore: combined?.score ?? null,
      riskLevel: combined?.level ?? null,
      inherentRiskScore: split.inherentScore,
      inherentRiskLevel: split.inherentLevel,
      residualRiskLevel: split.residualLevel,
    };
    const latest = await prisma.assessmentVersion.findFirst({
      where: { assessmentId: a.id },
      orderBy: { version: "desc" },
    });
    const version = (latest?.version ?? 0) + 1;
    await prisma.assessmentVersion.create({
      data: {
        assessmentId: a.id,
        version,
        snapshot: JSON.parse(
          JSON.stringify({
            approved: true,
            frozenAt: approvedAt,
            templateVersion: a.template.version,
            responses,
            risks,
            mitigations: measures,
            activity: activity ? activityFingerprint(activity) : null,
            ...figures,
          })
        ),
        changedBy: responderId,
        changeNotes: "workflow:APPROVED",
        createdAt: approvedAt,
      },
    });
    await prisma.assessment.update({
      where: { id: a.id },
      data: { ...figures, riskFrozenAt: approvedAt, approvedVersion: version },
    });
  }
  return assessments.length;
}
