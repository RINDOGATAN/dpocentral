import { z } from "zod";
import { createTRPCRouter, organizationProcedure, writerProcedure } from "../../trpc";
import { TRPCError } from "@trpc/server";

// Helper to compute compliance score from all modules
async function computeComplianceScore(
  prisma: any,
  organizationId: string
) {
  const now = new Date();
  const twelveMonthsAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

  const [
    // ROPA completeness
    totalAssets,
    assetsWithActivities,
    // Assessment completion
    totalAssessments,
    approvedAssessments,
    // DSAR SLA compliance
    totalDsars,
    overdueDsars,
    // Incident response
    incidentsRequiringNotification,
    incidentsWithDeadlineMet,
    // Vendor review coverage
    activeVendors,
    vendorsReviewedRecently,
    // Risk indicator data
    overdueDsarCount,
    highRiskVendorsWithoutAssessment,
    criticalOpenIncidents,
    draftAssessments,
    contractsExpiringSoon,
  ] = await Promise.all([
    // ROPA: total assets
    prisma.dataAsset.count({
      where: { organizationId },
    }),
    // ROPA: assets with at least one processing activity linked
    prisma.dataAsset.count({
      where: {
        organizationId,
        processingActivityAssets: { some: {} },
      },
    }),
    // Assessment: total
    prisma.assessment.count({
      where: { organizationId },
    }),
    // Assessment: approved
    prisma.assessment.count({
      where: { organizationId, status: "APPROVED" },
    }),
    // DSAR: total (excluding cancelled)
    prisma.dSARRequest.count({
      where: {
        organizationId,
        status: { notIn: ["CANCELLED"] },
      },
    }),
    // DSAR: overdue (not completed and past due date)
    prisma.dSARRequest.count({
      where: {
        organizationId,
        dueDate: { lt: now },
        status: { notIn: ["COMPLETED", "REJECTED", "CANCELLED"] },
      },
    }),
    // Incident: requiring notification
    prisma.incident.count({
      where: {
        organizationId,
        notificationRequired: true,
      },
    }),
    // Incident: notification deadline met (notified before deadline or closed)
    prisma.incident.count({
      where: {
        organizationId,
        notificationRequired: true,
        OR: [
          { status: "CLOSED" },
          {
            notifications: {
              some: {
                status: { in: ["SENT", "ACKNOWLEDGED"] },
              },
            },
          },
        ],
      },
    }),
    // Vendor: active vendors
    prisma.vendor.count({
      where: { organizationId, status: "ACTIVE" },
    }),
    // Vendor: assessed in last 12 months
    prisma.vendor.count({
      where: {
        organizationId,
        status: "ACTIVE",
        lastAssessedAt: { gte: twelveMonthsAgo },
      },
    }),
    // Risk indicators
    prisma.dSARRequest.count({
      where: {
        organizationId,
        dueDate: { lt: now },
        status: { notIn: ["COMPLETED", "REJECTED", "CANCELLED"] },
      },
    }),
    prisma.vendor.count({
      where: {
        organizationId,
        status: "ACTIVE",
        riskTier: { in: ["HIGH", "CRITICAL"] },
        lastAssessedAt: null,
      },
    }),
    prisma.incident.count({
      where: {
        organizationId,
        severity: { in: ["HIGH", "CRITICAL"] },
        status: { notIn: ["CLOSED", "FALSE_POSITIVE"] },
      },
    }),
    prisma.assessment.count({
      where: {
        organizationId,
        status: "DRAFT",
      },
    }),
    prisma.vendorContract.count({
      where: {
        vendor: { organizationId },
        status: "ACTIVE",
        endDate: {
          gte: now,
          lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        },
      },
    }),
  ]);

  // Calculate individual scores (0-100)
  const ropaScore = totalAssets > 0
    ? Math.round((assetsWithActivities / totalAssets) * 100)
    : 100; // No assets = fully compliant (nothing to track)

  const assessmentScore = totalAssessments > 0
    ? Math.round((approvedAssessments / totalAssessments) * 100)
    : 100;

  const dsarCompliant = totalDsars > 0
    ? totalDsars - overdueDsars
    : 0;
  const dsarScore = totalDsars > 0
    ? Math.round((dsarCompliant / totalDsars) * 100)
    : 100;

  const incidentScore = incidentsRequiringNotification > 0
    ? Math.round((incidentsWithDeadlineMet / incidentsRequiringNotification) * 100)
    : 100;

  const vendorScore = activeVendors > 0
    ? Math.round((vendorsReviewedRecently / activeVendors) * 100)
    : 100;

  // Weighted formula: ROPA 25%, Assessment 20%, DSAR 25%, Incident 15%, Vendor 15%
  const score = Math.round(
    ropaScore * 0.25 +
    assessmentScore * 0.20 +
    dsarScore * 0.25 +
    incidentScore * 0.15 +
    vendorScore * 0.15
  );

  // Build risk indicators
  const riskIndicators: string[] = [];
  if (overdueDsarCount > 0) {
    riskIndicators.push(`${overdueDsarCount} overdue DSAR${overdueDsarCount > 1 ? "s" : ""}`);
  }
  if (highRiskVendorsWithoutAssessment > 0) {
    riskIndicators.push(`${highRiskVendorsWithoutAssessment} high-risk vendor${highRiskVendorsWithoutAssessment > 1 ? "s" : ""} without assessment`);
  }
  if (criticalOpenIncidents > 0) {
    riskIndicators.push(`${criticalOpenIncidents} open critical/high incident${criticalOpenIncidents > 1 ? "s" : ""}`);
  }
  if (draftAssessments > 0) {
    riskIndicators.push(`${draftAssessments} assessment${draftAssessments > 1 ? "s" : ""} still in draft`);
  }
  if (contractsExpiringSoon > 0) {
    riskIndicators.push(`${contractsExpiringSoon} vendor contract${contractsExpiringSoon > 1 ? "s" : ""} expiring within 30 days`);
  }
  if (totalAssets > 0 && assetsWithActivities < totalAssets) {
    const unlinked = totalAssets - assetsWithActivities;
    riskIndicators.push(`${unlinked} data asset${unlinked > 1 ? "s" : ""} not linked to processing activities`);
  }

  return {
    score,
    breakdown: {
      ropa: { score: ropaScore, total: totalAssets, compliant: assetsWithActivities },
      assessment: { score: assessmentScore, total: totalAssessments, compliant: approvedAssessments },
      dsar: { score: dsarScore, total: totalDsars, compliant: dsarCompliant },
      incident: { score: incidentScore, total: incidentsRequiringNotification, compliant: incidentsWithDeadlineMet },
      vendor: { score: vendorScore, total: activeVendors, compliant: vendorsReviewedRecently },
    },
    riskIndicators,
  };
}

