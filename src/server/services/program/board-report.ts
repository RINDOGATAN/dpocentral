// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The board report's data (owner's decision d12, 9 October 2026), assembled
 * once for the page and for the PDF (src/lib/board-report.ts holds the shape
 * and the readings). Everything is read from what DPO Central already holds,
 * scoped to the organisation; counts, dates and the people's names that own
 * the actions, never a record's content. The only thing written is the DPO's
 * comment, kept in the organisation's settings under `boardReport.reports`,
 * one per period (no table, no migration).
 *
 * Incidents and rights requests are counted for the period; every other
 * figure is as on the day the report is generated (the report says so).
 *
 * The caller has checked who is asking: a member of the organisation who
 * sees the whole organisation (src/lib/department-limit.ts).
 */

import type { Db } from "@/lib/prisma";
import { DPO_CENTRAL_PATH, PLAN_WINDOWS } from "@/components/guided/path-config";
import { evaluatePath, programFigure, withoutSteps } from "@/components/guided/path";
import { evaluateRegister, registerFor } from "@/config/document-register";
import { isDsarModuleEnabled } from "@/config/features";
import { canHandleDsars } from "@/lib/dsar-access";
import { BREACH_WINDOW_HOURS } from "@/lib/breach-window";
import { programmeAreas } from "@/lib/programme-overview";
import {
  COMMENT_MAX,
  SAVED_REPORTS_MAX,
  boardActions,
  periodBounds,
  periodKey,
  topRisks,
  type BoardComment,
  type BoardPeriod,
  type BoardReport,
} from "@/lib/board-report";
import { DRAFT_WHERE } from "@/server/services/template-items/drafts";
import { collectNeedsAction } from "@/server/services/views/queries";
import { loadDocumentFacts } from "./document-facts";
import { loadPlanStart } from "./plan-start";
import { loadDeadlines } from "./deadlines";

const HOUR_MS = 60 * 60 * 1000;
const OPEN_INCIDENT = { notIn: ["CLOSED", "FALSE_POSITIVE"] as ("CLOSED" | "FALSE_POSITIVE")[] };
const PENDING_ASSESSMENT = ["DRAFT", "IN_PROGRESS", "PENDING_REVIEW", "PENDING_APPROVAL"] as const;
const OFFICER_ROLES = ["PRIVACY_OFFICER", "OWNER", "ADMIN"] as const;

function settingsObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

interface SavedReport {
  comment: string;
  savedAt: string;
  savedBy: string | null;
}

/** The saved reports in the organisation's settings, by period key. */
export function savedReports(settings: unknown): Record<string, SavedReport> {
  const reports = settingsObject(settingsObject(settingsObject(settings).boardReport).reports);
  const out: Record<string, SavedReport> = {};
  for (const [key, value] of Object.entries(reports)) {
    const row = settingsObject(value);
    if (typeof row.savedAt !== "string") continue;
    out[key] = {
      comment: typeof row.comment === "string" ? row.comment : "",
      savedAt: row.savedAt,
      savedBy: typeof row.savedBy === "string" ? row.savedBy : null,
    };
  }
  return out;
}

/** The person who holds programme actions: the privacy officer, else the owner, else an admin. */
async function loadOwner(prisma: Db, organizationId: string): Promise<string | null> {
  const members = await prisma.organizationMember.findMany({
    where: { organizationId, role: { in: [...OFFICER_ROLES] } },
    orderBy: { joinedAt: "asc" },
    select: { role: true, user: { select: { name: true, email: true } } },
  });
  for (const role of OFFICER_ROLES) {
    const member = members.find((m) => m.role === role);
    if (member) return member.user.name?.trim() || member.user.email || null;
  }
  return null;
}

