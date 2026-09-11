// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Removes the sample demo organization from an existing install, but only
 * when nobody has used it.
 *
 *   npm run db:remove-untouched-demo              # remove if untouched
 *   npm run db:remove-untouched-demo -- --dry-run # report only, change nothing
 *
 * Until demo data was gated behind DEMO_SEED=true, every fresh install
 * received a demo organization ("demo-organization"), a demo user
 * ("demo-user") and sample records. The sovereign migrator runs this on every
 * boot of an existing install (deploy/sovereign/migrate.sh) so those rows
 * leave firms' databases. It never runs where DEMO_SEED=true (the hosted
 * demo keeps its demo organization).
 *
 * "Untouched" is checked strictly, and any doubt keeps the demo in place:
 *  - the organization still carries its seeded identity (id, slug, name,
 *    isDemo flag) and has no audit-log activity;
 *  - its only member is the demo user, who belongs to no other organization;
 *  - no seeded record was edited after it was created;
 *  - the deletion runs in a transaction that counts every table before and
 *    after: if anything other than the seed's own rows would disappear (a
 *    record someone added, a linked login account), the transaction is
 *    rolled back and nothing is removed.
 *
 * Exits 0 whether the demo was removed or kept; a non-zero exit means an
 * unexpected error (the migrator logs it and carries on).
 */

import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_ORG_ID = "demo-organization";
const DEMO_USER_ID = "demo-user";
const DEMO_ORG_NAME = "Acme Corporation (Demo)";
/** Question ids of the sample DPIA responses planted by prisma/seed.ts. */
const SEEDED_RESPONSE_QUESTIONS = ["q1_1", "q1_2", "q1_3", "q1_4", "q1_5", "q2_1", "q3_1", "q3_2"];
/** A seeded row updated later than this after creation counts as edited. */
const EDIT_TOLERANCE = "5 minutes";

const DRY_RUN = process.argv.includes("--dry-run");

class KeepDemo extends Error {}
class DryRunRollback extends Error {}

type Tx = Prisma.TransactionClient;

interface Table {
  model: string;
  table: string;
  hasId: boolean;
  hasTimestamps: boolean;
}

const TABLES: Table[] = Prisma.dmmf.datamodel.models.map((m) => {
  const names = new Set(m.fields.map((f) => f.name));
  return {
    model: m.name,
    table: m.dbName ?? m.name,
    hasId: names.has("id"),
    hasTimestamps: names.has("createdAt") && names.has("updatedAt"),
  };
});

/**
 * SQL predicate selecting the rows the demo seed itself created in a table.
 * Seeded rows use "demo-" ids, except the few written with generated ids.
 */
function seedOwnedPredicate(t: Table): string | null {
  switch (t.model) {
    case "Organization":
      return `id = '${DEMO_ORG_ID}'`;
    case "User":
      return `id = '${DEMO_USER_ID}'`;
    case "OrganizationMember":
      return `"organizationId" = '${DEMO_ORG_ID}' AND "userId" = '${DEMO_USER_ID}'`;
    case "OrganizationJurisdiction":
      return `"organizationId" = '${DEMO_ORG_ID}'`;
    case "AssessmentResponse":
      return (
        `"assessmentId" LIKE 'demo-%' AND "questionId" IN (` +
        SEEDED_RESPONSE_QUESTIONS.map((q) => `'${q}'`).join(", ") +
        `)`
      );
    default:
      return t.hasId ? `id LIKE 'demo-%'` : null;
  }
}

async function count(tx: Tx, table: string, where?: string | null): Promise<number> {
  const rows = await tx.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT count(*) AS n FROM "${table}"${where ? ` WHERE ${where}` : ""}`
  );
  return Number(rows[0].n);
}

async function snapshot(tx: Tx): Promise<Map<string, { total: number; seed: number }>> {
  const out = new Map<string, { total: number; seed: number }>();
  for (const t of TABLES) {
    const pred = seedOwnedPredicate(t);
    out.set(t.table, {
      total: await count(tx, t.table),
      seed: pred ? await count(tx, t.table, pred) : 0,
    });
  }
  return out;
}

function keep(reason: string): never {
  throw new KeepDemo(reason);
}

async function preChecks(tx: Tx): Promise<boolean> {
  const org = await tx.organization.findUnique({ where: { id: DEMO_ORG_ID } });
  if (!org) return false;

  const settings = (org.settings ?? {}) as Record<string, unknown>;
  if (org.slug !== "demo" || org.name !== DEMO_ORG_NAME || settings.isDemo !== true) {
    keep("the demo organization has been renamed or changed");
  }

  const members = await tx.organizationMember.findMany({
    where: { organizationId: DEMO_ORG_ID },
    select: { userId: true },
  });
  if (members.some((m) => m.userId !== DEMO_USER_ID)) {
    keep("the demo organization has members other than the demo user");
  }

  const elsewhere = await tx.organizationMember.count({
    where: { userId: DEMO_USER_ID, organizationId: { not: DEMO_ORG_ID } },
  });
  if (elsewhere > 0) keep("the demo user belongs to another organization");

  if ((await tx.auditLog.count({ where: { organizationId: DEMO_ORG_ID } })) > 0) {
    keep("the demo organization has audit-log activity");
  }

  for (const t of TABLES) {
    if (!t.hasId || !t.hasTimestamps || t.model === "Organization") continue;
    const edited = await count(
      tx,
      t.table,
      `id LIKE 'demo-%' AND "updatedAt" > "createdAt" + interval '${EDIT_TOLERANCE}'`
    );
    if (edited > 0) keep(`${edited} seeded record(s) in ${t.table} were edited after creation`);
  }
  return true;
}

async function main() {
  if (process.env.DEMO_SEED === "true") {
    console.log("[demo-cleanup] DEMO_SEED=true — this instance keeps its demo organization.");
    return;
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        if (!(await preChecks(tx))) {
          console.log("[demo-cleanup] no demo organization present — nothing to do.");
          return;
        }

        const before = await snapshot(tx);
        await tx.organization.delete({ where: { id: DEMO_ORG_ID } });
        try {
          await tx.user.deleteMany({ where: { id: DEMO_USER_ID } });
        } catch (e) {
          // A restricting foreign key: records elsewhere still point at the
          // demo user, so it has been used.
          if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
            keep("other records still refer to the demo user");
          }
          throw e;
        }
        const after = await snapshot(tx);

        const removed: string[] = [];
        for (const [table, b] of before) {
          const a = after.get(table)!;
          const total = b.total - a.total;
          const seed = b.seed - a.seed;
          if (total !== seed) {
            keep(`${total - seed} row(s) in ${table} were not created by the demo seed`);
          }
          if (total > 0) removed.push(`${table}: ${total}`);
        }

        console.log(
          `[demo-cleanup] ${DRY_RUN ? "would remove" : "removed"} the untouched demo organization ` +
            `and demo user (${removed.join(", ")}).`
        );
        if (DRY_RUN) throw new DryRunRollback();
      },
      { timeout: 120_000 }
    );
  } catch (e) {
    if (e instanceof DryRunRollback) {
      console.log("[demo-cleanup] dry run — rolled back, nothing changed.");
      return;
    }
    if (e instanceof KeepDemo) {
      console.log(`[demo-cleanup] kept the demo organization: ${e.message}.`);
      return;
    }
    throw e;
  }
}

main()
  .catch((e) => {
    console.error("[demo-cleanup] failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
