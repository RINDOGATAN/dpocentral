// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Test-only failure probe (see src/lib/failure-probe.ts): with
 * E2E_FAILURE_PROBE=true, failureProbe throws an unexpected error whose text
 * must never reach the browser; otherwise it answers NOT_FOUND.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { failureProbeEnabled, PROBE_FAILURE_TEXT } from "@/lib/failure-probe";

export const diagnosticsRouter = createTRPCRouter({
  failureProbe: publicProcedure.query(() => {
    if (!failureProbeEnabled()) throw new TRPCError({ code: "NOT_FOUND" });
    throw new Error(PROBE_FAILURE_TEXT);
  }),
});
