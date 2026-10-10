// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The organisation-plan migration on an existing database: every earlier
 * migration is applied, organisations are written as they exist today, then
 * the plan migration runs. The rows must keep every value they had, read as
 * PILOT with no plan dates or note, and the table must not be rewritten (its
 * file node is unchanged, so the NOT NULL default is a catalogue change only).
 *
 * Skipped unless PLAN_MIGRATION_TEST_DATABASE_URL names a THROWAWAY local
 * PostgreSQL (localhost or 127.0.0.1). The test creates its own scratch
 * database there and drops it at the end. For example:
 *
 *   docker run -d --name dpc-paid-db -e POSTGRES_USER=dpc \
 *     -e POSTGRES_PASSWORD=dpc_local -e POSTGRES_DB=dpc -p 127.0.0.1:55445:5432 \
 *     public.ecr.aws/docker/library/postgres:16-alpine
 *   PLAN_MIGRATION_TEST_DATABASE_URL=postgresql://dpc:dpc_local@127.0.0.1:55445/dpc \
 *     npx vitest run tests/paid-plan-migration-db.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const ADMIN_URL = process.env.PLAN_MIGRATION_TEST_DATABASE_URL;
const run = ADMIN_URL && /@(127\.0\.0\.1|localhost)[:/]/.test(ADMIN_URL) ? describe : describe.skip;

const PLAN_MIGRATION = "20261010120000_organization_plan";
const MIGRATIONS_DIR = path.resolve(__dirname, "../prisma/migrations");
const PRISMA_BIN = path.resolve(__dirname, "../node_modules/.bin/prisma");
const SCRATCH = `dpc_plan_migration_${process.pid}`;

function scratchUrl(): string {
  const u = new URL(ADMIN_URL!);
  u.pathname = `/${SCRATCH}`;
  return u.toString();
}

function applyMigration(name: string) {
  execFileSync(
    PRISMA_BIN,
    ["db", "execute", "--url", scratchUrl(), "--file", path.join(MIGRATIONS_DIR, name, "migration.sql")],
    { stdio: "pipe" }
  );
}

run("organisation plan migration on an existing database", () => {
  let admin: PrismaClient;
  let db: PrismaClient;

  beforeAll(async () => {
    admin = new PrismaClient({ datasourceUrl: ADMIN_URL });
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${SCRATCH}"`);
    await admin.$executeRawUnsafe(`CREATE DATABASE "${SCRATCH}"`);
    db = new PrismaClient({ datasourceUrl: scratchUrl() });
  }, 60_000);

  afterAll(async () => {
    await db?.$disconnect();
    await admin?.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${SCRATCH}" WITH (FORCE)`);
    await admin?.$disconnect();
  });

  it("keeps existing organisations as they were, on PILOT, without rewriting the table", async () => {
    const all = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    expect(all).toContain(PLAN_MIGRATION);
    for (const name of all.filter((n) => n < PLAN_MIGRATION)) applyMigration(name);

    await db.$executeRawUnsafe(`
      INSERT INTO organizations (id, name, slug, "updatedAt", "pilotStartedAt", "safeguardsChoice")
      VALUES ('org-a', 'Org A', 'org-a', now(), '2026-10-02T08:00:00Z', 'shared_eu'),
             ('org-b', 'Org B', 'org-b', now(), NULL, NULL)`);
    const before = await db.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT * FROM organizations ORDER BY id`
    );
    const [{ node: nodeBefore }] = await db.$queryRawUnsafe<{ node: number }[]>(
      `SELECT pg_relation_filenode('organizations')::int AS node`
    );

    applyMigration(PLAN_MIGRATION);

    // A different statement text from the one above: the connection's cached
    // plan for it would not match the new columns.
    const after = await db.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT *, plan::text AS plan FROM organizations ORDER BY id ASC`
    );
    const [{ node: nodeAfter }] = await db.$queryRawUnsafe<{ node: number }[]>(
      `SELECT pg_relation_filenode('organizations')::int AS node`
    );

    expect(after).toHaveLength(before.length);
    after.forEach((row, i) => {
      const { plan, planStartedAt, planRenewsAt, planNote, ...rest } = row;
      expect(rest).toEqual(before[i]);
      expect(plan).toBe("PILOT");
      expect(planStartedAt).toBeNull();
      expect(planRenewsAt).toBeNull();
      expect(planNote).toBeNull();
    });
    expect(nodeAfter).toBe(nodeBefore);

    // A new row without a plan also reads as PILOT; EU_CLOUD is accepted.
    await db.$executeRawUnsafe(
      `INSERT INTO organizations (id, name, slug, "updatedAt") VALUES ('org-c', 'Org C', 'org-c', now())`
    );
    await db.$executeRawUnsafe(`UPDATE organizations SET plan = 'EU_CLOUD' WHERE id = 'org-c'`);
    const plans = await db.$queryRawUnsafe<{ id: string; plan: string }[]>(
      `SELECT id, plan::text AS plan FROM organizations ORDER BY id`
    );
    expect(plans.map((p) => p.plan)).toEqual(["PILOT", "PILOT", "EU_CLOUD"]);
  }, 120_000);
});
