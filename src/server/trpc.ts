import { initTRPC, TRPCError } from "@trpc/server";
import { type Session, getServerSession } from "next-auth";
import { cookies } from "next/headers";
import superjson from "superjson";
import { ZodError } from "zod";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

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
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

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

// Organization context middleware
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
