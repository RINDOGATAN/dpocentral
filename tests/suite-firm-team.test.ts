// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The firm team sent to AI Sentinel (src/lib/suite-firm-team.ts,
 * src/server/services/suite/firm-team-push.ts): the signed contract and its
 * own prefix, the full list sent after each change and by the hourly cron,
 * an empty list owed after the last removal retried until it is accepted,
 * nothing sent with the switch off, and a failed push never failing the
 * person's action.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const h = vi.hoisted(() => ({ db: null as unknown as Record<string, unknown> }));

vi.mock("@/lib/prisma", () => {
  const forward = new Proxy({}, { get: (_t, prop) => (h.db as Record<string | symbol, unknown>)[prop] });
  return { default: forward, prisma: forward };
});
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/server/services/dsar/defaultIntakeForm", () => ({ ensureDefaultIntakeForm: vi.fn() }));
vi.mock("@/server/services/members/invitation-email", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/services/members/invitation-email")>()),
  sendInvitationEmail: vi.fn(async () => true),
  invitationSignInUrl: () => "http://localhost/sign-in",
}));

import { signSuiteRequest, verifySuiteSignature } from "@/lib/suite-plan-state";
import {
  aiSentinelRoleFor,
  parseFirmTeamPush,
  signFirmTeamPush,
  suiteFirmTeamEnabled,
  verifyFirmTeamSignature,
} from "@/lib/suite-firm-team";
import {
  buildFirmTeamPush,
  firmTeamPeerUrl,
  pushAllFirmTeams,
  pushFirmTeam,
} from "@/server/services/suite/firm-team-push";
import { acceptFirmTeamInvitations } from "@/server/services/members/firm-team";
import { firmTeamRouter } from "@/server/routers/privacy/firmTeam";
import { organizationRouter } from "@/server/routers/privacy/organization";
import { GET as cron } from "@/app/api/cron/suite-sync/route";
import { addMember, addOrg, addUser, firmDb, type FirmDb } from "./helpers/firm-db";
import { callerFor, sessionFor } from "./helpers";

const SECRET = "test-shared-secret";
const ON = { SUITE_FIRM_TEAM: "on", PLAN_SYNC_SECRET: SECRET };
const T0 = Date.parse("2026-10-27T10:00:00Z");

let db: FirmDb;
const firm = (userId: string) =>
  callerFor(firmTeamRouter, sessionFor(userId)) as ReturnType<typeof firmTeamRouter.createCaller>;
const org = (userId: string) =>
  callerFor(organizationRouter, sessionFor(userId)) as ReturnType<typeof organizationRouter.createCaller>;

function okFetch(status = 200) {
  return vi.fn(async (_url: string, _init: { body: string; headers: Record<string, string> }) => ({
    ok: status >= 200 && status < 300,
    status,
  }));
}

