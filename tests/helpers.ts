/**
 * Test helpers: build real tRPC callers over a mocked Prisma.
 *
 * These tests exercise the actual routers and the real middleware chain
 * (auth check, organization-membership resolution, the baseline role gate in
 * src/server/trpc.ts) — the security-relevant logic — while Prisma is
 * module-mocked per test file (see each *.test.ts). Hermetic and fast: no
 * database, no network. The point is to lock the behavior of the middleware
 * and the org-scoping predicates, not to test Postgres.
 *
 * Each test file must `vi.mock("@/lib/prisma", ...)` (and the auth/cookie
 * modules trpc.ts imports at load time) before importing this helper.
 */

import type { Session } from "next-auth";
import { createInnerTRPCContext } from "@/server/trpc";

/** A minimal authenticated session for a given user id. */
export function sessionFor(
  userId: string,
  email = `${userId}@test.example`
): Session {
  return {
    user: { id: userId, email, name: userId, image: null },
    expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  } as Session;
}

type Callable = { createCaller: (ctx: ReturnType<typeof createInnerTRPCContext>) => unknown };

/** Build a caller for a router with the given session (null = anonymous). */
export function callerFor<R extends Callable>(
  router: R,
  session: Session | null
): ReturnType<R["createCaller"]> {
  return router.createCaller(
    createInnerTRPCContext({ session, getCookie: () => undefined })
  ) as ReturnType<R["createCaller"]>;
}
