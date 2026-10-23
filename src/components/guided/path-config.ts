// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * DPO Central's privacy program path: six stages, each step linked to a page
 * that already exists, each with its "done" rule written next to it.
 *
 * The rules read `PathCounts`, which the server fills with counts only
 * (src/server/services/program/path-counts.ts). They are pure and unit-tested
 * (path-config.test.ts). To change where a step leads or when it is done,
 * change it here: the menu, the next-step card, the phone bar and the client
 * portfolio all follow.
 *
 * The stages follow the owner-approved privacy path: set up, policies and
 * people, know your data, assess the risk, rights and transparency, respond
 * and improve. Steps with no page yet are shown as "coming" and never counted.
 * Quick start stays first: it and the vendor catalogue are the way in.
 */

import {
  Activity,
  AlertTriangle,
  Bot,
  Building2,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  Database,
  FileCheck2,
  FileText,
  Globe,
  GraduationCap,
  History,
  KeyRound,
  LifeBuoy,
  ListChecks,
  Megaphone,
  Network,
  Rocket,
  Scale,
  ScrollText,
  Search,
  Settings,
  Sparkles,
  Users,
  UserCheck,
  BarChart3,
} from "lucide-react";
import { withoutSteps, type PathConfig } from "./path";
import { features, isDsarModuleEnabled } from "@/config/features";
import { COMING_SOON_SKILL_IDS, SKILL_PACKAGE_IDS } from "@/config/skill-packages";
import type { PlanWindow } from "./plan";

/** The vendor risk assessment module is announced, not yet available. */
export const VENDOR_REVIEW_COMING = COMING_SOON_SKILL_IDS.has(SKILL_PACKAGE_IDS.VENDOR);

/**
 * What the rules read. Counts only: nothing here names a record.
 *
 * Drafts: a data asset, a processing
 * activity or a vendor that the quick start, an industry template or "Start
 * from another client" created is a draft until a person confirms it
 * (src/server/services/template-items/drafts.ts). The `...Drafts` counts are
 * the part of each total still waiting; the rules count only the rest, so a
 * step met by drafts alone reads "to confirm", never "done".
 */
export interface PathCounts {
  /** The quick start has been run to the end at least once (settings flag). */
  quickstartCompleted: boolean;
  /** Data assets (the inventory), drafts included. */
  dataAssets: number;
  /** Of those, drafts not yet confirmed. */
  dataAssetsDrafts: number;
  /** Confirmed data assets that record the personal data they hold (one data element or more). */
  dataAssetsComplete: number;
  /** Processing activities (records of processing / ROPA), drafts included. */
  processingActivities: number;
  /** Of those, drafts not yet confirmed. */
  processingActivitiesDrafts: number;
  /**
   * Confirmed processing activities with the minimum record fields: data
   * subjects, data categories and retention (src/lib/record-completeness.ts).
   */
  processingActivitiesComplete: number;
  /** Operating jurisdictions declared for the organisation. */
  jurisdictions: number;

  /** Vendors, drafts included. */
  vendors: number;
  /** Of those, drafts not yet confirmed. */
  vendorsDrafts: number;
  /** Confirmed vendors in use, with the data they process and where (missingVendorFields). */
  vendorsComplete: number;
  /** Vendors with an approved vendor (due-diligence) assessment. */
  vendorsAssessed: number;
  /**
   * Vendor (due-diligence) assessments, leaving out drafts the quick start
   * made on its own that nobody has opened and answered yet.
   */
  vendorAssessments: number;

  /**
   * Risk assessments (DPIA and PIA), leaving out untouched automatic drafts.
   * A vendor review or a legitimate-interest assessment is not counted here.
   */
  assessments: number;
  /** Risk assessments (DPIA and PIA) approved. */
  assessmentsApproved: number;
  /** Legitimate-interest assessments (an LIA template) in any state. */
  liaAssessments: number;
  /** Legitimate-interest assessments approved. */
  liaApproved: number;
  /** Cross-border transfers, including those of draft activities. */
  transfers: number;
  /** Of those, transfers recorded on a processing activity that is still a draft. */
  transfersDrafts: number;
  /**
   * Transfers not on a draft activity whose compliance status has been
   * recorded (compliant, needs review or not compliant; "pending" is not a
   * recorded assessment).
   */
  transfersComplete: number;

  /** Data-subject requests received. */
  dsarRequests: number;
  /**
   * Whether the org has actually set up its DSAR intake, past the default form
   * we auto-seed at org creation (so the public portal works out of the box).
   * The mere presence of the seeded form is no signal; see isIntakeConfigured.
   */
  dsarIntakeConfigured: boolean;

  incidents: number;

  /** AI systems using personal data (read-only; governed in AI Sentinel). */
  aiSystems: number;