export async function loadBoardReport(
  prisma: Db,
  args: {
    organizationId: string;
    organizationName: string;
    period: BoardPeriod;
    member: { role: string | null | undefined; userId: string };
    now?: Date;
  },
): Promise<BoardReport> {
  const { organizationId, period, member } = args;
  const now = args.now ?? new Date();
  const org = { organizationId };
  const { start, end } = periodBounds(period);
  const inPeriod = { gte: start, lt: end };
  const dsarOn = isDsarModuleEnabled();
  const dsarAllowed = dsarOn && canHandleDsars(member.role);
  // A member who may not read rights requests sees no rights-request step, as on the dashboard.
  const config = dsarAllowed ? DPO_CENTRAL_PATH : withoutSteps(DPO_CENTRAL_PATH, ["dsar"]);
  const confirmedVendor = { ...org, status: { not: "TERMINATED" as const }, NOT: DRAFT_WHERE };
  const liveDpa = { type: "DPA" as const, status: { notIn: ["EXPIRED" as const, "TERMINATED" as const] } };

  const [
    facts,
    needs,
    deadlines,
    owner,
    organization,
    incidents,
    openNow,
    requests,
    vendorsTotal,
    vendorsWithDpa,
    highRiskWithoutDpa,
    vendorDrafts,
    dpiaApproved,
    dpiaPending,
    liaApproved,
    liaPending,
  ] = await Promise.all([
    loadDocumentFacts(prisma, organizationId),
    collectNeedsAction(prisma, organizationId, { all: true }),
    loadDeadlines(prisma, organizationId, member, now),
    loadOwner(prisma, organizationId),
    prisma.organization.findFirst({ where: { id: organizationId }, select: { settings: true } }),
    prisma.incident.findMany({
      where: { ...org, discoveredAt: inPeriod },
      select: {
        discoveredAt: true,
        notificationRequired: true,
        notifications: { where: { recipientType: "DPA" }, select: { sentAt: true } },
      },
    }),
    prisma.incident.count({ where: { ...org, status: OPEN_INCIDENT } }),
    dsarAllowed
      ? prisma.dSARRequest.findMany({
          where: { ...org, receivedAt: inPeriod },
          select: { status: true, dueDate: true, extendedDueDate: true, completedAt: true },
        })
      : null,
    prisma.vendor.count({ where: confirmedVendor }),
    prisma.vendor.count({ where: { ...confirmedVendor, contracts: { some: liveDpa } } }),
    prisma.vendor.count({
      where: { ...confirmedVendor, riskTier: { in: ["HIGH", "CRITICAL"] }, contracts: { none: liveDpa } },
    }),
    prisma.vendor.count({ where: { ...org, ...DRAFT_WHERE } }),
    prisma.assessment.count({ where: { ...org, status: "APPROVED", template: { type: "DPIA" } } }),
    prisma.assessment.count({ where: { ...org, status: { in: [...PENDING_ASSESSMENT] }, template: { type: "DPIA" } } }),
    prisma.assessment.count({ where: { ...org, status: "APPROVED", template: { type: "LIA" } } }),
    prisma.assessment.count({ where: { ...org, status: { in: [...PENDING_ASSESSMENT] }, template: { type: "LIA" } } }),
  ]);

  const statuses = evaluatePath(config, facts);
  const planStart = await loadPlanStart(prisma, organizationId, statuses.quickstart === "done");
  // Rights-request work is left out for a member who does not handle requests.
  const needsAction = dsarAllowed ? needs.items : needs.items.filter((i) => i.kind !== "dsar-due");
  const documents = evaluateRegister(registerFor({ dsarEnabled: dsarAllowed }), facts);

  // Incidents discovered in the period, and their notification to the authority.
  let notifiedWithin72h = 0;
  let notifiedLate = 0;
  let notNotifiedYet = 0;
  for (const incident of incidents) {
    const sent = incident.notifications
      .map((n) => n.sentAt)
      .filter((d): d is Date => d != null)
      .sort((a, b) => a.getTime() - b.getTime())[0];
    if (sent) {
      const hours = (sent.getTime() - incident.discoveredAt.getTime()) / HOUR_MS;
      if (hours <= BREACH_WINDOW_HOURS) notifiedWithin72h++;
      else notifiedLate++;
    } else if (incident.notificationRequired) {
      notNotifiedYet++;
    }
  }

  let rights: BoardReport["rights"] = null;
  if (requests) {
    rights = { received: requests.length, completedOnTime: 0, completedLate: 0, openOverdue: 0, openInTime: 0, closedOther: 0 };
    for (const r of requests) {
      const due = r.extendedDueDate ?? r.dueDate;
      if (r.status === "COMPLETED") {
        if (r.completedAt && r.completedAt.getTime() > due.getTime()) rights.completedLate++;
        else rights.completedOnTime++;
      } else if (r.status === "REJECTED" || r.status === "CANCELLED") {
        rights.closedOther++;
      } else if (due.getTime() < now.getTime()) {
        rights.openOverdue++;
      } else {
        rights.openInTime++;
      }
    }
  }

  const saved = savedReports(organization?.settings)[periodKey(period)];
  let comment: BoardComment | null = null;
  if (saved) {
    comment = { text: saved.comment, savedAt: saved.savedAt, savedBy: null };
    if (saved.savedBy) {
      const user = await prisma.user.findUnique({ where: { id: saved.savedBy }, select: { name: true, email: true } });
      comment.savedBy = user ? user.name?.trim() || user.email || null : null;
    }
  }

  return {
    organizationName: args.organizationName,
    period,
    generatedAt: now.toISOString(),
    figure: programFigure(config, statuses),
    areas: programmeAreas(config, statuses, needsAction).map((area) => ({ stageId: area.stage.id, word: area.word })),
    documents,
    incidents: { inPeriod: incidents.length, notifiedWithin72h, notifiedLate, notNotifiedYet, openNow },
    rights,
    vendors: { total: vendorsTotal, withDpa: vendorsWithDpa, highRiskWithoutDpa, drafts: vendorDrafts },
    assessments: { dpiaApproved, dpiaPending, liaApproved, liaPending },
    risks: topRisks(needsAction, documents),
    actions: boardActions(config, statuses, needsAction, {
      owner,
      deadlines: deadlines.filter((d) => dsarAllowed || d.kind !== "dsarDue"),
      planStart,
      windows: PLAN_WINDOWS,
    }),
    comment,
    canSave: (OFFICER_ROLES as readonly string[]).includes(member.role ?? ""),
  };
}

