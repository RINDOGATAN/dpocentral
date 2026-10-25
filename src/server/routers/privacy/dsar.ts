// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { z } from "zod";
import { createTRPCRouter, publicProcedure, organizationProcedure, officerProcedure, adminOrgProcedure, sanitizeInput } from "../../trpc";
import { TRPCError } from "@trpc/server";
import { DSARType, DSARStatus, DSARTaskStatus, CommunicationDirection } from "@prisma/client";
import { addDays } from "date-fns";
import { daysUntilDue as daysLeft, dsarExtensionState, dsarRuleForType, dsarSlaStatus } from "@/lib/dsar-deadline";
import { calculateDSARDueDate, orgDsarRule } from "@/server/services/privacy/slaCalculator";
import { sanitizeCss } from "@/lib/sanitize";
import { sendDSARConfirmationEmail } from "@/server/services/dsar/sendConfirmationEmail";
import { sendDSARCommunicationEmail } from "@/server/services/dsar/sendCommunicationEmail";
import { assertPilotWritable, pilotLocale } from "@/server/services/pilot/caps";
import { assertIdsInOrg, assertUsersAreMembers } from "../../org-ownership";
import { canHandleDsars } from "@/lib/dsar-access";
import { dsarReadFilter, recordDsarView } from "@/server/services/dsar/access";
import { redactDsarRequest } from "@/server/services/dsar/redact";
import { DSAR_MODULE_OFF_MESSAGE, isDsarModuleEnabled } from "@/config/features";
import { requestRefSearchTail } from "@/lib/request-ref";
import {
  acceptsPublicRequest,
  DSAR_MODULE_MESSAGES,
  DSAR_PUBLIC_SUBMISSION,
  effectiveRetentionDays,
  getDsarModuleAccess,
} from "@/server/services/dsar/module";
import { notifyVolumeStep } from "@/server/services/dsar/volume-notices";
import { reminderMailerFromEnv } from "@/server/services/dsar/deadlineReminders";
import { volumeUpgradeCheckoutUrl, volumeUpgradeLinks } from "@/lib/dsar-addon";
import { sendDSARExtensionEmail } from "@/server/services/dsar/sendExtensionEmail";
import { countRecentAccessRequests } from "@/server/services/dsar/repeat-access";
import { generatedTaskText } from "@/server/services/dsar/generated-tasks";
import { localeFromCookieGetter } from "@/i18n/locale-cookie";
import { remainingPlaceholders, UNFILLED_PLACEHOLDERS_MESSAGE } from "@/lib/dsar-model-replies";
import { brand } from "@/config/brand";
import {
  assertHumanSubmission,
  assertWithinDailyLimits,
  decoyPublicId,
  honeypotFilled,
  issueFormToken,
  mayAcknowledge,
  recordRejection,
} from "@/server/services/dsar/public-intake-guard";

// SLA rule of the organisation's primary jurisdiction: calendar months where
// the law says months (GDPR art. 12(3): one month), days otherwise. Applies to
// requests created and extensions applied from now on; stored due dates of
// existing requests are never rewritten.
/** Every jurisdiction of the organisation, as orgDsarRule reads them. */
const DSAR_RULE_JURISDICTIONS = {
  select: { isPrimary: true, jurisdiction: { select: { code: true, dsarDeadlineDays: true } } },
} as const;

// The rights-request module can be left out of a deployment
// (NEXT_PUBLIC_DSAR_ENABLED=false, src/config/features.ts). Then every
// procedure of this router, the public ones first, refuses with NOT_FOUND
// before it reads or writes anything. Public procedures check before input
// parsing; member procedures right after the membership check.
const requireDsarModule = <T>({ next }: { next: () => T }) => {
  if (!isDsarModuleEnabled()) {
    throw new TRPCError({ code: "NOT_FOUND", message: DSAR_MODULE_OFF_MESSAGE });
  }
  return next();
};
const dsarPublicProcedure = publicProcedure.use(requireDsarModule);
const dsarOrganizationProcedure = organizationProcedure.use(requireDsarModule);
const dsarOfficerProcedure = officerProcedure.use(requireDsarModule);
const dsarAdminOrgProcedure = adminOrgProcedure.use(requireDsarModule);

