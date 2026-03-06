import { createTRPCRouter, protectedProcedure } from "../../trpc";

const MAX_CLIENT_ORGS = 50;

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

        try {
          const [
            openDsars,
            overdueDsars,
            pendingAssessments,
            openIncidents,
            activeVendors,
            lastLog,
          ] = await Promise.all([
            ctx.prisma.dSARRequest.count({
              where: {
                organizationId: orgId,
                status: { notIn: ["COMPLETED", "REJECTED"] },
              },
            }),
            ctx.prisma.dSARRequest.count({
              where: {
                organizationId: orgId,
                status: { notIn: ["COMPLETED", "REJECTED"] },
                dueDate: { lt: new Date() },
              },
            }),
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

          return {
            ...base,
            openDsars,
            overdueDsars,
            pendingAssessments,
            openIncidents,
            activeVendors,
            lastActivity: lastLog?.createdAt ?? null,
            needsAttention: overdueDsars > 0 || openIncidents > 0,
          };
        } catch (error) {
          console.error(`Failed to fetch stats for org ${orgId}:`, error);
          return {
            ...base,
            openDsars: 0,
            overdueDsars: 0,
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
