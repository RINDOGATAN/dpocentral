import { z } from "zod";
import { createTRPCRouter, organizationProcedure, protectedProcedure, writerProcedure, officerProcedure } from "../../trpc";
import { TRPCError } from "@trpc/server";
import { AssessmentType, AssessmentStatus, RiskLevel, MitigationStatus, ApprovalStatus } from "@prisma/client";
import {
  checkAssessmentEntitlement,
  isPremiumAssessmentType,
  getEntitledAssessmentTypes,
} from "../../services/licensing/entitlement";
import { features } from "@/config/features";
import { brand } from "@/config/brand";
import { PET_RISK_MAPPINGS, detectRisksFromText } from "@/config/pet-risk-mappings";

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
          message: "Assessment template is missing — it may have been deleted",
        });
      }
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
            message: `${template.type} assessments require a premium license. ${features.selfServiceUpgrade ? "Upgrade your plan to access this feature." : `Contact ${brand.companyName} to enable this feature.`}`,
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
          message: "Assessment template is missing — it may have been deleted",
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
          message: "Assessment template is missing — it may have been deleted",
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
          message: "Assessment template is missing — it may have been deleted",
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

      // Verify this is a single-user org
      const memberCount = await ctx.prisma.organizationMember.count({
        where: { organizationId: ctx.organization.id },
      });

      if (memberCount > 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Submit & Approve is only available for single-user organizations. Use the standard submit flow instead.",
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
          changeNotes: "Submitted and auto-approved (single-user organization)",
        },
      });

      // Create approval record for the current user, already approved
      await ctx.prisma.assessmentApproval.create({
        data: {
          assessmentId: input.assessmentId,
          approverId: ctx.session.user.id,
          level: 1,
          status: ApprovalStatus.APPROVED,
          comments: "Auto-approved (single-user organization)",
          decidedAt: new Date(),
        },
      });

      // Update assessment to APPROVED
      const updated = await ctx.prisma.assessment.update({
        where: { id: input.assessmentId },
        data: {
          status: AssessmentStatus.APPROVED,
          submittedAt: new Date(),
          completedAt: new Date(),
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
          action: "SUBMIT_AND_APPROVE",
          changes: { riskScore: score, riskLevel: level },
        },
      });

      return updated;
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
          message: "Assessment template is missing — it may have been deleted",
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
      // Load the processing activity with all linked data
      const activity = await ctx.prisma.processingActivity.findFirst({
        where: {
          id: input.processingActivityId,
          organizationId: ctx.organization.id,
        },
        include: {
          assets: {
            include: {
              dataAsset: {
                include: {
                  dataElements: true,
                },
              },
            },
          },
          transfers: true,
        },
      });

      if (!activity) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Processing activity not found",
        });
      }

      // Load vendor if specified
      const vendor = input.vendorId
        ? await ctx.prisma.vendor.findFirst({
            where: { id: input.vendorId, organizationId: ctx.organization.id },
          })
        : null;

      // Build auto-fill context
      const assets: { name: string; type: string; hostingType: string | null; vendor: string | null }[] =
        activity.assets.map((pa: any) => ({
          name: pa.dataAsset.name,
          type: pa.dataAsset.type,
          hostingType: pa.dataAsset.hostingType,
          vendor: pa.dataAsset.vendor,
        }));

      const elements: { name: string; category: string; sensitivity: string; isSpecialCategory: boolean }[] =
        activity.assets.flatMap((pa: any) =>
          pa.dataAsset.dataElements.map((e: any) => ({
            name: e.name,
            category: e.category,
            sensitivity: e.sensitivity,
            isSpecialCategory: e.isSpecialCategory,
          }))
        );

      const transfers: { destinationCountry: string; mechanism: string; safeguards: string | null }[] =
        activity.transfers.map((t: any) => ({
          destinationCountry: t.destinationCountry,
          mechanism: t.mechanism,
          safeguards: t.safeguards,
        }));

      // Generate auto-fill responses using rule engine
      const suggestions: {
        sectionId: string;
        questionId: string;
        suggestedResponse: string;
        confidence: "high" | "medium" | "low";
        source: string;
      }[] = [];

      // Section 1: Processing Description
      suggestions.push({
        sectionId: "s1",
        questionId: "s1_processing_description",
        suggestedResponse: `${activity.name}: ${activity.purpose || activity.description || "Processing activity as part of organizational operations."}`,
        confidence: "high",
        source: "Processing activity purpose",
      });

      // Legal basis
      const legalBasisMap: Record<string, string> = {
        CONSENT: "Processing is based on the data subject's consent (Art. 6(1)(a) GDPR). Consent is freely given, specific, informed, and unambiguous.",
        CONTRACT: "Processing is necessary for the performance of a contract with the data subject (Art. 6(1)(b) GDPR).",
        LEGAL_OBLIGATION: "Processing is necessary for compliance with a legal obligation to which the controller is subject (Art. 6(1)(c) GDPR).",
        VITAL_INTERESTS: "Processing is necessary to protect vital interests of the data subject or another natural person (Art. 6(1)(d) GDPR).",
        PUBLIC_TASK: "Processing is necessary for the performance of a task carried out in the public interest (Art. 6(1)(e) GDPR).",
        LEGITIMATE_INTERESTS: "Processing is based on the legitimate interests of the controller (Art. 6(1)(f) GDPR). A balancing test has been conducted to ensure interests do not override the rights of data subjects.",
      };
      if (activity.legalBasis) {
        suggestions.push({
          sectionId: "s1",
          questionId: "s1_legal_basis",
          suggestedResponse: legalBasisMap[activity.legalBasis] || `Legal basis: ${activity.legalBasis}`,
          confidence: "high",
          source: "Processing activity legal basis",
        });
      }

      // Data categories
      if (elements.length > 0) {
        const categories = [...new Set(elements.map((e) => e.category))];
        const specialCat = elements.filter((e) => e.isSpecialCategory);
        suggestions.push({
          sectionId: "s3",
          questionId: "s3_data_categories",
          suggestedResponse: `Data categories processed: ${categories.join(", ")}. Specific data elements include: ${elements.map((e) => e.name).join(", ")}.`,
          confidence: "high",
          source: "Linked data elements",
        });

        if (specialCat.length > 0) {
          suggestions.push({
            sectionId: "s3",
            questionId: "s3_special_categories",
            suggestedResponse: `Special category data is processed: ${specialCat.map((e) => e.name).join(", ")}. Additional safeguards are required under Art. 9 GDPR.`,
            confidence: "high",
            source: "Special category data elements",
          });
        }
      }

      // Data subjects
      if (activity.dataSubjects.length > 0) {
        suggestions.push({
          sectionId: "s3",
          questionId: "s3_data_subjects",
          suggestedResponse: `Data subjects affected: ${activity.dataSubjects.join(", ")}.`,
          confidence: "high",
          source: "Processing activity data subjects",
        });
      }

      // Recipients
      if (activity.recipients.length > 0) {
        suggestions.push({
          sectionId: "s3",
          questionId: "s3_recipients",
          suggestedResponse: `Data recipients: ${activity.recipients.join(", ")}.`,
          confidence: "high",
          source: "Processing activity recipients",
        });
      }

      // Retention
      if (activity.retentionPeriod) {
        suggestions.push({
          sectionId: "s4",
          questionId: "s4_retention",
          suggestedResponse: `Data retention period: ${activity.retentionPeriod}${activity.retentionDays ? ` (${activity.retentionDays} days)` : ""}. Data is deleted or anonymized after the retention period expires.`,
          confidence: "high",
          source: "Processing activity retention policy",
        });
      }

      // Security measures
      if (vendor) {
        const certs = vendor.certifications.length > 0
          ? `Vendor ${vendor.name} holds: ${vendor.certifications.join(", ")}.`
          : "";
        suggestions.push({
          sectionId: "s4",
          questionId: "s4_security",
          suggestedResponse: `Data is processed by ${vendor.name}.${certs ? " " + certs : ""} Technical and organizational measures include encryption in transit and at rest, access controls, and regular security assessments.`,
          confidence: vendor.certifications.length > 0 ? "medium" : "low",
          source: "Vendor compliance profile",
        });
      }

      // International transfers
      if (transfers.length > 0) {
        const transferSummary = transfers
          .map((t) => `${t.destinationCountry} (${t.mechanism.replace(/_/g, " ")})`)
          .join("; ");
        suggestions.push({
          sectionId: "s5",
          questionId: "s5_transfers",
          suggestedResponse: `International data transfers: ${transferSummary}. ${transfers.some((t) => t.safeguards) ? "Safeguards include: " + transfers.filter((t) => t.safeguards).map((t) => t.safeguards).join("; ") + "." : "Appropriate safeguards must be verified."}`,
          confidence: "medium",
          source: "Data transfer records",
        });
      }

      // Necessity and proportionality
      suggestions.push({
        sectionId: "s2",
        questionId: "s2_necessity",
        suggestedResponse: `The processing of ${elements.length} data elements across ${assets.length} system(s) is necessary to achieve the stated purpose: ${activity.purpose || activity.name}. Data minimization has been considered — only data elements essential to the processing purpose are collected.`,
        confidence: "medium",
        source: "Activity and data element analysis",
      });

      // Risk assessment
      const hasSpecialData = elements.some((e) => e.isSpecialCategory);
      const hasTransfers = transfers.length > 0;
      const isLargeScale = elements.length > 10;
      const riskFactors = [
        ...(hasSpecialData ? ["special category data processed"] : []),
        ...(hasTransfers ? [`international transfers to ${transfers.length} destination(s)`] : []),
        ...(isLargeScale ? ["large-scale data processing"] : []),
      ];

      suggestions.push({
        sectionId: "s7",
        questionId: "s7_risk_assessment",
        suggestedResponse: riskFactors.length > 0
          ? `Risk factors identified: ${riskFactors.join(", ")}. Mitigation measures should address each factor. Overall risk level requires assessment against the likelihood and severity of harm to data subjects.`
          : "No elevated risk factors identified based on available data. Standard data protection measures apply.",
        confidence: riskFactors.length > 0 ? "medium" : "low",
        source: "Automated risk factor analysis",
      });

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
});
