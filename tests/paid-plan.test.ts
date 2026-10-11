// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The paid EU cloud plan (Organization.plan = EU_CLOUD) lifts the hosted
 * pilot's limits for one organisation: the records ceilings, the
 * editing window, the two free DPIAs, the members ceiling and the
 * one-organisation rule for people it adds. A PILOT organisation keeps every
 * limit, and the self-hosted kit is unchanged. The operator's script
 * (scripts/set-org-plan.ts) prints before and after, writes nothing on a dry
 * run, and writes the change with one audit entry otherwise.
 *
 * Prisma is module-mocked; the migration itself is checked against a real
 * database in tests/paid-plan-migration-db.test.ts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => {
  const counter = () => ({ count: vi.fn().mockResolvedValue(0) });
  return {
    prisma: {
      organization: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
      organizationMember: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
      },
      organizationJurisdiction: {
        updateMany: vi.fn(),
        upsert: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
      user: { findUnique: vi.fn() },
      auditLog: { create: vi.fn(), count: vi.fn().mockResolvedValue(0) },
      dataAsset: counter(),
      dataElement: counter(),
      processingActivity: counter(),
      dataFlow: counter(),
      dataTransfer: counter(),
      vendor: counter(),
      vendorContract: counter(),
      dSARRequest: counter(),
      assessment: counter(),
      assessmentTemplate: counter(),
      incident: counter(),
      aISystem: counter(),
    },
  };
});

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { organizationRouter } from "@/server/routers/privacy/organization";
import {
  assertOneOrganizationPerAccount,
  assertPilotCapacity,
  assertPilotWritable,
  getPilotStatus,
  hasPilotRoom,
  isPaidPlan,
  isPilotReadOnly,
  PILOT_CLOCK_START,
  PILOT_DAYS,
  PILOT_LIMITS,
  type PilotDb,
} from "@/server/services/pilot/caps";
import { isDpiaPilotTier } from "@/server/services/licensing/entitlement";
import {
  PLAN_CHANGE,
  PlanInputError,
  resolvePlanState,
  setOrganizationPlan,
  type PlanOrgRow,
} from "@/server/services/pilot/plan";
import { parseArgs } from "../scripts/set-org-plan";
import { createInnerTRPCContext, createTRPCRouter } from "@/server/trpc";
import { sessionFor } from "./helpers";

const DAY = 24 * 60 * 60 * 1000;
const STARTED = new Date(PILOT_CLOCK_START.getTime() + 10 * DAY);
const PILOT_ORG = {
  id: "org-1",
  name: "Org",
  slug: "org",
  pilotStartedAt: STARTED as Date | null,
  plan: "PILOT" as string,
  planRenewsAt: null as Date | null,
};
const PAID_ORG = { ...PILOT_ORG, plan: "EU_CLOUD", planRenewsAt: new Date("2026-11-12T00:00:00Z") };

const hosted = () => vi.stubEnv("VERCEL_ENV", "production");
const kit = () => {
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("AUTH_COOKIE_DOMAIN", "");
};
const db = () => mocks.prisma as unknown as PilotDb;
const afterWindow = () => vi.setSystemTime(new Date(STARTED.getTime() + (PILOT_DAYS + 5) * DAY));

const testRouter = createTRPCRouter({ organization: organizationRouter });
function signedInTo(org: typeof PILOT_ORG) {
  mocks.prisma.organizationMember.findUnique.mockResolvedValue({
    id: "member-1",
    userId: "user-1",
    organizationId: org.id,
    role: "OWNER",
    organization: org,
  });
  mocks.prisma.organization.findUnique.mockResolvedValue({ plan: org.plan });
  return testRouter.createCaller(
    createInnerTRPCContext({ session: sessionFor("user-1"), getCookie: () => undefined })
  ).organization;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(STARTED.getTime() + DAY));
  mocks.prisma.organization.findUnique.mockResolvedValue(null);
  mocks.prisma.organizationMember.count.mockResolvedValue(0);
  mocks.prisma.organizationJurisdiction.upsert.mockResolvedValue({ id: "oj-1" });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("isPaidPlan", () => {
  it("is true for EU_CLOUD only", () => {
    expect(isPaidPlan({ plan: "EU_CLOUD" })).toBe(true);
    expect(isPaidPlan({ plan: "PILOT" })).toBe(false);
    expect(isPaidPlan({})).toBe(false);
    expect(isPaidPlan(null)).toBe(false);
  });
});

