// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The rights-request volume upgrade switched on and off by its payment
 * (src/server/services/dsar/volume-sync.ts, POST /api/plan/dsar-volume-sync):
 *
 *  - refusals: switch off, no secret, bad or stale signature, malformed body;
 *  - "paid" by the signed upgrade reference, by renewal, by the payer's
 *    e-mail (one organisation only), and the cases that change nothing;
 *  - "ended" back to the standard ceiling, the renewal date kept;
 *  - one audit entry per change, none for a repeated notice;
 *  - a plan reference never upgrades, and the upgrade never touches the plan.
 *
 * The database is an in-memory stand-in.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type Org = {
  id: string;
  plan: string;
  dsarModuleStatus: "NONE" | "ACTIVE" | "CANCELLED" | null;
  dsarModuleSubscriptionId: string | null;
  dsarModuleRenewsAt: Date | null;
};
type Member = { organizationId: string; email: string; role: "OWNER" | "ADMIN" | "MEMBER" };

const state = vi.hoisted(() => ({
  orgs: new Map<string, Org>(),
  members: [] as Member[],
  audits: [] as Record<string, unknown>[],
  failNextUpdate: false,
}));

const fakeDb = vi.hoisted(() => {
  const pick = (o: Org) => ({
    id: o.id,
    dsarModuleStatus: o.dsarModuleStatus,
    dsarModuleSubscriptionId: o.dsarModuleSubscriptionId,
    dsarModuleRenewsAt: o.dsarModuleRenewsAt,
  });
  const tx = {
    organization: {
      update: async ({ where, data }: { where: { id: string }; data: Partial<Org> }) => {
        if (state.failNextUpdate) {
          state.failNextUpdate = false;
          throw new Error("database down");
        }
        const o = state.orgs.get(where.id)!;
        Object.assign(o, data);
        return o;
      },
    },
    auditLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        state.audits.push(data);
        return data;
      },
    },
  };
  return {
    organization: {
      findMany: async ({ where }: { where: { dsarModuleSubscriptionId: string } }) =>
        [...state.orgs.values()].filter((o) => o.dsarModuleSubscriptionId === where.dsarModuleSubscriptionId).map(pick),
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
            (m) => where.role.in.includes(m.role) && m.email.toLowerCase() === where.user.email.equals.toLowerCase()
          )
          .map((m) => ({ organizationId: m.organizationId })),
    },
    $transaction: async <T,>(fn: (t: typeof tx) => Promise<T>) => fn(tx),
  };
});

