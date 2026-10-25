// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Deleting organisations (Cloud Plan terms clause 9, DPA clause 13):
 *  - the one deletion path (src/server/services/organization/delete.ts);
 *  - the owner's deletion in Settings (organizationDeletion router helpers);
 *  - the retention job (src/server/services/organization/retention.ts):
 *    30 days after the paid plan ends, and pilots nobody used for 12 months,
 *    each after e-mail notices; off unless ORG_RETENTION_ENABLED is "true";
 *  - the schema: every table of an organisation goes with it.
 */

import { readFileSync } from "node:fs";
import type { Prisma } from "@prisma/client";
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import {
  deleteOrganizationCompletely,
  KEPT_AUDIT_ACTIONS,
  ORGANIZATION_DELETED,
  ORG_RETENTION_NOTICE,
} from "@/server/services/organization/delete";
import {
  decide,
  lastUseOf,
  planEndedAt,
  renderRetentionNotice,
  retentionEnabled,
  runOrganizationRetention,
  type RetentionDb,
} from "@/server/services/organization/retention";
import { confirmsName, deletionBlockedReason } from "@/server/routers/privacy/organizationDeletion";
import { READ_ONLY_ALLOWED_PATHS } from "@/server/services/pilot/caps";
import { PLAN_CHANGE } from "@/server/services/pilot/plan";

const DAY = 86_400_000;
const NOW = new Date("2027-03-01T03:45:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY);
const daysAhead = (n: number) => new Date(NOW.getTime() + n * DAY);

// ── The one deletion path ───────────────────────────────────────────────

function deletionTx(org: { id: string; plan: string } | null) {
  const calls: string[] = [];
  const rec = (name: string) =>
    vi.fn(async (args: unknown) => {
      calls.push(name);
      return args;
    });
  const tx = {
    organization: { findUnique: vi.fn(async () => org), delete: rec("organization.delete") },
    assessment: { deleteMany: rec("assessment.deleteMany") },
    assessmentTemplate: { deleteMany: rec("assessmentTemplate.deleteMany") },
    vendor: { deleteMany: rec("vendor.deleteMany") },
    vendorQuestionnaire: { deleteMany: rec("vendorQuestionnaire.deleteMany") },
    auditLog: { deleteMany: rec("auditLog.deleteMany"), create: rec("auditLog.create") },
  };
  const db = { $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)) };
  return { db, tx, calls };
}

describe("deleteOrganizationCompletely", () => {
  it("deletes the children a cascade cannot order, the trail, then the organisation, and records it outside", async () => {
    const { db, tx, calls } = deletionTx({ id: "org-a", plan: "PILOT" });
    const result = await deleteOrganizationCompletely(db as never, "org-a", { by: "owner", userId: "u1" }, NOW);
    expect(result).toEqual({ deleted: true, organizationId: "org-a" });
    expect(calls).toEqual([
      "assessment.deleteMany",
      "assessmentTemplate.deleteMany",
      "vendor.deleteMany",
      "vendorQuestionnaire.deleteMany",
      "auditLog.deleteMany",
      "organization.delete",
      "auditLog.create",
    ]);
    expect(tx.auditLog.deleteMany).toHaveBeenCalledWith({
      where: { organizationId: "org-a", action: { notIn: [...KEPT_AUDIT_ACTIONS] } },
    });
    const entry = (tx.auditLog.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(entry).toMatchObject({
      organizationId: null,
      userId: "u1",
      entityType: "Organization",
      entityId: "org-a",
      action: ORGANIZATION_DELETED,
      changes: { by: "owner", plan: "PILOT", deletedAt: NOW.toISOString() },
    });
    // No name, no content.
    expect(JSON.stringify(entry)).not.toMatch(/name/i);
  });

  it("keeps only the record of the contract", () => {
    expect([...KEPT_AUDIT_ACTIONS].sort()).toEqual(
      ["DPA_ACCEPTED", "DSAR_MODULE_CHANGE", "ORG_RETENTION_NOTICE", "PLAN_CHANGE"].sort()
    );
  });

  it("records the retention rule, with nobody as the one who asked", async () => {
    const { db, tx } = deletionTx({ id: "org-a", plan: "PILOT" });
    await deleteOrganizationCompletely(db as never, "org-a", { by: "retention", rule: "plan-ended" }, NOW);
    expect((tx.auditLog.create.mock.calls[0][0] as { data: Record<string, unknown> }).data).toMatchObject({
      userId: null,
      changes: { by: "retention", rule: "plan-ended" },
    });
  });

  it("changes nothing for an organisation already gone", async () => {
    const { db, calls } = deletionTx(null);
    expect(await deleteOrganizationCompletely(db as never, "gone", { by: "platform-admin", userId: "a1" })).toEqual({
      deleted: false,
      organizationId: "gone",
    });
    expect(calls).toEqual([]);
  });
});

describe("the schema: an organisation's tables go with it", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  it("every relation to Organization cascades, except the audit trail, which the deletion handles", () => {
    const rels = [...schema.matchAll(/^\s*(\w+)\s+Organization\??\s+@relation\(([^)]*)\)/gm)];
    expect(rels.length).toBeGreaterThan(20);
    const notCascading = rels.filter(([, , args]) => !/onDelete:\s*Cascade/.test(args)).map(([, field, args]) => `${field} ${args}`);
    // Organization.billingOwner points at User, not Organization; AuditLog keeps
    // the contract entries (SetNull) and the deletion removes the rest itself.
    expect(notCascading.every((r) => /onDelete:\s*SetNull/.test(r))).toBe(true);
    expect(notCascading).toHaveLength(1);
  });
  it("records the last sign-in, additively", () => {
    expect(schema).toMatch(/lastSignInAt\s+DateTime\?/);
    const sql = readFileSync("prisma/migrations/20261025120000_user_last_sign_in/migration.sql", "utf8");
    expect(sql).toMatch(/ALTER TABLE "users" ADD COLUMN "lastSignInAt" TIMESTAMP\(3\);/);
    expect(sql).not.toMatch(/DROP|DELETE|NOT NULL/);
  });
});

