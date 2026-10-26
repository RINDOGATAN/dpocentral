// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * THE DOCUMENT REGISTER: every
 * document DPO Central can produce, and the ones it does not produce yet, in
 * one list. The dashboard's "Documents you can produce today" panel and the
 * quiet line under each step of the Guided menu both read this file (through
 * src/lib/programme-overview.ts), so they can never disagree.
 *
 * Each entry says where the document is produced, which step of the path it
 * belongs to, what it needs, and the rule that gives it one of four states:
 *
 * - `ready`       it can be produced and its content is real
 * - `draft`       it can be produced, but it still has gaps; the gaps are named
 *                 (and listed on the panel)
 * - `needsInput`  it cannot be produced until one input exists; the input is
 *                 named and linked to the place where it is added
 * - `notYet`      DPO Central does not produce it yet
 *
 * The rules read `DocumentFacts`: counts only, filled by the server
 * (src/server/services/program/document-facts.ts). Drafts count once a person
 * confirms them: a record the quick start or a template made and
 * nobody confirmed is a gap, never content.
 *
 * Pure: no React, no Prisma, no Next. Tested in tests/document-register.test.ts.
 */

import { DPO_CENTRAL_PATH, type PathCounts } from "@/components/guided/path-config";
import { evaluatePath, isStepMet } from "@/components/guided/path";

export type DocumentState = "ready" | "draft" | "needsInput" | "notYet";

/** What the rules read: the path's counts plus a few the documents need. */
export interface DocumentFacts extends PathCounts {
  /** Processing activities missing a field the record of processing requires. */
  activitiesIncomplete: number;
  /** DPIAs (assessments on a DPIA template) in any state. */
  dpiaAssessments: number;
  /** Of those, approved. */
  dpiaApproved: number;
  /**
   * Whether a new DPIA can be started here:
   * - `available`   the DPIA template is installed
   * - `module`      self-hosted without the DPIA module installed
   */
  dpiaAccess: "available" | "module";
  /** Data processing agreements produced with a vendor (contracts of type DPA). */
  dpaContracts: number;
  /** Incidents with no impact recorded (no records affected and no data categories). */
  incidentsMissingImpact: number;
  /** Notification records on incidents (to a regulator or to people). */
  incidentNotifications: number;
  /** AI assistance is switched on for the organisation and an engine is configured. */
  aiAssistOn: boolean;
  /** Rights requests completed. */
  dsarCompleted: number;
}

/** A gap a draft still has, in words under `documents.gaps.<key>`. */
export interface DocumentGap {
  key:
    | "toConfirm"
    | "incomplete"
    | "notApproved"
    | "dpiaDraftsToReview"
    | "impactMissing"
    | "openRequests"
    | "noRecords";
  count: number;
}

/**
 * The input a document waits for. Each has its words under
 * `documents.inputs.<key>` and the place where it is added in `INPUTS`.
 */
export type DocumentInput =
  | "jurisdiction"
  | "activity"
  | "vendor"
  | "assessment"
  | "dpiaStart"
  | "dpiaModule"
  | "dpaFacts"
  | "incident"
  | "aiAssist"
  | "notificationRecord"
  | "dsarRequest"
  | "confirmedStep"
  | "confirmDrafts";

export type DocumentStatus =
  | { state: "ready" }
  | { state: "draft"; gaps: DocumentGap[] }
  | {
      state: "needsInput";
      input: DocumentInput;
      /**
       * The input is an event that cannot be made to happen (a breach, a
       * rights request), and the means are in place for when it does: the
       * document is ready for when it is needed, shown as such, not as a gap.
       */
      standby?: true;
    }
  | { state: "notYet" };

export type DocumentFormat = "pdf" | "csv" | "screen";

export interface DocumentEntry {
  /** Stable id; also the i18n key under `documents.items.<id>`. */
  id: string;
  /**
   * The path step (src/components/guided/path-config.ts) whose menu line names
   * this document. Null for the programme report, which belongs to no single
   * step and is shown on the dashboard only.
   */
  stepId: string | null;
  /** The page where the document is produced. Null for a document not in DPO Central yet. */
  href: string | null;
  /**
   * The organisation-wide download, when there is one (`/api/export/...`,
   * the organisation id is added where it is used). Documents produced per
   * record (one assessment, one vendor's DPA) have none: the panel opens
   * their page.
   */
  download?: string;
  formats: DocumentFormat[];
  /** Left out of a deployment without that module (src/config/features.ts). */
  module?: "dsar";
  /** What it needs, in plain words, for the next person to change it. */
  needs: string;
  /** The state rule in plain words. */
  rule: string;
  /** The rule itself. Absent for a document not in DPO Central yet. */
  evaluate?: (facts: DocumentFacts) => DocumentStatus;
}

