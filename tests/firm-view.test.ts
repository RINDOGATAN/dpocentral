// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The firm view, "All clients" as a table: the programme figure, the stages in words, the documents ready, the
 * next deadline (a breach window, a rights request due or a review coming due,
 * with its INC-/REQ- reference) and the next action, sorted by the nearest
 * deadline. Every reading is the client's own dashboard's. There is no
 * timetable: an organisation sets its own pace on the path.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { evaluateRegister, registerFor, type DocumentFacts } from "@/config/document-register";
import {
  documentsReady,
  nearestDeadline,
  sortByNearestDeadline,
  type RecordDeadline,
} from "@/lib/programme-overview";

const read = (p: string) => readFileSync(path.resolve(__dirname, "..", p), "utf8");

describe("the nearest deadline", () => {
  const breach: RecordDeadline = { kind: "breachDecision", at: "2026-10-11T09:00:00.000Z", publicId: "cinc0001abcdef", href: "/privacy/incidents/1" };
  const request: RecordDeadline = { kind: "dsarDue", at: "2026-10-20T00:00:00.000Z", publicId: "cdsr0001zyxwvu", href: "/privacy/dsar/1" };

  it("is the earliest of the breach windows and the requests due; no invented plan date", () => {
    expect(nearestDeadline([request, breach])).toBe(breach);
    expect(nearestDeadline([request])).toBe(request);
    expect(nearestDeadline([])).toBeNull();
  });

  it("puts an overdue one first", () => {
    const overdue: RecordDeadline = { ...request, at: "2026-09-01T00:00:00.000Z" };
    expect(nearestDeadline([breach, overdue])).toBe(overdue);
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
    processingActivitiesComplete: 2,
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
    for (const fn of ["figureFor(", "programmeAreas(", "nextActions(", "nearestDeadline(", "documentsReady(", "sortByNearestDeadline("]) {
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
    // No timetable anywhere in the firm view.
    expect(page).not.toMatch(/planState|planMilestone|PLAN_WINDOWS|deadlines\.plan/);
    expect(router).not.toMatch(/planStart|loadPlanStart/);
  });

  it("has its words in both languages", () => {
    expect(en.portfolio.columns).toEqual({
      client: "Client",
      confirmed: "Progress",
      areas: "Stages",
      documents: "Documents ready",
      deadline: "Next due",
      action: "Next action",
      menu: "More",
    });
    expect(Object.keys(es.portfolio.columns)).toEqual(Object.keys(en.portfolio.columns));
    expect(es.portfolio.docsReady).toBe("{ready} de {total} listos");
  });
});