vi.mock("@/lib/prisma", () => ({ default: fakeDb, prisma: fakeDb }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { signOrgReference, signSyncBody } from "@/lib/plan-upgrade";
import { POST as sync } from "@/app/api/plan/dsar-volume-sync/route";
import { DSAR_VOLUME_APP_CODE } from "@/server/services/dsar/volume-sync";

const SECRET = "test-plan-sync-secret";
const PERIOD_END = "2026-11-25T10:00:00.000Z";
const NEXT_END = "2026-12-25T10:00:00.000Z";

function org(id: string, extra: Partial<Org> = {}): Org {
  const o: Org = {
    id,
    plan: "PILOT",
    dsarModuleStatus: null,
    dsarModuleSubscriptionId: null,
    dsarModuleRenewsAt: null,
    ...extra,
  };
  state.orgs.set(id, o);
  return o;
}

const ref = (orgId: string) => signOrgReference(orgId, SECRET, DSAR_VOLUME_APP_CODE);

function notice(extra: Record<string, unknown> = {}) {
  return {
    version: 1,
    eventId: "evt_1",
    eventType: "checkout.session.completed",
    kind: "paid",
    subscriptionId: "sub_D",
    customerEmail: "owner@example.test",
    clientReferenceId: null,
    periodEnd: PERIOD_END,
    livemode: false,
    ...extra,
  };
}

function post(body: unknown, opts: { secret?: string; t?: number; header?: string | null } = {}) {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  const header = opts.header !== undefined ? opts.header : signSyncBody(raw, opts.secret ?? SECRET, opts.t);
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (header !== null) headers["x-plan-sync-signature"] = header;
  return sync(new Request("http://localhost/api/plan/dsar-volume-sync", { method: "POST", body: raw, headers }));
}

async function results(res: Response) {
  expect(res.status).toBe(200);
  return ((await res.json()) as { results: Record<string, unknown>[] }).results;
}

beforeEach(() => {
  state.orgs.clear();
  state.members = [];
  state.audits = [];
  state.failNextUpdate = false;
  vi.stubEnv("AUTO_UPGRADE_ENABLED", "true");
  vi.stubEnv("PLAN_SYNC_SECRET", SECRET);
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/plan/dsar-volume-sync: refusals", () => {
  it("answers 503 while switched off or without a secret, and writes nothing", async () => {
    org("orgA", {});
    vi.stubEnv("AUTO_UPGRADE_ENABLED", "false");
    expect((await post(notice({ clientReferenceId: ref("orgA") }))).status).toBe(503);
    vi.stubEnv("AUTO_UPGRADE_ENABLED", "true");
    vi.stubEnv("PLAN_SYNC_SECRET", "");
    expect((await post(notice({ clientReferenceId: ref("orgA") }))).status).toBe(503);
    expect(state.orgs.get("orgA")!.dsarModuleStatus).toBeNull();
  });

  it("answers 401 for a missing, wrong or stale signature", async () => {
    org("orgA");
    const body = notice({ clientReferenceId: ref("orgA") });
    expect((await post(body, { header: null })).status).toBe(401);
    expect((await post(body, { secret: "wrong" })).status).toBe(401);
    expect((await post(body, { t: Math.floor(Date.now() / 1000) - 600 })).status).toBe(401);
    expect(state.audits).toHaveLength(0);
  });

  it("answers 400 for a malformed notice", async () => {
    expect((await post("not json")).status).toBe(400);
    expect((await post(notice({ kind: "refunded" }))).status).toBe(400);
    expect((await post(notice({ version: 2 }))).status).toBe(400);
  });

  it("answers 500 on a database failure, so Stripe retries", async () => {
    org("orgA");
    state.failNextUpdate = true;
    expect((await post(notice({ clientReferenceId: ref("orgA") }))).status).toBe(500);
    // The retry succeeds.
    await results(await post(notice({ clientReferenceId: ref("orgA") })));
    expect(state.orgs.get("orgA")!.dsarModuleStatus).toBe("ACTIVE");
  });
});

describe("POST /api/plan/dsar-volume-sync: payment", () => {
  it("switches the upgrade on for the organisation of the signed reference, with one audit entry", async () => {
    org("orgA");
    org("orgB");
    const r = await results(await post(notice({ clientReferenceId: ref("orgA") })));
    expect(r).toEqual([{ organizationId: "orgA", rule: "reference", changed: true }]);
    expect(state.orgs.get("orgA")).toMatchObject({
      dsarModuleStatus: "ACTIVE",
      dsarModuleSubscriptionId: "sub_D",
      dsarModuleRenewsAt: new Date(PERIOD_END),
      plan: "PILOT",
    });
    expect(state.orgs.get("orgB")!.dsarModuleStatus).toBeNull();
    expect(state.audits).toHaveLength(1);
    expect(state.audits[0]).toMatchObject({
      organizationId: "orgA",
      action: "DSAR_MODULE_CHANGE",
      changes: { before: { status: null }, after: { status: "ACTIVE", renewsAt: PERIOD_END }, subscriptionIdChanged: true },
      metadata: { source: "stripe-auto-upgrade", eventId: "evt_1", rule: "reference" },
    });
  });

  it("is idempotent: the same notice twice writes once", async () => {
    org("orgA");
    await post(notice({ clientReferenceId: ref("orgA") }));
    const r = await results(await post(notice({ clientReferenceId: ref("orgA") })));
    expect(r).toEqual([{ organizationId: "orgA", rule: "subscription", changed: false }]);
    expect(state.audits).toHaveLength(1);
  });

  it("brings the renewal date up to date on a renewal", async () => {
    org("orgA", { dsarModuleStatus: "ACTIVE", dsarModuleSubscriptionId: "sub_D", dsarModuleRenewsAt: new Date(PERIOD_END) });
    const r = await results(await post(notice({ eventType: "invoice.paid", periodEnd: NEXT_END, clientReferenceId: null })));
    expect(r).toEqual([{ organizationId: "orgA", rule: "subscription", changed: true }]);
    expect(state.orgs.get("orgA")!.dsarModuleRenewsAt).toEqual(new Date(NEXT_END));
  });

  it("reactivates a cancelled upgrade bought again", async () => {
    org("orgA", { dsarModuleStatus: "CANCELLED", dsarModuleSubscriptionId: "sub_OLD" });
    await results(await post(notice({ clientReferenceId: ref("orgA") })));
    expect(state.orgs.get("orgA")).toMatchObject({ dsarModuleStatus: "ACTIVE", dsarModuleSubscriptionId: "sub_D" });
  });

  it("leaves an organisation already upgraded under another subscription as it is", async () => {
    org("orgA", { dsarModuleStatus: "ACTIVE", dsarModuleSubscriptionId: "sub_OTHER" });
    const r = await results(await post(notice({ clientReferenceId: ref("orgA") })));
    expect(r).toEqual([
      { organizationId: "orgA", rule: "reference", changed: false, reason: "already-upgraded-other-subscription" },
    ]);
    expect(state.orgs.get("orgA")!.dsarModuleSubscriptionId).toBe("sub_OTHER");
  });

  it("never takes a plan reference, or a tampered one, as an upgrade reference", async () => {
    org("orgA");
    const plan = signOrgReference("orgA", SECRET);
    const r1 = await results(await post(notice({ clientReferenceId: plan, customerEmail: null })));
    expect(r1).toEqual([{ organizationId: null, rule: null, changed: false, reason: "no-account" }]);
    const tampered = ref("orgA").replace("orgA", "orgB");
    org("orgB");
    const r2 = await results(await post(notice({ clientReferenceId: tampered, customerEmail: null })));
    expect(r2[0]).toMatchObject({ changed: false, reason: "no-account" });
    expect(state.audits).toHaveLength(0);
  });

  it("falls back to the payer's e-mail when they own or administer exactly one organisation", async () => {
    org("orgA");
    state.members = [{ organizationId: "orgA", email: "Owner@Example.test", role: "ADMIN" }];
    const r = await results(await post(notice()));
    expect(r).toEqual([{ organizationId: "orgA", rule: "email", changed: true }]);
  });

  it("changes nothing when the e-mail points to several organisations, to none, or to a plain member", async () => {
    org("orgA");
    org("orgB");
    state.members = [
      { organizationId: "orgA", email: "owner@example.test", role: "OWNER" },
      { organizationId: "orgB", email: "owner@example.test", role: "OWNER" },
    ];
    expect((await results(await post(notice())))[0]).toMatchObject({ reason: "several-organisations" });
    state.members = [{ organizationId: "orgA", email: "owner@example.test", role: "MEMBER" }];
    expect((await results(await post(notice())))[0]).toMatchObject({ reason: "no-account" });
    state.members = [];
    expect((await results(await post(notice())))[0]).toMatchObject({ reason: "no-account" });
    expect(state.audits).toHaveLength(0);
  });
});

describe("POST /api/plan/dsar-volume-sync: the end of the subscription", () => {
  it("goes back to the standard ceiling and keeps the renewal date", async () => {
    org("orgA", { dsarModuleStatus: "ACTIVE", dsarModuleSubscriptionId: "sub_D", dsarModuleRenewsAt: new Date(PERIOD_END) });
    const r = await results(
      await post(notice({ kind: "ended", eventType: "customer.subscription.deleted", periodEnd: null }))
    );
    expect(r).toEqual([{ organizationId: "orgA", rule: "subscription", changed: true }]);
    expect(state.orgs.get("orgA")).toMatchObject({
      dsarModuleStatus: "CANCELLED",
      dsarModuleSubscriptionId: "sub_D",
      dsarModuleRenewsAt: new Date(PERIOD_END),
    });
    // Repeated: nothing more.
    const again = await results(await post(notice({ kind: "ended", periodEnd: null })));
    expect(again[0]).toMatchObject({ changed: false, reason: "not-active" });
    expect(state.audits).toHaveLength(1);
  });

  it("reports an end that matches no organisation", async () => {
    const r = await results(await post(notice({ kind: "ended", periodEnd: null })));
    expect(r).toEqual([{ organizationId: null, rule: null, changed: false, reason: "no-organisation-for-subscription" }]);
  });

  it("never touches an upgrade set by an operator under another subscription", async () => {
    org("orgA", { dsarModuleStatus: "ACTIVE", dsarModuleSubscriptionId: null });
    await results(await post(notice({ kind: "ended", periodEnd: null })));
    expect(state.orgs.get("orgA")!.dsarModuleStatus).toBe("ACTIVE");
  });
});
