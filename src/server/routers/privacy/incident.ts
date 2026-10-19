// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { z } from "zod";
import { createTRPCRouter, organizationProcedure, writerProcedure, officerProcedure, adminOrgProcedure } from "../../trpc";
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
import type { Db } from "@/lib/prisma";
import { requireAi, assertAiRateLimit, recordGeneration, postureLane } from "../../services/ai/posture";
import { chatComplete } from "../../services/ai/llm-door";
import {
  buildBreachNotificationSystemPrompt,
  buildBreachNotificationUserPrompt,
} from "../../services/ai/prompts/breach-notification";
import { localeFromCookieGetter } from "@/i18n/locale-cookie";
import { assertIdsInOrg, assertUsersAreMembers } from "../../org-ownership";
import {
  mergeNotificationFacts,
  notificationDeadlineFor,
  notificationRequiredFor,
  recomputeNotification,
  touchesNotificationFacts,
  TIMELINE_DEADLINE_RECALCULATED,
  TIMELINE_NO_LONGER_REQUIRED,
  TIMELINE_NOW_REQUIRED,
} from "../../services/incidents/notification-assessment";

// Calculate notification deadline based on jurisdiction
const calculateNotificationDeadline = notificationDeadlineFor;

type IncidentDb = Pick<Db, "organizationJurisdiction" | "incidentNotification">;

