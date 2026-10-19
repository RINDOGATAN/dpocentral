/**
 * Hosted pilot caps (src/server/services/pilot/caps.ts, wired in
 * src/server/trpc.ts and the organization / dsar routers).
 *
 * On the hosted service (VERCEL_ENV=production or a todo.law cookie domain):
 *   - up to five organisations per account;
 *   - after the editing window (PILOT_DAYS) the organisation is read-only (mutations
 *     refused) while reads and exports keep working;
 *   - creates are refused at the records ceiling.
 * On the self-hosted kit none of this applies.
 */

import { PILOT_DPA, PILOT_DPA_ACTION } from "@/config/pilot-dpa";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { OrganizationRole } from "@prisma/client";

const mocks = vi.hoisted(() => {
  const counter = () => ({ count: vi.fn().mockResolvedValue(0) });
  return {
    prisma: {
      organization: { findUnique: vi.fn(), findMany: vi.fn().mockResolvedValue([]), create: vi.fn(), updateMany: vi.fn() },
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
      auditLog: { create: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
      businessUnitMember: { findMany: vi.fn().mockResolvedValue([]) },
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
import { issueFormToken } from "@/server/services/dsar/public-intake-guard";
import { GET as exportOrganizationData } from "@/app/api/export/organization-data/route";
import { isHostedDeployment } from "@/lib/hosted";
import {
  assertPilotCapacity,
  getPilotStatus,
  PILOT_CLOCK_START,
  PILOT_DAYS,
  PILOT_DAYS_BEFORE_SHORTENING,
  PILOT_LIMITS,
  PILOT_WINDOW_SHORTENED_AT,
  isPilotReadOnly,
  pilotDaysLeft,
  pilotEndsAt,
  pilotStart,
  pilotMessage,
  ORGANIZATIONS_PER_ACCOUNT,
  type PilotDb,
} from "@/server/services/pilot/caps";
import { checkSkillEntitlement } from "@/server/services/licensing/entitlement";
import { createInnerTRPCContext, createTRPCRouter } from "@/server/trpc";
import { callerFor, sessionFor } from "./helpers";

const DAY = 24 * 60 * 60 * 1000;
// An organisation created, and first signed into, well after the pilot went live.
const CREATED = new Date(PILOT_CLOCK_START.getTime() + 30 * DAY);
const ORG = {
  id: "org-1",
  name: "Org",
  slug: "org",
  createdAt: CREATED,
  pilotStartedAt: CREATED as Date | null,
};

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

describe("the data processing agreement is accepted when a pilot organisation is opened", () => {
  const auditActions = () =>
    mocks.prisma.auditLog.create.mock.calls.map((c: unknown[]) => (c[0] as { data: { action: string } }).data);

  it("refuses to open a hosted organisation without the acceptance", async () => {
    hosted();
    await expect(orgCaller().create({ name: "First", slug: "first" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(
      orgCaller().create({ name: "First", slug: "first", acceptDpa: false })
    ).rejects.toThrow("data processing agreement");
    expect(mocks.prisma.organization.create).not.toHaveBeenCalled();
  });

  it("records the version accepted, the language and the document, on the new organisation", async () => {
    hosted();
    await orgCaller((name) => (name === "NEXT_LOCALE" ? "es" : undefined)).create({
      name: "First",
      slug: "first",
      acceptDpa: true,
    });
    const entry = auditActions().find((d: { action: string }) => d.action === PILOT_DPA_ACTION) as
      | { organizationId: string; userId: string; changes: Record<string, string> }
      | undefined;
    expect(entry).toBeDefined();
    expect(entry!.organizationId).toBe("org-new");
    expect(entry!.userId).toBe("user-1");
    expect(entry!.changes.dpaVersion).toBe(PILOT_DPA.version);
    expect(["en", "es"]).toContain(entry!.changes.locale);
    expect(entry!.changes.document).toBe(PILOT_DPA.href[entry!.changes.locale as "en" | "es"]);
  });

  it("never asks on the kit, and records nothing there", async () => {
    kit();
    await orgCaller().create({ name: "Kit", slug: "kit" });
    expect(mocks.prisma.organization.create).toHaveBeenCalled();
    expect(auditActions().some((d: { action: string }) => d.action === PILOT_DPA_ACTION)).toBe(false);
  });

  it("names agreement 1.1 at the storefront's addresses", () => {
    expect(PILOT_DPA.version).toBe("1.1");
    expect(PILOT_DPA.href.en).toBe("https://www.todo.law/legal/eu-cloud-plan-dpa");
    expect(PILOT_DPA.href.es).toBe("https://www.todo.law/es/legal/encargo-tratamiento-plan-nube-ue");
  });
});

describe("an organisation with no acceptance on record is asked once", () => {
  const dpaEntries = () =>
    mocks.prisma.auditLog.create.mock.calls
      .map((c: unknown[]) => (c[0] as { data: { action: string } }).data)
      .filter((d: { action: string }) => d.action === PILOT_DPA_ACTION);

  it("asks an organisation opened before acceptance was asked, and lets an owner or admin accept", async () => {
    hosted();
    mocks.prisma.auditLog.findMany.mockResolvedValue([]);
    const status = await callerWithRole("OWNER").getDpaStatus({ organizationId: "org-1" });
    expect(status).toEqual({ required: true, canAccept: true });
    const admin = await callerWithRole("ADMIN").getDpaStatus({ organizationId: "org-1" });
    expect(admin.canAccept).toBe(true);
  });

  it("shows a member the need without letting them accept", async () => {
    hosted();
    mocks.prisma.auditLog.findMany.mockResolvedValue([]);
    const status = await callerWithRole("MEMBER").getDpaStatus({ organizationId: "org-1" });
    expect(status).toEqual({ required: true, canAccept: false });
    await expect(
      callerWithRole("MEMBER").acceptDpa({ organizationId: "org-1", accept: true })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dpaEntries()).toHaveLength(0);
  });

  it("records the acceptance as the same entry as at opening, even once the pilot is read-only", async () => {
    hosted();
    setNow(PILOT_DAYS + 5);
    mocks.prisma.auditLog.findMany.mockResolvedValue([]);
    await callerWithRole("ADMIN").acceptDpa({ organizationId: "org-1", accept: true });
    const entries = dpaEntries() as unknown as Array<{ organizationId: string; userId: string; changes: Record<string, string> }>;
    expect(entries).toHaveLength(1);
    expect(entries[0].organizationId).toBe("org-1");
    expect(entries[0].userId).toBe("user-1");
    expect(entries[0].changes.dpaVersion).toBe(PILOT_DPA.version);
  });

  it("asks nothing once the current version is on record, and records nothing twice", async () => {
    hosted();
    mocks.prisma.auditLog.findMany.mockResolvedValue([{ changes: { dpaVersion: PILOT_DPA.version } }]);
    const status = await callerWithRole("OWNER").getDpaStatus({ organizationId: "org-1" });
    expect(status.required).toBe(false);
    await callerWithRole("OWNER").acceptDpa({ organizationId: "org-1", accept: true });
    expect(dpaEntries()).toHaveLength(0);
  });

  it("asks again when only an earlier version is on record", async () => {
    hosted();
    mocks.prisma.auditLog.findMany.mockResolvedValue([{ changes: { dpaVersion: "1.0" } }]);
    const status = await callerWithRole("OWNER").getDpaStatus({ organizationId: "org-1" });
    expect(status.required).toBe(true);
  });

  it("never asks on the kit", async () => {
    kit();
    const status = await callerWithRole("OWNER").getDpaStatus({ organizationId: "org-1" });
    expect(status).toEqual({ required: false, canAccept: false });
  });
});

describe("organisations per account", () => {
  const create = () => orgCaller().create({ name: "Sixth", slug: "sixth", acceptDpa: true });

  it("is five on the hosted service", () => {
    expect(ORGANIZATIONS_PER_ACCOUNT).toBe(5);
  });

  it("refuses a sixth organisation on the hosted service, with a plain message", async () => {
    hosted();
    mocks.prisma.organizationMember.count.mockResolvedValue(5);
    const err = await create().catch((e) => e);
    expect(err).toMatchObject({ code: "FORBIDDEN" });
    expect(err.message).toContain("up to 5 organizations");
    expect(err.message).toContain("https://www.todo.law/contact/managed");
    expect(mocks.prisma.organization.create).not.toHaveBeenCalled();
  });

  it("allows the first organisation on the hosted service", async () => {
    hosted();
    await orgCaller().create({ name: "First", slug: "first", acceptDpa: true });
    expect(mocks.prisma.organization.create).toHaveBeenCalled();
  });

  it("allows a second to a fifth organisation on the hosted service", async () => {
    for (const held of [1, 2, 3, 4]) {
      hosted();
      mocks.prisma.organization.create.mockClear();
      mocks.prisma.organizationMember.count.mockResolvedValue(held);
      await orgCaller().create({ name: `Client ${held + 1}`, slug: `client-${held + 1}`, acceptDpa: true });
      expect(mocks.prisma.organization.create, `with ${held} held`).toHaveBeenCalled();
    }
  });

  it("bills a new organisation to its creator and joins the creator's window and plan", async () => {
    hosted();
    const firstStart = new Date(CREATED.getTime() - 3 * DAY);
    mocks.prisma.organizationMember.count.mockResolvedValue(1);
    mocks.prisma.organization.findMany.mockResolvedValueOnce([
      { plan: "PILOT", planStartedAt: null, planRenewsAt: null, planStripeSubscriptionId: null, pilotStartedAt: firstStart },
    ]);
    await orgCaller().create({ name: "Client 2", slug: "client-2", acceptDpa: true });
    expect(mocks.prisma.organization.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { billingOwnerId: "user-1" } })
    );
    const data = mocks.prisma.organization.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ billingOwnerId: "user-1", plan: "PILOT", pilotStartedAt: firstStart });
  });

  it("an account's first organisation starts its own window", async () => {
    hosted();
    await orgCaller().create({ name: "First", slug: "first", acceptDpa: true });
    const data = mocks.prisma.organization.create.mock.calls[0][0].data;
    expect(data.billingOwnerId).toBe("user-1");
    expect(data).not.toHaveProperty("pilotStartedAt");
  });

  it("still asks for the agreement for a second organisation", async () => {
    hosted();
    mocks.prisma.organizationMember.count.mockResolvedValue(1);
    await expect(orgCaller().create({ name: "Second", slug: "second" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(mocks.prisma.organization.create).not.toHaveBeenCalled();
  });

  it("reports the capacity and the message at the limit, in Spanish too", async () => {
    hosted();
    mocks.prisma.organizationMember.count.mockResolvedValue(2);
    expect(await orgCaller().capacity()).toEqual({ limited: true, limit: 5, used: 2, canAdd: true, message: null });
    mocks.prisma.organizationMember.count.mockResolvedValue(5);
    const full = await orgCaller().capacity();
    expect(full).toMatchObject({ limited: true, used: 5, canAdd: false });
    expect(full.message).toContain("up to 5 organizations");
    expect(pilotMessage("organizationLimit", "es")).toContain("hasta 5 organizaciones, y la tuya ya tiene 5");
    expect(pilotMessage("organizationLimitInvitee", "es")).toContain("ya pertenece a 5 organizaciones");
    for (const m of [pilotMessage("organizationLimit", "es"), pilotMessage("organizationLimitInvitee", "es")]) {
      expect(m).not.toMatch(/[—–]|\busted\b/);
    }
  });

  it("reports no limit on the kit", async () => {
    kit();
    expect(await orgCaller().capacity()).toEqual({ limited: false, message: null });
  });

  it("asks for the agreement and shows the limit in the dialogs that add an organisation", async () => {
    const { readFileSync } = await import("node:fs");
    const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
    const dialog = src("src/components/privacy/new-organization-dialog.tsx");
    expect(dialog).toContain("DpaAcceptCheckbox");
    expect(dialog).toContain("acceptDpa: hosted ? acceptDpa : undefined");
    expect(dialog).toContain("trpc.organization.capacity.useQuery");
    expect(dialog).toContain('data-testid="organization-limit"');
    const copy = src("src/components/privacy/copy-from-client-dialog.tsx");
    expect(copy).toContain("DpaAcceptCheckbox");
    expect(copy).toContain("acceptDpa: hosted ? acceptDpa : undefined");
  });

  it("does not limit organisations on the kit", async () => {
    kit();
    mocks.prisma.organizationMember.count.mockResolvedValue(3);
    await create();
    expect(mocks.prisma.organization.create).toHaveBeenCalled();
  });
});

describe("the switch to read-only at the end of the editing window", () => {
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
    expect(err.message).toContain("https://www.todo.law/pricing");
    expect(err.message).not.toMatch(/own instance/);
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

  it("never starts the window before the deployment date", () => {
    const early = { pilotStartedAt: new Date(PILOT_CLOCK_START.getTime() - 20 * DAY) };
    expect(pilotStart(early)).toEqual(PILOT_CLOCK_START);
    vi.setSystemTime(PILOT_CLOCK_START);
    expect(isPilotReadOnly(early)).toBe(false);
    // Started before the window was shortened: it ends PILOT_DAYS after the change.
    expect(pilotEndsAt(early)).toEqual(new Date(PILOT_WINDOW_SHORTENED_AT.getTime() + PILOT_DAYS * DAY));
  });
});

describe("the transition when the window went from 90 to 15 days (11 Oct 2026)", () => {
  const shortened = () => PILOT_WINDOW_SHORTENED_AT.getTime();

  it("is 15 days now, 90 before, and takes effect at the end of the release day", () => {
    expect(PILOT_DAYS).toBe(15);
    expect(PILOT_DAYS_BEFORE_SHORTENING).toBe(90);
    expect(PILOT_WINDOW_SHORTENED_AT.toISOString()).toBe("2026-10-12T00:00:00.000Z");
  });

  it("gives an organisation already in its pilot the earlier of its 90-day end and 15 days from the change", () => {
    for (const started of [PILOT_CLOCK_START, new Date(shortened() - DAY)]) {
      expect(pilotEndsAt({ pilotStartedAt: started })).toEqual(new Date(shortened() + 15 * DAY));
    }
  });

  it("leaves nobody read-only at the release, with at least 15 days left", () => {
    const atRelease = new Date("2026-10-11T18:00:00Z");
    for (const started of [PILOT_CLOCK_START, new Date("2026-10-05T00:00:00Z"), new Date("2026-10-11T12:00:00Z")]) {
      const org = { pilotStartedAt: started };
      expect(isPilotReadOnly(org, atRelease)).toBe(false);
      expect(pilotDaysLeft(org, atRelease)).toBeGreaterThanOrEqual(15);
    }
  });

  it("applies the plain 15 days to a window that starts from the change onwards", () => {
    const later = new Date("2026-12-01T09:00:00Z");
    expect(pilotEndsAt({ pilotStartedAt: later })).toEqual(new Date(later.getTime() + 15 * DAY));
  });

  it("answers in Castilian Spanish when the locale is es", async () => {
    hosted();
    setNow(PILOT_DAYS);
    callerWithRole("OWNER");
    const caller = orgCaller((name) => (name === "locale" ? "es" : undefined));
    await expect(addJurisdiction(caller)).rejects.toThrow("solo lectura");
  });

  it("still honours the legacy NEXT_LOCALE cookie when no locale cookie is present", async () => {
    hosted();
    setNow(PILOT_DAYS);
    callerWithRole("OWNER");
    const caller = orgCaller((name) => (name === "NEXT_LOCALE" ? "es" : undefined));
    await expect(addJurisdiction(caller)).rejects.toThrow("solo lectura");
  });
});

describe("the clock starts at the first sign-in", () => {
  // A signed-in member reaching the organisation, with a fresh org row.
  function signedInTo(org: typeof ORG) {
    mocks.prisma.organizationMember.findUnique.mockResolvedValue({
      id: "member-1",
      userId: "user-1",
      organizationId: org.id,
      role: "OWNER",
      organization: org,
    });
    return orgCaller();
  }
  const status = (org: typeof ORG) =>
    signedInTo(org).getPilotStatus({ organizationId: org.id });

  it("starts a new organisation's window at its first sign-in", async () => {
    hosted();
    const firstSignIn = new Date(CREATED.getTime() + 3 * DAY);
    vi.setSystemTime(firstSignIn);
    const org = { ...ORG, pilotStartedAt: null };
    expect(await status(org)).toMatchObject({
      hosted: true,
      started: true,
      daysLeft: PILOT_DAYS,
      readOnly: false,
    });
    expect(mocks.prisma.organization.updateMany).toHaveBeenCalledWith({
      where: { id: "org-1", pilotStartedAt: null },
      data: { pilotStartedAt: firstSignIn },
    });
    // Counted from the sign-in, not from the creation three days earlier.
    expect(pilotDaysLeft(org, new Date(CREATED.getTime() + PILOT_DAYS * DAY))).toBe(3);
  });

  it("starts an organisation created before the pilot at its first sign-in after it", async () => {
    hosted();
    const signIn = new Date(PILOT_CLOCK_START.getTime() + 40 * DAY);
    vi.setSystemTime(signIn);
    const org = { ...ORG, createdAt: new Date("2025-01-01T00:00:00Z"), pilotStartedAt: null };
    // With no recorded sign-in the window has not started: full days, writable.
    expect(isPilotReadOnly(org)).toBe(false);
    expect(pilotDaysLeft(org)).toBe(PILOT_DAYS);
    await addJurisdiction(signedInTo(org));
    expect(mocks.prisma.organizationJurisdiction.upsert).toHaveBeenCalled();
    expect(org.pilotStartedAt).toEqual(signIn);
    vi.setSystemTime(new Date(signIn.getTime() + (PILOT_DAYS - 1) * DAY));
    expect(await status(org)).toMatchObject({ daysLeft: 1, readOnly: false });
    vi.setSystemTime(new Date(signIn.getTime() + PILOT_DAYS * DAY));
    await expect(addJurisdiction(signedInTo(org))).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("does not start the clock on a sign-in before the deployment date", async () => {
    hosted();
    vi.setSystemTime(new Date(PILOT_CLOCK_START.getTime() - 5 * DAY));
    const org = { ...ORG, createdAt: new Date("2026-09-01T00:00:00Z"), pilotStartedAt: null };
    expect(await status(org)).toMatchObject({ started: false, daysLeft: PILOT_DAYS });
    expect(mocks.prisma.organization.updateMany).not.toHaveBeenCalled();
    expect(org.pilotStartedAt).toBeNull();
  });

  it("keeps a recorded start", async () => {
    hosted();
    setNow(10);
    expect(await status({ ...ORG })).toMatchObject({ daysLeft: PILOT_DAYS - 10 });
    expect(mocks.prisma.organization.updateMany).not.toHaveBeenCalled();
  });

  it("does not record or count anything on the kit", async () => {
    kit();
    const org = { ...ORG, pilotStartedAt: null };
    expect(await status(org)).toEqual({ hosted: false });
    expect(mocks.prisma.organization.updateMany).not.toHaveBeenCalled();
  });

  it("leaves the public request form open for an organisation whose window has not started", async () => {
    hosted();
    mocks.prisma.organization.findUnique.mockResolvedValue({
      ...ORG,
      pilotStartedAt: null,
      dsarIntakeForms: [{ id: "form-1" }],
      jurisdictions: [],
    });
    mocks.prisma.dSARRequest.count.mockResolvedValue(PILOT_LIMITS.dsarRequests);
    const anon = callerFor(dsarRouter, null) as ReturnType<typeof dsarRouter.createCaller>;
    // Refused only by the ceiling, not by the clock; and a visitor never starts the clock.
    await expect(
      anon.submitPublic({
        orgSlug: "org",
        type: "ACCESS",
        requesterName: "A",
        requesterEmail: "a@test.example",
        formToken: issueFormToken("org", new Date(Date.now() - 10_000)),
      })
    ).rejects.toThrow("pilot limit");
    expect(mocks.prisma.organization.updateMany).not.toHaveBeenCalled();
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

  it("refuses an invitee who already belongs to five organisations", async () => {
    hosted();
    mocks.prisma.organizationMember.count.mockImplementation(
      async ({ where }: { where: { organizationId?: string } }) =>
        where.organizationId ? 1 : 5
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
    await expect(addMember()).rejects.toThrow("already belongs to 5 organizations");
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
        formToken: issueFormToken("org", new Date(Date.now() - 10_000)),
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.prisma.dSARRequest.create).not.toHaveBeenCalled();
  });

  it("reports usage for the Settings card", async () => {
    hosted();
    mocks.prisma.dataAsset.count.mockResolvedValue(7);
    const status = await getPilotStatus(mocks.prisma as unknown as PilotDb, ORG);
    expect(status).toMatchObject({ hosted: true, readOnly: false, daysLeft: PILOT_DAYS - 10 });
    if (!status.hosted || status.paid) throw new Error("expected pilot status");
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
    // The full file is for owners and admins (the programme export's rule).
    mocks.prisma.organizationMember.findFirst.mockResolvedValue({
      id: "member-1",
      role: "OWNER",
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

describe("the transition flag the pilot bar reads (11 Oct 2026)", () => {
  it("is true only for a pilot begun before the window was shortened", async () => {
    const { isTransitionPilot } = await import("@/server/services/pilot/caps");
    expect(isTransitionPilot({ pilotStartedAt: null } as never)).toBe(false);
    expect(isTransitionPilot({ pilotStartedAt: new Date("2026-10-01T00:00:00Z") } as never)).toBe(true);
    expect(isTransitionPilot({ pilotStartedAt: new Date("2026-10-12T00:00:00Z") } as never)).toBe(false);
    expect(isTransitionPilot({ pilotStartedAt: new Date("2026-10-20T00:00:00Z") } as never)).toBe(false);
  });
});

describe("e-mail policy on invitations (both rules)", () => {
  const invite = (email: string) =>
    callerWithRole("OWNER").addMember({ organizationId: "org-1", email, role: "MEMBER" });

  it.each(["new@hotmail.com", "NEW@AOL.DE", "a.b.c.d@gmail.com"])(
    "refuses an invitation to %s with no account yet",
    async (email) => {
      mocks.prisma.user.findUnique.mockResolvedValue(null);
      await expect(invite(email)).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: "Please use your work e-mail address, or a different personal address. We can't accept this one.",
      });
      expect(mocks.prisma.organization.findUnique).not.toHaveBeenCalledWith(
        expect.objectContaining({ select: { name: true, settings: true } })
      );
      expect(mocks.prisma.organizationMember.create).not.toHaveBeenCalled();
    }
  );

  it.each(["old@hotmail.com", "a.b.c.d@gmail.com"])(
    "refuses an invitation to %s even when an account exists",
    async (email) => {
      mocks.prisma.user.findUnique.mockResolvedValue({ id: "u-9", email });
      await expect(invite(email)).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(mocks.prisma.organizationMember.create).not.toHaveBeenCalled();
    }
  );

  it("does not refuse a usual address", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(null);
    const outcome = await invite("first.last@gmail.com").catch((e: Error) => e);
    expect((outcome as Error)?.message ?? "").not.toContain("We can't accept this one");
  });
});
