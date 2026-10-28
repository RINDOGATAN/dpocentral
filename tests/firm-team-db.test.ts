// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The firm team on PostgreSQL: every migration is applied to a scratch
 * database (the firm-team migration twice, to prove it is idempotent), then
 * the real service runs against the real schema: which organisations count,
 * memberships added and removed, the unique keys, the cascade from a
 * firm-team row to its memberships, and rollback of a refused add.
 *
 * Skipped unless FIRM_TEAM_TEST_DATABASE_URL names a THROWAWAY local
 * PostgreSQL (localhost or 127.0.0.1). The test creates its own scratch
 * database there and drops it at the end. For example:
 *
 *   docker run -d --name dpc-firm-db -e POSTGRES_USER=dpc \
 *     -e POSTGRES_PASSWORD=dpc_local -e POSTGRES_DB=dpc -p 127.0.0.1:55446:5432 \
 *     public.ecr.aws/docker/library/postgres:16-alpine
 *   FIRM_TEAM_TEST_DATABASE_URL=postgresql://dpc:dpc_local@127.0.0.1:55446/dpc \
 *     npx vitest run tests/firm-team-db.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import {
  acceptFirmTeamInvitations,
  addFirmTeamMember,
  addFirmTeamToOrganization,
  firmOrganizations,
  removeFirmTeamMember,
  updateFirmTeamRole,
} from "@/server/services/members/firm-team";

const ADMIN_URL = process.env.FIRM_TEAM_TEST_DATABASE_URL;
const run = ADMIN_URL && /@(127\.0\.0\.1|localhost)[:/]/.test(ADMIN_URL) ? describe : describe.skip;

const FIRM_MIGRATION = "20261027120000_firm_team";
const MIGRATIONS_DIR = path.resolve(__dirname, "../prisma/migrations");
const PRISMA_BIN = path.resolve(__dirname, "../node_modules/.bin/prisma");
const SCRATCH = `dpc_firm_team_${process.pid}`;

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

run("firm team on PostgreSQL", () => {
  let admin: PrismaClient;
  let db: PrismaClient;

  beforeAll(async () => {
    admin = new PrismaClient({ datasourceUrl: ADMIN_URL });
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${SCRATCH}"`);
    await admin.$executeRawUnsafe(`CREATE DATABASE "${SCRATCH}"`);
    const all = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    expect(all).toContain(FIRM_MIGRATION);
    for (const name of all) applyMigration(name);
    applyMigration(FIRM_MIGRATION); // a second run changes nothing
    db = new PrismaClient({ datasourceUrl: scratchUrl() });

    for (const id of ["a", "b", "staff", "own"]) {
      await db.user.create({ data: { id, email: `${id}@test.example`, name: id, userType: id === "a" || id === "b" ? "PRIVACY_PROFESSIONAL" : null } });
    }
    const org = async (id: string, owner: string, billingOwnerId: string | null = owner) =>
      db.organization.create({
        data: { id, name: id, slug: id, billingOwnerId, members: { create: { userId: owner, role: "OWNER" } } },
      });
    await org("a1", "a");
    await org("a2", "a");
    await org("b1", "b");
    await org("b2", "b");
    await db.organizationMember.create({ data: { organizationId: "b2", userId: "a", role: "OWNER" } });
    await db.organizationMember.create({ data: { organizationId: "a2", userId: "staff", role: "VIEWER" } });
  }, 180_000);

  afterAll(async () => {
    await db?.$disconnect();
    await admin?.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${SCRATCH}" WITH (FORCE)`);
    await admin?.$disconnect();
  });

  const staffOrgs = async () =>
    (
      await db.organizationMember.findMany({
        where: { userId: "staff" },
        select: { organizationId: true, role: true, firmTeamMemberId: true },
        orderBy: { organizationId: "asc" },
      })
    ).map((m) => [m.organizationId, m.role, m.firmTeamMemberId ? "firm" : "own"]);

  it("counts only organisations the account owns and pays for", async () => {
    expect((await firmOrganizations(db, "a")).map((o) => o.id).sort()).toEqual(["a1", "a2"]);
  });

  it("adds, re-syncs, changes the role and removes only firm memberships", async () => {
    const { firm } = await addFirmTeamMember(db, { ownerUserId: "a", email: "Staff@test.example", role: "MEMBER", locale: "en" });
    expect(await staffOrgs()).toEqual([
      ["a1", "MEMBER", "firm"],
      ["a2", "VIEWER", "own"],
    ]);
    await expect(
      addFirmTeamMember(db, { ownerUserId: "a", email: "staff@test.example", role: "MEMBER", locale: "en" })
    ).rejects.toMatchObject({ code: "CONFLICT" });

    await db.organization.create({
      data: { id: "a3", name: "a3", slug: "a3", billingOwnerId: "a", members: { create: { userId: "a", role: "OWNER" } } },
    });
    expect(await addFirmTeamToOrganization(db, "a", "a3")).toBe(1);
    expect(await addFirmTeamToOrganization(db, "a", "a3")).toBe(0);
    expect(await acceptFirmTeamInvitations(db, "staff", "staff@test.example")).toBe(0);

    await updateFirmTeamRole(db, { ownerUserId: "a", id: firm.id, role: "ADMIN" });
    expect(await staffOrgs()).toEqual([
      ["a1", "ADMIN", "firm"],
      ["a2", "VIEWER", "own"],
      ["a3", "ADMIN", "firm"],
    ]);

    await expect(removeFirmTeamMember(db, { ownerUserId: "b", id: firm.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await removeFirmTeamMember(db, { ownerUserId: "a", id: firm.id })).toEqual({ removedMemberships: 2 });
    expect(await staffOrgs()).toEqual([["a2", "VIEWER", "own"]]);
    expect(await db.organizationMember.count({ where: { organizationId: { in: ["b1", "b2"] } } })).toBe(3);
  });

  it("deleting a firm-team row cascades to its memberships only", async () => {
    const { firm } = await addFirmTeamMember(db, { ownerUserId: "a", email: "staff@test.example", role: "MEMBER", locale: "en" });
    await db.firmTeamMember.delete({ where: { id: firm.id } });
    expect(await staffOrgs()).toEqual([["a2", "VIEWER", "own"]]);
  });

  it("deleting the owner's account removes its firm team and the memberships it gave", async () => {
    await db.user.create({ data: { id: "c", email: "c@test.example", userType: "PRIVACY_PROFESSIONAL" } });
    await db.organization.create({
      data: { id: "c1", name: "c1", slug: "c1", billingOwnerId: "c", members: { create: { userId: "c", role: "OWNER" } } },
    });
    await addFirmTeamMember(db, { ownerUserId: "c", email: "own@test.example", role: "MEMBER", locale: "en" });
    expect(await db.organizationMember.count({ where: { userId: "own", organizationId: "c1" } })).toBe(1);
    await db.user.delete({ where: { id: "c" } });
    expect(await db.firmTeamMember.count({ where: { ownerUserId: "c" } })).toBe(0);
    expect(await db.organizationMember.count({ where: { userId: "own" } })).toBe(0);
  });
});
