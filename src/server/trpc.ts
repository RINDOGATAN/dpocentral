// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { initTRPC, TRPCError } from "@trpc/server";
import { type Session, getServerSession } from "next-auth";
import { cookies } from "next/headers";
import superjson from "superjson";
import { ZodError } from "zod";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getSecurityModule } from "@/lib/security";
import { sanitizeStrings } from "@/lib/sanitize";
import { formatUserError, isTransientDbMessage, TRANSIENT_MESSAGE } from "@/lib/format-error";
import { invalidInputMessage, newErrorReference, unexpectedFailureMessage } from "@/lib/error-reference";
import { logger } from "@/lib/logger";
import { localeFromCookieGetter } from "@/i18n/locale-cookie";
import {
  assertPilotCapacity,
  assertPilotWritable,
  CAPPED_CREATE_PATHS,
  pilotLocale,
  READ_ONLY_ALLOWED_PATHS,
  recordPilotFirstSignIn,
} from "@/server/services/pilot/caps";

interface CreateContextOptions {
  session: Session | null;
  getCookie: (name: string) => string | undefined;
}

export const createInnerTRPCContext = (opts: CreateContextOptions) => {
  return {
    session: opts.session,
    prisma,
    getCookie: opts.getCookie,
  };
};

export const createTRPCContext = async (opts: { req: Request }) => {
  const session = await getServerSession(authOptions);
  const cookieStore = await cookies();

  return createInnerTRPCContext({
    session,
    getCookie: (name: string) => cookieStore.get(name)?.value,
  });
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error, path, ctx }) {
    let message = shape.message;
    let reference: string | null = null;
    const locale = () => pilotLocale(ctx ? localeFromCookieGetter(ctx.getCookie) : undefined);
    if (error.code === "BAD_REQUEST" && error.cause instanceof ZodError) {
      // The validator's message is a JSON dump; name the fields instead.
      const fields = [
        ...new Set(
          error.cause.issues
            .map((issue) => issue.path.filter((p) => typeof p === "string").pop())
            .filter((p): p is string => !!p)
        ),
      ].slice(0, 5);
      message = invalidInputMessage(locale(), fields);
    } else if (error.code === "INTERNAL_SERVER_ERROR") {
      // A TRPCError thrown on purpose carries a message written for people
      // and no foreign cause. Anything else is unexpected: the person gets
      // a sentence they can act on and a reference, the log gets the real
      // error under the same reference. Nothing raw reaches the browser.
      const unexpected = error.cause !== undefined && !(error.cause instanceof TRPCError);
      if (unexpected) {
        reference = newErrorReference();
        logger.error(`tRPC ${path ?? "<no-path>"} failed [ref ${reference}]`, error.cause);
        const raw = error.cause instanceof Error ? error.cause.message : "";
        message = isTransientDbMessage(raw)
          ? TRANSIENT_MESSAGE
          : unexpectedFailureMessage(locale(), reference);
      } else {
        message = formatUserError(error, "An unexpected error occurred. Please try again.");
      }
    }
    // tRPC adds the stack whenever NODE_ENV is not "production" (a mis-set
    // self-host included): only a developer's machine gets it.
    const { stack, ...rest } = shape.data;
    const dataWithoutStack = process.env.NODE_ENV === "development" ? { ...rest, stack } : rest;
    return {
      ...shape,
      message,
      data: {
        ...dataWithoutStack,
        reference,
        zodError:
          process.env.NODE_ENV === "development" && error.cause instanceof ZodError
            ? error.cause.flatten()
            : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

// Sanitize string inputs — delegates to @dpocentral/security if installed,
// otherwise applies the baseline HTML-stripping sanitizer from the
// open-source core (src/lib/sanitize.ts). Never a no-op.
export function sanitizeInput<T>(input: T): T {
  const security = getSecurityModule();
  if (security?.sanitizeInput) return security.sanitizeInput(input);
  return sanitizeStrings(input);
}

const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
  // The id check is redundant in the types but real at runtime: the jwt
  // callback clears token.sub when a stale token cannot be re-anchored to a
  // local user, and a session without a user id must read as signed out —
  // never reach Prisma as userId: undefined.
  if (!ctx.session || !ctx.session.user || !ctx.session.user.id) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      session: { ...ctx.session, user: ctx.session.user },
    },
  });
});

export const protectedProcedure = t.procedure.use(enforceUserIsAuthed);

// Organization context middleware — membership check only (any role)
export const withOrganization = t.middleware(async ({ ctx, next, getRawInput }) => {
  if (!ctx.session || !ctx.session.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const rawInput = await getRawInput();
  const input = rawInput as { organizationId?: string } | undefined;
  const organizationId = input?.organizationId;

  if (!organizationId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Organization ID is required",
    });
  }

  // Check if user is a member of this organization
  const membership = await ctx.prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId: ctx.session.user.id,
      },
    },
    include: {
      organization: true,
    },
  });

  if (!membership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have access to this organization",
    });
  }

  return next({
    ctx: {
      session: { ...ctx.session, user: ctx.session.user },
      organization: membership.organization,
      membership,
    },
  });
});

