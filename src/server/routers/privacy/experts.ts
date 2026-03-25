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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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

      // 3. Send emails (must await — serverless kills the runtime after response)
      const r = getResend();
      if (r) {
        const from = emailFrom();
        const footer = emailFooterHtml();
        // Escape user-provided values before embedding in HTML emails
        const safeName = escapeHtml(input.requesterName);
        const safeEmail = escapeHtml(input.requesterEmail);
        const safeSubject = escapeHtml(input.subject);
        const safeExpertName = escapeHtml(expert?.name ?? "there");
        const companyLine = input.requesterCompany
          ? `<p style="margin:0;color:#6b7280;font-size:13px;">Company: ${escapeHtml(input.requesterCompany)}</p>`
          : "";
        const messageLine = input.message
          ? `<div style="margin-top:16px;padding:12px 16px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;"><p style="margin:0;font-size:14px;color:#374151;white-space:pre-wrap;">${escapeHtml(input.message)}</p></div>`
          : "";

        const emailPromises: Promise<void>[] = [];

        // Email to expert
        if (expert?.email) {
          emailPromises.push(
            r.emails.send({
              from,
              replyTo: input.requesterEmail,
              to: expert.email,
              subject: `New inquiry: ${input.subject}`,
              html: `
                <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
                  <p>Hi ${safeExpertName},</p>
                  <p>You have received a new inquiry via ${brand.nameUppercase}:</p>
                  <div style="margin:16px 0;padding:16px;border:1px solid #e5e7eb;border-radius:8px;">
                    <p style="margin:0 0 4px;font-weight:600;font-size:15px;">${safeSubject}</p>
                    <p style="margin:0;color:#6b7280;font-size:13px;">From: ${safeName} &lt;${safeEmail}&gt;</p>
                    ${companyLine}
                  </div>
                  ${messageLine}
                  <p style="margin-top:16px;">Please reply directly to <a href="mailto:${safeEmail}" style="color:#2563eb;">${safeEmail}</a>.</p>
                  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
                  <p style="color:#9ca3af;font-size:11px;">${footer}</p>
                </div>
              `.trim(),
            }).then((res) => {
              if (res.error) {
                logger.error("Resend rejected expert email", undefined, { error: JSON.stringify(res.error), to: expert.email });
              } else {
                logger.info("Expert notification email sent", { to: expert.email, id: res.data?.id });
              }
            }).catch((err) => {
              logger.error("Failed to send expert notification email", err, { expertId: input.expertId, to: expert.email });
            })
          );
        }

        // Confirmation email to requester
        emailPromises.push(
          r.emails.send({
            from,
            to: input.requesterEmail,
            subject: `Your request has been sent — ${input.subject}`,
            html: `
              <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
                <p>Hi ${safeName},</p>
                <p>Your request has been sent to <strong>${escapeHtml(expert?.name ?? "the expert")}</strong>${expert?.firm ? ` at ${escapeHtml(expert.firm)}` : ""}. They will respond directly to this email address.</p>
                <div style="margin:16px 0;padding:16px;border:1px solid #e5e7eb;border-radius:8px;">
                  <p style="margin:0 0 4px;font-weight:600;font-size:15px;">${safeSubject}</p>
                  <p style="margin:0;color:#6b7280;font-size:13px;">Sent to: ${escapeHtml(expert?.name ?? "Expert")}${expert?.firm ? ` — ${escapeHtml(expert.firm)}` : ""}</p>
                </div>
                ${messageLine}
                <p style="margin-top:16px;color:#6b7280;font-size:13px;">If you don't hear back within 2 business days, please contact <a href="mailto:${brand.supportEmail}" style="color:#2563eb;">${brand.supportEmail}</a>.</p>
                <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
                <p style="color:#9ca3af;font-size:11px;">${footer}</p>
              </div>
            `.trim(),
          }).then((res) => {
            if (res.error) {
              logger.error("Resend rejected requester email", undefined, { error: JSON.stringify(res.error), to: input.requesterEmail });
            } else {
              logger.info("Requester confirmation email sent", { to: input.requesterEmail, id: res.data?.id });
            }
          }).catch((err) => {
            logger.error("Failed to send requester confirmation email", err, { to: input.requesterEmail });
          })
        );

        // Wait for all emails to complete before returning
        await Promise.all(emailPromises);
      }

      return result;
    }),

  getContactRequest: protectedProcedure
    .input(z.object({ requestId: z.string() }))
    .query(async ({ input }) => {
      return getContactRequest(input.requestId);
    }),
});
