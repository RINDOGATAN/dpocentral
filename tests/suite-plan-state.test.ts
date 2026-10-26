// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * One pilot and one plan across the suite (src/lib/suite-plan-state.ts,
 * src/server/services/suite/plan-state.ts, POST /api/suite/plan-state):
 * the signed contract, the answer this app gives, and what it takes from
 * the peer (paid plan adopted, pilot start offered only to a group with
 * none, nothing on the kit, nothing for a member who is not the billing
 * owner, nothing when the peer is down).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const fakeDb = vi.hoisted(() => ({ organization: { findMany: vi.fn() } }));
vi.mock("@/lib/prisma", () => ({ default: fakeDb, prisma: fakeDb }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import {
  NOT_FOUND,
  parseSuiteRequest,
  parseSuiteState,
  signSuiteRequest,
  suitePlanStateEnabled,
  verifySuiteSignature,
} from "@/lib/suite-plan-state";
import { signSyncBody, verifySyncSignature } from "@/lib/plan-upgrade";
import {
  clearSuiteCache,
  localPlanStateForEmail,
  peerPlanState,
  peerUrl,
  suiteForRequest,
  type ApplyDb,
  type LocalStateDb,
} from "@/server/services/suite/plan-state";
import { recordPilotFirstSignIn } from "@/server/services/pilot/caps";
import { POST } from "@/app/api/suite/plan-state/route";

const SECRET = "test-shared-secret";
const HOSTED = { VERCEL_ENV: "production", PLAN_SYNC_SECRET: SECRET };
const T0 = Date.parse("2026-10-26T10:00:00Z");

function okFetch(answer: unknown) {
  return vi.fn(async () => ({ ok: true, status: 200, json: async () => answer }));
}

beforeEach(() => clearSuiteCache());
afterEach(() => vi.unstubAllEnvs());

describe("the signed contract", () => {
  it("verifies its own signature and refuses a stale or altered one", () => {
    const body = JSON.stringify({ version: 1, email: "a@b.com" });
    const t = Math.floor(T0 / 1000);
    const sig = signSuiteRequest(SECRET, t, body);
    expect(verifySuiteSignature(sig, body, SECRET, t)).toBe(true);
    expect(verifySuiteSignature(sig, body + " ", SECRET, t)).toBe(false);
    expect(verifySuiteSignature(sig, body, "other", t)).toBe(false);
    expect(verifySuiteSignature(sig, body, SECRET, t + 301)).toBe(false);
    expect(verifySuiteSignature(null, body, SECRET, t)).toBe(false);
  });

  it("never verifies as a plan notice, nor the reverse", () => {
    const body = "{}";
    const t = Math.floor(T0 / 1000);
    expect(verifySyncSignature(signSuiteRequest(SECRET, t, body), body, SECRET, t)).toBe(false);
    expect(verifySuiteSignature(signSyncBody(body, SECRET, t), body, SECRET, t)).toBe(false);
  });

  it("parses requests and answers strictly", () => {
    expect(parseSuiteRequest({ version: 1, email: " A@B.com " })).toEqual({ version: 1, email: "a@b.com" });
    expect(parseSuiteRequest({ version: 2, email: "a@b.com" })).toBeNull();
    expect(parseSuiteRequest({ version: 1, email: "nope" })).toBeNull();
    expect(parseSuiteState({ version: 1, found: false, paid: true })).toEqual(NOT_FOUND);
    expect(parseSuiteState({ found: true })).toBeNull();
    expect(
      parseSuiteState({ version: 1, found: true, paid: false, pilotStartedAt: "2026-10-20T00:00:00Z", subscriptionId: 7 })
    ).toMatchObject({ found: true, paid: false, subscriptionId: null, pilotStartedAt: "2026-10-20T00:00:00.000Z" });
  });

  it("is off without the shared secret or with SUITE_PLAN_STATE=off", () => {
    expect(suitePlanStateEnabled({})).toBe(false);
    expect(suitePlanStateEnabled({ PLAN_SYNC_SECRET: SECRET })).toBe(true);
    expect(suitePlanStateEnabled({ PLAN_SYNC_SECRET: SECRET, SUITE_PLAN_STATE: "off" })).toBe(false);
    expect(peerUrl({})).toBe("https://aisentinel.todo.law/api/suite/plan-state");
  });
});

describe("the answer this app gives", () => {
  const row = (over: Record<string, unknown>) => ({
    id: "o",
    plan: "PILOT",
    planStartedAt: null,
    planRenewsAt: null,
    planStripeSubscriptionId: null,
    pilotStartedAt: null,
    ...over,
  });

  it("is not found when the person bills no organisation", async () => {
    const db = { organization: { findMany: vi.fn(async () => []) } } as unknown as LocalStateDb;
    expect(await localPlanStateForEmail(db, "a@b.com")).toEqual(NOT_FOUND);
  });

  it("folds the umbrella group: paid when any is paid, the earliest pilot start", async () => {
    const db = {
      organization: {
        findMany: vi.fn(async () => [
          row({ id: "1", pilotStartedAt: new Date("2026-10-20T00:00:00Z") }),
          row({
            id: "2",
            plan: "EU_CLOUD",
            planRenewsAt: new Date("2027-10-20T00:00:00Z"),
            planStripeSubscriptionId: "sub_1",
            pilotStartedAt: new Date("2026-10-18T00:00:00Z"),
          }),
        ]),
      },
    } as unknown as LocalStateDb;
    expect(await localPlanStateForEmail(db, "a@b.com")).toEqual({
      version: 1,
      found: true,
      paid: true,
      planRenewsAt: "2027-10-20T00:00:00.000Z",
      subscriptionId: "sub_1",
      pilotStartedAt: "2026-10-18T00:00:00.000Z",
    });
  });
});

describe("asking the peer", () => {
  it("returns null when the peer is unreachable, and caches the failure briefly", async () => {
    const f = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    const deps = { env: HOSTED, fetch: f, now: () => T0 };
    expect(await peerPlanState("a@b.com", deps)).toBeNull();
    expect(await peerPlanState("a@b.com", deps)).toBeNull();
    expect(f).toHaveBeenCalledTimes(1);
    expect(await peerPlanState("a@b.com", { ...deps, now: () => T0 + 61_000 })).toBeNull();
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("signs its request and caches a good answer", async () => {
    const f = okFetch({ version: 1, found: true, paid: false, pilotStartedAt: "2026-10-20T00:00:00Z" });
    const deps = { env: HOSTED, fetch: f, now: () => T0 };
    const a = await peerPlanState("A@B.com", deps);
    await peerPlanState("a@b.com", deps);
    expect(a?.found).toBe(true);
    expect(f).toHaveBeenCalledTimes(1);
    const [, init] = f.mock.calls[0] as unknown as [string, { headers: Record<string, string>; body: string }];
    expect(verifySuiteSignature(init.headers["x-suite-signature"], init.body, SECRET, Math.floor(T0 / 1000))).toBe(true);
    expect(JSON.parse(init.body)).toEqual({ version: 1, email: "a@b.com" });
  });

  it("asks nothing on the kit or when switched off", async () => {
    const f = okFetch({});
    expect(await peerPlanState("a@b.com", { env: { PLAN_SYNC_SECRET: SECRET, SUITE_PLAN_STATE: "off" }, fetch: f })).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
});

function applyDb() {
  const writes: object[] = [];
  const audits: object[] = [];
  const db: ApplyDb = {
    organization: {
      findMany: vi.fn(async () => [
        { id: "o1", plan: "PILOT", planStartedAt: null, planRenewsAt: null, planNote: null },
        { id: "o2", plan: "PILOT", planStartedAt: null, planRenewsAt: null, planNote: null },
      ]),
      updateMany: vi.fn(async (args: object) => {
        writes.push(args);
        return { count: 2 };
      }),
    },
    auditLog: {
      create: vi.fn(async (args: { data: object }) => {
        audits.push(args.data);
        return args.data;
      }),
    },
    $transaction: async (fn) => fn(db),
  };
  return { db, writes, audits };
}

describe("applying the peer's state here", () => {
  const owner = { id: "u1", email: "owner@firm.es" };
  const org = () => ({ id: "o1", plan: "PILOT", billingOwnerId: "u1", pilotStartedAt: null as Date | null });

  it("adopts a paid plan held on the peer for the whole group, with one audit entry each", async () => {
    const { db, writes, audits } = applyDb();
    const o = org();
    const f = okFetch({
      version: 1,
      found: true,
      paid: true,
      planRenewsAt: "2027-10-01T00:00:00Z",
      subscriptionId: "sub_9",
      pilotStartedAt: "2026-10-10T00:00:00Z",
    });
    const res = await suiteForRequest(db, o, owner, { env: HOSTED, fetch: f, now: () => T0 });
    expect(res.suite).toBe(true);
    expect(o.plan).toBe("EU_CLOUD");
    expect(writes).toHaveLength(1);
    expect((writes[0] as { data: Record<string, unknown> }).data).toMatchObject({
      plan: "EU_CLOUD",
      planStripeSubscriptionId: "sub_9",
    });
    expect(audits).toHaveLength(2);
    expect(audits[0]).toMatchObject({ action: "PLAN_CHANGE", metadata: { source: "suite-peer" } });
  });

  it("offers the peer's pilot start, and writes nothing, when the peer is on the pilot", async () => {
    const { db, writes } = applyDb();
    const f = okFetch({ version: 1, found: true, paid: false, pilotStartedAt: "2026-10-20T00:00:00Z" });
    const res = await suiteForRequest(db, org(), owner, { env: HOSTED, fetch: f, now: () => T0 });
    expect(res).toEqual({ suite: true, preferredPilotStart: new Date("2026-10-20T00:00:00Z") });
    expect(writes).toHaveLength(0);
  });

  it("does nothing for a member who is not the billing owner (an e-mail that bills nothing)", async () => {
    const { db } = applyDb();
    const f = okFetch({ version: 1, found: true, paid: true });
    expect(await suiteForRequest(db, org(), { id: "staff", email: "staff@firm.es" }, { env: HOSTED, fetch: f })).toEqual({
      suite: false,
      preferredPilotStart: null,
    });
    expect(f).not.toHaveBeenCalled();
  });

  it("does nothing when the peer does not know the person", async () => {
    const { db, writes } = applyDb();
    const f = okFetch({ version: 1, found: false, paid: false });
    expect((await suiteForRequest(db, org(), owner, { env: HOSTED, fetch: f })).suite).toBe(false);
    expect(writes).toHaveLength(0);
  });

  it("does nothing on the kit", async () => {
    const { db } = applyDb();
    const f = okFetch({ version: 1, found: true, paid: true });
    expect((await suiteForRequest(db, org(), owner, { env: { PLAN_SYNC_SECRET: SECRET }, fetch: f })).suite).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });

  it("never fails the request when the peer is down", async () => {
    const { db } = applyDb();
    const f = vi.fn(async () => {
      throw new Error("timeout");
    });
    expect(await suiteForRequest(db, org(), owner, { env: HOSTED, fetch: f })).toEqual({
      suite: false,
      preferredPilotStart: null,
    });
  });
});

describe("the first sign-in with the suite's start", () => {
  function clockDb() {
    const updates: { where: object; data: { pilotStartedAt: Date } }[] = [];
    return {
      updates,
      db: {
        organization: {
          updateMany: vi.fn(async (args: { where: object; data: { pilotStartedAt: Date } }) => {
            updates.push(args);
            return { count: 1 };
          }),
          findFirst: vi.fn(async () => null),
        },
      } as never as Parameters<typeof recordPilotFirstSignIn>[0],
    };
  }

  it("starts the group's window at the peer's earlier start", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const { db, updates } = clockDb();
    const org = { id: "o1", billingOwnerId: "u1", pilotStartedAt: null as Date | null, plan: "PILOT" };
    const now = new Date("2026-10-26T10:00:00Z");
    await recordPilotFirstSignIn(db, org, now, new Date("2026-10-20T00:00:00Z"));
    expect(updates[0].data.pilotStartedAt.toISOString()).toBe("2026-10-20T00:00:00.000Z");
    expect(org.pilotStartedAt?.toISOString()).toBe("2026-10-20T00:00:00.000Z");
  });

  it("never moves a recorded start", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const { db, updates } = clockDb();
    const start = new Date("2026-10-24T00:00:00Z");
    await recordPilotFirstSignIn(
      db,
      { id: "o1", billingOwnerId: "u1", pilotStartedAt: start, plan: "PILOT" },
      new Date("2026-10-26T10:00:00Z"),
      new Date("2026-10-01T00:00:00Z")
    );
    expect(updates).toHaveLength(0);
  });

  it("ignores a start in the future", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const { db, updates } = clockDb();
    const now = new Date("2026-10-26T10:00:00Z");
    await recordPilotFirstSignIn(db, { id: "o1", pilotStartedAt: null, plan: "PILOT" }, now, new Date("2026-11-01T00:00:00Z"));
    expect(updates[0].data.pilotStartedAt.toISOString()).toBe(now.toISOString());
  });
});

describe("POST /api/suite/plan-state", () => {
  const call = (body: string, header: string | null) =>
    POST(
      new Request("http://localhost/api/suite/plan-state", {
        method: "POST",
        body,
        headers: header ? { "x-suite-signature": header } : {},
      })
    );

  it("is not available on the kit or without the secret", async () => {
    vi.stubEnv("PLAN_SYNC_SECRET", SECRET);
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("AUTH_COOKIE_DOMAIN", "");
    expect((await call("{}", null)).status).toBe(404);
  });

  it("refuses a bad signature and a malformed request, and answers a good one", async () => {
    vi.stubEnv("PLAN_SYNC_SECRET", SECRET);
    vi.stubEnv("VERCEL_ENV", "production");
    const t = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({ version: 1, email: "owner@firm.es" });
    expect((await call(body, "t=1,v1=" + "0".repeat(64))).status).toBe(401);
    const bad = JSON.stringify({ version: 1, email: "x" });
    expect((await call(bad, signSuiteRequest(SECRET, t, bad))).status).toBe(400);
    fakeDb.organization.findMany.mockResolvedValueOnce([]);
    const res = await call(body, signSuiteRequest(SECRET, t, body));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(NOT_FOUND);
  });
});
