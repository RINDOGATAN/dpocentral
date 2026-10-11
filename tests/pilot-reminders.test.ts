// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Pilot-ending reminders (src/server/services/pilot/reminders.ts):
 *
 *  - two e-mails: at the daily run between 5 and 4 days before the end of the
 *    editing window, and at the run in its last 24 hours;
 *  - the transition: a pilot begun before 12 Oct 2026 ends with 26 Oct;
 *  - never twice (an audit-log row with a derived id is the guard), and a
 *    failed delivery is retried at the next run;
 *  - owners and administrators only;
 *  - the language: the person's setting, else Spanish for the euro market,
 *    else English;
 *  - nothing when the switch is off, off the hosted service, without a mail
 *    service, or for an organisation on the paid plan.
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import {
  endPhrase,
  isEuroMarket,
  pilotReminderKind,
  pilotRemindersEnabled,
  reminderLocale,
  renderPilotReminderEmail,
  runPilotReminders,
  type PilotReminderDb,
  type PilotReminderMail,
  type PilotReminderMailer,
} from "@/server/services/pilot/reminders";
import { pilotEndsAt } from "@/server/services/pilot/caps";

const DAY = 24 * 60 * 60 * 1000;
const ON = { PILOT_REMINDERS_ENABLED: "true", VERCEL_ENV: "production" };
/** The daily run's time (vercel.json: 15 7 * * *). */
const run = (isoDay: string) => new Date(`${isoDay}T07:15:00Z`);

type Role = "OWNER" | "ADMIN" | "PRIVACY_OFFICER" | "MEMBER" | "VIEWER";
interface Org {
  id: string;
  name: string;
  plan: "PILOT" | "EU_CLOUD";
  pilotStartedAt: Date | null;
  regions: string[];
  members: { role: Role; email: string; locale: string | null }[];
}

function makeDb(orgs: Org[]) {
  const rows = new Map<string, Record<string, unknown>>();
  const findMany = vi.fn(async (args: { where: { plan: { not: string } } }) =>
    orgs
      .filter((o) => o.plan !== args.where.plan.not && o.pilotStartedAt)
      .map((o) => ({
        id: o.id,
        name: o.name,
        plan: o.plan,
        pilotStartedAt: o.pilotStartedAt,
        jurisdictions: o.regions.map((region) => ({ jurisdiction: { region } })),
        members: o.members.map((m) => ({ role: m.role, user: { email: m.email, locale: m.locale } })),
      }))
  );
  const db = {
    rows,
    organization: { findMany },
    auditLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const id = data.id as string;
        if (rows.has(id)) throw Object.assign(new Error("Unique constraint"), { code: "P2002" });
        rows.set(id, data);
        return data;
      }),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        rows.delete(where.id);
        return {};
      }),
    },
  };
  return db;
}

const asDb = (db: ReturnType<typeof makeDb>) => db as unknown as PilotReminderDb;

function makeMailer(fail = false) {
  const sent: PilotReminderMail[] = [];
  const mailer: PilotReminderMailer = {
    send: vi.fn(async (mail: PilotReminderMail) => {
      if (fail) throw new Error("refused");
      sent.push(mail);
    }),
  };
  return { mailer, sent };
}

/** A pilot begun after the window was shortened: 15 days from 13 Oct 15:00 UTC. */
const fresh = (over: Partial<Org> = {}): Org => ({
  id: "org-fresh",
  name: "Acme",
  plan: "PILOT",
  pilotStartedAt: new Date("2026-10-13T15:00:00Z"),
  regions: [],
  members: [{ role: "OWNER", email: "owner@example.com", locale: "en" }],
  ...over,
});

describe("the send days", () => {
  it("is the run between 5 and 4 days before the end, and the run in the last 24 hours", () => {
    const end = new Date("2026-10-28T15:00:00Z");
    expect(pilotReminderKind(end, run("2026-10-23"))).toBeNull(); // 5d 8h left
    expect(pilotReminderKind(end, run("2026-10-24"))).toBe("fiveDays"); // 4d 8h
    expect(pilotReminderKind(end, run("2026-10-25"))).toBeNull();
    expect(pilotReminderKind(end, run("2026-10-27"))).toBeNull(); // 1d 8h
    expect(pilotReminderKind(end, run("2026-10-28"))).toBe("lastDay"); // 8h
    expect(pilotReminderKind(end, run("2026-10-29"))).toBeNull(); // ended
  });

  it("sends exactly two e-mails over a whole pilot, on those two days", async () => {
    const db = makeDb([fresh()]);
    const { mailer, sent } = makeMailer();
    const days: string[] = [];
    for (let t = run("2026-10-12").getTime(); t <= run("2026-11-02").getTime(); t += DAY) {
      const before = sent.length;
      await runPilotReminders(asDb(db), mailer, new Date(t), ON);
      if (sent.length > before) days.push(new Date(t).toISOString().slice(0, 10));
    }
    expect(days).toEqual(["2026-10-24", "2026-10-28"]);
    expect(sent.map((m) => m.subject)).toEqual([
      "Your DPO Central pilot ends in 5 days",
      "Last day of your DPO Central pilot",
    ]);
  });
});

