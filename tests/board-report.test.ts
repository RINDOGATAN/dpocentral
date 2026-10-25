// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The board report: the first document
 * that was "not in DPO Central yet" is now produced.
 *
 * - the period: the last full quarter by default, presets, and what is refused;
 * - the register: ready with one confirmed step, otherwise it needs one; the
 *   menu line under "Executive report"; the step is optional, so the
 *   programme figure does not move;
 * - the readings: the top three risks or gaps, the next three actions with an
 *   owner and a date;
 * - the data over a mocked database: incidents notified within 72 hours,
 *   rights requests on time and overdue, vendors with a DPA, the switch for
 *   the rights-request module;
 * - the comment, saved in the organisation's settings without touching the rest;
 * - the words, the same on the page and in the PDF, in English and Spanish,
 *   with no long dash and no claim of compliance; the PDF renders.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTranslator } from "next-intl";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import {
  documentEntry,
  evaluateRegister,
  registerFor,
  type DocumentFacts,
  type EvaluatedDocument,
} from "@/config/document-register";
import { DPO_CENTRAL_PATH, EMPTY_PATH_COUNTS } from "@/components/guided/path-config";
import { evaluatePath, programFigure } from "@/components/guided/path";
import { stepDocumentRows, notYetEntries } from "@/lib/programme-overview";
import {
  boardActions,
  periodBounds,
  periodPreset,
  presetPeriod,
  resolvePeriod,
  topRisks,
  type BoardReport,
} from "@/lib/board-report";
import { boardReportText, formatBoardDate } from "@/lib/board-report-text";
import type { NeedsActionItem } from "@/lib/needs-action";
import { collectText } from "./pdf-text";