  /**
   * Board reports saved (one per period, with the DPO's comment), read from
   * the organisation's settings (src/server/services/program/board-report.ts).
   * Optional: absent reads as none.
   */
  boardReportsSaved?: number;

  /**
   * For a step not yet done though records exist: the fields still missing on
   * the record closest to complete, so the page can say what finishes the
   * step. Field names only, never a record. Optional: absent reads as none.
   */
  missing?: Partial<Record<"dataInventory" | "ropa" | "vendors" | "transfers", string[]>>;
}

export const EMPTY_PATH_COUNTS: PathCounts = {
  quickstartCompleted: false,
  dataAssets: 0,
  dataAssetsDrafts: 0,
  dataAssetsComplete: 0,
  processingActivities: 0,
  processingActivitiesDrafts: 0,
  processingActivitiesComplete: 0,
  jurisdictions: 0,
  vendors: 0,
  vendorsDrafts: 0,
  vendorsComplete: 0,
  vendorsAssessed: 0,
  vendorAssessments: 0,
  assessments: 0,
  assessmentsApproved: 0,
  liaAssessments: 0,
  liaApproved: 0,
  transfers: 0,
  transfersDrafts: 0,
  transfersComplete: 0,
  dsarRequests: 0,
  dsarIntakeConfigured: false,
  incidents: 0,
  aiSystems: 0,
};

/** Records a person has confirmed (or entered by hand): the total less the drafts. */
const confirmed = (total: number, drafts: number) => Math.max(0, total - drafts);

/**
 * The status of a step that is met by "at least one usable record": done when
 * one confirmed record carries the step's minimum fields; started when records
 * are confirmed but none is complete yet (one bare record is not a register);
 * to confirm when there are only drafts; otherwise `otherwise`.
 */
function recordStep(
  total: number,
  drafts: number,
  complete: number,
  otherwise: "started" | "todo" = "todo",
): "done" | "toConfirm" | "started" | "todo" {
  if (complete > 0) return "done";
  if (confirmed(total, drafts) > 0) return "started";
  if (total > 0) return "toConfirm";
  return otherwise;
}