/** One PENDING notification to the authority per jurisdiction of the organisation. */
async function createPendingAuthorityNotifications(
  prisma: IncidentDb,
  organizationId: string,
  incidentId: string,
  discoveredAt: Date,
): Promise<void> {
  const orgJurisdictions = await prisma.organizationJurisdiction.findMany({
    where: { organizationId },
    include: { jurisdiction: true },
  });
  for (const oj of orgJurisdictions) {
    await prisma.incidentNotification.create({
      data: {
        incidentId,
        jurisdictionId: oj.jurisdictionId,
        recipientType: "DPA",
        status: NotificationStatus.PENDING,
        deadline: calculateNotificationDeadline(discoveredAt, oj.jurisdiction.breachNotificationHours),
      },
    });
  }
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
              dataAsset: {
                select: { id: true, name: true, type: true, owner: true },
              },
            },
          },
          documents: {
            select: { id: true, name: true, type: true, url: true, mimeType: true, size: true, createdAt: true },
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
  create: officerProcedure
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
      // (the same rule `update` applies when these facts change).
      const notificationRequired = notificationRequiredFor(input);

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
        await createPendingAuthorityNotifications(ctx.prisma, ctx.organization.id, incident.id, input.discoveredAt);
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
  update: officerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        id: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        type: z.nativeEnum(IncidentType).optional(),
        severity: z.nativeEnum(IncidentSeverity).optional(),
        discoveredAt: z.date().optional(),
        discoveredBy: z.string().optional().nullable(),
        discoveryMethod: z.string().optional().nullable(),
        jurisdictionId: z.string().optional().nullable(),
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
      void organizationId;

      const stored = await ctx.prisma.incident.findFirst({
        where: { id, organizationId: ctx.organization.id },
        select: {
          severity: true,
          dataCategories: true,
          affectedRecords: true,
          discoveredAt: true,
          jurisdictionId: true,
          notificationRequired: true,
          notificationDeadline: true,
          notifications: { select: { id: true, jurisdictionId: true, status: true, deadline: true } },
        },
      });
      if (!stored) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Incident not found",
        });
      }

      // GDPR Art. 33: the flag and the deadline follow the facts. Recompute
      // them whenever this update changes severity, data categories, records
      // affected, discovery time or jurisdiction.
      const recompute = touchesNotificationFacts(data);
      let derived: { notificationRequired: boolean; notificationDeadline: Date | null } | null = null;
      let merged: ReturnType<typeof mergeNotificationFacts> | null = null;
      if (recompute) {
        merged = mergeNotificationFacts(stored, data);
        const jurisdiction = merged.jurisdictionId
          ? await ctx.prisma.jurisdiction.findUnique({
              where: { id: merged.jurisdictionId },
              select: { breachNotificationHours: true },
            })
          : null;
        derived = recomputeNotification(merged, jurisdiction?.breachNotificationHours ?? null);
      }

      const incident = await ctx.prisma.incident.updateMany({
        where: { id, organizationId: ctx.organization.id },
        data: derived ? { ...data, ...derived } : data,
      });

      if (incident.count === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Incident not found",
        });
      }

      if (derived && merged) {
        // Newly required and nothing recorded yet: the PENDING authority
        // notifications `create` would have made.
        if (derived.notificationRequired && stored.notifications.length === 0) {
          await createPendingAuthorityNotifications(ctx.prisma, ctx.organization.id, id, merged.discoveredAt);
        }
        // A corrected discovery time moves the deadline of every notification
        // still PENDING (one already drafted, sent or acknowledged keeps its own).
        let deadlineMoved =
          (stored.notificationDeadline?.getTime() ?? null) !== (derived.notificationDeadline?.getTime() ?? null);
        if (merged.discoveredAt.getTime() !== stored.discoveredAt.getTime()) {
          const pending = stored.notifications.filter((n) => n.status === NotificationStatus.PENDING);
          if (pending.length > 0) {
            const hours = new Map(
              (
                await ctx.prisma.jurisdiction.findMany({
                  where: { id: { in: [...new Set(pending.map((n) => n.jurisdictionId))] } },
                  select: { id: true, breachNotificationHours: true },
                })
              ).map((j) => [j.id, j.breachNotificationHours]),
            );
            for (const n of pending) {
              const h = hours.get(n.jurisdictionId);
              if (h === undefined) continue;
              const deadline = notificationDeadlineFor(merged.discoveredAt, h);
              if (deadline.getTime() === n.deadline.getTime()) continue;
              await ctx.prisma.incidentNotification.updateMany({
                where: { id: n.id, incidentId: id, status: NotificationStatus.PENDING },
                data: { deadline },
              });
              deadlineMoved = true;
            }
          }
        }
        if (derived.notificationRequired !== stored.notificationRequired) {
          await ctx.prisma.incidentTimelineEntry.create({
            data: {
              incidentId: id,
              title: derived.notificationRequired ? TIMELINE_NOW_REQUIRED : TIMELINE_NO_LONGER_REQUIRED,
              entryType: "STATUS_CHANGE",
              createdById: ctx.session.user.id,
              metadata: { notificationRequired: derived.notificationRequired },
            },
          });
        } else if (deadlineMoved) {
          await ctx.prisma.incidentTimelineEntry.create({
            data: {
              incidentId: id,
              title: TIMELINE_DEADLINE_RECALCULATED,
              entryType: "STATUS_CHANGE",
              createdById: ctx.session.user.id,
              metadata: { notificationDeadline: derived.notificationDeadline?.toISOString() ?? null },
            },
          });
        }
      }

      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "Incident",
          entityId: id,
          action: "UPDATE",
          changes: derived
            ? { ...data, notificationRequired: derived.notificationRequired, notificationDeadline: derived.notificationDeadline }
            : data,
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
  updateStatus: officerProcedure
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

  // Mark an incident as recorded in error (a test, a duplicate), or undo it.
  // Owners and admins. The incident stays in the register, marked, and
  // leaves every count and figure; incidents are never deleted. A timeline
  // entry and an audit entry record who, when and why.
  setRecordedInError: adminOrgProcedure
    .input(
      z.object({
        organizationId: z.string(),
        id: z.string(),
        recordedInError: z.boolean(),
        reason: z.string().trim().max(2000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const incident = await ctx.prisma.incident.findFirst({
        where: { id: input.id, organizationId: ctx.organization.id },
        select: { id: true, recordedInErrorAt: true },
      });
      if (!incident) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Incident not found" });
      }
      if (input.recordedInError && !input.reason) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Say why the incident was recorded in error" });
      }
      const now = new Date();
      const data = input.recordedInError
        ? { recordedInErrorAt: now, recordedInErrorById: ctx.session.user.id, recordedInErrorReason: input.reason ?? null }
        : { recordedInErrorAt: null, recordedInErrorById: null, recordedInErrorReason: null };
      await ctx.prisma.incident.updateMany({
        where: { id: input.id, organizationId: ctx.organization.id },
        data,
      });
      await ctx.prisma.incidentTimelineEntry.create({
        data: {
          incidentId: input.id,
          title: input.recordedInError ? "Marked as recorded in error" : "No longer marked as recorded in error",
          description: input.recordedInError ? input.reason : undefined,
          entryType: "STATUS_CHANGE",
          createdById: ctx.session.user.id,
          metadata: { recordedInError: input.recordedInError },
        },
      });
      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "Incident",
          entityId: input.id,
          action: input.recordedInError ? "RECORDED_IN_ERROR" : "RECORDED_IN_ERROR_UNDONE",
          changes: input.recordedInError ? { reason: input.reason } : undefined,
        },
      });
      return { success: true };
    }),

  // ============================================================
  // NOTIFICATIONS
  // ============================================================

  // Create a notification for an existing incident (used when notifications
  // weren't auto-created at incident report time, or when adding an extra
  // recipient type like DATA_SUBJECT alongside the DPA)
  createNotification: officerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        incidentId: z.string(),
        jurisdictionId: z.string(),
        recipientType: z.string().default("DPA"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const incident = await ctx.prisma.incident.findFirst({
        where: { id: input.incidentId, organizationId: ctx.organization.id },
      });
      if (!incident) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Incident not found" });
      }

      const jurisdiction = await ctx.prisma.jurisdiction.findUnique({
        where: { id: input.jurisdictionId },
      });
      if (!jurisdiction) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Jurisdiction not found" });
      }

      const deadline = calculateNotificationDeadline(
        incident.discoveredAt,
        jurisdiction.breachNotificationHours
      );

      const notification = await ctx.prisma.incidentNotification.create({
        data: {
          incidentId: input.incidentId,
          jurisdictionId: input.jurisdictionId,
          recipientType: input.recipientType,
          status: NotificationStatus.PENDING,
          deadline,
        },
        include: { jurisdiction: true },
      });

      await ctx.prisma.incidentTimelineEntry.create({
        data: {
          incidentId: input.incidentId,
          title: `${input.recipientType} notification created (${jurisdiction.name})`,
          entryType: "NOTIFICATION",
          createdById: ctx.session.user.id,
        },
      });

      return notification;
    }),

  // Update notification
  updateNotification: officerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        id: z.string(),
        status: z.nativeEnum(NotificationStatus).optional(),
        content: z.string().optional().nullable(),
        referenceNumber: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
        // When a notification made earlier is recorded after the fact: the
        // moment it was actually sent. Only with status SENT; never in the future.
        sentAt: z.coerce.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, organizationId, sentAt, ...data } = input;

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
      if (sentAt && input.status !== NotificationStatus.SENT) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "A sending time is recorded only with the status SENT." });
      }
      if (sentAt && sentAt.getTime() > Date.now() + 60_000) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "The sending time cannot be in the future." });
      }
      if (input.status === NotificationStatus.SENT) {
        updateData.sentAt = sentAt ?? new Date();
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
            ...(sentAt ? { timestamp: sentAt } : {}),
          },
        });
      }

      return updated;
    }),

  // ============================================================
  // OPTIONAL AI ASSIST (posture-gated; see services/ai/posture.ts)
  // ============================================================

  // Draft an Art. 33/34 breach notification for an existing notification
  // record. The draft is returned to the client only — it lands in the
  // editable content field via the user's explicit Insert and is saved
  // through the normal updateNotification flow. Never written to the DB here.
  generateNotificationDraft: officerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        incidentId: z.string(),
        notificationId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Posture gate FIRST — posture off/missing means zero AI calls and
      // no prompt building at all.
      const settings = await requireAi(ctx.prisma, ctx.organization.id);
      await assertAiRateLimit(ctx.prisma, ctx.organization.id);

      const incident = await ctx.prisma.incident.findFirst({
        where: { id: input.incidentId, organizationId: ctx.organization.id },
      });
      if (!incident) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Incident not found" });
      }

      const notification = await ctx.prisma.incidentNotification.findFirst({
        where: { id: input.notificationId, incidentId: incident.id },
        include: { jurisdiction: true },
      });
      if (!notification) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Notification not found" });
      }

      const locale = localeFromCookieGetter(ctx.getCookie) ?? "en";

      // Prompts are built server-side from Prisma data only
      const result = await chatComplete({
        system: buildBreachNotificationSystemPrompt(notification.recipientType, locale),
        user: buildBreachNotificationUserPrompt({
          incident: {
            title: incident.title,
            description: incident.description,
            type: incident.type,
            severity: incident.severity,
            discoveredAt: incident.discoveredAt,
            discoveredBy: incident.discoveredBy,
            discoveryMethod: incident.discoveryMethod,
            affectedRecords: incident.affectedRecords,
            affectedSubjects: incident.affectedSubjects,
            dataCategories: incident.dataCategories.map((c) => String(c)),
            containedAt: incident.containedAt,
            containmentActions: incident.containmentActions,
            rootCause: incident.rootCause,
          },
          notification: {
            recipientType: notification.recipientType,
            deadline: notification.deadline,
          },
          jurisdiction: notification.jurisdiction
            ? {
                name: notification.jurisdiction.name,
                breachNotificationHours: notification.jurisdiction.breachNotificationHours,
              }
            : null,
          organizationName: ctx.organization.name,
        }),
        maxTokens: 1500,
        temperature: 0.3,
        // Route through the lane the organization acknowledged.
        lane: postureLane(settings.posture),
      });

      const generation = await recordGeneration(ctx.prisma, {
        organizationId: ctx.organization.id,
        userId: ctx.session.user.id,
        feature: "breach_notification",
        entityType: "IncidentNotification",
        entityId: notification.id,
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
      };
    }),

  // ============================================================
  // TIMELINE
  // ============================================================

  // Add timeline entry
  addTimelineEntry: writerProcedure
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
  createTask: writerProcedure
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

      // The assignee must be a member of this organisation (F2)
      await assertUsersAreMembers(
        ctx.prisma.organizationMember,
        [input.assigneeId],
        ctx.organization.id,
        "Assignee"
      );

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
  updateTask: writerProcedure
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

      // The assignee must be a member of this organisation (F2)
      await assertUsersAreMembers(
        ctx.prisma.organizationMember,
        [input.assigneeId],
        ctx.organization.id,
        "Assignee"
      );

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
  linkAsset: writerProcedure
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

      // The asset must belong to this organisation (F2)
      await assertIdsInOrg(
        ctx.prisma.dataAsset,
        [input.dataAssetId],
        { organizationId: ctx.organization.id },
        "Data asset"
      );

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
  addDocument: writerProcedure
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
          where: { recordedInErrorAt: null, organizationId: ctx.organization.id },
        }),
        ctx.prisma.incident.count({
          where: { recordedInErrorAt: null,
            organizationId: ctx.organization.id,
            status: { notIn: ["CLOSED", "FALSE_POSITIVE"] },
          },
        }),
        ctx.prisma.incident.groupBy({
          by: ["severity"],
          where: { recordedInErrorAt: null, organizationId: ctx.organization.id },
          _count: true,
        }),
        ctx.prisma.incident.groupBy({
          by: ["type"],
          where: { recordedInErrorAt: null, organizationId: ctx.organization.id },
          _count: true,
        }),
        ctx.prisma.incident.groupBy({
          by: ["status"],
          where: { recordedInErrorAt: null, organizationId: ctx.organization.id },
          _count: true,
        }),
        ctx.prisma.incidentNotification.count({
          where: {
            incident: { organizationId: ctx.organization.id, recordedInErrorAt: null },
            status: "PENDING",
            deadline: { lt: now },
          },
        }),
        ctx.prisma.incident.count({
          where: { recordedInErrorAt: null,
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
