// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The firm view, "All clients" as a table (owner's decision d9, 9 October
 * 2026): the confirmed figure, the areas in words, the documents ready, the
 * next deadline (a breach window, a rights request due or the plan's next
 * milestone, with its INC-/REQ- reference) and the next action, sorted by the
 * nearest deadline. Every reading is the client's own dashboard's.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { DPO_CENTRAL_PATH, PLAN_WINDOWS } from "@/components/guided/path-config";
import { planState } from "@/components/guided/plan";
import { evaluateRegister, registerFor, type DocumentFacts } from "@/config/document-register";
import {
  documentsReady,
  nearestDeadline,
  planMilestone,
  sortByNearestDeadline,
  type RecordDeadline,
} from "@/lib/programme-overview";

const read = (p: string) => readFileSync(path.resolve(__dirname, "..", p), "utf8");
const DAY = 24 * 60 * 60 * 1000;

describe("the plan's next milestone", () => {
  const start = new Date("2026-10-01T00:00:00.000Z");
  const statuses = {};

  it("is the last day of the window the plan is in, while it runs", () => {
    const plan = planState(DPO_CENTRAL_PATH, PLAN_WINDOWS, statuses, start, new Date("2026-10-09T12:00:00Z"));
    expect(plan.kind).toBe("running");
    const m = planMilestone(PLAN_WINDOWS, start, plan)!;
    expect(m.day).toBe(30);
    expect(m.at.toISOString()).toBe(new Date(start.getTime() + 29 * DAY).toISOString());
    const later = planState(DPO_CENTRAL_PATH, PLAN_WINDOWS, statuses, start, new Date("2026-11-15T12:00:00Z"));
    expect(planMilestone(PLAN_WINDOWS, start, later)!.day).toBe(60);
  });

  it("is none before the plan starts and after it ends", () => {
    expect(planMilestone(PLAN_WINDOWS, null, { kind: "notStarted" })).toBeNull();
    const after = planState(DPO_CENTRAL_PATH, PLAN_WINDOWS, statuses, start, new Date("2027-03-01T00:00:00Z"));
    expect(planMilestone(PLAN_WINDOWS, start, after)).toBeNull();
  });
});

describe("the nearest deadline", () => {
  const breach: RecordDeadline = { kind: "breachDecision", at: "2026-10-11T09:00:00.000Z", publicId: "cinc0001abcdef", href: "/privacy/incidents/1" };
  const request: RecordDeadline = { kind: "dsarDue", at: "2026-10-20T00:00:00.000Z", publicId: "cdsr0001zyxwvu", href: "/privacy/dsar/1" };

  it("is the earliest of the breach windows, the requests due and the plan milestone", () => {
    expect(nearestDeadline([request, breach], { day: 30, at: new Date("2026-10-30T00:00:00Z") })).toBe(breach);
    expect(nearestDeadline([request], { day: 30, at: new Date("2026-10-15T00:00:00Z") })).toEqual({
      kind: "plan",
      day: 30,
      at: "2026-10-15T00:00:00.000Z",
    });
    expect(nearestDeadline([], null)).toBeNull();
  });

  it("puts an overdue one first", () => {
    const overdue: RecordDeadline = { ...request, at: "2026-09-01T00:00:00.000Z" };
    expect(nearestDeadline([breach, overdue], null)).toBe(overdue);
  });
});

describe("the order of the rows", () => {
  it("is the nearest deadline first, then the clients with none, by name", () => {
    const rows = [
      { name: "Northside Dental", deadline: null },
      { name: "Harbour Bakery", deadline: { at: "2026-10-11T09:00:00.000Z" } },
      { name: "Eastgate Physio", deadline: { at: "2026-10-30T00:00:00.000Z" } },
      { name: "Acme", deadline: null },
      { name: "Overdue Ltd", deadline: { at: "2026-09-01T00:00:00.000Z" } },
    ];
    expect(sortByNearestDeadline(rows).map((r) => r.name)).toEqual([
      "Overdue Ltd",
      "Harbour Bakery",
      "Eastgate Physio",
      "Acme",
      "Northside Dental",
    ]);
  });
});

describe("documents ready", () => {
  const facts = {
    quickstartCompleted: true,
    jurisdictions: 1,
    dataAssets: 2,
    dataAssetsDrafts: 0,
    processingActivities: 2,
    processingActivitiesDrafts: 0,
    vendors: 1,
    vendorsDrafts: 0,
    assessments: 0,
    assessmentsApproved: 0,
    dsarRequests: 0,
    incidents: 0,
    activitiesIncomplete: 0,
    dpiaAssessments: 0,
    dpiaApproved: 0,
    dpiaAccess: "module",
    dpaContracts: 0,
    incidentsMissingImpact: 0,
    incidentNotifications: 0,
    aiAssistOn: false,
    dsarCompleted: 0,
  } as unknown as DocumentFacts;

  it("counts the ready ones out of every document DPO Central produces here", () => {
    // Regulatory report, ROPA, vendor register and the programme report are ready.
    expect(documentsReady(evaluateRegister(registerFor({ dsarEnabled: true }), facts))).toEqual({ ready: 5, total: 12 });
    // Without the rights-request module its report is not counted.
    expect(documentsReady(evaluateRegister(registerFor({ dsarEnabled: false }), facts))).toEqual({ ready: 5, total: 11 });
  });
});

describe("the page and the server read what the dashboard reads", () => {
  const page = read("src/app/(dashboard)/privacy/clients/page.tsx");
  const router = read("src/server/routers/privacy/clients.ts");

  it("takes the figure, the areas, the next action and the deadline from the dashboard's functions", () => {
    for (const fn of ["figureFor(", "programmeAreas(", "nextActions(", "nearestDeadline(", "planMilestone(", "documentsReady(", "sortByNearestDeadline("]) {
      expect(page, fn).toContain(fn);
    }
    for (const fn of ["loadDocumentFacts(", "collectNeedsAction(", "loadDeadlines(", "evaluateRegister(", "loadBusinessUnitScope("]) {
      expect(router, fn).toContain(fn);
    }
  });

  it("is a table on wide screens and cards on a phone, with the same fields", () => {
    expect(page).toContain('className="hidden lg:block"');
    expect(page).toContain('className="flex flex-col gap-3 lg:hidden"');
    for (const col of ["client", "confirmed", "areas", "documents", "deadline", "action"]) {
      expect(page).toContain(`t("columns.${col}")`);
    }
    // "Add a client" stays (clarity defect F7).
    expect(page).toContain('t("addClient")');
  });

  it("has its words in both languages", () => {
    expect(en.portfolio.columns).toEqual({
      client: "Client",
      confirmed: "Confirmed",
      areas: "Areas",
      documents: "Documents ready",
      deadline: "Next deadline",
      action: "Next action",
      menu: "More",
    });
    expect(Object.keys(es.portfolio.columns)).toEqual(Object.keys(en.portfolio.columns));
    expect(es.portfolio.docsReady).toBe("{ready} de {total} listos");
  });
});
