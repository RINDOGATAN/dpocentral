import { type NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { Resend } from "resend";
import prisma from "@/lib/prisma";
import { brand, emailFrom, emailFooterHtml } from "@/config/brand";

// Only initialize Resend if API key is available
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const isDev = process.env.NODE_ENV === "development";

// Cross-app SSO: share session cookie across *.todo.law subdomains
const isProduction = process.env.NODE_ENV === "production";
const cookieDomain = isProduction ? ".todo.law" : undefined;
const cookiePrefix = isProduction ? "__Secure-" : "";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  providers: [
    // Development-only credentials provider for easy local testing
    ...(isDev
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
            allowDangerousEmailAccountLinking: true,
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
                console.error("Failed to send verification email:", error);
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
        console.error("Auto-join organization failed during sign-in:", error);
      }
      return true;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
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
