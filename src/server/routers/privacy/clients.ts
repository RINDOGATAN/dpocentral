// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { createTRPCRouter, protectedProcedure } from "../../trpc";
import { logger } from "@/lib/logger";
import { DPO_CENTRAL_PATH } from "@/components/guided/path-config";
import { evaluatePath, type PathStatuses } from "@/components/guided/path";
import { loadPathCounts } from "@/server/services/program/path-counts";
import { loadPlanStart } from "@/server/services/program/plan-start";
import { isDsarModuleEnabled } from "@/config/features";

const MAX_CLIENT_ORGS = 50;

/** A request is "due soon" when its deadline is within the next week. */
const DUE_SOON_DAYS = 7;

export const clientsRouter = createTRPCRouter({
  listClients: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    // Get all orgs this user belongs to (capped for safety)
    const memberships = await ctx.prisma.organizationMember.findMany({
      where: { userId },
      include: { organization: true },
      take: MAX_CLIENT_ORGS,
      orderBy: { organization: { name: "asc" } },
    });

    // Fetch stats for each org in parallel, with per-org error isolation
    const clients = await Promise.all(
      memberships.map(async (membership) => {
        const orgId = membership.organizationId;
        const base = {
          organizationId: orgId,
          organizationName: membership.organization.name,
          organizationSlug: membership.organization.slug,
          role: membership.role,
        };

        const now = new Date();
        const dueSoonCutoff = new Date(now.getTime() + DUE_SOON_DAYS * 24 * 60 * 60 * 1000);
        const emptySteps: PathStatuses = {};

        try {
          // The six-stage rings, the next step and the plan all read the same
          // path counts the Guided menu reads, so a client's row in the
          // portfolio can never disagree with its own dashboard.
          // No rights-request counts when the module is off (src/config/features.ts).
          const dsarOn = isDsarModuleEnabled();
          const [
            counts,
            openDsars,
            overdueDsars,
            dueSoonDsars,
            pendingAssessments,
            openIncidents,
            activeVendors,
            lastLog,
          ] = await Promise.all([
            loadPathCounts(ctx.prisma, orgId),
            dsarOn
              ? ctx.prisma.dSARRequest.count({
                  where: {
                    organizationId: orgId,
                    status: { notIn: ["COMPLETED", "REJECTED"] },
                  },
                })
              : 0,
            dsarOn
              ? ctx.prisma.dSARRequest.count({
                  where: {
                    organizationId: orgId,
                    status: { notIn: ["COMPLETED", "REJECTED"] },
                    dueDate: { lt: now },
                  },
                })
              : 0,
            dsarOn
              ? ctx.prisma.dSARRequest.count({
                  where: {
                    organizationId: orgId,
                    status: { notIn: ["COMPLETED", "REJECTED"] },
                    dueDate: { gte: now, lt: dueSoonCutoff },
                  },
                })
              : 0,
            ctx.prisma.assessment.count({
              where: {
                organizationId: orgId,
                status: { in: ["DRAFT", "IN_PROGRESS", "PENDING_REVIEW", "PENDING_APPROVAL"] },
              },
            }),
            ctx.prisma.incident.count({
              where: {
                organizationId: orgId,
                status: { notIn: ["CLOSED", "FALSE_POSITIVE"] },
              },
            }),
            ctx.prisma.vendor.count({
              where: {
                organizationId: orgId,
                status: "ACTIVE",
              },
            }),
            ctx.prisma.auditLog.findFirst({
              where: { organizationId: orgId },
              orderBy: { createdAt: "desc" },
              select: { createdAt: true },
            }),
          ]);

          const steps = evaluatePath(DPO_CENTRAL_PATH, counts);
          const planStart = await loadPlanStart(ctx.prisma, orgId, steps.quickstart === "done");

          return {
            ...base,
            steps,
            planStart: planStart?.toISOString() ?? null,
            openDsars,
            overdueDsars,
            dueSoonDsars,
            pendingAssessments,
            openIncidents,
            activeVendors,
            lastActivity: lastLog?.createdAt ?? null,
            needsAttention: overdueDsars > 0 || dueSoonDsars > 0 || openIncidents > 0,
          };
        } catch (error) {
          logger.error("Failed to fetch stats for org", error, { orgId });
          return {
            ...base,
            steps: emptySteps,
            planStart: null,
            openDsars: 0,
            overdueDsars: 0,
            dueSoonDsars: 0,
            pendingAssessments: 0,
            openIncidents: 0,
            activeVendors: 0,
            lastActivity: null,
            needsAttention: false,
          };
        }
      })
    );

    return clients;
  }),
});
