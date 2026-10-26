// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { z } from "zod";
import { createTRPCRouter, organizationProcedure, protectedProcedure, writerProcedure, officerProcedure, adminOrgProcedure } from "../../trpc";
import { TRPCError } from "@trpc/server";
import { AssessmentType, AssessmentStatus, MitigationStatus, ApprovalStatus } from "@prisma/client";
import {
  checkAssessmentEntitlement,
  isPremiumAssessmentType,
  getEntitledAssessmentTypes,
} from "../../services/licensing/entitlement";
import { features } from "@/config/features";
import { brand } from "@/config/brand";
import { PET_RISK_MAPPINGS, detectRisksFromText } from "@/config/pet-risk-mappings";
import { buildAutoFillContext } from "../../services/privacy/autoFillContext";
import { dpiaAutoFillText } from "../../services/privacy/dpia-auto-fill-text";
import { requireAi, assertAiRateLimit, recordGeneration, markAccepted, postureLane } from "../../services/ai/posture";
import { generateRiskNarrative } from "../../services/ai/assessment-generator";
import { localeFromCookieGetter } from "@/i18n/locale-cookie";
import { ensureHostedTemplates } from "../../services/pilot/hosted-templates";
import { pilotLocale } from "../../services/pilot/caps";
import {
  assessmentProgress,
  unansweredRequired,
} from "../../services/assessment/progress";
import {
  calculateRiskScore,
  inherentAndResidual,
  withDerivedRisk,
  type RiskTemplate,
} from "../../services/assessment/risk-score";
import { sectionsForLocale } from "../../services/assessment/template-locales";
import {
  stillToAnswerMessage,
  workflowError,
  type WorkflowErrorKey,
} from "../../services/assessment/workflow-errors";
import {
  approvalRoundOutcome,
  canEditContent,
  canRequestApprovalFrom,
  canSubmitFrom,
  currentRound,
  isReviewerRole,
} from "@/lib/assessment-workflow";
import {
  closeRefusal,
  registerRows,
  registerSummary,
  type RegisterSummary,
} from "@/lib/assessment-risk-register";
import { art36Conflict } from "@/config/assessment-frameworks";
import { answerMapFrom } from "@/lib/assessment-conditions";
import type { Db } from "@/lib/prisma";
import { loadActivityFingerprint, reviewDueAssessments } from "../../services/assessment/review-due";
import {
  AUTO_FILL_TARGETS,
  LEGAL_BASIS_OPTIONS,
  SENSITIVITY_SPECIAL_CATEGORY,
  type AutoFillTarget,
} from "@/config/dpia-auto-fill-targets";
import { assertIdsInOrg } from "../../org-ownership";
import { preselectDpiaFrameworks } from "../../services/assessment/framework-preselect";
import { dpiaTemplateSections } from "@/config/dpia-template-v2";
import { isEmptyAnswer } from "@/lib/assessment-answer";
import { tiaRecordDescription, tiaRecordName } from "@/lib/record-name";

/** Assessments not yet submitted: the only ones that can be deleted. */
export const DELETABLE_ASSESSMENT_STATUSES: AssessmentStatus[] = [AssessmentStatus.DRAFT, AssessmentStatus.IN_PROGRESS];

/** Codes stored as version change notes; the page translates them. */
export const VERSION_NOTES = {
  submitted: "workflow:SUBMITTED",
  approved: "workflow:APPROVED",
  autoApproved: "workflow:AUTO_APPROVED",
  reopened: "workflow:REOPENED",
} as const;

type CookieCtx = { getCookie: (name: string) => string | undefined };
const requestLocale = (ctx: CookieCtx) => localeFromCookieGetter(ctx.getCookie);

/** Refuses a change to the content of an assessment whose status freezes it. */
function assertContentEditable(
  status: AssessmentStatus,
  role: string | null | undefined,
  locale: string | null | undefined
): void {
  if (canEditContent(status, role)) return;
  const key: WorkflowErrorKey =
    status === AssessmentStatus.PENDING_APPROVAL
      ? "frozenPendingApproval"
      : status === AssessmentStatus.PENDING_REVIEW
        ? "reviewersOnly"
        : "approvedLocked";
  throw workflowError(key, locale);
}

/** The register of an assessment: its rows and their highest levels. */
async function loadRegister(prisma: Db, assessmentId: string) {
  const [risks, measures] = await Promise.all([
    prisma.assessmentRisk.findMany({ where: { assessmentId }, orderBy: { createdAt: "asc" } }),
    prisma.assessmentMitigation.findMany({
      where: { assessmentId },
      select: { id: true, riskId: true, status: true, title: true },
    }),
  ]);
  const rows = registerRows(risks, measures);
  return { risks, measures, rows, summary: registerSummary(rows) };
}

/** Measures not tied to a register risk carry one of these markers. */
const UNLINKED_RISK_IDS = new Set(["manual", "pet_suggestion"]);

/** A measure may only point at a risk of its own assessment. */
async function assertRiskOfAssessment(
  prisma: Db,
  assessmentId: string,
  riskId: string,
  locale: string | null | undefined
): Promise<void> {
  if (UNLINKED_RISK_IDS.has(riskId)) return;
  const risk = await prisma.assessmentRisk.findFirst({ where: { id: riskId, assessmentId }, select: { id: true } });
  if (!risk) throw workflowError("riskNotInAssessment", locale);
}

/** Every figure stored when an assessment is scored: combined, inherent and residual. */
function scoreFigures(
  template: RiskTemplate,
  responses: ReadonlyArray<{ questionId: string; response: unknown }>,
  summary: RegisterSummary
) {
  const combined = calculateRiskScore(responses, template);
  const split = inherentAndResidual(template, responses, summary);
  return {
    riskScore: combined?.score ?? null,
    riskLevel: combined?.level ?? null,
    inherentRiskScore: split.inherentScore,
    inherentRiskLevel: split.inherentLevel,
    residualRiskLevel: split.residualLevel,
  };
}

/** Refuses the answer pairs Article 36 does not allow (DPIA template only). */
function assertArt36(
  template: { type: string },
  responses: ReadonlyArray<{ questionId: string; response: unknown }>,
  summary: RegisterSummary,
  locale: string | null | undefined
): void {
  if (template.type !== AssessmentType.DPIA) return;
  const conflict = art36Conflict(
    answerMapFrom(responses.filter((r) => !r.questionId.includes("::"))),
    summary.residual
  );
  if (conflict === "HIGH_RESIDUAL_NO_CONSULTATION") throw workflowError("art36HighResidual", locale);
  if (conflict === "CONSULTATION_UNDECIDED") throw workflowError("art36Undecided", locale);
}

