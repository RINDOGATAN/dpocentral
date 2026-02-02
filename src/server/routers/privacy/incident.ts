import { z } from "zod";
import { createTRPCRouter, organizationProcedure } from "../../trpc";
import { TRPCError } from "@trpc/server";
import {
  IncidentType,
  IncidentSeverity,
  IncidentStatus,
  NotificationStatus,
  TaskStatus,
  TaskPriority,
  DataCategory,
  DocumentType,
} from "@prisma/client";
import { addHours } from "date-fns";

// Calculate notification deadline based on jurisdiction
function calculateNotificationDeadline(
  discoveredAt: Date,
  breachNotificationHours: number
): Date {
  return addHours(discoveredAt, breachNotificationHours);
}

export const incidentRouter = createTRPCRouter({
  // ============================================================
  // INCIDENTS
  // ============================================================

  // List incidents
  list: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        status: z.nativeEnum(IncidentStatus).optional(),
        severity: z.nativeEnum(IncidentSeverity).optional(),
        type: z.nativeEnum(IncidentType).optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const incidents = await ctx.prisma.incident.findMany({
        where: {
          organizationId: ctx.organization.id,
          status: input.status,
          severity: input.severity,
          type: input.type,
          ...(input.search && {
            OR: [
              { title: { contains: input.search, mode: "insensitive" } },
              { publicId: { contains: input.search, mode: "insensitive" } },
            ],
          }),
        },
        include: {
          jurisdiction: true,
          _count: {
            select: {
              notifications: true,
              tasks: true,
              affectedAssets: true,
            },
          },
        },
        orderBy: [{ severity: "desc" }, { discoveredAt: "desc" }],
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
      });

      let nextCursor: string | undefined;
      if (incidents.length > input.limit) {
        const nextItem = incidents.pop();
        nextCursor = nextItem?.id;
      }

      return { incidents, nextCursor };
    }),

  // Get incident by ID
  getById: organizationProcedure
    .input(z.object({ organizationId: z.string(), id: z.string() }))
    .query(async ({ ctx, input }) => {
      const incident = await ctx.prisma.incident.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organization.id,
        },
        include: {
          jurisdiction: true,
          notifications: {
            include: {
              jurisdiction: true,
            },
            orderBy: { deadline: "asc" },
          },
          timeline: {
            include: {
              createdBy: {
                select: { id: true, name: true, email: true },
              },
            },
            orderBy: { timestamp: "desc" },
          },
          tasks: {
            include: {
              assignee: {
                select: { id: true, name: true, email: true },
              },
            },
            orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
          },
          affectedAssets: {
            include: {
              dataAsset: true,
            },
          },
          documents: {
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!incident) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Incident not found",
        });
      }

      return incident;
    }),

  // Create incident
  create: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        title: z.string().min(1),
        description: z.string(),
        type: z.nativeEnum(IncidentType),
        severity: z.nativeEnum(IncidentSeverity).default(IncidentSeverity.MEDIUM),
        discoveredAt: z.date(),
        discoveredBy: z.string().optional(),
        discoveryMethod: z.string().optional(),
        affectedRecords: z.number().optional(),
        affectedSubjects: z.array(z.string()).default([]),
        dataCategories: z.array(z.nativeEnum(DataCategory)).default([]),
        jurisdictionId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Determine if notification is required based on severity and data types
      const hasSpecialCategory = input.dataCategories.some((cat) =>
        ["HEALTH", "BIOMETRIC", "GENETIC", "POLITICAL", "RELIGIOUS", "SEXUAL_ORIENTATION", "CRIMINAL"].includes(cat)
      );
      const notificationRequired =
        input.severity === IncidentSeverity.HIGH ||
        input.severity === IncidentSeverity.CRITICAL ||
        hasSpecialCategory ||
        (input.affectedRecords !== undefined && input.affectedRecords >= 500);

      // Calculate notification deadline if jurisdiction specified
      let notificationDeadline: Date | undefined;
      if (notificationRequired && input.jurisdictionId) {
        const jurisdiction = await ctx.prisma.jurisdiction.findUnique({
          where: { id: input.jurisdictionId },
        });
        if (jurisdiction) {
          notificationDeadline = calculateNotificationDeadline(
            input.discoveredAt,
            jurisdiction.breachNotificationHours
          );
        }
      }

      const incident = await ctx.prisma.incident.create({
        data: {
          organizationId: ctx.organization.id,
          title: input.title,
          description: input.description,
          type: input.type,
          severity: input.severity,
          status: IncidentStatus.REPORTED,
          discoveredAt: input.discoveredAt,
          discoveredBy: input.discoveredBy,
          discoveryMethod: input.discoveryMethod,
          affectedRecords: input.affectedRecords,
          affectedSubjects: input.affectedSubjects,
          dataCategories: input.dataCategories,
          jurisdictionId: input.jurisdictionId,
          notificationRequired,
          notificationDeadline,
        },
        include: {
          jurisdiction: true,
        },
      });

      // Create initial timeline entry
      await ctx.prisma.incidentTimelineEntry.create({
        data: {
          incidentId: incident.id,
          title: "Incident Reported",
          description: `Incident "${input.title}" was reported`,
          entryType: "STATUS_CHANGE",
          createdById: ctx.session.user.id,
          metadata: { status: "REPORTED" },
        },
      });

      // Auto-create notification records for applicable jurisdictions
      if (notificationRequired) {
        const orgJurisdictions = await ctx.prisma.organizationJurisdiction.findMany({
          where: { organizationId: ctx.organization.id },
          include: { jurisdiction: true },
        });

        for (const oj of orgJurisdictions) {
          const deadline = calculateNotificationDeadline(
            input.discoveredAt,
            oj.jurisdiction.breachNotificationHours
          );

          await ctx.prisma.incidentNotification.create({
            data: {
              incidentId: incident.id,
              jurisdictionId: oj.jurisdictionId,
              recipientType: "DPA",
              status: NotificationStatus.PENDING,
              deadline,
            },
          });
        }
      }

      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "Incident",
          entityId: incident.id,
          action: "CREATE",
          changes: input,
        },
      });

      return incident;
    }),

  // Update incident
  update: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        id: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        type: z.nativeEnum(IncidentType).optional(),
        severity: z.nativeEnum(IncidentSeverity).optional(),
        affectedRecords: z.number().optional().nullable(),
        affectedSubjects: z.array(z.string()).optional(),
        dataCategories: z.array(z.nativeEnum(DataCategory)).optional(),
        rootCause: z.string().optional().nullable(),
        rootCauseCategory: z.string().optional().nullable(),
        containmentActions: z.string().optional().nullable(),
        resolutionNotes: z.string().optional().nullable(),
        lessonsLearned: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, organizationId, ...data } = input;

      const incident = await ctx.prisma.incident.updateMany({
        where: { id, organizationId: ctx.organization.id },
        data,
      });

      if (incident.count === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Incident not found",
        });
      }

      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "Incident",
          entityId: id,
          action: "UPDATE",
          changes: data,
        },
      });

      // Security: Return with org check to prevent data leak
      return ctx.prisma.incident.findFirst({
        where: { id, organizationId: ctx.organization.id },
        include: {
          jurisdiction: true,
        },
      });
    }),

  // Update incident status
  updateStatus: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        id: z.string(),
        status: z.nativeEnum(IncidentStatus),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const incident = await ctx.prisma.incident.findFirst({
        where: { id: input.id, organizationId: ctx.organization.id },
      });

      if (!incident) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Incident not found",
        });
      }

      const updateData: any = { status: input.status };

      // Set timestamps based on status
      if (input.status === IncidentStatus.CONTAINED && !incident.containedAt) {
        updateData.containedAt = new Date();
      } else if (input.status === IncidentStatus.CLOSED && !incident.resolvedAt) {
        updateData.resolvedAt = new Date();
      }

      const updated = await ctx.prisma.incident.update({
        where: { id: input.id },
        data: updateData,
      });

      // Create timeline entry
      await ctx.prisma.incidentTimelineEntry.create({
        data: {
          incidentId: input.id,
          title: `Status changed to ${input.status}`,
          description: input.notes,
          entryType: "STATUS_CHANGE",
          createdById: ctx.session.user.id,
          metadata: { from: incident.status, to: input.status },
        },
      });

      return updated;
    }),

  // ============================================================
  // NOTIFICATIONS
  // ============================================================

  // Update notification
  updateNotification: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        id: z.string(),
        status: z.nativeEnum(NotificationStatus).optional(),
        content: z.string().optional().nullable(),
        referenceNumber: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, organizationId, ...data } = input;

      const notification = await ctx.prisma.incidentNotification.findFirst({
        where: { id },
        include: { incident: true },
      });

      if (!notification || notification.incident.organizationId !== ctx.organization.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Notification not found",
        });
      }

      const updateData: any = { ...data };
      if (input.status === NotificationStatus.SENT) {
        updateData.sentAt = new Date();
      } else if (input.status === NotificationStatus.ACKNOWLEDGED) {
        updateData.acknowledgedAt = new Date();
      }

      const updated = await ctx.prisma.incidentNotification.update({
        where: { id },
        data: updateData,
        include: { jurisdiction: true },
      });

      // Create timeline entry
      if (input.status) {
        await ctx.prisma.incidentTimelineEntry.create({
          data: {
            incidentId: notification.incidentId,
            title: `${notification.recipientType} notification ${input.status.toLowerCase()}`,
            description: input.notes,
            entryType: "NOTIFICATION",
            createdById: ctx.session.user.id,
          },
        });
      }

      return updated;
    }),

  // ============================================================
  // TIMELINE
  // ============================================================

  // Add timeline entry
  addTimelineEntry: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        incidentId: z.string(),
        title: z.string().min(1),
        description: z.string().optional(),
        entryType: z.string(),
        timestamp: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const incident = await ctx.prisma.incident.findFirst({
        where: { id: input.incidentId, organizationId: ctx.organization.id },
      });

      if (!incident) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Incident not found",
        });
      }

      return ctx.prisma.incidentTimelineEntry.create({
        data: {
          incidentId: input.incidentId,
          title: input.title,
          description: input.description,
          entryType: input.entryType,
          timestamp: input.timestamp ?? new Date(),
          createdById: ctx.session.user.id,
        },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });
    }),

  // ============================================================
  // TASKS
  // ============================================================

  // Create task
  createTask: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        incidentId: z.string(),
        assigneeId: z.string().optional(),
        title: z.string().min(1),
        description: z.string().optional(),
        priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
        dueDate: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const incident = await ctx.prisma.incident.findFirst({
        where: { id: input.incidentId, organizationId: ctx.organization.id },
      });

      if (!incident) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Incident not found",
        });
      }

      return ctx.prisma.incidentTask.create({
        data: {
          incidentId: input.incidentId,
          assigneeId: input.assigneeId,
          title: input.title,
          description: input.description,
          priority: input.priority,
          dueDate: input.dueDate,
          status: TaskStatus.TODO,
        },
        include: {
          assignee: {
            select: { id: true, name: true, email: true },
          },
        },
      });
    }),

  // Update task
  updateTask: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        id: z.string(),
        status: z.nativeEnum(TaskStatus).optional(),
        assigneeId: z.string().optional().nullable(),
        title: z.string().optional(),
        description: z.string().optional().nullable(),
        priority: z.nativeEnum(TaskPriority).optional(),
        dueDate: z.date().optional().nullable(),
        notes: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, organizationId, ...data } = input;

      const task = await ctx.prisma.incidentTask.findFirst({
        where: { id },
        include: { incident: true },
      });

      if (!task || task.incident.organizationId !== ctx.organization.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Task not found",
        });
      }

      const updateData: any = { ...data };
      if (input.status === TaskStatus.COMPLETED) {
        updateData.completedAt = new Date();
      }

      return ctx.prisma.incidentTask.update({
        where: { id },
        data: updateData,
        include: {
          assignee: {
            select: { id: true, name: true, email: true },
          },
        },
      });
    }),

  // ============================================================
  // AFFECTED ASSETS
  // ============================================================

  // Link affected asset
  linkAsset: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        incidentId: z.string(),
        dataAssetId: z.string(),
        impactLevel: z.string().optional(),
        compromised: z.boolean().default(false),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const incident = await ctx.prisma.incident.findFirst({
        where: { id: input.incidentId, organizationId: ctx.organization.id },
      });

      if (!incident) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Incident not found",
        });
      }

      return ctx.prisma.incidentAffectedAsset.upsert({
        where: {
          incidentId_dataAssetId: {
            incidentId: input.incidentId,
            dataAssetId: input.dataAssetId,
          },
        },
        update: {
          impactLevel: input.impactLevel,
          compromised: input.compromised,
          notes: input.notes,
        },
        create: {
          incidentId: input.incidentId,
          dataAssetId: input.dataAssetId,
          impactLevel: input.impactLevel,
          compromised: input.compromised,
          notes: input.notes,
        },
        include: {
          dataAsset: true,
        },
      });
    }),

  // ============================================================
  // DOCUMENTS
  // ============================================================

  // Add document
  addDocument: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        incidentId: z.string(),
        name: z.string().min(1),
        type: z.nativeEnum(DocumentType).default(DocumentType.OTHER),
        url: z.string(),
        mimeType: z.string().optional(),
        size: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const incident = await ctx.prisma.incident.findFirst({
        where: { id: input.incidentId, organizationId: ctx.organization.id },
      });

      if (!incident) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Incident not found",
        });
      }

      return ctx.prisma.incidentDocument.create({
        data: {
          incidentId: input.incidentId,
          name: input.name,
          type: input.type,
          url: input.url,
          mimeType: input.mimeType,
          size: input.size,
          uploadedBy: ctx.session.user.id,
        },
      });
    }),

  // ============================================================
  // STATISTICS
  // ============================================================

  getStats: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [
        total,
        open,
        bySeverity,
        byType,
        byStatus,
        pendingNotifications,
        recentIncidents,
      ] = await Promise.all([
        ctx.prisma.incident.count({
          where: { organizationId: ctx.organization.id },
        }),
        ctx.prisma.incident.count({
          where: {
            organizationId: ctx.organization.id,
            status: { notIn: ["CLOSED", "FALSE_POSITIVE"] },
          },
        }),
        ctx.prisma.incident.groupBy({
          by: ["severity"],
          where: { organizationId: ctx.organization.id },
          _count: true,
        }),
        ctx.prisma.incident.groupBy({
          by: ["type"],
          where: { organizationId: ctx.organization.id },
          _count: true,
        }),
        ctx.prisma.incident.groupBy({
          by: ["status"],
          where: { organizationId: ctx.organization.id },
          _count: true,
        }),
        ctx.prisma.incidentNotification.count({
          where: {
            incident: { organizationId: ctx.organization.id },
            status: "PENDING",
            deadline: { lt: now },
          },
        }),
        ctx.prisma.incident.count({
          where: {
            organizationId: ctx.organization.id,
            discoveredAt: { gte: thirtyDaysAgo },
          },
        }),
      ]);

      return {
        total,
        open,
        bySeverity: bySeverity.reduce((acc, s) => ({ ...acc, [s.severity]: s._count }), {}),
        byType: byType.reduce((acc, t) => ({ ...acc, [t.type]: t._count }), {}),
        byStatus: byStatus.reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {}),
        overdueNotifications: pendingNotifications,
        last30Days: recentIncidents,
      };
    }),
});
