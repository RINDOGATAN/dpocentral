// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Skills router: premium skill packages and offline licence activation.
 *
 * The licence file (Ed25519-signed JSON from the TODO.LAW storefront) is sent
 * as a parsed object in the mutation body — no upload endpoint. Activation is
 * restricted to OWNER/ADMIN: it changes the organization's entitlements.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  organizationProcedure,
  adminOrgProcedure,
} from "../trpc";
import {
  activateOffline,
  deactivateForOrg,
} from "../services/licensing/activation";
import { getMachineInfo } from "../services/licensing/fingerprint";
import type { LicenseFile } from "@/lib/license-crypto";

// Mirrors the LicenseFile interface (and Dealroom's schema) exactly.
const LicenseFileSchema = z.object({
  licenseKey: z.string(),
  customerId: z.string(),
  customerName: z.string(),
  skillId: z.string(),
  jurisdictions: z.array(z.string()),
  licenseType: z.enum(["TRIAL", "SUBSCRIPTION", "PERPETUAL"]),
  maxActivations: z.number().int().positive(),
  issuedAt: z.string(),
  expiresAt: z.string().optional(),
  signature: z.string(),
});

export const skillsRouter = createTRPCRouter({
  /**
   * All active skill packages with the organization's entitlement status.
   */
  list: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      const packages = await ctx.prisma.skillPackage.findMany({
        where: { isActive: true },
        orderBy: { displayName: "asc" },
      });

      const customerOrg = await ctx.prisma.customerOrganization.findFirst({
        where: { organizationId: ctx.organization.id },
        include: {
          customer: {
            include: { entitlements: { include: { activations: true } } },
          },
        },
      });

      const { instanceId } = getMachineInfo();
      const now = new Date();
      const entitlementsByPackage = new Map(
        (customerOrg?.customer.entitlements ?? []).map((e) => [
          e.skillPackageId,
          e,
        ])
      );

      return packages.map((pkg) => {
        const ent = entitlementsByPackage.get(pkg.id);
        const isActive =
          !!ent &&
          ent.status === "ACTIVE" &&
          (!ent.expiresAt || ent.expiresAt >= now);
        return {
          id: pkg.id,
          skillId: pkg.skillId,
          name: pkg.name,
          displayName: pkg.displayName,
          description: pkg.description,
          assessmentType: pkg.assessmentType,
          priceAmount: pkg.priceAmount,
          priceCurrency: pkg.priceCurrency,
          entitlement: ent
            ? {
                id: ent.id,
                status: ent.status,
                isActive,
                licenseType: ent.licenseType,
                expiresAt: ent.expiresAt,
                maxActivations: ent.maxActivations,
                activations: ent.activations.map((a) => ({
                  id: a.id,
                  instanceId: a.instanceId,
                  activatedAt: a.activatedAt,
                  isThisInstance: a.instanceId === instanceId,
                })),
              }
            : null,
        };
      });
    }),

  /**
   * Activate a premium skill from an offline licence file (OWNER/ADMIN).
   */
  activateOffline: adminOrgProcedure
    .input(
      z.object({
        organizationId: z.string(),
        licenseFile: LicenseFileSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const email = ctx.session.user.email;
      if (!email) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Your account has no email address",
        });
      }

      const result = await activateOffline(
        input.licenseFile as LicenseFile,
        { email, name: ctx.session.user.name },
        ctx.organization.id
      );

      if (!result.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.error || "Activation failed",
        });
      }

      return {
        success: true,
        activationId: result.activationId,
        skillId: result.skillId,
        skillName: result.skillName,
        expiresAt: result.expiresAt,
      };
    }),

  /**
   * Remove an activation, freeing a slot on the licence (OWNER/ADMIN).
   */
  deactivate: adminOrgProcedure
    .input(
      z.object({
        organizationId: z.string(),
        activationId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await deactivateForOrg(
        input.activationId,
        ctx.organization.id
      );

      if (!result.success) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: result.error || "Activation not found",
        });
      }

      return { success: true };
    }),
});