/**
 * Saves the DPO's comment for a period (an empty comment saves the report
 * with no comment). Kept in the organisation's settings, the other settings
 * untouched; the most recent `SAVED_REPORTS_MAX` periods are kept.
 */
export async function saveBoardReportComment(
  prisma: Db,
  args: { organizationId: string; period: BoardPeriod; comment: string; userId: string; now?: Date },
): Promise<BoardComment> {
  const now = args.now ?? new Date();
  const text = args.comment.replace(/\r\n/g, "\n").trim().slice(0, COMMENT_MAX);
  const organization = await prisma.organization.findFirst({
    where: { id: args.organizationId },
    select: { settings: true },
  });
  const settings = settingsObject(organization?.settings);
  const boardReport = settingsObject(settings.boardReport);
  const reports = { ...savedReports(settings), [periodKey(args.period)]: { comment: text, savedAt: now.toISOString(), savedBy: args.userId } };
  const kept = Object.fromEntries(
    Object.entries(reports)
      .sort(([, a], [, b]) => b.savedAt.localeCompare(a.savedAt))
      .slice(0, SAVED_REPORTS_MAX),
  );
  await prisma.organization.update({
    where: { id: args.organizationId },
    data: { settings: { ...settings, boardReport: { ...boardReport, reports: kept } } },
  });
  await prisma.auditLog.create({
    data: {
      organizationId: args.organizationId,
      userId: args.userId,
      entityType: "Organization",
      entityId: args.organizationId,
      action: "SAVE_BOARD_REPORT",
      changes: { from: args.period.from, to: args.period.to, commentLength: text.length },
    },
  });
  return { text, savedAt: now.toISOString(), savedBy: null };
}
