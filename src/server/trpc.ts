import { initTRPC, TRPCError } from "@trpc/server";
import { type Session, getServerSession } from "next-auth";
import { cookies } from "next/headers";
import superjson from "superjson";
import { ZodError } from "zod";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getSecurityModule } from "@/lib/security";

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
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
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
// otherwise passes through unchanged.
export function sanitizeInput<T>(input: T): T {
  const security = getSecurityModule();
  if (security?.sanitizeInput) return security.sanitizeInput(input);
  return input;
}

const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session || !ctx.session.user) {
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

export const organizationProcedure = t.procedure
  .use(enforceUserIsAuthed)
  .use(withOrganization);

// Role-based access control — uses @dpocentral/security for role enforcement
// if installed, otherwise falls back to membership-only check (any member can access).
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

    // Role check — only enforced when @dpocentral/security is installed
    const security = getSecurityModule();
    if (security && !roles.includes(membership.role as OrgRole)) {
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
  .use(withOrganizationAndRole("OWNER", "ADMIN", "PRIVACY_OFFICER", "MEMBER"));

// Officer: DSAR management, incidents, assessments
export const officerProcedure = t.procedure
  .use(enforceUserIsAuthed)
  .use(withOrganizationAndRole("OWNER", "ADMIN", "PRIVACY_OFFICER"));

// Admin org: delete operations, org settings
export const adminOrgProcedure = t.procedure
  .use(enforceUserIsAuthed)
  .use(withOrganizationAndRole("OWNER", "ADMIN"));

// Admin emails from environment variable (comma-separated)
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

// Platform admin middleware - checks if user email is in ADMIN_EMAILS
const enforcePlatformAdmin = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session || !ctx.session.user?.email) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  if (!ADMIN_EMAILS.includes(ctx.session.user.email.toLowerCase())) {
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