// ── The owner's deletion ────────────────────────────────────────────────

describe("the owner's deletion", () => {
  it("is open to a pilot, closed on the paid plan while it runs (hosted), always open on the kit", () => {
    expect(deletionBlockedReason({ plan: "PILOT" }, true)).toBeNull();
    expect(deletionBlockedReason({ plan: "EU_CLOUD" }, true)).toBe("paid-plan");
    expect(deletionBlockedReason({ plan: "EU_CLOUD" }, false)).toBeNull();
  });
  it("needs the organisation's exact name", () => {
    expect(confirmsName("  Acme Ltd ", "Acme Ltd")).toBe(true);
    expect(confirmsName("acme ltd", "Acme Ltd")).toBe(false);
    expect(confirmsName("", "")).toBe(false);
  });
  it("works while the pilot is read-only", () => {
    expect(READ_ONLY_ALLOWED_PATHS.has("organizationDeletion.delete")).toBe(true);
  });
});

// ── The retention job ───────────────────────────────────────────────────

type Entry = { organizationId: string; action: string; createdAt: Date; userId: string | null; changes: Prisma.JsonValue };

const downgrade = (at: Date): Entry => ({
  organizationId: "org-a",
  action: PLAN_CHANGE,
  createdAt: at,
  userId: null,
  changes: { before: { plan: "EU_CLOUD" }, after: { plan: "PILOT" } },
});
const upgrade = (at: Date): Entry => ({
  organizationId: "org-a",
  action: PLAN_CHANGE,
  createdAt: at,
  userId: null,
  changes: { before: { plan: "PILOT" }, after: { plan: "EU_CLOUD" } },
});
const notice = (rule: string, step: string, basis: Date, deleteOn: Date, at: Date): Entry => ({
  organizationId: "org-a",
  action: ORG_RETENTION_NOTICE,
  createdAt: at,
  userId: null,
  changes: { rule, step, basis: basis.toISOString(), deleteOn: deleteOn.toISOString() },
});
const memberAction = (at: Date): Entry => ({ organizationId: "org-a", action: "UPDATE", createdAt: at, userId: "u1", changes: {} });

function org(over: Record<string, unknown> = {}) {
  return {
    id: "org-a",
    name: "Acme",
    plan: "PILOT",
    createdAt: daysAgo(500),
    pilotStartedAt: daysAgo(500),
    members: [
      { role: "OWNER", user: { email: "owner@acme.example", locale: "es", lastSignInAt: daysAgo(400) } },
      { role: "ADMIN", user: { email: "admin@acme.example", locale: null, lastSignInAt: null } },
      { role: "MEMBER", user: { email: "member@acme.example", locale: null, lastSignInAt: null } },
    ],
    ...over,
  } as never;
}

