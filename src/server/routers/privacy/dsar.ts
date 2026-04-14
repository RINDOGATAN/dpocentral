import { z } from "zod";
import { createTRPCRouter, publicProcedure, organizationProcedure, officerProcedure, adminOrgProcedure, sanitizeInput } from "../../trpc";
import { TRPCError } from "@trpc/server";
import { DSARType, DSARStatus, DSARTaskStatus, CommunicationDirection } from "@prisma/client";
import { addDays } from "date-fns";

// SLA Calculator service
function calculateDueDate(receivedAt: Date, jurisdictionDeadlineDays: number): Date {
  return addDays(receivedAt, jurisdictionDeadlineDays);
}

export const dsarRouter = createTRPCRouter({
  // ============================================================
  // DSAR REQUESTS
  // ============================================================

  // List all DSAR requests
  list: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        status: z.nativeEnum(DSARStatus).optional(),
        type: z.nativeEnum(DSARType).optional(),
        overdue: z.boolean().optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();

      const requests = await ctx.prisma.dSARRequest.findMany({
        where: {
          organizationId: ctx.organization.id,
          status: input.status,
          type: input.type,
          ...(input.overdue && {
            dueDate: { lt: now },
            status: { notIn: ["COMPLETED", "REJECTED", "CANCELLED"] },
          }),
          ...(input.search && {
            OR: [
              { requesterName: { contains: input.search, mode: "insensitive" } },
              { requesterEmail: { contains: input.search, mode: "insensitive" } },
              { publicId: { contains: input.search, mode: "insensitive" } },
            ],
          }),
        },
        include: {
          _count: {
            select: {
              tasks: true,
              communications: true,
            },
          },
        },
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
      });

      let nextCursor: string | undefined;
      if (requests.length > input.limit) {
        const nextItem = requests.pop();
        nextCursor = nextItem?.id;
      }

      // Add SLA status to each request
      const requestsWithSLA = requests.map((req) => {
        const daysUntilDue = Math.ceil(
          (req.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        let slaStatus: "on_track" | "at_risk" | "overdue" = "on_track";
        if (daysUntilDue < 0) slaStatus = "overdue";
        else if (daysUntilDue <= 7) slaStatus = "at_risk";

        return { ...req, daysUntilDue, slaStatus };
      });

      return { requests: requestsWithSLA, nextCursor };
    }),

  // Get a single DSAR request
  getById: organizationProcedure
    .input(z.object({ organizationId: z.string(), id: z.string() }))
    .query(async ({ ctx, input }) => {
      const request = await ctx.prisma.dSARRequest.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organization.id,
        },
        include: {
          tasks: {
            include: {
              dataAsset: true,
              assignee: {
                select: { id: true, name: true, email: true },
              },
            },
            orderBy: { createdAt: "asc" },
          },
          communications: {
            include: {
              sentBy: {
                select: { id: true, name: true, email: true },
              },
            },
            orderBy: { sentAt: "desc" },
          },
          auditLog: {
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "DSAR request not found",
        });
      }

      const now = new Date();
      const daysUntilDue = Math.ceil(
        (request.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      return { ...request, daysUntilDue };
    }),

  // Create a DSAR request (internal)
  create: officerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        type: z.nativeEnum(DSARType),
        requesterName: z.string().min(1),
        requesterEmail: z.string().email(),
        requesterPhone: z.string().optional(),
        requesterAddress: z.string().optional(),
        relationship: z.string().optional(),
        description: z.string().optional(),
        requestedData: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get organization's primary jurisdiction for SLA calculation
      const orgJurisdiction = await ctx.prisma.organizationJurisdiction.findFirst({
        where: {
          organizationId: ctx.organization.id,
          isPrimary: true,
        },
        include: {
          jurisdiction: true,
        },
      });

      // Default to GDPR 30 days if no jurisdiction set
      const deadlineDays = orgJurisdiction?.jurisdiction.dsarDeadlineDays ?? 30;
      const receivedAt = new Date();
      const dueDate = calculateDueDate(receivedAt, deadlineDays);

      const request = await ctx.prisma.dSARRequest.create({
        data: {
          organizationId: ctx.organization.id,
          type: input.type,
          status: DSARStatus.SUBMITTED,
          requesterName: input.requesterName,
          requesterEmail: input.requesterEmail,
          requesterPhone: input.requesterPhone,
          requesterAddress: input.requesterAddress,
          relationship: input.relationship,
          description: input.description,
          requestedData: input.requestedData,
          receivedAt,
          dueDate,
        },
      });

      // Create audit log entry
      await ctx.prisma.dSARAuditLog.create({
        data: {
          dsarRequestId: request.id,
          action: "REQUEST_CREATED",
          performedBy: ctx.session.user.id,
          details: { type: input.type, requestId: request.publicId },
        },
      });

      // Create audit log for organization
      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "DSARRequest",
          entityId: request.id,
          action: "CREATE",
          changes: input,
        },
      });

      return request;
    }),

  // Update DSAR request status
  updateStatus: officerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        id: z.string(),
        status: z.nativeEnum(DSARStatus),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.dSARRequest.findFirst({
        where: { id: input.id, organizationId: ctx.organization.id },
      });

      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "DSAR request not found",
        });
      }

      const updateData: any = { status: input.status };

      // Set timestamps based on status
      if (input.status === DSARStatus.IDENTITY_VERIFIED) {
        updateData.verifiedAt = new Date();
      } else if (input.status === DSARStatus.COMPLETED) {
        updateData.completedAt = new Date();
      }

      const updated = await ctx.prisma.dSARRequest.update({
        where: { id: input.id },
        data: updateData,
      });

      // Create audit log
      await ctx.prisma.dSARAuditLog.create({
        data: {
          dsarRequestId: input.id,
          action: "STATUS_CHANGED",
          performedBy: ctx.session.user.id,
          details: {
            from: request.status,
            to: input.status,
            notes: input.notes,
          },
        },
      });

      return updated;
    }),

  // Extend deadline
  extendDeadline: officerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        id: z.string(),
        extensionDays: z.number().min(1).max(90),
        reason: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.dSARRequest.findFirst({
        where: { id: input.id, organizationId: ctx.organization.id },
      });

      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "DSAR request not found",
        });
      }

      const newDueDate = addDays(request.dueDate, input.extensionDays);

      const updated = await ctx.prisma.dSARRequest.update({
        where: { id: input.id },
        data: {
          extendedDueDate: newDueDate,
          extensionReason: input.reason,
          dueDate: newDueDate,
        },
      });

      await ctx.prisma.dSARAuditLog.create({
        data: {
          dsarRequestId: input.id,
          action: "DEADLINE_EXTENDED",
          performedBy: ctx.session.user.id,
          details: {
            originalDue: request.dueDate,
            newDue: newDueDate,
            extensionDays: input.extensionDays,
            reason: input.reason,
          },
        },
      });

      return updated;
    }),

  // ============================================================
  // DSAR TASKS
  // ============================================================

  // Create task
  createTask: officerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        dsarRequestId: z.string(),
        dataAssetId: z.string().optional(),
        assigneeId: z.string().optional(),
        title: z.string().min(1),
        description: z.string().optional(),
        dueDate: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify request belongs to org
      const request = await ctx.prisma.dSARRequest.findFirst({
        where: { id: input.dsarRequestId, organizationId: ctx.organization.id },
      });

      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "DSAR request not found",
        });
      }

      const task = await ctx.prisma.dSARTask.create({
        data: {
          dsarRequestId: input.dsarRequestId,
          dataAssetId: input.dataAssetId,
          assigneeId: input.assigneeId,
          title: input.title,
          description: input.description,
          dueDate: input.dueDate,
        },
        include: {
          dataAsset: true,
          assignee: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      return task;
    }),

  // Update task
  updateTask: officerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        id: z.string(),
        status: z.nativeEnum(DSARTaskStatus).optional(),
        assigneeId: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
        dataExport: z.any().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, organizationId, ...data } = input;

      // Verify task belongs to org
      const task = await ctx.prisma.dSARTask.findFirst({
        where: { id },
        include: {
          dsarRequest: true,
        },
      });

      if (!task || task.dsarRequest.organizationId !== ctx.organization.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Task not found",
        });
      }

      const updateData: any = { ...data };
      if (input.status === DSARTaskStatus.COMPLETED) {
        updateData.completedAt = new Date();
      }

      return ctx.prisma.dSARTask.update({
        where: { id },
        data: updateData,
        include: {
          dataAsset: true,
          assignee: {
            select: { id: true, name: true, email: true },
          },
        },
      });
    }),

  // Auto-generate tasks from data assets
  generateTasks: officerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        dsarRequestId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.dSARRequest.findFirst({
        where: { id: input.dsarRequestId, organizationId: ctx.organization.id },
      });

      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "DSAR request not found",
        });
      }

      // Get all data assets that contain personal data
      const assets = await ctx.prisma.dataAsset.findMany({
        where: {
          organizationId: ctx.organization.id,
          dataElements: {
            some: {
              isPersonalData: true,
            },
          },
        },
      });

      // Create a task for each asset
      const tasks = await ctx.prisma.dSARTask.createMany({
        data: assets.map((asset) => ({
          dsarRequestId: input.dsarRequestId,
          dataAssetId: asset.id,
          title: `Search and extract data from ${asset.name}`,
          description: `Identify and extract personal data for ${request.requesterName} from the ${asset.name} system.`,
          status: DSARTaskStatus.PENDING,
        })),
      });

      await ctx.prisma.dSARAuditLog.create({
        data: {
          dsarRequestId: input.dsarRequestId,
          action: "TASKS_GENERATED",
          performedBy: ctx.session.user.id,
          details: { taskCount: tasks.count },
        },
      });

      return { created: tasks.count };
    }),

  // ============================================================
  // DSAR COMMUNICATIONS
  // ============================================================

  // Add communication
  addCommunication: officerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        dsarRequestId: z.string(),
        direction: z.nativeEnum(CommunicationDirection),
        channel: z.string(),
        subject: z.string().optional(),
        content: z.string(),
        attachments: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.dSARRequest.findFirst({
        where: { id: input.dsarRequestId, organizationId: ctx.organization.id },
      });

      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "DSAR request not found",
        });
      }

      const communication = await ctx.prisma.dSARCommunication.create({
        data: {
          dsarRequestId: input.dsarRequestId,
          direction: input.direction,
          channel: input.channel,
          subject: input.subject,
          content: input.content,
          attachments: input.attachments,
          sentById: input.direction === "OUTBOUND" ? ctx.session.user.id : null,
        },
        include: {
          sentBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      // Update acknowledged timestamp if this is first outbound communication
      if (input.direction === "OUTBOUND" && !request.acknowledgedAt) {
        await ctx.prisma.dSARRequest.update({
          where: { id: input.dsarRequestId },
          data: { acknowledgedAt: new Date() },
        });
      }

      return communication;
    }),

  // ============================================================
  // PUBLIC INTAKE FORMS
  // ============================================================

  // Get intake form configuration
  getIntakeForm: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      return ctx.prisma.dSARIntakeForm.findFirst({
        where: {
          organizationId: ctx.organization.id,
          isActive: true,
        },
      });
    }),

  // Create/update intake form
  upsertIntakeForm: adminOrgProcedure
    .input(
      z.object({
        organizationId: z.string(),
        name: z.string().min(1),
        slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
        title: z.string().min(1),
        description: z.string().optional(),
        fields: z.array(z.any()),
        enabledTypes: z.array(z.nativeEnum(DSARType)),
        customCss: z.string().optional(),
        thankYouMessage: z.string().optional(),
        isActive: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { organizationId: _orgId, ...formData } = input;

      const existing = await ctx.prisma.dSARIntakeForm.findFirst({
        where: { organizationId: ctx.organization.id },
      });

      if (existing) {
        return ctx.prisma.dSARIntakeForm.update({
          where: { id: existing.id },
          data: formData,
        });
      }

      return ctx.prisma.dSARIntakeForm.create({
        data: {
          organizationId: ctx.organization.id,
          ...formData,
        },
      });
    }),

  // ============================================================
  // PUBLIC PORTAL ENDPOINTS (No auth required)
  // ============================================================

  // Get public intake form config by org slug (for the public portal)
  getPublicForm: publicProcedure
    .input(z.object({ orgSlug: z.string() }))
    .query(async ({ ctx, input }) => {
      const org = await ctx.prisma.organization.findUnique({
        where: { slug: input.orgSlug },
        include: {
          dsarIntakeForms: { where: { isActive: true }, take: 1 },
        },
      });
      if (!org || org.dsarIntakeForms.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Intake form not available for this organization",
        });
      }
      const form = org.dsarIntakeForms[0]!;
      return {
        orgName: org.name,
        title: form.title,
        description: form.description,
        thankYouMessage: form.thankYouMessage,
        privacyNoticeUrl: form.privacyNoticeUrl,
        retentionDays: form.retentionDays,
        enabledTypes: form.enabledTypes,
      };
    }),

  // Submit public DSAR request
  submitPublic: publicProcedure
    .input(
      z.object({
        orgSlug: z.string(),
        type: z.nativeEnum(DSARType),
        requesterName: z.string().min(1),
        requesterEmail: z.string().email(),
        requesterPhone: z.string().optional(),
        requesterAddress: z.string().optional(),
        relationship: z.string().optional(),
        description: z.string().optional(),
        requestedData: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input: rawInput }) => {
      const input = sanitizeInput(rawInput);
      const org = await ctx.prisma.organization.findUnique({
        where: { slug: input.orgSlug },
        include: {
          dsarIntakeForms: {
            where: { isActive: true },
            take: 1,
          },
          jurisdictions: {
            where: { isPrimary: true },
            include: { jurisdiction: true },
          },
        },
      });

      if (!org || org.dsarIntakeForms.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organization or intake form not found",
        });
      }

      const deadlineDays = org.jurisdictions[0]?.jurisdiction.dsarDeadlineDays ?? 30;
      const receivedAt = new Date();
      const dueDate = calculateDueDate(receivedAt, deadlineDays);

      const request = await ctx.prisma.dSARRequest.create({
        data: {
          organizationId: org.id,
          type: input.type,
          status: DSARStatus.SUBMITTED,
          requesterName: input.requesterName,
          requesterEmail: input.requesterEmail,
          requesterPhone: input.requesterPhone,
          requesterAddress: input.requesterAddress,
          relationship: input.relationship,
          description: input.description,
          requestedData: input.requestedData,
          receivedAt,
          dueDate,
        },
      });

      await ctx.prisma.dSARAuditLog.create({
        data: {
          dsarRequestId: request.id,
          action: "REQUEST_SUBMITTED_PUBLIC",
          details: { type: input.type },
        },
      });

      return { publicId: request.publicId };
    }),

  // Check request status (public)
  checkStatus: publicProcedure
    .input(z.object({ publicId: z.string() }))
    .query(async ({ ctx, input }) => {
      const request = await ctx.prisma.dSARRequest.findUnique({
        where: { publicId: input.publicId },
        select: {
          publicId: true,
          type: true,
          status: true,
          receivedAt: true,
          acknowledgedAt: true,
          dueDate: true,
          completedAt: true,
        },
      });

      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Request not found",
        });
      }

      return request;
    }),

  // ============================================================
  // STATISTICS
  // ============================================================

  // Get DSAR statistics
  getStats: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [
        total,
        byStatus,
        byType,
        overdue,
        completedLast30Days,
        avgCompletionTime,
      ] = await Promise.all([
        ctx.prisma.dSARRequest.count({
          where: { organizationId: ctx.organization.id },
        }),
        ctx.prisma.dSARRequest.groupBy({
          by: ["status"],
          where: { organizationId: ctx.organization.id },
          _count: true,
        }),
        ctx.prisma.dSARRequest.groupBy({
          by: ["type"],
          where: { organizationId: ctx.organization.id },
          _count: true,
        }),
        ctx.prisma.dSARRequest.count({
          where: {
            organizationId: ctx.organization.id,
            dueDate: { lt: now },
            status: { notIn: ["COMPLETED", "REJECTED", "CANCELLED"] },
          },
        }),
        ctx.prisma.dSARRequest.count({
          where: {
            organizationId: ctx.organization.id,
            status: "COMPLETED",
            completedAt: { gte: thirtyDaysAgo },
          },
        }),
        ctx.prisma.dSARRequest.findMany({
          where: {
            organizationId: ctx.organization.id,
            status: "COMPLETED",
            completedAt: { not: null },
          },
          select: {
            receivedAt: true,
            completedAt: true,
          },
        }),
      ]);

      // Calculate average completion time in days
      let avgDays = 0;
      if (avgCompletionTime.length > 0) {
        const totalDays = avgCompletionTime.reduce((sum, req) => {
          if (req.completedAt) {
            return sum + (req.completedAt.getTime() - req.receivedAt.getTime()) / (1000 * 60 * 60 * 24);
          }
          return sum;
        }, 0);
        avgDays = Math.round(totalDays / avgCompletionTime.length);
      }

      return {
        total,
        byStatus: byStatus.reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {}),
        byType: byType.reduce((acc, t) => ({ ...acc, [t.type]: t._count }), {}),
        overdue,
        completedLast30Days,
        avgCompletionDays: avgDays,
      };
    }),

  // ============================================================
  // PRIVACY: DELETE & REDACT
  // ============================================================

  // Hard-delete a completed/cancelled DSAR and all related records
  deleteDSAR: adminOrgProcedure
    .input(
      z.object({
        organizationId: z.string(),
        id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.dSARRequest.findFirst({
        where: { id: input.id, organizationId: ctx.organization.id },
      });

      if (!request) {
        throw new TRPCError({ code: "NOT_FOUND", message: "DSAR request not found" });
      }

      if (!["COMPLETED", "CANCELLED"].includes(request.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only completed or cancelled requests can be deleted",
        });
      }

      // Log deletion before removing (audit survives in org-level log)
      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "DSARRequest",
          entityId: request.publicId,
          action: "DELETE",
          changes: { type: request.type, status: request.status },
        },
      });

      // Cascade delete removes tasks, communications, DSAR audit logs
      await ctx.prisma.dSARRequest.delete({ where: { id: input.id } });

      return { success: true };
    }),

  // Redact PII from a completed DSAR (keeps anonymized audit trail)
  redactDSAR: adminOrgProcedure
    .input(
      z.object({
        organizationId: z.string(),
        id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.dSARRequest.findFirst({
        where: { id: input.id, organizationId: ctx.organization.id },
      });

      if (!request) {
        throw new TRPCError({ code: "NOT_FOUND", message: "DSAR request not found" });
      }

      if (request.redactedAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Already redacted" });
      }

      if (!["COMPLETED", "CANCELLED", "REJECTED"].includes(request.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only completed, cancelled, or rejected requests can be redacted",
        });
      }

      // Redact requester PII
      await ctx.prisma.dSARRequest.update({
        where: { id: input.id },
        data: {
          requesterName: "REDACTED",
          requesterEmail: "redacted@redacted",
          requesterPhone: null,
          requesterAddress: null,
          description: null,
          requestedData: null,
          responseNotes: null,
          redactedAt: new Date(),
        },
      });

      // Redact communication content
      await ctx.prisma.dSARCommunication.updateMany({
        where: { dsarRequestId: input.id },
        data: { content: "REDACTED", subject: null, attachments: undefined },
      });

      // Redact task data exports and notes
      await ctx.prisma.dSARTask.updateMany({
        where: { dsarRequestId: input.id },
        data: { dataExport: undefined, notes: null, description: null },
      });

      // Audit log (no PII)
      await ctx.prisma.dSARAuditLog.create({
        data: {
          dsarRequestId: input.id,
          action: "PII_REDACTED",
          performedBy: ctx.session.user.id,
          details: { reason: "manual_redaction" },
        },
      });

      return { success: true };
    }),
});
