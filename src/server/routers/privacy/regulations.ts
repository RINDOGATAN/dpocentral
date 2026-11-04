// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { z } from "zod";
import { createTRPCRouter, organizationProcedure, writerProcedure } from "../../trpc";
import { TRPCError } from "@trpc/server";
import { dsarDeadlineMonths } from "@/server/services/privacy/slaCalculator";

export const regulationsRouter = createTRPCRouter({
  // List all available jurisdictions from the catalog
  listAvailable: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        search: z.string().optional(),
        category: z.enum(["comprehensive", "sectoral", "ai_governance", "emerging"]).optional(),
        region: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Fetch the jurisdiction catalog dynamically
      const { JURISDICTION_CATALOG, jurisdictionSearchText } = await import("@/config/jurisdiction-catalog");

      let filtered = [...JURISDICTION_CATALOG];

      if (input.search) {
        // Matches the English and the Spanish names, so "RGPD" or "Brasil" work too.
        const q = input.search.toLowerCase();
        filtered = filtered.filter((j) => jurisdictionSearchText(j).includes(q));
      }

      if (input.category) {
        filtered = filtered.filter((j) => j.category === input.category);
      }

      if (input.region) {
        filtered = filtered.filter((j) => j.region === input.region || j.country === input.region);
      }

      // Check which jurisdictions the org already has
      const orgJurisdictions = await ctx.prisma.organizationJurisdiction.findMany({
        where: { organizationId: ctx.organization.id },
        include: { jurisdiction: true },
      });
      const appliedCodes = new Set(orgJurisdictions.map((oj) => oj.jurisdiction.code));

      // A law no longer offered (src/config/jurisdiction-places.ts,
      // NOT_OFFERED_CODES) is listed only to an organisation that applied it.
      const { isOfferedCode } = await import("@/config/jurisdiction-places");
      filtered = filtered.filter((j) => isOfferedCode(j.code) || appliedCodes.has(j.code));

      return {
        jurisdictions: filtered.map((j) => ({
          ...j,
          isApplied: appliedCodes.has(j.code),
        })),
        totalApplied: orgJurisdictions.length,
      };
    }),

  // Apply a jurisdiction to the organization
  applyJurisdiction: writerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        jurisdictionCode: z.string(),
        isPrimary: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { JURISDICTION_CATALOG } = await import("@/config/jurisdiction-catalog");

      const { IMPLIED_LAWS, isOfferedCode } = await import("@/config/jurisdiction-places");
      const catalogEntry = JURISDICTION_CATALOG.find((j) => j.code === input.jurisdictionCode);
      // A law no longer offered is never applied anew; where it is already
      // applied, it stays as it is.
      if (!catalogEntry || !isOfferedCode(catalogEntry.code)) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Jurisdiction not found in catalog",
        });
      }

      // A law that only applies with another (Spain's LOPDGDD with the GDPR)
      // brings it along; an existing link is left as it is.
      for (const impliedCode of IMPLIED_LAWS[catalogEntry.code] ?? []) {
        const implied = JURISDICTION_CATALOG.find((j) => j.code === impliedCode);
        if (!implied) continue;
        const row = await ctx.prisma.jurisdiction.upsert({
          where: { code: implied.code },
          update: {},
          create: {
            code: implied.code,
            name: implied.name,
            region: implied.region,
            dsarDeadlineDays: implied.dsarDeadlineDays,
            breachNotificationHours: implied.breachNotificationHours,
            requirements: {
              keyRequirements: implied.keyRequirements,
              applicabilityCriteria: implied.applicabilityCriteria,
              penalties: implied.penalties,
            },
          },
        });
        await ctx.prisma.organizationJurisdiction.upsert({
          where: { organizationId_jurisdictionId: { organizationId: ctx.organization.id, jurisdictionId: row.id } },
          update: {},
          create: { organizationId: ctx.organization.id, jurisdictionId: row.id },
        });
      }

      // Upsert the jurisdiction in the DB
      const jurisdiction = await ctx.prisma.jurisdiction.upsert({
        where: { code: input.jurisdictionCode },
        update: {},
        create: {
          code: catalogEntry.code,
          name: catalogEntry.name,
          region: catalogEntry.region,
          dsarDeadlineDays: catalogEntry.dsarDeadlineDays,
          breachNotificationHours: catalogEntry.breachNotificationHours,
          requirements: {
            keyRequirements: catalogEntry.keyRequirements,
            applicabilityCriteria: catalogEntry.applicabilityCriteria,
            penalties: catalogEntry.penalties,
          },
        },
      });

      // Link to organization
      const orgJurisdiction = await ctx.prisma.organizationJurisdiction.upsert({
        where: {
          organizationId_jurisdictionId: {
            organizationId: ctx.organization.id,
            jurisdictionId: jurisdiction.id,
          },
        },
        update: { isPrimary: input.isPrimary },
        create: {
          organizationId: ctx.organization.id,
          jurisdictionId: jurisdiction.id,
          isPrimary: input.isPrimary,
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "OrganizationJurisdiction",
          entityId: orgJurisdiction.id,
          action: "CREATE",
          changes: { jurisdictionCode: input.jurisdictionCode, isPrimary: input.isPrimary },
        },
      });

      return { jurisdiction, orgJurisdiction };
    }),

  // "Where does your organisation operate?" (Settings): the organisation's places become exactly the ones
  // chosen. Only the places the picker offers are touched
  // (src/config/jurisdiction-places.ts): an AI-governance entry declared on the
  // "What applies" page is never removed from here. At least one place: an
  // empty choice means "not sure yet", which the screen does not send.
  setJurisdictions: writerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        codes: z.array(z.string()).min(1).max(60),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { JURISDICTION_CATALOG } = await import("@/config/jurisdiction-catalog");
      const { isOfferedCode, isPlaceCode, PLACE_CODES, withImpliedLaws } = await import("@/config/jurisdiction-places");
      // A law no longer offered (Spain, Andorra) that a page still open from
      // before sends is left out: it is neither added nor removed here.
      const offered = [...new Set(input.codes)].filter(isOfferedCode);
      // Nothing offered left: the same as "not sure yet", nothing changes.
      if (offered.length === 0) return { codes: [] as string[], added: 0, removed: 0 };
      // A law that only applies with another brings it along.
      const codes = withImpliedLaws(offered);
      const unknown = codes.filter((c) => !isPlaceCode(c));
      if (unknown.length > 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Unknown place: ${unknown.join(", ")}` });
      }
      const organizationId = ctx.organization.id;

      const current = await ctx.prisma.organizationJurisdiction.findMany({
        where: { organizationId },
        include: { jurisdiction: { select: { code: true } } },
      });
      const currentCodes = new Set(current.map((oj) => oj.jurisdiction.code));
      const added = codes.filter((c) => !currentCodes.has(c));
      // A stored law that is no longer offered keeps what it brings with it
      // (the GDPR with Spain's LOPDGDD), as removeJurisdiction does.
      const kept = new Set(
        withImpliedLaws([...currentCodes].filter((c) => !isOfferedCode(c)))
      );
      const removed = current.filter(
        (oj) =>
          PLACE_CODES.includes(oj.jurisdiction.code) &&
          !codes.includes(oj.jurisdiction.code) &&
          !kept.has(oj.jurisdiction.code)
      );

      for (const code of added) {
        const entry = JURISDICTION_CATALOG.find((j) => j.code === code)!;
        const jurisdiction = await ctx.prisma.jurisdiction.upsert({
          where: { code },
          update: {},
          create: {
            code: entry.code,
            name: entry.name,
            region: entry.region,
            dsarDeadlineDays: entry.dsarDeadlineDays,
            breachNotificationHours: entry.breachNotificationHours,
            requirements: {
              keyRequirements: entry.keyRequirements,
              applicabilityCriteria: entry.applicabilityCriteria,
              penalties: entry.penalties,
            },
          },
        });
        await ctx.prisma.organizationJurisdiction.upsert({
          where: { organizationId_jurisdictionId: { organizationId, jurisdictionId: jurisdiction.id } },
          update: {},
          create: { organizationId, jurisdictionId: jurisdiction.id },
        });
      }
      if (removed.length > 0) {
        await ctx.prisma.organizationJurisdiction.deleteMany({
          where: { organizationId, id: { in: removed.map((oj) => oj.id) } },
        });
      }
      if (added.length > 0 || removed.length > 0) {
        await ctx.prisma.auditLog.create({
          data: {
            organizationId,
            userId: ctx.session.user.id,
            entityType: "OrganizationJurisdiction",
            entityId: organizationId,
            action: "UPDATE",
            changes: { added, removed: removed.map((oj) => oj.jurisdiction.code), source: "settings" },
          },
        });
      }
      return { codes, added: added.length, removed: removed.length };
    }),

  // Remove a jurisdiction from the organization
  removeJurisdiction: writerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        jurisdictionId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // A law another applied law brings with it (the GDPR with Spain's
      // LOPDGDD) stays while that law is applied, as in the picker.
      const { bringersOf } = await import("@/config/jurisdiction-places");
      const applied = await ctx.prisma.organizationJurisdiction.findMany({
        where: { organizationId: ctx.organization.id },
        include: { jurisdiction: { select: { code: true } } },
      });
      const target = applied.find((oj) => oj.jurisdictionId === input.jurisdictionId);
      if (target) {
        const bringers = bringersOf(target.jurisdiction.code, applied.map((oj) => oj.jurisdiction.code));
        if (bringers.length > 0) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `${target.jurisdiction.code} is included with ${bringers.join(", ")}; remove that first.`,
          });
        }
      }

      await ctx.prisma.organizationJurisdiction.deleteMany({
        where: {
          organizationId: ctx.organization.id,
          jurisdictionId: input.jurisdictionId,
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "OrganizationJurisdiction",
          entityId: input.jurisdictionId,
          action: "DELETE",
        },
      });

      return { success: true };
    }),

  // List applied jurisdictions for the org
  listApplied: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      const orgJurisdictions = await ctx.prisma.organizationJurisdiction.findMany({
        where: { organizationId: ctx.organization.id },
        include: { jurisdiction: true },
        orderBy: { createdAt: "asc" },
      });

      return {
        jurisdictions: orgJurisdictions.map((oj) => ({
          id: oj.id,
          jurisdictionId: oj.jurisdictionId,
          code: oj.jurisdiction.code,
          name: oj.jurisdiction.name,
          region: oj.jurisdiction.region,
          dsarDeadlineDays: oj.jurisdiction.dsarDeadlineDays,
          // Set when the law states the period in calendar months (GDPR: 1)
          dsarDeadlineMonths: dsarDeadlineMonths(oj.jurisdiction.code, oj.jurisdiction.dsarDeadlineDays) ?? undefined,
          breachNotificationHours: oj.jurisdiction.breachNotificationHours,
          isPrimary: oj.isPrimary,
          createdAt: oj.createdAt,
        })),
      };
    }),
});
