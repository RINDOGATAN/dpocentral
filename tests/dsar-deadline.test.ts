// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Rights-request deadlines in the unit the law uses. GDPR art. 12(3) gives
 * one month of receipt, extendable by two further months; Regulation
 * 1182/71 art. 3(2)(c) ends a month period on the same day number, or on
 * the last day of the month when that day does not exist. Laws stated in
 * days (CCPA/CPRA 45 + 45, LGPD 15) keep their days.
 *
 * Dates are built with the local-time constructor because date-fns works in
 * local time: new Date(2026, 0, 31) is 31 January 2026.
 */

import { describe, it, expect } from "vitest";
import {
  addPeriod,
  dsarDueDate,
  dsarExtendedDueDate,
  dsarExtensionState,
  earliestDsarDeadline,
  dsarSlaStatus,
  dsarReminderThreshold,
  daysUntilDue,
  type DsarDeadlineRule,
} from "@/lib/dsar-deadline";
import {
  dsarDeadlineRuleFor,
  dsarDeadlineMonths,
  DEFAULT_DSAR_RULE,
} from "@/server/services/privacy/slaCalculator";
import { JURISDICTION_CATALOG } from "@/config/jurisdiction-catalog";
import { JURISDICTION_CORE_DATA } from "@/config/jurisdiction-data";

