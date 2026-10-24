// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Hosted rights-request housekeeping and the operator tools:
 *  - open requests with no activity for 30 days are deleted after a notice to
 *    owners and administrators 7 days before (src/server/services/dsar/inactive.ts);
 *  - the add-on setter (scripts/set-dsar-module.ts): dry run by default;
 *  - support reads write a SUPPORT entry before reading;
 *  - the extension e-mail to the requester, the Spanish task titles and the
 *    repeated-access warning (LOPDGDD art. 13.3).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import {
  DSAR_DELETED_INACTIVE,
  INACTIVITY_NOTICE_SENT,
  lastActivityOf,
  runInactiveDsarCleanup,
  type InactiveDb,
} from "@/server/services/dsar/inactive";
import { setDsarModule, DSAR_MODULE_CHANGE } from "@/server/services/dsar/set-module";
import { parseArgs as parseModuleArgs } from "../scripts/set-dsar-module";
import { parseArgs as parseSupportArgs } from "../scripts/dsar-support-read";
import { supportReadDsar, SUPPORT_ACTION, type SupportDb } from "@/server/services/dsar/support-access";
import { renderExtensionEmail } from "@/server/services/dsar/sendExtensionEmail";
import { generatedTaskText } from "@/server/services/dsar/generated-tasks";
import { countRecentAccessRequests } from "@/server/services/dsar/repeat-access";

