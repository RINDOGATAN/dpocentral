// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The document register and the Guided dashboard (owner's decisions d4 to d7,
 * 9 October 2026):
 *
 * - d4 one register lists every document DPO Central can produce (the
 *   inventory's eleven) and the ones it does not produce yet, each with one of
 *   four states and, for "needs an input", the input and where to add it;
 * - d5 the DPIA shows "needs: the DPIA module" where it is not installed
 *   (self-hosted) or after the two free ones (hosted), with no price;
 * - d6 the menu carries one state word per stage, one line of documents under
 *   each step, and every missing piece in one group at the foot;
 * - d7 the Guided dashboard is the figure, six area tiles, the documents
 *   panel, the next three actions and the deadlines; the expert banners, the
 *   four counters, Recent activity and Quick actions are gone from it.
 *
 * The menu and the dashboard read the same register through the same
 * functions, so they cannot disagree: the agreement tests below hold that.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import {
  DOCUMENT_REGISTER,
  INPUTS,
  documentStatus,
  evaluateRegister,
  registerFor,
  type DocumentFacts,
  type DocumentStatus,
} from "@/config/document-register";
import { DPO_CENTRAL_PATH, EMPTY_PATH_COUNTS } from "@/components/guided/path-config";
import { evaluatePath, stageWord, withoutSteps } from "@/components/guided/path";
import {
  attentionStages,
  nextActions,
  notYetEntries,
  notYetRows,
  panelRows,
  programmeAreas,
  stepDocumentRows,
} from "@/lib/programme-overview";
import { documentStateText, stepNoteText } from "@/components/guided/document-words";
import type { NeedsActionItem } from "@/lib/needs-action";

const ROOT = path.resolve(__dirname, "..");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

const PRODUCED = [
  "regulatoryReport",
  "ropa",
  "vendorRegister",
  "dpa",
  "assessmentReport",
  "dpia",
  "assessmentPortfolio",
  "dsarPerformance",
  "breachRegister",
  "breachNotification",
  "programmeReport",
  "boardReport",
];

const EMPTY: DocumentFacts = {
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

/** After the quick start: places declared, template records all drafts. */
const AFTER_QUICKSTART: DocumentFacts = {
  ...EMPTY,
  quickstartCompleted: true,
  jurisdictions: 2,
  dataAssets: 9,
  dataAssetsDrafts: 9,
  processingActivities: 7,
  processingActivitiesDrafts: 7,
  vendors: 3,
  vendorsDrafts: 3,
};

/** After confirming every draft and filling records. */
const FILLED: DocumentFacts = {
  ...AFTER_QUICKSTART,
  dataAssetsDrafts: 0,
  processingActivitiesDrafts: 0,
  vendorsDrafts: 0,
  assessments: 2,
  assessmentsApproved: 1,
  dpiaAssessments: 1,
  dpiaApproved: 1,
  dpaContracts: 1,
  incidents: 1,
  dsarRequests: 1,
  dsarCompleted: 1,
  aiAssistOn: true,
  incidentNotifications: 1,
};

const stateOf = (facts: DocumentFacts) =>
  Object.fromEntries(
    DOCUMENT_REGISTER.map((d) => {
      const s = documentStatus(d, facts);
      return [d.id, s.state === "needsInput" ? `needsInput:${s.input}` : s.state];
    }),
  );

const allSteps = DPO_CENTRAL_PATH.stages.flatMap((s) => s.steps);
const T = (bundle: typeof en) => (key: string, values?: Record<string, string | number>) => {
  const raw = key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], bundle.documentRegister);
  if (typeof raw !== "string") throw new Error(`missing message documentRegister.${key}`);
  return raw.replace(/\{(\w+)\}/g, (_, k) => String(values?.[k] ?? `{${k}}`));
};

