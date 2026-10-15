// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * One plan, one pilot window and one set of pilot allowances per paying
 * customer (services/pilot/umbrella.ts): the organisations an account creates
 * share them. Runs on an in-memory stand-in; no database.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import {
  assertPilotCapacity,
  countDpiaCreated,
  getPilotStatus,
  hasPilotRoom,
  isPilotReadOnly,
  PILOT_CLOCK_START,
  PILOT_DAYS,
  PILOT_LIMITS,
  pilotEndsAt,
  recordPilotFirstSignIn,
  type PilotDb,
} from "@/server/services/pilot/caps";
import { groupOrganizationIds, groupWhere, inheritedGroupState } from "@/server/services/pilot/umbrella";
import { setOrganizationPlan } from "@/server/services/pilot/plan";

const DAY = 24 * 60 * 60 * 1000;
const T0 = new Date(PILOT_CLOCK_START.getTime() + 40 * DAY);

type Org = {
  id: string;
  slug: string;
  name: string;
  billingOwnerId: string | null;
  plan: "PILOT" | "EU_CLOUD";
  planStartedAt: Date | null;
  planRenewsAt: Date | null;
  planNote: string | null;
  planStripeSubscriptionId: string | null;
  pilotStartedAt: Date | null;
};

let orgs: Map<string, Org>;
/** Records per organisation, by model name. */
let records: Record<string, Record<string, number>>;
let members: { organizationId: string; userId: string }[];
let audits: { organizationId: string; action: string }[];

function org(id: string, extra: Partial<Org> = {}): Org {
  const o: Org = {
    id,
    slug: id,
    name: id,
    billingOwnerId: "consultant",
    plan: "PILOT",
    planStartedAt: null,
    planRenewsAt: null,
    planNote: null,
    planStripeSubscriptionId: null,
    pilotStartedAt: null,
    ...extra,
  };
  orgs.set(id, o);
  return o;
}

type Where = Record<string, unknown>;

function matches(o: Org, where: Where): boolean {
  for (const [k, v] of Object.entries(where)) {
    const value = (o as unknown as Record<string, unknown>)[k];
    if (v && typeof v === "object" && !(v instanceof Date)) {
      if ("not" in v && (v as { not: unknown }).not === null) {
        if (value === null) return false;
        continue;
      }
      if ("in" in v) {
        if (!(v as { in: unknown[] }).in.includes(value)) return false;
        continue;
      }
    }
    if (value !== v) return false;
  }
  return true;
}

const pick = (o: Org, select?: Record<string, true>) =>
  select ? Object.fromEntries(Object.keys(select).map((k) => [k, (o as unknown as Record<string, unknown>)[k]])) : { ...o };

function scopeIds(where: Where): string[] {
  const s = where.organizationId as string | { in: string[] };
  return typeof s === "string" ? [s] : s.in;
}

const counter = (model: string) => ({
  count: async ({ where }: { where: Where }) => {
    const scope = model === "vendorContract" ? (where.vendor as Where) : where;
    return scopeIds(scope).reduce((n, id) => n + (records[model]?.[id] ?? 0), 0);
  },
});

const db = {
  organization: {
    findUnique: async ({ where, select }: { where: { id: string }; select?: Record<string, true> }) => {
      const o = orgs.get(where.id);
      return o ? pick(o, select) : null;
    },
    findMany: async ({ where, select }: { where: Where; select?: Record<string, true> }) =>
      [...orgs.values()].filter((o) => matches(o, where)).map((o) => pick(o, select)),
    findFirst: async ({ where, select }: { where: Where; select?: Record<string, true> }) => {
      const rows = [...orgs.values()]
        .filter((o) => matches(o, where))
        .sort((a, b) => (a.pilotStartedAt?.getTime() ?? 0) - (b.pilotStartedAt?.getTime() ?? 0));
      return rows[0] ? pick(rows[0], select) : null;
    },
    updateMany: async ({ where, data }: { where: Where; data: Partial<Org> }) => {
      let count = 0;
      for (const o of orgs.values()) {
        if (matches(o, where)) {
          Object.assign(o, data);
          count++;
        }
      }
      return { count };
    },
  },
  organizationMember: {
    count: async ({ where }: { where: Where }) =>
      members.filter((m) => scopeIds(where).includes(m.organizationId)).length,
    findMany: async ({ where }: { where: Where }) => [
      ...new Map(
        members.filter((m) => scopeIds(where).includes(m.organizationId)).map((m) => [m.userId, { userId: m.userId }])
      ).values(),
    ],
  },
  dataAsset: counter("dataAsset"),
  dataElement: counter("dataElement"),
  processingActivity: counter("processingActivity"),
  dataFlow: counter("dataFlow"),
  dataTransfer: counter("dataTransfer"),
  vendor: counter("vendor"),
  vendorContract: counter("vendorContract"),
  dSARRequest: counter("dSARRequest"),
  assessment: counter("assessment"),
  assessmentTemplate: counter("assessmentTemplate"),
  incident: counter("incident"),
  aISystem: counter("aISystem"),
  auditLog: {
    count: async ({ where }: { where: Where }) =>
      scopeIds(where).reduce((n, id) => n + (records.dpiaLogged?.[id] ?? 0), 0),
  },
};

