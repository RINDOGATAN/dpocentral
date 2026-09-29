// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * What a member limited to one or more departments is shown (the owner's
 * decision of 29 September 2026). Such a member works inside their
 * department, so:
 *  - the department selector shows their department, never "Whole
 *    organisation" (the server narrows to it in any case);
 *  - the quick start, the organisation-wide progress (the path's figures, the
 *    next step, the plan) and the organisation-wide actions (the quick start,
 *    the whole-programme report) are not shown, in the sidebar or on the home.
 *
 * A member with no department limit sees everything, as before. Pure
 * functions, so the rule is tested once (tests/department-limit.test.ts).
 */

/**
 * `myBusinessUnitIds` as `businessUnit.listForScope` returns it: null for the
 * whole organisation, a list (possibly empty) for a limited member. Undefined
 * while it loads, which gives null here: not yet known.
 */
export function isLimitedMember(myBusinessUnitIds: string[] | null | undefined): boolean | null {
  if (myBusinessUnitIds === undefined) return null;
  return myBusinessUnitIds !== null;
}

/** Organisation-wide things are shown only once the member is known not to be limited. */
export function showsOrganisationWide(limited: boolean | null): boolean {
  return limited === false;
}

export interface DepartmentOption {
  id: string;
  name: string;
}

export interface DepartmentSwitchState {
  /** "Whole organisation" is offered: never to a limited member. */
  offerWholeOrganisation: boolean;
  /** The departments offered, in the order given. */
  choices: DepartmentOption[];
  /** The department shown as chosen; null means the whole organisation. */
  value: string | null;
}

/**
 * The selector for this member. An unlimited member keeps "Whole
 * organisation" and any department. A limited member is offered only their
 * own departments, and one of them is always chosen: the stored choice when it
 * is theirs, otherwise the first. Null when there is nothing to offer.
 */
export function departmentSwitchState(params: {
  departments: DepartmentOption[];
  myBusinessUnitIds: string[] | null;
  stored: string | null;
}): DepartmentSwitchState | null {
  const { departments, myBusinessUnitIds: mine, stored } = params;
  if (mine === null) {
    if (departments.length === 0) return null;
    const value = stored && departments.some((d) => d.id === stored) ? stored : null;
    return { offerWholeOrganisation: true, choices: departments, value };
  }
  const choices = departments.filter((d) => mine.includes(d.id));
  if (choices.length === 0) return null;
  const value = stored && choices.some((d) => d.id === stored) ? stored : choices[0].id;
  return { offerWholeOrganisation: false, choices, value };
}