const confirmed = (total: number, drafts: number) => Math.max(0, total - drafts);
const ready = (): DocumentStatus => ({ state: "ready" });
const needs = (input: DocumentInput): DocumentStatus => ({ state: "needsInput", input });
const standby = (input: DocumentInput): DocumentStatus => ({ state: "needsInput", input, standby: true });

/** Waiting for an event, with the means in place: ready for when it is needed, not a gap. */
export function isStandby(status: DocumentStatus): boolean {
  return status.state === "needsInput" && status.standby === true;
}

/** Inputs that are a choice, not a gap: AI assistance is off by default and may stay off. */
const OPTIONAL_INPUTS: ReadonlySet<DocumentInput> = new Set(["aiAssist"]);

/** Waiting only for an optional setting: a plain note, never a gap to complete. */
export function isOptionalSetting(status: DocumentStatus): boolean {
  return status.state === "needsInput" && OPTIONAL_INPUTS.has(status.input);
}
/** A draft with the gaps that are not zero; ready when there are none. */
function draftOrReady(gaps: DocumentGap[]): DocumentStatus {
  const open = gaps.filter((g) => g.count > 0);
  return open.length > 0 ? { state: "draft", gaps: open } : ready();
}

/**
 * Where each input is added. `external` links leave the app (the storefront's
 * plans page, which states the prices; the app never does).
 */
export const INPUTS: Record<DocumentInput, { href: string; external?: boolean }> = {
  jurisdiction: { href: "/privacy/regulations" },
  activity: { href: "/privacy/data-inventory/processing-activities" },
  vendor: { href: "/privacy/vendors/new" },
  assessment: { href: "/privacy/assessments/new" },
  dpiaStart: { href: "/privacy/assessments/new?type=DPIA" },
  // Self-hosted: the modules page, where a signed module is installed and the
  // marketplace is linked.
  dpiaModule: { href: "/privacy/skills" },
  // The vendor list says what is missing and opens each vendor on its
  // Contracts tab, where the DPA is produced.
  dpaFacts: { href: "/privacy/vendors?missing=dpa" },
  incident: { href: "/privacy/incidents/new" },
  aiAssist: { href: "/privacy/settings" },
  notificationRecord: { href: "/privacy/incidents" },
  dsarRequest: { href: "/privacy/dsar" },
  // The quick start drafts the first records; confirming one completes a step.
  confirmedStep: { href: "/privacy/quickstart" },
  // Drafts exist: confirming them (with their minimum fields) is what is left.
  confirmDrafts: { href: "/privacy/review" },
};

/** The steps whose records give a report real content (stage "Know your data"). */
const KNOW_YOUR_DATA_STEPS = ["dataInventory", "ropa", "vendors"] as const;

