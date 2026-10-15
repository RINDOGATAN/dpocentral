// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The automatic upgrade to the paid EU cloud plan (owner, 11 Oct 2026), behind
 * AUTO_UPGRADE_ENABLED:
 *   - the signed organisation reference and the relay signature;
 *   - POST /api/plan/stripe-sync: switch off, signature failures, malformed
 *     notices, the mapping rule (subscription, reference, e-mail), the
 *     idempotent repeat, the cancellation path and the operator's plans;
 *   - the caps lift for an organisation the payment moved to EU_CLOUD;
 *   - GET /api/plan/checkout: who may start it and where it sends them.
 * Everything runs on an in-memory stand-in; no database, no Stripe.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { TRPCError } from "@trpc/server";

type Org = {
  id: string;
  plan: "PILOT" | "EU_CLOUD";
  planStartedAt: Date | null;
  planRenewsAt: Date | null;
  planNote: string | null;
  planStripeSubscriptionId: string | null;
  pilotStartedAt: Date | null;
  billingOwnerId?: string | null;
};
type Member = { organizationId: string; email: string; role: string; userId?: string };

const state = vi.hoisted(() => ({
  orgs: new Map<string, Org>(),
  members: [] as Member[],
  audits: [] as { organizationId: string; action: string; metadata: Record<string, string> }[],
  updates: 0,
  failNextUpdate: false,
  sessionEmail: null as string | null,
}));

const fakeDb = vi.hoisted(() => {
  const pick = (o: Org) => ({
    id: o.id,
    plan: o.plan,
    planStartedAt: o.planStartedAt,
    planRenewsAt: o.planRenewsAt,
    planNote: o.planNote,
    planStripeSubscriptionId: o.planStripeSubscriptionId,
    billingOwnerId: o.billingOwnerId ?? null,
  });
  const tx = {
    organization: {
      update: async ({ where, data }: { where: { id: string }; data: Partial<Org> }) => {
        if (state.failNextUpdate) {
          state.failNextUpdate = false;
          throw new Error("database down");
        }
        state.updates++;
        Object.assign(state.orgs.get(where.id)!, data);
      },
    },
    auditLog: {
      create: async ({ data }: { data: { organizationId: string; action: string; metadata: Record<string, string> } }) => {
        state.audits.push(data);
      },
    },
  };
  return {
    organization: {
      findMany: async ({
        where,
      }: {
        where: { planStripeSubscriptionId?: string; billingOwnerId?: string; id?: string };
      }) =>
        [...state.orgs.values()]
          .filter((o) =>
            "planStripeSubscriptionId" in where
              ? o.planStripeSubscriptionId === where.planStripeSubscriptionId
              : "billingOwnerId" in where
                ? (o.billingOwnerId ?? null) === where.billingOwnerId
                : o.id === where.id
          )
          .map(pick),
      findUnique: async ({ where }: { where: { id: string } }) => {
        const o = state.orgs.get(where.id);
        return o ? pick(o) : null;
      },
    },
    organizationMember: {
      findMany: async ({
        where,
      }: {
        where: { role: { in: string[] }; user: { email: { equals: string } } };
      }) =>
        state.members
          .filter(
            (m) =>
              where.role.in.includes(m.role) &&
              m.email.toLowerCase() === where.user.email.equals.toLowerCase()
          )
          .map((m) => ({
            organizationId: m.organizationId,
            userId: m.userId ?? `user:${m.email.toLowerCase()}`,
            organization: { billingOwnerId: state.orgs.get(m.organizationId)?.billingOwnerId ?? null },
          })),
      // The checkout route's lookup.
      findFirst: async ({ where }: { where: { organizationId: string; user: { email: string } } }) => {
        const m = state.members.find(
          (r) => r.organizationId === where.organizationId && r.email === where.user.email
        );
        return m ? { ...m, organization: state.orgs.get(m.organizationId) } : null;
      },
    },
    $transaction: async <T,>(fn: (t: typeof tx) => Promise<T>) => fn(tx),
  };
});