const mocks = vi.hoisted(() => ({
  facts: null as unknown,
  needs: [] as unknown[],
  deadlines: [] as unknown[],
  dsarOn: true,
  prisma: {
    organizationMember: { findMany: vi.fn() },
    organization: { findFirst: vi.fn(), update: vi.fn() },
    incident: { findMany: vi.fn(), count: vi.fn() },
    dSARRequest: { findMany: vi.fn(), count: vi.fn() },
    vendor: { count: vi.fn() },
    assessment: { count: vi.fn() },
    user: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/server/services/program/document-facts", () => ({ loadDocumentFacts: async () => mocks.facts }));
vi.mock("@/server/services/views/queries", () => ({
  collectNeedsAction: async () => ({ items: mocks.needs, total: 0, departmentScoped: false }),
}));
vi.mock("@/server/services/program/deadlines", () => ({ loadDeadlines: async () => mocks.deadlines }));
vi.mock("@/config/features", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config/features")>();
  return { ...actual, isDsarModuleEnabled: () => mocks.dsarOn };
});

const NOW = new Date("2026-10-09T12:00:00Z");

const FACTS: DocumentFacts = {
  ...EMPTY_PATH_COUNTS,
  activitiesIncomplete: 0,
  dpiaAssessments: 0,
  dpiaApproved: 0,
  dpiaAccess: "available",
  dpaContracts: 0,
  incidentsMissingImpact: 0,
  incidentNotifications: 0,
  aiAssistOn: false,
  dsarCompleted: 0,
};

const tr = (bundle: typeof en, locale: "en" | "es") => ({
  board: createTranslator({ locale, messages: bundle, namespace: "boardReport" }) as never,
  guided: createTranslator({ locale, messages: bundle, namespace: "guided" }) as never,
  register: createTranslator({ locale, messages: bundle, namespace: "documentRegister" }) as never,
  views: createTranslator({ locale, messages: bundle, namespace: "views" }) as never,
});

// ---------------------------------------------------------------------------

describe("the period", () => {
  it("defaults to the last full quarter", () => {
    expect(presetPeriod("lastQuarter", NOW)).toEqual({ from: "2026-07-01", to: "2026-09-30" });
    expect(resolvePeriod(null, null, NOW)).toEqual({ from: "2026-07-01", to: "2026-09-30" });
    // January: the last quarter is the previous year's fourth.
    expect(presetPeriod("lastQuarter", new Date("2027-01-15T00:00:00Z"))).toEqual({ from: "2026-10-01", to: "2026-12-31" });
  });

  it("offers this quarter so far, last month and the last twelve months", () => {
    expect(presetPeriod("thisQuarter", NOW)).toEqual({ from: "2026-10-01", to: "2026-10-09" });
    expect(presetPeriod("lastMonth", NOW)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(presetPeriod("last12Months", NOW)).toEqual({ from: "2025-10-01", to: "2026-09-30" });
    expect(periodPreset({ from: "2026-09-01", to: "2026-09-30" }, NOW)).toBe("lastMonth");
    expect(periodPreset({ from: "2026-09-02", to: "2026-09-30" }, NOW)).toBe("custom");
  });

  it("keeps a valid custom period and refuses the rest (back to the last quarter)", () => {
    expect(resolvePeriod("2026-02-01", "2026-03-15", NOW)).toEqual({ from: "2026-02-01", to: "2026-03-15" });
    const fallback = { from: "2026-07-01", to: "2026-09-30" };
    expect(resolvePeriod("2026-03-15", "2026-02-01", NOW)).toEqual(fallback); // start after end
    expect(resolvePeriod("2026-10-01", "2026-10-31", NOW)).toEqual(fallback); // ends after today
    expect(resolvePeriod("2026-02-30", "2026-03-01", NOW)).toEqual(fallback); // not a real day
    expect(resolvePeriod("2020-01-01", "2026-09-30", NOW)).toEqual(fallback); // longer than three years
    expect(resolvePeriod("x", "y", NOW)).toEqual(fallback);
  });

  it("covers whole days, both ends included", () => {
    const { start, end } = periodBounds({ from: "2026-07-01", to: "2026-09-30" });
    expect(start.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });
});

describe("the register and the menu", () => {
  const state = (facts: DocumentFacts) =>
    evaluateRegister(registerFor({ dsarEnabled: true }), facts).find((d) => d.id === "boardReport")!.status;

  it("needs a confirmed step while the programme figure is zero", () => {
    expect(state(FACTS)).toEqual({ state: "needsInput", input: "confirmedStep" });
    // Drafts alone confirm nothing: the way on is to review and confirm them.
    expect(state({ ...FACTS, vendors: 3, vendorsDrafts: 3 })).toEqual({ state: "needsInput", input: "confirmDrafts" });
  });

  it("is not ready after the quick start alone (set-up steps give it no content)", () => {
    expect(state({ ...FACTS, jurisdictions: 2, quickstartCompleted: true, dataAssets: 9, dataAssetsDrafts: 9 })).toEqual({
      state: "needsInput",
      input: "confirmDrafts",
    });
    // A bare confirmed activity is not enough either.
    expect(state({ ...FACTS, jurisdictions: 1, processingActivities: 1 })).toEqual({
      state: "needsInput",
      input: "confirmedStep",
    });
  });

  it("is ready once a Know your data step is done", () => {
    expect(state({ ...FACTS, processingActivities: 1, processingActivitiesComplete: 1 })).toEqual({ state: "ready" });
  });

  it("is a real document with a page and a PDF, no longer among those not in DPO Central yet", () => {
    const entry = documentEntry("boardReport")!;
    expect(entry.href).toBe("/privacy/board-report");
    expect(entry.download).toBe("/api/export/board-report");
    expect(entry.formats).toEqual(["pdf"]);
    expect(notYetEntries({ dsarEnabled: true }).map((e) => e.id)).not.toContain("boardReport");
  });

  it("has its line under the step 'Executive report', which opens the page and is never counted", () => {
    const step = DPO_CENTRAL_PATH.stages.flatMap((s) => s.steps).find((s) => s.id === "audits")!;
    expect(step.href).toBe("/privacy/board-report");
    expect(step.optional).toBe(true);
    expect(step.coming).toBeFalsy();
    const counts = { ...FACTS, jurisdictions: 1 };
    const before = programFigure(DPO_CENTRAL_PATH, evaluatePath(DPO_CENTRAL_PATH, counts));
    const after = programFigure(DPO_CENTRAL_PATH, evaluatePath(DPO_CENTRAL_PATH, { ...counts, boardReportsSaved: 2 }));
    expect(after).toEqual(before);
    expect(evaluatePath(DPO_CENTRAL_PATH, { ...counts, boardReportsSaved: 1 }).audits).toBe("done");
    expect(evaluatePath(DPO_CENTRAL_PATH, counts).audits).toBe("todo");

    const docs = evaluateRegister(registerFor({ dsarEnabled: true }), counts);
    const statuses = evaluatePath(DPO_CENTRAL_PATH, counts);
    expect(stepDocumentRows(DPO_CENTRAL_PATH, statuses, docs).audits.map((r) => r.entry.id)).toEqual(["boardReport"]);
    expect(en.guided.steps.audits.label).toBe("Executive report");
    expect(es.guided.steps.audits.label).toBe("Informe ejecutivo");
  });
});

describe("the readings", () => {
  const docs: EvaluatedDocument[] = [
    { id: "regulatoryReport", status: { state: "ready" } },
    { id: "programmeReport", status: { state: "draft", gaps: [{ key: "toConfirm", count: 2 }] } },
    { id: "vendorRegister", status: { state: "draft", gaps: [{ key: "toConfirm", count: 1 }] } },
    { id: "ropa", status: { state: "needsInput", input: "activity" } },
    { id: "breachNotification", status: { state: "needsInput", input: "aiAssist" } },
    { id: "privacyNotice", status: { state: "notYet" } },
  ];

  it("top risks: what waits for a person, most serious first, then the documents not ready", () => {
    const needs: NeedsActionItem[] = [
      { kind: "drafts-to-confirm", count: 4, href: "/privacy/review" },
      { kind: "breach-window", count: 1, href: "/privacy/incidents" },
    ];
    expect(topRisks(needs, docs)).toEqual([
      { kind: "needsAction", needsKind: "breach-window", count: 1 },
      { kind: "needsAction", needsKind: "drafts-to-confirm", count: 4 },
      { kind: "document", id: "ropa", status: { state: "needsInput", input: "activity" } },
    ]);
    // Without waiting work: inputs before drafts; on-screen-only documents left out.
    expect(topRisks([], docs).map((r) => (r.kind === "document" ? r.id : r.needsKind))).toEqual([
      "ropa",
      "vendorRegister",
      "programmeReport",
    ]);
    expect(topRisks([], [{ id: "ropa", status: { state: "ready" } }])).toEqual([]);
  });

  it("next three actions: the dashboard's, with the privacy officer as owner and a date", () => {
    const statuses = evaluatePath(DPO_CENTRAL_PATH, { ...FACTS, jurisdictions: 1, quickstartCompleted: true });
    const needs: NeedsActionItem[] = [{ kind: "breach-window", count: 1, href: "/privacy/incidents" }];
    const actions = boardActions(DPO_CENTRAL_PATH, statuses, needs, {
      owner: "Privacy Lead",
      deadlines: [
        { kind: "breachNotify", at: "2026-10-11T09:00:00.000Z", publicId: "x", href: "/privacy/incidents/x" },
        { kind: "breachNotify", at: "2026-10-10T09:00:00.000Z", publicId: "y", href: "/privacy/incidents/y" },
      ],
    });
    expect(actions).toHaveLength(3);
    expect(actions[0]).toEqual({
      item: { kind: "needsAction", needsKind: "breach-window", count: 1 },
      owner: "Privacy Lead",
      date: "2026-10-10",
      dateSource: "deadline",
    });
    // An open step of the path carries no invented date: the organisation sets its own pace.
    expect(actions[1].item).toEqual({ kind: "step", stepId: "dataInventory", toConfirm: false });
    expect(actions[1].date).toBeNull();
    expect(actions[1].dateSource).toBeNull();

    const undated = boardActions(DPO_CENTRAL_PATH, statuses, [], {
      owner: null,
      deadlines: [],
    });
    expect(undated[0]).toMatchObject({ owner: null, date: null, dateSource: null });
  });
});

// ---------------------------------------------------------------------------

function vendorCount({ where }: { where: Record<string, unknown> }) {
  if ("provenance" in where) return 1; // drafts
  const contracts = where.contracts as Record<string, unknown> | undefined;
  if (contracts?.some) return 2;
  if (contracts?.none) return 1;
  return where.status === "ACTIVE" ? 3 : 4; // in use, or confirmed (not terminated)
}

function assessmentCount({ where }: { where: { status: unknown; template: { type: string } } }) {
  const approved = where.status === "APPROVED";
  if (where.template.type === "DPIA") return approved ? 1 : 2;
  return approved ? 0 : 1;
}

describe("loadBoardReport over a mocked database", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.facts = { ...FACTS, jurisdictions: 1, quickstartCompleted: true };
    mocks.needs = [{ kind: "dsar-due", count: 1, href: "/privacy/dsar" }];
    mocks.deadlines = [{ kind: "dsarDue", at: "2026-10-20T00:00:00.000Z", publicId: "r", href: "/privacy/dsar/r" }];
    mocks.dsarOn = true;
    const p = mocks.prisma;
    p.organizationMember.findMany.mockResolvedValue([
      { role: "OWNER", user: { name: "Owner Person", email: "owner@example.test" } },
      { role: "PRIVACY_OFFICER", user: { name: null, email: "dpo@example.test" } },
    ]);
    p.organization.findFirst.mockResolvedValue({
      settings: {
        quickstart: { completedAt: "2026-09-01T00:00:00Z" },
        boardReport: { reports: { "2026-07-01_2026-09-30": { comment: "Q3 went well.", savedAt: "2026-10-02T10:00:00.000Z", savedBy: "u1" } } },
      },
    });
    p.user.findUnique.mockResolvedValue({ name: "Dee Pio", email: "dpo@example.test" });
    const h = 60 * 60 * 1000;
    const discovered = new Date("2026-08-01T00:00:00Z");
    p.incident.findMany.mockResolvedValue([
      { discoveredAt: discovered, notificationRequired: true, notifications: [{ sentAt: new Date(discovered.getTime() + 48 * h) }] },
      { discoveredAt: discovered, notificationRequired: true, notifications: [{ sentAt: new Date(discovered.getTime() + 80 * h) }] },
      { discoveredAt: discovered, notificationRequired: true, notifications: [] },
      { discoveredAt: discovered, notificationRequired: false, notifications: [{ sentAt: null }] },
    ]);
    p.incident.count.mockResolvedValue(2);
    p.dSARRequest.count.mockResolvedValue(3);
    p.dSARRequest.findMany.mockResolvedValue([
      { status: "COMPLETED", dueDate: new Date("2026-08-30T00:00:00Z"), extendedDueDate: null, completedAt: new Date("2026-08-20T00:00:00Z") },
      { status: "COMPLETED", dueDate: new Date("2026-08-30T00:00:00Z"), extendedDueDate: new Date("2026-10-30T00:00:00Z"), completedAt: new Date("2026-09-20T00:00:00Z") },
      { status: "COMPLETED", dueDate: new Date("2026-08-30T00:00:00Z"), extendedDueDate: null, completedAt: new Date("2026-09-02T00:00:00Z") },
      { status: "IN_PROGRESS", dueDate: new Date("2026-09-30T00:00:00Z"), extendedDueDate: null, completedAt: null },
      { status: "SUBMITTED", dueDate: new Date("2026-10-25T00:00:00Z"), extendedDueDate: null, completedAt: null },
      { status: "REJECTED", dueDate: new Date("2026-09-30T00:00:00Z"), extendedDueDate: null, completedAt: null },
    ]);
    p.vendor.count.mockImplementation(async (args: never) => vendorCount(args));
    p.assessment.count.mockImplementation(async (args: never) => assessmentCount(args));
  });

  async function load(role = "PRIVACY_OFFICER") {
    const { loadBoardReport } = await import("@/server/services/program/board-report");
    return loadBoardReport(mocks.prisma as never, {
      organizationId: "org-1",
      organizationName: "Harbour Bakery",
      period: { from: "2026-07-01", to: "2026-09-30" },
      member: { role, userId: "u1" },
      now: NOW,
    });
  }

  it("counts the period's incidents and their notification to the authority", async () => {
    const report = await load();
    expect(report.incidents).toEqual({ inPeriod: 4, notifiedWithin72h: 1, notifiedLate: 1, notNotifiedYet: 1, openNow: 2, toNotifyNow: 2 });
    // The backlog to notify is counted from any period: open, notifiable, nothing sent to the authority.
    const backlog = mocks.prisma.incident.count.mock.calls.map((c) => c[0].where).find((w) => w.notificationRequired);
    expect(backlog).toMatchObject({ notificationRequired: true, notifications: { none: { recipientType: "DPA", sentAt: { not: null } } } });
    expect(backlog.discoveredAt).toBeUndefined();
    const where = mocks.prisma.incident.findMany.mock.calls[0][0].where;
    expect(where.organizationId).toBe("org-1");
    expect(where.discoveredAt).toEqual({ gte: new Date("2026-07-01T00:00:00Z"), lt: new Date("2026-10-01T00:00:00Z") });
  });

  it("counts the period's rights requests by their (extended) deadline", async () => {
    const report = await load();
    expect(report.rights).toEqual({ received: 6, completedOnTime: 2, completedLate: 1, openOverdue: 1, openInTime: 1, closedOther: 1, overdueNow: 3 });
    // Overdue on the day generated, from any period, by the extended deadline where there is one.
    const overdue = mocks.prisma.dSARRequest.count.mock.calls[0][0].where;
    expect(overdue.receivedAt).toBeUndefined();
    expect(overdue.OR).toEqual([{ extendedDueDate: { lt: NOW } }, { extendedDueDate: null, dueDate: { lt: NOW } }]);
  });

  it("leaves rights requests out when the module is off, or for a member who does not handle them", async () => {
    mocks.dsarOn = false;
    let report = await load();
    expect(report.rights).toBeNull();
    expect(report.documents.map((d) => d.id)).not.toContain("dsarPerformance");
    expect(report.risks.some((r) => r.kind === "needsAction" && r.needsKind === "dsar-due")).toBe(false);
    expect(mocks.prisma.dSARRequest.findMany).not.toHaveBeenCalled();
    mocks.dsarOn = true;
    report = await load("MEMBER");
    expect(report.rights).toBeNull();
    expect(report.canSave).toBe(false);
  });

  it("vendors, assessments, owner, comment and the programme", async () => {
    const report = await load();
    expect(report.vendors).toEqual({ total: 4, active: 3, withDpa: 2, highRiskWithoutDpa: 1, drafts: 1 });
    // A processor contract counts only while in force: ACTIVE or RENEWED, and not past its end date.
    const withDpa = mocks.prisma.vendor.count.mock.calls.map((c) => c[0].where).find((w) => w.contracts?.some);
    expect(withDpa.status).toBe("ACTIVE");
    expect(withDpa.contracts.some).toEqual({
      type: "DPA",
      status: { in: ["ACTIVE", "RENEWED"] },
      OR: [{ endDate: null }, { endDate: { gte: NOW } }],
    });
    expect(report.assessments).toEqual({
      dpiaApproved: 1,
      dpiaPending: 2,
      piaApproved: 0,
      piaPending: 1,
      liaApproved: 0,
      liaPending: 1,
    });
    // The privacy officer holds the actions, ahead of the owner; no name, so the address.
    expect(report.actions[0].owner).toBe("dpo@example.test");
    expect(report.actions[0]).toMatchObject({ date: "2026-10-20", dateSource: "deadline" });
    expect(report.comment).toEqual({ text: "Q3 went well.", savedAt: "2026-10-02T10:00:00.000Z", savedBy: "Dee Pio" });
    // Stages done: "Set up" alone (the quick start and a jurisdiction).
    expect(report.figure.confirmed).toBe(1);
    expect(report.steps!.map((s) => s.number)).toEqual(["1.1", "1.2", "2.1", "2.2", "2.3", "3.1", "3.2", "4.1", "5.1"]);
    expect(report.steps!.slice(0, 2).map((s) => s.status)).toEqual(["done", "done"]);
    expect(report.records).toMatchObject({ rightsReceived: expect.any(Number), incidents: expect.any(Number) });
    expect(report.areas.map((a) => a.stageId)).toEqual(["setup", "people", "inventory", "assess", "rights", "respond"]);
    expect(report.areas.find((a) => a.stageId === "rights")!.word).toBe("action");
    expect(report.canSave).toBe(true);
    expect(report.period).toEqual({ from: "2026-07-01", to: "2026-09-30" });
  });
});

describe("the comment is saved in the settings, the rest untouched", () => {
  beforeEach(() => vi.clearAllMocks());

  it("merges, trims, caps the length and writes an audit entry", async () => {
    mocks.prisma.organization.findFirst.mockResolvedValue({
      settings: { quickstart: { completedAt: "x" }, boardReport: { reports: { old: { comment: "a", savedAt: "2026-01-01T00:00:00.000Z", savedBy: "u0" } } } },
    });
    const { saveBoardReportComment } = await import("@/server/services/program/board-report");
    const saved = await saveBoardReportComment(mocks.prisma as never, {
      organizationId: "org-1",
      period: { from: "2026-07-01", to: "2026-09-30" },
      comment: `  ${"x".repeat(2500)}  `,
      userId: "u1",
      now: NOW,
    });
    expect(saved.text).toHaveLength(2000);
    const data = mocks.prisma.organization.update.mock.calls[0][0].data.settings;
    expect(data.quickstart).toEqual({ completedAt: "x" });
    expect(Object.keys(data.boardReport.reports).sort()).toEqual(["2026-07-01_2026-09-30", "old"]);
    expect(data.boardReport.reports["2026-07-01_2026-09-30"]).toEqual({
      comment: "x".repeat(2000),
      savedAt: NOW.toISOString(),
      savedBy: "u1",
    });
    expect(mocks.prisma.auditLog.create.mock.calls[0][0].data.action).toBe("SAVE_BOARD_REPORT");
  });
});

// ---------------------------------------------------------------------------

const SAMPLE: BoardReport = {
  organizationName: "Harbour Bakery",
  period: { from: "2026-07-01", to: "2026-09-30" },
  generatedAt: "2026-10-09T12:00:00.000Z",
  figure: { confirmed: 2, total: 5, toConfirm: 1, started: 1, notStarted: 1 },
  areas: [
    { stageId: "setup", word: "done" },
    { stageId: "people", word: "coming" },
    { stageId: "inventory", word: "toConfirm" },
    { stageId: "assess", word: "started" },
    { stageId: "rights", word: "action" },
    { stageId: "respond", word: "todo" },
  ],
  documents: [
    { id: "regulatoryReport", status: { state: "ready" } },
    { id: "vendorRegister", status: { state: "draft", gaps: [{ key: "toConfirm", count: 1 }] } },
    { id: "ropa", status: { state: "needsInput", input: "activity" } },
    { id: "boardReport", status: { state: "ready" } },
    { id: "privacyNotice", status: { state: "notYet" } },
  ],
  incidents: { inPeriod: 2, notifiedWithin72h: 1, notifiedLate: 0, notNotifiedYet: 1, openNow: 1 },
  rights: { received: 5, completedOnTime: 3, completedLate: 1, openOverdue: 1, openInTime: 0, closedOther: 0 },
  vendors: { total: 6, withDpa: 4, highRiskWithoutDpa: 1, drafts: 2 },
  assessments: { dpiaApproved: 1, dpiaPending: 1, piaApproved: 2, piaPending: 0, liaApproved: 0, liaPending: 1 },
  steps: [
    { stepId: "quickstart", number: "1.1", status: "done" },
    { stepId: "ropa", number: "2.2", status: "started", missing: ["retention"] },
    { stepId: "assessments", number: "3.1", status: "started" },
    { stepId: "incidents", number: "5.1", status: "ready" },
  ],
  dpiaDuty: "applies",
  records: {
    dataAssets: 3,
    activities: 4,
    activitiesComplete: 2,
    transfers: 2,
    transfersAssessed: 1,
    rightsReceived: 5,
    rightsCompleted: 4,
    incidents: 2,
  },
  risks: [
    { kind: "needsAction", needsKind: "dsar-due", count: 1 },
    { kind: "document", id: "ropa", status: { state: "needsInput", input: "activity" } },
  ],
  actions: [
    { item: { kind: "needsAction", needsKind: "dsar-due", count: 1 }, owner: "Dee Pio", date: "2026-10-20", dateSource: "deadline" },
    { item: { kind: "step", stepId: "ropa", toConfirm: false }, owner: "Dee Pio", date: null, dateSource: null },
    { item: { kind: "step", stepId: "vendors", toConfirm: true }, owner: null, date: null, dateSource: null },
  ],
  comment: { text: "Two decisions for the board.", savedAt: "2026-10-02T10:00:00.000Z", savedBy: "Dee Pio" },
  canSave: true,
};

describe("the words, the same on the page and in the PDF", () => {
  it("leaves out an area the product does not cover yet", () => {
    const text = boardReportText(SAMPLE, tr(en, "en"), "en");
    expect(text.programme.areas.map((a) => a.label)).not.toContain(en.guided.stages.people);
    expect(text.programme.areas).toHaveLength(5);
  });
  it("reads in English", () => {
    const text = boardReportText(SAMPLE, tr(en, "en"), "en");
    expect(text.title).toBe("Executive report");
    expect(text.periodLine).toBe("Period: 1 July 2026 to 30 September 2026");
    expect(text.generatedLine).toBe("Generated on 9 October 2026");
    expect(text.programme.figure).toBe("2 of 5 stages done");
    expect(text.programme.areas.map((a) => a.value)).toEqual([
      "done",
      "to confirm",
      "in progress",
      "needs action",
      "not started",
    ]);
    expect(text.documents.line).toBe("2 of 4 documents ready");
    expect(text.documents.ready).toEqual(["Regulatory report", "Executive report"]);
    expect(text.documents.missing).toEqual([
      { label: "Vendor register", value: "draft (1 record to confirm)" },
      { label: "Records of processing (ROPA)", value: "needs: a processing activity" },
    ]);
    expect(text.risks.items).toEqual(["Rights requests overdue or due soon: 1", "Records of processing (ROPA): needs: a processing activity"]);
    expect(text.actions.rows).toEqual([
      { action: "Rights requests overdue or due soon (1)", owner: "Dee Pio", date: "20 October 2026 (deadline)" },
      { action: "Records of processing", owner: "Dee Pio", date: "No date set" },
      { action: "Vendors and processors: confirm the drafted records", owner: "Not named", date: "No date set" },
    ]);
    expect(text.vendors.note).toBe("2 drafted vendors wait to be confirmed and are not counted.");
    expect(text.comment.saved).toBe("Saved on 2 October 2026 by Dee Pio");
  });

  it("reads in Spanish (Castilian)", () => {
    const text = boardReportText(SAMPLE, tr(es, "es"), "es");
    expect(text.title).toBe("Informe ejecutivo");
    expect(text.periodLine).toBe("Periodo: del 1 de julio de 2026 al 30 de septiembre de 2026");
    expect(text.programme.figure).toBe("2 de 5 fases completadas");
    expect(text.assessments.rows[0][0]).toBe("Evaluaciones de impacto (EIPD)");
    expect(text.actions.rows[0].date).toBe("20 de octubre de 2026 (vencimiento)");
    expect(text.rights?.title).toBe("Solicitudes de derechos en el periodo");
  });

  it("every sentence of the template is neutral: no long dash, no claim of compliance, no 'usted'", () => {
    for (const bundle of [en, es]) {
      const all = JSON.stringify(bundle.boardReport);
      expect(all).not.toContain("—");
      expect(all.toLowerCase()).not.toMatch(/\bcompliant\b|\bconforme\b|\bcumple\b/);
      expect(all).not.toMatch(/\busted\b/i);
    }
    // "Not legal advice" is assumed (owner's decision, 15 Oct 2026): the
    // disclaimer only says the report claims no compliance.
    expect(en.boardReport.disclaimer).toContain("does not state that the organization complies");
    expect(es.boardReport.disclaimer).toContain("No afirma que la organización cumpla");
    expect(en.boardReport.disclaimer).not.toMatch(/legal advice/i);
    expect(es.boardReport.disclaimer).not.toMatch(/asesoramiento jur/i);
  });

  it("names the report 'Executive report' / 'Informe ejecutivo' everywhere, the board still named in the subtitle", () => {
    expect(en.documentRegister.items.boardReport).toBe("Executive report");
    expect(es.documentRegister.items.boardReport).toBe("Informe ejecutivo");
    expect(en.boardReport.pdf.fileTitle).toBe("Executive-Report");
    expect(es.boardReport.pdf.fileTitle).toBe("Informe-Ejecutivo");
    expect(en.boardReport.subtitle).toContain("the board or management");
    expect(es.boardReport.subtitle).toContain("el consejo o la dirección");
    for (const bundle of [en, es]) {
      expect(JSON.stringify(bundle.boardReport)).not.toMatch(/board report|informe para la dirección/i);
    }
  });

  it("at a glance: the programme figure as the hero, then four figures with a bar and a warning where needed", () => {
    const k = boardReportText(SAMPLE, tr(en, "en"), "en").kpis;
    expect(k.title).toBe("At a glance");
    expect(k.hero).toMatchObject({ value: "2", of: "of 5", label: "stages done", ratio: 0.4 });
    expect(k.tiles.map((t) => [t.id, t.value, t.of, t.ratio, t.flag])).toEqual([
      ["documents", "2", "of 4", 0.5, null],
      ["breaches", "1", "of 2", 0.5, "1 late or not notified yet"],
      // On time over completed plus open and overdue (src/lib/dsar-on-time.ts): 3 of 5.
      ["rights", "3", "of 5", 0.6, "1 open and overdue on the date generated"],
      ["vendors", "4", "of 6", 4 / 6, "1 high or critical risk without one"],
    ]);
    const es1 = boardReportText(SAMPLE, tr(es, "es"), "es").kpis;
    expect(es1.title).toBe("De un vistazo");
    expect(es1.tiles[1].label).toBe("brechas notificadas a la autoridad en 72 horas");
    expect(es1.tiles[2].flag).toBe("1 abierta y vencida en la fecha de generación");
  });

  it("at a glance: no rights tile without the module; plain words when there is nothing to count", () => {
    const empty: BoardReport = {
      ...SAMPLE,
      rights: null,
      incidents: { inPeriod: 1, notifiedWithin72h: 0, notifiedLate: 0, notNotifiedYet: 0, openNow: 0 },
      vendors: { total: 0, withDpa: 0, highRiskWithoutDpa: 0, drafts: 0 },
    };
    const k = boardReportText(empty, tr(en, "en"), "en").kpis;
    expect(k.tiles.map((t) => t.id)).toEqual(["documents", "breaches", "vendors"]);
    expect(k.tiles[1]).toMatchObject({ value: "0", of: null, ratio: null, label: "no notifiable breaches in the period" });
    expect(k.tiles[2]).toMatchObject({ value: "0", of: null, ratio: null, label: "no confirmed vendors" });
  });

  it("shows the backlog a quiet period would hide, and says when a deadline has passed", () => {
    const quiet: BoardReport = {
      ...SAMPLE,
      incidents: { inPeriod: 0, notifiedWithin72h: 0, notifiedLate: 0, notNotifiedYet: 0, openNow: 2, toNotifyNow: 1 },
      rights: { received: 0, completedOnTime: 0, completedLate: 0, openOverdue: 0, openInTime: 0, closedOther: 0, overdueNow: 3 },
      vendors: { total: 6, active: 5, withDpa: 4, highRiskWithoutDpa: 0, drafts: 0 },
      actions: [
        { item: { kind: "needsAction", needsKind: "dsar-due", count: 3 }, owner: "Dee Pio", date: "2026-02-15", dateSource: "deadline", overdue: true },
      ],
    };
    const text = boardReportText(quiet, tr(en, "en"), "en");
    const [, breaches, rights, vendors] = text.kpis.tiles;
    expect(breaches).toMatchObject({ value: "0", label: "no notifiable breaches in the period", flag: "1 open breach still to notify (any period)" });
    expect(rights).toMatchObject({ value: "0", label: "no rights requests completed or overdue in the period", flag: "3 open and overdue on the date generated" });
    expect(vendors).toMatchObject({ value: "4", of: "of 5" });
    expect(text.incidents.rows.at(-1)).toEqual({ label: "Open and still to notify on the date generated (from any period)", value: "1" });
    expect(text.rights?.rows.at(-1)).toEqual({ label: "Open and overdue on the date generated (from any period)", value: "3" });
    expect(text.actions.rows[0].date).toBe("15 February 2026 (overdue by 236 days)");
    const textEs = boardReportText(quiet, tr(es, "es"), "es");
    expect(textEs.actions.rows[0]).toEqual({
      action: "Solicitudes de derechos vencidas o por vencer (3)",
      owner: "Dee Pio",
      date: "15 de febrero de 2026 (vencida hace 236 días)",
    });
    expect(textEs.kpis.tiles[1].flag).toBe("1 brecha abierta aún sin notificar (de cualquier periodo)");
  });

  it("marks an action whose deadline has passed as overdue", () => {
    const actions = boardActions(DPO_CENTRAL_PATH, evaluatePath(DPO_CENTRAL_PATH, { ...FACTS }), [{ kind: "dsar-due", count: 1, href: "/privacy/dsar" }], {
      owner: null,
      deadlines: [{ kind: "dsarDue", at: "2026-02-15T00:00:00.000Z", publicId: "r", href: "/privacy/dsar/r" }],
      now: NOW,
    });
    expect(actions[0]).toMatchObject({ date: "2026-02-15", dateSource: "deadline", overdue: true });
  });

  it("lists every counted step with its state and what finishes it, and the records to date", () => {
    const text = boardReportText(SAMPLE, tr(en, "en"), "en");
    expect(text.steps!.rows.map((r) => r.label)).toEqual([
      "1.1 Quick start",
      "2.2 Records of processing",
      "3.1 Assessments",
      "5.1 Breach register",
    ]);
    expect(text.steps!.rows[0].value).toBe("done");
    expect(text.steps!.rows[1].value).toContain("missing: the retention period");
    // The organisation's answers require a DPIA, so the step says so.
    expect(text.steps!.rows[2].value).toContain(en.guided.finish.assessmentsDpia);
    expect(text.steps!.rows[3].value).toBe(en.guided.stepStatus.ready);
    expect(text.records!.rows.map((r) => r.value)).toEqual(["3", "4", "2", "2", "1", "5", "4", "2"]);
    expect(text.assessments.rows.map((r) => r[0])).toContain("General risk assessments (PIA)");
    const es1 = boardReportText(SAMPLE, tr(es, "es"), "es");
    expect(es1.steps!.title).toBe("Pasos");
    expect(es1.records!.title).toBe("Registros a la fecha");
    // A report of an older shape (no steps, no records) still reads.
    const older = boardReportText({ ...SAMPLE, steps: undefined, records: undefined }, tr(en, "en"), "en");
    expect(older.steps).toBeNull();
    expect(older.records).toBeNull();
  });

  it("formats dates in UTC so a day never shifts", () => {
    expect(formatBoardDate("2026-07-01", "en")).toBe("1 July 2026");
    expect(formatBoardDate("2026-07-01", "es")).toBe("1 de julio de 2026");
  });

  it("the PDF prints the same words and renders", async () => {
    const { BoardReportDocument } = await import("@/server/services/export/board-report");
    for (const [bundle, locale] of [[en, "en"], [es, "es"]] as const) {
      const text = boardReportText(SAMPLE, tr(bundle as typeof en, locale), locale);
      const doc = BoardReportDocument({ text, locale, pageLabel: (p, t) => `${p}/${t}`, preparedWith: "x" });
      const printed = collectText(doc).join("\n");
      for (const line of [text.periodLine, text.programme.figure, text.documents.line, text.disclaimer, text.comment.text!, text.kpis.title, ...text.kpis.tiles.map((k) => k.label)]) {
        expect(printed).toContain(line);
      }
      for (const row of text.actions.rows) expect(printed).toContain(row.owner);
      const { renderToBuffer } = await import("@react-pdf/renderer");
      const buffer = await renderToBuffer(doc);
      expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
    }
  });
});
