"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

// Whether the signed-in member is limited to departments (src/lib/department-limit.ts),
// read once from businessUnit.listForScope, the query the department selector
// already makes (the two share the cache).

import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { isLimitedMember, showsOrganisationWide } from "@/lib/department-limit";

export function useMemberScope() {
  const { organization } = useOrganization();
  const orgId = organization?.id ?? "";
  const { data } = trpc.businessUnit.listForScope.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId },
  );
  const limited = isLimitedMember(data ? data.myBusinessUnitIds : undefined);
  return {
    /** Null while loading. */
    limited,
    /** Organisation-wide progress and actions may be shown. */
    orgWide: showsOrganisationWide(limited),
    departments: data?.departments ?? [],
    myBusinessUnitIds: data?.myBusinessUnitIds ?? null,
  };
}
