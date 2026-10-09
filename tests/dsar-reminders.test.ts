// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Rights-request deadline reminders (src/server/services/dsar/deadlineReminders.ts):
 *
 *  - one e-mail at 7, 3 and 1 day before the real due date, and one once
 *    overdue; only the point reached today (a missed day does not send
 *    every skipped reminder);
 *  - never twice: the record in dsar_reminders is the guard, and an
 *    extended deadline is reminded again;
 *  - recipients: assignees of open tasks, else privacy officers, admins
 *    and owners; each in their own language, with a link to the request;
 *  - closed requests and organisations that switched reminders off are
 *    not read; without a mail service nothing is sent or recorded.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import {
  renderReminderEmail,
  runDsarDeadlineReminders,
  type ReminderMail,
  type ReminderMailer,
} from "@/server/services/dsar/deadlineReminders";
import { dsarReminderKind } from "@/lib/dsar-deadline";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-10-08T07:00:00Z");
const inDays = (n: number, base = NOW) => new Date(base.getTime() + n * DAY);

interface Req {
  id: string;
  organizationId: string;
  publicId: string;
  type: "ACCESS";
  status: string;
  receivedAt: Date;
  dueDate: Date;
  organization: { name: string; dsarRemindersEnabled: boolean };
  tasks: { assigneeId: string | null; status: string }[];
}

interface Member {
  organizationId: string;
  userId: string;
  role: "OWNER" | "ADMIN" | "PRIVACY_OFFICER" | "MEMBER" | "VIEWER";
  user: { email: string; locale: string | null };
}

function makeDb(requests: Req[], members: Member[]) {
  const reminders: { id: string; dsarRequestId: string; kind: string; dueDate: Date }[] = [];
  let seq = 0;
  const db = {
    reminders,
    dSARRequest: {
      findMany: vi.fn(async (args: { where: { status: { notIn: string[] }; dueDate: { lte: Date }; organization: { dsarRemindersEnabled: boolean } } }) => {
        const w = args.where;
        return requests
          .filter(
            (r) =>
              !w.status.notIn.includes(r.status) &&
              r.dueDate.getTime() <= w.dueDate.lte.getTime() &&
              r.organization.dsarRemindersEnabled === w.organization.dsarRemindersEnabled
          )
          .map((r) => ({
            ...r,
            organization: { name: r.organization.name },
            tasks: r.tasks
              .filter((t) => t.assigneeId && !["COMPLETED", "NOT_APPLICABLE"].includes(t.status))
              .map((t) => ({ assigneeId: t.assigneeId })),
            reminders: reminders
              .filter((x) => x.dsarRequestId === r.id)
              .map((x) => ({ kind: x.kind, dueDate: x.dueDate })),
          }));
      }),
    },
    organizationMember: {
      findMany: vi.fn(async (args: { where: { organizationId: string } }) =>
        members.filter((m) => m.organizationId === args.where.organizationId)
      ),
    },
    dsarReminder: {
      create: vi.fn(async (args: { data: { dsarRequestId: string; kind: string; dueDate: Date } }) => {
        const d = args.data;
        if (reminders.some((x) => x.dsarRequestId === d.dsarRequestId && x.kind === d.kind && x.dueDate.getTime() === d.dueDate.getTime())) {
          throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
        }
        const row = { id: `rem-${++seq}`, ...d };
        reminders.push(row);
        return { id: row.id };
      }),
      delete: vi.fn(async (args: { where: { id: string } }) => {
        const i = reminders.findIndex((x) => x.id === args.where.id);
        if (i >= 0) reminders.splice(i, 1);
        return {};
      }),
    },
    dSARAuditLog: { create: vi.fn(async () => ({})) },
  };
  return db;
}

function recordingMailer(fail = false): ReminderMailer & { sent: ReminderMail[] } {
  const sent: ReminderMail[] = [];
  return {
    sent,
    async send(mail) {
      if (fail) throw new Error("refused");
      sent.push(mail);
    },
  };
}

const ORG = { name: "Org A", dsarRemindersEnabled: true };

function request(overrides: Partial<Req> = {}): Req {
  return {
    id: "dsar-1",
    organizationId: "org-a",
    publicId: "REF-1",
    type: "ACCESS",
    status: "IN_PROGRESS",
    receivedAt: inDays(-23),
    dueDate: inDays(7),
    organization: ORG,
    tasks: [],
    ...overrides,
  };
}

