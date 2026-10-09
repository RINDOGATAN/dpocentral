// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The board report (owner's decision d12, 9 October 2026): the first document
 * that was "not in DPO Central yet" is now produced.
 *
 * - the period: the last full quarter by default, presets, and what is refused;
 * - the register: ready with one confirmed step, otherwise it needs one; the
 *   menu line under "Report to management"; the step is optional, so the
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
import { DPO_CENTRAL_PATH, EMPTY_PATH_COUNTS, PLAN_WINDOWS } from "@/components/guided/path-config";
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
  planStart: null as Date | null,
  dsarOn: true,
  prisma: {
    organizationMember: { findMany: vi.fn() },
    organization: { findFirst: vi.fn(), update: vi.fn() },
    incident: { findMany: vi.fn(), count: vi.fn() },
    dSARRequest: { findMany: vi.fn() },
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
vi.mock("@/server/services/program/plan-start", () => ({ loadPlanStart: async () => mocks.planStart }));
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

describe("the register and the menu (d12)", () => {
  const state = (facts: DocumentFacts) =>
    evaluateRegister(registerFor({ dsarEnabled: true }), facts).find((d) => d.id === "boardReport")!.status;

  it("needs a confirmed step while the programme figure is zero", () => {
    expect(state(FACTS)).toEqual({ state: "needsInput", input: "confirmedStep" });
    // Drafts alone confirm nothing.
    expect(state({ ...FACTS, vendors: 3, vendorsDrafts: 3 })).toEqual({ state: "needsInput", input: "confirmedStep" });
  });

  it("is ready once one step is confirmed", () => {
    expect(state({ ...FACTS, jurisdictions: 1 })).toEqual({ state: "ready" });
  });

  it("is a real document with a page and a PDF, no longer among those not in DPO Central yet", () => {
    const entry = documentEntry("boardReport")!;
    expect(entry.href).toBe("/privacy/board-report");
    expect(entry.download).toBe("/api/export/board-report");
    expect(entry.formats).toEqual(["pdf"]);
    expect(notYetEntries({ dsarEnabled: true }).map((e) => e.id)).not.toContain("boardReport");
  });

  it("has its line under the step 'Report to management', which opens the page and is never counted", () => {
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
    expect(en.guided.steps.audits.label).toBe("Report to management");
    expect(es.guided.steps.audits.label).toBe("Informe a la dirección");
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
      planStart: "2026-09-01T00:00:00.000Z",
      windows: PLAN_WINDOWS,
    });
    expect(actions).toHaveLength(3);
    expect(actions[0]).toEqual({
      item: { kind: "needsAction", needsKind: "breach-window", count: 1 },
      owner: "Privacy Lead",
      date: "2026-10-10",
      dateSource: "deadline",
    });
    // The first open step of the path is in "Know your data": day 60 of the plan.
    expect(actions[1].item).toEqual({ kind: "step", stepId: "dataInventory", toConfirm: false });
    expect(actions[1].date).toBe("2026-10-30");
    expect(actions[1].dateSource).toBe("plan");

    const undated = boardActions(DPO_CENTRAL_PATH, statuses, [], {
      owner: null,
      deadlines: [],
      planStart: null,
      windows: PLAN_WINDOWS,
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
  return 3;
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
    mocks.planStart = new Date("2026-09-01T00:00:00Z");
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
    expect(report.incidents).toEqual({ inPeriod: 4, notifiedWithin72h: 1, notifiedLate: 1, notNotifiedYet: 1, openNow: 2 });
    const where = mocks.prisma.incident.findMany.mock.calls[0][0].where;
    expect(where.organizationId).toBe("org-1");
    expect(where.discoveredAt).toEqual({ gte: new Date("2026-07-01T00:00:00Z"), lt: new Date("2026-10-01T00:00:00Z") });
  });

  it("counts the period's rights requests by their (extended) deadline", async () => {
    const report = await load();
    expect(report.rights).toEqual({ received: 6, completedOnTime: 2, completedLate: 1, openOverdue: 1, openInTime: 1, closedOther: 1 });
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
    expect(report.vendors).toEqual({ total: 3, withDpa: 2, highRiskWithoutDpa: 1, drafts: 1 });
    expect(report.assessments).toEqual({ dpiaApproved: 1, dpiaPending: 2, liaApproved: 0, liaPending: 1 });
    // The privacy officer holds the actions, ahead of the owner; no name, so the address.
    expect(report.actions[0].owner).toBe("dpo@example.test");
    expect(report.actions[0]).toMatchObject({ date: "2026-10-20", dateSource: "deadline" });
    expect(report.comment).toEqual({ text: "Q3 went well.", savedAt: "2026-10-02T10:00:00.000Z", savedBy: "Dee Pio" });
    expect(report.figure.confirmed).toBe(2);
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
  figure: { confirmed: 4, total: 10, toConfirm: 1, started: 2, notStarted: 3 },
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
  assessments: { dpiaApproved: 1, dpiaPending: 1, liaApproved: 0, liaPending: 1 },
  risks: [
    { kind: "needsAction", needsKind: "dsar-due", count: 1 },
    { kind: "document", id: "ropa", status: { state: "needsInput", input: "activity" } },
  ],
  actions: [
    { item: { kind: "needsAction", needsKind: "dsar-due", count: 1 }, owner: "Dee Pio", date: "2026-10-20", dateSource: "deadline" },
    { item: { kind: "step", stepId: "ropa", toConfirm: false }, owner: "Dee Pio", date: "2026-10-30", dateSource: "plan" },
    { item: { kind: "step", stepId: "vendors", toConfirm: true }, owner: null, date: null, dateSource: null },
  ],
  comment: { text: "Two decisions for the board.", savedAt: "2026-10-02T10:00:00.000Z", savedBy: "Dee Pio" },
  canSave: true,
};

describe("the words, the same on the page and in the PDF", () => {
  it("reads in English", () => {
    const text = boardReportText(SAMPLE, tr(en, "en"), "en");
    expect(text.title).toBe("Board report");
    expect(text.periodLine).toBe("Period: 1 July 2026 to 30 September 2026");
    expect(text.generatedLine).toBe("Generated on 9 October 2026");
    expect(text.programme.figure).toBe("4 of 10 steps confirmed");
    expect(text.programme.areas.map((a) => a.value)).toEqual([
      "done",
      "Not in DPO Central yet",
      "to confirm",
      "in progress",
      "needs action",
      "not started",
    ]);
    expect(text.documents.line).toBe("2 of 4 documents ready");
    expect(text.documents.ready).toEqual(["Regulatory report", "Board report"]);
    expect(text.documents.missing).toEqual([
      { label: "Vendor register", value: "draft (1 record to confirm)" },
      { label: "Records of processing (ROPA)", value: "needs: a processing activity" },
    ]);
    expect(text.risks.items).toEqual(["Rights requests due: 1", "Records of processing (ROPA): needs: a processing activity"]);
    expect(text.actions.rows).toEqual([
      { action: "Rights requests due (1)", owner: "Dee Pio", date: "20 October 2026 (deadline)" },
      { action: "Records of processing", owner: "Dee Pio", date: "30 October 2026 (plan)" },
      { action: "Vendors and processors: confirm the drafted records", owner: "Not named", date: "No date set" },
    ]);
    expect(text.vendors.note).toBe("2 drafted vendors wait to be confirmed and are not counted.");
    expect(text.comment.saved).toBe("Saved on 2 October 2026 by Dee Pio");
  });

  it("reads in Spanish (Castilian)", () => {
    const text = boardReportText(SAMPLE, tr(es, "es"), "es");
    expect(text.title).toBe("Informe para la dirección");
    expect(text.periodLine).toBe("Periodo: del 1 de julio de 2026 al 30 de septiembre de 2026");
    expect(text.programme.figure).toBe("4 de 10 pasos confirmados");
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
    expect(en.boardReport.disclaimer).toContain("not legal advice");
    expect(es.boardReport.disclaimer).toContain("No es asesoramiento jurídico");
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
      for (const line of [text.periodLine, text.programme.figure, text.documents.line, text.disclaimer, text.comment.text!]) {
        expect(printed).toContain(line);
      }
      for (const row of text.actions.rows) expect(printed).toContain(row.owner);
      const { renderToBuffer } = await import("@react-pdf/renderer");
      const buffer = await renderToBuffer(doc);
      expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
    }
  });
});
