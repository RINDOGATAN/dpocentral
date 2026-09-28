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
  Megaphone,
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
import type { PathConfig } from "./path";
import type { PlanWindow } from "./plan";

/** What the rules read. Counts only: nothing here names a record. */
export interface PathCounts {
  /** The quick start has been run to the end at least once (settings flag). */
  quickstartCompleted: boolean;
  /** Data assets (the inventory). */
  dataAssets: number;
  /** Processing activities (records of processing / ROPA). */
  processingActivities: number;
  /** Operating jurisdictions declared for the organisation. */
  jurisdictions: number;

  vendors: number;
  /** Vendors with a completed due-diligence assessment (approved, vendor-linked). */
  vendorsAssessed: number;
  /** Vendor-linked assessments in any state. */
  vendorAssessments: number;

  assessments: number;
  assessmentsApproved: number;
  transfers: number;

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
}

export const EMPTY_PATH_COUNTS: PathCounts = {
  quickstartCompleted: false,
  dataAssets: 0,
  processingActivities: 0,
  jurisdictions: 0,
  vendors: 0,
  vendorsAssessed: 0,
  vendorAssessments: 0,
  assessments: 0,
  assessmentsApproved: 0,
  transfers: 0,
  dsarRequests: 0,
  dsarIntakeConfigured: false,
  incidents: 0,
  aiSystems: 0,
};

export const DPO_CENTRAL_PATH: PathConfig<PathCounts> = {
  stages: [
    {
      id: "setup",
      icon: Rocket,
      steps: [
        {
          id: "quickstart",
          href: "/privacy/quickstart",
          icon: Sparkles,
          rule: "Done when the quick start has been completed once, or when the work it would do already exists (at least one data asset and one vendor). Started when a data asset, a vendor or a processing activity exists.",
          status: (c) =>
            c.quickstartCompleted || (c.dataAssets > 0 && c.vendors > 0)
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
          rule: "Done when at least one data asset is recorded. Started never: an inventory is either begun or not.",
          status: (c) => (c.dataAssets > 0 ? "done" : "todo"),
        },
        {
          id: "ropa",
          href: "/privacy/data-inventory/processing-activities",
          icon: ClipboardList,
          rule: "Done when at least one processing activity (record of processing) is recorded. Started when a data asset exists without one.",
          status: (c) =>
            c.processingActivities > 0 ? "done" : c.dataAssets > 0 ? "started" : "todo",
        },
        {
          id: "vendors",
          href: "/privacy/vendors",
          icon: Building2,
          rule: "Done when at least one vendor is recorded (the vendor catalogue is the way to add one).",
          status: (c) => (c.vendors > 0 ? "done" : "todo"),
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
          rule: "Done when at least one assessment is approved (DPIA, PIA and screening). Started when any assessment exists.",
          status: (c) =>
            c.assessmentsApproved > 0 ? "done" : c.assessments > 0 ? "started" : "todo",
        },
        {
          id: "transfers",
          href: "/privacy/transfers",
          icon: Globe,
          rule: "Done when at least one cross-border transfer is recorded with its mechanism. Started never.",
          status: (c) => (c.transfers > 0 ? "done" : "todo"),
        },
        {
          id: "vendorDueDiligence",
          // The vendor list opened on its due-diligence view: each vendor's
          // review state. The page reads the view where it is wired; the menu
          // marks this step whichever way the page renders it.
          href: "/privacy/vendors?view=due-diligence",
          icon: FileCheck2,
          rule: "Done when every vendor has a completed due-diligence assessment. Started when any vendor assessment exists.",
          status: (c) =>
            c.vendors > 0 && c.vendorsAssessed >= c.vendors
              ? "done"
              : c.vendorAssessments > 0
                ? "started"
                : "todo",
        },
        {
          id: "lia",
          href: null,
          icon: Scale,
          coming: true,
          rule: "Coming. Legitimate-interest assessments are a template, not their own page yet.",
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
          rule: "Done when at least one rights request has been received. Started when the org has set up its intake past the auto-seeded default (the surface is ready to receive). Not started for a new org that has only the seeded form and no requests.",
          status: (c) =>
            c.dsarRequests > 0 ? "done" : c.dsarIntakeConfigured ? "started" : "todo",
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
          rule: "Done when at least one incident (breach) is recorded: the register and the 72-hour clock are in use.",
          status: (c) => (c.incidents > 0 ? "done" : "todo"),
        },
        {
          id: "audits",
          href: null,
          icon: History,
          coming: true,
          rule: "Coming. Audits, reviews and reports to management have no dedicated page yet.",
        },
      ],
    },
  ],
  // "All clients" is the one client view in Guided, and it sits once, at the
  // top of the menu (the client switcher block in guided-layout.tsx). It is
  // deliberately NOT repeated here under "Library and tools".
  // "Library and tools": every Classic entry that is not a step, once.
  library: ({ stripeEnabled }) => [
    { id: "reports", href: "/privacy/reports", icon: BarChart3 },
    { id: "experts", href: "/privacy/experts", icon: Search },
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