const MEMBERS: Member[] = [
  { organizationId: "org-a", userId: "owner", role: "OWNER", user: { email: "owner@test.example", locale: "en" } },
  { organizationId: "org-a", userId: "officer", role: "PRIVACY_OFFICER", user: { email: "officer@test.example", locale: "es" } },
  { organizationId: "org-a", userId: "member", role: "MEMBER", user: { email: "member@test.example", locale: "es" } },
  { organizationId: "org-a", userId: "viewer", role: "VIEWER", user: { email: "viewer@test.example", locale: null } },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("dsarReminderKind: the point reached today", () => {
  it("7, 3 and 1 day before, overdue after, nothing further away", () => {
    expect(dsarReminderKind(inDays(10), NOW)).toBeNull();
    expect(dsarReminderKind(inDays(7), NOW)).toBe("DAYS_7");
    expect(dsarReminderKind(inDays(5), NOW)).toBe("DAYS_7");
    expect(dsarReminderKind(inDays(3), NOW)).toBe("DAYS_3");
    expect(dsarReminderKind(inDays(2), NOW)).toBe("DAYS_3");
    expect(dsarReminderKind(inDays(1), NOW)).toBe("DAYS_1");
    expect(dsarReminderKind(new Date(NOW.getTime() + 60 * 60 * 1000), NOW)).toBe("DAYS_1");
    expect(dsarReminderKind(inDays(-1), NOW)).toBe("OVERDUE");
  });

  it("a month-based deadline is reminded from its real due date", () => {
    // GDPR: received 31 January, due 28 February (not 2 March).
    const due = new Date(2026, 1, 28, 10);
    expect(dsarReminderKind(due, new Date(2026, 1, 21, 10))).toBe("DAYS_7");
    expect(dsarReminderKind(due, new Date(2026, 1, 20, 10))).toBeNull();
  });
});

describe("runDsarDeadlineReminders", () => {
  it("sends the 7-day reminder once, records it, and logs it on the request", async () => {
    const db = makeDb([request()], MEMBERS);
    const mailer = recordingMailer();
    const first = await runDsarDeadlineReminders(db as never, mailer, NOW);
    expect(first.sent).toBe(1);
    expect(db.reminders).toHaveLength(1);
    expect(db.reminders[0]).toMatchObject({ dsarRequestId: "dsar-1", kind: "DAYS_7" });
    expect(db.dSARAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "DEADLINE_REMINDER_SENT", performedBy: "SYSTEM" }),
      })
    );

    // Same day again, and the next day (still within the 7-day point): nothing new.
    const again = await runDsarDeadlineReminders(db as never, mailer, NOW);
    const nextDay = await runDsarDeadlineReminders(db as never, mailer, inDays(1));
    expect(again.sent + nextDay.sent).toBe(0);
    expect(again.alreadySent).toBe(1);
    expect(mailer.sent).toHaveLength(2); // owner + officer, once
  });

  it("walks 7, 3, 1 and overdue, one e-mail each, and never repeats overdue", async () => {
    const due = inDays(7);
    const db = makeDb([request({ dueDate: due })], [MEMBERS[0]]);
    const mailer = recordingMailer();
    for (const day of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      await runDsarDeadlineReminders(db as never, mailer, inDays(day));
    }
    expect(db.reminders.map((r) => r.kind)).toEqual(["DAYS_7", "DAYS_3", "DAYS_1", "OVERDUE"]);
    expect(mailer.sent).toHaveLength(4);
  });

  it("a missed day sends only the nearer reminder", async () => {
    const db = makeDb([request({ dueDate: inDays(2) })], [MEMBERS[0]]);
    const mailer = recordingMailer();
    await runDsarDeadlineReminders(db as never, mailer, NOW);
    expect(db.reminders.map((r) => r.kind)).toEqual(["DAYS_3"]);
  });

  it("a concurrent run that loses the claim sends nothing", async () => {
    const db = makeDb([request()], [MEMBERS[0]]);
    // Another run recorded it between our read and our claim.
    db.dsarReminder.create.mockRejectedValueOnce(Object.assign(new Error("dup"), { code: "P2002" }));
    const mailer = recordingMailer();
    const summary = await runDsarDeadlineReminders(db as never, mailer, NOW);
    expect(summary.sent).toBe(0);
    expect(summary.alreadySent).toBe(1);
    expect(mailer.sent).toHaveLength(0);
  });

  it("an extended deadline is reminded again before the new date", async () => {
    const req = request({ dueDate: inDays(7) });
    const db = makeDb([req], [MEMBERS[0]]);
    const mailer = recordingMailer();
    await runDsarDeadlineReminders(db as never, mailer, NOW);
    req.dueDate = inDays(60);
    await runDsarDeadlineReminders(db as never, mailer, inDays(53));
    expect(db.reminders.map((r) => r.kind)).toEqual(["DAYS_7", "DAYS_7"]);
    expect(mailer.sent).toHaveLength(2);
  });

  it("when no e-mail could be sent, the record is removed so the next run tries again", async () => {
    const db = makeDb([request()], [MEMBERS[0]]);
    const summary = await runDsarDeadlineReminders(db as never, recordingMailer(true), NOW);
    expect(summary.errors).toBe(1);
    expect(db.reminders).toHaveLength(0);
    const retry = recordingMailer();
    await runDsarDeadlineReminders(db as never, retry, inDays(1));
    expect(retry.sent).toHaveLength(1);
  });

  it("closed requests are not read", async () => {
    const db = makeDb(
      [
        request({ id: "a", status: "COMPLETED" }),
        request({ id: "b", status: "REJECTED" }),
        request({ id: "c", status: "CANCELLED" }),
      ],
      MEMBERS
    );
    const mailer = recordingMailer();
    const summary = await runDsarDeadlineReminders(db as never, mailer, NOW);
    expect(summary.checked).toBe(0);
    expect(mailer.sent).toHaveLength(0);
    expect(db.dSARRequest.findMany.mock.calls[0][0].where.status.notIn).toEqual(
      expect.arrayContaining(["COMPLETED", "REJECTED", "CANCELLED"])
    );
  });

  it("an organisation that switched reminders off gets none", async () => {
    const db = makeDb([request({ organization: { name: "Org A", dsarRemindersEnabled: false } })], MEMBERS);
    const mailer = recordingMailer();
    await runDsarDeadlineReminders(db as never, mailer, NOW);
    expect(db.dSARRequest.findMany.mock.calls[0][0].where.organization).toEqual({ dsarRemindersEnabled: true });
    expect(mailer.sent).toHaveLength(0);
    expect(db.reminders).toHaveLength(0);
  });

  it("without a mail service: nothing is sent, read or recorded", async () => {
    const db = makeDb([request()], MEMBERS);
    const summary = await runDsarDeadlineReminders(db as never, null, NOW);
    expect(summary.skipped).toBe("email-not-configured");
    expect(db.dSARRequest.findMany).not.toHaveBeenCalled();
    expect(db.reminders).toHaveLength(0);
  });

  it("goes to the assignees of open tasks when there are any", async () => {
    const db = makeDb(
      [
        request({
          tasks: [
            { assigneeId: "member", status: "IN_PROGRESS" },
            { assigneeId: "viewer", status: "COMPLETED" },
          ],
        }),
      ],
      MEMBERS
    );
    const mailer = recordingMailer();
    await runDsarDeadlineReminders(db as never, mailer, NOW);
    expect(mailer.sent.map((m) => m.to)).toEqual(["member@test.example"]);
  });

  it("with nobody assigned, goes to privacy officers, administrators and owners only", async () => {
    const db = makeDb([request({ tasks: [{ assigneeId: "gone", status: "PENDING" }] })], MEMBERS);
    const mailer = recordingMailer();
    await runDsarDeadlineReminders(db as never, mailer, NOW);
    expect(mailer.sent.map((m) => m.to).sort()).toEqual(["officer@test.example", "owner@test.example"]);
  });

  it("each recipient gets their own language and a link to the request", async () => {
    const db = makeDb([request()], MEMBERS);
    const mailer = recordingMailer();
    await runDsarDeadlineReminders(db as never, mailer, NOW);
    const en = mailer.sent.find((m) => m.to === "owner@test.example")!;
    const es = mailer.sent.find((m) => m.to === "officer@test.example")!;
    expect(en.subject).toBe("Org A: rights request due in 7 days");
    expect(es.subject).toBe("Org A: solicitud de derechos que vence en 7 días");
    for (const mail of [en, es]) {
      expect(mail.html).toContain("/privacy/dsar/dsar-1");
      expect(mail.text).toContain("/privacy/dsar/dsar-1");
      expect(mail.html).toContain("REF-1");
    }
  });
});