describe("records ceilings", () => {
  it("still refuses a PILOT organisation at the ceiling", async () => {
    hosted();
    mocks.prisma.organization.findUnique.mockResolvedValue({ plan: "PILOT" });
    mocks.prisma.dataAsset.count.mockResolvedValue(PILOT_LIMITS.dataAssets);
    await expect(assertPilotCapacity(db(), "org-1", "dataAssets")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(await hasPilotRoom(db(), "org-1", "dataAssets")).toBe(false);
  });

  it("does not apply to an EU_CLOUD organisation", async () => {
    hosted();
    mocks.prisma.organization.findUnique.mockResolvedValue({ plan: "EU_CLOUD" });
    mocks.prisma.dataAsset.count.mockResolvedValue(PILOT_LIMITS.dataAssets + 100);
    await expect(assertPilotCapacity(db(), "org-1", "dataAssets", 5)).resolves.toBeUndefined();
    expect(await hasPilotRoom(db(), "org-1", "dataAssets")).toBe(true);
    expect(mocks.prisma.dataAsset.count).not.toHaveBeenCalled();
  });

  it("uses the plan of an organisation row it is given, without a lookup", async () => {
    hosted();
    mocks.prisma.dataAsset.count.mockResolvedValue(PILOT_LIMITS.dataAssets);
    await expect(assertPilotCapacity(db(), PAID_ORG, "dataAssets")).resolves.toBeUndefined();
    await expect(assertPilotCapacity(db(), PILOT_ORG, "dataAssets")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(mocks.prisma.organization.findUnique).not.toHaveBeenCalled();
  });

  it("counts an organisation it cannot find as the pilot", async () => {
    hosted();
    mocks.prisma.organization.findUnique.mockResolvedValue(null);
    mocks.prisma.vendor.count.mockResolvedValue(PILOT_LIMITS.vendors);
    await expect(assertPilotCapacity(db(), "org-x", "vendors")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("is unchanged on the kit (no ceiling, no plan lookup)", async () => {
    kit();
    mocks.prisma.dataAsset.count.mockResolvedValue(1000);
    await expect(assertPilotCapacity(db(), "org-1", "dataAssets")).resolves.toBeUndefined();
    expect(mocks.prisma.organization.findUnique).not.toHaveBeenCalled();
  });
});

describe("the editing window", () => {
  it("makes a PILOT organisation read-only after the editing window", () => {
    hosted();
    afterWindow();
    expect(isPilotReadOnly(PILOT_ORG)).toBe(true);
    expect(() => assertPilotWritable(PILOT_ORG)).toThrow("read-only");
  });

  it("never makes an EU_CLOUD organisation read-only", () => {
    hosted();
    afterWindow();
    expect(isPilotReadOnly(PAID_ORG)).toBe(false);
    expect(() => assertPilotWritable(PAID_ORG)).not.toThrow();
  });

  it("refuses a PILOT edit through the router after the window, allows the EU_CLOUD one", async () => {
    hosted();
    afterWindow();
    const add = (org: typeof PILOT_ORG) =>
      signedInTo(org).addJurisdiction({ organizationId: "org-1", jurisdictionId: "j-1", isPrimary: false });
    await expect(add(PILOT_ORG)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.prisma.organizationJurisdiction.upsert).not.toHaveBeenCalled();
    await add(PAID_ORG);
    expect(mocks.prisma.organizationJurisdiction.upsert).toHaveBeenCalled();
  });
});

describe("the free DPIAs", () => {
  it("are the pilot tier for a PILOT organisation, not for EU_CLOUD", async () => {
    hosted();
    mocks.prisma.organization.findUnique.mockResolvedValue({ plan: "PILOT" });
    expect(await isDpiaPilotTier("org-1")).toBe(true);
    mocks.prisma.organization.findUnique.mockResolvedValue({ plan: "EU_CLOUD" });
    expect(await isDpiaPilotTier("org-1")).toBe(false);
  });
});

describe("one organisation per account", () => {
  it("lets an EU_CLOUD organisation add a person who belongs elsewhere", async () => {
    hosted();
    mocks.prisma.organizationMember.count.mockResolvedValue(1);
    await expect(
      assertOneOrganizationPerAccount(db(), "user-2", "en", { plan: "EU_CLOUD" })
    ).resolves.toBeUndefined();
    await expect(
      assertOneOrganizationPerAccount(db(), "user-2", "en", { plan: "PILOT" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("still applies when a member of a paid organisation creates another one", async () => {
    hosted();
    mocks.prisma.organizationMember.count.mockResolvedValue(1);
    await expect(assertOneOrganizationPerAccount(db(), "user-1", "en")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("the Settings card", () => {
  it("reports the paid plan and no limits for EU_CLOUD", async () => {
    hosted();
    afterWindow();
    expect(await getPilotStatus(db(), PAID_ORG)).toEqual({
      hosted: true,
      paid: true,
      plan: "EU_CLOUD",
      renewsAt: PAID_ORG.planRenewsAt,
    });
  });

  it("reports the pilot for PILOT, and nothing on the kit", async () => {
    hosted();
    expect(await getPilotStatus(db(), PILOT_ORG)).toMatchObject({ hosted: true, paid: false });
    kit();
    expect(await getPilotStatus(db(), PAID_ORG)).toEqual({ hosted: false });
  });

  it("never sends the operator's note to members", async () => {
    mocks.prisma.organizationMember.findMany.mockResolvedValue([
      { organization: { ...PAID_ORG, planNote: "in_123" }, role: "OWNER", joinedAt: new Date() },
    ]);
    const caller = testRouter.createCaller(
      createInnerTRPCContext({ session: sessionFor("user-1"), getCookie: () => undefined })
    ).organization;
    const [org] = await caller.list();
    expect(org).not.toHaveProperty("planNote");
    expect(org).toMatchObject({ plan: "EU_CLOUD" });
  });
});

// ── The operator's script ──────────────────────────────────────────────

function planDb(row: PlanOrgRow | null) {
  const tx = {
    organization: { update: vi.fn().mockResolvedValue({}) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  const client = {
    organization: { findFirst: vi.fn().mockResolvedValue(row) },
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  return { client, tx, asDb: client as unknown as Parameters<typeof setOrganizationPlan>[0] };
}

const ROW: PlanOrgRow = {
  id: "org-1",
  slug: "org",
  name: "Org",
  plan: "PILOT",
  planStartedAt: null,
  planRenewsAt: null,
  planNote: null,
};
const NOW = new Date("2026-10-12T09:00:00Z");

describe("set-org-plan", () => {
  it("parses the command line", () => {
    expect(
      parseArgs([
        "--org", "org", "--plan", "eu_cloud", "--started", "2026-10-12",
        "--renews", "2026-11-12", "--note", "in_1", "--dry-run",
      ])
    ).toEqual({
      org: "org",
      plan: "EU_CLOUD",
      startedAt: new Date("2026-10-12T00:00:00Z"),
      renewsAt: new Date("2026-11-12T00:00:00Z"),
      note: "in_1",
      operator: "operator",
      dryRun: true,
    });
    expect(() => parseArgs(["--plan", "EU_CLOUD"])).toThrow(PlanInputError);
    expect(() => parseArgs(["--org", "x", "--plan", "GOLD"])).toThrow(PlanInputError);
    expect(() => parseArgs(["--org", "x", "--plan", "PILOT", "--renews", "soon"])).toThrow(
      PlanInputError
    );
  });

  it("writes nothing on a dry run, and prints the before and after", async () => {
    const { client, tx, asDb } = planDb(ROW);
    const result = await setOrganizationPlan(
      asDb,
      { org: "org", plan: "EU_CLOUD", renewsAt: new Date("2026-11-12T00:00:00Z"), operator: "op", dryRun: true },
      NOW
    );
    expect(result).toMatchObject({
      changed: true,
      written: false,
      before: { plan: "PILOT" },
      after: { plan: "EU_CLOUD", planStartedAt: NOW },
    });
    expect(client.$transaction).not.toHaveBeenCalled();
    expect(tx.organization.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("finds the organisation by id or slug", async () => {
    const { client, asDb } = planDb(ROW);
    await setOrganizationPlan(asDb, { org: "org", plan: "EU_CLOUD", operator: "op", dryRun: true }, NOW);
    expect(client.organization.findFirst.mock.calls[0][0].where).toEqual({
      OR: [{ id: "org" }, { slug: "org" }],
    });
  });

  it("writes the change and one audit entry, without the note's text", async () => {
    const { tx, asDb } = planDb(ROW);
    const result = await setOrganizationPlan(
      asDb,
      {
        org: "org-1",
        plan: "EU_CLOUD",
        startedAt: new Date("2026-10-12T00:00:00Z"),
        renewsAt: new Date("2027-10-12T00:00:00Z"),
        note: "in_secret",
        operator: "conductor",
        dryRun: false,
      },
      NOW
    );
    expect(result.written).toBe(true);
    expect(tx.organization.update).toHaveBeenCalledWith({
      where: { id: "org-1" },
      data: {
        plan: "EU_CLOUD",
        planStartedAt: new Date("2026-10-12T00:00:00Z"),
        planRenewsAt: new Date("2027-10-12T00:00:00Z"),
        planNote: "in_secret",
      },
    });
    const audit = tx.auditLog.create.mock.calls[0][0].data;
    expect(audit).toMatchObject({
      organizationId: "org-1",
      entityType: "Organization",
      entityId: "org-1",
      action: PLAN_CHANGE,
      changes: {
        before: { plan: "PILOT", planStartedAt: null, planRenewsAt: null },
        after: { plan: "EU_CLOUD", planStartedAt: "2026-10-12T00:00:00.000Z" },
        planNoteChanged: true,
      },
      metadata: { source: "scripts/set-org-plan.ts", operator: "conductor" },
    });
    expect(JSON.stringify(audit)).not.toContain("in_secret");
  });

  it("writes nothing when nothing changes", async () => {
    const paid: PlanOrgRow = { ...ROW, plan: "EU_CLOUD", planStartedAt: NOW, planNote: "n" };
    const { client, asDb } = planDb(paid);
    const result = await setOrganizationPlan(asDb, { org: "org", plan: "EU_CLOUD", operator: "op", dryRun: false }, NOW);
    expect(result).toMatchObject({ changed: false, written: false });
    expect(client.$transaction).not.toHaveBeenCalled();
  });

  it("refuses an unknown organisation and a renewal before the start", async () => {
    await expect(
      setOrganizationPlan(planDb(null).asDb, { org: "nope", plan: "EU_CLOUD", operator: "op", dryRun: true }, NOW)
    ).rejects.toThrow(PlanInputError);
    expect(() =>
      resolvePlanState(ROW, { plan: "EU_CLOUD", startedAt: NOW, renewsAt: new Date(NOW.getTime() - DAY) }, NOW)
    ).toThrow("after the start");
  });

  it("keeps the start of a paid plan on renewal, and clears the dates on return to PILOT", () => {
    const paid = { ...ROW, plan: "EU_CLOUD" as const, planStartedAt: new Date("2026-10-12T00:00:00Z"), planNote: "a" };
    const renewed = resolvePlanState(paid, { plan: "EU_CLOUD", renewsAt: new Date("2026-12-12T00:00:00Z") }, NOW);
    expect(renewed.planStartedAt).toEqual(paid.planStartedAt);
    expect(renewed.planNote).toBe("a");
    expect(resolvePlanState(paid, { plan: "PILOT" }, NOW)).toEqual({
      plan: "PILOT",
      planStartedAt: null,
      planRenewsAt: null,
      planNote: "a",
    });
  });
});