const DAY = 86_400_000;
const NOW = new Date("2026-11-20T03:15:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY);

// ── Inactive open requests ──────────────────────────────────────────────

function row(over: Record<string, unknown> = {}) {
  return {
    id: "dsar-1",
    organizationId: "org-a",
    publicId: "PUB-1",
    type: "ACCESS",
    status: "IN_PROGRESS",
    receivedAt: daysAgo(40),
    dueDate: daysAgo(10),
    updatedAt: daysAgo(24),
    organization: { name: "Acme" },
    tasks: [],
    communications: [],
    auditLog: [],
    ...over,
  };
}

function inactiveDb(rows: unknown[]) {
  return {
    dSARRequest: { findMany: vi.fn(async () => rows), delete: vi.fn(async () => ({})) },
    organizationMember: {
      findMany: vi.fn(async () => [
        { userId: "u1", role: "OWNER", user: { email: "owner@acme.example", locale: "es" } },
        { userId: "u2", role: "ADMIN", user: { email: "admin@acme.example", locale: null } },
      ]),
    },
    dSARAuditLog: { create: vi.fn(async () => ({})) },
    auditLog: { create: vi.fn(async () => ({})), updateMany: vi.fn(async () => ({})) },
  };
}
const mailer = () => ({ send: vi.fn(async () => undefined) });

describe("open requests with no activity", () => {
  it("does nothing on the kit, and nothing without a mail service", async () => {
    const db = inactiveDb([row()]);
    expect(await runInactiveDsarCleanup(db as unknown as InactiveDb, mailer(), NOW, false)).toMatchObject({ skipped: "not-hosted" });
    expect(await runInactiveDsarCleanup(db as unknown as InactiveDb, null, NOW, true)).toMatchObject({
      skipped: "email-not-configured",
    });
    expect(db.dSARRequest.findMany).not.toHaveBeenCalled();
  });

  it("reads only open requests unchanged for 23 days", async () => {
    const db = inactiveDb([]);
    await runInactiveDsarCleanup(db as unknown as InactiveDb, mailer(), NOW, true);
    const args = (db.dSARRequest.findMany.mock.calls[0] as unknown[])[0] as { where: Record<string, unknown> };
    expect(args.where).toEqual({
      status: { notIn: ["COMPLETED", "REJECTED", "CANCELLED"] },
      updatedAt: { lte: daysAgo(23) },
    });
  });

  it("counts a task change or a message as activity", () => {
    expect(
      lastActivityOf({ updatedAt: daysAgo(40), tasks: [{ updatedAt: daysAgo(5) }], communications: [{ sentAt: daysAgo(20) }] })
    ).toEqual(daysAgo(5));
  });

  it("23 days without activity: tells the owners and administrators, in their language, and records the notice", async () => {
    const db = inactiveDb([row()]);
    const m = mailer();
    const summary = await runInactiveDsarCleanup(db as unknown as InactiveDb, m, NOW, true);
    expect(summary).toMatchObject({ noticesSent: 1, emails: 2, deleted: 0 });
    expect(db.organizationMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: "org-a", role: { in: ["OWNER", "ADMIN"] } } })
    );
    const [es, enMail] = m.send.mock.calls.map((c) => (c as unknown[])[0] as { to: string; subject: string; text: string });
    expect(es.to).toBe("owner@acme.example");
    expect(es.subject).toContain("se eliminará");
    expect(enMail.subject).toContain("will be deleted");
    expect(enMail.text).toContain("PUB-1");
    expect(db.dSARAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        dsarRequestId: "dsar-1",
        action: INACTIVITY_NOTICE_SENT,
        details: expect.objectContaining({
          lastActivityAt: daysAgo(24).toISOString(),
          // 30 days after the last activity, and at least 7 after the notice.
          deleteOn: new Date(NOW.getTime() + 7 * DAY).toISOString(),
        }),
      }),
    });
    expect(db.dSARRequest.delete).not.toHaveBeenCalled();
  });

  it("sends the notice once for the same last activity", async () => {
    const notice = { createdAt: daysAgo(1), details: { lastActivityAt: daysAgo(24).toISOString(), deleteOn: new Date(NOW.getTime() + 6 * DAY).toISOString() } };
    const db = inactiveDb([row({ auditLog: [notice] })]);
    const m = mailer();
    await runInactiveDsarCleanup(db as unknown as InactiveDb, m, NOW, true);
    expect(m.send).not.toHaveBeenCalled();
    expect(db.dSARRequest.delete).not.toHaveBeenCalled();
  });

  it("on the date, with no activity since the notice: keeps a contentless entry, clears the copy of the form, deletes", async () => {
    const lastActivity = daysAgo(31);
    const notice = { createdAt: daysAgo(8), details: { lastActivityAt: lastActivity.toISOString(), deleteOn: daysAgo(1).toISOString() } };
    const db = inactiveDb([row({ updatedAt: lastActivity, auditLog: [notice] })]);
    const summary = await runInactiveDsarCleanup(db as unknown as InactiveDb, mailer(), NOW, true);
    expect(summary).toMatchObject({ deleted: 1 });
    const entry = (db.auditLog.create.mock.calls[0] as unknown[])[0] as { data: Record<string, unknown> };
    expect(entry.data).toMatchObject({ organizationId: "org-a", entityId: "dsar-1", action: DSAR_DELETED_INACTIVE });
    expect(Object.keys(entry.data.changes as object).sort()).toEqual(
      ["dueDate", "lastActivityAt", "noticeSentFor", "publicId", "receivedAt", "status", "type"].sort()
    );
    expect(db.auditLog.updateMany).toHaveBeenCalledWith({
      where: { organizationId: "org-a", entityType: "DSARRequest", entityId: "dsar-1", action: "CREATE" },
      data: { changes: { redacted: true } },
    });
    expect(db.dSARRequest.delete).toHaveBeenCalledWith({ where: { id: "dsar-1" } });
  });

  it("keeps a request worked on after the notice", async () => {
    const notice = { createdAt: daysAgo(8), details: { lastActivityAt: daysAgo(31).toISOString(), deleteOn: daysAgo(1).toISOString() } };
    // A task changed 24 days ago, after the noticed activity: a new cycle, a new notice, no deletion.
    const db = inactiveDb([row({ updatedAt: daysAgo(31), tasks: [{ updatedAt: daysAgo(24) }], auditLog: [notice] })]);
    const summary = await runInactiveDsarCleanup(db as unknown as InactiveDb, mailer(), NOW, true);
    expect(summary).toMatchObject({ deleted: 0, noticesSent: 1 });
    expect(db.dSARRequest.delete).not.toHaveBeenCalled();
  });

  it("skips a request with recent activity on a task", async () => {
    const db = inactiveDb([row({ tasks: [{ updatedAt: daysAgo(2) }] })]);
    const m = mailer();
    await runInactiveDsarCleanup(db as unknown as InactiveDb, m, NOW, true);
    expect(m.send).not.toHaveBeenCalled();
  });

  it("records no notice when no e-mail was accepted, so nothing is deleted later", async () => {
    const db = inactiveDb([row()]);
    const m = { send: vi.fn(async () => Promise.reject(new Error("refused"))) };
    const summary = await runInactiveDsarCleanup(db as unknown as InactiveDb, m, NOW, true);
    expect(summary).toMatchObject({ noticesSent: 0, errors: 1 });
    expect(db.dSARAuditLog.create).not.toHaveBeenCalled();
  });
});