const pilotDb = db as unknown as PilotDb;

beforeEach(() => {
  orgs = new Map();
  records = {};
  members = [];
  audits = [];
  vi.stubEnv("VERCEL_ENV", "production");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

/** What organization.create writes for the account's next organisation. */
async function createFor(userId: string, id: string): Promise<Org> {
  const group = inheritedGroupState(
    (await db.organization.findMany({
      where: { billingOwnerId: userId },
      select: { plan: true, planStartedAt: true, planRenewsAt: true, planStripeSubscriptionId: true, pilotStartedAt: true },
    })) as unknown as Parameters<typeof inheritedGroupState>[0]
  );
  const o = org(id, { billingOwnerId: userId, ...(group as Partial<Org> | null) });
  members.push({ organizationId: id, userId });
  return o;
}

async function signIn(o: Org) {
  await recordPilotFirstSignIn(db as never, o);
}

describe("one pilot window per customer", () => {
  it("the second and the fifth organisation inherit the first's end date", async () => {
    const first = await createFor("consultant", "org-1");
    await signIn(first);
    const end = pilotEndsAt(first)!;
    expect(end.getTime()).toBe(T0.getTime() + PILOT_DAYS * DAY);

    vi.setSystemTime(new Date(T0.getTime() + 3 * DAY));
    const second = await createFor("consultant", "org-2");
    await signIn(second);
    expect(pilotEndsAt(second)).toEqual(end);

    vi.setSystemTime(new Date(T0.getTime() + 9 * DAY));
    for (const id of ["org-3", "org-4", "org-5"]) await signIn(await createFor("consultant", id));
    expect(pilotEndsAt(orgs.get("org-5")!)).toEqual(end);
  });

  it("creating an organisation late does not extend or restart the window", async () => {
    const first = await createFor("consultant", "org-1");
    await signIn(first);
    vi.setSystemTime(new Date(T0.getTime() + (PILOT_DAYS + 2) * DAY));
    const late = await createFor("consultant", "org-late");
    await signIn(late);
    expect(late.pilotStartedAt).toEqual(T0);
    expect(isPilotReadOnly(late)).toBe(true);
  });

  it("a first sign-in in any organisation starts the window for all of them", async () => {
    const a = await createFor("consultant", "org-1");
    const b = await createFor("consultant", "org-2");
    expect(a.pilotStartedAt).toBeNull();
    await signIn(b);
    expect(a.pilotStartedAt).toEqual(T0);
    expect(b.pilotStartedAt).toEqual(T0);
  });

  it("takes an earlier start already recorded in the group, never a fresh one", async () => {
    org("org-1", { pilotStartedAt: T0 });
    const stray = org("org-2", { pilotStartedAt: null });
    vi.setSystemTime(new Date(T0.getTime() + 5 * DAY));
    await signIn(stray);
    expect(stray.pilotStartedAt).toEqual(T0);
  });

  it("another account's organisations keep their own window", async () => {
    await signIn(await createFor("consultant", "org-1"));
    vi.setSystemTime(new Date(T0.getTime() + 4 * DAY));
    const other = await createFor("another-firm", "org-x");
    await signIn(other);
    expect(other.pilotStartedAt).toEqual(new Date(T0.getTime() + 4 * DAY));
  });
});

describe("shared allowances", () => {
  it("counts the record ceilings over the whole group", async () => {
    await createFor("consultant", "org-1");
    const b = await createFor("consultant", "org-2");
    records.dataAsset = { "org-1": PILOT_LIMITS.dataAssets - 1 };
    await expect(assertPilotCapacity(pilotDb, b, "dataAssets")).resolves.toBeUndefined();
    records.dataAsset["org-1"] = PILOT_LIMITS.dataAssets;
    expect(await hasPilotRoom(pilotDb, "org-2", "dataAssets")).toBe(false);
    await expect(assertPilotCapacity(pilotDb, b, "dataAssets")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(assertPilotCapacity(pilotDb, b, "dataAssets")).rejects.toThrow(
      /counted across all the organizations of the same account/
    );
  });

  it("counts a person in several organisations of the group once", async () => {
    const a = await createFor("consultant", "org-1");
    await createFor("consultant", "org-2");
    members.push({ organizationId: "org-1", userId: "staff-1" }, { organizationId: "org-2", userId: "staff-1" });
    const status = await getPilotStatus(pilotDb, a);
    expect(status).toMatchObject({ organizations: 2 });
    const people = (status as { usage: { resource: string; used: number }[] }).usage.find(
      (u) => u.resource === "members"
    );
    expect(people?.used).toBe(2);
  });

  it("counts the two free DPIAs over the whole group", async () => {
    await createFor("consultant", "org-1");
    await createFor("consultant", "org-2");
    records.assessment = { "org-1": 1 };
    records.dpiaLogged = { "org-1": 1, "org-2": 1 };
    expect(await countDpiaCreated(db as never, "org-2")).toBe(2);
  });

  it("shows the same shared counts from every organisation of the group", async () => {
    const a = await createFor("consultant", "org-1");
    const b = await createFor("consultant", "org-2");
    records.vendor = { "org-1": 3, "org-2": 4 };
    const sa = await getPilotStatus(pilotDb, a);
    const sb = await getPilotStatus(pilotDb, b);
    expect(sa).toEqual(sb);
    expect((sa as { usage: { resource: string; used: number }[] }).usage.find((u) => u.resource === "vendors")?.used).toBe(7);
  });

  it("an organisation without a billing owner stands alone", async () => {
    const lone = org("lone", { billingOwnerId: null });
    org("org-1");
    records.dataAsset = { "org-1": 20, lone: 2 };
    expect(await groupOrganizationIds(db as never, lone)).toEqual(["lone"]);
    expect(groupWhere(lone)).toEqual({ id: "lone" });
  });
});

describe("one plan per customer", () => {
  it("a new organisation of a paying customer starts on the paid plan", async () => {
    const renews = new Date(T0.getTime() + 300 * DAY);
    org("org-1", {
      plan: "EU_CLOUD",
      planStartedAt: T0,
      planRenewsAt: renews,
      planStripeSubscriptionId: "sub_A",
      pilotStartedAt: T0,
    });
    const next = await createFor("consultant", "org-2");
    expect(next).toMatchObject({ plan: "EU_CLOUD", planRenewsAt: renews, planStripeSubscriptionId: "sub_A" });
    expect(isPilotReadOnly(next, new Date(T0.getTime() + 100 * DAY))).toBe(false);
  });

  it("the operator's plan change applies to the whole group", async () => {
    org("org-1");
    org("org-2");
    org("other", { billingOwnerId: "another-firm" });
    const writes: string[] = [];
    const planDb = {
      organization: {
        findFirst: async ({ where }: { where: { OR: { id?: string; slug?: string }[] } }) => {
          const key = where.OR[0].id;
          const o = [...orgs.values()].find((r) => r.id === key || r.slug === key);
          return o ? { ...o } : null;
        },
        findMany: db.organization.findMany,
      },
      $transaction: async (fn: (tx: unknown) => Promise<void>) =>
        fn({
          organization: {
            update: async ({ where, data }: { where: { id: string }; data: Partial<Org> }) => {
              writes.push(where.id);
              Object.assign(orgs.get(where.id)!, data);
            },
          },
          auditLog: { create: async ({ data }: { data: { organizationId: string; action: string } }) => audits.push(data) },
        }),
    };
    const result = await setOrganizationPlan(planDb as never, {
      org: "org-1",
      plan: "EU_CLOUD",
      note: "invoice 1",
      operator: "test",
      dryRun: false,
    });
    expect(result).toMatchObject({ changed: true, written: true, groupChanged: 1 });
    expect(writes.sort()).toEqual(["org-1", "org-2"]);
    expect(orgs.get("org-2")).toMatchObject({ plan: "EU_CLOUD", planNote: null });
    expect(orgs.get("org-1")!.planNote).toBe("invoice 1");
    expect(orgs.get("other")!.plan).toBe("PILOT");
    expect(audits.map((a) => a.organizationId).sort()).toEqual(["org-1", "org-2"]);
  });
});

describe("inheritedGroupState", () => {
  it("is null for an account's first organisation", () => {
    expect(inheritedGroupState([])).toBeNull();
  });

  it("takes the earliest pilot start and the paid plan with the latest renewal", () => {
    const base = { planStartedAt: null, planRenewsAt: null, planStripeSubscriptionId: null };
    const later = new Date(T0.getTime() + 2 * DAY);
    const s = inheritedGroupState([
      { ...base, plan: "PILOT", pilotStartedAt: later },
      { ...base, plan: "EU_CLOUD", planRenewsAt: new Date(T0.getTime() + 10 * DAY), planStripeSubscriptionId: "sub_1", pilotStartedAt: T0 },
      { ...base, plan: "EU_CLOUD", planRenewsAt: new Date(T0.getTime() + 20 * DAY), planStripeSubscriptionId: "sub_2", pilotStartedAt: null },
    ]);
    expect(s).toMatchObject({ plan: "EU_CLOUD", planStripeSubscriptionId: "sub_2", pilotStartedAt: T0 });
  });

  it("prefers an open-ended paid plan (no renewal date) over a dated one", () => {
    const base = { planStartedAt: T0, pilotStartedAt: null };
    const s = inheritedGroupState([
      { ...base, plan: "EU_CLOUD", planRenewsAt: new Date(T0.getTime() + 20 * DAY), planStripeSubscriptionId: "sub_1" },
      { ...base, plan: "EU_CLOUD", planRenewsAt: null, planStripeSubscriptionId: null },
    ]);
    expect(s).toMatchObject({ plan: "EU_CLOUD", planRenewsAt: null, planStripeSubscriptionId: null });
  });
});
