// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

// The two ready lists the stage-4 directive asks for: "Needs action" (everything
// waiting for a person) and "Incomplete" (processing records missing required
// fields). Both are org-guarded and department-scoped: a member limited to a
// department sees only that department's records, and an unlimited member can
// narrow to a department on demand.
//
// The rules themselves are pure (src/lib/needs-action.ts, record-
// completeness.ts); this file only gathers the counts and rows they read. Only
// the categories that hang off a record or system (reviews due, and the
// incomplete list) can be narrowed to a department; the DSAR, breach and
// assessment categories are organisation-wide and are left out of a department
// view rather than shown as an org-wide number under a department name.

import type { Db } from "@/lib/prisma";
import { isDsarModuleEnabled } from "@/config/features";
import {
  buildNeedsAction,
  needsActionTotal,
  type NeedsActionCounts,
} from "@/lib/needs-action";
import { missingRecordFields, type RecordField } from "@/lib/record-completeness";
import { breachWindowOpenSince } from "@/lib/breach-window";
import {
  departmentScopeConditions,
  type BusinessUnitScope,
} from "@/server/services/business-units/scope";

const OPEN_DSAR_EXCLUDED = ["COMPLETED", "REJECTED", "CANCELLED"] as const;
const CLOSED_INCIDENT = ["CLOSED", "FALSE_POSITIVE"] as const;
const PENDING_ASSESSMENT = ["PENDING_APPROVAL", "PENDING_REVIEW"] as const;
const DSAR_DUE_WINDOW_DAYS = 7;
const INCOMPLETE_LIMIT = 200;

export interface NeedsActionResult {
  items: ReturnType<typeof buildNeedsAction>;
  total: number;
  /// Whether the result is narrowed to a department (so the UI can say so, and
  /// know the org-wide categories were left out).
  departmentScoped: boolean;
}

export async function collectNeedsAction(
  prisma: Db,
  organizationId: string,
  scope: BusinessUnitScope,
  requestedBusinessUnitId?: string,
): Promise<NeedsActionResult> {
  const deptConditions = departmentScopeConditions(scope, requestedBusinessUnitId);
  const departmentScoped = deptConditions.length > 0;
  const now = new Date();

  // Reviews due is the one department-scoped category: it hangs off a record.
  const reviewDue = await prisma.processingActivity.count({
    where: {
      organizationId,
      nextReviewAt: { lt: now },
      ...(deptConditions.length > 0 ? { AND: deptConditions } : {}),
    } as never,
  });

  // The organisation-wide categories are only counted for the whole-organisation
  // view; a department view leaves them out.
  let dsarDue: number | null = null;
  let breachWindow: number | null = null;
  let breachDecision: number | null = null;
  let assessmentApproval: number | null = null;
  if (!departmentScoped) {
    const dueBefore = new Date(now.getTime() + DSAR_DUE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const [dsar, breach, undecided, assessment] = await Promise.all([
      // Not counted when the rights-request module is off.
      isDsarModuleEnabled()
        ? prisma.dSARRequest.count({
            where: {
              organizationId,
              status: { notIn: [...OPEN_DSAR_EXCLUDED] },
              dueDate: { lt: dueBefore },
            },
          })
        : null,
      prisma.incident.count({
        where: {
          organizationId,
          notificationRequired: true,
          status: { notIn: [...CLOSED_INCIDENT] },
        },
      }),
      // Logged inside the 72-hour window with no decision on notifying: not
      // marked as requiring notification (false is also the default for an
      // incident logged with no detail) and no notification recorded.
      prisma.incident.count({
        where: {
          organizationId,
          notificationRequired: false,
          status: { notIn: [...CLOSED_INCIDENT] },
          discoveredAt: { gt: breachWindowOpenSince(now) },
          notifications: { none: {} },
        },
      }),
      prisma.assessment.count({
        where: { organizationId, status: { in: [...PENDING_ASSESSMENT] } },
      }),
    ]);
    dsarDue = dsar;
    breachWindow = breach;
    breachDecision = undecided;
    assessmentApproval = assessment;
  }

  const counts: NeedsActionCounts = {
    reviewDue,
    dsarDue,
    breachWindow,
    breachDecision,
    assessmentApproval,
  };
  const items = buildNeedsAction(counts);
  return { items, total: needsActionTotal(items), departmentScoped };
}

export interface IncompleteRecord {
  id: string;
  name: string;
  businessUnitId: string | null;
  missing: RecordField[];
}

export async function collectIncompleteRecords(
  prisma: Db,
  organizationId: string,
  scope: BusinessUnitScope,
  requestedBusinessUnitId?: string,
): Promise<IncompleteRecord[]> {
  const deptConditions = departmentScopeConditions(scope, requestedBusinessUnitId);
  const records = await prisma.processingActivity.findMany({
    where: {
      organizationId,
      ...(deptConditions.length > 0 ? { AND: deptConditions } : {}),
    } as never,
    orderBy: { updatedAt: "desc" },
    take: INCOMPLETE_LIMIT,
    select: {
      id: true,
      name: true,
      businessUnitId: true,
      dataSubjects: true,
      categories: true,
      recipients: true,
      retentionPeriod: true,
      retentionDays: true,
    },
  });

  const result: IncompleteRecord[] = [];
  for (const r of records) {
    const missing = missingRecordFields({
      dataSubjects: r.dataSubjects,
      categories: r.categories,
      recipients: r.recipients,
      retentionPeriod: r.retentionPeriod,
      retentionDays: r.retentionDays,
    });
    if (missing.length > 0) {
      result.push({ id: r.id, name: r.name, businessUnitId: r.businessUnitId, missing });
    }
  }
  return result;
}