beforeEach(() => {
  vi.unstubAllEnvs();
  db = firmDb();
  h.db = db as unknown as Record<string, unknown>;
  addUser(db, "a", { userType: "PRIVACY_PROFESSIONAL" });
  addUser(db, "b", { userType: "PRIVACY_PROFESSIONAL" });
  addUser(db, "staff");
  addOrg(db, "a1", "a");
  addOrg(db, "a2", "a");
  addOrg(db, "b1", "b");
  addOrg(db, "co", "b", { billingOwnerId: "b" });
  addMember(db, "co", "a", "OWNER"); // a co-owns b's organisation: not one of a's firm organisations
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("the signed contract", () => {
  const body = JSON.stringify({ version: 1 });
  const t = Math.floor(T0 / 1000);

  it("verifies its own signature and refuses an altered, expired or missing one", () => {
    const sig = signFirmTeamPush(SECRET, t, body);
    expect(verifyFirmTeamSignature(sig, body, SECRET, t)).toBe(true);
    expect(verifyFirmTeamSignature(sig, body + " ", SECRET, t)).toBe(false);
    expect(verifyFirmTeamSignature(sig, body, "other", t)).toBe(false);
    expect(verifyFirmTeamSignature(sig, body, SECRET, t + 301)).toBe(false);
    expect(verifyFirmTeamSignature(null, body, SECRET, t)).toBe(false);
  });

  it("a plan-state signature never verifies as a firm-team push, nor the reverse", () => {
    expect(verifyFirmTeamSignature(signSuiteRequest(SECRET, t, body), body, SECRET, t)).toBe(false);
    expect(verifySuiteSignature(signFirmTeamPush(SECRET, t, body), body, SECRET, t)).toBe(false);
  });

  it("is off unless SUITE_FIRM_TEAM is on and the secret is set", () => {
    expect(suiteFirmTeamEnabled({})).toBe(false);
    expect(suiteFirmTeamEnabled({ PLAN_SYNC_SECRET: SECRET })).toBe(false);
    expect(suiteFirmTeamEnabled({ SUITE_FIRM_TEAM: "on" })).toBe(false);
    expect(suiteFirmTeamEnabled({ SUITE_FIRM_TEAM: "off", PLAN_SYNC_SECRET: SECRET })).toBe(false);
    expect(suiteFirmTeamEnabled(ON)).toBe(true);
  });

  it("maps the roles and never maps OWNER", () => {
    expect(aiSentinelRoleFor("PRIVACY_OFFICER")).toBe("AI_OFFICER");
    expect(aiSentinelRoleFor("ADMIN")).toBe("ADMIN");
    expect(aiSentinelRoleFor("MEMBER")).toBe("MEMBER");
    expect(aiSentinelRoleFor("VIEWER")).toBe("VIEWER");
    expect(aiSentinelRoleFor("OWNER")).toBeNull();
  });

  it("parses a push field by field and refuses an OWNER role", () => {
    const base = {
      version: 1,
      sentAt: "2026-10-27T10:00:00.123Z",
      ownerEmail: "A@Test.example",
      firmOrganizationIds: ["a1", "a1", "a2"],
      members: [
        { email: "Staff@Test.example", role: "PRIVACY_OFFICER", state: "accepted" },
        { email: "staff@test.example", role: "VIEWER", state: "pending" },
        { email: "a@test.example", role: "ADMIN", state: "accepted" },
      ],
    };
    expect(parseFirmTeamPush(base)).toEqual({
      version: 1,
      sentAt: "2026-10-27T10:00:00.123Z",
      ownerEmail: "a@test.example",
      firmOrganizationIds: ["a1", "a2"],
      members: [{ email: "staff@test.example", role: "PRIVACY_OFFICER", state: "accepted" }],
    });
    expect(parseFirmTeamPush({ ...base, members: [{ email: "x@y.z", role: "OWNER", state: "accepted" }] })).toBeNull();
    expect(parseFirmTeamPush({ ...base, members: [{ email: "x@y.z", role: "MEMBER", state: "maybe" }] })).toBeNull();
    expect(parseFirmTeamPush({ ...base, version: 2 })).toBeNull();
    expect(parseFirmTeamPush({ ...base, sentAt: "yesterday" })).toBeNull();
    expect(parseFirmTeamPush({ ...base, ownerEmail: "nobody" })).toBeNull();
  });
});

describe("the list sent", () => {
  it("is the account's full list, with its firm organisations only", async () => {
    await firm("a").add({ email: "staff@test.example", role: "PRIVACY_OFFICER" });
    await firm("a").add({ email: "later@test.example", role: "VIEWER" });
    const push = await buildFirmTeamPush(db, "a", { now: () => T0 });
    expect(push).toEqual({
      version: 1,
      sentAt: new Date(T0).toISOString(),
      ownerEmail: "a@test.example",
      firmOrganizationIds: ["a1", "a2"],
      members: [
        { email: "staff@test.example", role: "PRIVACY_OFFICER", state: "accepted" },
        { email: "later@test.example", role: "VIEWER", state: "pending" },
      ],
    });
  });

  it("is nothing for an account without a firm team, unless an empty list is asked for", async () => {
    expect(await buildFirmTeamPush(db, "b")).toBeNull();
    expect(await buildFirmTeamPush(db, "b", { includeEmpty: true })).toMatchObject({ members: [] });
  });
});

describe("sending", () => {
  it("does nothing with the switch off", async () => {
    await firm("a").add({ email: "staff@test.example" });
    const f = okFetch();
    expect(await pushFirmTeam(db, "a", { env: { PLAN_SYNC_SECRET: SECRET }, fetch: f })).toBe("off");
    expect(await pushAllFirmTeams(db, { env: { PLAN_SYNC_SECRET: SECRET }, fetch: f })).toEqual({ owners: 0, sent: 0, failed: 0 });
    expect(f).not.toHaveBeenCalled();
  });

  it("signs the body with the firm-team prefix and posts it to AI Sentinel", async () => {
    await firm("a").add({ email: "staff@test.example" });
    const f = okFetch();
    expect(await pushFirmTeam(db, "a", { env: ON, fetch: f, now: () => T0 })).toBe("sent");
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://aisentinel.todo.law/api/suite/firm-team");
    expect(verifyFirmTeamSignature(init.headers["x-suite-signature"], init.body, SECRET, Math.floor(T0 / 1000))).toBe(true);
    expect(JSON.parse(init.body).members).toHaveLength(1);
    expect(firmTeamPeerUrl({ SUITE_PEER_URL: "http://localhost:3003/" })).toBe("http://localhost:3003/api/suite/firm-team");
  });

  it("never throws: a refusal or a network failure is only reported", async () => {
    await firm("a").add({ email: "staff@test.example" });
    expect(await pushFirmTeam(db, "a", { env: ON, fetch: okFetch(409) })).toBe("refused");
    expect(await pushFirmTeam(db, "a", { env: ON, fetch: okFetch(500) })).toBe("refused");
    const down = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    expect(await pushFirmTeam(db, "a", { env: ON, fetch: down })).toBe("failed");
  });

  it("the hourly push covers every account with a firm team", async () => {
    await firm("a").add({ email: "staff@test.example" });
    await firm("b").add({ email: "staff@test.example" });
    const f = okFetch();
    expect(await pushAllFirmTeams(db, { env: ON, fetch: f })).toEqual({ owners: 2, sent: 2, failed: 0 });
    expect(f.mock.calls.map(([, init]) => JSON.parse(init.body).ownerEmail).sort()).toEqual([
      "a@test.example",
      "b@test.example",
    ]);
  });
});

describe("pushed after every change (switch on)", () => {
  function stubFetch(status = 200) {
    const f = okFetch(status);
    vi.stubGlobal("fetch", f);
    return f;
  }
  const bodies = (f: ReturnType<typeof okFetch>) => f.mock.calls.map(([, init]) => JSON.parse(init.body));

  it("add, role change and remove each send the list; the last removal sends an empty one", async () => {
    vi.stubEnv("SUITE_FIRM_TEAM", "on");
    vi.stubEnv("PLAN_SYNC_SECRET", SECRET);
    const f = stubFetch();
    const added = await firm("a").add({ email: "staff@test.example", role: "MEMBER" });
    await vi.waitFor(() => expect(f).toHaveBeenCalledTimes(1));
    await firm("a").updateRole({ id: added.id, role: "ADMIN" });
    await vi.waitFor(() => expect(f).toHaveBeenCalledTimes(2));
    expect(bodies(f)[1].members).toEqual([{ email: "staff@test.example", role: "ADMIN", state: "accepted" }]);
    await firm("a").remove({ id: added.id });
    await vi.waitFor(() => expect(f).toHaveBeenCalledTimes(3));
    expect(bodies(f)[2]).toMatchObject({ ownerEmail: "a@test.example", members: [] });
  });

  it("a new firm organisation and an accepted invitation send the list", async () => {
    vi.stubEnv("SUITE_FIRM_TEAM", "on");
    vi.stubEnv("PLAN_SYNC_SECRET", SECRET);
    await firm("a").add({ email: "late@test.example" });
    const f = stubFetch();
    const created = await org("a").create({ name: "Client three", slug: "client-three" });
    await vi.waitFor(() => expect(f).toHaveBeenCalledTimes(1));
    expect(bodies(f)[0].firmOrganizationIds).toContain(created.id);
    addUser(db, "late");
    const pushed: string[] = [];
    await acceptFirmTeamInvitations(db, "late", "late@test.example", { onAccepted: (o) => pushed.push(o) });
    expect(pushed).toEqual(["a"]);
  });

  it("an account without a firm team sends nothing when it creates an organisation", async () => {
    vi.stubEnv("SUITE_FIRM_TEAM", "on");
    vi.stubEnv("PLAN_SYNC_SECRET", SECRET);
    const f = stubFetch();
    await org("b").create({ name: "B two", slug: "b-two" });
    await new Promise((r) => setTimeout(r, 20));
    expect(f).not.toHaveBeenCalled();
  });

  it("with the switch off nothing is sent, and a failing peer never fails the action", async () => {
    const f = stubFetch();
    await firm("a").add({ email: "staff@test.example" });
    await new Promise((r) => setTimeout(r, 20));
    expect(f).not.toHaveBeenCalled();

    vi.stubEnv("SUITE_FIRM_TEAM", "on");
    vi.stubEnv("PLAN_SYNC_SECRET", SECRET);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("down");
      })
    );
    await expect(firm("a").add({ email: "other@test.example" })).resolves.toMatchObject({ pending: true });
  });
});

