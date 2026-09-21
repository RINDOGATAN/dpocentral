// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { z } from "zod";
import { Resend } from "resend";
import { ExpertEngagementStatus } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, writerProcedure } from "../../trpc";
import prisma from "@/lib/prisma";
import {
  searchExperts,
  getExpertById,
  getExpertRecord,
  getSpecializations,
  getCountries,
  getLanguages,
  getExpertTypes,
  contactExpert,
  getContactRequest,
} from "../../services/dealroom/client";
import { brand, emailFrom, emailFooterHtml } from "@/config/brand";
import { logger } from "@/lib/logger";
import { sendInternalNotice } from "@/server/services/notifications/internal-inbox";
import { defaultLocale, type Locale } from "@/i18n/config";
import { localeFromCookieGetter } from "@/i18n/locale-cookie";
import enMessages from "@/messages/en.json";
import esMessages from "@/messages/es.json";

/**
 * The confirmation the person who asked receives, in their own language.
 *
 * The copy is read straight from the message bundles rather than through
 * next-intl's server helpers: this runs inside a tRPC mutation, where there is
 * no request config to read, and the bundles are the same strings the
 * interface uses, so the two never drift.
 */
const CONFIRMATION_COPY: Record<
  Locale,
  typeof enMessages.experts.contact.confirmationEmail
> = {
  en: enMessages.experts.contact.confirmationEmail,
  es: esMessages.experts.contact.confirmationEmail,
};

/** Substitutes {placeholders}. Every value must already be escaped. */
function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? values[key] : match
  );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Cached by key, not by first use: a client built from an earlier key must
// never outlive it, or an instance with no key configured would look to this
// code as though mail were working.
let cachedClient: { key: string; client: Resend } | null = null;
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (cachedClient?.key !== key) {
    cachedClient = { key, client: new Resend(key) };
  }
  return cachedClient.client;
}

// What a client may receive of an engagement row, for EVERY procedure that
// answers with one. Named fields, not `include`: the row carries the directory
// person's address (expertEmail), which is ours to hold and never to hand
// out. A client receives everything else. Adding a column to the model must
// not silently add it to a response.
const ENGAGEMENT_CLIENT_SELECT = {
  id: true,
  organizationId: true,
  expertId: true,
  expertName: true,
  expertFirm: true,
  contactedById: true,
  subject: true,
  message: true,
  notes: true,
  status: true,
  contactedAt: true,
  updatedAt: true,
  closedAt: true,
  externalRequestId: true,
  contactedBy: { select: { id: true, name: true, email: true } },
} as const;