export const DOCUMENT_REGISTER: readonly DocumentEntry[] = [
  // ---- Produced today: the inventory's eleven, and the board report -------
  {
    id: "regulatoryReport",
    stepId: "applies",
    href: "/privacy/regulations",
    download: "/api/export/regulatory-landscape",
    formats: ["pdf"],
    needs: "At least one declared jurisdiction (where the organization operates).",
    rule: "Ready when at least one jurisdiction is declared; otherwise needs one.",
    evaluate: (f) => (f.jurisdictions > 0 ? ready() : needs("jurisdiction")),
  },
  {
    id: "ropa",
    stepId: "ropa",
    href: "/privacy/data-inventory/processing-activities",
    download: "/api/export/ropa",
    formats: ["pdf", "csv"],
    needs: "At least one processing activity.",
    rule: "Needs an activity when there is none. Draft while any activity is a draft to confirm or misses a required field; ready otherwise.",
    evaluate: (f) =>
      f.processingActivities === 0
        ? needs("activity")
        : draftOrReady([
            { key: "toConfirm", count: f.processingActivitiesDrafts },
            { key: "incomplete", count: f.activitiesIncomplete },
          ]),
  },
  {
    id: "vendorRegister",
    stepId: "vendors",
    href: "/privacy/vendors",
    download: "/api/export/vendor-register",
    formats: ["pdf", "csv"],
    needs: "At least one vendor.",
    rule: "Needs a vendor when there is none. Draft while any vendor is a draft to confirm; ready otherwise.",
    evaluate: (f) =>
      f.vendors === 0 ? needs("vendor") : draftOrReady([{ key: "toConfirm", count: f.vendorsDrafts }]),
  },
  {
    id: "dpa",
    stepId: "vendors",
    href: "/privacy/vendors",
    formats: ["pdf"],
    needs: "A vendor and the contract facts entered on its Contracts tab (owner, admin or privacy officer). The TIA comes with it when data leaves the area.",
    rule: "Needs a vendor when there is none, then the contract facts for one. Ready once one DPA has been produced.",
    evaluate: (f) => (f.vendors === 0 ? needs("vendor") : f.dpaContracts === 0 ? needs("dpaFacts") : ready()),
  },
  {
    id: "assessmentReport",
    stepId: "assessments",
    href: "/privacy/assessments",
    formats: ["pdf"],
    needs: "One assessment (DPIA, PIA, TIA, LIA, vendor or custom). A draft exports with what is outstanding on page one.",
    rule: "Needs an assessment when there is none. Ready once one is approved; draft while none is.",
    evaluate: (f) =>
      f.assessments === 0
        ? needs("assessment")
        : f.assessmentsApproved > 0
          ? ready()
          : draftOrReady([{ key: "notApproved", count: f.assessments - f.assessmentsApproved }]),
  },
  {
    id: "dpia",
    stepId: "assessments",
    href: "/privacy/assessments",
    formats: ["pdf"],
    needs: "On the self-hosted kit, the DPIA module (its template installed from a signed module); on the hosted service every module is included, and the DPIA only needs one to be started.",
    rule: "The DPIAs already held decide first, whatever the module: draft while none is approved (the drafts waiting for review are counted), ready once one is. With none held, needs the DPIA module where it is not installed (self-hosted), or otherwise a DPIA to be started.",
    evaluate: (f) =>
      f.dpiaAssessments > 0
        ? f.dpiaApproved > 0
          ? ready()
          : draftOrReady([{ key: "dpiaDraftsToReview", count: f.dpiaAssessments - f.dpiaApproved }])
        : f.dpiaAccess === "module"
          ? needs("dpiaModule")
          : needs("dpiaStart"),
  },
  {
    id: "assessmentPortfolio",
    stepId: "assessments",
    href: "/privacy/assessments",
    download: "/api/export/assessment-portfolio",
    formats: ["pdf"],
    needs: "At least one assessment.",
    rule: "Needs an assessment when there is none. Draft while any assessment is not approved; ready when all are.",
    evaluate: (f) =>
      f.assessments === 0
        ? needs("assessment")
        : draftOrReady([{ key: "notApproved", count: f.assessments - f.assessmentsApproved }]),
  },
  {
    id: "dsarPerformance",
    stepId: "dsar",
    href: "/privacy/dsar",
    download: "/api/export/dsar-performance",
    formats: ["pdf"],
    module: "dsar",
    needs: "Rights requests on file.",
    rule: "On standby (ready for when it is needed) while no request has arrived: a request cannot be made to arrive, so its absence is never a gap. Draft while no request has been completed; ready once one has.",
    evaluate: (f) =>
      f.dsarRequests === 0
        ? standby("dsarRequest")
        : f.dsarCompleted > 0
          ? ready()
          : draftOrReady([{ key: "openRequests", count: f.dsarRequests - f.dsarCompleted }]),
  },
  {
    id: "breachRegister",
    stepId: "incidents",
    href: "/privacy/incidents",
    download: "/api/export/breach-register",
    formats: ["pdf", "csv"],
    needs: "At least one incident.",
    rule: "On standby (ready for when it is needed) while no incident is recorded: a breach cannot be made to happen, so its absence is never a gap. Draft while any incident has no impact recorded (records affected or data categories); ready otherwise.",
    evaluate: (f) =>
      f.incidents === 0
        ? standby("incident")
        : draftOrReady([{ key: "impactMissing", count: f.incidentsMissingImpact }]),
  },
  {
    id: "breachNotification",
    stepId: "incidents",
    href: "/privacy/incidents",
    formats: ["screen"],
    needs: "An incident and a notification record on it; the draft itself is written with AI assistance, which is a choice (off by default).",
    rule: "On standby while no incident is recorded (a breach cannot be made to happen). Then, with AI assistance off, the optional note that it drafts the notification when switched on (a choice, never a gap); with it on, needs a notification record. Ready once one exists.",
    evaluate: (f) =>
      f.incidents === 0
        ? standby("incident")
        : !f.aiAssistOn
          ? needs("aiAssist")
          : f.incidentNotifications === 0
            ? needs("notificationRecord")
            : ready(),
  },
  {
    id: "programmeReport",
    stepId: null,
    href: "/privacy",
    download: "/api/export/privacy-program",
    formats: ["pdf"],
    needs: "Nothing; useful once there is confirmed content.",
    rule: "Draft while there is no confirmed data asset or activity, or while any record is a draft to confirm; ready otherwise.",
    evaluate: (f) => {
      const drafts = f.dataAssetsDrafts + f.processingActivitiesDrafts + f.vendorsDrafts;
      const content =
        confirmed(f.dataAssets, f.dataAssetsDrafts) + confirmed(f.processingActivities, f.processingActivitiesDrafts);
      return draftOrReady([
        { key: "noRecords", count: content === 0 ? 1 : 0 },
        { key: "toConfirm", count: drafts },
      ]);
    },
  },

  {
    // The board report: the first missing document.
    id: "boardReport",
    stepId: "audits",
    href: "/privacy/board-report",
    download: "/api/export/board-report",
    formats: ["pdf"],
    needs: "At least one done step under Know your data (a complete, confirmed data asset, processing activity or vendor). Read from data already in DPO Central, for a chosen period (the last full quarter by default).",
    rule: "Ready when a Know your data step (data inventory, records of processing or vendors) is done: set-up steps alone (the quick start, where you operate) give the report no content. Otherwise needs the drafts confirmed on Review and confirm when there are drafts, or a confirmed step when there are none.",
    evaluate: (f) => {
      const statuses = evaluatePath(DPO_CENTRAL_PATH, f);
      if (KNOW_YOUR_DATA_STEPS.some((id) => isStepMet(statuses[id]))) return ready();
      return f.dataAssetsDrafts + f.processingActivitiesDrafts + f.vendorsDrafts > 0
        ? needs("confirmDrafts")
        : needs("confirmedStep");
    },
  },

  // ---- Not in DPO Central yet --------------------------------------------
  // Each sits under the step that would produce it, so every "coming" step on
  // the path is named here once (tests/document-register.test.ts).
  {
    id: "privacyNotice",
    stepId: "privacyPolicy",
    href: null,
    formats: [],
    needs: "A privacy notice generator.",
    rule: "Not in DPO Central yet.",
  },
  {
    id: "dpoAppointment",
    stepId: "dpoAppointed",
    href: null,
    formats: [],
    needs: "A page recording the DPO or privacy lead and the roles around it.",
    rule: "Not in DPO Central yet.",
  },
  {
    id: "trainingRecord",
    stepId: "training",
    href: null,
    formats: [],
    needs: "A staff training record.",
    rule: "Not in DPO Central yet.",
  },
  {
    id: "vendorReviewReport",
    stepId: "vendorDueDiligence",
    href: null,
    formats: [],
    needs: "The vendor risk assessment module (announced, not yet available).",
    rule: "Not in DPO Central yet.",
  },
  {
    id: "consentRecords",
    stepId: "notices",
    href: null,
    formats: [],
    needs: "Notices and consent records.",
    rule: "Not in DPO Central yet.",
  },
  {
    id: "responseLetter",
    stepId: "dsar",
    href: null,
    formats: [],
    module: "dsar",
    needs: "A response letter to a rights request (today only a link and a log are stored).",
    rule: "Not in DPO Central yet.",
  },
];

