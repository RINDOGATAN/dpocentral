// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * THE DOCUMENT REGISTER (owner's decisions d4 and d5, 9 October 2026): every
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
 * confirms them (decision d2): a record the quick start or a template made and
 * nobody confirmed is a gap, never content.
 *
 * Pure: no React, no Prisma, no Next. Tested in tests/document-register.test.ts.
 */

import type { PathCounts } from "@/components/guided/path-config";

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
   * Whether a new DPIA can be started here (decision d5):
   * - `available`   the DPIA template is installed (or the pilot still has free ones)
   * - `module`      self-hosted without the DPIA module installed
   * - `quotaUsed`   hosted, after the two free DPIAs
   */
  dpiaAccess: "available" | "module" | "quotaUsed";
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
  | "dpiaModuleHosted"
  | "dpaFacts"
  | "incident"
  | "aiAssist"
  | "notificationRecord"
  | "dsarRequest";

export type DocumentStatus =
  | { state: "ready" }
  | { state: "draft"; gaps: DocumentGap[] }
  | { state: "needsInput"; input: DocumentInput }
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
  // Hosted after the two free DPIAs: the storefront's plans page (resolved
  // per language where it is shown, src/lib/hosted.ts plansUrl).
  dpiaModuleHosted: { href: "plans", external: true },
  dpaFacts: { href: "/privacy/vendors" },
  incident: { href: "/privacy/incidents/new" },
  aiAssist: { href: "/privacy/settings" },
  notificationRecord: { href: "/privacy/incidents" },
  dsarRequest: { href: "/privacy/dsar" },
};

export const DOCUMENT_REGISTER: readonly DocumentEntry[] = [
  // ---- Produced today: the inventory's eleven ----------------------------
  {
    id: "regulatoryReport",
    stepId: "applies",
    href: "/privacy/regulations",
    download: "/api/export/regulatory-landscape",
    formats: ["pdf"],
    needs: "At least one declared jurisdiction (where the organisation operates).",
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
    needs: "The DPIA module: on the self-hosted kit, its template installed from a signed module; on the hosted service, two are free per organisation.",
    rule: "Needs the DPIA module where it is not installed (self-hosted) or after the two free ones (hosted). Otherwise needs a DPIA to be started; draft while none is approved; ready once one is.",
    evaluate: (f) =>
      f.dpiaAccess === "module"
        ? needs("dpiaModule")
        : f.dpiaAccess === "quotaUsed"
          ? needs("dpiaModuleHosted")
          : f.dpiaAssessments === 0
            ? needs("dpiaStart")
            : f.dpiaApproved > 0
              ? ready()
              : draftOrReady([{ key: "notApproved", count: f.dpiaAssessments - f.dpiaApproved }]),
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
    rule: "Needs a request when there is none. Draft while no request has been completed; ready once one has.",
    evaluate: (f) =>
      f.dsarRequests === 0
        ? needs("dsarRequest")
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
    rule: "Needs an incident when there is none. Draft while any incident has no impact recorded (records affected or data categories); ready otherwise.",
    evaluate: (f) =>
      f.incidents === 0
        ? needs("incident")
        : draftOrReady([{ key: "impactMissing", count: f.incidentsMissingImpact }]),
  },
  {
    id: "breachNotification",
    stepId: "incidents",
    href: "/privacy/incidents",
    formats: ["screen"],
    needs: "AI assistance switched on (off by default), an incident, and a notification record on it.",
    rule: "Needs AI assistance while it is off, then an incident, then a notification record. Ready once all three exist.",
    evaluate: (f) =>
      !f.aiAssistOn
        ? needs("aiAssist")
        : f.incidents === 0
          ? needs("incident")
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
  {
    id: "boardReport",
    stepId: "audits",
    href: null,
    formats: [],
    needs: "A board report page (the data procedure exists).",
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

export function documentEntry(id: string): DocumentEntry | undefined {
  return DOCUMENT_REGISTER.find((d) => d.id === id);
}
