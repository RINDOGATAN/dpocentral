"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Where the current organisation stands on the path. One query shared by the
 * menu, the phone bar and the next-step card (the query cache holds a single
 * copy), kept for half a minute so moving between pages does not ask again.
 *
 * `useProgramPathRefresh` (mounted once, by the Guided layout) asks again
 * whenever something may have changed a count: after any successful mutation
 * and on every change of page. Doing it here, once, means no page has to
 * remember to refresh the menu after it saves.
 */

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import type { PathStatuses } from "./path";
import { DPO_CENTRAL_PATH, PLAN_WINDOWS } from "./path-config";
import { planState, type PlanState } from "./plan";

const STALE_MS = 30_000;

export function useProgramPath(): PathStatuses | null {
  return useProgramPathQuery().steps;
}

/**
 * The statuses plus whether a newer answer is on its way, for a caller that
 * must not show the old answer right after a change (the quick start's result).
 */
export function useProgramPathQuery(): {
  steps: PathStatuses | null;
  /** Day 1 of the 30/60/90-day plan (ISO), null before it starts. */
  planStart: string | null;
  refreshing: boolean;
} {
  const { organization } = useOrganization();
  const { data, isFetching } = trpc.programPath.status.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id, staleTime: STALE_MS, refetchOnWindowFocus: false },
  );
  return { steps: data?.steps ?? null, planStart: data?.planStart ?? null, refreshing: isFetching };
}

/** The 30/60/90-day plan's state for the current organisation; null while it loads. */
export function usePlanState(): PlanState | null {
  const { steps, planStart } = useProgramPathQuery();
  if (!steps) return null;
  return planState(DPO_CENTRAL_PATH, PLAN_WINDOWS, steps, planStart, new Date());
}

/**
 * Refresh the path after any successful mutation and on a change of page. Any
 * mutation, not a list: the query is counts only.
 */
export function useProgramPathRefresh(): void {
  const queryClient = useQueryClient();
  const utils = trpc.useUtils();
  const pathname = usePathname();

  // `utils` is a new object on every render; hold the latest in a ref so the
  // subscription below is made once.
  const utilsRef = useRef(utils);
  useEffect(() => {
    utilsRef.current = utils;
  });

  useEffect(() => {
    return queryClient.getMutationCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "success") {
        void utilsRef.current.programPath.invalidate();
      }
    });
  }, [queryClient]);

  const firstPath = useRef(true);
  useEffect(() => {
    if (firstPath.current) {
      firstPath.current = false;
      return;
    }
    void utilsRef.current.programPath.invalidate();
  }, [pathname]);
}
