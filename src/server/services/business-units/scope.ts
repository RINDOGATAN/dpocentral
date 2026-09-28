// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

// Department scope for a member. A member with no department assignment sees the
// whole organisation, exactly as before this feature existed. A member limited
// to one or more departments sees only the records (processing activities) and
// systems (data assets) in those departments.
//
// This never widens what the organisation guard already allows: it is a second
// AND on top of `organizationId: ctx.organization.id`, and it can only narrow.
// The pure part (`businessUnitScopeWhere`) is tested without a database
// (scope.test.ts); the loader is thin plumbing over it.

import type { Db } from "@/lib/prisma";

/// The whole organisation (a member with no department limit), or a fixed set of
/// department ids. An empty id list is still a limit: it matches nothing, which
/// is the honest result for a member limited to departments that were all
/// deleted — never a silent fall-back to the whole organisation.
export type BusinessUnitScope = { all: true } | { all: false; businessUnitIds: string[] };

/// The `businessUnitId` value the "no department assigned" filter uses.
export const UNASSIGNED_DEPARTMENT = "unassigned";

/// The extra condition this scope imposes on a model that carries a
/// `businessUnitId` (DataAsset, ProcessingActivity), or null when it imposes
/// none (a member who sees the whole organisation). A limited member is confined
/// to records whose department is in their set; unassigned records (no
/// department) are not "their" department and so are not shown to a limited
/// member.
export function businessUnitScopeWhere(
  scope: BusinessUnitScope,
): { businessUnitId: { in: string[] } } | null {
  if (scope.all) return null;
  return { businessUnitId: { in: scope.businessUnitIds } };
}

/// The condition for a caller-requested department (the "for my department"
/// switch, or a filter): a single department id, the "unassigned" sentinel, or
/// nothing. Kept separate from the scope so the two AND together.
export function requestedDepartmentWhere(
  requestedBusinessUnitId?: string,
): { businessUnitId: string | null } | null {
  if (!requestedBusinessUnitId) return null;
  return requestedBusinessUnitId === UNASSIGNED_DEPARTMENT
    ? { businessUnitId: null }
    : { businessUnitId: requestedBusinessUnitId };
}

/// The combined AND of the member's scope and an optional requested department,
/// as an array of conditions the caller spreads into its own `where`. Empty when
/// there is no restriction at all (an unlimited member with no department
/// chosen).
export function departmentScopeConditions(
  scope: BusinessUnitScope,
  requestedBusinessUnitId?: string,
): Array<Record<string, unknown>> {
  const conditions: Array<Record<string, unknown>> = [];
  const scoped = businessUnitScopeWhere(scope);
  if (scoped) conditions.push(scoped);
  const requested = requestedDepartmentWhere(requestedBusinessUnitId);
  if (requested) conditions.push(requested);
  return conditions;
}

/// Load the department scope for one organisation member. Returns `{ all: true }`
/// when the member has no department assignment (the default and common case).
export async function loadBusinessUnitScope(
  prisma: Pick<Db, "businessUnitMember">,
  memberId: string,
): Promise<BusinessUnitScope> {
  const rows = await prisma.businessUnitMember.findMany({
    where: { memberId },
    select: { businessUnitId: true },
  });
  if (rows.length === 0) return { all: true };
  return { all: false, businessUnitIds: rows.map((r) => r.businessUnitId) };
}
