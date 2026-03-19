import { z } from "zod";
import { createTRPCRouter, organizationProcedure, writerProcedure } from "../../trpc";
import { TRPCError } from "@trpc/server";
import { NotificationEventType } from "@prisma/client";
import { sendSlackMessage } from "../../services/notifications/dispatcher";

// All event types — used for seeding default preferences
const ALL_EVENT_TYPES = Object.values(NotificationEventType);

export const notificationRouter = createTRPCRouter({
  // ============================================================
  // NOTIFICATIONS
  // ============================================================

  // List notifications for the current user (paginated)
  list: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        isRead: z.boolean().optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const notifications = await ctx.prisma.notification.findMany({
        where: {
          organizationId: ctx.organization.id,
          userId,
          ...(input.isRead !== undefined ? { isRead: input.isRead } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
      });

      let nextCursor: string | undefined;
      if (notifications.length > input.limit) {
        const nextItem = notifications.pop();
        nextCursor = nextItem?.id;
      }

      // Always include unread count for badge display
      const unreadCount = await ctx.prisma.notification.count({
        where: {
          organizationId: ctx.organization.id,
          userId,
          isRead: false,
        },
      });

      return { notifications, nextCursor, unreadCount };
    }),

  // Get unread notification count (lightweight, for header badge)
  getUnreadCount: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      const count = await ctx.prisma.notification.count({
        where: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          isRead: false,
        },
      });
      return { count };
    }),

  // Mark a single notification as read
  markRead: writerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const notification = await ctx.prisma.notification.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
        },
      });

      if (!notification) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Notification not found",
        });
      }

      await ctx.prisma.notification.update({
        where: { id: input.id },
        data: { isRead: true },
      });

      return { success: true };
    }),

  // Mark all notifications as read for the current user
  markAllRead: writerProcedure
    .input(z.object({ organizationId: z.string() }))
    .mutation(async ({ ctx }) => {
      const { count } = await ctx.prisma.notification.updateMany({
        where: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          isRead: false,
        },
        data: { isRead: true },
      });

      return { updated: count };
    }),

  // ============================================================
  // PREFERENCES
  // ============================================================

  // Get all notification preferences for the current user
  // Creates default preferences for any missing event types
  getPreferences: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id;
      const organizationId = ctx.organization.id;

      const existing = await ctx.prisma.notificationPreference.findMany({
        where: { userId, organizationId },
      });

      const existingTypes = new Set(existing.map((p) => p.eventType));
      const missing = ALL_EVENT_TYPES.filter((t) => !existingTypes.has(t));

      // Seed defaults for any missing event types
      if (missing.length > 0) {
        await ctx.prisma.notificationPreference.createMany({
          data: missing.map((eventType) => ({
            userId,
            organizationId,
            eventType,
            inAppEnabled: true,
            emailEnabled: true,
            slackEnabled: false,
          })),
          skipDuplicates: true,
        });
      }

      // Re-fetch all (including newly created) to return a complete set
      const preferences = await ctx.prisma.notificationPreference.findMany({
        where: { userId, organizationId },
        orderBy: { eventType: "asc" },
      });

      return { preferences };
    }),

  // Update a single notification preference
  updatePreference: writerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        eventType: z.nativeEnum(NotificationEventType),
        inAppEnabled: z.boolean(),
        emailEnabled: z.boolean(),
        slackEnabled: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const organizationId = ctx.organization.id;

      const preference = await ctx.prisma.notificationPreference.upsert({
        where: {
          userId_organizationId_eventType: {
            userId,
            organizationId,
            eventType: input.eventType,
          },
        },
        update: {
          inAppEnabled: input.inAppEnabled,
          emailEnabled: input.emailEnabled,
          slackEnabled: input.slackEnabled,
        },
        create: {
          userId,
          organizationId,
          eventType: input.eventType,
          inAppEnabled: input.inAppEnabled,
          emailEnabled: input.emailEnabled,
          slackEnabled: input.slackEnabled,
        },
      });

      return { preference };
    }),

  // ============================================================
  // SLACK INTEGRATION (Premium)
  // ============================================================

  // Update the organization's Slack webhook URL
  updateSlackWebhook: writerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        webhookUrl: z.string().url().startsWith("https://hooks.slack.com/").or(z.literal("")),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const org = await ctx.prisma.organization.findUnique({
        where: { id: ctx.organization.id },
        select: { settings: true },
      });

      const currentSettings =
        org?.settings && typeof org.settings === "object"
          ? (org.settings as Record<string, unknown>)
          : {};

      await ctx.prisma.organization.update({
        where: { id: ctx.organization.id },
        data: {
          settings: {
            ...currentSettings,
            slackWebhookUrl: input.webhookUrl || null,
          },
        },
      });

      return { success: true };
    }),

  // Send a test message to the configured Slack webhook
  testSlackWebhook: writerProcedure
    .input(z.object({ organizationId: z.string() }))
    .mutation(async ({ ctx }) => {
      const org = await ctx.prisma.organization.findUnique({
        where: { id: ctx.organization.id },
        select: { settings: true },
      });

      const settings =
        org?.settings && typeof org.settings === "object"
          ? (org.settings as Record<string, unknown>)
          : {};

      const webhookUrl = settings.slackWebhookUrl;

      if (typeof webhookUrl !== "string" || !webhookUrl.startsWith("https://")) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No Slack webhook URL configured. Please save a webhook URL first.",
        });
      }

      try {
        await sendSlackMessage(webhookUrl, {
          title: "DPO Central Test Notification",
          message: "This is a test message from DPO Central. Your Slack integration is working correctly!",
        });
        return { success: true };
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to send test message to Slack. Please verify the webhook URL.",
        });
      }
    }),
});
