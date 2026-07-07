// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { type NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { Resend } from "resend";
import prisma from "@/lib/prisma";
import { brand, emailFrom, emailFooterHtml } from "@/config/brand";
import { features } from "@/config/features";
import { logger } from "@/lib/logger";
import { getSecurityModule } from "@/lib/security";
import { ensureDpoUser } from "@/lib/jit-provisioning";

// Only initialize Resend if API key is available
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const isDev = process.env.NODE_ENV === "development";

// Session-cookie scope. Default: host-only (NextAuth's default — the cookie
// is valid only for the exact host in NEXTAUTH_URL), which is correct for
// every self-hosted install. Deployments that need cross-subdomain SSO
// (e.g. the hosted *.todo.law cloud) opt IN by setting AUTH_COOKIE_DOMAIN
// to the parent domain (".todo.law"). The old behavior — defaulting to
// .todo.law in production — silently broke login on every self-host that
// wasn't the Docker bundle; the default is now the safe one.
const isProduction = process.env.NODE_ENV === "production";
const cookieDomain = process.env.AUTH_COOKIE_DOMAIN || undefined;
const cookiePrefix = isProduction ? "__Secure-" : "";

// Wrap PrismaAdapter to strip OAuth tokens before storage.
// DPO Central uses JWT sessions and never reads these tokens,
// so storing them is unnecessary risk.
const baseAdapter = PrismaAdapter(prisma) as NextAuthOptions["adapter"];
const adapter = {
  ...baseAdapter!,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  linkAccount: async (account: any) => {
    const { refresh_token, access_token, id_token, ...safeAccount } = account;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await baseAdapter!.linkAccount!(safeAccount as any);
  },
} as NextAuthOptions["adapter"];