/** The register for this deployment: a document of a module that is off is left out. */
export function registerFor(options: { dsarEnabled: boolean }): DocumentEntry[] {
  return DOCUMENT_REGISTER.filter((d) => d.module !== "dsar" || options.dsarEnabled);
}

/** One document's state for these facts. */
export function documentStatus(entry: DocumentEntry, facts: DocumentFacts): DocumentStatus {
  return entry.evaluate ? entry.evaluate(facts) : { state: "notYet" };
}

/** What the server sends: one row per document, state and gaps, no record named. */
export interface EvaluatedDocument {
  id: string;
  status: DocumentStatus;
}

export function evaluateRegister(entries: readonly DocumentEntry[], facts: DocumentFacts): EvaluatedDocument[] {
  return entries.map((entry) => ({ id: entry.id, status: documentStatus(entry, facts) }));
}

/**
 * How many records of a step are confirmed, in draft, and confirmed but
 * missing a required field. The menu's status line states these numbers; the
 * tick and the programme figure keep their own rule (path-config.ts).
 */
export interface RecordCounts {
  confirmed: number;
  drafts: number;
  incomplete: number;
}

/** The steps whose menu line states counts, with the words under `documentRegister.counts.<key>`. */
export type CountedStepId = "dataInventory" | "ropa" | "vendors";

export function stepRecordCounts(facts: DocumentFacts): Record<CountedStepId, RecordCounts> {
  const of = (total: number, drafts: number, incomplete = 0): RecordCounts => ({
    confirmed: confirmed(total, drafts),
    drafts: Math.min(drafts, total),
    // Only records a person has confirmed can be "confirmed but incomplete".
    incomplete: Math.min(incomplete, confirmed(total, drafts)),
  });
  return {
    dataInventory: of(facts.dataAssets, facts.dataAssetsDrafts),
    ropa: of(facts.processingActivities, facts.processingActivitiesDrafts, facts.activitiesIncomplete),
    vendors: of(facts.vendors, facts.vendorsDrafts),
  };
}

export function documentEntry(id: string): DocumentEntry | undefined {
  return DOCUMENT_REGISTER.find((d) => d.id === id);
}
