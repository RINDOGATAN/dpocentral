/**
 * Just-in-time (JIT) user provisioning — identity model A of the DPO
 * Central DB decoupling.
 *
 * DPO Central owns its own database. Cross-app SSO on the *.todo.law
 * cloud means a valid session can arrive for a user who signed into
 * another todo.law app but has no local DPO `users` row. Rather than
 * share vendor.watch's DB, DPO mints its own row from the token claims
 * the first time such a user shows up, keyed by email.
 *
 * A JIT user has NO org membership yet, so they fall into DPO's normal
 * "create or join an organization" onboarding — identity is linked by
 * email; DPO-specific data starts fresh. The PrismaAdapter still handles
 * direct DPO sign-ins; JIT only covers cross-app-cookie arrivals.
 */

import type { Db } from "./prisma";

export interface JitClaims {
  email: string;
  name?: string | null;
  picture?: string | null;
}

/**
 * Ensure a local DPO `users` row exists for the given claims. Upserts by
 * email: existing rows are left untouched, absent ones are created from
 * the token claims. Returns the row's id (the local DPO user id).
 */
export async function ensureDpoUser(
  prisma: Pick<Db, "user">,
  claims: JitClaims
): Promise<{ id: string }> {
  const user = await prisma.user.upsert({
    where: { email: claims.email },
    update: {},
    create: {
      email: claims.email,
      name: claims.name ?? null,
      image: claims.picture ?? null,
    },
    select: { id: true },
  });

  return user;
}
