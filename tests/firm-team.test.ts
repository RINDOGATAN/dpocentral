// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The firm team (src/server/services/members/firm-team.ts, the firmTeam
 * router, and the firm-team rules in organization.create / updateMember /
 * removeMember), run end to end over an in-memory database
 * (tests/helpers/firm-db.ts) through the real routers and middleware.
 *
 * Fixture: consultant A (privacy professional) owns and pays for clients a1
 * and a2. Consultant B owns b1, and made A a co-owner of b1's sibling b2 (B
 * pays for it). A created a3 but has since been demoted to ADMIN there.
 * Only a1 and a2 are A's firm organisations.
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

import { readFileSync } from "node:fs";
import path from "node:path";
import { firmTeamRouter } from "@/server/routers/privacy/firmTeam";
import { organizationRouter } from "@/server/routers/privacy/organization";
import {
  acceptFirmTeamInvitations,
  addFirmTeamToOrganization,
  firmOrganizations,
  syncFirmMember,
} from "@/server/services/members/firm-team";
import { invitationCopy } from "@/server/services/members/invitation-email";
import { splitFirmMembers } from "@/lib/members-card-copy";
import { addMember, addOrg, addUser, firmDb, membershipsOf, type FirmDb } from "./helpers/firm-db";
import { callerFor, sessionFor } from "./helpers";

let db: FirmDb;

const firm = (userId: string) =>
  callerFor(firmTeamRouter, sessionFor(userId)) as ReturnType<typeof firmTeamRouter.createCaller>;
const org = (userId: string, cookies: Record<string, string> = {}) =>
  callerFor(organizationRouter, sessionFor(userId), cookies) as ReturnType<typeof organizationRouter.createCaller>;

function seed() {
  db = firmDb();
  h.db = db as unknown as Record<string, unknown>;
  addUser(db, "a", { userType: "PRIVACY_PROFESSIONAL", name: "Consultant A" });
  addUser(db, "b", { userType: "PRIVACY_PROFESSIONAL", name: "Consultant B" });
  addUser(db, "staff"); // a person in A's firm
  addUser(db, "client-admin");
  addUser(db, "client-member");
  addUser(db, "biz", { userType: "BUSINESS_OWNER" });
  addOrg(db, "a1", "a");
  addOrg(db, "a2", "a");
  addOrg(db, "b1", "b");
  addOrg(db, "b2", "b");
  addMember(db, "b2", "a", "OWNER"); // A is a co-owner of an organisation B pays for
  addOrg(db, "a3", "a");
  db.tables.organizationMember.find((m) => m.organizationId === "a3" && m.userId === "a")!.role = "ADMIN";
  addMember(db, "a3", "b", "OWNER");
  addMember(db, "a1", "client-admin", "ADMIN");
  addMember(db, "a1", "client-member", "MEMBER");
}

beforeEach(() => {
  vi.unstubAllEnvs();
  seed();
});
afterEach(() => vi.unstubAllEnvs());

const firmRowsOf = (ownerUserId: string) => db.tables.firmTeamMember.filter((f) => f.ownerUserId === ownerUserId);

describe("which organisations are the consultant's", () => {
  it("only those where the account is both an OWNER and the billing owner", async () => {
    expect((await firmOrganizations(db, "a")).map((o) => o.id).sort()).toEqual(["a1", "a2"]);
    expect((await firmOrganizations(db, "b")).map((o) => o.id).sort()).toEqual(["b1", "b2"]);
  });
});