const d = (y: number, m: number, day: number, h = 10) => new Date(y, m - 1, day, h, 0, 0);
const ymd = (x: Date) =>
  `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;

const GDPR = dsarDeadlineRuleFor("GDPR", 30);
const CCPA = dsarDeadlineRuleFor("CCPA", 45);
const LGPD = dsarDeadlineRuleFor("LGPD", 15);

describe("month arithmetic (Regulation 1182/71)", () => {
  it.each([
    [d(2026, 1, 15), "2026-02-15"],
    [d(2026, 1, 31), "2026-02-28"], // no 31 February
    [d(2028, 1, 31), "2028-02-29"], // leap year
    [d(2028, 1, 29), "2028-02-29"],
    [d(2026, 1, 29), "2026-02-28"],
    [d(2026, 1, 30), "2026-02-28"],
    [d(2026, 3, 31), "2026-04-30"], // no 31 April
    [d(2026, 4, 30), "2026-05-30"],
    [d(2026, 5, 31), "2026-06-30"],
    [d(2026, 8, 31), "2026-09-30"],
    [d(2026, 12, 31), "2027-01-31"], // across the year
    [d(2026, 2, 28), "2026-03-28"], // not to the end of March
  ])("one month from %s ends on %s", (receivedAt, expected) => {
    expect(ymd(dsarDueDate(receivedAt, GDPR))).toBe(expected);
  });

  it("keeps the time of day", () => {
    expect(dsarDueDate(d(2026, 1, 31, 16), GDPR).getHours()).toBe(16);
  });

  it("is not 30 days", () => {
    // 1 March + 30 days = 31 March; + one month = 1 April
    expect(ymd(addPeriod(d(2026, 3, 1), { amount: 30, unit: "days" }))).toBe("2026-03-31");
    expect(ymd(dsarDueDate(d(2026, 3, 1), GDPR))).toBe("2026-04-01");
    // 1 February + 30 days = 3 March; + one month = 1 March
    expect(ymd(dsarDueDate(d(2026, 2, 1), GDPR))).toBe("2026-03-01");
  });
});

describe("laws stated in days keep days", () => {
  it("CCPA/CPRA: 45 days", () => {
    expect(CCPA.deadline).toEqual({ amount: 45, unit: "days" });
    expect(ymd(dsarDueDate(d(2026, 1, 31), CCPA))).toBe("2026-03-17");
  });

  it("LGPD: 15 days, no extension", () => {
    expect(LGPD).toEqual({ deadline: { amount: 15, unit: "days" }, extension: null });
  });

  it("the stored days of the jurisdiction row still win for day laws", () => {
    expect(dsarDeadlineRuleFor("CCPA", 40).deadline).toEqual({ amount: 40, unit: "days" });
  });

  it("an unknown code uses the stored days", () => {
    expect(dsarDeadlineRuleFor("XX-UNKNOWN", 21)).toEqual({
      deadline: { amount: 21, unit: "days" },
      extension: null,
    });
  });
});

describe("which frameworks run in months", () => {
  it("GDPR and UK GDPR: one month, extendable by two months", () => {
    for (const code of ["GDPR", "UK-GDPR"]) {
      expect(dsarDeadlineRuleFor(code, 30)).toEqual({
        deadline: { amount: 1, unit: "months" },
        extension: { amount: 2, unit: "months" },
      });
      expect(dsarDeadlineMonths(code, 30)).toBe(1);
    }
  });

  it("the month frameworks are exactly GDPR and UK GDPR, in both lists", () => {
    const catalog = JURISDICTION_CATALOG.filter((j) => j.dsarDeadlineMonths).map((j) => j.code);
    const core = JURISDICTION_CORE_DATA.filter((j) => j.dsarDeadlineMonths).map((j) => j.code);
    expect(catalog.sort()).toEqual(["GDPR", "UK-GDPR"]);
    expect(core.sort()).toEqual(["GDPR", "UK-GDPR"]);
  });

  it("no organisation jurisdiction: the GDPR rule", () => {
    expect(dsarDeadlineRuleFor(null, null)).toEqual(DEFAULT_DSAR_RULE);
    expect(DEFAULT_DSAR_RULE.deadline).toEqual({ amount: 1, unit: "months" });
  });
});

describe("extension", () => {
  it("GDPR: two further months, counted with the first from receipt", () => {
    const received = d(2026, 1, 31);
    const due = dsarDueDate(received, GDPR); // 28 Feb
    expect(ymd(dsarExtendedDueDate(received, due, GDPR)!)).toBe("2026-04-30");
  });

  it("GDPR in a leap year and at a plain date", () => {
    const r1 = d(2027, 11, 30);
    expect(ymd(dsarExtendedDueDate(r1, dsarDueDate(r1, GDPR), GDPR)!)).toBe("2028-02-29");
    const r2 = d(2026, 9, 3);
    expect(ymd(dsarExtendedDueDate(r2, dsarDueDate(r2, GDPR), GDPR)!)).toBe("2026-12-03");
  });

  it("CCPA/CPRA: 45 further days", () => {
    const received = d(2026, 1, 1);
    expect(ymd(dsarExtendedDueDate(received, dsarDueDate(received, CCPA), CCPA)!)).toBe("2026-04-01");
  });

  it("a law without extension gives null", () => {
    const received = d(2026, 1, 1);
    expect(dsarExtendedDueDate(received, dsarDueDate(received, LGPD), LGPD)).toBeNull();
  });

  it("an old request stored at receipt + 30 days is extended to three months from receipt", () => {
    const received = d(2026, 3, 1);
    const storedDue = addPeriod(received, { amount: 30, unit: "days" }); // 31 March
    expect(ymd(dsarExtendedDueDate(received, storedDue, GDPR)!)).toBe("2026-06-01");
  });

  it("never shortens a due date already later than the extension", () => {
    const received = d(2026, 1, 1);
    const late = d(2026, 6, 1);
    expect(dsarExtendedDueDate(received, late, GDPR)).toBe(late);
  });
});

describe("most restrictive wins, compared as due dates", () => {
  const thirtyDays: DsarDeadlineRule = { deadline: { amount: 30, unit: "days" }, extension: null };

  it("LGPD's 15 days beat GDPR's month", () => {
    const best = earliestDsarDeadline(d(2026, 1, 31), [GDPR, CCPA, LGPD]);
    expect(best!.rule).toBe(LGPD);
    expect(ymd(best!.dueDate)).toBe("2026-02-15");
  });

  it("in February one month is shorter than 30 days", () => {
    // 1 Feb: one month = 1 March, 30 days = 3 March
    const best = earliestDsarDeadline(d(2026, 2, 1), [thirtyDays, GDPR]);
    expect(best!.rule).toBe(GDPR);
  });

  it("in a 31-day month 30 days are shorter than one month", () => {
    // 1 March: 30 days = 31 March, one month = 1 April
    const best = earliestDsarDeadline(d(2026, 3, 1), [GDPR, thirtyDays]);
    expect(best!.rule).toBe(thirtyDays);
  });

  it("ties keep the first rule; an empty list gives null", () => {
    const best = earliestDsarDeadline(d(2026, 4, 1), [GDPR, thirtyDays]); // both 1 May
    expect(best!.index).toBe(0);
    expect(earliestDsarDeadline(d(2026, 4, 1), [])).toBeNull();
  });
});

describe("reminders and SLA status run on the due date", () => {
  const received = d(2026, 1, 31, 9);
  const due = dsarDueDate(received, GDPR); // 28 Feb 2026, 09:00

  it.each([
    [d(2026, 2, 20, 9), 8, null, "on_track"],
    [d(2026, 2, 21, 9), 7, 7, "at_risk"],
    [d(2026, 2, 25, 9), 3, 3, "at_risk"],
    [d(2026, 2, 27, 9), 1, 1, "at_risk"],
    [d(2026, 2, 28, 8), 1, 1, "at_risk"],
    [d(2026, 3, 1, 9), -1, null, "overdue"],
  ])("at %s: %i days left, reminder %s, %s", (now, days, reminder, status) => {
    expect(daysUntilDue(due, now)).toBe(days);
    expect(dsarReminderThreshold(due, now)).toBe(reminder);
    expect(dsarSlaStatus(due, now)).toBe(status);
  });

  it("the 7-day reminder of a 31 January request falls on 21 February, not 23 February", () => {
    // a 30-day rule would have put the due date on 2 March
    expect(ymd(addPeriod(received, { amount: 30, unit: "days" }))).toBe("2026-03-02");
    expect(dsarReminderThreshold(due, d(2026, 2, 21, 9))).toBe(7);
  });
});

describe("dsarExtensionState: the Extend deadline button", () => {
  const open = (receivedAt: Date, dueDate: Date, extra: Partial<{ status: string; extendedDueDate: Date | null }> = {}) => ({
    status: "IN_PROGRESS",
    receivedAt,
    dueDate,
    extendedDueDate: null,
    ...extra,
  });

  it("GDPR: allowed once, to three months from receipt; tell the person by the first due date", () => {
    const state = dsarExtensionState(open(d(2026, 1, 31), d(2026, 2, 28)), GDPR);
    expect(state.allowed).toBe(true);
    if (!state.allowed) return;
    expect(ymd(state.newDueDate)).toBe("2026-04-30");
    expect(ymd(state.tellBy)).toBe("2026-02-28");
  });

  it("CCPA/CPRA: allowed, 45 further days", () => {
    const state = dsarExtensionState(open(d(2026, 1, 1), d(2026, 2, 15)), CCPA);
    expect(state.allowed && ymd(state.newDueDate)).toBe("2026-04-01");
  });

  it("refused where the law allows none", () => {
    expect(dsarExtensionState(open(d(2026, 1, 1), d(2026, 1, 16)), LGPD)).toEqual({
      allowed: false,
      reason: "no_extension",
    });
  });

  it("refused once extended (recorded, or already at the longest period)", () => {
    expect(
      dsarExtensionState(open(d(2026, 1, 31), d(2026, 2, 28), { extendedDueDate: d(2026, 3, 10) }), GDPR)
    ).toEqual({ allowed: false, reason: "already_extended" });
    expect(dsarExtensionState(open(d(2026, 1, 31), d(2026, 4, 30)), GDPR)).toEqual({
      allowed: false,
      reason: "already_extended",
    });
  });

  it("refused on a closed request", () => {
    for (const status of ["COMPLETED", "REJECTED", "CANCELLED"]) {
      expect(dsarExtensionState(open(d(2026, 1, 31), d(2026, 2, 28), { status }), GDPR)).toEqual({
        allowed: false,
        reason: "closed",
      });
    }
  });
});