/** "Still to answer (n): ..." with the question text in the reader's language. */
function unansweredError(
  template: { type: string; sections: unknown },
  unanswered: string[],
  locale: string | null | undefined
): TRPCError {
  type TextSection = { id: string; title: string; questions?: Array<{ id: string; text: string }> };
  const stored = Array.isArray(template.sections) ? (template.sections as TextSection[]) : [];
  const shown = sectionsForLocale(template.type, stored, locale === "es" ? "es" : "en");
  const text = new Map<string, string>();
  for (const s of shown) for (const q of s.questions ?? []) text.set(q.id, q.text);
  return new TRPCError({
    code: "BAD_REQUEST",
    message: stillToAnswerMessage(
      unanswered.map((id) => text.get(id.split("::")[0]) ?? id),
      locale
    ),
  });
}

/**
 * Approves an assessment and freezes what was approved: a version holding the
 * answers, the risk register, the measures and every risk figure, and the
 * figures on the assessment itself, which from now on are shown as stored
 * (src/server/services/assessment/risk-score.ts, withDerivedRisk).
 */
async function freezeApproved(
  prisma: Db,
  args: {
    assessment: {
      id: string;
      processingActivityId: string | null;
      template: RiskTemplate & { version: string };
      responses: Array<{ questionId: string; response: unknown }>;
    };
    userId: string;
    note: string;
    submittedAt?: Date;
  }
) {
  const { assessment } = args;
  const register = await loadRegister(prisma, assessment.id);
  const figures = scoreFigures(assessment.template, assessment.responses, register.summary);
  const latestVersion = await prisma.assessmentVersion.findFirst({
    where: { assessmentId: assessment.id },
    orderBy: { version: "desc" },
  });
  const version = (latestVersion?.version ?? 0) + 1;
  const now = new Date();
  // The activity's relevant facts at approval, the baseline that "review due"
  // compares against (src/server/services/assessment/review-due.ts).
  const activity = assessment.processingActivityId
    ? await loadActivityFingerprint(prisma, assessment.processingActivityId)
    : null;
  await prisma.assessmentVersion.create({
    data: {
      assessmentId: assessment.id,
      version,
      snapshot: JSON.parse(
        JSON.stringify({
          approved: true,
          frozenAt: now,
          templateVersion: assessment.template.version,
          responses: assessment.responses,
          risks: register.risks,
          mitigations: register.measures,
          activity,
          ...figures,
        })
      ),
      changedBy: args.userId,
      changeNotes: args.note,
    },
  });
  return prisma.assessment.update({
    where: { id: assessment.id },
    data: {
      status: AssessmentStatus.APPROVED,
      ...(args.submittedAt ? { submittedAt: args.submittedAt } : {}),
      completedAt: now,
      ...figures,
      riskFrozenAt: now,
      approvedVersion: version,
    },
  });
}

