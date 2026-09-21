// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Ownership checks for ids taken from input (cycle 12, F2).
 *
 * The org middleware proves the caller belongs to the organisation named in
 * the input; it says nothing about the OTHER ids in that input. Every such id
 * is counted against the caller's organisation before it is attached to a row
 * or returned through an `include`. A mismatch reads as "not found", so the
 * reply never confirms that a foreign id exists.
 */

import { TRPCError } from "@trpc/server";

type Counter = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  count: (args: { where: any }) => Promise<number>;
};

function distinct(ids: ReadonlyArray<string | null | undefined>): string[] {
  return [...new Set(ids.filter((id): id is string => typeof id === "string" && id.length > 0))];
}

/**
 * Refuse unless every id is a row of `model` inside `scope` (normally
 * `{ organizationId: ctx.organization.id }`; a child model passes the path to
 * its parent, e.g. `{ dataAsset: { organizationId } }`). Null and undefined
 * ids are ignored, so optional fields can be passed as they are.
 */
export async function assertIdsInOrg(
  model: Counter,
  ids: ReadonlyArray<string | null | undefined>,
  scope: Record<string, unknown>,
  label: string
): Promise<void> {
  const wanted = distinct(ids);
  if (wanted.length === 0) return;
  const found = await model.count({ where: { id: { in: wanted }, ...scope } });
  if (found !== wanted.length) {
    throw new TRPCError({ code: "NOT_FOUND", message: `${label} not found` });
  }
}

/** Refuse unless every user id is a member of the organisation. */
export async function assertUsersAreMembers(
  organizationMember: Counter,
  userIds: ReadonlyArray<string | null | undefined>,
  organizationId: string,
  label = "User"
): Promise<void> {
  const wanted = distinct(userIds);
  if (wanted.length === 0) return;
  const found = await organizationMember.count({
    where: { organizationId, userId: { in: wanted } },
  });
  if (found !== wanted.length) {
    throw new TRPCError({ code: "NOT_FOUND", message: `${label} not found` });
  }
}