const FULL_PATH: PathConfig<PathCounts> = {
  stages: [
    {
      id: "setup",
      icon: Rocket,
      steps: [
        {
          id: "quickstart",
          href: "/privacy/quickstart",
          icon: Sparkles,
          // Sets up the whole organisation: not shown to a department-limited member.
          orgWide: true,
          rule: "Done when the quick start has been completed once, or when the work it would do already exists (at least one confirmed data asset and one confirmed vendor). Started when a data asset, a vendor or a processing activity exists.",
          status: (c) =>
            c.quickstartCompleted ||
            (confirmed(c.dataAssets, c.dataAssetsDrafts) > 0 && confirmed(c.vendors, c.vendorsDrafts) > 0)
              ? "done"
              : c.dataAssets + c.vendors + c.processingActivities > 0
                ? "started"
                : "todo",
        },
        {
          id: "applies",
          href: "/privacy/regulations",
          icon: Scale,
          rule: "Done when at least one operating jurisdiction is declared (which laws apply, where you operate). Nothing is asked twice: the quick start collects these.",
          status: (c) => (c.jurisdictions > 0 ? "done" : "todo"),
        },
      ],
    },
    {
      id: "people",
      icon: Users,
      steps: [
        {
          id: "privacyPolicy",
          href: null,
          icon: ScrollText,
          coming: true,
          rule: "Coming. No page records the privacy policy and notices yet; the DSAR intake form links to an external notice for now.",
        },
        {
          id: "dpoAppointed",
          href: null,
          icon: UserCheck,
          coming: true,
          rule: "Coming. No page records the appointment of a DPO or privacy lead and the roles around it yet.",
        },
        {
          id: "training",
          href: null,
          icon: GraduationCap,
          coming: true,
          rule: "Coming. No page records staff privacy training yet.",
        },
      ],
    },
    {
      id: "inventory",
      icon: Database,
      steps: [
        {
          id: "dataInventory",
          href: "/privacy/data-inventory",
          icon: Database,
          rule: "Done when at least one confirmed data asset (entered by a person, or drafted and then confirmed) records the personal data it holds (one data element or more). Started when assets are confirmed but none records its data yet. To confirm when only drafts exist.",
          status: (c) => recordStep(c.dataAssets, c.dataAssetsDrafts, c.dataAssetsComplete),
        },
        {
          id: "ropa",
          href: "/privacy/data-inventory/processing-activities",
          // An activity's own page (and its edit page) is this step, not 3.1.
          alsoAt: ["/privacy/data-inventory/activities"],
          icon: ClipboardList,
          rule: "Done when at least one confirmed processing activity (record of processing) has its data subjects, data categories and retention (the legal basis is required at creation). Started when activities are confirmed but none has these yet, or when a data asset exists without an activity. To confirm when only drafts exist.",
          status: (c) =>
            recordStep(
              c.processingActivities,
              c.processingActivitiesDrafts,
              c.processingActivitiesComplete,
              c.dataAssets > 0 ? "started" : "todo",
            ),
        },
        {
          id: "vendors",
          href: "/privacy/vendors",
          icon: Building2,
          rule: "Done when at least one confirmed vendor is in use (not only a prospect) and records the personal data it processes and the countries where it processes them (the vendor catalog fills these). Started when vendors are confirmed but none has these yet. To confirm when only drafts exist.",
          status: (c) => recordStep(c.vendors, c.vendorsDrafts, c.vendorsComplete),
        },
        // Last in the stage, read-only and never counted: it appears only when
        // the organisation actually has an AI system, and links to the list
        // that is governed in AI Sentinel.
        {
          id: "aiSystems",
          href: "/privacy/ai-systems",
          icon: Bot,
          optional: true,
          shownWhen: (c) => c.aiSystems > 0,
          rule: "Shown only when an AI system using personal data is recorded. Read-only here; governed in AI Sentinel. Never counted in progress.",
          status: (c) => (c.aiSystems > 0 ? "done" : "todo"),
        },
      ],
    },
    {
      id: "assess",
      icon: ClipboardCheck,
      steps: [
        {
          id: "assessments",
          href: "/privacy/assessments",
          icon: ClipboardCheck,
          // No lock on the step: most
          // assessments here need no licence. Where the DPIA is not licensed,
          // the lock sits on the DPIA option inside the assessments page and
          // the type picker instead (src/components/premium/licence-lock.tsx).
          rule: "Done when at least one risk assessment (DPIA or PIA) is approved; a vendor review or a legitimate-interest assessment does not count. Started when a risk assessment exists, leaving out drafts the quick start made on its own that nobody has answered yet.",
          status: (c) =>
            c.assessmentsApproved > 0 ? "done" : c.assessments > 0 ? "started" : "todo",
        },
        {
          id: "transfers",
          href: "/privacy/transfers",
          icon: Globe,
          rule: "Done when at least one cross-border transfer, not on a draft activity, has its mechanism and a recorded compliance status (compliant, needs review or not compliant; pending is not yet an assessment). Started when transfers exist but none has a recorded status. To confirm when every transfer sits on a draft activity.",
          status: (c) => recordStep(c.transfers, c.transfersDrafts, c.transfersComplete),
        },
        {
          id: "vendorDueDiligence",
          // The vendor list opened on its due-diligence view: each vendor's
          // review state. The page reads the view where it is wired; the menu
          // marks this step whichever way the page renders it.
          //
          // While the vendor risk assessment module is announced but not yet
          // available (skill-packages.ts, COMING_SOON_SKILL_IDS), nobody can
          // complete the step: it is "coming", never counted and never offered
          // as a next action, like the policies steps.
          href: VENDOR_REVIEW_COMING ? null : "/privacy/vendors?view=due-diligence",
          coming: VENDOR_REVIEW_COMING || undefined,
          // Vendor assessments are a premium type on the kit.
          premiumType: "VENDOR",
          icon: FileCheck2,
          rule: "Coming while the vendor risk assessment module is announced but not available. Then: done when every vendor has an approved vendor (due-diligence) assessment; started when a vendor assessment exists, leaving out untouched automatic drafts; a DPIA linked to a vendor is not a due-diligence review.",
          status: VENDOR_REVIEW_COMING ? undefined : vendorDueDiligenceStatus,
        },
        // The assessment picker offers the legitimate-interest template as
        // included, so the step opens it rather than calling it "coming".
        // Optional: it is needed only where legitimate interest is the legal
        // basis, so it is never counted and never offered as the next step.
        // Last in the stage, after the counted steps.
        {
          id: "lia",
          href: "/privacy/assessments/new?type=LIA",
          icon: Scale,
          optional: true,
          rule: "Optional, never counted: needed only where legitimate interest is the legal basis. Opens the assessment form on the legitimate-interest template. Done when a legitimate-interest assessment is approved; started when one exists.",
          status: (c) =>
            c.liaApproved > 0 ? "done" : c.liaAssessments > 0 ? "started" : "todo",
        },
      ],
    },
    {
      id: "rights",
      icon: KeyRound,
      steps: [
        {
          id: "dsar",
          href: "/privacy/dsar",
          icon: FileText,
          // A request cannot be made to arrive, so readiness is the bar: the
          // step is met ("ready when needed") once the intake is set up, and
          // a logged request alone does not stand in for that set-up.
          rule: "Ready when needed (met) once the org has set up its intake past the auto-seeded default; done when, in addition, a rights request has been received. Started when requests exist but the intake is still the default. Not started for a new org that has only the seeded form and no requests.",
          status: (c) =>
            c.dsarIntakeConfigured
              ? c.dsarRequests > 0
                ? "done"
                : "ready"
              : c.dsarRequests > 0
                ? "started"
                : "todo",
        },
        {
          id: "notices",
          href: null,
          icon: Megaphone,
          coming: true,
          rule: "Coming. No page records notices and consent records yet.",
        },
      ],
    },
    {
      id: "respond",
      icon: Activity,
      steps: [
        {
          id: "incidents",
          href: "/privacy/incidents",
          icon: AlertTriangle,
          // A breach cannot be made to happen, so readiness is the bar: the
          // register is ready when needed once the record of processing says
          // which data and people a breach would touch (Art. 33(3)(a)).
          rule: "Done when at least one incident (breach) is recorded. Ready when needed (met) once one processing activity is complete (the record names the data and people a breach would affect). Not started before.",
          status: (c) => (c.incidents > 0 ? "done" : c.processingActivitiesComplete > 0 ? "ready" : "todo"),
        },
        // The board report: a short
        // report to the board or management for a period, from data already
        // here. Optional, so it never changes the programme figure and is
        // never offered as the next step; last in the stage.
        {
          id: "audits",
          href: "/privacy/board-report",
          icon: History,
          optional: true,
          rule: "Optional, never counted. Opens the board report. Done once a board report has been saved for a period (with or without the DPO's comment); not started before.",
          status: (c) => ((c.boardReportsSaved ?? 0) > 0 ? "done" : "todo"),
        },
      ],
    },
  ],
  // "All clients" is the one client view in Guided, and it sits once, at the
  // top of the menu (the client switcher block in guided-layout.tsx). It is
  // deliberately NOT repeated here under "Library and tools".
  // "Library and tools": every entry of the retired Classic menus that is not
  // a step, once (tests/guided-path.test.ts keeps it so).
  library: ({ stripeEnabled, auditTrail = true }) => [
    // The two ready lists (stage 4): what is waiting, and what is unfinished.
    { id: "needsAction", href: "/privacy/needs-action", icon: ListChecks },
    { id: "incomplete", href: "/privacy/incomplete", icon: ClipboardList },
    { id: "reports", href: "/privacy/reports", icon: BarChart3 },
    // The data map, as a page of its own (it is also a tab of Data inventory).
    { id: "dataMap", href: "/privacy/data-map", icon: Network },
    // The organisation's audit trail (as
    // AI Sentinel has it): owners, admins and privacy officers only
    // (src/lib/audit-access.ts), so the menu leaves it out for anyone else.
    ...(auditTrail
      ? [{ id: "auditTrail", href: "/privacy/audit-trail", icon: ScrollText }]
      : []),
    ...(features.expertDirectoryEnabled ? [{ id: "experts", href: "/privacy/experts", icon: Search }] : []),
    { id: "skills", href: "/privacy/skills", icon: KeyRound },
    ...(stripeEnabled
      ? [{ id: "billing", href: "/privacy/billing", icon: CreditCard }]
      : []),
    // Help and docs sits with the tools, alongside the footer "User guide"
    // link: a second, more findable way to the reference.
    { id: "help", href: "/privacy/docs", icon: LifeBuoy },
    { id: "settings", href: "/privacy/settings", icon: Settings },
  ],
};