describe("renderReminderEmail", () => {
  const base = {
    orgName: "Org <A>",
    publicId: "REF-1",
    type: "ACCESS" as const,
    receivedAt: new Date(2026, 8, 1, 10),
    dueDate: new Date(2026, 9, 1, 10),
    link: "https://app.test.example/privacy/dsar/dsar-1",
  };

  it("English: every point has its own subject; names no requester; escapes", () => {
    const subjects = (["DAYS_7", "DAYS_3", "DAYS_1", "OVERDUE"] as const).map(
      (kind) => renderReminderEmail({ ...base, locale: "en", kind }).subject
    );
    expect(subjects).toEqual([
      "Org <A>: rights request due in 7 days",
      "Org <A>: rights request due in 3 days",
      "Org <A>: rights request due within 1 day",
      "Org <A>: rights request overdue",
    ]);
    const mail = renderReminderEmail({ ...base, locale: "en", kind: "OVERDUE" });
    expect(mail.text).toContain("passed on October 1, 2026");
    expect(mail.html).toContain("Org &lt;A&gt;");
    expect(mail.html).not.toContain("Org <A>");
    expect(mail.text).toContain("switch these reminders off");
  });

  it("Spanish: Castilian wording with tú, Spanish dates", () => {
    const mail = renderReminderEmail({ ...base, locale: "es", kind: "DAYS_3" });
    expect(mail.subject).toBe("Org <A>: solicitud de derechos que vence en 3 días");
    expect(mail.text).toContain("1 de octubre de 2026");
    expect(mail.text).toContain("Recibes este aviso");
    expect(mail.text).toContain("Abrir la solicitud");
    expect(mail.text).not.toMatch(/usted/i);
  });
});