describe("the transition (pilots begun before 12 Oct 2026)", () => {
  const started = new Date("2026-10-05T09:00:00Z");

  it("ends with 26 October and is reminded on 22 and 26 October", async () => {
    const end = pilotEndsAt({ pilotStartedAt: started });
    expect(end?.toISOString()).toBe("2026-10-27T00:00:00.000Z");
    const db = makeDb([fresh({ pilotStartedAt: started })]);
    const { mailer, sent } = makeMailer();
    const days: string[] = [];
    for (let t = run("2026-10-12").getTime(); t <= run("2026-10-30").getTime(); t += DAY) {
      const before = sent.length;
      await runPilotReminders(asDb(db), mailer, new Date(t), ON);
      if (sent.length > before) days.push(new Date(t).toISOString().slice(0, 10));
    }
    expect(days).toEqual(["2026-10-22", "2026-10-26"]);
  });

  it("states the end in UTC in English and in peninsular time in Spanish", () => {
    const end = new Date("2026-10-27T00:00:00Z");
    expect(endPhrase(end, "en")).toBe("at the end of 26 October 2026 (UTC)");
    expect(endPhrase(end, "es")).toBe("el 27 de octubre de 2026 a la 01:00 (hora peninsular)");
    expect(endPhrase(new Date("2026-10-28T15:00:00Z"), "en")).toBe("on 28 October 2026 at 15:00 UTC");
    expect(endPhrase(new Date("2026-10-28T15:00:00Z"), "es")).toBe(
      "el 28 de octubre de 2026 a las 16:00 (hora peninsular)"
    );
  });
});

describe("never twice", () => {
  it("records the reminder once; a second run the same day sends nothing", async () => {
    const db = makeDb([fresh()]);
    const { mailer, sent } = makeMailer();
    const first = await runPilotReminders(asDb(db), mailer, run("2026-10-24"), ON);
    const second = await runPilotReminders(asDb(db), mailer, new Date(run("2026-10-24").getTime() + 3600_000), ON);
    expect(first.sent).toBe(1);
    expect(second.sent).toBe(0);
    expect(second.alreadySent).toBe(1);
    expect(sent).toHaveLength(1);
    const [row] = [...db.rows.values()];
    expect(row).toMatchObject({ organizationId: "org-fresh", action: "PILOT_REMINDER_SENT" });
  });

  it("removes the record when nothing was delivered, so the next run tries again", async () => {
    const db = makeDb([fresh()]);
    const failing = makeMailer(true);
    const summary = await runPilotReminders(asDb(db), failing.mailer, run("2026-10-24"), ON);
    expect(summary.errors).toBe(1);
    expect(db.rows.size).toBe(0);
    const ok = makeMailer();
    await runPilotReminders(asDb(db), ok.mailer, new Date(run("2026-10-24").getTime() + 3600_000), ON);
    expect(ok.sent).toHaveLength(1);
  });
});

describe("recipients", () => {
  it("are the owners and administrators only", async () => {
    const db = makeDb([
      fresh({
        members: [
          { role: "OWNER", email: "owner@example.com", locale: "en" },
          { role: "ADMIN", email: "admin@example.com", locale: "en" },
          { role: "PRIVACY_OFFICER", email: "dpo@example.com", locale: "en" },
          { role: "MEMBER", email: "member@example.com", locale: "en" },
          { role: "VIEWER", email: "viewer@example.com", locale: "en" },
        ],
      }),
    ]);
    const { mailer, sent } = makeMailer();
    await runPilotReminders(asDb(db), mailer, run("2026-10-24"), ON);
    expect(sent.map((m) => m.to).sort()).toEqual(["admin@example.com", "owner@example.com"]);
    expect(sent.every((m) => m.replyTo.length > 0)).toBe(true);
  });

  it("asks the database for owners and administrators only", async () => {
    const db = makeDb([fresh()]);
    await runPilotReminders(asDb(db), makeMailer().mailer, run("2026-10-24"), ON);
    const args = db.organization.findMany.mock.calls[0][0] as unknown as {
      select: { members: { where: { role: { in: string[] } } } };
    };
    expect(args.select.members.where.role.in).toEqual(["OWNER", "ADMIN"]);
  });
});

