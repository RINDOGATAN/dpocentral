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
import { draftTotal, loadPathCounts } from "@/server/services/program/path-counts";
import { loadPlanStart } from "@/server/services/program/plan-start";
import { loadDocumentFacts } from "@/server/services/program/document-facts";
import { loadDeadlines } from "@/server/services/program/deadlines";
import { evaluateRegister, registerFor } from "@/config/document-register";
import { isDsarModuleEnabled } from "@/config/features";
import { loadBusinessUnitScope } from "@/server/services/business-units/scope";
import { collectNeedsAction } from "@/server/services/views/queries";

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
      return {
        steps,
        planStart: planStart?.toISOString() ?? null,
        // Records drafted for this organisation and not yet confirmed: what
        // "Review and confirm" holds (services/template-items/drafts.ts).
        drafts: draftTotal(counts),
      };
    }),

  /**
   * The dashboard's programme overview, and the menu's document lines
   * (owner's decisions d4 to d7, 9 October 2026): every document in the
   * register with its state, what needs action, and the deadlines at risk.
   * One query for both, so the panel and the menu read the same answer.
   *
   * Organisation-wide figures: a member limited to departments gets nothing
   * but `limited: true` (src/lib/department-limit.ts), as the menu and the
   * dashboard show such a member no organisation-wide progress.
   */
  overview: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      const scope = await loadBusinessUnitScope(ctx.prisma, ctx.membership.id);
      if (!scope.all) {
        return { limited: true as const, documents: [], needsAction: [], deadlines: [] };
      }
      const [facts, needsAction, deadlines] = await Promise.all([
        loadDocumentFacts(ctx.prisma, ctx.organization.id),
        collectNeedsAction(ctx.prisma, ctx.organization.id, scope),
        loadDeadlines(ctx.prisma, ctx.organization.id, {
          role: ctx.membership.role,
          userId: ctx.session.user.id,
        }),
      ]);
      return {
        limited: false as const,
        documents: evaluateRegister(registerFor({ dsarEnabled: isDsarModuleEnabled() }), facts),
        needsAction: needsAction.items,
        deadlines,
      };
    }),
});
