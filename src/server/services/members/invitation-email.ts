// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The invitation e-mail sent when an owner or admin adds a teammate by
 * e-mail address. Sent through the product's existing sender (Resend, the
 * same as the sign-in and rights-request e-mails); nothing is sent where no
 * sender is configured (the self-hosted kit by default), and the caller then
 * tells the inviter to pass the sign-in link on themselves.
 */

import { Resend } from "resend";
import { brand, emailFooterHtml, emailFrom } from "@/config/brand";
import { logger } from "@/lib/logger";
import { escapeHtml } from "@/server/services/notifications/internal-inbox";

type Locale = "en" | "es";

const ROLE: Record<Locale, Record<string, string>> = {
  en: { OWNER: "owner", ADMIN: "admin", PRIVACY_OFFICER: "privacy officer", MEMBER: "member", VIEWER: "viewer" },
  es: { OWNER: "propietario", ADMIN: "administrador", PRIVACY_OFFICER: "responsable de privacidad", MEMBER: "miembro", VIEWER: "lector" },
};

export interface InvitationEmailInput {
  to: string;
  orgName: string;
  inviterName: string;
  role: string;
  locale: Locale;
  signInUrl: string;
}

/** The parts of the e-mail, before layout (tested on their own). */
export function invitationCopy(input: InvitationEmailInput) {
  const role = ROLE[input.locale][input.role] ?? input.role.toLowerCase();
  if (input.locale === "es") {
    return {
      subject: `${input.inviterName} te ha invitado a ${input.orgName} en ${brand.name}`,
      body: `${input.inviterName} te ha invitado a unirte a ${input.orgName} en ${brand.name} con el rol de ${role}. Inicia sesión con esta dirección de correo (${input.to}) para aceptar: se te añadirá a la organización al iniciar sesión.`,
      button: "Iniciar sesión",
      ignore: "Si no esperabas esta invitación, puedes ignorar este correo.",
    };
  }
  return {
    subject: `${input.inviterName} invited you to ${input.orgName} on ${brand.name}`,
    body: `${input.inviterName} has invited you to join ${input.orgName} on ${brand.name} as ${role}. Sign in with this e-mail address (${input.to}) to accept: you will be added to the organization when you sign in.`,
    button: "Sign in",
    ignore: "If you did not expect this invitation, you can ignore this e-mail.",
  };
}

/** The sign-in address the invitation links to, on this deployment. */
export function invitationSignInUrl(): string {
  const base = (process.env.NEXTAUTH_URL || brand.appUrl).replace(/\/$/, "");
  return `${base}/sign-in?callbackUrl=${encodeURIComponent("/privacy")}`;
}

/** True when this deployment can send e-mail. */
export function invitationEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

/** Sends the invitation. Returns false when nothing was sent. */
export async function sendInvitationEmail(input: InvitationEmailInput): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const c = invitationCopy(input);
  try {
    const { error } = await resend.emails.send({
      from: emailFrom(),
      to: input.to,
      subject: c.subject,
      text: `${c.body}\n\n${c.button}: ${input.signInUrl}\n\n${c.ignore}`,
      html: `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; background: ${brand.colors.background}; border-radius: 12px; overflow: hidden;">
          <div style="padding: 24px 24px 16px; border-bottom: 1px solid ${brand.colors.border};">
            <span style="font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: 0.05em;">${brand.nameUppercase}</span>
          </div>
          <div style="padding: 32px 24px;">
            <p style="color: ${brand.colors.foreground}; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">${escapeHtml(c.body)}</p>
            <a href="${input.signInUrl}" style="display: inline-block; background: ${brand.colors.primary}; color: ${brand.colors.primaryForeground}; padding: 12px 28px; text-decoration: none; font-weight: 600; font-size: 14px; border-radius: 24px;">${escapeHtml(c.button)}</a>
            <p style="color: ${brand.colors.mutedForeground}; font-size: 13px; line-height: 1.5; margin: 24px 0 0;">${escapeHtml(c.ignore)}</p>
          </div>
          <div style="padding: 16px 24px; border-top: 1px solid ${brand.colors.border};">
            <p style="color: #666666; font-size: 11px; margin: 0;">${emailFooterHtml()}</p>
          </div>
        </div>
      `,
    });
    if (error) {
      logger.error("Invitation e-mail refused by the mail service", error);
      return false;
    }
    return true;
  } catch (err) {
    logger.error("Invitation e-mail failed", err);
    return false;
  }
}