/**
 * The path this deployment shows. Without the rights-request module
 * (NEXT_PUBLIC_DSAR_ENABLED=false, src/config/features.ts) the "dsar" step is
 * left out everywhere: the menu, the progress, the next step and the plan.
 */
export const DPO_CENTRAL_PATH: PathConfig<PathCounts> = isDsarModuleEnabled()
  ? FULL_PATH
  : withoutSteps(FULL_PATH, ["dsar"]);

/**
 * The 30/60/90-day plan over the six stages (src/components/guided/plan.ts):
 * set up and people in the first thirty days, know-your-data and assessment in
 * the next thirty, rights and response in the last thirty. Day 1 is the day
 * the program started (src/server/services/program/plan-start.ts).
 */
export const PLAN_WINDOWS: readonly PlanWindow[] = [
  { untilDay: 30, stages: ["setup", "people"] },
  { untilDay: 60, stages: ["inventory", "assess"] },
  { untilDay: 90, stages: ["rights", "respond"] },
];

/**
 * Vendor due diligence, once the vendor risk assessment module is available:
 * done when every vendor has an approved vendor (due-diligence) assessment;
 * started when a vendor assessment exists.
 */
export function vendorDueDiligenceStatus(c: PathCounts): "done" | "started" | "todo" {
  return c.vendors > 0 && c.vendorsAssessed >= c.vendors ? "done" : c.vendorAssessments > 0 ? "started" : "todo";
}
