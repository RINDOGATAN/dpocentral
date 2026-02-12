/**
 * Billing Router
 *
 * Provides subscription status and available plans for the billing page.
 * This router is only meaningful when selfServiceUpgrade is enabled.
 *
 * Proprietary - Requires commercial license
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, organizationProcedure } from "../trpc";
import { removeSubscriptionItem } from "@/lib/stripe";

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

  cancelFeature: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        entitlementId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.organization.id;

      // Find the customer for this org
      const customerOrg = await ctx.prisma.customerOrganization.findFirst({
        where: { organizationId: orgId },
        include: { customer: true },
      });

      if (!customerOrg) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No billing customer found for this organization",
        });
      }

      // Find the entitlement and verify it belongs to this customer
      const entitlement = await ctx.prisma.skillEntitlement.findFirst({
        where: {
          id: input.entitlementId,
          customerId: customerOrg.customer.id,
          status: "ACTIVE",
        },
        include: { skillPackage: true },
      });

      if (!entitlement) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Entitlement not found or already inactive",
        });
      }

      if (!entitlement.stripeSubscriptionId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This entitlement was not purchased via Stripe and cannot be self-cancelled",
        });
      }

      if (!entitlement.skillPackage.stripePriceId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Skill package has no Stripe price configured",
        });
      }

      // Remove the item from the Stripe subscription
      const result = await removeSubscriptionItem(
        entitlement.stripeSubscriptionId,
        entitlement.skillPackage.stripePriceId
      );

      // Mark this entitlement as expired
      await ctx.prisma.skillEntitlement.update({
        where: { id: entitlement.id },
        data: { status: "EXPIRED" },
      });

      // If the whole subscription was cancelled, also expire any other
      // entitlements sharing that subscription (safety net — webhook will also do this)
      if (result.cancelled) {
        await ctx.prisma.skillEntitlement.updateMany({
          where: {
            stripeSubscriptionId: entitlement.stripeSubscriptionId,
            status: "ACTIVE",
            id: { not: entitlement.id },
          },
          data: { status: "EXPIRED" },
        });
      }

      return { cancelled: result.cancelled };
    }),
});
