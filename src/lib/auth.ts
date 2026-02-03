import { type NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { Resend } from "resend";
import prisma from "@/lib/prisma";

// Only initialize Resend if API key is available
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const isDev = process.env.NODE_ENV === "development";

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
          }),
        ]
      : []),
    ...(process.env.RESEND_API_KEY && resend
      ? [
          EmailProvider({
            from: process.env.EMAIL_FROM,
            sendVerificationRequest: async ({ identifier: email, url }) => {
              try {
                await resend!.emails.send({
                  from: process.env.EMAIL_FROM || "onboarding@resend.dev",
                  to: email,
                  subject: "Sign in to DPO Central",
                  html: `
                    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
                      <h1 style="color: #13e9d1; background: #1c1f37; padding: 20px; margin: 0;">DPO Central</h1>
                      <div style="padding: 20px; background: #232742; color: #e5e5e5;">
                        <p>Click the button below to sign in to DPO Central:</p>
                        <a href="${url}" style="display: inline-block; background: #13e9d1; color: #1c1f37; padding: 12px 24px; text-decoration: none; font-weight: bold; margin: 20px 0;">Sign In</a>
                        <p style="color: #d0d0d0; font-size: 14px;">If you didn't request this email, you can safely ignore it.</p>
                        <p style="color: #d0d0d0; font-size: 12px;">Or copy this link: ${url}</p>
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
  // Allow credentials in development
  ...(isDev && {
    debug: true,
  }),
};