/**
 * A link shown on a public page (the privacy notice, the response to a
 * request): a web address only. z.string().url() alone also accepts
 * javascript: and data: links.
 */
const webUrl = z
  .string()
  .url()
  .refine((v) => /^https?:\/\//i.test(v), { message: "Use a web address that starts with https:// or http://." });

export const dsarRouter = createTRPCRouter({
  // ============================================================
  // DSAR REQUESTS
  // ============================================================

  // List DSAR requests. Officers, admins and owners see every request; any
  // other member sees only the requests on which they hold a task
  // (src/lib/dsar-access.ts).
  list: dsarOrganizationProcedure
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
          ...dsarReadFilter(ctx.membership.role, ctx.session.user.id),
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
              // The reference shown on screen (REQ-ABC123): match its tail.
              ...(requestRefSearchTail(input.search)
                ? [{ publicId: { endsWith: requestRefSearchTail(input.search)!, mode: "insensitive" as const } }]
                : []),
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
        const daysUntilDue = daysLeft(req.dueDate, now);
        const slaStatus = dsarSlaStatus(req.dueDate, now);

        return { ...req, daysUntilDue, slaStatus };
      });

      return { requests: requestsWithSLA, nextCursor };
    }),

  // Get a single DSAR request (same rule as list), and record the view
  getById: dsarOrganizationProcedure
    .input(z.object({ organizationId: z.string(), id: z.string() }))
    .query(async ({ ctx, input }) => {
      const role = ctx.membership.role;
      const asHandler = canHandleDsars(role);
      const request = await ctx.prisma.dSARRequest.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organization.id,
          ...dsarReadFilter(role, ctx.session.user.id),
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
        // A member who may not read it gets the same answer whether or not
        // the request exists: no probing of ids.
        throw new TRPCError(
          asHandler
            ? { code: "NOT_FOUND", message: "DSAR request not found" }
            : {
                code: "FORBIDDEN",
                message:
                  "Rights requests are open to privacy officers, admins and owners, and to a member assigned to one of the request's tasks",
              }
        );
      }

      await recordDsarView(ctx.prisma, request.id, ctx.session.user.id, {
        role,
        asAssignee: !asHandler,
      });

      const daysUntilDue = daysLeft(request.dueDate);

      // What the "Extend deadline" button may do: the primary jurisdiction's
      // own extension, once, on an open request.
      const jurisdictions = await ctx.prisma.organizationJurisdiction.findMany({
        where: { organizationId: ctx.organization.id },
        ...DSAR_RULE_JURISDICTIONS,
      });
      const extension = dsarExtensionState(
        request,
        dsarRuleForType(request.type, orgDsarRule(jurisdictions, request.receivedAt))
      );

      // Spain, LOPDGDD art. 13.3: an access request made again within six
      // months may be treated as repetitive. Staff are told; nothing is
      // refused on their behalf.
      const repeatAccess = await countRecentAccessRequests(ctx.prisma, request);

      // What the model replies fill in (src/lib/dsar-model-replies.ts): the
      // status link, the privacy contact, the requester's language, and the
      // due date before an extension (from the trail).
      const intake = await ctx.prisma.dSARIntakeForm.findFirst({
        where: { organizationId: ctx.organization.id },
        select: { privacyContactEmail: true },
      });
      const firstExtension = [...(request.auditLog ?? [])]
        .reverse()
        .find((e) => e.action === "DEADLINE_EXTENDED");
      const originalDue = (firstExtension?.details as { originalDue?: string } | null)?.originalDue ?? null;
      const modelReply = {
        statusLink: `${brand.appUrl.replace(/\/$/, "")}/dsar/status/${request.publicId}`,
        privacyContact: intake?.privacyContactEmail ?? null,
        requesterLocale: (request.metadata as { locale?: string } | null)?.locale ?? null,
        originalDueDate: originalDue,
      };

      return { ...request, daysUntilDue, extension, repeatAccess, modelReply };
    }),

  // Create a DSAR request (internal)
  create: dsarOfficerProcedure
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
      // Requests entered here never count toward the public form's monthly
      // ceiling (src/server/services/dsar/module.ts).
      // The primary jurisdiction's period, else the strictest of the
      // organisation's; the GDPR month when it has none (orgDsarRule).
      const jurisdictions = await ctx.prisma.organizationJurisdiction.findMany({
        where: { organizationId: ctx.organization.id },
        ...DSAR_RULE_JURISDICTIONS,
      });
      const receivedAt = new Date();
      // CCPA opt-out and limit requests run on their own 15-business-day clock.
      const dueDate = calculateDSARDueDate(
        receivedAt,
        dsarRuleForType(input.type, orgDsarRule(jurisdictions, receivedAt))
      );

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
  updateStatus: dsarOfficerProcedure
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
      } else if (
        input.status === DSARStatus.COMPLETED ||
        input.status === DSARStatus.REJECTED ||
        input.status === DSARStatus.CANCELLED
      ) {
        // Closing: the retention period counts from here, whichever way the
        // request was closed (src/app/api/cron/dsar-redaction).
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
  extendDeadline: dsarOfficerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        id: z.string(),
        // Omitted: apply the extension the primary jurisdiction's law allows
        // (GDPR: two further months, counted with the first month from
        // receipt). Given: add that many days to the current due date.
        extensionDays: z.number().min(1).max(90).optional(),
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

      const jurisdictions = await ctx.prisma.organizationJurisdiction.findMany({
        where: { organizationId: ctx.organization.id },
        ...DSAR_RULE_JURISDICTIONS,
      });
      // One statutory extension per request, never on a closed one.
      const state = dsarExtensionState(
        request,
        dsarRuleForType(request.type, orgDsarRule(jurisdictions, request.receivedAt))
      );

      let newDueDate: Date;
      if (input.extensionDays !== undefined) {
        newDueDate = addDays(request.dueDate, input.extensionDays);
        // A set number of days is for a law that provides no extension. Where
        // the law provides one, it is also the ceiling: no later date, and
        // never a second extension or one on a closed request.
        if (!state.allowed && state.reason !== "no_extension") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              state.reason === "closed"
                ? "This request is closed; its deadline cannot be extended"
                : "The deadline already runs to the longest period the law allows",
          });
        }
        if (state.allowed && newDueDate.getTime() > state.newDueDate.getTime()) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "The deadline already runs to the longest period the law allows",
          });
        }
      } else {
        if (!state.allowed) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              state.reason === "closed"
                ? "This request is closed; its deadline cannot be extended"
                : state.reason === "no_extension"
                  ? "The primary jurisdiction's law allows no extension; give extensionDays to extend by a set number of days"
                  : "The deadline already runs to the longest period the law allows",
          });
        }
        newDueDate = state.newDueDate;
      }

      const updated = await ctx.prisma.dSARRequest.update({
        where: { id: input.id },
        data: {
          extendedDueDate: newDueDate,
          extensionReason: input.reason,
          dueDate: newDueDate,
        },
      });

      // The requester is told of the new date by e-mail at once, in their
      // language; the reasons follow from the organisation. The reason typed
      // here is never put in the e-mail.
      let requesterNotified = false;
      if (request.requesterEmail && !request.redactedAt) {
        requesterNotified = await sendDSARExtensionEmail({
          to: request.requesterEmail,
          requesterName: request.requesterName,
          organizationName: ctx.organization.name,
          publicId: request.publicId,
          newDueDate,
          locale: (request.metadata as { locale?: string } | null)?.locale,
        });
      }

      await ctx.prisma.dSARAuditLog.create({
        data: {
          dsarRequestId: input.id,
          action: "DEADLINE_EXTENDED",
          performedBy: ctx.session.user.id,
          details: {
            originalDue: request.dueDate,
            newDue: newDueDate,
            extensionDays: input.extensionDays,
            statutoryExtension: input.extensionDays === undefined,
            reason: input.reason,
            requesterNotified,
          },
        },
      });

      return { ...updated, requesterNotified };
    }),

  // ============================================================
  // DSAR TASKS
  // ============================================================

  // Create task
  createTask: dsarOfficerProcedure
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

      // The asset and the assignee must belong to this organisation too
      await assertIdsInOrg(ctx.prisma.dataAsset, [input.dataAssetId], { organizationId: ctx.organization.id }, "Data asset");
      await assertUsersAreMembers(ctx.prisma.organizationMember, [input.assigneeId], ctx.organization.id, "Assignee");

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
  updateTask: dsarOfficerProcedure
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

      // A new assignee must be a member of this organisation
      await assertUsersAreMembers(ctx.prisma.organizationMember, [input.assigneeId], ctx.organization.id, "Assignee");

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
  generateTasks: dsarOfficerProcedure
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

      // Create a task for each asset, in the language of the person
      // generating them.
      const locale = pilotLocale(
        localeFromCookieGetter(ctx.getCookie) ??
          (ctx.membership as { user?: { locale: string | null } | null }).user?.locale ??
          undefined
      );
      const tasks = await ctx.prisma.dSARTask.createMany({
        data: assets.map((asset) => ({
          dsarRequestId: input.dsarRequestId,
          dataAssetId: asset.id,
          ...generatedTaskText(locale, { asset: asset.name, requester: request.requesterName }),
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
  addCommunication: dsarOfficerProcedure
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
        include: { organization: { select: { name: true } } },
      });

      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "DSAR request not found",
        });
      }

      // A model reply still holding a placeholder ({reasons}, {details}, ...)
      // is not sent: staff complete it first.
      if (
        input.direction === "OUTBOUND" &&
        remainingPlaceholders(input.subject ?? "", input.content).length > 0
      ) {
        throw new TRPCError({ code: "BAD_REQUEST", message: UNFILLED_PLACEHOLDERS_MESSAGE });
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

      // Send transactional email to requester for OUTBOUND messages on the Email channel.
      // Skip if the request has been redacted (PII no longer available).
      if (
        input.direction === "OUTBOUND" &&
        input.channel.toLowerCase() === "email" &&
        request.requesterEmail &&
        !request.redactedAt
      ) {
        const locale = (request.metadata as { locale?: string } | null)?.locale;
        await sendDSARCommunicationEmail({
          to: request.requesterEmail,
          requesterName: request.requesterName,
          organizationName: request.organization.name,
          publicId: request.publicId,
          subject: input.subject,
          content: input.content,
          locale,
        });
      }

      return communication;
    }),

  // ============================================================
  // PUBLIC INTAKE FORMS
  // ============================================================

  // Get intake form configuration
  getIntakeForm: dsarOrganizationProcedure
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
  upsertIntakeForm: dsarAdminOrgProcedure
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
        privacyNoticeUrl: webUrl.optional().or(z.literal("")),
        // Shown on the public form when it is not taking requests.
        privacyContactEmail: z.string().email().max(320).optional().or(z.literal("")),
        // The kit's setting; the hosted service keeps 30 days whatever is stored.
        retentionDays: z.number().int().min(1).max(3650).optional(),
        isActive: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { organizationId: _orgId, privacyContactEmail, ...rest } = input;
      const formData = {
        ...rest,
        ...(privacyContactEmail !== undefined && { privacyContactEmail: privacyContactEmail || null }),
      };

      // customCss is rendered inside a <style> block on the *public* DSAR
      // portal — sanitize at write time so markup can never be stored
      // (the portal sanitizes again at render as defense in depth).
      if (formData.customCss) {
        formData.customCss = sanitizeCss(formData.customCss);
      }

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

  // Deadline reminder e-mails (7, 3 and 1 day before, and once overdue):
  // on by default, switched off per organisation.
  // The public form's monthly count against its ceiling (hosted; "open" on
  // the kit) and, below the 1,000 ceiling, the volume upgrade's payment link
  // per currency (null where none is set). Read by the module's pages.
  moduleAccess: dsarOrganizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      const access = await getDsarModuleAccess(ctx.prisma, ctx.organization);
      const links = volumeUpgradeLinks();
      const email = ctx.session.user.email;
      const upgrade =
        access.gate === "standard"
          ? {
              EUR: links.EUR ? volumeUpgradeCheckoutUrl(links.EUR, ctx.organization.id, email) : null,
              USD: links.USD ? volumeUpgradeCheckoutUrl(links.USD, ctx.organization.id, email) : null,
            }
          : null;
      return { ...access, upgrade };
    }),

  getReminderSettings: dsarOrganizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      const org = await ctx.prisma.organization.findUnique({
        where: { id: ctx.organization.id },
        select: { dsarRemindersEnabled: true },
      });
      return { enabled: org?.dsarRemindersEnabled ?? true };
    }),

  setReminderSettings: dsarAdminOrgProcedure
    .input(z.object({ organizationId: z.string(), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.organization.update({
        where: { id: ctx.organization.id },
        data: { dsarRemindersEnabled: input.enabled },
      });
      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "Organization",
          entityId: ctx.organization.id,
          action: "UPDATE",
          changes: { dsarRemindersEnabled: input.enabled },
        },
      });
      return { enabled: input.enabled };
    }),

  // ============================================================
  // PUBLIC PORTAL ENDPOINTS (No auth required)
  // ============================================================

  // Get public intake form config by org slug (for the public portal)
  getPublicForm: dsarPublicProcedure
    .input(z.object({ orgSlug: z.string() }))
    .query(async ({ ctx, input }) => {
      const org = await ctx.prisma.organization.findUnique({
        where: { slug: input.orgSlug },
        include: {
          dsarIntakeForms: { where: { isActive: true }, take: 1 },
        },
      });
      // No organisation or no active form: not found.
      if (!org || org.dsarIntakeForms.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Intake form not available for this organization",
        });
      }
      const form = org.dsarIntakeForms[0]!;
      // At the month's ceiling (hosted) the form exists but takes no
      // request: the page shows the organisation's privacy contact instead
      // (submitPublic refuses anyway).
      const accepting = acceptsPublicRequest(await getDsarModuleAccess(ctx.prisma, org));
      return {
        orgName: org.name,
        title: form.title,
        description: form.description,
        thankYouMessage: form.thankYouMessage,
        privacyNoticeUrl: form.privacyNoticeUrl,
        accepting,
        contactEmail: accepting ? null : (form.privacyContactEmail ?? null),
        // What the requester is told: 30 days on the hosted service.
        retentionDays: effectiveRetentionDays(form.retentionDays),
        enabledTypes: form.enabledTypes,
        customCss: form.customCss,
        // Signed with the time the form was loaded; submitPublic refuses a
        // submission without it, or sent too soon after it
        // (src/server/services/dsar/public-intake-guard.ts).
        formToken: issueFormToken(input.orgSlug),
      };
    }),

  // Submit public DSAR request
  submitPublic: dsarPublicProcedure
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
        locale: z.string().optional(),
        // The hidden field: empty when a person fills the form.
        website: z.string().max(500).optional(),
        // From getPublicForm: when the form was loaded, signed.
        formToken: z.string().max(200).optional(),
      })
    )
    .mutation(async ({ ctx, input: rawInput }) => {
      const input = sanitizeInput(rawInput);
      // Abuse protection, before anything is read. The hidden field: a
      // script that fills it is answered as if received, and nothing is
      // stored or counted against the monthly ceiling. Then the signed form
      // token (minimum fill time). Refusals are counted, without personal data.
      if (honeypotFilled(input)) {
        await recordRejection(ctx.prisma, "honeypot", null);
        return { publicId: decoyPublicId(), acknowledgementSent: false };
      }
      await assertHumanSubmission(ctx.prisma, input);
      const org = await ctx.prisma.organization.findUnique({
        where: { slug: input.orgSlug },
        include: {
          dsarIntakeForms: {
            where: { isActive: true },
            take: 1,
          },
          jurisdictions: DSAR_RULE_JURISDICTIONS,
        },
      });

      if (!org || org.dsarIntakeForms.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organization or intake form not found",
        });
      }

      // A read-only pilot also closes the public intake (no-op on the kit).
      // Rights requests are outside the pilot's records ceiling: the monthly
      // ceiling below is their only limit.
      const pilotLang = pilotLocale(input.locale);
      assertPilotWritable(org, pilotLang);

      // The monthly ceiling (hosted): 100 public-form requests per calendar
      // month (Madrid), 1,000 with the volume upgrade.
      if (!acceptsPublicRequest(await getDsarModuleAccess(ctx.prisma, org))) {
        throw new TRPCError({ code: "FORBIDDEN", message: DSAR_MODULE_MESSAGES.formClosed });
      }

      // Shared daily limits per client address and per organisation, counted
      // in the database so every server instance sees the same total.
      await assertWithinDailyLimits(ctx.prisma, org.id, ctx.clientIp);

      const receivedAt = new Date();
      const dueDate = calculateDSARDueDate(
        receivedAt,
        dsarRuleForType(input.type, orgDsarRule(org.jurisdictions, receivedAt))
      );

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
          // The requester's language, for the e-mails that follow (a
          // deadline extension, messages from the organisation).
          ...(input.locale && { metadata: { locale: pilotLocale(input.locale) } }),
        },
      });

      await ctx.prisma.dSARAuditLog.create({
        data: {
          dsarRequestId: request.id,
          action: "REQUEST_SUBMITTED_PUBLIC",
          details: { type: input.type },
        },
      });

      // The count of public-form requests (src/server/services/dsar/module.ts):
      // an organisation entry with no personal data, which outlives the
      // request, so deleting a request never frees a place.
      await ctx.prisma.auditLog.create({
        data: {
          organizationId: org.id,
          entityType: "DSARRequest",
          entityId: request.id,
          action: DSAR_PUBLIC_SUBMISSION,
          metadata: { type: input.type },
        },
      });

      // At 50, 75 and 90 per cent of the month's ceiling, and at the
      // ceiling, the owners and administrators are told once each
      // (src/server/services/dsar/volume-notices.ts). Never throws.
      await notifyVolumeStep(
        ctx.prisma,
        org,
        org.dsarIntakeForms[0]?.privacyContactEmail,
        reminderMailerFromEnv()
      );

      // The acknowledgement carries the organisation, the type of request,
      // the due date and the reference: never the description the requester
      // typed. One address receives at most a few per day across every
      // organisation; over that, the request still stands (the clock started
      // on receipt) and the form tells the requester to keep the reference.
      const acknowledgementSent = await mayAcknowledge(ctx.prisma, input.requesterEmail, org.id);
      if (acknowledgementSent) {
        await sendDSARConfirmationEmail({
          to: input.requesterEmail,
          requesterName: input.requesterName,
          organizationName: org.name,
          publicId: request.publicId,
          type: input.type,
          dueDate,
          locale: input.locale,
        });
      }

      return { publicId: request.publicId, acknowledgementSent };
    }),

  // Check request status (public)
  checkStatus: dsarPublicProcedure
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
          metadata: true,
          organization: { select: { name: true, slug: true } },
        },
      });

      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Request not found",
        });
      }

      let responseUrl: string | null = null;
      let responseExpiresAt: string | null = null;
      if (request.status === DSARStatus.COMPLETED && request.metadata && typeof request.metadata === "object") {
        const meta = request.metadata as Record<string, unknown>;
        if (typeof meta.responseUrl === "string") {
          responseUrl = meta.responseUrl;
        }
        if (typeof meta.responseExpiresAt === "string") {
          responseExpiresAt = meta.responseExpiresAt;
        }
      }

      const {
        metadata: _metadata,
        organization: { name, slug },
        ...rest
      } = request;
      return { available: true as const, ...rest, organization: { name, slug }, responseUrl, responseExpiresAt };
    }),

  // Set the public response download link (officer/dashboard side)
  setResponseLink: dsarOfficerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        id: z.string(),
        responseUrl: webUrl.nullable(),
        responseExpiresAt: z.string().datetime().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.dSARRequest.findFirst({
        where: { id: input.id, organizationId: ctx.organization.id },
        select: { id: true, metadata: true },
      });

      if (!request) {
        throw new TRPCError({ code: "NOT_FOUND", message: "DSAR request not found" });
      }

      const existingMetadata = (request.metadata && typeof request.metadata === "object")
        ? (request.metadata as Record<string, unknown>)
        : {};

      const nextMetadata: Record<string, unknown> = { ...existingMetadata };
      if (input.responseUrl) {
        nextMetadata.responseUrl = input.responseUrl;
        nextMetadata.responseExpiresAt = input.responseExpiresAt ?? null;
      } else {
        delete nextMetadata.responseUrl;
        delete nextMetadata.responseExpiresAt;
      }

      const updated = await ctx.prisma.dSARRequest.update({
        where: { id: input.id },
        data: { metadata: nextMetadata },
      });

      await ctx.prisma.dSARAuditLog.create({
        data: {
          dsarRequestId: input.id,
          action: input.responseUrl ? "RESPONSE_LINK_SET" : "RESPONSE_LINK_CLEARED",
          performedBy: ctx.session.user.id,
          details: { hasExpiry: Boolean(input.responseExpiresAt) },
        },
      });

      return updated;
    }),

  // Withdraw a public request (data subject self-cancel)
  withdrawPublic: dsarPublicProcedure
    .input(z.object({ publicId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.dSARRequest.findUnique({
        where: { publicId: input.publicId },
        select: { id: true, status: true },
      });

      if (!request) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Request not found" });
      }

      const finalStates: DSARStatus[] = [
        DSARStatus.COMPLETED,
        DSARStatus.REJECTED,
        DSARStatus.CANCELLED,
      ];
      if (finalStates.includes(request.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This request is already finalized and cannot be withdrawn.",
        });
      }

      await ctx.prisma.dSARRequest.update({
        where: { id: request.id },
        data: { status: DSARStatus.CANCELLED, completedAt: new Date() },
      });

      await ctx.prisma.dSARAuditLog.create({
        data: {
          dsarRequestId: request.id,
          action: "REQUEST_WITHDRAWN_PUBLIC",
          details: { previousStatus: request.status },
        },
      });

      return { success: true };
    }),

  // ============================================================
  // STATISTICS
  // ============================================================

  // Get DSAR statistics
  getStats: dsarOrganizationProcedure
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
  deleteDSAR: dsarAdminOrgProcedure
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
          message: "Only completed or canceled requests can be deleted",
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
  redactDSAR: dsarAdminOrgProcedure
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
          message: "Only completed, canceled, or rejected requests can be redacted",
        });
      }

      // Every field that can hold personal data, in the request, its
      // messages, its tasks and the free text of its trail
      // (src/server/services/dsar/redact.ts).
      await redactDsarRequest(ctx.prisma, input.id, {
        organizationId: ctx.organization.id,
        now: new Date(),
        audit: {
          action: "PII_REDACTED",
          performedBy: ctx.session.user.id,
          details: { reason: "manual_redaction" },
        },
      });

      return { success: true };
    }),
});