export const authOptions: NextAuthOptions = {
  adapter,
  providers: [
    // Local credentials provider: dev mode, and sovereign/self-hosted
    // deployments (NEXT_PUBLIC_LOCAL_AUTH_ENABLED=true — no external
    // OAuth/mailer required behind the firm's own network).
    ...(features.devAuthEnabled
      ? [
          CredentialsProvider({
            id: "dev-credentials",
            name: "Dev Login",
            credentials: {
              email: { label: "Email", type: "email", placeholder: "dev@example.com" },
            },
            async authorize(credentials) {
              if (!credentials?.email) return null;

              // Find or create user for dev mode
              let user = await prisma.user.findUnique({
                where: { email: credentials.email },
              });

              if (!user) {
                user = await prisma.user.create({
                  data: {
                    email: credentials.email,
                    name: credentials.email.split("@")[0],
                  },
                });
              }

              return {
                id: user.id,
                email: user.email,
                name: user.name,
              };
            },
          }),
        ]
      : []),
    // Production providers
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            authorization: {
              params: {
                prompt: "select_account",
                access_type: "offline",
                response_type: "code",
              },
            },
          }),
        ]
      : []),
    ...(process.env.RESEND_API_KEY && resend
      ? [
          EmailProvider({
            from: emailFrom(),
            sendVerificationRequest: async ({ identifier: email, url }) => {
              try {
                await resend!.emails.send({
                  from: emailFrom(),
                  to: email,
                  subject: `Sign in to ${brand.nameUppercase}`,
                  html: `
                    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; background: ${brand.colors.background}; border-radius: 12px; overflow: hidden;">
                      <div style="padding: 24px 24px 16px; border-bottom: 1px solid ${brand.colors.border};">
                        <span style="font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: 0.05em;">${brand.nameUppercase}</span>
                        <span style="font-size: 13px; color: ${brand.colors.mutedForeground}; margin-left: 10px;">${brand.tagline}</span>
                      </div>
                      <div style="padding: 32px 24px;">
                        <p style="color: ${brand.colors.foreground}; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">Click the button below to sign in to your ${brand.nameUppercase} account:</p>
                        <a href="${url}" style="display: inline-block; background: ${brand.colors.primary}; color: ${brand.colors.primaryForeground}; padding: 12px 28px; text-decoration: none; font-weight: 600; font-size: 14px; border-radius: 24px;">Sign In to ${brand.nameUppercase}</a>
                        <p style="color: ${brand.colors.mutedForeground}; font-size: 13px; line-height: 1.5; margin: 24px 0 0;">If you didn\u2019t request this email, you can safely ignore it.</p>
                      </div>
                      <div style="padding: 16px 24px; border-top: 1px solid ${brand.colors.border};">
                        <p style="color: #666666; font-size: 11px; margin: 0;">${emailFooterHtml()}</p>
                      </div>
                    </div>
                  `,
                });
              } catch (error) {
                logger.error("Failed to send verification email", error);
                throw new Error("Failed to send verification email");
              }
            },
          }),
        ]
      : []),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user }) {
      // Auto-join organization by email domain
      // Wrapped in try/catch so sign-in succeeds even if auto-join fails
      try {
        if (user.email) {
          const emailDomain = user.email.split("@")[1];

          // Skip auto-join for public email domains (requires @dpocentral/security)
          const security = getSecurityModule();
          if (security?.isPublicEmailDomain?.(emailDomain?.toLowerCase() ?? "")) {
            return true;
          }

          // Find organization with matching domain
          const matchingOrg = await prisma.organization.findFirst({
            where: { domain: emailDomain },
          });

          if (matchingOrg) {
            // Check if user is already a member
            const existingMembership = await prisma.organizationMember.findFirst({
              where: {
                organizationId: matchingOrg.id,
                userId: user.id,
              },
            });

            if (!existingMembership) {
              // Auto-add user as MEMBER
              await prisma.organizationMember.create({
                data: {
                  organizationId: matchingOrg.id,
                  userId: user.id,
                  role: "MEMBER",
                },
              });

              // Log the auto-join
              await prisma.auditLog.create({
                data: {
                  organizationId: matchingOrg.id,
                  userId: user.id,
                  entityType: "OrganizationMember",
                  entityId: user.id,
                  action: "AUTO_JOIN",
                  changes: { domain: emailDomain, email: user.email },
                },
              });
            }
          }
        }
      } catch (error) {
        logger.error("Auto-join organization failed during sign-in", error);
      }
      return true;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.userType = token.userType ?? null;
      }
      return session;
    },
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
      }

      // JIT provisioning (DB-decoupling identity model A): a cross-app
      // *.todo.law SSO cookie can present a valid session for a user who
      // signed into another todo.law app but has no local DPO `users` row.
      // Mint one from the token claims, keyed by email, and repoint the
      // token at the local user id. Direct DPO sign-ins go through the
      // PrismaAdapter (user present) and already have a local row, so this
      // is a no-op for them. The JIT user has no org membership yet and
      // lands in DPO's normal create-or-join-organization onboarding.
      if (!user && token.email) {
        const claimedId = token.sub ?? (token.id as string | undefined);
        const existing = claimedId
          ? await prisma.user.findUnique({
              where: { id: claimedId },
              select: { id: true },
            })
          : null;
        if (!existing) {
          const dpoUser = await ensureDpoUser(prisma, {
            email: token.email,
            name: token.name,
            picture: token.picture,
          });
          token.sub = dpoUser.id;
          token.id = dpoUser.id;
        }
      }

      // Fetch userType on sign-in, explicit session update, or if the
      // JWT was minted before userType existed (backfill for old tokens).
      const userId = token.sub ?? (token.id as string | undefined);
      if (userId && (user || trigger === "update" || token.userType === undefined)) {
        const dbUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { userType: true },
        });
        token.userType = dbUser?.userType ?? null;
      }
      return token;
    },
  },
  pages: {
    signIn: "/sign-in",
    verifyRequest: "/verify-request",
    error: "/auth-error",
  },
  // Cross-app SSO cookie config for *.todo.law
  ...(cookieDomain && {
    cookies: {
      sessionToken: {
        name: `${cookiePrefix}next-auth.session-token`,
        options: {
          httpOnly: true,
          sameSite: "lax" as const,
          path: "/",
          secure: true,
          domain: cookieDomain,
        },
      },
      callbackUrl: {
        name: `${cookiePrefix}next-auth.callback-url`,
        options: {
          sameSite: "lax" as const,
          path: "/",
          secure: true,
          domain: cookieDomain,
        },
      },
      csrfToken: {
        name: `next-auth.csrf-token`,
        options: {
          httpOnly: true,
          sameSite: "lax" as const,
          path: "/",
          secure: true,
          domain: cookieDomain,
        },
      },
    },
  }),
  // Allow credentials in development
  ...(isDev && {
    debug: true,
  }),
};