describe("decide: the paid plan has ended", () => {
  it("tells at once, with deletion 30 days after the end and never less than 7 days ahead", () => {
    expect(decide(org(), [downgrade(daysAgo(2))], NOW)).toMatchObject({
      rule: "plan-ended",
      step: "first",
      deleteOn: daysAhead(28),
    });
    // A job switched on late still gives a week.
    expect(decide(org(), [downgrade(daysAgo(60))], NOW)).toMatchObject({ step: "first", deleteOn: daysAhead(7) });
  });
  it("reminds 7 days before, then deletes on the date", () => {
    const end = daysAgo(23);
    const first = notice("plan-ended", "first", end, daysAhead(7), daysAgo(23));
    expect(decide(org(), [downgrade(end), first], NOW)).toMatchObject({ step: "reminder" });
    const reminded = notice("plan-ended", "reminder", end, daysAhead(7), NOW);
    expect(decide(org(), [downgrade(end), first, reminded], NOW)).toBeNull();
    const due = notice("plan-ended", "first", daysAgo(31), daysAgo(1), daysAgo(31));
    expect(decide(org(), [downgrade(daysAgo(31)), due], NOW)).toMatchObject({ step: "delete" });
  });
  it("a new plan voids it, and an organisation on the paid plan is never touched", () => {
    const end = daysAgo(40);
    const due = notice("plan-ended", "first", end, daysAgo(10), end);
    expect(decide(org({ plan: "EU_CLOUD" }), [downgrade(end), due, upgrade(daysAgo(5))], NOW)).toBeNull();
    // Back on the pilot after a second end: a fresh notice for the new end.
    expect(
      decide(org(), [downgrade(end), due, upgrade(daysAgo(20)), downgrade(daysAgo(1))], NOW)
    ).toMatchObject({ step: "first", deleteOn: daysAhead(29) });
  });
  it("reads the end only from the latest plan change", () => {
    expect(planEndedAt([downgrade(daysAgo(40)), upgrade(daysAgo(5))] as never)).toBeNull();
    expect(planEndedAt([upgrade(daysAgo(40)), downgrade(daysAgo(5))] as never)).toEqual(daysAgo(5));
  });
});

describe("decide: a pilot nobody has used for twelve months", () => {
  it("keeps any organisation used in the last eleven months", () => {
    expect(decide(org(), [memberAction(daysAgo(300))], NOW)).toBeNull();
    const recent = org({
      members: [{ role: "OWNER", user: { email: "o@acme.example", locale: null, lastSignInAt: daysAgo(10) } }],
    });
    expect(decide(recent, [], NOW)).toBeNull();
    expect(decide(org({ createdAt: daysAgo(20), pilotStartedAt: null, members: [] }), [], NOW)).toBeNull();
  });
  it("tells 30 days before the twelve months are up, never less than 30 days before deletion", () => {
    // Last use 336 days ago: twelve months up in 29 days, so deletion is 30 days ahead.
    const o = org({ members: [{ role: "OWNER", user: { email: "o@acme.example", locale: null, lastSignInAt: daysAgo(336) } }], createdAt: daysAgo(400), pilotStartedAt: null });
    expect(decide(o, [], NOW)).toMatchObject({ rule: "pilot-inactive", step: "first", deleteOn: daysAhead(30) });
  });
  it("a sign-in after the notice voids it; otherwise it deletes on the date", () => {
    const last = daysAgo(400);
    const due = notice("pilot-inactive", "first", last, daysAgo(1), daysAgo(31));
    const o = org({ members: [{ role: "OWNER", user: { email: "o@acme.example", locale: null, lastSignInAt: last } }], createdAt: daysAgo(500), pilotStartedAt: null });
    expect(decide(o, [due, notice("pilot-inactive", "reminder", last, daysAgo(1), daysAgo(8))], NOW)).toMatchObject({ step: "delete" });
    const signedIn = org({ members: [{ role: "OWNER", user: { email: "o@acme.example", locale: null, lastSignInAt: daysAgo(3) } }], createdAt: daysAgo(500), pilotStartedAt: null });
    expect(decide(signedIn, [due], NOW)).toBeNull();
  });
  it("counts what members did, not what the system wrote", () => {
    const o = org({ createdAt: daysAgo(500), pilotStartedAt: null, members: [] });
    const systemEntry: Entry = { organizationId: "org-a", action: ORG_RETENTION_NOTICE, createdAt: daysAgo(1), userId: null, changes: {} };
    expect(lastUseOf(o, [systemEntry] as never)).toEqual(daysAgo(500));
    expect(lastUseOf(o, [memberAction(daysAgo(30))] as never)).toEqual(daysAgo(30));
  });
});

function retentionDb(orgs: unknown[], entries: Entry[]) {
  const { db: txDb, calls } = deletionTx({ id: "org-a", plan: "PILOT" });
  const db = {
    ...txDb,
    organization: { findMany: vi.fn(async () => orgs) },
    auditLog: { findMany: vi.fn(async () => entries), create: vi.fn(async () => ({})) },
  };
  return { db, calls };
}
const mailer = () => ({ send: vi.fn(async () => undefined) });