describe("an empty list owed", () => {
  it("is recorded when the last person is removed, retried hourly while it fails, and cleared once accepted", async () => {
    vi.stubEnv("SUITE_FIRM_TEAM", "on");
    vi.stubEnv("PLAN_SYNC_SECRET", SECRET);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("down");
      })
    );
    const one = await firm("a").add({ email: "one@test.example" });
    const two = await firm("a").add({ email: "two@test.example" });
    await firm("a").remove({ id: one.id });
    expect(db.tables.firmTeamPushOwed).toHaveLength(0); // someone is left: the full list is still found hourly
    await firm("a").remove({ id: two.id });
    expect(db.tables.firmTeamPushOwed.map((r) => r.ownerUserId)).toEqual(["a"]);
    await new Promise((r) => setTimeout(r, 20));

    const down = vi.fn(async () => {
      throw new Error("down");
    });
    expect(await pushAllFirmTeams(db, { env: ON, fetch: down })).toEqual({ owners: 1, sent: 0, failed: 1 });
    expect(db.tables.firmTeamPushOwed).toHaveLength(1);

    const f = okFetch();
    expect(await pushAllFirmTeams(db, { env: ON, fetch: f })).toEqual({ owners: 1, sent: 1, failed: 0 });
    expect(JSON.parse(f.mock.calls[0][1].body)).toMatchObject({ ownerEmail: "a@test.example", members: [] });
    expect(db.tables.firmTeamPushOwed).toHaveLength(0);
    expect(await pushAllFirmTeams(db, { env: ON, fetch: f })).toEqual({ owners: 0, sent: 0, failed: 0 });
  });

  it("is cleared by a newer push (409) or a later full list, and kept on any other refusal", async () => {
    db.tables.firmTeamPushOwed.push({ ownerUserId: "a", owedAt: new Date() });
    expect(await pushFirmTeam(db, "a", { env: ON, fetch: okFetch(500), includeEmpty: true })).toBe("refused");
    expect(db.tables.firmTeamPushOwed).toHaveLength(1);
    expect(await pushFirmTeam(db, "a", { env: ON, fetch: okFetch(409), includeEmpty: true })).toBe("refused");
    expect(db.tables.firmTeamPushOwed).toHaveLength(0);

    db.tables.firmTeamPushOwed.push({ ownerUserId: "a", owedAt: new Date() });
    await firm("a").add({ email: "back@test.example" });
    const f = okFetch();
    expect(await pushAllFirmTeams(db, { env: ON, fetch: f })).toEqual({ owners: 1, sent: 1, failed: 0 });
    expect(JSON.parse(f.mock.calls[0][1].body).members).toHaveLength(1);
    expect(db.tables.firmTeamPushOwed).toHaveLength(0);
  });

  it("is not recorded with the switch off", async () => {
    const added = await firm("a").add({ email: "staff@test.example" });
    await firm("a").remove({ id: added.id });
    expect(db.tables.firmTeamPushOwed).toHaveLength(0);
  });
});

describe("the hourly cron", () => {
  it("pushes every firm team, even when the AI Sentinel link sync is not configured", async () => {
    vi.stubEnv("CRON_SECRET", "cron");
    vi.stubEnv("SUITE_FIRM_TEAM", "on");
    vi.stubEnv("PLAN_SYNC_SECRET", SECRET);
    await firm("a").add({ email: "staff@test.example" });
    const f = okFetch();
    vi.stubGlobal("fetch", f);
    await new Promise((r) => setTimeout(r, 20));
    f.mockClear();
    const res = await cron(new Request("http://x/api/cron/suite-sync", { headers: { authorization: "Bearer cron" } }));
    const json = await res.json();
    expect(json.firmTeams).toEqual({ owners: 1, sent: 1, failed: 0 });
    expect(f).toHaveBeenCalledTimes(1);
  });
});