export const assessmentRouter = createTRPCRouter({
  // ============================================================
  // ASSESSMENT TEMPLATES
  // ============================================================

  // List templates
  listTemplates: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        type: z.nativeEnum(AssessmentType).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await ensureHostedTemplates();
      return ctx.prisma.assessmentTemplate.findMany({
        where: {
          OR: [
            { organizationId: ctx.organization.id },
            { isSystem: true },
          ],
          isActive: true,
          // A superseded template is no longer offered for NEW assessments; an
          // assessment already using it still opens it through getTemplate.
          supersededAt: null,
          type: input.type,
        },
        orderBy: [{ isSystem: "desc" }, { name: "asc" }],
      });
    }),

  // Get template by ID
  getTemplate: organizationProcedure
    .input(z.object({ organizationId: z.string(), id: z.string() }))
    .query(async ({ ctx, input }) => {
      const template = await ctx.prisma.assessmentTemplate.findFirst({
        where: {
          id: input.id,
          OR: [
            { organizationId: ctx.organization.id },
            { isSystem: true },
          ],
        },
      });

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Template not found",
        });
      }

      return template;
    }),

  // Create custom template
  createTemplate: officerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        type: z.nativeEnum(AssessmentType),
        name: z.string().min(1),
        description: z.string().optional(),
        sections: z.array(z.any()),
        scoringLogic: z.any().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const template = await ctx.prisma.assessmentTemplate.create({
        data: {
          organizationId: ctx.organization.id,
          type: input.type,
          name: input.name,
          description: input.description,
          sections: input.sections,
          scoringLogic: input.scoringLogic,
          isSystem: false,
        },
      });

      return template;
    }),

  // Clone system template
  cloneTemplate: officerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        templateId: z.string(),
        name: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Security: Only allow cloning system templates or templates from the user's own org
      const source = await ctx.prisma.assessmentTemplate.findFirst({
        where: {
          id: input.templateId,
          OR: [
            { isSystem: true },
            { organizationId: ctx.organization.id },
          ],
        },
      });

      if (!source) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Template not found or not accessible",
        });
      }

      const template = await ctx.prisma.assessmentTemplate.create({
        data: {
          organizationId: ctx.organization.id,
          type: source.type,
          name: input.name,
          description: source.description,
          sections: source.sections as any,
          scoringLogic: source.scoringLogic as any,
          isSystem: false,
        },
      });

      return template;
    }),

  // ============================================================
  // ASSESSMENTS
  // ============================================================

  // List assessments
  list: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        status: z.nativeEnum(AssessmentStatus).optional(),
        type: z.nativeEnum(AssessmentType).optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const assessments = await ctx.prisma.assessment.findMany({
        where: {
          organizationId: ctx.organization.id,
          status: input.status,
          template: input.type ? { type: input.type } : undefined,
          ...(input.search && {
            name: { contains: input.search, mode: "insensitive" },
          }),
        },
        include: {
          template: {
            select: { id: true, name: true, type: true, sections: true, scoringLogic: true },
          },
          processingActivity: {
            select: { id: true, name: true },
          },
          vendor: {
            select: { id: true, name: true },
          },
          responses: { select: { questionId: true, response: true } },
          _count: {
            select: {
              responses: true,
              mitigations: true,
              approvals: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
      });

      let nextCursor: string | undefined;
      if (assessments.length > input.limit) {
        const nextItem = assessments.pop();
        nextCursor = nextItem?.id;
      }

      // Risk figures are derived from the answers; the template's sections and
      // the answers are loaded for that only and not returned.
      return {
        assessments: assessments.map(({ responses, template, ...a }) => ({
          ...withDerivedRisk(a, template, responses),
          template: template && { id: template.id, name: template.name, type: template.type },
        })),
        nextCursor,
      };
    }),

  // Get assessment by ID
  getById: organizationProcedure
    .input(z.object({ organizationId: z.string(), id: z.string() }))
    .query(async ({ ctx, input }) => {
      const assessment = await ctx.prisma.assessment.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organization.id,
        },
        include: {
          template: {
            select: { id: true, name: true, type: true, description: true, sections: true, scoringLogic: true, version: true },
          },
          processingActivity: {
            select: { id: true, name: true, purpose: true },
          },
          vendor: {
            select: { id: true, name: true, riskTier: true, metadata: true },
          },
          responses: {
            include: {
              responder: {
                select: { id: true, name: true, email: true },
              },
            },
            orderBy: { respondedAt: "desc" },
          },
          mitigations: {
            orderBy: { priority: "asc" },
          },
          approvals: {
            include: {
              approver: {
                select: { id: true, name: true, email: true },
              },
            },
            orderBy: { level: "asc" },
          },
          versions: {
            select: { id: true, version: true, changedBy: true, changeNotes: true, createdAt: true },
            orderBy: { version: "desc" },
            take: 5,
          },
          risks: { orderBy: { createdAt: "asc" } },
        },
      });

      if (!assessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment not found",
        });
      }

      // Calculate completion percentage
      const template = assessment.template;
      if (!template) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Assessment template is missing: it may have been deleted",
        });
      }
      const { completionPercentage, totalQuestions } = assessmentProgress(
        template,
        assessment.responses
      );

      const [due] =
        assessment.status === AssessmentStatus.APPROVED
          ? await reviewDueAssessments(ctx.prisma, ctx.organization.id, assessment.id)
          : [];

      return {
        ...withDerivedRisk(assessment, template, assessment.responses),
        completionPercentage,
        totalQuestions,
        /** Why the approved assessment should be reviewed, empty when it need not be. */
        reviewDueReasons: due?.reasons ?? [],
      };
    }),

  // Create assessment
  create: writerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        templateId: z.string(),
        name: z.string().min(1),
        description: z.string().optional(),
        processingActivityId: z.string().optional(),
        vendorId: z.string().optional(),
        dueDate: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify template access. A superseded or inactive template is not
      // offered for new assessments (listTemplates), so it is not accepted here.
      const template = await ctx.prisma.assessmentTemplate.findFirst({
        where: {
          id: input.templateId,
          OR: [
            { organizationId: ctx.organization.id },
            { isSystem: true },
          ],
          isActive: true,
          supersededAt: null,
        },
      });

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Template not found",
        });
      }

      // The DPIA is open to every organisation: the premium check below is for
      // the other premium types.
      if (template.type !== AssessmentType.DPIA && isPremiumAssessmentType(template.type)) {
        const entitlementResult = await checkAssessmentEntitlement(
          ctx.organization.id,
          template.type
        );

        if (!entitlementResult.entitled) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `${template.type} assessments require a premium license. ${features.selfServiceUpgrade ? "Upgrade your plan to access this feature." : `Contact ${brand.companyName} to enable this feature.`}`,
          });
        }
      }

      // The linked activity and vendor must be the caller's own (F2)
      const orgScope = { organizationId: ctx.organization.id };
      await assertIdsInOrg(ctx.prisma.processingActivity, [input.processingActivityId], orgScope, "Processing activity");
      await assertIdsInOrg(ctx.prisma.vendor, [input.vendorId], orgScope, "Vendor");

      const assessment = await ctx.prisma.assessment.create({
        data: {
          organizationId: ctx.organization.id,
          templateId: input.templateId,
          name: input.name,
          description: input.description,
          processingActivityId: input.processingActivityId,
          vendorId: input.vendorId,
          dueDate: input.dueDate,
          status: AssessmentStatus.DRAFT,
        },
        include: {
          template: true,
        },
      });

      // A DPIA starts with its frameworks chosen from the jurisdictions the
      // organisation declared (California only: the California risk
      // assessment; the EU: Article 35; both: both). It is an ordinary answer
      // to the first question, so the person can change it there.
      if (template.type === AssessmentType.DPIA) {
        await preselectDpiaFrameworks(ctx.prisma, {
          organizationId: ctx.organization.id,
          assessmentId: assessment.id,
          sections: template.sections,
          userId: ctx.session.user.id,
          locale: pilotLocale(localeFromCookieGetter(ctx.getCookie)),
        });
      }

      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "Assessment",
          entityId: assessment.id,
          action: "CREATE",
          // The template type is recorded here so the trial's count of impact
          // assessments survives a deletion (services/pilot/caps.ts).
          changes: { ...input, templateType: template.type },
        },
      });

      return assessment;
    }),

  // Create a TIA assessment linked to an existing data transfer.
  // Looks up the system TIA template (seeded as `system-tia-template`),
  // creates a new Assessment with type=TIA, links it to the transfer,
  // and returns it for navigation. If a TIA already exists for this
  // transfer that is not COMPLETED/REJECTED, it is returned as-is.
  createForTransfer: writerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        dataTransferId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const transfer = await ctx.prisma.dataTransfer.findFirst({
        where: { id: input.dataTransferId, organizationId: ctx.organization.id },
      });
      if (!transfer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Transfer not found" });
      }

      // Reuse an existing in-progress TIA if one exists for this transfer
      const existing = await ctx.prisma.assessment.findFirst({
        where: {
          dataTransferId: transfer.id,
          status: { notIn: [AssessmentStatus.APPROVED, AssessmentStatus.REJECTED, AssessmentStatus.ARCHIVED] },
        },
        orderBy: { createdAt: "desc" },
      });
      if (existing) return existing;

      // Find a TIA template: prefer org-owned, fall back to system, and never a
      // template retired by a newer version (supersededAt set).
      const template = await ctx.prisma.assessmentTemplate.findFirst({
        where: {
          type: AssessmentType.TIA,
          isActive: true,
          supersededAt: null,
          OR: [
            { organizationId: ctx.organization.id },
            { isSystem: true },
          ],
        },
        orderBy: [{ isSystem: "asc" }, { createdAt: "desc" }],
      });
      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "TIA template not available. Run the template seed script first.",
        });
      }

      const assessment = await ctx.prisma.assessment.create({
        data: {
          organizationId: ctx.organization.id,
          templateId: template.id,
          dataTransferId: transfer.id,
          processingActivityId: transfer.processingActivityId ?? undefined,
          name: tiaRecordName(transfer.name, localeFromCookieGetter(ctx.getCookie)),
          description: tiaRecordDescription(transfer.destinationCountry, localeFromCookieGetter(ctx.getCookie)),
          status: AssessmentStatus.DRAFT,
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "Assessment",
          entityId: assessment.id,
          action: "CREATE",
          changes: { source: "transfer", dataTransferId: transfer.id },
        },
      });

      return assessment;
    }),

  // Save response
  // Delete a draft assessment, one not yet submitted (DRAFT or IN_PROGRESS),
  // for owners and admins. Submitted, approved or rejected assessments are kept: they are the record of a decision. Its
  // answers, measures, approvals and versions go with it (cascade). On the
  // hosted pilot the free-DPIA count is of DPIAs created, so deleting a
  // draft does not give one back (services/pilot/caps.ts).
  delete: adminOrgProcedure
    .input(z.object({ organizationId: z.string(), id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const assessment = await ctx.prisma.assessment.findFirst({
        where: { id: input.id, organizationId: ctx.organization.id },
        select: { id: true, name: true, status: true },
      });
      if (!assessment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Assessment not found" });
      }
      if (!DELETABLE_ASSESSMENT_STATUSES.includes(assessment.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only a draft assessment can be deleted" });
      }
      await ctx.prisma.aISystem.updateMany({
        where: { organizationId: ctx.organization.id, assessmentId: input.id },
        data: { assessmentId: null },
      });
      await ctx.prisma.assessment.deleteMany({
        where: { id: input.id, organizationId: ctx.organization.id, status: { in: DELETABLE_ASSESSMENT_STATUSES } },
      });
      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "Assessment",
          entityId: input.id,
          action: "DELETE",
          changes: { name: assessment.name },
        },
      });
      return { success: true };
    }),

  saveResponse: writerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        assessmentId: z.string(),
        questionId: z.string(),
        sectionId: z.string(),
        response: z.any(),
        riskScore: z.number().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify assessment belongs to org
      const assessment = await ctx.prisma.assessment.findFirst({
        where: { id: input.assessmentId, organizationId: ctx.organization.id },
      });

      if (!assessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment not found",
        });
      }

      assertContentEditable(assessment.status, ctx.membership.role, requestLocale(ctx));

      // A multi-select with every option unticked is no answer: remove the
      // stored response, so the question counts as unanswered again.
      if (isEmptyAnswer(input.response)) {
        await ctx.prisma.assessmentResponse.deleteMany({
          where: { assessmentId: input.assessmentId, questionId: input.questionId },
        });
        return null;
      }

      const response = await ctx.prisma.assessmentResponse.upsert({
        where: {
          assessmentId_questionId: {
            assessmentId: input.assessmentId,
            questionId: input.questionId,
          },
        },
        update: {
          response: input.response,
          riskScore: input.riskScore,
          notes: input.notes,
          responderId: ctx.session.user.id,
          respondedAt: new Date(),
        },
        create: {
          assessmentId: input.assessmentId,
          questionId: input.questionId,
          sectionId: input.sectionId,
          response: input.response,
          riskScore: input.riskScore,
          notes: input.notes,
          responderId: ctx.session.user.id,
        },
      });

      // Update assessment status if still draft
      if (assessment.status === AssessmentStatus.DRAFT) {
        await ctx.prisma.assessment.update({
          where: { id: input.assessmentId },
          data: { status: AssessmentStatus.IN_PROGRESS },
        });
      }

      return response;
    }),

  // Delete responses (used to remove a repeatable-section instance / risk row).
  deleteResponses: writerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        assessmentId: z.string(),
        questionIds: z.array(z.string()).min(1).max(200),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const assessment = await ctx.prisma.assessment.findFirst({
        where: { id: input.assessmentId, organizationId: ctx.organization.id },
      });
      if (!assessment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Assessment not found" });
      }
      assertContentEditable(assessment.status, ctx.membership.role, requestLocale(ctx));
      const result = await ctx.prisma.assessmentResponse.deleteMany({
        where: { assessmentId: input.assessmentId, questionId: { in: input.questionIds } },
      });
      return { deleted: result.count };
    }),

  // Calculate and update risk score
  calculateRisk: writerProcedure
    .input(z.object({ organizationId: z.string(), assessmentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const assessment = await ctx.prisma.assessment.findFirst({
        where: { id: input.assessmentId, organizationId: ctx.organization.id },
        include: {
          template: true,
          responses: true,
        },
      });

      if (!assessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment not found",
        });
      }

      if (!assessment.template) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Assessment template is missing: it may have been deleted",
        });
      }

      // Approved figures are frozen.
      if (assessment.riskFrozenAt) return assessment;

      const register = await loadRegister(ctx.prisma, assessment.id);
      const updated = await ctx.prisma.assessment.update({
        where: { id: input.assessmentId },
        data: scoreFigures(assessment.template, assessment.responses, register.summary),
      });

      return updated;
    }),

  // Submit for review
  submit: writerProcedure
    .input(z.object({ organizationId: z.string(), assessmentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const assessment = await ctx.prisma.assessment.findFirst({
        where: { id: input.assessmentId, organizationId: ctx.organization.id },
        include: {
          template: true,
          responses: true,
        },
      });

      if (!assessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment not found",
        });
      }

      if (!assessment.template) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Assessment template is missing: it may have been deleted",
        });
      }

      const locale = requestLocale(ctx);

      // Only a draft, an assessment in progress or a rejected one is
      // submitted: an approved one is never sent back to review this way.
      if (!canSubmitFrom(assessment.status)) throw workflowError("submitStatus", locale);

      // Check all required questions are answered (visible ones only)
      const unanswered = unansweredRequired(assessment.template, assessment.responses);

      if (unanswered.length > 0) {
        throw unansweredError(assessment.template, unanswered, locale);
      }

      const register = await loadRegister(ctx.prisma, assessment.id);
      assertArt36(assessment.template, assessment.responses, register.summary, locale);

      const figures = scoreFigures(assessment.template, assessment.responses, register.summary);
      const score = figures.riskScore;
      const level = figures.riskLevel;

      // Create version snapshot
      const latestVersion = await ctx.prisma.assessmentVersion.findFirst({
        where: { assessmentId: input.assessmentId },
        orderBy: { version: "desc" },
      });

      await ctx.prisma.assessmentVersion.create({
        data: {
          assessmentId: input.assessmentId,
          version: (latestVersion?.version ?? 0) + 1,
          snapshot: JSON.parse(
            JSON.stringify({
              responses: assessment.responses,
              risks: register.risks,
              ...figures,
            })
          ),
          changedBy: ctx.session.user.id,
          changeNotes: VERSION_NOTES.submitted,
        },
      });

      const updated = await ctx.prisma.assessment.update({
        where: { id: input.assessmentId },
        data: {
          status: AssessmentStatus.PENDING_REVIEW,
          submittedAt: new Date(),
          ...figures,
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "Assessment",
          entityId: input.assessmentId,
          action: "SUBMIT",
          changes: { riskScore: score, riskLevel: level },
        },
      });

      return updated;
    }),

  // ============================================================
  // MITIGATIONS
  // ============================================================

  // Add mitigation
  addMitigation: writerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        assessmentId: z.string(),
        riskId: z.string(),
        title: z.string().min(1),
        description: z.string().optional(),
        priority: z.number().min(1).max(5).default(3),
        owner: z.string().optional(),
        dueDate: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const assessment = await ctx.prisma.assessment.findFirst({
        where: { id: input.assessmentId, organizationId: ctx.organization.id },
      });

      if (!assessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment not found",
        });
      }

      const locale = requestLocale(ctx);
      assertContentEditable(assessment.status, ctx.membership.role, locale);
      await assertRiskOfAssessment(ctx.prisma, input.assessmentId, input.riskId, locale);

      return ctx.prisma.assessmentMitigation.create({
        data: {
          assessmentId: input.assessmentId,
          riskId: input.riskId,
          title: input.title,
          description: input.description,
          priority: input.priority,
          owner: input.owner,
          dueDate: input.dueDate,
          status: MitigationStatus.IDENTIFIED,
        },
      });
    }),

  // Update mitigation
  updateMitigation: writerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        id: z.string(),
        status: z.nativeEnum(MitigationStatus).optional(),
        title: z.string().optional(),
        description: z.string().optional().nullable(),
        priority: z.number().min(1).max(5).optional(),
        owner: z.string().optional().nullable(),
        dueDate: z.date().optional().nullable(),
        evidence: z.string().optional().nullable(),
        /** The register risk this measure addresses ("manual" for none). */
        riskId: z.string().min(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, organizationId, ...data } = input;

      const mitigation = await ctx.prisma.assessmentMitigation.findFirst({
        where: { id },
        include: { assessment: true },
      });

      if (!mitigation || mitigation.assessment.organizationId !== ctx.organization.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Mitigation not found",
        });
      }

      const locale = requestLocale(ctx);
      assertContentEditable(mitigation.assessment.status, ctx.membership.role, locale);
      if (input.riskId) await assertRiskOfAssessment(ctx.prisma, mitigation.assessmentId, input.riskId, locale);

      const updateData: any = { ...data };
      if (input.status === MitigationStatus.IMPLEMENTED || input.status === MitigationStatus.VERIFIED) {
        updateData.completedAt = new Date();
      }

      return ctx.prisma.assessmentMitigation.update({
        where: { id },
        data: updateData,
      });
    }),

  // ============================================================
  // APPROVALS
  // ============================================================

  // Request approval
  requestApproval: officerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        assessmentId: z.string(),
        approverId: z.string(),
        level: z.number().min(1).default(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const assessment = await ctx.prisma.assessment.findFirst({
        where: { id: input.assessmentId, organizationId: ctx.organization.id },
      });

      if (!assessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment not found",
        });
      }

      // A draft is never sent for approval: it is submitted (and checked) first.
      if (!canRequestApprovalFrom(assessment.status)) {
        throw workflowError("requestApprovalStatus", requestLocale(ctx));
      }

      // Verify approver is in the organization
      const approverMembership = await ctx.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: ctx.organization.id,
            userId: input.approverId,
          },
        },
      });

      const locale = requestLocale(ctx);
      if (!approverMembership) throw workflowError("approverMember", locale);
      // Only reviewers decide (processApproval is an officer procedure), so
      // naming anyone else would leave the assessment stuck.
      if (!isReviewerRole(approverMembership.role)) throw workflowError("approverRole", locale);

      const approval = await ctx.prisma.assessmentApproval.create({
        data: {
          assessmentId: input.assessmentId,
          approverId: input.approverId,
          level: input.level,
          status: ApprovalStatus.PENDING,
        },
        include: {
          approver: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      await ctx.prisma.assessment.update({
        where: { id: input.assessmentId },
        data: { status: AssessmentStatus.PENDING_APPROVAL },
      });

      return approval;
    }),

  // Process approval decision
  processApproval: officerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        approvalId: z.string(),
        decision: z.enum(["APPROVED", "REJECTED"]),
        comments: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const approval = await ctx.prisma.assessmentApproval.findFirst({
        where: { id: input.approvalId },
        include: { assessment: true },
      });

      if (!approval || approval.assessment.organizationId !== ctx.organization.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Approval not found",
        });
      }

      if (approval.approverId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not the assigned approver",
        });
      }

      const locale = requestLocale(ctx);

      // A decision is taken once. Reversing it needs a new revision.
      if (approval.status !== ApprovalStatus.PENDING) throw workflowError("approvalDecided", locale);
      if (approval.assessment.status !== AssessmentStatus.PENDING_APPROVAL) {
        throw workflowError("notAwaitingApproval", locale);
      }

      // Article 36 is checked again at approval: the answers are frozen while
      // approval is pending, but an assessment submitted before this check
      // existed may still hold the pair.
      const full = await ctx.prisma.assessment.findFirst({
        where: { id: approval.assessmentId },
        include: { template: true, responses: true, approvals: true },
      });
      if (!full?.template) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Assessment template is missing: it may have been deleted",
        });
      }
      if (input.decision === "APPROVED") {
        const register = await loadRegister(ctx.prisma, full.id);
        assertArt36(full.template, full.responses, register.summary, locale);
      }

      const updated = await ctx.prisma.assessmentApproval.update({
        where: { id: input.approvalId },
        data: {
          status: input.decision as ApprovalStatus,
          comments: input.comments,
          decidedAt: new Date(),
        },
      });

      // The assessment is approved only when every level of the current round
      // has approved; one rejection rejects it.
      const round = currentRound(
        full.approvals.map((a) => (a.id === updated.id ? updated : a)),
        full.submittedAt
      );
      const outcome = approvalRoundOutcome(round);

      let updatedAssessment = full as { id: string; dataTransferId: string | null };
      if (outcome === "APPROVED") {
        updatedAssessment = await freezeApproved(ctx.prisma, {
          assessment: full as typeof full & { template: NonNullable<typeof full.template> },
          userId: ctx.session.user.id,
          note: VERSION_NOTES.approved,
        });
      } else if (outcome === "REJECTED") {
        updatedAssessment = await ctx.prisma.assessment.update({
          where: { id: full.id },
          data: { status: AssessmentStatus.REJECTED, completedAt: null },
        });
      }

      // If this is a TIA linked to a transfer, sync the transfer's tiaCompleted/tiaDate
      if (outcome === "APPROVED" && updatedAssessment.dataTransferId) {
        await ctx.prisma.dataTransfer.update({
          where: { id: updatedAssessment.dataTransferId },
          data: { tiaCompleted: true, tiaDate: new Date() },
        });
      }

      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "Assessment",
          entityId: approval.assessmentId,
          action: `APPROVAL_${input.decision}`,
          changes: { comments: input.comments, level: approval.level, outcome },
        },
      });

      return updated;
    }),

  // Submit and auto-approve (for single-user organizations)
  submitAndApprove: writerProcedure
    .input(z.object({ organizationId: z.string(), assessmentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const assessment = await ctx.prisma.assessment.findFirst({
        where: { id: input.assessmentId, organizationId: ctx.organization.id },
        include: {
          template: true,
          responses: true,
        },
      });

      if (!assessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment not found",
        });
      }

      if (!assessment.template) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Assessment template is missing: it may have been deleted",
        });
      }

      const locale = requestLocale(ctx);
      if (!canSubmitFrom(assessment.status)) throw workflowError("submitStatus", locale);

      // Check all required questions are answered (visible ones only)
      const unanswered = unansweredRequired(assessment.template, assessment.responses);

      if (unanswered.length > 0) {
        throw unansweredError(assessment.template, unanswered, locale);
      }

      // Verify this is a single-user org
      const memberCount = await ctx.prisma.organizationMember.count({
        where: { organizationId: ctx.organization.id },
      });

      if (memberCount > 1) throw workflowError("singleUserOnly", locale);

      const register = await loadRegister(ctx.prisma, assessment.id);
      assertArt36(assessment.template, assessment.responses, register.summary, locale);

      // Create approval record for the current user, already approved
      await ctx.prisma.assessmentApproval.create({
        data: {
          assessmentId: input.assessmentId,
          approverId: ctx.session.user.id,
          level: 1,
          status: ApprovalStatus.APPROVED,
          decidedAt: new Date(),
        },
      });

      // Approve and freeze what was approved
      const updated = await freezeApproved(ctx.prisma, {
        assessment,
        userId: ctx.session.user.id,
        note: VERSION_NOTES.autoApproved,
        submittedAt: new Date(),
      });
      const score = updated.riskScore;
      const level = updated.riskLevel;

      // If this is a TIA linked to a transfer, sync the transfer's tiaCompleted/tiaDate
      if (updated.dataTransferId) {
        await ctx.prisma.dataTransfer.update({
          where: { id: updated.dataTransferId },
          data: { tiaCompleted: true, tiaDate: new Date() },
        });
      }

      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "Assessment",
          entityId: input.assessmentId,
          action: "SUBMIT_AND_APPROVE",
          changes: { riskScore: score, riskLevel: level },
        },
      });

      return updated;
    }),

  // Open a new revision of an approved assessment. The approved version stays
  // in the history; the new revision goes through review and approval again.
  reopen: officerProcedure
    .input(z.object({ organizationId: z.string(), assessmentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const assessment = await ctx.prisma.assessment.findFirst({
        where: { id: input.assessmentId, organizationId: ctx.organization.id },
      });
      if (!assessment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Assessment not found" });
      }
      if (assessment.status !== AssessmentStatus.APPROVED) {
        throw workflowError("reopenStatus", requestLocale(ctx));
      }
      const latestVersion = await ctx.prisma.assessmentVersion.findFirst({
        where: { assessmentId: assessment.id },
        orderBy: { version: "desc" },
      });
      await ctx.prisma.assessmentVersion.create({
        data: {
          assessmentId: assessment.id,
          version: (latestVersion?.version ?? 0) + 1,
          snapshot: { reopenedFrom: assessment.approvedVersion ?? null },
          changedBy: ctx.session.user.id,
          changeNotes: VERSION_NOTES.reopened,
        },
      });
      const updated = await ctx.prisma.assessment.update({
        where: { id: assessment.id },
        data: { status: AssessmentStatus.IN_PROGRESS, completedAt: null, riskFrozenAt: null },
      });
      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "Assessment",
          entityId: assessment.id,
          action: "REOPEN",
          changes: { approvedVersion: assessment.approvedVersion },
        },
      });
      return updated;
    }),

  // ============================================================
  // RISK REGISTER (GDPR Art. 35(7)(c)): one row per risk, graded before and
  // after measures on the same 1 to 4 scale.
  // ============================================================

  addRisk: writerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        assessmentId: z.string(),
        title: z.string().trim().min(1).max(300),
        description: z.string().max(10_000).optional(),
        rightsAffected: z.string().max(2_000).optional(),
        likelihood: z.number().int().min(1).max(4),
        severity: z.number().int().min(1).max(4),
        residualLikelihood: z.number().int().min(1).max(4).nullable().optional(),
        residualSeverity: z.number().int().min(1).max(4).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const assessment = await ctx.prisma.assessment.findFirst({
        where: { id: input.assessmentId, organizationId: ctx.organization.id },
      });
      if (!assessment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Assessment not found" });
      }
      assertContentEditable(assessment.status, ctx.membership.role, requestLocale(ctx));
      const { assessmentId, title, description, rightsAffected, likelihood, severity, residualLikelihood, residualSeverity } = input;
      return ctx.prisma.assessmentRisk.create({
        data: { assessmentId, title, description, rightsAffected, likelihood, severity, residualLikelihood, residualSeverity },
      });
    }),

  updateRisk: writerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        id: z.string(),
        title: z.string().trim().min(1).max(300).optional(),
        description: z.string().max(10_000).nullable().optional(),
        rightsAffected: z.string().max(2_000).nullable().optional(),
        likelihood: z.number().int().min(1).max(4).optional(),
        severity: z.number().int().min(1).max(4).optional(),
        residualLikelihood: z.number().int().min(1).max(4).nullable().optional(),
        residualSeverity: z.number().int().min(1).max(4).nullable().optional(),
        status: z.enum(["OPEN", "CLOSED"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const risk = await ctx.prisma.assessmentRisk.findFirst({
        where: { id: input.id, assessment: { organizationId: ctx.organization.id } },
        include: { assessment: { select: { id: true, status: true } } },
      });
      if (!risk) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Risk not found" });
      }
      const locale = requestLocale(ctx);
      assertContentEditable(risk.assessment.status, ctx.membership.role, locale);

      const { id, status, title, description, rightsAffected, likelihood, severity, residualLikelihood, residualSeverity } = input;
      const fields = { title, description, rightsAffected, likelihood, severity, residualLikelihood, residualSeverity };
      const next = {
        ...risk,
        residualLikelihood: residualLikelihood === undefined ? risk.residualLikelihood : residualLikelihood,
        residualSeverity: residualSeverity === undefined ? risk.residualSeverity : residualSeverity,
      };
      // A closed risk stays consistent: it keeps a measure and a graded residual.
      const closing = status === "CLOSED" || (status === undefined && risk.status === "CLOSED");
      if (closing) {
        const measures = await ctx.prisma.assessmentMitigation.findMany({
          where: { assessmentId: risk.assessmentId },
          select: { riskId: true, status: true },
        });
        const refusal = closeRefusal(next, measures);
        if (refusal === "NO_MEASURE") throw workflowError("riskNoMeasure", locale);
        if (refusal === "NO_RESIDUAL") throw workflowError("riskNoResidual", locale);
      }
      return ctx.prisma.assessmentRisk.update({
        where: { id },
        data: {
          ...fields,
          ...(status ? { status, closedAt: status === "CLOSED" ? (risk.closedAt ?? new Date()) : null } : {}),
        },
      });
    }),

  deleteRisk: writerProcedure
    .input(z.object({ organizationId: z.string(), id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const risk = await ctx.prisma.assessmentRisk.findFirst({
        where: { id: input.id, assessment: { organizationId: ctx.organization.id } },
        include: { assessment: { select: { status: true } } },
      });
      if (!risk) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Risk not found" });
      }
      assertContentEditable(risk.assessment.status, ctx.membership.role, requestLocale(ctx));
      // Its measures stay, no longer tied to a risk.
      await ctx.prisma.assessmentMitigation.updateMany({
        where: { assessmentId: risk.assessmentId, riskId: risk.id },
        data: { riskId: "manual" },
      });
      await ctx.prisma.assessmentRisk.delete({ where: { id: risk.id } });
      return { deleted: true };
    }),

  // ============================================================
  // PET-BASED MITIGATION SUGGESTIONS
  // ============================================================

  getSuggestedMitigations: organizationProcedure
    .input(z.object({ organizationId: z.string(), assessmentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const assessment = await ctx.prisma.assessment.findFirst({
        where: { id: input.assessmentId, organizationId: ctx.organization.id },
        include: {
          template: true,
          responses: true,
          vendor: true,
          mitigations: { select: { title: true } },
        },
      });

      if (!assessment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Assessment not found" });
      }

      if (!assessment.template) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Assessment template is missing: it may have been deleted",
        });
      }

      // 1. Detect risks from template questions and responses
      const sections = (assessment.template.sections as any[]) || [];
      const detectedRiskIds = new Set<string>();

      for (const section of sections) {
        for (const question of (section.questions || []) as any[]) {
          // Check question text for risk signals
          const questionRisks = detectRisksFromText(question.text || "");
          if (question.helpText) {
            detectRisksFromText(question.helpText).forEach((r) => questionRisks.push(r));
          }

          // Only include if question has a high-risk response
          const response = assessment.responses.find((r) => r.questionId === question.id);
          const riskScore = response?.riskScore ?? question.riskScore ?? 0;

          if (riskScore > 0.3 || questionRisks.length > 0) {
            questionRisks.forEach((r) => detectedRiskIds.add(r));
          }
        }
      }

      // 2. Build risk-based suggestions
      const existingTitles = new Set(assessment.mitigations.map((m) => m.title));

      const riskBasedSuggestions = PET_RISK_MAPPINGS
        .filter((m) => detectedRiskIds.has(m.riskId))
        .map((mapping) => ({
          riskId: mapping.riskId,
          label: mapping.label,
          description: mapping.description,
          gdprReference: mapping.gdprReference,
          recommendedPets: mapping.recommendedPets.filter(
            (pet) => !existingTitles.has(`Implement ${pet}`)
          ),
        }))
        .filter((s) => s.recommendedPets.length > 0);

      // 3. Extract vendor PETs
      const vendorPets: string[] = [];
      if (assessment.vendor?.metadata) {
        const meta = assessment.vendor.metadata as any;
        if (Array.isArray(meta.privacyTechnologies)) {
          vendorPets.push(...meta.privacyTechnologies);
        }
      }

      return {
        riskBasedSuggestions,
        vendorPets,
        vendorName: assessment.vendor?.name ?? null,
      };
    }),

  // ============================================================
  // STATISTICS
  // ============================================================

  getStats: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      const [total, byStatus, byType, byRiskLevel] = await Promise.all([
        ctx.prisma.assessment.count({
          where: { organizationId: ctx.organization.id },
        }),
        ctx.prisma.assessment.groupBy({
          by: ["status"],
          where: { organizationId: ctx.organization.id },
          _count: true,
        }),
        ctx.prisma.assessment.groupBy({
          by: ["templateId"],
          where: { organizationId: ctx.organization.id },
          _count: true,
        }),
        ctx.prisma.assessment.findMany({
          where: {
            organizationId: ctx.organization.id,
            riskLevel: { not: null },
          },
          select: {
            riskLevel: true,
            riskScore: true,
            template: { select: { type: true, sections: true, scoringLogic: true } },
            responses: { select: { questionId: true, response: true } },
          },
        }),
      ]);

      return {
        total,
        byStatus: byStatus.reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {}),
        byRiskLevel: byRiskLevel.reduce<Record<string, number>>((acc, a) => {
          const level = withDerivedRisk(a, a.template, a.responses).riskLevel!;
          acc[level] = (acc[level] ?? 0) + 1;
          return acc;
        }, {}),
        templateCount: byType.length,
      };
    }),

  // Approved assessments whose processing activity has changed in a way that
  // matters since the approval (Art. 35(11)): for the items needing action.
  reviewDue: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(({ ctx }) => reviewDueAssessments(ctx.prisma, ctx.organization.id)),

  // Get entitled assessment types for the current organization
  getEntitledTypes: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      await ensureHostedTemplates();
      const entitledTypes = await getEntitledAssessmentTypes(ctx.organization.id);
      return { entitledTypes };
    }),

  // ============================================================
  // DPIA AUTO-FILL FROM PROCESSING ACTIVITY (Feature 3)
  // ============================================================

  generateDpiaFromActivity: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        processingActivityId: z.string(),
        vendorId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Shared context assembly (same loader the AI path uses)
      const { activity, vendor, assets, elements, transfers } =
        await buildAutoFillContext(
          ctx.prisma,
          ctx.organization.id,
          input.processingActivityId,
          input.vendorId
        );

      // Auto-filled answers. Every one of them is written against a question
      // the standard DPIA template actually asks; the ids live in one place
      // (src/config/dpia-auto-fill-targets.ts) and a test holds them to the
      // template. A draft with nowhere to land is not produced at all.
      const suggestions: {
        sectionId: string;
        questionId: string;
        suggestedResponse: string;
        confidence: "high" | "medium" | "low";
        source: string;
      }[] = [];

      const suggest = (
        target: AutoFillTarget,
        suggestedResponse: string,
        confidence: "high" | "medium" | "low",
        source: string
      ) => suggestions.push({ ...target, suggestedResponse, confidence, source });

      const autoFillLocale = localeFromCookieGetter(ctx.getCookie);
      const text = dpiaAutoFillText(autoFillLocale);
      // A fixed option is shown in the reader's language: the same position in
      // that language's option list (answers are matched by position).
      const optionInLocale = (questionId: string, stored: string): string => {
        if (autoFillLocale !== "es") return stored;
        type OptionSection = { id: string; questions: Array<{ id: string; options?: string[] }> };
        const storedSections = dpiaTemplateSections as unknown as OptionSection[];
        const storedQ = storedSections.flatMap((s) => s.questions).find((q) => q.id === questionId);
        const shownQ = (sectionsForLocale("DPIA", dpiaTemplateSections as never, "es") as unknown as OptionSection[])
          .flatMap((s) => s.questions ?? [])
          .find((q) => q.id === questionId);
        const i = storedQ?.options?.indexOf(stored) ?? -1;
        return (i >= 0 && shownQ?.options?.[i]) || stored;
      };

      // Purpose of the processing
      suggest(
        AUTO_FILL_TARGETS.purpose,
        `${activity.name}: ${activity.purpose || activity.description || text.purposeFallback}`,
        "high",
        text.source.purpose
      );

      // Legal basis, as the exact option the question offers
      const legalBasisOption = activity.legalBasis
        ? LEGAL_BASIS_OPTIONS[activity.legalBasis]
        : undefined;
      if (legalBasisOption) {
        suggest(
          AUTO_FILL_TARGETS.legalBasis,
          optionInLocale(AUTO_FILL_TARGETS.legalBasis.questionId, legalBasisOption),
          "high",
          text.source.legalBasis
        );
      }

      // Data categories
      const specialCat = elements.filter((e) => e.isSpecialCategory);
      if (elements.length > 0) {
        const categories = [...new Set(elements.map((e) => e.category))];
        suggest(
          AUTO_FILL_TARGETS.dataCategories,
          text.dataCategories(
            categories,
            elements.map((e) => e.name),
            specialCat.map((e) => e.name)
          ),
          "high",
          text.source.elements
        );

        if (specialCat.length > 0) {
          suggest(
            AUTO_FILL_TARGETS.sensitivity,
            optionInLocale(AUTO_FILL_TARGETS.sensitivity.questionId, SENSITIVITY_SPECIAL_CATEGORY),
            "high",
            text.source.specialElements
          );
          suggest(AUTO_FILL_TARGETS.specialCategory, "Yes", "high", text.source.specialElements);
        }
      }

      // Recipients, and the vendor that processes the data. The data subjects
      // are not recipients and are asked by their own question (q1_4).
      const recipientLines = [
        ...(activity.recipients.length > 0 ? [text.recipients(activity.recipients)] : []),
        ...(vendor ? [text.processedBy(vendor.name, vendor.certifications)] : []),
      ];
      if (recipientLines.length > 0) {
        suggest(
          AUTO_FILL_TARGETS.recipients,
          recipientLines.join(" "),
          "high",
          text.source.recipients
        );
      }

      // Retention
      if (activity.retentionPeriod) {
        suggest(
          AUTO_FILL_TARGETS.retention,
          text.retention(activity.retentionPeriod, activity.retentionDays ?? null),
          "high",
          text.source.retention
        );
      }

      // International transfers
      if (transfers.length > 0) {
        suggest(
          AUTO_FILL_TARGETS.transfers,
          text.transfers(transfers),
          "medium",
          text.source.transfers
        );
      }

      // Data minimisation: only drafted from data elements actually recorded.
      if (elements.length > 0) {
        suggest(
          AUTO_FILL_TARGETS.minimisation,
          text.minimisation(elements.length, assets.length, activity.purpose || activity.name),
          "medium",
          text.source.minimisation
        );
      }

      // Risks to data subjects, only from factors the records show. Large
      // scale is a matter of the number of data subjects (q1_5), which the
      // activity does not record, so it is never asserted here.
      const hasTransfers = transfers.length > 0;
      const hasRiskFactors = specialCat.length > 0 || hasTransfers;

      if (hasRiskFactors) {
        suggest(
          AUTO_FILL_TARGETS.risks,
          text.risks({
            specialCategory: specialCat.length > 0,
            transferDestinations: transfers.length,
            largeScale: false,
          }),
          "medium",
          text.source.risks
        );
      }
      const hasSpecialData = specialCat.length > 0;

      return {
        activityName: activity.name,
        vendorName: vendor?.name ?? null,
        suggestions,
        context: {
          assetCount: assets.length,
          elementCount: elements.length,
          transferCount: transfers.length,
          hasSpecialCategory: hasSpecialData,
        },
      };
    }),

  // ============================================================
  // OPTIONAL AI ASSIST (posture-gated; see services/ai/posture.ts)
  // ============================================================

  // Draft an AI risk narrative for a processing activity. Returns ONE extra
  // suggestion in the same shape as the rule-based ones (source "AI (model)",
  // low confidence to force review). The draft only ever lands in an editable
  // field via the user's explicit Insert — never written to the DB here.
  generateAiNarrative: officerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        processingActivityId: z.string(),
        vendorId: z.string().optional(),
        assessmentId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Posture gate FIRST — posture off/missing means zero AI calls and
      // no prompt building at all.
      const settings = await requireAi(ctx.prisma, ctx.organization.id);
      await assertAiRateLimit(ctx.prisma, ctx.organization.id);

      // The assessment the draft is logged against must be the caller's own (F2)
      await assertIdsInOrg(
        ctx.prisma.assessment,
        [input.assessmentId],
        { organizationId: ctx.organization.id },
        "Assessment"
      );

      // Server-side context only (shared with the rule path)
      const { context } = await buildAutoFillContext(
        ctx.prisma,
        ctx.organization.id,
        input.processingActivityId,
        input.vendorId
      );

      const locale = localeFromCookieGetter(ctx.getCookie) ?? "en";

      // Route through the lane the organization acknowledged.
      const result = await generateRiskNarrative(context, locale, postureLane(settings.posture));

      const generation = await recordGeneration(ctx.prisma, {
        organizationId: ctx.organization.id,
        userId: ctx.session.user.id,
        feature: "dpia_narrative",
        entityType: input.assessmentId ? "Assessment" : "ProcessingActivity",
        entityId: input.assessmentId ?? input.processingActivityId,
        model: result?.model ?? null,
        posture: settings.posture,
        promptTokens: result?.usage?.promptTokens ?? null,
        completionTokens: result?.usage?.completionTokens ?? null,
        totalTokens: result?.usage?.totalTokens ?? null,
        durationMs: result?.durationMs ?? null,
        status: result ? "ok" : "error",
      });

      if (!result) {
        throw new TRPCError({ code: "BAD_GATEWAY", message: "ai_failed" });
      }

      return {
        generationId: generation.id,
        model: result.model,
        content: result.content,
        // Same shape as the rule-based suggestions array
        suggestion: {
          ...AUTO_FILL_TARGETS.risks,
          suggestedResponse: result.content,
          confidence: "low" as const,
          source: `AI (${result.model})`,
        },
      };
    }),

  // Stamp acceptedAt on a generation when the user Inserts the draft.
  markAiAccepted: officerProcedure
    .input(z.object({ organizationId: z.string(), generationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await markAccepted(ctx.prisma, ctx.organization.id, input.generationId);
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Generation not found" });
      }
      return { ok: true };
    }),
});
