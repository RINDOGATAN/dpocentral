// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Print one JSON object of account counts for this instance.
 *
 * Read-only by construction: the only Prisma calls here are `count` and a
 * `findMany` that selects a single foreign key. Nothing is written.
 *
 * No name and no e-mail address ever leaves this script. Only integers.
 *
 * Definitions, because the words are ambiguous (shared with the sibling
 * suite apps):
 *   users          every row in User, including people who joined an
 *                  organization by e-mail domain and never returned.
 *   organizations  every row in Organization.
 *   paying         distinct Customers holding at least one entitlement that is
 *                  ACTIVE, not past its expiry, and NOT a TRIAL. TRIAL rows are
 *                  the flip-day grace (scripts/grant-paywall-grace.ts), not a
 *                  purchase. Both Stripe subscriptions and offline licences
 *                  count; it is the honest answer to "who has bought
 *                  something", not a recurring-revenue figure.
 *   installs       null, always. Self-hosted installs are not tracked by
 *                  design: the published images report to nobody.
 *
 * Usage: DATABASE_URL=<hosted url> node scripts/count-accounts.mjs
 *    or: node --env-file=.env.prod.local scripts/count-accounts.mjs
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. Run with: node --env-file=<env file> scripts/count-accounts.mjs",
    );
  }

  const now = new Date();

  const [users, organizations, payingRows] = await Promise.all([
    prisma.user.count(),
    prisma.organization.count(),
    // Distinct customers with a live, paid-for entitlement. Selecting only
    // the foreign key keeps every name and address out of this process.
    prisma.skillEntitlement.findMany({
      where: {
        status: "ACTIVE",
        licenseType: { not: "TRIAL" },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { customerId: true },
      distinct: ["customerId"],
    }),
  ]);

  return {
    product: "DPO CENTRAL",
    users,
    organizations,
    paying: payingRows.length,
    installs: null,
    as_of: now.toISOString(),
    source: "hosted DB, read-only, licence holders excluding TRIAL",
  };
}

main()
  .then((result) => {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  })
  .catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
