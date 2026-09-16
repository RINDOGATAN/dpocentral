/**
 * Hosted pilot caps (src/server/services/pilot/caps.ts, wired in
 * src/server/trpc.ts and the organization / dsar routers).
 *
 * On the hosted service (VERCEL_ENV=production or a todo.law cookie domain):
 *   - one organisation per account;
 *   - after the 90-day pilot the organisation is read-only (mutations
 *     refused) while reads and exports keep working;
 *   - creates are refused at the records ceiling.
 * On the self-hosted kit none of this applies.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { OrganizationRole } from "@prisma/client";

const mocks = vi.hoisted(() => {
  const counter = () => ({ count: vi.fn().mockResolvedValue(0) });
  return {
    prisma: {
      organization: { findUnique: vi.fn(), create: vi.fn() },
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
      auditLog: { create: vi.fn() },
      dataAsset: { ...counter(), findMany: vi.fn().mockResolvedValue([]) },
      dataElement: counter(),
      processingActivity: { ...counter(), findMany: vi.fn().mockResolvedValue([]) },
      dataFlow: { ...counter(), findMany: vi.fn().mockResolvedValue([]) },
      dataTransfer: { ...counter(), findMany: vi.fn().mockResolvedValue([]) },
      vendor: { ...counter(), findMany: vi.fn().mockResolvedValue([]) },
      vendorContract: counter(),
      dSARRequest: {
        ...counter(),
        create: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
      dSARIntakeForm: { findMany: vi.fn().mockResolvedValue([]) },
      dSARAuditLog: { create: vi.fn() },
      assessment: { ...counter(), findMany: vi.fn().mockResolvedValue([]) },
      assessmentTemplate: { ...counter(), findMany: vi.fn().mockResolvedValue([]) },
      incident: { ...counter(), findMany: vi.fn().mockResolvedValue([]) },
      aISystem: { ...counter(), findMany: vi.fn().mockResolvedValue([]) },
    },
    getToken: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next-auth/jwt", () => ({ getToken: mocks.getToken }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/server/services/dsar/defaultIntakeForm", () => ({ ensureDefaultIntakeForm: vi.fn() }));
vi.mock("@/server/services/dsar/sendConfirmationEmail", () => ({
  sendDSARConfirmationEmail: vi.fn(),
}));
vi.mock("@/server/services/dsar/sendCommunicationEmail", () => ({
  sendDSARCommunicationEmail: vi.fn(),
}));

import { organizationRouter } from "@/server/routers/privacy/organization";
import { dsarRouter } from "@/server/routers/privacy/dsar";
import { GET as exportOrganizationData } from "@/app/api/export/organization-data/route";
import { isHostedDeployment } from "@/lib/hosted";
import {
  assertPilotCapacity,
  getPilotStatus,
  PILOT_CLOCK_START,
  PILOT_DAYS,
  PILOT_LIMITS,
  pilotDaysLeft,
  type PilotDb,
} from "@/server/services/pilot/caps";
import { checkSkillEntitlement } from "@/server/services/licensing/entitlement";
import { createInnerTRPCContext, createTRPCRouter } from "@/server/trpc";
import { callerFor, sessionFor } from "./helpers";

const DAY = 24 * 60 * 60 * 1000;
// An organisation created well after the pilot clock start.
const CREATED = new Date(PILOT_CLOCK_START.getTime() + 30 * DAY);
const ORG = { id: "org-1", name: "Org", slug: "org", createdAt: CREATED };

function setNow(daysAfterCreation: number) {
  vi.setSystemTime(new Date(CREATED.getTime() + daysAfterCreation * DAY));
}

function callerWithRole(role: OrganizationRole) {
  mocks.prisma.organizationMember.findUnique.mockResolvedValue({
    id: "member-1",
    userId: "user-1",
    organizationId: "org-1",
    role,
    organization: ORG,
  });
  return orgCaller();
}

// Mounted as in the app router, so procedure paths read "organization.*"
// (the caps table is keyed by full path).
const testRouter = createTRPCRouter({ organization: organizationRouter });

function orgCaller(getCookie: (name: string) => string | undefined = () => undefined) {
  return testRouter.createCaller(
    createInnerTRPCContext({ session: sessionFor("user-1"), getCookie })
  ).organization;
}

const addJurisdiction = (caller: ReturnType<typeof callerWithRole>) =>
  caller.addJurisdiction({ organizationId: "org-1", jurisdictionId: "j-1", isPrimary: false });

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  setNow(10);
  mocks.prisma.auditLog.create.mockResolvedValue({});
  mocks.prisma.organizationMember.count.mockResolvedValue(0);
  mocks.prisma.organizationJurisdiction.upsert.mockResolvedValue({ id: "oj-1" });
  mocks.prisma.organization.findUnique.mockResolvedValue(null);
  mocks.prisma.organization.create.mockResolvedValue({ id: "org-new", members: [] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

const hosted = () => vi.stubEnv("VERCEL_ENV", "production");
const kit = () => {
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("AUTH_COOKIE_DOMAIN", "");
};

describe("hosted detection", () => {
  it("is hosted on the production deployment or the todo.law cookie domain", () => {
    expect(isHostedDeployment({ VERCEL_ENV: "production" })).toBe(true);
    expect(isHostedDeployment({ AUTH_COOKIE_DOMAIN: ".todo.law" })).toBe(true);
    expect(isHostedDeployment({ VERCEL_ENV: "preview" })).toBe(false);
    expect(isHostedDeployment({ AUTH_COOKIE_DOMAIN: ".example.org" })).toBe(false);
    expect(isHostedDeployment({ NEXT_PUBLIC_LOCAL_AUTH_ENABLED: "true" })).toBe(false);
  });
});

describe("one organisation per account", () => {
  const create = () => orgCaller().create({ name: "Second", slug: "second" });

  it("refuses a second organisation on the hosted pilot", async () => {
    hosted();
    mocks.prisma.organizationMember.count.mockResolvedValue(1);
    await expect(create()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(create()).rejects.toThrow("https://www.todo.law/run");
    expect(mocks.prisma.organization.create).not.toHaveBeenCalled();
  });

  it("allows the first organisation on the hosted pilot", async () => {
    hosted();
    await create();
    expect(mocks.prisma.organization.create).toHaveBeenCalled();
  });

  it("does not limit organisations on the kit", async () => {
    kit();
    mocks.prisma.organizationMember.count.mockResolvedValue(3);
    await create();
    expect(mocks.prisma.organization.create).toHaveBeenCalled();
  });
});

describe("the 90-day switch to read-only", () => {
  it("allows edits before the end of the pilot", async () => {
    hosted();
    setNow(PILOT_DAYS - 1);
    await addJurisdiction(callerWithRole("OWNER"));
    expect(mocks.prisma.organizationJurisdiction.upsert).toHaveBeenCalled();
  });

  it("refuses edits once the pilot has ended, naming both ways out", async () => {
    hosted();
    setNow(PILOT_DAYS);
    const caller = callerWithRole("OWNER");
    const err = await addJurisdiction(caller).catch((e) => e);
    expect(err).toMatchObject({ code: "FORBIDDEN" });
    expect(err.message).toContain("read-only");
    expect(err.message).toContain("https://www.todo.law/run");
    expect(err.message).toContain("/privacy/settings#pilot-export");
    expect(mocks.prisma.organizationJurisdiction.upsert).not.toHaveBeenCalled();
  });

  it("still serves reads once read-only", async () => {
    hosted();
    setNow(PILOT_DAYS + 30);
    const caller = callerWithRole("VIEWER");
    const status = await caller.getPilotStatus({ organizationId: "org-1" });
    expect(status).toMatchObject({ hosted: true, readOnly: true, daysLeft: 0 });
  });

  it("never switches the kit to read-only", async () => {
    kit();
    setNow(PILOT_DAYS * 5);
    await addJurisdiction(callerWithRole("OWNER"));
    expect(mocks.prisma.organizationJurisdiction.upsert).toHaveBeenCalled();
  });

  it("starts the clock no earlier than the pilot clock start", () => {
    const old = { createdAt: new Date("2025-01-01T00:00:00Z") };
    vi.setSystemTime(PILOT_CLOCK_START);
    expect(pilotDaysLeft(old)).toBe(PILOT_DAYS);
  });

  it("answers in Castilian Spanish when the locale is es", async () => {
    hosted();
    setNow(PILOT_DAYS);
    callerWithRole("OWNER");
    const caller = orgCaller((name) => (name === "NEXT_LOCALE" ? "es" : undefined));
    await expect(addJurisdiction(caller)).rejects.toThrow("solo lectura");
  });
});

describe("records ceiling", () => {
  const addMember = () =>
    callerWithRole("OWNER").addMember({
      organizationId: "org-1",
      email: "new@test.example",
      role: "MEMBER",
    });

  beforeEach(() => {
    mocks.prisma.user.findUnique.mockResolvedValue({ id: "user-2", email: "new@test.example" });
    mocks.prisma.organizationMember.create.mockResolvedValue({ id: "m-2" });
  });

  it("refuses a create at the ceiling on the hosted pilot", async () => {
    hosted();
    mocks.prisma.organizationMember.count.mockResolvedValue(PILOT_LIMITS.members);
    await expect(addMember()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.prisma.organizationMember.create).not.toHaveBeenCalled();
  });

  it("allows a create below the ceiling", async () => {
    hosted();
    // Below the ceiling for the org, and the invitee belongs to no organisation.
    mocks.prisma.organizationMember.count.mockImplementation(
      async ({ where }: { where: { organizationId?: string } }) =>
        where.organizationId ? PILOT_LIMITS.members - 1 : 0
    );
    mocks.prisma.organizationMember.findUnique
      .mockResolvedValueOnce({
        id: "member-1",
        userId: "user-1",
        organizationId: "org-1",
        role: "OWNER",
        organization: ORG,
      })
      .mockResolvedValueOnce(null);
    await addMember();
    expect(mocks.prisma.organizationMember.create).toHaveBeenCalled();
  });

  it("refuses an invitee who already belongs to another organisation", async () => {
    hosted();
    mocks.prisma.organizationMember.count.mockImplementation(
      async ({ where }: { where: { organizationId?: string } }) =>
        where.organizationId ? 1 : 1
    );
    mocks.prisma.organizationMember.findUnique
      .mockResolvedValueOnce({
        id: "member-1",
        userId: "user-1",
        organizationId: "org-1",
        role: "OWNER",
        organization: ORG,
      })
      .mockResolvedValueOnce(null);
    await expect(addMember()).rejects.toThrow("one organization per account");
    expect(mocks.prisma.organizationMember.create).not.toHaveBeenCalled();
  });

  it("counts systems per organisation and stops at the ceiling", async () => {
    hosted();
    const db = mocks.prisma as unknown as PilotDb;
    mocks.prisma.dataAsset.count.mockResolvedValue(PILOT_LIMITS.dataAssets - 1);
    await expect(assertPilotCapacity(db, "org-1", "dataAssets")).resolves.toBeUndefined();
    expect(mocks.prisma.dataAsset.count).toHaveBeenCalledWith({
      where: { organizationId: "org-1" },
    });
    mocks.prisma.dataAsset.count.mockResolvedValue(PILOT_LIMITS.dataAssets);
    await expect(assertPilotCapacity(db, "org-1", "dataAssets")).rejects.toThrow(
      `${PILOT_LIMITS.dataAssets} systems`
    );
    // A batch that would overshoot is refused as a whole.
    mocks.prisma.dataAsset.count.mockResolvedValue(PILOT_LIMITS.dataAssets - 2);
    await expect(assertPilotCapacity(db, "org-1", "dataAssets", 3)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("applies no ceiling on the kit", async () => {
    kit();
    mocks.prisma.dataAsset.count.mockResolvedValue(10_000);
    await expect(
      assertPilotCapacity(mocks.prisma as unknown as PilotDb, "org-1", "dataAssets")
    ).resolves.toBeUndefined();
    expect(mocks.prisma.dataAsset.count).not.toHaveBeenCalled();
  });

  it("bounds the public request intake on the hosted pilot", async () => {
    hosted();
    mocks.prisma.organization.findUnique.mockResolvedValue({
      ...ORG,
      dsarIntakeForms: [{ id: "form-1" }],
      jurisdictions: [],
    });
    mocks.prisma.dSARRequest.count.mockResolvedValue(PILOT_LIMITS.dsarRequests);
    const anon = callerFor(dsarRouter, null) as ReturnType<typeof dsarRouter.createCaller>;
    await expect(
      anon.submitPublic({
        orgSlug: "org",
        type: "ACCESS",
        requesterName: "A",
        requesterEmail: "a@test.example",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.prisma.dSARRequest.create).not.toHaveBeenCalled();
  });

  it("reports usage for the Settings card", async () => {
    hosted();
    mocks.prisma.dataAsset.count.mockResolvedValue(7);
    const status = await getPilotStatus(mocks.prisma as unknown as PilotDb, ORG);
    expect(status).toMatchObject({ hosted: true, readOnly: false, daysLeft: PILOT_DAYS - 10 });
    if (!status.hosted) throw new Error("expected hosted status");
    expect(status.usage[0]).toEqual({ resource: "dataAssets", used: 7, limit: 25 });
  });

  it("reports no pilot on the kit", async () => {
    kit();
    await expect(
      getPilotStatus(mocks.prisma as unknown as PilotDb, ORG)
    ).resolves.toEqual({ hosted: false });
  });
});

describe("modules open on the hosted pilot", () => {
  it("grants every premium skill without an entitlement", async () => {
    hosted();
    await expect(
      checkSkillEntitlement("org-1", "com.nel.dpocentral.vendor-catalog")
    ).resolves.toMatchObject({ entitled: true });
  });
});

describe("export still allowed once read-only", () => {
  it("returns the organisation's records as JSON after the pilot has ended", async () => {
    hosted();
    setNow(PILOT_DAYS + 60);
    mocks.getToken.mockResolvedValue({ email: "user-1@test.example" });
    mocks.prisma.organizationMember.findFirst.mockResolvedValue({
      role: "VIEWER",
      organization: { ...ORG, domain: null, settings: null },
    });
    mocks.prisma.dataAsset.findMany.mockResolvedValue([{ id: "asset-1", name: "CRM" }]);

    const res = await exportOrganizationData(
      new Request("http://localhost/api/export/organization-data?organizationId=org-1")
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toContain("org-export-");
    const body = await res.json();
    expect(body.organization.id).toBe("org-1");
    expect(body.dataAssets).toEqual([{ id: "asset-1", name: "CRM" }]);
    expect(mocks.prisma.dataAsset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: "org-1" } })
    );
  });

  it("refuses a non-member", async () => {
    mocks.getToken.mockResolvedValue({ email: "stranger@test.example" });
    mocks.prisma.organizationMember.findFirst.mockResolvedValue(null);
    const res = await exportOrganizationData(
      new Request("http://localhost/api/export/organization-data?organizationId=org-1")
    );
    expect(res.status).toBe(403);
  });
});
