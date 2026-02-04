import { z } from "zod";
import { createTRPCRouter, organizationProcedure, protectedProcedure } from "../../trpc";
import { TRPCError } from "@trpc/server";
import { AssessmentType, AssessmentStatus, RiskLevel, MitigationStatus, ApprovalStatus } from "@prisma/client";
import {
  checkAssessmentEntitlement,
  isPremiumAssessmentType,
  getEntitledAssessmentTypes,
} from "../../services/licensing/entitlement";

// Risk scoring service
function calculateRiskScore(responses: any[], template: any): { score: number; level: RiskLevel } {
  if (!responses.length) return { score: 0, level: RiskLevel.LOW };

  let totalWeight = 0;
  let weightedSum = 0;

  for (const response of responses) {
    const weight = response.riskScore ?? 0;
    weightedSum += weight;
    totalWeight += 1;
  }

  const score = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : 0;

  let level: RiskLevel;
  if (score <= 25) level = RiskLevel.LOW;
  else if (score <= 50) level = RiskLevel.MEDIUM;
  else if (score <= 75) level = RiskLevel.HIGH;
  else level = RiskLevel.CRITICAL;

  return { score, level };
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
      return ctx.prisma.assessmentTemplate.findMany({
        where: {
          OR: [
            { organizationId: ctx.organization.id },
            { isSystem: true },
          ],
          isActive: true,
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
  createTemplate: organizationProcedure
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
  cloneTemplate: organizationProcedure
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
            select: { id: true, name: true, type: true },
          },
          processingActivity: {
            select: { id: true, name: true },
          },
          vendor: {
            select: { id: true, name: true },
          },
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

      return { assessments, nextCursor };
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
          template: true,
          processingActivity: true,
          vendor: true,
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
            orderBy: { version: "desc" },
            take: 5,
          },
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
      const sections = (template.sections as any[]) || [];
      const totalQuestions = sections.reduce(
        (sum, s) => sum + (s.questions?.length || 0),
        0
      );
      const answeredQuestions = assessment.responses.length;
      const completionPercentage = totalQuestions > 0
        ? Math.round((answeredQuestions / totalQuestions) * 100)
        : 0;

      return { ...assessment, completionPercentage, totalQuestions };
    }),

  // Create assessment
  create: organizationProcedure
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
      // Verify template access
      const template = await ctx.prisma.assessmentTemplate.findFirst({
        where: {
          id: input.templateId,
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

      // Check entitlement for premium assessment types
      if (isPremiumAssessmentType(template.type)) {
        const entitlementResult = await checkAssessmentEntitlement(
          ctx.organization.id,
          template.type
        );

        if (!entitlementResult.entitled) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `${template.type} assessments require a premium license. Contact North End Law to enable this feature.`,
          });
        }
      }

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

      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "Assessment",
          entityId: assessment.id,
          action: "CREATE",
          changes: input,
        },
      });

      return assessment;
    }),

  // Save response
  saveResponse: organizationProcedure
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

      if (assessment.status === AssessmentStatus.APPROVED) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot modify an approved assessment",
        });
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

  // Calculate and update risk score
  calculateRisk: organizationProcedure
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

      const { score, level } = calculateRiskScore(
        assessment.responses,
        assessment.template
      );

      const updated = await ctx.prisma.assessment.update({
        where: { id: input.assessmentId },
        data: {
          riskScore: score,
          riskLevel: level,
        },
      });

      return updated;
    }),

  // Submit for review
  submit: organizationProcedure
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

      // Check all required questions are answered
      const sections = (assessment.template.sections as any[]) || [];
      const requiredQuestionIds = sections.flatMap((s) =>
        (s.questions || [])
          .filter((q: any) => q.required)
          .map((q: any) => q.id)
      );
      const answeredIds = assessment.responses.map((r) => r.questionId);
      const unanswered = requiredQuestionIds.filter(
        (id) => !answeredIds.includes(id)
      );

      if (unanswered.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Please answer all required questions. Missing: ${unanswered.length}`,
        });
      }

      // Calculate risk score
      const { score, level } = calculateRiskScore(
        assessment.responses,
        assessment.template
      );

      // Create version snapshot
      const latestVersion = await ctx.prisma.assessmentVersion.findFirst({
        where: { assessmentId: input.assessmentId },
        orderBy: { version: "desc" },
      });

      await ctx.prisma.assessmentVersion.create({
        data: {
          assessmentId: input.assessmentId,
          version: (latestVersion?.version ?? 0) + 1,
          snapshot: {
            responses: assessment.responses,
            riskScore: score,
            riskLevel: level,
          },
          changedBy: ctx.session.user.id,
          changeNotes: "Submitted for review",
        },
      });

      const updated = await ctx.prisma.assessment.update({
        where: { id: input.assessmentId },
        data: {
          status: AssessmentStatus.PENDING_REVIEW,
          submittedAt: new Date(),
          riskScore: score,
          riskLevel: level,
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
  addMitigation: organizationProcedure
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
  updateMitigation: organizationProcedure
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
  requestApproval: organizationProcedure
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

      // Verify approver is in the organization
      const approverMembership = await ctx.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: ctx.organization.id,
            userId: input.approverId,
          },
        },
      });

      if (!approverMembership) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Approver must be a member of the organization",
        });
      }

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
  processApproval: organizationProcedure
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

      const updated = await ctx.prisma.assessmentApproval.update({
        where: { id: input.approvalId },
        data: {
          status: input.decision as ApprovalStatus,
          comments: input.comments,
          decidedAt: new Date(),
        },
      });

      // Update assessment status based on decision
      const newStatus = input.decision === "APPROVED"
        ? AssessmentStatus.APPROVED
        : AssessmentStatus.REJECTED;

      await ctx.prisma.assessment.update({
        where: { id: approval.assessmentId },
        data: {
          status: newStatus,
          completedAt: input.decision === "APPROVED" ? new Date() : null,
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "Assessment",
          entityId: approval.assessmentId,
          action: `APPROVAL_${input.decision}`,
          changes: { comments: input.comments },
        },
      });

      return updated;
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
        ctx.prisma.assessment.groupBy({
          by: ["riskLevel"],
          where: {
            organizationId: ctx.organization.id,
            riskLevel: { not: null },
          },
          _count: true,
        }),
      ]);

      return {
        total,
        byStatus: byStatus.reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {}),
        byRiskLevel: byRiskLevel.reduce((acc, r) => ({ ...acc, [r.riskLevel!]: r._count }), {}),
        templateCount: byType.length,
      };
    }),

  // Get entitled assessment types for the current organization
  getEntitledTypes: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      const entitledTypes = await getEntitledAssessmentTypes(ctx.organization.id);
      return { entitledTypes };
    }),
});