vi.mock("@/lib/prisma", () => ({ default: fakeDb, prisma: fakeDb }));
vi.mock("@/lib/session-cookie", () => ({
  getSessionToken: async () => (state.sessionEmail ? { email: state.sessionEmail } : null),
}));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import {
  checkoutUrl,
  parseOrgReference,
  signOrgReference,
  signSyncBody,
  verifySyncSignature,
  upgradeLinkFor,
} from "@/lib/plan-upgrade";
import { POST as sync } from "@/app/api/plan/stripe-sync/route";
import { GET as checkout } from "@/app/api/plan/checkout/route";
import {
  assertPilotCapacity,
  assertPilotWritable,
  PILOT_CLOCK_START,
  type PilotDb,
} from "@/server/services/pilot/caps";

const SECRET = "test-plan-sync-secret";
const EUR_LINK = "https://buy.stripe.test/eur-link";
const USD_LINK = "https://buy.stripe.test/usd-link";
const DAY = 24 * 60 * 60 * 1000;
const PERIOD_END = "2027-10-11T10:00:00.000Z";

function org(id: string, extra: Partial<Org> = {}): Org {
  const o: Org = {
    id,
    plan: "PILOT",
    planStartedAt: null,
    planRenewsAt: null,
    planNote: null,
    planStripeSubscriptionId: null,
    pilotStartedAt: new Date(PILOT_CLOCK_START.getTime() + DAY),
    ...extra,
  };
  state.orgs.set(id, o);
  return o;
}

function notice(extra: Record<string, unknown> = {}) {
  return {
    version: 1,
    eventId: "evt_1",
    eventType: "checkout.session.completed",
    kind: "paid",
    subscriptionId: "sub_A",
    customerEmail: "owner@example.test",
    clientReferenceId: null,
    periodEnd: PERIOD_END,
    livemode: false,
    ...extra,
  };
}

function post(body: unknown, opts: { secret?: string; t?: number; header?: string | null } = {}) {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  const header =
    opts.header !== undefined ? opts.header : signSyncBody(raw, opts.secret ?? SECRET, opts.t);
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (header !== null) headers["x-plan-sync-signature"] = header;
  return sync(new Request("http://localhost/api/plan/stripe-sync", { method: "POST", body: raw, headers }));
}

const on = () => {
  vi.stubEnv("AUTO_UPGRADE_ENABLED", "true");
  vi.stubEnv("PLAN_SYNC_SECRET", SECRET);
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("PLAN_CLOUD_EUR_LINK", EUR_LINK);
  vi.stubEnv("PLAN_CLOUD_USD_LINK", USD_LINK);
};