// Hosted pilot caps (no-op on the self-hosted kit): the first request by a
// signed-in member after the pilot went live records the organisation's first
// sign-in, which starts the editing window. Once the window ends, org-scoped
// mutations are refused (exports are GET routes and stay open); creates are
// refused at the records ceiling.
const enforcePilotCaps = t.middleware(async ({ ctx, next, path, type }) => {
  const org = (ctx as { organization?: { id: string; pilotStartedAt: Date | null } })
    .organization;
  if (!org) return next();
  await recordPilotFirstSignIn(ctx.prisma, org);
  if (type !== "mutation") return next();
  const locale = pilotLocale(localeFromCookieGetter(ctx.getCookie));
  if (!READ_ONLY_ALLOWED_PATHS.has(path)) {
    assertPilotWritable(org, locale);
  }
  const resource = CAPPED_CREATE_PATHS[path];
  if (resource) {
    await assertPilotCapacity(ctx.prisma, org.id, resource, 1, locale);
  }
  return next();
});

export const organizationProcedure = t.procedure
  .use(enforceUserIsAuthed)
  .use(withOrganization)
  .use(enforcePilotCaps);

// Role-based access control — enforced in the open-source core.
// The baseline role gate below always applies, with or without the optional
// @dpocentral/security package (which layers additional policy on top, not
// the role check itself). A VIEWER must never be able to mutate or destroy
// organization data on any build.
type OrgRole = "OWNER" | "ADMIN" | "PRIVACY_OFFICER" | "MEMBER" | "VIEWER";

const withOrganizationAndRole = (...roles: OrgRole[]) =>
  t.middleware(async ({ ctx, next, getRawInput }) => {
    if (!ctx.session || !ctx.session.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    const rawInput = await getRawInput();
    const input = rawInput as { organizationId?: string } | undefined;
    const organizationId = input?.organizationId;

    if (!organizationId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Organization ID is required",
      });
    }

    const membership = await ctx.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: ctx.session.user.id,
        },
      },
      include: {
        organization: true,
      },
    });

    if (!membership) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have access to this organization",
      });
    }

    // Baseline role check — always enforced
    if (!roles.includes(membership.role as OrgRole)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have permission to perform this action",
      });
    }

    return next({
      ctx: {
        session: { ...ctx.session, user: ctx.session.user },
        organization: membership.organization,
        membership,
      },
    });
  });

// Writer: can create/update records (everyone except VIEWER)
export const writerProcedure = t.procedure
  .use(enforceUserIsAuthed)
  .use(withOrganizationAndRole("OWNER", "ADMIN", "PRIVACY_OFFICER", "MEMBER"))
  .use(enforcePilotCaps);

// Officer: DSAR management, incidents, assessments
export const officerProcedure = t.procedure
  .use(enforceUserIsAuthed)
  .use(withOrganizationAndRole("OWNER", "ADMIN", "PRIVACY_OFFICER"))
  .use(enforcePilotCaps);

// Admin org: delete operations, org settings
export const adminOrgProcedure = t.procedure
  .use(enforceUserIsAuthed)
  .use(withOrganizationAndRole("OWNER", "ADMIN"))
  .use(enforcePilotCaps);

// Admin emails from environment variable (comma-separated)
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/**
 * Platform-admin rights come from this product's own records only:
 *  - the session must carry the stamp of a sign-in this product performed
 *    itself (a sibling's token identifies the person, it grants nothing);
 *  - the address compared with ADMIN_EMAILS is the one on the LOCAL user row,
 *    never the one a token claims.
 * Anything missing: not an admin.
 */
export async function isPlatformAdmin(ctx: {
  session: Session | null;
  prisma: { user: { findUnique: (typeof prisma)["user"]["findUnique"] } };
}): Promise<boolean> {
  const user = ctx.session?.user;
  if (!user?.id || user.signedInHere !== true || ADMIN_EMAILS.length === 0) return false;
  const row = await ctx.prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true },
  });
  return !!row?.email && ADMIN_EMAILS.includes(row.email.toLowerCase());
}

// Platform admin middleware - checks the local user row against ADMIN_EMAILS
const enforcePlatformAdmin = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session || !ctx.session.user?.email) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  if (!(await isPlatformAdmin(ctx))) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Platform admin access required",
    });
  }

  return next({
    ctx: {
      session: { ...ctx.session, user: ctx.session.user },
    },
  });
});

export const adminProcedure = t.procedure
  .use(enforceUserIsAuthed)
  .use(enforcePlatformAdmin);