describe("runOrganizationRetention", () => {
  it("does nothing on the kit", async () => {
    const { db } = retentionDb([org()], [downgrade(daysAgo(2))]);
    expect(await runOrganizationRetention(db as unknown as RetentionDb, mailer(), NOW, { hosted: false, enabled: true })).toMatchObject({
      skipped: "not-hosted",
    });
    expect(db.organization.findMany).not.toHaveBeenCalled();
  });

  it("switched off, reports what it would do and writes and sends nothing", async () => {
    const m = mailer();
    const { db, calls } = retentionDb([org()], [downgrade(daysAgo(31)), notice("plan-ended", "first", daysAgo(31), daysAgo(1), daysAgo(31))]);
    const s = await runOrganizationRetention(db as unknown as RetentionDb, m, NOW, { hosted: true, enabled: false });
    expect(s).toMatchObject({ enabled: false, planned: [{ organizationId: "org-a", rule: "plan-ended", action: "delete" }], deleted: 0 });
    expect(m.send).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
  });

  it("switched on without e-mail, does nothing", async () => {
    const { db } = retentionDb([org()], []);
    expect(await runOrganizationRetention(db as unknown as RetentionDb, null, NOW, { hosted: true, enabled: true })).toMatchObject({
      skipped: "email-not-configured",
    });
  });

  it("e-mails owners and administrators only, and records the notice", async () => {
    const m = mailer();
    const { db } = retentionDb([org()], [downgrade(daysAgo(2))]);
    const s = await runOrganizationRetention(db as unknown as RetentionDb, m, NOW, { hosted: true, enabled: true });
    expect(s).toMatchObject({ noticesSent: 1, emails: 2, deleted: 0 });
    expect((m.send.mock.calls as unknown as [{ to: string }][]).map((c) => c[0].to).sort()).toEqual(["admin@acme.example", "owner@acme.example"]);
    const data = (db.auditLog.create.mock.calls as unknown as [{ data: Record<string, unknown> }][])[0][0].data;
    expect(data).toMatchObject({ organizationId: "org-a", userId: null, action: ORG_RETENTION_NOTICE, changes: { rule: "plan-ended", step: "first" } });
  });

  it("no notice, no deletion: nobody to tell, or every e-mail refused", async () => {
    const lonely = org({ members: [{ role: "MEMBER", user: { email: "m@acme.example", locale: null, lastSignInAt: null } }] });
    const a = retentionDb([lonely], [downgrade(daysAgo(2))]);
    expect(await runOrganizationRetention(a.db as unknown as RetentionDb, mailer(), NOW, { hosted: true, enabled: true })).toMatchObject({
      noRecipients: 1,
      noticesSent: 0,
    });
    const refusing = { send: vi.fn(async () => { throw new Error("refused"); }) };
    const b = retentionDb([org()], [downgrade(daysAgo(2))]);
    expect(await runOrganizationRetention(b.db as unknown as RetentionDb, refusing, NOW, { hosted: true, enabled: true })).toMatchObject({
      errors: 1,
      noticesSent: 0,
    });
    expect(b.db.auditLog.create).not.toHaveBeenCalled();
  });

  it("deletes through the one deletion path when the date has come", async () => {
    const { db, calls } = retentionDb([org()], [downgrade(daysAgo(31)), notice("plan-ended", "first", daysAgo(31), daysAgo(1), daysAgo(31))]);
    const s = await runOrganizationRetention(db as unknown as RetentionDb, mailer(), NOW, { hosted: true, enabled: true });
    expect(s.deleted).toBe(1);
    expect(calls).toContain("organization.delete");
  });

  it("reads only pilot organisations", async () => {
    const { db } = retentionDb([], []);
    await runOrganizationRetention(db as unknown as RetentionDb, mailer(), NOW, { hosted: true, enabled: true });
    expect(db.organization.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { plan: "PILOT" } }));
  });
});

describe("the switch and the e-mail", () => {
  it("is on only when exactly true", () => {
    expect(retentionEnabled({})).toBe(false);
    expect(retentionEnabled({ ORG_RETENTION_ENABLED: "TRUE" })).toBe(false);
    expect(retentionEnabled({ ORG_RETENTION_ENABLED: "true" })).toBe(true);
  });
  it("renders both rules in both languages, with the date and without long dashes", () => {
    for (const locale of ["en", "es"] as const) {
      for (const rule of ["plan-ended", "pilot-inactive"] as const) {
        for (const step of ["first", "reminder"] as const) {
          const mail = renderRetentionNotice({ locale, rule, step, orgName: "Acme <b>", deleteOn: daysAhead(30), link: "https://x.example/privacy/settings" });
          expect(mail.subject).toContain("Acme");
          expect(mail.text).toContain("https://x.example/privacy/settings");
          expect(mail.html).not.toContain("<b>");
          expect(mail.subject + mail.text).not.toMatch(/—|–/);
        }
      }
    }
    expect(renderRetentionNotice({ locale: "es", rule: "plan-ended", step: "first", orgName: "Acme", deleteOn: new Date("2027-03-31T12:00:00Z"), link: "l" }).text).toContain("31 de marzo de 2027");
  });
});