export const reportsRouter = createTRPCRouter({
  // ============================================================
  // COMPLIANCE SCORE
  // ============================================================

  getComplianceScore: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      return computeComplianceScore(ctx.prisma, ctx.organization.id);
    }),

  // ============================================================
  // COMPLIANCE TREND
  // ============================================================

  getComplianceTrend: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        months: z.number().min(1).max(24).default(6),
      })
    )
    .query(async ({ ctx, input }) => {
      const snapshots = await ctx.prisma.complianceSnapshot.findMany({
        where: { organizationId: ctx.organization.id },
        orderBy: { month: "asc" },
        take: input.months,
      });

      return snapshots;
    }),

  // ============================================================
  // CREATE SNAPSHOT
  // ============================================================

  createSnapshot: writerProcedure
    .input(z.object({ organizationId: z.string() }))
    .mutation(async ({ ctx }) => {
      const complianceData = await computeComplianceScore(ctx.prisma, ctx.organization.id);

      // First day of current month
      const now = new Date();
      const month = new Date(now.getFullYear(), now.getMonth(), 1);

      const snapshot = await ctx.prisma.complianceSnapshot.upsert({
        where: {
          organizationId_month: {
            organizationId: ctx.organization.id,
            month,
          },
        },
        update: {
          score: complianceData.score,
          metrics: complianceData.breakdown,
        },
        create: {
          organizationId: ctx.organization.id,
          month,
          score: complianceData.score,
          metrics: complianceData.breakdown,
        },
      });

      return snapshot;
    }),

  // ============================================================
  // MODULE STATS
  // ============================================================

  getModuleStats: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const orgId = ctx.organization.id;

      const [
        // Data Inventory
        assetCount,
        elementCount,
        activityCount,
        flowCount,
        transferCount,
        // DSAR
        dsarTotal,
        dsarOpen,
        dsarOverdue,
        dsarCompletedThisMonth,
        dsarCompleted,
        // Assessment
        assessmentTotal,
        assessmentDraft,
        assessmentInProgress,
        assessmentApproved,
        assessmentHighRisk,
        // Incident
        incidentTotal,
        incidentOpen,
        incidentCritical,
        incidentResolved,
        // Vendor
        vendorTotal,
        vendorActive,
        vendorHighRisk,
        vendorWithoutReview,
        contractsExpiringSoon,
      ] = await Promise.all([
        // Data Inventory
        ctx.prisma.dataAsset.count({ where: { organizationId: orgId } }),
        ctx.prisma.dataElement.count({ where: { organizationId: orgId } }),
        ctx.prisma.processingActivity.count({ where: { organizationId: orgId } }),
        ctx.prisma.dataFlow.count({ where: { organizationId: orgId } }),
        ctx.prisma.dataTransfer.count({ where: { organizationId: orgId } }),
        // DSAR
        ctx.prisma.dSARRequest.count({ where: { organizationId: orgId } }),
        ctx.prisma.dSARRequest.count({
          where: {
            organizationId: orgId,
            status: { notIn: ["COMPLETED", "REJECTED", "CANCELLED"] },
          },
        }),
        ctx.prisma.dSARRequest.count({
          where: {
            organizationId: orgId,
            dueDate: { lt: now },
            status: { notIn: ["COMPLETED", "REJECTED", "CANCELLED"] },
          },
        }),
        ctx.prisma.dSARRequest.count({
          where: {
            organizationId: orgId,
            status: "COMPLETED",
            completedAt: { gte: thirtyDaysAgo },
          },
        }),
        ctx.prisma.dSARRequest.findMany({
          where: {
            organizationId: orgId,
            status: "COMPLETED",
            completedAt: { not: null },
          },
          select: { receivedAt: true, completedAt: true },
        }),
        // Assessment
        ctx.prisma.assessment.count({ where: { organizationId: orgId } }),
        ctx.prisma.assessment.count({ where: { organizationId: orgId, status: "DRAFT" } }),
        ctx.prisma.assessment.count({ where: { organizationId: orgId, status: "IN_PROGRESS" } }),
        ctx.prisma.assessment.count({ where: { organizationId: orgId, status: "APPROVED" } }),
        ctx.prisma.assessment.count({
          where: { organizationId: orgId, riskLevel: { in: ["HIGH", "CRITICAL"] } },
        }),
        // Incident
        ctx.prisma.incident.count({ where: { organizationId: orgId } }),
        ctx.prisma.incident.count({
          where: {
            organizationId: orgId,
            status: { notIn: ["CLOSED", "FALSE_POSITIVE"] },
          },
        }),
        ctx.prisma.incident.count({
          where: {
            organizationId: orgId,
            severity: { in: ["HIGH", "CRITICAL"] },
            status: { notIn: ["CLOSED", "FALSE_POSITIVE"] },
          },
        }),
        ctx.prisma.incident.findMany({
          where: {
            organizationId: orgId,
            status: "CLOSED",
            resolvedAt: { not: null },
          },
          select: { discoveredAt: true, resolvedAt: true },
        }),
        // Vendor
        ctx.prisma.vendor.count({ where: { organizationId: orgId } }),
        ctx.prisma.vendor.count({ where: { organizationId: orgId, status: "ACTIVE" } }),
        ctx.prisma.vendor.count({
          where: { organizationId: orgId, riskTier: { in: ["HIGH", "CRITICAL"] } },
        }),
        ctx.prisma.vendor.count({
          where: {
            organizationId: orgId,
            status: "ACTIVE",
            OR: [
              { lastAssessedAt: null },
              { lastAssessedAt: { lt: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000) } },
            ],
          },
        }),
        ctx.prisma.vendorContract.count({
          where: {
            vendor: { organizationId: orgId },
            status: "ACTIVE",
            endDate: {
              gte: now,
              lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
            },
          },
        }),
      ]);

      // Calculate avg resolution days for DSAR
      let dsarAvgResolutionDays = 0;
      if (dsarCompleted.length > 0) {
        const totalDays = dsarCompleted.reduce((sum, req) => {
          if (req.completedAt) {
            return sum + (req.completedAt.getTime() - req.receivedAt.getTime()) / (1000 * 60 * 60 * 24);
          }
          return sum;
        }, 0);
        dsarAvgResolutionDays = Math.round(totalDays / dsarCompleted.length);
      }

      // Calculate avg resolution days for Incidents
      let incidentAvgResolutionDays = 0;
      if (incidentResolved.length > 0) {
        const totalDays = incidentResolved.reduce((sum, inc) => {
          if (inc.resolvedAt) {
            return sum + (inc.resolvedAt.getTime() - inc.discoveredAt.getTime()) / (1000 * 60 * 60 * 24);
          }
          return sum;
        }, 0);
        incidentAvgResolutionDays = Math.round(totalDays / incidentResolved.length);
      }

      return {
        dataInventory: {
          assets: assetCount,
          elements: elementCount,
          activities: activityCount,
          flows: flowCount,
          transfers: transferCount,
        },
        dsar: {
          total: dsarTotal,
          open: dsarOpen,
          overdue: dsarOverdue,
          completedThisMonth: dsarCompletedThisMonth,
          avgResolutionDays: dsarAvgResolutionDays,
        },
        assessment: {
          total: assessmentTotal,
          draft: assessmentDraft,
          inProgress: assessmentInProgress,
          approved: assessmentApproved,
          highRisk: assessmentHighRisk,
        },
        incident: {
          total: incidentTotal,
          open: incidentOpen,
          critical: incidentCritical,
          avgResolutionDays: incidentAvgResolutionDays,
        },
        vendor: {
          total: vendorTotal,
          active: vendorActive,
          highRisk: vendorHighRisk,
          withoutReview: vendorWithoutReview,
          contractsExpiringSoon,
        },
      };
    }),

  // ============================================================
  // BOARD REPORT DATA
  // ============================================================

  getBoardReportData: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      const orgId = ctx.organization.id;

      const [complianceScore, moduleStats, trend, recentActivities] = await Promise.all([
        computeComplianceScore(ctx.prisma, orgId),
        // Inline module stats query for board report (reuses same logic)
        ctx.prisma.assessment.findMany({
          where: { organizationId: orgId, riskLevel: { in: ["HIGH", "CRITICAL"] } },
          select: { id: true, name: true, riskLevel: true, riskScore: true, status: true },
          orderBy: { riskScore: "desc" },
          take: 5,
        }),
        ctx.prisma.complianceSnapshot.findMany({
          where: { organizationId: orgId },
          orderBy: { month: "asc" },
          take: 12,
        }),
        ctx.prisma.auditLog.findMany({
          where: { organizationId: orgId },
          orderBy: { createdAt: "desc" },
          take: 20,
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        }),
      ]);

      return {
        complianceScore,
        topRisks: moduleStats,
        trend,
        recentActivities,
        generatedAt: new Date().toISOString(),
      };
    }),
});