// ── The add-on setter ───────────────────────────────────────────────────

function moduleDb(plan = "EU_CLOUD") {
  const tx = { organization: { update: vi.fn() }, auditLog: { create: vi.fn() } };
  return {
    tx,
    db: {
      organization: {
        findFirst: vi.fn(async () => ({
          id: "org-a",
          slug: "acme",
          name: "Acme",
          plan,
          dsarModuleStatus: null,
          dsarModuleSubscriptionId: null,
          dsarModuleRenewsAt: null,
        })),
      },
      $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<void>) => fn(tx)),
    },
  };
}

describe("set-dsar-module", () => {
  it("is a dry run unless --execute is given", () => {
    expect(parseModuleArgs(["--org", "acme", "--status", "active"])).toMatchObject({ status: "ACTIVE", execute: false });
    expect(parseModuleArgs(["--org", "acme", "--status", "ACTIVE", "--execute"]).execute).toBe(true);
    expect(() => parseModuleArgs(["--org", "acme", "--status", "ON"])).toThrow("ACTIVE, CANCELLED or NONE");
    expect(() => parseModuleArgs(["--status", "ACTIVE"])).toThrow("--org");
    expect(parseModuleArgs(["--org", "a", "--status", "ACTIVE", "--renews", "2026-11-12"]).renewsAt).toEqual(
      new Date("2026-11-12T00:00:00Z")
    );
  });

  it("dry run: computes, writes nothing", async () => {
    const { db, tx } = moduleDb();
    const r = await setDsarModule(db as never, { org: "acme", status: "ACTIVE", operator: "op", execute: false });
    expect(r).toMatchObject({ changed: true, written: false, after: { dsarModuleStatus: "ACTIVE" } });
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(tx.organization.update).not.toHaveBeenCalled();
  });

  it("execute: writes the change and one audit entry that does not reveal the subscription id", async () => {
    const { db, tx } = moduleDb();
    const r = await setDsarModule(db as never, {
      org: "acme",
      status: "ACTIVE",
      subscriptionId: "sub_secret",
      renewsAt: new Date("2026-11-12T00:00:00Z"),
      operator: "op",
      execute: true,
    });
    expect(r.written).toBe(true);
    expect(tx.organization.update).toHaveBeenCalledWith({
      where: { id: "org-a" },
      data: { dsarModuleStatus: "ACTIVE", dsarModuleSubscriptionId: "sub_secret", dsarModuleRenewsAt: new Date("2026-11-12T00:00:00Z") },
    });
    const audit = (tx.auditLog.create.mock.calls[0] as unknown[])[0] as { data: Record<string, unknown> };
    expect(audit.data.action).toBe(DSAR_MODULE_CHANGE);
    expect(JSON.stringify(audit.data)).not.toContain("sub_secret");
    expect(audit.data.changes).toMatchObject({ subscriptionIdChanged: true });
  });

  it("applies the volume upgrade on the pilot as on the paid plan (no pilot warning)", async () => {
    const { db } = moduleDb("PILOT");
    const r = await setDsarModule(db as never, { org: "acme", status: "ACTIVE", operator: "op", execute: false });
    expect(r.note).toBeNull();
    expect(r.after.dsarModuleStatus).toBe("ACTIVE");
  });
});

// ── Support reads ───────────────────────────────────────────────────────