export const expertsRouter = createTRPCRouter({
  search: protectedProcedure
    .input(
      z.object({
        query: z.string().optional(),
        specialization: z.string().optional(),
        country: z.string().optional(),
        language: z.string().optional(),
        expertType: z.enum(["technical", "deployment"]).optional(),
        excludeType: z.string().optional(),
        limit: z.number().min(1).max(100).optional(),
        offset: z.number().min(0).optional(),
      })
    )
    .query(async ({ input }) => {
      return searchExperts(input);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return getExpertById(input.id);
    }),

  listFilters: protectedProcedure.query(async () => {
    return {
      specializations: getSpecializations(),
      countries: getCountries(),
      languages: getLanguages(),
      expertTypes: getExpertTypes(),
    };
  }),

  contact: protectedProcedure
    .input(
      z.object({
        expertId: z.string(),
        expertName: z.string().optional(),
        organizationId: z.string().optional(),
        requesterName: z.string().min(1).max(200),
        requesterEmail: z.string().email(),
        requesterCompany: z.string().max(200).optional(),
        subject: z.string().min(1).max(500),
        message: z.string().max(5000).optional(),
        governingLaw: z.string().max(200).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Submit to Dealroom (or mock)
      const result = await contactExpert(input);

      // 2. The full record, address included. It is read for our own storage
      //    only: the address is written to the engagement row so we can reach
      //    the person ourselves, and is never mailed to and never returned to
      //    a client. See the note in ../../services/dealroom/client.ts.
      const expert = await getExpertRecord(input.expertId);

      // Log an engagement record so the org has a CRM-style history.
      // Verifies org membership before writing.
      let stored = false;
      let organizationName: string | null = null;
      if (input.organizationId && ctx.session.user.id) {
        const membership = await prisma.organizationMember.findUnique({
          where: {
            organizationId_userId: {
              organizationId: input.organizationId,
              userId: ctx.session.user.id,
            },
          },
          include: { organization: { select: { name: true } } },
        });
        if (membership) {
          organizationName = membership.organization?.name ?? null;
          await prisma.expertEngagement.create({
            data: {
              organizationId: input.organizationId,
              expertId: input.expertId,
              expertName: expert?.name ?? input.expertName ?? "Expert",
              expertFirm: expert?.firm ?? null,
              expertEmail: expert?.email ?? null,
              contactedById: ctx.session.user.id,
              subject: input.subject,
              message: input.message,
              status: ExpertEngagementStatus.CONTACTED,
              externalRequestId: typeof result === "object" && result && "id" in result ? String((result as { id?: unknown }).id ?? "") || null : null,
            },
          });
          stored = true;
        }
      }

      if (!stored) {
        // No engagement row exists for this request, so the copy below is the
        // only trace of it. Say so at error level rather than losing it
        // quietly.
        logger.error(
          "A request for technical help was not recorded: no organization was given, or the requester is not a member of it. The copy to our inbox is the only record.",
          undefined,
          {
            expertId: input.expertId,
            organizationId: input.organizationId ?? null,
            userId: ctx.session.user.id,
          }
        );
      }

      // Every request goes to us and only to us. Before 2026-09-20 a request
      // went to the person listed in the directory, when their record carried
      // an address, and nothing reached us, so we never learned that a firm
      // had asked for help. Their address is now ours to hold and never to
      // hand out: nothing is mailed to it from this product, and we contact
      // them ourselves. This notice is therefore the request, not a copy of
      // it. It runs whether or not the mail service is configured: an
      // unconfigured service is logged loudly by sendInternalNotice, never
      // skipped.
      const requestedAt = new Date();
      const notice = await sendInternalNotice({
        // The product, not the requester's words: a mail header is not HTML,
        // and nothing a user typed belongs in one. Their subject is a field
        // below, where it is escaped like every other value.
        subject: `Technical help requested through ${brand.name}`,
        intro: "Someone asked for technical help through the directory.",
        replyTo: input.requesterEmail,
        fields: [
          { label: "Who asked", value: input.requesterName },
          { label: "Organisation", value: input.requesterCompany ?? organizationName },
          { label: "Their address", value: input.requesterEmail },
          { label: "Subject", value: input.subject },
          { label: "Product", value: brand.name },
          { label: "Asked of", value: expert?.name ?? input.expertName ?? null },
          { label: "Governing law", value: input.governingLaw },
          { label: "When", value: requestedAt.toISOString() },
          { label: "Recorded in the engagement log", value: stored ? "yes" : "no" },
        ],
        body: input.message ?? null,
        record: {
          expertId: input.expertId,
          organizationId: input.organizationId ?? null,
          stored,
          requestedAt: requestedAt.toISOString(),
        },
      });

      // Nothing was stored and nothing reached our inbox: the request exists
      // only in the log above. Say so rather than showing the person a
      // confirmation for something that did not happen.
      if (!stored && !notice.delivered) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Your request could not be recorded or delivered. Please try again, or write to us directly.",
        });
      }

      // 3. The confirmation to the person who asked, in their own language.
      //    Awaited: serverless kills the runtime once the response is sent.
      const locale: Locale = localeFromCookieGetter(ctx.getCookie) ?? defaultLocale;
      const copy = CONFIRMATION_COPY[locale];
      const r = getResend();

      if (!r) {
        // Say it plainly. The request is held (in the engagement row, in the
        // inbox notice, or both), but the person who asked has not been told
        // anything, so someone has to answer them by hand.
        logger.error(
          "RESEND_API_KEY is not configured, so the person who asked for technical help received no confirmation. Their request is held and must be answered by hand.",
          undefined,
          {
            to: input.requesterEmail,
            expertId: input.expertId,
            stored,
            deliveredToInbox: notice.delivered,
          }
        );
        return { ...result, confirmationSent: false };
      }

      // Escape every user-supplied value before it enters the message.
      const safeName = escapeHtml(input.requesterName);
      const safeSubject = escapeHtml(input.subject);
      const safeSupport = escapeHtml(brand.supportEmail);
      const messageLine = input.message
        ? `<div style="margin-top:16px;padding:12px 16px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;"><p style="margin:0;font-size:14px;color:#374151;white-space:pre-wrap;">${escapeHtml(input.message)}</p></div>`
        : "";

      // The subject line carries no user text: a mail header is not HTML, and
      // nothing a requester typed belongs in one.
      const confirmationSent = await r.emails
        .send({
          from: emailFrom(),
          to: input.requesterEmail,
          subject: copy.subject,
          html: `
            <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
              <p>${fill(copy.greeting, { name: safeName })}</p>
              <p>${fill(copy.received, { product: escapeHtml(brand.name) })}</p>
              <div style="margin:16px 0;padding:16px;border:1px solid #e5e7eb;border-radius:8px;">
                <p style="margin:0 0 4px;color:#6b7280;font-size:12px;">${escapeHtml(copy.requestLabel)}</p>
                <p style="margin:0;font-weight:600;font-size:15px;">${safeSubject}</p>
              </div>
              ${messageLine}
              <p style="margin-top:16px;color:#6b7280;font-size:13px;">${fill(copy.closing, {
                support: `<a href="mailto:${safeSupport}" style="color:#2563eb;">${safeSupport}</a>`,
              })}</p>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
              <p style="color:#9ca3af;font-size:11px;">${emailFooterHtml()}</p>
            </div>
          `.trim(),
        })
        .then((res) => {
          if (res.error) {
            logger.error("The mail service rejected the confirmation to the person who asked.", undefined, {
              error: JSON.stringify(res.error),
              to: input.requesterEmail,
            });
            return false;
          }
          logger.info("Confirmation sent to the person who asked", {
            to: input.requesterEmail,
            id: res.data?.id,
          });
          return true;
        })
        .catch((err) => {
          logger.error("Sending the confirmation to the person who asked failed.", err, {
            to: input.requesterEmail,
          });
          return false;
        });

      return { ...result, confirmationSent };
    }),

  getContactRequest: protectedProcedure
    .input(z.object({ requestId: z.string() }))
    .query(async ({ input }) => {
      return getContactRequest(input.requestId);
    }),

  // List engagements for the current user's org. Each row is a CRM-style
  // record of an expert outreach: who, what, when, status. Used by the
  // Engagement History panel on /privacy/experts.
  listEngagements: protectedProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx, input }) => {
      const membership = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: input.organizationId,
            userId: ctx.session.user.id,
          },
        },
      });
      if (!membership) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return prisma.expertEngagement.findMany({
        where: { organizationId: input.organizationId },
        select: ENGAGEMENT_CLIENT_SELECT,
        orderBy: { contactedAt: "desc" },
      });
    }),

  // Update engagement status + notes. Closing an engagement (COMPLETED /
  // DECLINED) stamps closedAt. A write: membership and a writing role are
  // resolved by writerProcedure (a VIEWER is refused).
  updateEngagement: writerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        engagementId: z.string(),
        status: z.nativeEnum(ExpertEngagementStatus).optional(),
        notes: z.string().max(5000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const engagement = await prisma.expertEngagement.findFirst({
        where: { id: input.engagementId, organizationId: ctx.organization.id },
        select: { id: true },
      });
      if (!engagement) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Engagement not found" });
      }

      const isClosing = input.status === "COMPLETED" || input.status === "DECLINED";
      return prisma.expertEngagement.update({
        where: { id: engagement.id, organizationId: ctx.organization.id },
        data: {
          status: input.status,
          notes: input.notes,
          closedAt: isClosing ? new Date() : undefined,
        },
        // The same withheld shape as the list: never the whole row.
        select: ENGAGEMENT_CLIENT_SELECT,
      });
    }),
});