describe("language", () => {
  it("follows the person's setting, then the euro market, then English", () => {
    expect(reminderLocale("es", false)).toBe("es");
    expect(reminderLocale("en", true)).toBe("en");
    expect(reminderLocale(null, true)).toBe("es");
    expect(reminderLocale(null, false)).toBe("en");
    expect(isEuroMarket(["EU"])).toBe(true);
    expect(isEuroMarket(["EU", "US-CA"])).toBe(false);
    expect(isEuroMarket(["UK"])).toBe(false);
    expect(isEuroMarket([])).toBe(false);
  });

  it("writes each e-mail in its recipient's language", async () => {
    const db = makeDb([
      fresh({
        regions: ["EU"],
        members: [
          { role: "OWNER", email: "es@example.com", locale: null },
          { role: "ADMIN", email: "en@example.com", locale: "en" },
        ],
      }),
    ]);
    const { mailer, sent } = makeMailer();
    await runPilotReminders(asDb(db), mailer, run("2026-10-24"), ON);
    const byTo = Object.fromEntries(sent.map((m) => [m.to, m]));
    expect(byTo["es@example.com"].subject).toBe("Tu piloto de DPO Central termina en 5 días");
    expect(byTo["es@example.com"].text).toContain("1.800 € al año o 179 € al mes");
    expect(byTo["es@example.com"].text).toContain("https://www.todo.law/es/contact/managed");
    expect(byTo["en@example.com"].text).toContain("$1,800 a year or $179 a month");
    expect(byTo["en@example.com"].text).toContain("https://www.todo.law/pricing");
  });
});

describe("nothing is sent", () => {
  it("when the switch is off (the default)", async () => {
    const db = makeDb([fresh()]);
    const { mailer, sent } = makeMailer();
    expect(pilotRemindersEnabled({})).toBe(false);
    const summary = await runPilotReminders(asDb(db), mailer, run("2026-10-24"), { VERCEL_ENV: "production" });
    expect(summary.skipped).toBe("switched-off");
    expect(db.organization.findMany).not.toHaveBeenCalled();
    expect(sent).toHaveLength(0);
  });

  it("off the hosted service, or without a mail service", async () => {
    const db = makeDb([fresh()]);
    const { mailer } = makeMailer();
    expect((await runPilotReminders(asDb(db), mailer, run("2026-10-24"), { PILOT_REMINDERS_ENABLED: "true" })).skipped).toBe("not-hosted");
    expect((await runPilotReminders(asDb(db), null, run("2026-10-24"), ON)).skipped).toBe("email-not-configured");
    expect(db.rows.size).toBe(0);
  });

  it("for an organisation on the paid plan", async () => {
    const db = makeDb([fresh({ plan: "EU_CLOUD" })]);
    const { mailer, sent } = makeMailer();
    await runPilotReminders(asDb(db), mailer, run("2026-10-24"), ON);
    expect(sent).toHaveLength(0);
  });

  it("before the first sign-in", async () => {
    const db = makeDb([fresh({ pilotStartedAt: null })]);
    const { mailer, sent } = makeMailer();
    await runPilotReminders(asDb(db), mailer, run("2026-10-24"), ON);
    expect(sent).toHaveLength(0);
  });
});

describe("the copy", () => {
  it("has no long dashes and states the end, the way out and the export", () => {
    for (const locale of ["en", "es"] as const) {
      for (const kind of ["fiveDays", "lastDay"] as const) {
        const mail = renderPilotReminderEmail({ locale, kind, orgName: "Acme", endsAt: new Date("2026-10-27T00:00:00Z") });
        expect(mail.subject + mail.text + mail.html).not.toMatch(/[–—]/);
        expect(mail.text).toContain("/privacy/settings#pilot-export");
        expect(mail.text).toContain(locale === "es" ? "solo lectura" : "read-only");
      }
    }
  });
});