beforeEach(() => {
  state.orgs.clear();
  state.members = [];
  state.audits = [];
  state.updates = 0;
  state.failNextUpdate = false;
  state.sessionEmail = null;
  on();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("the organisation reference", () => {
  it("round-trips for this app and is refused when tampered with", () => {
    const ref = signOrgReference("cmorg1", SECRET);
    expect(ref).toMatch(/^pe1-dpc-cmorg1-[0-9a-f]{32}$/);
    expect(parseOrgReference(ref, SECRET)).toEqual({ kind: "valid", orgId: "cmorg1" });
    expect(parseOrgReference(ref.replace("cmorg1", "cmorg2"), SECRET).kind).toBe("invalid");
    expect(parseOrgReference(ref, "another-secret").kind).toBe("invalid");
    expect(parseOrgReference("anything at all", SECRET).kind).toBe("invalid");
    expect(parseOrgReference(null, SECRET).kind).toBe("none");
  });

  it("recognises a reference for another app of the suite", () => {
    const ais = signOrgReference("cmorg1", SECRET, "ais");
    expect(parseOrgReference(ais, SECRET)).toEqual({ kind: "other-app", app: "ais" });
  });

  it("builds the payment link with the reference and the e-mail", () => {
    const url = checkoutUrl(EUR_LINK, "cmorg1", "a+b@example.test", SECRET);
    expect(url.startsWith(`${EUR_LINK}?client_reference_id=pe1-dpc-cmorg1-`)).toBe(true);
    expect(url).toContain("&prefilled_email=a%2Bb%40example.test");
  });

  it("checks the relay signature, its secret and its age", () => {
    const now = 1_800_000_000;
    const h = signSyncBody("{}", SECRET, now);
    expect(verifySyncSignature(h, "{}", SECRET, now)).toBe(true);
    expect(verifySyncSignature(h, "{ }", SECRET, now)).toBe(false);
    expect(verifySyncSignature(h, "{}", "wrong", now)).toBe(false);
    expect(verifySyncSignature(h, "{}", SECRET, now + 301)).toBe(false);
    expect(verifySyncSignature(null, "{}", SECRET, now)).toBe(false);
  });
});

describe("POST /api/plan/stripe-sync: refusals", () => {
  it("answers 503 and writes nothing while switched off", async () => {
    org("cmorg1");
    vi.stubEnv("AUTO_UPGRADE_ENABLED", "");
    const res = await post(notice({ clientReferenceId: signOrgReference("cmorg1", SECRET) }));
    expect(res.status).toBe(503);
    expect(state.updates).toBe(0);
  });

  it("answers 503 without a secret", async () => {
    vi.stubEnv("PLAN_SYNC_SECRET", "");
    expect((await post(notice())).status).toBe(503);
  });

  it.each([
    ["missing", { header: null }],
    ["wrong", { secret: "not-the-secret" }],
    ["stale", { t: Math.floor(Date.now() / 1000) - 600 }],
    ["garbled", { header: "t=abc,v1=xyz" }],
  ])("answers 401 to a %s signature and writes nothing", async (_label, opts) => {
    org("cmorg1");
    const res = await post(notice({ clientReferenceId: signOrgReference("cmorg1", SECRET) }), opts);
    expect(res.status).toBe(401);
    expect(state.updates).toBe(0);
    expect(state.orgs.get("cmorg1")!.plan).toBe("PILOT");
  });

  it("answers 400 to a malformed notice", async () => {
    expect((await post("not json")).status).toBe(400);
    expect((await post(notice({ kind: "maybe" }))).status).toBe(400);
    expect((await post(notice({ subscriptionId: "" }))).status).toBe(400);
  });

  it("answers 500 when the database fails, so the payment is retried", async () => {
    org("cmorg1");
    state.failNextUpdate = true;
    const res = await post(notice({ clientReferenceId: signOrgReference("cmorg1", SECRET) }));
    expect(res.status).toBe(500);
    expect(state.orgs.get("cmorg1")!.plan).toBe("PILOT");
  });
});

describe("POST /api/plan/stripe-sync: payment", () => {
  it("moves the referenced organisation to EU_CLOUD, with one audit entry", async () => {
    org("cmorg1");
    const res = await post(notice({ clientReferenceId: signOrgReference("cmorg1", SECRET) }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toEqual([{ organizationId: "cmorg1", rule: "reference", changed: true }]);
    const o = state.orgs.get("cmorg1")!;
    expect(o.plan).toBe("EU_CLOUD");
    expect(o.planStripeSubscriptionId).toBe("sub_A");
    expect(o.planRenewsAt?.toISOString()).toBe(PERIOD_END);
    expect(o.planStartedAt).not.toBeNull();
    expect(state.audits).toHaveLength(1);
    expect(state.audits[0]).toMatchObject({
      organizationId: "cmorg1",
      action: "PLAN_CHANGE",
      metadata: { source: "stripe-auto-upgrade", eventId: "evt_1", subscriptionId: "sub_A", rule: "reference" },
    });
  });

  it("is idempotent: the same notice again writes nothing", async () => {
    org("cmorg1");
    const n = notice({ clientReferenceId: signOrgReference("cmorg1", SECRET) });
    await post(n);
    const res = await post(n);
    const body = await res.json();
    expect(body.results).toEqual([{ organizationId: "cmorg1", rule: "subscription", changed: false }]);
    expect(state.updates).toBe(1);
    expect(state.audits).toHaveLength(1);
  });

  it("falls back to the e-mail rule on an invalid reference", async () => {
    org("cmorg1");
    state.members.push({ organizationId: "cmorg1", email: "owner@example.test", role: "OWNER" });
    const bad = signOrgReference("cmorg1", "another-secret");
    const body = await (await post(notice({ clientReferenceId: bad, customerEmail: "Owner@Example.test" }))).json();
    expect(body.results).toEqual([{ organizationId: "cmorg1", rule: "email", changed: true }]);
  });

  it("uses the e-mail rule for a reference to another app", async () => {
    org("cmorg1");
    state.members.push({ organizationId: "cmorg1", email: "owner@example.test", role: "ADMIN" });
    const ais = signOrgReference("aisorg", SECRET, "ais");
    const body = await (await post(notice({ clientReferenceId: ais }))).json();
    expect(body.results[0]).toMatchObject({ organizationId: "cmorg1", rule: "email", changed: true });
  });

  it("leaves an unknown payer unmatched: 200, a reason, no write", async () => {
    org("cmorg1");
    const res = await post(notice({ clientReferenceId: "pe1-dpc-nosuchorg-" + "0".repeat(32) }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toEqual([{ organizationId: null, rule: null, changed: false, reason: "no-account" }]);
    expect(state.updates).toBe(0);
  });

  it("does not guess between several customers, nor count a plain member", async () => {
    org("cmorg1");
    org("cmorg2");
    org("cmorg3");
    state.members.push(
      { organizationId: "cmorg1", email: "owner@example.test", role: "OWNER" },
      { organizationId: "cmorg2", email: "owner@example.test", role: "ADMIN" },
      { organizationId: "cmorg3", email: "member@example.test", role: "MEMBER" }
    );
    let body = await (await post(notice())).json();
    expect(body.results[0].reason).toBe("several-customers");
    body = await (await post(notice({ customerEmail: "member@example.test" }))).json();
    expect(body.results[0].reason).toBe("no-account");
    expect(state.updates).toBe(0);
  });

  it("refuses to re-point an organisation already paid by another subscription", async () => {
    org("cmorg1", { plan: "EU_CLOUD", planStripeSubscriptionId: "sub_OTHER", planStartedAt: new Date() });
    const body = await (await post(notice({ clientReferenceId: signOrgReference("cmorg1", SECRET) }))).json();
    expect(body.results[0]).toMatchObject({ changed: false, reason: "already-paid-other-subscription" });
    expect(state.orgs.get("cmorg1")!.planStripeSubscriptionId).toBe("sub_OTHER");
  });

  it("attaches the subscription to a plan an operator set, keeping its start", async () => {
    const started = new Date("2026-10-12T00:00:00Z");
    org("cmorg1", { plan: "EU_CLOUD", planStartedAt: started, planNote: "invoice in_1" });
    await post(notice({ clientReferenceId: signOrgReference("cmorg1", SECRET) }));
    const o = state.orgs.get("cmorg1")!;
    expect(o.planStripeSubscriptionId).toBe("sub_A");
    expect(o.planStartedAt).toEqual(started);
    expect(o.planNote).toBe("invoice in_1");
  });

  it("brings the renewal date forward on a renewal", async () => {
    org("cmorg1", { plan: "EU_CLOUD", planStripeSubscriptionId: "sub_A", planStartedAt: new Date(), planRenewsAt: new Date(PERIOD_END) });
    const next = "2028-10-11T10:00:00.000Z";
    const body = await (await post(notice({ eventId: "evt_2", eventType: "invoice.paid", periodEnd: next }))).json();
    expect(body.results[0]).toMatchObject({ rule: "subscription", changed: true });
    expect(state.orgs.get("cmorg1")!.planRenewsAt?.toISOString()).toBe(next);
  });
});

describe("POST /api/plan/stripe-sync: the end of the subscription", () => {
  it("returns the organisation to PILOT with an audit entry, keeping its pilot clock", async () => {
    const o = org("cmorg1", { plan: "EU_CLOUD", planStripeSubscriptionId: "sub_A", planStartedAt: new Date(), planRenewsAt: new Date(PERIOD_END) });
    const clock = o.pilotStartedAt;
    const res = await post(notice({ kind: "ended", eventType: "customer.subscription.deleted", periodEnd: null }));
    expect(res.status).toBe(200);
    expect(o.plan).toBe("PILOT");
    expect(o.planStripeSubscriptionId).toBeNull();
    expect(o.planRenewsAt).toBeNull();
    expect(o.pilotStartedAt).toBe(clock);
    expect(state.audits).toHaveLength(1);
    // Again: nothing more to do.
    await post(notice({ kind: "ended", eventType: "customer.subscription.deleted", periodEnd: null }));
    expect(state.audits).toHaveLength(1);
  });

  it("never downgrades a plan an operator set without a subscription", async () => {
    org("cmorg1", { plan: "EU_CLOUD", planStartedAt: new Date() });
    state.members.push({ organizationId: "cmorg1", email: "owner@example.test", role: "OWNER" });
    const body = await (await post(notice({ kind: "ended", periodEnd: null }))).json();
    expect(body.results[0]).toMatchObject({ organizationId: null, reason: "no-organisation-for-subscription" });
    expect(state.orgs.get("cmorg1")!.plan).toBe("EU_CLOUD");
  });
});

describe("POST /api/plan/stripe-sync: one plan per customer", () => {
  const group = () => {
    org("cmorg1", { billingOwnerId: "consultant" });
    org("cmorg2", { billingOwnerId: "consultant" });
    org("cmorg3", { billingOwnerId: "consultant" });
    org("cmclient", { billingOwnerId: "client-owner" });
  };

  it("a reference to any organisation of the customer covers all of them, one audit entry each", async () => {
    group();
    const body = await (await post(notice({ clientReferenceId: signOrgReference("cmorg2", SECRET) }))).json();
    expect(body.results.map((r: { organizationId: string }) => r.organizationId).sort()).toEqual([
      "cmorg1",
      "cmorg2",
      "cmorg3",
    ]);
    for (const id of ["cmorg1", "cmorg2", "cmorg3"]) {
      expect(state.orgs.get(id)).toMatchObject({ plan: "EU_CLOUD", planStripeSubscriptionId: "sub_A" });
    }
    expect(new Set(["cmorg1", "cmorg2", "cmorg3"].map((id) => state.orgs.get(id)!.planStartedAt!.getTime())).size).toBe(1);
    expect(state.orgs.get("cmclient")!.plan).toBe("PILOT");
    expect(state.audits).toHaveLength(3);
  });

  it("a payer who administers several organisations of one customer resolves to that customer", async () => {
    group();
    state.members.push(
      { organizationId: "cmorg1", email: "owner@example.test", role: "OWNER", userId: "consultant" },
      { organizationId: "cmorg2", email: "owner@example.test", role: "OWNER", userId: "consultant" },
      { organizationId: "cmorg3", email: "owner@example.test", role: "ADMIN", userId: "consultant" },
      // Also an administrator of a client's own organisation: not theirs to pay for.
      { organizationId: "cmclient", email: "owner@example.test", role: "ADMIN", userId: "consultant" }
    );
    const body = await (await post(notice())).json();
    expect(body.results).toHaveLength(3);
    expect(body.results.every((r: { rule: string; changed: boolean }) => r.rule === "email" && r.changed)).toBe(true);
    expect(state.orgs.get("cmclient")!.plan).toBe("PILOT");
  });

  it("an administrator who pays for a customer they do not own resolves to that one customer", async () => {
    group();
    state.members.push(
      { organizationId: "cmorg1", email: "staff@example.test", role: "ADMIN", userId: "staff" },
      { organizationId: "cmorg3", email: "staff@example.test", role: "ADMIN", userId: "staff" }
    );
    const body = await (await post(notice({ customerEmail: "staff@example.test" }))).json();
    expect(body.results).toHaveLength(3);
    expect(state.orgs.get("cmorg2")!.plan).toBe("EU_CLOUD");
  });

  it("a renewal also covers an organisation the customer created since", async () => {
    group();
    await post(notice({ clientReferenceId: signOrgReference("cmorg1", SECRET) }));
    org("cmorg4", { billingOwnerId: "consultant" });
    const next = "2028-10-11T10:00:00.000Z";
    await post(notice({ eventId: "evt_2", eventType: "invoice.paid", periodEnd: next }));
    for (const id of ["cmorg1", "cmorg2", "cmorg3", "cmorg4"]) {
      expect(state.orgs.get(id)).toMatchObject({ plan: "EU_CLOUD", planStripeSubscriptionId: "sub_A" });
      expect(state.orgs.get(id)!.planRenewsAt?.toISOString()).toBe(next);
    }
  });

  it("the end of the subscription returns every organisation of the customer to the pilot", async () => {
    group();
    await post(notice({ clientReferenceId: signOrgReference("cmorg1", SECRET) }));
    await post(notice({ kind: "ended", eventType: "customer.subscription.deleted", periodEnd: null }));
    for (const id of ["cmorg1", "cmorg2", "cmorg3"]) expect(state.orgs.get(id)!.plan).toBe("PILOT");
  });

  it("does not attach a second subscription to a customer already paying", async () => {
    group();
    state.orgs.get("cmorg3")!.plan = "EU_CLOUD";
    state.orgs.get("cmorg3")!.planStripeSubscriptionId = "sub_OTHER";
    const body = await (await post(notice({ clientReferenceId: signOrgReference("cmorg1", SECRET) }))).json();
    expect(body.results[0]).toMatchObject({ changed: false, reason: "already-paid-other-subscription" });
    expect(state.orgs.get("cmorg1")!.plan).toBe("PILOT");
  });

  it("checkout refuses a second payment when another organisation of the customer is paid", async () => {
    group();
    state.orgs.get("cmorg2")!.plan = "EU_CLOUD";
    state.members.push({ organizationId: "cmorg1", email: "owner@example.test", role: "OWNER", userId: "consultant" });
    state.sessionEmail = "owner@example.test";
    const res = await checkout(
      new Request("http://localhost/api/plan/checkout?org=cmorg1", { headers: { "x-vercel-ip-country": "ES" } })
    );
    expect(res.status).toBe(409);
  });
});

describe("the caps lift for an organisation the payment moved", () => {
  it("is read-only and capped before, writable and uncapped after", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // Well past any pilot window (the fifteen-day one and the transition rule alike).
    vi.setSystemTime(new Date(PILOT_CLOCK_START.getTime() + 400 * DAY));
    const o = org("cmorg1");
    const full = new Proxy({}, { get: () => ({ count: async () => 1_000_000 }) }) as unknown as PilotDb;

    expect(() => assertPilotWritable(o)).toThrow();
    await expect(assertPilotCapacity(full, { id: o.id, plan: o.plan }, "dataAssets")).rejects.toMatchObject({
      code: "FORBIDDEN",
    } satisfies Partial<TRPCError>);

    await post(notice({ clientReferenceId: signOrgReference("cmorg1", SECRET) }));
    expect(o.plan).toBe("EU_CLOUD");
    expect(() => assertPilotWritable(o)).not.toThrow();
    await expect(assertPilotCapacity(full, { id: o.id, plan: o.plan }, "dataAssets")).resolves.toBeUndefined();

    await post(notice({ kind: "ended", periodEnd: null }));
    expect(() => assertPilotWritable(o)).toThrow();
  });
});

describe("GET /api/plan/checkout", () => {
  const get = (orgId = "cmorg1", headers: Record<string, string> = { "x-vercel-ip-country": "ES" }) =>
    checkout(new Request(`http://localhost/api/plan/checkout?org=${orgId}`, { headers }));
  const linkOf = (res: Response) => {
    const loc = new URL(res.headers.get("location")!);
    return `${loc.origin}${loc.pathname}`;
  };

  beforeEach(() => {
    org("cmorg1");
    state.members.push(
      { organizationId: "cmorg1", email: "owner@example.test", role: "OWNER" },
      { organizationId: "cmorg1", email: "member@example.test", role: "MEMBER" }
    );
  });

  it("is 404 while switched off, without a secret, or off the hosted service", async () => {
    state.sessionEmail = "owner@example.test";
    vi.stubEnv("AUTO_UPGRADE_ENABLED", "false");
    expect((await get()).status).toBe(404);
    on();
    vi.stubEnv("PLAN_SYNC_SECRET", "");
    expect((await get()).status).toBe(404);
    on();
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("AUTH_COOKIE_DOMAIN", "");
    expect((await get()).status).toBe(404);
  });

  it("is 401 without a session and 403 for a plain member or a stranger", async () => {
    expect((await get()).status).toBe(401);
    state.sessionEmail = "member@example.test";
    expect((await get()).status).toBe(403);
    state.sessionEmail = "stranger@example.test";
    expect((await get()).status).toBe(403);
  });

  it("is 409 for an organisation already on the paid plan", async () => {
    state.orgs.get("cmorg1")!.plan = "EU_CLOUD";
    state.sessionEmail = "owner@example.test";
    expect((await get()).status).toBe(409);
  });

  it("sends an owner to the payment link with the reference and the e-mail", async () => {
    state.sessionEmail = "owner@example.test";
    const res = await get();
    expect(res.status).toBe(303);
    const loc = new URL(res.headers.get("location")!);
    expect(`${loc.origin}${loc.pathname}`).toBe(EUR_LINK);
    expect(parseOrgReference(loc.searchParams.get("client_reference_id"), SECRET)).toEqual({
      kind: "valid",
      orgId: "cmorg1",
    });
    expect(loc.searchParams.get("prefilled_email")).toBe("owner@example.test");
  });

  it("sends a European visitor to the EUR link and a US visitor to the USD link", async () => {
    state.sessionEmail = "owner@example.test";
    expect(linkOf(await get("cmorg1", { "x-vercel-ip-country": "DE" }))).toBe(EUR_LINK);
    expect(linkOf(await get("cmorg1", { "x-vercel-ip-country": "US" }))).toBe(USD_LINK);
  });

  it("euros only for the 27 EU states: the UK, Switzerland, Norway and Latin America get USD", async () => {
    state.sessionEmail = "owner@example.test";
    for (const c of ["GB", "CH", "NO", "IS", "LI", "MX", "AR"]) {
      expect(linkOf(await get("cmorg1", { "x-vercel-ip-country": c }))).toBe(USD_LINK);
    }
    for (const c of ["ES", "IE", "GR", "SE"]) {
      expect(linkOf(await get("cmorg1", { "x-vercel-ip-country": c }))).toBe(EUR_LINK);
    }
    expect(linkOf(await get("cmorg1", { "accept-language": "en-GB,en;q=0.9" }))).toBe(USD_LINK);
  });

  it("without a country header, uses the Accept-Language region, then USD", async () => {
    state.sessionEmail = "owner@example.test";
    expect(linkOf(await get("cmorg1", { "accept-language": "es-ES,es;q=0.9" }))).toBe(EUR_LINK);
    expect(linkOf(await get("cmorg1", { "accept-language": "es" }))).toBe(USD_LINK);
    expect(linkOf(await get("cmorg1", {}))).toBe(USD_LINK);
  });

  it("is 404 when the link for the visitor's currency is not set", async () => {
    state.sessionEmail = "owner@example.test";
    vi.stubEnv("PLAN_CLOUD_USD_LINK", "");
    expect((await get("cmorg1", { "x-vercel-ip-country": "US" })).status).toBe(404);
    expect((await get("cmorg1", { "x-vercel-ip-country": "FR" })).status).toBe(303);
    vi.stubEnv("PLAN_CLOUD_EUR_LINK", "");
    expect((await get("cmorg1", { "x-vercel-ip-country": "FR" })).status).toBe(404);
  });
});

describe("whether the banner offers the upgrade (server side)", () => {
  const h = (o: Record<string, string>) => new Headers(o);
  it("needs the switch, the secret, the hosted service and the visitor's link", () => {
    expect(upgradeLinkFor(h({ "x-vercel-ip-country": "ES" }))).toBe(EUR_LINK);
    expect(upgradeLinkFor(h({ "x-vercel-ip-country": "US" }))).toBe(USD_LINK);
    vi.stubEnv("PLAN_CLOUD_USD_LINK", "");
    expect(upgradeLinkFor(h({ "x-vercel-ip-country": "US" }))).toBeNull();
    expect(upgradeLinkFor(h({ "x-vercel-ip-country": "ES" }))).toBe(EUR_LINK);
    vi.stubEnv("AUTO_UPGRADE_ENABLED", "");
    expect(upgradeLinkFor(h({ "x-vercel-ip-country": "ES" }))).toBeNull();
  });
});
