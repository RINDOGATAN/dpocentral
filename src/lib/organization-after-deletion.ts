// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Which organisation to work in once one has been deleted.
 *
 *  - another organisation was deleted, and the open one still exists: keep it;
 *  - the open one was deleted (or none was open): switch to the first
 *    remaining organisation, so no page keeps reading a deleted one;
 *  - nothing remains: none (the app then offers to create one).
 *
 * Pure: no React, no storage. The caller applies the answer
 * (useOrganization's setOrganization, and the saved choice in storage).
 */
export type AfterDeletion<T> = { kind: "keep" } | { kind: "switch"; to: T } | { kind: "none" };

export function organizationAfterDeletion<T extends { id: string }>(
  organizations: readonly T[],
  deletedId: string,
  currentId: string | null | undefined
): AfterDeletion<T> {
  const remaining = organizations.filter((o) => o.id !== deletedId);
  if (currentId && currentId !== deletedId && remaining.some((o) => o.id === currentId)) {
    return { kind: "keep" };
  }
  const next = remaining[0];
  return next ? { kind: "switch", to: next } : { kind: "none" };
}