describe("d4: the register", () => {
  it("lists the inventory's eleven documents, then the ones not in DPO Central yet", () => {
    const produced = DOCUMENT_REGISTER.filter((d) => d.evaluate).map((d) => d.id);
    expect(produced).toEqual(PRODUCED);
    const notYet = DOCUMENT_REGISTER.filter((d) => !d.evaluate).map((d) => d.id);
    expect(notYet).toEqual([
      "privacyNotice",
      "dpoAppointment",
      "trainingRecord",
      "consentRecords",
      "responseLetter",
    ]);
    expect(new Set(DOCUMENT_REGISTER.map((d) => d.id)).size).toBe(DOCUMENT_REGISTER.length);
  });

  it("gives every document a step of the path (or none), a page, and its rule in words", () => {
    for (const d of DOCUMENT_REGISTER) {
      if (d.stepId !== null) expect(allSteps.map((s) => s.id), d.id).toContain(d.stepId);
      expect(d.rule.length, d.id).toBeGreaterThan(10);
      expect(d.needs.length, d.id).toBeGreaterThan(5);
      if (d.evaluate) {
        expect(d.href, d.id).toMatch(/^\/privacy/);
        expect(d.formats.length, d.id).toBeGreaterThan(0);
        if (d.download) expect(d.download, d.id).toMatch(/^\/api\/export\//);
      } else {
        expect(d.href, d.id).toBeNull();
      }
    }
    // Only the programme report belongs to no single step.
    expect(DOCUMENT_REGISTER.filter((d) => d.stepId === null).map((d) => d.id)).toEqual(["programmeReport"]);
  });

  it("names every step with no page yet once, among the documents not in DPO Central yet", () => {
    const coming = allSteps.filter((s) => s.coming).map((s) => s.id);
    const named = DOCUMENT_REGISTER.filter((d) => !d.evaluate).map((d) => d.stepId);
    for (const id of coming) expect(named, id).toContain(id);
  });

  it("names every document, input, gap and state in English and Spanish", () => {
    for (const bundle of [en, es]) {
      const r = bundle.documentRegister;
      for (const d of DOCUMENT_REGISTER) expect(r.items[d.id as keyof typeof r.items], d.id).toBeTruthy();
      for (const input of Object.keys(INPUTS)) expect(r.inputs[input as keyof typeof r.inputs], input).toBeTruthy();
      for (const gap of ["toConfirm", "incomplete", "notApproved", "impactMissing", "openRequests", "noRecords"]) {
        expect(r.gaps[gap as keyof typeof r.gaps], gap).toBeTruthy();
      }
      for (const s of ["ready", "draft", "needsInput", "notYet"]) {
        expect(r.state[s as keyof typeof r.state]).toBeTruthy();
        expect(r.legend[s as keyof typeof r.legend]).toBeTruthy();
      }
    }
    expect(es.documentRegister.items.ropa).not.toBe(en.documentRegister.items.ropa);
    // The owner's words (d5, d6).
    expect(en.documentRegister.needs.replace("{input}", en.documentRegister.inputs.dpiaModule)).toBe(
      "needs: the DPIA module",
    );
    expect(es.documentRegister.needs.replace("{input}", es.documentRegister.inputs.dpiaModule)).toBe(
      "necesita: el módulo de EIPD",
    );
    expect(en.guided.notYetGroup).toBe("Not in DPO Central yet");
    expect(es.guided.notYetGroup).toBe("Aún no en DPO Central");
  });

  it("links every input to a page of the app, or to the plans page (never a price)", () => {
    for (const [key, input] of Object.entries(INPUTS)) {
      if (input.external) expect(input.href, key).toBe("plans");
      else expect(input.href, key).toMatch(/^\/privacy\//);
    }
    for (const bundle of [en, es]) {
      for (const text of Object.values(bundle.documentRegister.inputs)) expect(text).not.toMatch(/[$€£]|\d+ ?(USD|EUR)/);
    }
  });
});

describe("d4: the states", () => {
  it("an empty organisation: every document needs its first input; the programme report is a draft", () => {
    expect(stateOf(EMPTY)).toEqual({
      regulatoryReport: "needsInput:jurisdiction",
      ropa: "needsInput:activity",
      vendorRegister: "needsInput:vendor",
      dpa: "needsInput:vendor",
      assessmentReport: "needsInput:assessment",
      dpia: "needsInput:dpiaStart",
      assessmentPortfolio: "needsInput:assessment",
      dsarPerformance: "needsInput:dsarRequest",
      breachRegister: "needsInput:incident",
      breachNotification: "needsInput:aiAssist",
      programmeReport: "draft",
      boardReport: "needsInput:confirmedStep",
      privacyNotice: "notYet",
      dpoAppointment: "notYet",
      trainingRecord: "notYet",
      consentRecords: "notYet",
      responseLetter: "notYet",
    });
  });

  it("after the quick start: drafts are gaps, never content (drafts count once confirmed)", () => {
    const s = stateOf(AFTER_QUICKSTART);
    expect(s.regulatoryReport).toBe("ready");
    expect(s.ropa).toBe("draft");
    expect(s.vendorRegister).toBe("draft");
    expect(s.dpa).toBe("needsInput:dpaFacts");
    expect(s.programmeReport).toBe("draft");
    const ropa = documentStatus(DOCUMENT_REGISTER.find((d) => d.id === "ropa")!, AFTER_QUICKSTART);
    expect(ropa).toEqual({ state: "draft", gaps: [{ key: "toConfirm", count: 7 }] });
  });

  it("after confirming and filling records: ready", () => {
    const s = stateOf(FILLED);
    for (const id of ["regulatoryReport", "ropa", "vendorRegister", "dpa", "assessmentReport", "dpia", "dsarPerformance", "breachRegister", "breachNotification", "programmeReport"]) {
      expect(s[id], id).toBe("ready");
    }
    // One of two assessments still not approved: the portfolio is a draft.
    expect(s.assessmentPortfolio).toBe("draft");
  });

  it("names the gaps of a draft", () => {
    const facts = { ...FILLED, activitiesIncomplete: 2, incidentsMissingImpact: 1, assessmentsApproved: 0, dpiaApproved: 0 };
    const of = (id: string) => documentStatus(DOCUMENT_REGISTER.find((d) => d.id === id)!, facts);
    expect(of("ropa")).toEqual({ state: "draft", gaps: [{ key: "incomplete", count: 2 }] });
    expect(of("breachRegister")).toEqual({ state: "draft", gaps: [{ key: "impactMissing", count: 1 }] });
    expect(of("assessmentReport")).toEqual({ state: "draft", gaps: [{ key: "notApproved", count: 2 }] });
    expect(of("dpia")).toEqual({ state: "draft", gaps: [{ key: "notApproved", count: 1 }] });
  });

  it("d5: the DPIA needs the module where it is not installed, and after the two free ones", () => {
    const dpia = DOCUMENT_REGISTER.find((d) => d.id === "dpia")!;
    expect(documentStatus(dpia, { ...FILLED, dpiaAccess: "module" })).toEqual({ state: "needsInput", input: "dpiaModule" });
    expect(documentStatus(dpia, { ...FILLED, dpiaAccess: "quotaUsed" })).toEqual({
      state: "needsInput",
      input: "dpiaModuleHosted",
    });
    expect(INPUTS.dpiaModule.href).toBe("/privacy/skills");
    expect(INPUTS.dpiaModuleHosted).toEqual({ href: "plans", external: true });
    // The server reads access by the same rule as the assessment type grid.
    const facts = read("src/server/services/program/document-facts.ts");
    expect(facts).toContain('isAssessmentTypeLocked({ type: "DPIA", entitledTypes, hosted })');
    expect(facts).toContain('quota.capped && quota.remaining === 0) return "quotaUsed"');
  });

  it("respects the rights-request module switch", () => {
    const off = registerFor({ dsarEnabled: false }).map((d) => d.id);
    expect(off).not.toContain("dsarPerformance");
    expect(off).not.toContain("responseLetter");
    expect(registerFor({ dsarEnabled: true }).map((d) => d.id)).toContain("dsarPerformance");
    const router = read("src/server/routers/privacy/programPath.ts");
    expect(router).toContain("registerFor({ dsarEnabled: isDsarModuleEnabled() })");
    const deadlines = read("src/server/services/program/deadlines.ts");
    expect(deadlines).toContain("if (isDsarModuleEnabled())");
    expect(deadlines).toContain("dsarReadFilter(member.role, member.userId)");
  });
});

describe("the menu and the dashboard cannot disagree", () => {
  const cases: [string, DocumentFacts][] = [
    ["empty", EMPTY],
    ["after the quick start", AFTER_QUICKSTART],
    ["filled", FILLED],
  ];

  for (const [name, facts] of cases) {
    it(`${name}: every document on the panel is under its menu step or in the foot group, with the same state`, () => {
      const docs = evaluateRegister(registerFor({ dsarEnabled: true }), facts);
      const statuses = evaluatePath(DPO_CENTRAL_PATH, facts);
      const menu = stepDocumentRows(DPO_CENTRAL_PATH, statuses, docs);
      const panel = panelRows(docs);

      const inMenu = new Map<string, DocumentStatus>();
      for (const [stepId, rows] of Object.entries(menu)) {
        for (const row of rows) {
          expect(row.entry.stepId).toBe(stepId);
          inMenu.set(row.entry.id, row.doc.status);
        }
      }
      for (const row of panel.produced) {
        if (row.entry.stepId === null) continue; // the programme report: dashboard only
        expect(inMenu.get(row.entry.id), row.entry.id).toEqual(row.doc.status);
      }
      expect(inMenu.size).toBe(panel.produced.filter((r) => r.entry.stepId !== null).length);
      // The foot group is the panel's last line.
      expect(notYetEntries({ dsarEnabled: true }).map((e) => e.id)).toEqual(notYetRows(docs).map((r) => r.entry.id));
      // Same words: the menu line is built from the panel's state text.
      const t = T(en);
      for (const [stepId, rows] of Object.entries(menu)) {
        const line = stepNoteText(t, rows);
        for (const row of rows) expect(line, stepId).toContain(documentStateText(t, row.doc.status));
      }
    });
  }

  it("without the rights-request step (module off or a member who may not read requests) nothing is left dangling", () => {
    const config = withoutSteps(DPO_CENTRAL_PATH, ["dsar"]);
    const docs = evaluateRegister(registerFor({ dsarEnabled: false }), FILLED);
    const menu = stepDocumentRows(config, evaluatePath(config, FILLED), docs);
    expect(Object.keys(menu)).not.toContain("dsar");
  });

  it("the area tiles and the menu use the same state word", () => {
    const needs: NeedsActionItem[] = [{ kind: "breach-decision", count: 1, href: "/privacy/incidents" }];
    const statuses = evaluatePath(DPO_CENTRAL_PATH, { ...AFTER_QUICKSTART, incidents: 1 });
    const areas = programmeAreas(DPO_CENTRAL_PATH, statuses, needs);
    expect(areas).toHaveLength(6);
    for (const area of areas) {
      expect(area.word).toBe(stageWord(area.stage, statuses, attentionStages(needs)));
    }
    const byId = Object.fromEntries(areas.map((a) => [a.stage.id, a]));
    expect(byId.setup.word).toBe("done");
    expect(byId.people.word).toBe("coming");
    expect(byId.people.action).toEqual({ kind: "coming" });
    expect(byId.inventory.word).toBe("toConfirm");
    expect(byId.inventory.action).toEqual({ kind: "confirm" });
    expect(byId.respond.word).toBe("action");
    expect(byId.respond.action).toEqual({ kind: "needsAction", item: needs[0] });
    const menu = read("src/components/guided/path-menu.tsx");
    expect(menu).toContain("stageWord(stage, statuses!, attention)");
    for (const bundle of [en, es]) expect(bundle.guided.stageState.action).toBeTruthy();
  });

  it("the menu gathers the steps with no page yet at the foot instead of listing them", () => {
    const menu = read("src/components/guided/path-menu.tsx");
    expect(menu).toContain("isShown(step, statuses) && !step.coming");
    expect(menu).toContain('data-testid="menu-not-yet"');
    const layout = read("src/components/guided/guided-layout.tsx");
    expect(layout).toContain("notYetEntries({ dsarEnabled: isDsarModuleEnabled() })");
    expect(layout).toContain("stepDocumentRows(menuProps.config, menuProps.statuses, overview.documents)");
  });
});

describe("next three actions", () => {
  const needs: NeedsActionItem[] = [
    { kind: "drafts-to-confirm", count: 19, href: "/privacy/review" },
    { kind: "breach-decision", count: 1, href: "/privacy/incidents" },
  ];

  it("puts the work waiting first, most urgent first, then the path; three at most", () => {
    const statuses = evaluatePath(DPO_CENTRAL_PATH, AFTER_QUICKSTART);
    const actions = nextActions(DPO_CENTRAL_PATH, statuses, needs);
    expect(actions).toHaveLength(3);
    expect(actions[0]).toMatchObject({ kind: "needsAction", item: { kind: "breach-decision" } });
    expect(actions[1]).toMatchObject({ kind: "needsAction", item: { kind: "drafts-to-confirm" } });
    // The draft-only steps are covered by "confirm the drafts": the next is the first open step.
    expect(actions[2]).toMatchObject({ kind: "step", step: { id: "assessments" }, toConfirm: false });
  });

  it("without waiting work, offers the path's open steps, a draft-only one as a review", () => {
    const statuses = evaluatePath(DPO_CENTRAL_PATH, AFTER_QUICKSTART);
    const actions = nextActions(DPO_CENTRAL_PATH, statuses, []);
    expect(actions[0]).toMatchObject({ kind: "step", step: { id: "dataInventory" }, toConfirm: true });
  });

  it("is empty when nothing waits and every step is done", () => {
    const done = Object.fromEntries(allSteps.map((s) => [s.id, s.coming ? "coming" : "done"])) as ReturnType<typeof evaluatePath>;
    expect(nextActions(DPO_CENTRAL_PATH, done, [])).toEqual([]);
  });
});

describe("d7: the Guided dashboard", () => {
  const home = read("src/app/(dashboard)/privacy/page.tsx");
  const guided = read("src/components/guided/guided-dashboard.tsx");

  it("is the only dashboard (Classic retired, decision d11)", () => {
    expect(home).toContain("return <GuidedDashboard fromQuickstart={fromQuickstart} />;");
  });

  it("keeps the figure, the areas, the documents, the next actions and the deadlines", () => {
    for (const piece of ["<FirstRunCard />", "<ProgramFigureCard />", "<AreasCard", "<DocumentsPanel", "<NextActionsCard", "<DeadlinesCard"]) {
      expect(guided, piece).toContain(piece);
    }
    expect(guided).toContain('href="/privacy/needs-action"');
  });

  it("drops the expert banners, the four counters, Recent activity and Quick actions", () => {
    for (const gone of ["ExpertHelpCta", "DeploymentExpertCta", "kpi-assets", "recentActivity", "quickActions", "NextStepCard"]) {
      expect(guided, gone).not.toContain(gone);
    }
  });

  it("keeps one line about experts in Help, in both languages", () => {
    const help = read("src/components/help/page-help-button.tsx");
    expect(help).toContain('t("expertsLine")');
    expect(help).toContain("features.expertDirectoryEnabled");
    for (const bundle of [en, es]) {
      expect(bundle.help.expertsLine).toBeTruthy();
      expect(bundle.help.expertsLink).toBeTruthy();
    }
  });

  it("gives a member limited to departments no organisation-wide figures", () => {
    const router = read("src/server/routers/privacy/programPath.ts");
    expect(router).toContain("if (!scope.all) {");
    expect(router).toContain("limited: true as const, documents: [], needsAction: [], deadlines: []");
  });

  it("Spanish uses tú and no long dashes in the new words", () => {
    const words = JSON.stringify([es.documentRegister, es.guided.areas, es.guided.nextActions, es.guided.deadlines]);
    expect(words).not.toMatch(/\busted\b|\bsu programa\b/i);
    expect(words).not.toMatch(/[–—]/);
    expect(JSON.stringify(en.documentRegister)).not.toMatch(/[–—]/);
  });
});
