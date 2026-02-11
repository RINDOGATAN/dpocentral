/**
 * Billing Router
 *
 * Provides subscription status and available plans for the billing page.
 * This router is only meaningful when selfServiceUpgrade is enabled.
 *
 * Proprietary - Requires commercial license
 */

import { z } from "zod";
import { createTRPCRouter, organizationProcedure } from "../trpc";

export const billingRouter = createTRPCRouter({
  getSubscriptionStatus: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      const orgId = ctx.organization.id;

      // Find the customer linked to this organization
      const customerOrg = await ctx.prisma.customerOrganization.findFirst({
        where: { organizationId: orgId },
        include: {
          customer: {
            include: {
              entitlements: {
                where: { status: "ACTIVE" },
                include: { skillPackage: true },
              },
            },
          },
        },
      });

      if (!customerOrg) {
        return {
          hasCustomer: false,
          stripeCustomerId: null,
          entitlements: [],
          plan: "free" as const,
        };
      }

      const customer = customerOrg.customer;
      const entitlements = customer.entitlements.map((e) => ({
        id: e.id,
        skillId: e.skillPackage.skillId,
        skillName: e.skillPackage.displayName,
        licenseType: e.licenseType,
        expiresAt: e.expiresAt,
        stripeSubscriptionId: e.stripeSubscriptionId,
      }));

      // Determine plan name from entitlements
      const hasComplete = entitlements.some((e) =>
        e.skillId.includes("complete")
      );
      const plan = hasComplete
        ? ("complete" as const)
        : entitlements.length > 0
          ? ("premium" as const)
          : ("free" as const);

      return {
        hasCustomer: true,
        stripeCustomerId: customer.stripeCustomerId,
        entitlements,
        plan,
      };
    }),

  getAvailablePlans: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      const orgId = ctx.organization.id;

      // Get all active skill packages
      const packages = await ctx.prisma.skillPackage.findMany({
        where: { isActive: true },
        orderBy: { priceAmount: "asc" },
      });

      // Get current entitlements for this org
      const customerOrg = await ctx.prisma.customerOrganization.findFirst({
        where: { organizationId: orgId },
        include: {
          customer: {
            include: {
              entitlements: {
                where: { status: "ACTIVE" },
                select: { skillPackageId: true },
              },
            },
          },
        },
      });

      const entitledPackageIds = new Set(
        customerOrg?.customer.entitlements.map((e) => e.skillPackageId) ?? []
      );

      return packages.map((pkg) => ({
        id: pkg.id,
        skillId: pkg.skillId,
        name: pkg.displayName,
        description: pkg.description,
        priceAmount: pkg.priceAmount,
        priceCurrency: pkg.priceCurrency,
        stripePriceId: pkg.stripePriceId,
        isEntitled: entitledPackageIds.has(pkg.id),
      }));
    }),
});