describe("adding a firm member", () => {
  it("an existing account joins exactly the owner's client organisations, flagged as firm memberships", async () => {
    const res = await firm("a").add({ email: "STAFF@test.example", role: "PRIVACY_OFFICER" });
    expect(res).toMatchObject({ pending: false, joined: 2 });
    const row = firmRowsOf("a")[0];
    expect(row).toMatchObject({ invitedEmail: "staff@test.example", memberUserId: "staff", role: "PRIVACY_OFFICER" });
    expect(membershipsOf(db, "staff")).toEqual([
      { org: "a1", role: "PRIVACY_OFFICER", firm: row.id },
      { org: "a2", role: "PRIVACY_OFFICER", firm: row.id },
    ]);
  });

  it("never touches another consultant's organisations", async () => {
    const before = structuredClone(db.tables.organizationMember.filter((m) => ["b1", "b2", "a3"].includes(m.organizationId as string)));
    await firm("a").add({ email: "staff@test.example", role: "ADMIN" });
    const after = db.tables.organizationMember.filter((m) => ["b1", "b2", "a3"].includes(m.organizationId as string));
    expect(after).toEqual(before);
  });

  it("defaults to privacy officer and refuses OWNER", async () => {
    await firm("a").add({ email: "staff@test.example" });
    expect(firmRowsOf("a")[0].role).toBe("PRIVACY_OFFICER");
    await expect(firm("a").add({ email: "x@test.example", role: "OWNER" as never })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("refuses a business account, the owner themselves, and a second add of the same address", async () => {
    await expect(firm("biz").add({ email: "staff@test.example" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(firm("a").add({ email: "a@test.example" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await firm("a").add({ email: "staff@test.example" });
    await expect(firm("a").add({ email: "Staff@test.example" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(firmRowsOf("a")).toHaveLength(1);
  });

  it("keeps a membership the person already holds in their own right and skips that organisation", async () => {
    const own = addMember(db, "a2", "staff", "VIEWER");
    await firm("a").add({ email: "staff@test.example", role: "ADMIN" });
    expect(membershipsOf(db, "staff")).toEqual([
      { org: "a1", role: "ADMIN", firm: firmRowsOf("a")[0].id },
      { org: "a2", role: "VIEWER", firm: null },
    ]);
    expect(db.tables.organizationMember.find((m) => m.id === own.id)).toBeTruthy();
  });

  it("an address nobody has signed in with joins at first sign-in, idempotently", async () => {
    const res = await firm("a").add({ email: "new@test.example", role: "MEMBER" });
    expect(res).toMatchObject({ pending: true, emailSent: true, joined: 0 });
    expect(db.tables.organizationMember.filter((m) => m.invitedEmail === "new@test.example")).toHaveLength(0);
    addUser(db, "new");
    expect(await acceptFirmTeamInvitations(db, "new", "New@Test.example")).toBe(2);
    expect(await acceptFirmTeamInvitations(db, "new", "new@test.example")).toBe(0);
    expect(membershipsOf(db, "new").map((m) => [m.org, m.role])).toEqual([["a1", "MEMBER"], ["a2", "MEMBER"]]);
    expect(firmRowsOf("a")[0]).toMatchObject({ memberUserId: "new" });
    expect(firmRowsOf("a")[0].acceptedAt).toBeInstanceOf(Date);
  });

  it("writes an audit entry per organisation joined, with the address and role only", async () => {
    await firm("a").add({ email: "staff@test.example", role: "MEMBER" });
    const entries = db.tables.auditLog.filter((e) => e.action === "FIRM_TEAM_ADD");
    expect(entries.map((e) => e.organizationId).sort()).toEqual(["a1", "a2"]);
    expect(Object.keys(entries[0].changes as object).sort()).toEqual(["email", "firmTeamMemberId", "role"]);
    expect(db.tables.auditLog.some((e) => e.action === "FIRM_TEAM_INVITE" && e.organizationId === null)).toBe(true);
  });
});

describe("new client organisations", () => {
  it("organization.create adds every signed-in firm member to the new client", async () => {
    await firm("a").add({ email: "staff@test.example", role: "PRIVACY_OFFICER" });
    await firm("a").add({ email: "later@test.example" }); // not signed in yet: nothing to add
    const created = await org("a").create({ name: "Client four", slug: "client-four" });
    const m = db.tables.organizationMember.filter((x) => x.organizationId === created.id);
    expect(m.map((x) => [x.userId, x.role, x.firmTeamMemberId ? "firm" : "own"]).sort()).toEqual([
      ["a", "OWNER", "own"],
      ["staff", "PRIVACY_OFFICER", "firm"],
    ]);
  });

  it("another consultant's new organisation gets none of A's firm members", async () => {
    await firm("a").add({ email: "staff@test.example" });
    const created = await org("b").create({ name: "B client", slug: "b-client" });
    expect(db.tables.organizationMember.filter((x) => x.organizationId === created.id).map((x) => x.userId)).toEqual(["b"]);
  });

  it("is idempotent", async () => {
    await firm("a").add({ email: "staff@test.example" });
    expect(await addFirmTeamToOrganization(db, "a", "a1")).toBe(0);
    expect(membershipsOf(db, "staff")).toHaveLength(2);
  });
});

describe("changing a firm member's role", () => {
  it("applies to every firm membership and never to a membership of their own", async () => {
    addMember(db, "a2", "staff", "VIEWER");
    await firm("a").add({ email: "staff@test.example", role: "MEMBER" });
    const id = firmRowsOf("a")[0].id as string;
    await firm("a").updateRole({ id, role: "ADMIN" });
    expect(membershipsOf(db, "staff")).toEqual([
      { org: "a1", role: "ADMIN", firm: id },
      { org: "a2", role: "VIEWER", firm: null },
    ]);
    expect(db.tables.auditLog.filter((e) => e.action === "FIRM_TEAM_ROLE" && e.organizationId === "a1")).toHaveLength(1);
    await expect(firm("a").updateRole({ id, role: "OWNER" as never })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("removing a firm member", () => {
  it("removes only the memberships that came from the firm team", async () => {
    addMember(db, "a2", "staff", "VIEWER"); // their own
    addMember(db, "b1", "staff", "MEMBER"); // another consultant's client
    await firm("a").add({ email: "staff@test.example" });
    const id = firmRowsOf("a")[0].id as string;
    expect(await firm("a").remove({ id })).toEqual({ removedMemberships: 1 });
    expect(membershipsOf(db, "staff")).toEqual([
      { org: "a2", role: "VIEWER", firm: null },
      { org: "b1", role: "MEMBER", firm: null },
    ]);
    expect(firmRowsOf("a")).toHaveLength(0);
    expect(db.tables.auditLog.filter((e) => e.action === "FIRM_TEAM_REMOVE").map((e) => e.organizationId).sort()).toEqual([
      "a1",
      null,
    ]);
  });
});

describe("other accounts", () => {
  it("a client member sees no firm team list, and cannot change or remove someone in A's team", async () => {
    await firm("a").add({ email: "staff@test.example" });
    const id = firmRowsOf("a")[0].id as string;
    for (const who of ["client-member", "client-admin", "staff", "b"]) {
      const list = await firm(who).list();
      expect(list.members).toEqual([]);
      await expect(firm(who).remove({ id })).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(firm(who).updateRole({ id, role: "VIEWER" })).rejects.toMatchObject({
        code: who === "b" ? "NOT_FOUND" : "FORBIDDEN",
      });
    }
    expect(membershipsOf(db, "staff").map((m) => [m.org, m.role])).toEqual([
      ["a1", "PRIVACY_OFFICER"],
      ["a2", "PRIVACY_OFFICER"],
    ]);
    const own = await firm("a").list();
    expect(own).toMatchObject({ available: true, clients: 2 });
    expect(own.members).toEqual([expect.objectContaining({ email: "staff@test.example", clientsJoined: 2, pending: false })]);
  });
});

describe("the client's members card (organization router)", () => {
  async function staffMembershipIn(orgId: string) {
    await firm("a").add({ email: "staff@test.example" });
    return db.tables.organizationMember.find((m) => m.organizationId === orgId && m.userId === "staff")!;
  }

  it("a client admin cannot remove or change a firm member", async () => {
    const m = await staffMembershipIn("a1");
    await expect(org("client-admin").removeMember({ organizationId: "a1", memberId: m.id as string })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(db.tables.organizationMember.some((x) => x.id === m.id)).toBe(true);
  });

  it("an owner of the client cannot change or remove a firm member there either (only from the firm team)", async () => {
    addMember(db, "a1", "client-member", "OWNER");
    db.tables.organizationMember = db.tables.organizationMember.filter(
      (x) => !(x.organizationId === "a1" && x.userId === "client-member" && x.role === "MEMBER")
    );
    const m = await staffMembershipIn("a1");
    for (const who of ["client-member", "a"]) {
      await expect(org(who, { locale: "es" }).updateMember({ organizationId: "a1", memberId: m.id as string, role: "VIEWER" })).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: expect.stringContaining("equipo"),
      });
      await expect(org(who).removeMember({ organizationId: "a1", memberId: m.id as string })).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(db.tables.organizationMember.find((x) => x.id === m.id)).toMatchObject({ role: "PRIVACY_OFFICER" });
  });

  it("a client admin still removes the client's own members", async () => {
    await staffMembershipIn("a1");
    const own = db.tables.organizationMember.find((m) => m.organizationId === "a1" && m.userId === "client-member")!;
    await org("client-admin").removeMember({ organizationId: "a1", memberId: own.id as string });
    expect(db.tables.organizationMember.some((x) => x.id === own.id)).toBe(false);
  });

  it("when the consultant stops being an owner of a client, their firm team leaves it", async () => {
    addMember(db, "a1", "client-member", "OWNER");
    db.tables.organizationMember = db.tables.organizationMember.filter(
      (x) => !(x.organizationId === "a1" && x.userId === "client-member" && x.role === "MEMBER")
    );
    await staffMembershipIn("a1");
    addMember(db, "a1", "other", "VIEWER");
    const consultant = db.tables.organizationMember.find((m) => m.organizationId === "a1" && m.userId === "a")!;
    await org("client-member").updateMember({ organizationId: "a1", memberId: consultant.id as string, role: "ADMIN" });
    expect(membershipsOf(db, "staff").map((m) => m.org)).toEqual(["a2"]);
    expect(db.tables.organizationMember.some((m) => m.organizationId === "a1" && m.userId === "other")).toBe(true);
  });

  it("the membership guard is unchanged: a firm member reaches the owner's clients and nothing else", async () => {
    await firm("a").add({ email: "staff@test.example", role: "ADMIN" });
    // Through adminOrgProcedure, as any member with that role would.
    await expect(org("staff").listInvitations({ organizationId: "a1" })).resolves.toEqual([]);
    for (const other of ["b1", "b2", "a3"]) {
      await expect(org("staff").listInvitations({ organizationId: other })).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "You do not have access to this organization",
      });
    }
  });
});

describe("hosted pilot", () => {
  beforeEach(() => vi.stubEnv("VERCEL_ENV", "production"));

  it("an account already at the organisations-per-account limit is refused, and nothing is written", async () => {
    for (const id of ["x1", "x2", "x3", "x4"]) {
      addOrg(db, id, null);
      addMember(db, id, "staff", "MEMBER");
    }
    await expect(firm("a").add({ email: "staff@test.example" })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringContaining("at most 5 organisations"),
    });
    expect(firmRowsOf("a")).toHaveLength(0);
    expect(membershipsOf(db, "staff").map((m) => m.org)).toEqual(["x1", "x2", "x3", "x4"]);
  });

  it("on the paid plan the limit does not apply, as for addMember", async () => {
    for (const o of db.tables.organization) if (o.billingOwnerId === "a") o.plan = "EU_CLOUD";
    for (const id of ["x1", "x2", "x3", "x4", "x5"]) {
      addOrg(db, id, null);
      addMember(db, id, "staff", "MEMBER");
    }
    await expect(firm("a").add({ email: "staff@test.example" })).resolves.toMatchObject({ joined: 2 });
  });

  it("at sign-in, an organisation the limit refuses is skipped and the rest are joined", async () => {
    await firm("a").add({ email: "late@test.example" });
    addUser(db, "late");
    for (const id of ["x1", "x2", "x3", "x4"]) {
      addOrg(db, id, null);
      addMember(db, id, "late", "MEMBER");
    }
    expect(await acceptFirmTeamInvitations(db, "late", "late@test.example")).toBe(1);
    const row = firmRowsOf("a")[0];
    const second = await syncFirmMember(db, row as never, await firmOrganizations(db, "a"));
    expect(second).toMatchObject({ added: [], skipped: ["a2"] });
  });
});

describe("display and wiring", () => {
  it("the members card puts firm memberships in their own group, named after the team's owner", () => {
    const members = [
      { id: "1", firmTeamMemberId: null, firmTeamMember: null },
      { id: "2", firmTeamMemberId: "f1", firmTeamMember: { ownerUserId: "a", owner: { name: "Consultant A", email: "a@x" } } },
      { id: "3", firmTeamMemberId: "f2", firmTeamMember: { ownerUserId: "a", owner: { name: "Consultant A", email: "a@x" } } },
    ];
    const { own, firmGroups } = splitFirmMembers(members);
    expect(own.map((m) => m.id)).toEqual(["1"]);
    expect(firmGroups).toEqual([{ ownerUserId: "a", ownerName: "Consultant A", members: [members[1], members[2]] }]);
  });

  it("the invitation e-mail for a firm team speaks of every client, in both languages", () => {
    const base = { to: "s@x", orgName: "", inviterName: "A", role: "PRIVACY_OFFICER", signInUrl: "u", firmTeam: true };
    expect(invitationCopy({ ...base, locale: "en" }).body).toContain("every client they manage");
    expect(invitationCopy({ ...base, locale: "es" }).body).toContain("todos los clientes que gestiona");
  });

  it("sign-in accepts firm team invitations", () => {
    const src = readFileSync(path.resolve(__dirname, "../src/lib/auth.ts"), "utf8");
    expect(src).toMatch(/await acceptFirmTeamInvitations\(prisma, user\.id, user\.email[,)]/);
    // An accepted invitation sends the list to AI Sentinel (tests/suite-firm-team.test.ts).
    expect(src).toMatch(/onAccepted: \(ownerUserId\) => schedulePushFirmTeam\(prisma, ownerUserId\)/);
  });
});
