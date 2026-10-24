// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { z } from "zod";
import { createTRPCRouter, organizationProcedure, writerProcedure } from "../../trpc";
import { TRPCError } from "@trpc/server";
import { dsarDeadlineMonths } from "@/server/services/privacy/slaCalculator";
import { DRAFT_WHERE } from "@/server/services/template-items/drafts";
import { dpaInForceWhere } from "@/lib/vendor-contracts";
import { DSAR_MODULE_OFF_MESSAGE, isDsarModuleEnabled } from "@/config/features";

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

      return {
        jurisdictions: filtered.map((j) => ({
          ...j,
          isApplied: appliedCodes.has(j.code),
        })),
        totalApplied: orgJurisdictions.length,
      };
    }),

  // Get applicability wizard questions
  getApplicabilityQuestions: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async () => {
      const { APPLICABILITY_QUESTIONS } = await import("@/config/jurisdiction-catalog");
      return { questions: APPLICABILITY_QUESTIONS };
    }),

  // Check which jurisdictions apply based on wizard answers
  checkApplicability: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        answers: z.record(z.string(), z.boolean()),
      })
    )
    .query(async ({ input }) => {
      const { APPLICABILITY_QUESTIONS, JURISDICTION_CATALOG, getApplicableJurisdictions } =
        await import("@/config/jurisdiction-catalog");

      const applicable = getApplicableJurisdictions(input.answers);

      return {
        applicableJurisdictions: applicable,
        questionCount: APPLICABILITY_QUESTIONS.length,
        answeredCount: Object.keys(input.answers).length,
      };
    }),

  // The posture applicability check (src/config/applicability.ts): the stored
  // answers plus the jurisdictions the organisation already declares. Read-only.
  getApplicability: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      const { readApplicabilityAnswers } = await import("@/config/applicability");
      const [organization, orgJurisdictions] = await Promise.all([
        ctx.prisma.organization.findUnique({
          where: { id: ctx.organization.id },
          select: { settings: true },
        }),
        ctx.prisma.organizationJurisdiction.findMany({
          where: { organizationId: ctx.organization.id },
          include: { jurisdiction: { select: { code: true } } },
        }),
      ]);
      const settings =
        organization?.settings && typeof organization.settings === "object" && !Array.isArray(organization.settings)
          ? (organization.settings as Record<string, unknown>)
          : {};
      return {
        answers: readApplicabilityAnswers(settings.applicability),
        jurisdictionCodes: orgJurisdictions.map((oj) => oj.jurisdiction.code),
      };
    }),

  // Save the posture answers under Organization.settings.applicability, merged
  // so no other setting is lost. Writer role (never a viewer).
  setApplicability: writerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        answers: z.record(z.string(), z.enum(["YES", "NO", "UNSURE"])),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { readApplicabilityAnswers, APPLICABILITY_VERSION } = await import("@/config/applicability");
      const organization = await ctx.prisma.organization.findUnique({
        where: { id: ctx.organization.id },
        select: { settings: true },
      });
      const settings =
        organization?.settings && typeof organization.settings === "object" && !Array.isArray(organization.settings)
          ? (organization.settings as Record<string, unknown>)
          : {};
      const answers = readApplicabilityAnswers(input.answers);
      await ctx.prisma.organization.update({
        where: { id: ctx.organization.id },
        data: {
          settings: { ...settings, applicability: { ...answers, version: APPLICABILITY_VERSION } },
        },
      });
      return { answers };
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

      const catalogEntry = JURISDICTION_CATALOG.find((j) => j.code === input.jurisdictionCode);
      if (!catalogEntry) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Jurisdiction not found in catalog",
        });
      }

      // A law that only applies with another (Spain's LOPDGDD with the GDPR)
      // brings it along; an existing link is left as it is.
      const { IMPLIED_LAWS } = await import("@/config/jurisdiction-places");
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

  // "Where does your organisation operate?" (the quick start's first step): the organisation's places become exactly the ones
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
      const { isPlaceCode, PLACE_CODES, withImpliedLaws } = await import("@/config/jurisdiction-places");
      // A law that only applies with another (Spain's LOPDGDD with the GDPR)
      // brings it along, so the GDPR cannot be left out while Spain is chosen.
      const codes = withImpliedLaws([...new Set(input.codes)]);
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
      const removed = current.filter(
        (oj) => PLACE_CODES.includes(oj.jurisdiction.code) && !codes.includes(oj.jurisdiction.code)
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
            changes: { added, removed: removed.map((oj) => oj.jurisdiction.code), source: "quickstart" },
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

  // Per-applied-jurisdiction action checklist with computed status.
  // Replaces the "applying jurisdiction does nothing downstream" gap.
  getRequirementsStatus: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      const { getRequirementsForJurisdiction } = await import("@/config/jurisdiction-requirements");
      const { JURISDICTION_CATALOG } = await import("@/config/jurisdiction-catalog");
      const categoryByCode = new Map(JURISDICTION_CATALOG.map((j) => [j.code, j.category]));

      const orgJurisdictions = await ctx.prisma.organizationJurisdiction.findMany({
        where: { organizationId: ctx.organization.id },
        include: { jurisdiction: true },
      });

      if (orgJurisdictions.length === 0) {
        return { jurisdictions: [] };
      }

      // Run all status counts in parallel — single round-trip per dashboard load
      const orgId = ctx.organization.id;
      const [
        activitiesCount,
        draftActivitiesCount,
        approvedDpiaCount,
        inProgressDpiaCount,
        intakeFormCount,
        incidentCount,
        activeVendorCount,
        vendorsWithDpaCount,
        aiSystemCount,
        transferCount,
        transferTiaDoneCount,
      ] = await Promise.all([
        // The record counts once confirmed: active activities a person has confirmed.
        ctx.prisma.processingActivity.count({ where: { organizationId: orgId, isActive: true, NOT: DRAFT_WHERE } }),
        ctx.prisma.processingActivity.count({ where: { organizationId: orgId, isActive: true, ...DRAFT_WHERE } }),
        ctx.prisma.assessment.count({
          where: {
            organizationId: orgId,
            template: { type: "DPIA" },
            status: "APPROVED",
          },
        }),
        ctx.prisma.assessment.count({
          where: {
            organizationId: orgId,
            template: { type: "DPIA" },
            status: { in: ["DRAFT", "IN_PROGRESS", "PENDING_REVIEW", "PENDING_APPROVAL"] },
          },
        }),
        isDsarModuleEnabled()
          ? ctx.prisma.dSARIntakeForm.count({ where: { organizationId: orgId, isActive: true } })
          : 0,
        ctx.prisma.incident.count({ where: { recordedInErrorAt: null, organizationId: orgId } }),
        ctx.prisma.vendor.count({
          where: { organizationId: orgId, status: { in: ["ACTIVE", "UNDER_REVIEW"] }, NOT: DRAFT_WHERE },
        }),
        // A processor contract in force, as the vendor register counts it (src/lib/vendor-contracts.ts).
        ctx.prisma.vendor.count({
          where: {
            organizationId: orgId,
            status: { in: ["ACTIVE", "UNDER_REVIEW"] },
            NOT: DRAFT_WHERE,
            contracts: { some: dpaInForceWhere(new Date()) },
          },
        }),
        ctx.prisma.aISystem.count({ where: { organizationId: orgId } }),
        ctx.prisma.dataTransfer.count({ where: { organizationId: orgId, isActive: true } }),
        ctx.prisma.dataTransfer.count({
          where: { organizationId: orgId, isActive: true, tiaCompleted: true },
        }),
      ]);

      type Status = "satisfied" | "partial" | "missing";
      // `detailKey` names a message under pages.regulations.checklist (the page
      // translates it with `detailValues`); `detail` is the same in English, for
      // any other reader.
      type Detail = { status: Status; detail: string; detailKey: string; detailValues?: Record<string, number> };
      const computeStatus = (id: string): Detail => {
        switch (id) {
          case "ropa":
            if (activitiesCount === 0 && draftActivitiesCount === 0) {
              return { status: "missing", detail: "No active processing activities recorded", detailKey: "detailRopaNone" };
            }
            if (draftActivitiesCount > 0) {
              return {
                status: "partial",
                detail: `${activitiesCount} confirmed, ${draftActivitiesCount} drafted to confirm`,
                detailKey: "detailRopaDrafts",
                detailValues: { confirmed: activitiesCount, drafts: draftActivitiesCount },
              };
            }
            return {
              status: "satisfied",
              detail: `${activitiesCount} active activities`,
              detailKey: "detailRopaCount",
              detailValues: { count: activitiesCount },
            };
          case "dpia":
            if (approvedDpiaCount > 0) {
              return { status: "satisfied", detail: `${approvedDpiaCount} approved`, detailKey: "detailDpiaApproved", detailValues: { count: approvedDpiaCount } };
            }
            if (inProgressDpiaCount > 0) {
              return { status: "partial", detail: `${inProgressDpiaCount} in progress`, detailKey: "detailDpiaInProgress", detailValues: { count: inProgressDpiaCount } };
            }
            return { status: "missing", detail: "No DPIA on file", detailKey: "detailDpiaNone" };
          case "dsar-portal":
            // Without the rights-request module the requirement stays on the
            // list (the law still asks for it) but this tool does not meet it.
            if (!isDsarModuleEnabled()) return { status: "missing", detail: DSAR_MODULE_OFF_MESSAGE, detailKey: "detailDsarOff" };
            return intakeFormCount === 0
              ? { status: "missing", detail: "Public intake form not configured", detailKey: "detailDsarNoForm" }
              : { status: "satisfied", detail: "Public portal active", detailKey: "detailDsarActive" };
          case "incident-response":
            return incidentCount === 0
              ? { status: "missing", detail: "No incident workflow yet", detailKey: "detailIncidentNone" }
              : { status: "satisfied", detail: `${incidentCount} incident records`, detailKey: "detailIncidentCount", detailValues: { count: incidentCount } };
          case "vendor-dpas": {
            if (activeVendorCount === 0) return { status: "missing", detail: "No active vendors recorded", detailKey: "detailVendorNone" };
            const counts = { withDpa: vendorsWithDpaCount, total: activeVendorCount };
            const detail = `${vendorsWithDpaCount}/${activeVendorCount} vendors with a DPA in force`;
            return {
              status: vendorsWithDpaCount === activeVendorCount ? "satisfied" : "partial",
              detail,
              detailKey: "detailVendorCount",
              detailValues: counts,
            };
          }
          case "transfer-tia": {
            if (transferCount === 0) return { status: "satisfied", detail: "No cross-border transfers", detailKey: "detailTransferNone" };
            const counts = { done: transferTiaDoneCount, total: transferCount };
            return {
              status: transferTiaDoneCount === transferCount ? "satisfied" : "partial",
              detail: `${transferTiaDoneCount}/${transferCount} TIAs complete`,
              detailKey: "detailTransferCount",
              detailValues: counts,
            };
          }
          case "ai-system-register":
            return aiSystemCount === 0
              ? { status: "missing", detail: "No AI systems registered", detailKey: "detailAiNone" }
              : { status: "satisfied", detail: `${aiSystemCount} systems registered`, detailKey: "detailAiCount", detailValues: { count: aiSystemCount } };
          default:
            return { status: "missing", detail: "", detailKey: "" };
        }
      };

      return {
        jurisdictions: orgJurisdictions.map((oj) => {
          const reqs = getRequirementsForJurisdiction({
            code: oj.jurisdiction.code,
            category: categoryByCode.get(oj.jurisdiction.code) ?? "comprehensive",
          });
          const items = reqs.map((req) => ({
            ...req,
            ...computeStatus(req.id),
          }));
          const satisfied = items.filter((i) => i.status === "satisfied").length;
          return {
            id: oj.id,
            jurisdictionId: oj.jurisdictionId,
            code: oj.jurisdiction.code,
            name: oj.jurisdiction.name,
            region: oj.jurisdiction.region,
            isPrimary: oj.isPrimary,
            requirements: items,
            satisfiedCount: satisfied,
            totalCount: items.length,
          };
        }),
      };
    }),
});
