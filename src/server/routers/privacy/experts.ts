import { z } from "zod";
import { Resend } from "resend";
import { createTRPCRouter, protectedProcedure } from "../../trpc";
import {
  searchExperts,
  getExpertById,
  getSpecializations,
  getCountries,
  getLanguages,
  getExpertTypes,
  contactExpert,
  getContactRequest,
} from "../../services/dealroom/client";
import { emailFrom, emailFooterHtml } from "@/config/brand";
import { brand } from "@/config/brand";
import { logger } from "@/lib/logger";

let resend: Resend | null = null;
function getResend(): Resend | null {
  if (resend) return resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  resend = new Resend(key);
  return resend;
}

export const expertsRouter = createTRPCRouter({
  search: protectedProcedure
    .input(
      z.object({
        query: z.string().optional(),
        specialization: z.string().optional(),
        country: z.string().optional(),
        language: z.string().optional(),
        expertType: z.enum(["legal", "technical", "deployment"]).optional(),
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
        requesterName: z.string().min(1).max(200),
        requesterEmail: z.string().email(),
        requesterCompany: z.string().max(200).optional(),
        subject: z.string().min(1).max(500),
        message: z.string().max(5000).optional(),
        governingLaw: z.string().max(200).optional(),
      })
    )
    .mutation(async ({ input }) => {
      // 1. Submit to Dealroom (or mock)
      const result = await contactExpert(input);

      // 2. Look up expert profile for their email
      const expert = await getExpertById(input.expertId);

      // 3. Send emails (fire-and-forget — don't block the response)
      const r = getResend();
      if (r) {
        const from = emailFrom();
        const footer = emailFooterHtml();
        const companyLine = input.requesterCompany
          ? `<p style="margin:0;color:#6b7280;font-size:13px;">Company: ${input.requesterCompany}</p>`
          : "";
        const messageLine = input.message
          ? `<div style="margin-top:16px;padding:12px 16px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;"><p style="margin:0;font-size:14px;color:#374151;white-space:pre-wrap;">${input.message}</p></div>`
          : "";

        // Email to expert
        if (expert?.email) {
          r.emails.send({
            from,
            to: expert.email,
            subject: `New inquiry: ${input.subject}`,
            html: `
              <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
                <p>Hi ${expert.name ?? "there"},</p>
                <p>You have received a new inquiry via ${brand.nameUppercase}:</p>
                <div style="margin:16px 0;padding:16px;border:1px solid #e5e7eb;border-radius:8px;">
                  <p style="margin:0 0 4px;font-weight:600;font-size:15px;">${input.subject}</p>
                  <p style="margin:0;color:#6b7280;font-size:13px;">From: ${input.requesterName} &lt;${input.requesterEmail}&gt;</p>
                  ${companyLine}
                </div>
                ${messageLine}
                <p style="margin-top:16px;">Please reply directly to <a href="mailto:${input.requesterEmail}" style="color:#2563eb;">${input.requesterEmail}</a>.</p>
                <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
                <p style="color:#9ca3af;font-size:11px;">${footer}</p>
              </div>
            `.trim(),
          }).catch((err) => {
            logger.error("Failed to send expert notification email", err, { expertId: input.expertId });
          });
        }

        // Confirmation email to requester
        r.emails.send({
          from,
          to: input.requesterEmail,
          subject: `Your request has been sent — ${input.subject}`,
          html: `
            <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
              <p>Hi ${input.requesterName},</p>
              <p>Your request has been sent to <strong>${expert?.name ?? "the expert"}</strong>${expert?.firm ? ` at ${expert.firm}` : ""}. They will respond directly to this email address.</p>
              <div style="margin:16px 0;padding:16px;border:1px solid #e5e7eb;border-radius:8px;">
                <p style="margin:0 0 4px;font-weight:600;font-size:15px;">${input.subject}</p>
                <p style="margin:0;color:#6b7280;font-size:13px;">Sent to: ${expert?.name ?? "Expert"}${expert?.firm ? ` — ${expert.firm}` : ""}</p>
              </div>
              ${messageLine}
              <p style="margin-top:16px;color:#6b7280;font-size:13px;">If you don't hear back within 2 business days, please contact <a href="mailto:${brand.supportEmail}" style="color:#2563eb;">${brand.supportEmail}</a>.</p>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
              <p style="color:#9ca3af;font-size:11px;">${footer}</p>
            </div>
          `.trim(),
        }).catch((err) => {
          logger.error("Failed to send requester confirmation email", err, { to: input.requesterEmail });
        });
      }

      return result;
    }),

  getContactRequest: protectedProcedure
    .input(z.object({ requestId: z.string() }))
    .query(async ({ input }) => {
      return getContactRequest(input.requestId);
    }),
});
