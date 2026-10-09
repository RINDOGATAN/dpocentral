"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useOrganization } from "@/lib/organization-context";
import { canHandleDsars } from "@/lib/dsar-access";

/**
 * Whether the signed-in member handles rights requests in the current
 * organisation (src/lib/dsar-access.ts). The role is read from the list of the
 * member's organisations, which carries it, not from the selected one (some
 * screens select an organisation with only its id, name and slug).
 *
 * `canHandle` is null while the list loads, so a menu never flickers in and
 * out; the server enforces the rule either way.
 */
export function useDsarAccess(): { canHandle: boolean | null } {
  const { organization, organizations, isLoading } = useOrganization();
  if (!organization) return { canHandle: isLoading ? null : false };
  const role = (organizations.find((o) => o.id === organization.id) as { role?: string } | undefined)?.role;
  if (role === undefined) return { canHandle: isLoading ? null : false };
  return { canHandle: canHandleDsars(role) };
}
