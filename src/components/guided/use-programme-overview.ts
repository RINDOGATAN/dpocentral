"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The programme overview for the current organisation: every document of the
 * register with its state, what needs action and the deadlines at risk
 * (programPath.overview). One query shared by the Guided menu (its document
 * lines and state words) and the dashboard (the documents panel, the area
 * tiles, the next actions), so both show the same answer.
 *
 * It sits under `programPath`, so the refresh the Guided layout already runs
 * after every change (useProgramPathRefresh) refreshes it too.
 */

import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import type { EvaluatedDocument } from "@/config/document-register";
import type { NeedsActionItem } from "@/lib/needs-action";

const STALE_MS = 30_000;

export interface ProgrammeOverview {
  documents: EvaluatedDocument[];
  needsAction: NeedsActionItem[];
  deadlines: { kind: "breachDecision" | "breachNotify" | "dsarDue"; at: string; publicId: string; href: string }[];
}

/** Null while loading, and for a member limited to departments. */
export function useProgrammeOverview(): { overview: ProgrammeOverview | null; refreshing: boolean } {
  const { organization } = useOrganization();
  const { data, isFetching } = trpc.programPath.overview.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id, staleTime: STALE_MS, refetchOnWindowFocus: false },
  );
  if (!data || data.limited) return { overview: null, refreshing: isFetching };
  return {
    overview: { documents: data.documents, needsAction: data.needsAction, deadlines: data.deadlines },
    refreshing: isFetching,
  };
}
