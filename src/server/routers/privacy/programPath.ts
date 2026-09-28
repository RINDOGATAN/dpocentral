// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Program path router: where an organisation stands on the six-stage privacy
 * path the Guided layout shows (src/components/guided/path-config.ts).
 *
 * Read-only. `status` is one organisation, through the usual membership guard.
 * It carries `planStart`, day 1 of the 30/60/90-day plan
 * (src/server/services/program/plan-start.ts); the plan's state is worked out
 * where it is shown, from that date and the statuses (src/components/guided/plan.ts).
 *
 * The client switcher ("All clients") reuses the existing clients router and
 * the /privacy/clients page, so there is no separate portfolio query here.
 */

import { z } from "zod";
import { createTRPCRouter, organizationProcedure } from "../../trpc";
import { DPO_CENTRAL_PATH } from "@/components/guided/path-config";
import { evaluatePath } from "@/components/guided/path";
import { loadPathCounts } from "@/server/services/program/path-counts";
import { loadPlanStart } from "@/server/services/program/plan-start";

export const programPathRouter = createTRPCRouter({
  status: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      const counts = await loadPathCounts(ctx.prisma, ctx.organization.id);
      const steps = evaluatePath(DPO_CENTRAL_PATH, counts);
      const planStart = await loadPlanStart(
        ctx.prisma,
        ctx.organization.id,
        steps.quickstart === "done",
      );
      return { steps, planStart: planStart?.toISOString() ?? null };
    }),
});