describe("support read", () => {
  it("needs who and why", () => {
    expect(parseSupportArgs(["--request", "PUB-1", "--by", "op", "--reason", "ticket 9"])).toEqual({
      request: "PUB-1",
      operator: "op",
      reason: "ticket 9",
    });
  });

  it("writes the SUPPORT entry in the request's trail before reading it", async () => {
    const order: string[] = [];
    const db = {
      dSARRequest: {
        findFirst: vi.fn(async () => ({ id: "dsar-1", organizationId: "org-a" })),
        findUnique: vi.fn(async () => {
          order.push("read");
          return { id: "dsar-1" };
        }),
      },
      dSARAuditLog: {
        create: vi.fn(async () => {
          order.push("log");
          return {};
        }),
      },
    };
    await supportReadDsar(db as unknown as SupportDb, { request: "PUB-1", operator: "op", reason: "ticket 9" }, NOW);
    expect(order).toEqual(["log", "read"]);
    expect(db.dSARAuditLog.create).toHaveBeenCalledWith({
      data: {
        dsarRequestId: "dsar-1",
        action: SUPPORT_ACTION,
        performedBy: "SUPPORT:op",
        details: { reason: "ticket 9", at: NOW.toISOString() },
      },
    });
  });

  it("refuses without a reason, and reads nothing", async () => {
    const db = { dSARRequest: { findFirst: vi.fn(), findUnique: vi.fn() }, dSARAuditLog: { create: vi.fn() } };
    await expect(supportReadDsar(db as unknown as SupportDb, { request: "PUB-1", operator: "op", reason: " " })).rejects.toThrow(
      "Say why"
    );
    expect(db.dSARRequest.findUnique).not.toHaveBeenCalled();
  });
});

// ── Texts ───────────────────────────────────────────────────────────────

describe("the extension e-mail to the requester", () => {
  const base = { requesterName: "Ana", organizationName: "Acme", publicId: "PUB-1", newDueDate: new Date("2027-01-15T12:00:00Z") };

  it("states the new date, the reference and that the reasons follow, in Spanish", () => {
    const mail = renderExtensionEmail({ ...base, locale: "es" });
    expect(mail.subject).toBe("Acme: nueva fecha para tu solicitud");
    expect(mail.text).toContain("15 de enero de 2027");
    expect(mail.text).toContain("te enviará los motivos");
    expect(mail.text).toContain("PUB-1");
    expect(mail.text).not.toMatch(/—/);
  });

  it("in English when the language is unknown", () => {
    const mail = renderExtensionEmail(base);
    expect(mail.text).toContain("The new date is January 15, 2027.");
    expect(mail.text).toContain("Acme will send you the reasons for the extension.");
  });
});

describe("generated task titles", () => {
  it("are in Spanish for a Spanish reader, English otherwise", () => {
    expect(generatedTaskText("es", { asset: "CRM", requester: "Ana" })).toEqual({
      title: "Buscar y extraer los datos de CRM",
      description: "Identificar y extraer los datos personales de Ana que hay en CRM.",
    });
    expect(generatedTaskText("en", { asset: "CRM", requester: "Ana" }).title).toBe("Search and extract data from CRM");
  });
});

describe("repeated access requests (LOPDGDD art. 13.3)", () => {
  const request = {
    id: "dsar-2",
    organizationId: "org-a",
    type: "ACCESS",
    requesterEmail: "Ana@Example.com",
    receivedAt: new Date("2026-10-11T00:00:00Z"),
  };

  it("looks for access requests from the same address in the six months before, any case", async () => {
    const findMany = vi.fn(async () => [{ receivedAt: new Date("2026-08-01T00:00:00Z") }]);
    const result = await countRecentAccessRequests({ dSARRequest: { findMany } }, request);
    expect(result).toEqual({ count: 1, lastReceivedAt: new Date("2026-08-01T00:00:00Z") });
    expect(findMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org-a",
        id: { not: "dsar-2" },
        type: "ACCESS",
        requesterEmail: { equals: "Ana@Example.com", mode: "insensitive" },
        receivedAt: { gte: new Date("2026-04-11T00:00:00Z"), lte: request.receivedAt },
      },
      select: { receivedAt: true },
      orderBy: { receivedAt: "desc" },
    });
  });

  it("says nothing for other request types, redacted requests, or no earlier request", async () => {
    const findMany = vi.fn(async () => []);
    expect(await countRecentAccessRequests({ dSARRequest: { findMany } }, { ...request, type: "ERASURE" })).toBeNull();
    expect(await countRecentAccessRequests({ dSARRequest: { findMany } }, { ...request, redactedAt: new Date() })).toBeNull();
    expect(await countRecentAccessRequests({ dSARRequest: { findMany } }, request)).toBeNull();
  });
});

beforeEach(() => vi.clearAllMocks());
