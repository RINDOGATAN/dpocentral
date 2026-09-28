// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Business units (departments) within an organisation.
 *
 * The stage-4 directive asks to separate the registers by department and to
 * limit a member to one or more of them. A department is a light structure: a
 * name, an optional parent (one level of nesting), an owning member, and the
 * members limited to it. Processing records and data assets (systems) point at a
 * department; nothing is required to, so an organisation that never creates one
 * is unchanged.
 *
 * Department scope only ever narrows what a member sees, on top of the org guard
 * (see src/server/services/business-units/scope.ts). Managing departments and
 * member limits is an OWNER/ADMIN action (org settings); reading the list, so a
 * person can filter or switch to "my department", is open to any member.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { Db } from "@/lib/prisma";
import { createTRPCRouter, organizationProcedure, adminOrgProcedure } from "../../trpc";
import { loadBusinessUnitScope } from "@/server/services/business-units/scope";

export const businessUnitRouter = createTRPCRouter({
  /**
   * The departments a person can filter or switch by, and which of them this
   * member is limited to (null means the whole organisation). Open to any member
   * so the filter dropdown and the "for my department" switch can be drawn.
   */
  listForScope: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      const [departments, scope] = await Promise.all([
        ctx.prisma.businessUnit.findMany({
          where: { organizationId: ctx.organization.id },
          orderBy: { name: "asc" },
          select: { id: true, name: true, parentId: true },
        }),
        loadBusinessUnitScope(ctx.prisma, ctx.membership.id),
      ]);
      return {
        departments,
        myBusinessUnitIds: scope.all ? null : scope.businessUnitIds,
      };
    }),

  /**
   * Everything the settings card needs: each department with its record and
   * system counts and owner, plus every member with the departments they are
   * limited to. Management roles only — it lists members and their scopes.
   */
  manage: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      assertManage(ctx.membership.role);
      const orgId = ctx.organization.id;

      const [departments, assetCounts, recordCounts, memberRows, members] = await Promise.all([
        ctx.prisma.businessUnit.findMany({
          where: { organizationId: orgId },
          orderBy: { name: "asc" },
          include: {
            owner: { select: { id: true, user: { select: { name: true, email: true } } } },
            _count: { select: { members: true } },
          },
        }),
        ctx.prisma.dataAsset.groupBy({
          by: ["businessUnitId"],
          where: { organizationId: orgId, businessUnitId: { not: null } },
          _count: { _all: true },
        }),
        ctx.prisma.processingActivity.groupBy({
          by: ["businessUnitId"],
          where: { organizationId: orgId, businessUnitId: { not: null } },
          _count: { _all: true },
        }),
        ctx.prisma.businessUnitMember.findMany({
          where: { businessUnit: { organizationId: orgId } },
          select: { businessUnitId: true, memberId: true },
        }),
        ctx.prisma.organizationMember.findMany({
          where: { organizationId: orgId },
          orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
          select: {
            id: true,
            role: true,
            user: { select: { name: true, email: true } },
          },
        }),
      ]);

      const assetCountBy = new Map<string, number>();
      for (const row of assetCounts) {
        if (row.businessUnitId) assetCountBy.set(row.businessUnitId, row._count._all);
      }
      const recordCountBy = new Map<string, number>();
      for (const row of recordCounts) {
        if (row.businessUnitId) recordCountBy.set(row.businessUnitId, row._count._all);
      }
      const scopesByMember = new Map<string, string[]>();
      for (const row of memberRows) {
        const list = scopesByMember.get(row.memberId) ?? [];
        list.push(row.businessUnitId);
        scopesByMember.set(row.memberId, list);
      }

      return {
        departments: departments.map((d) => ({
          id: d.id,
          name: d.name,
          parentId: d.parentId,
          ownerId: d.ownerId,
          ownerName: d.owner?.user.name ?? d.owner?.user.email ?? null,
          recordCount: recordCountBy.get(d.id) ?? 0,
          assetCount: assetCountBy.get(d.id) ?? 0,
          memberCount: d._count.members,
        })),
        members: members.map((m) => ({
          id: m.id,
          role: m.role,
          name: m.user.name,
          email: m.user.email,
          businessUnitIds: scopesByMember.get(m.id) ?? [],
        })),
      };
    }),

  create: adminOrgProcedure
    .input(
      z.object({
        organizationId: z.string(),
        name: z.string().trim().min(1).max(120),
        parentId: z.string().nullable().optional(),
        ownerId: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertParentInOrg(ctx.prisma, ctx.organization.id, input.parentId ?? null, null);
      await assertMemberInOrg(ctx.prisma, ctx.organization.id, input.ownerId ?? null);

      const created = await ctx.prisma.businessUnit.create({
        data: {
          organizationId: ctx.organization.id,
          name: input.name,
          parentId: input.parentId ?? null,
          ownerId: input.ownerId ?? null,
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "BusinessUnit",
          entityId: created.id,
          action: "CREATE",
          changes: { name: input.name, parentId: input.parentId ?? null },
        },
      });

      return created;
    }),

  update: adminOrgProcedure
    .input(
      z.object({
        organizationId: z.string(),
        id: z.string(),
        name: z.string().trim().min(1).max(120).optional(),
        parentId: z.string().nullable().optional(),
        ownerId: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.businessUnit.findFirst({
        where: { id: input.id, organizationId: ctx.organization.id },
        select: { id: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Department not found" });

      if (input.parentId !== undefined) {
        // A department can never be its own parent (a one-level tree, so this is
        // the only cycle possible).
        if (input.parentId === input.id) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "A department cannot be its own parent." });
        }
        await assertParentInOrg(ctx.prisma, ctx.organization.id, input.parentId, input.id);
      }
      if (input.ownerId !== undefined) {
        await assertMemberInOrg(ctx.prisma, ctx.organization.id, input.ownerId);
      }

      const data: Record<string, unknown> = {};
      if (input.name !== undefined) data.name = input.name;
      if (input.parentId !== undefined) data.parentId = input.parentId;
      if (input.ownerId !== undefined) data.ownerId = input.ownerId;

      await ctx.prisma.businessUnit.updateMany({
        where: { id: input.id, organizationId: ctx.organization.id },
        data: data as never,
      });

      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "BusinessUnit",
          entityId: input.id,
          action: "UPDATE",
          changes: data as Record<string, unknown>,
        },
      });

      return { ok: true };
    }),

  remove: adminOrgProcedure
    .input(z.object({ organizationId: z.string(), id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.businessUnit.findFirst({
        where: { id: input.id, organizationId: ctx.organization.id },
        select: { id: true, name: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Department not found" });

      // Records and systems keep their row and lose the department (SetNull);
      // member limits and child links for this department are removed by cascade
      // / SetNull. Nothing about a record is deleted with its department.
      await ctx.prisma.businessUnit.deleteMany({
        where: { id: input.id, organizationId: ctx.organization.id },
      });

      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "BusinessUnit",
          entityId: input.id,
          action: "DELETE",
          changes: { name: existing.name },
        },
      });

      return { deleted: true };
    }),

  /**
   * Set the departments a member is limited to. An empty list clears the limit,
   * returning the member to the whole organisation (the default).
   */
  setMemberDepartments: adminOrgProcedure
    .input(
      z.object({
        organizationId: z.string(),
        memberId: z.string(),
        businessUnitIds: z.array(z.string()).max(50),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.prisma.organizationMember.findFirst({
        where: { id: input.memberId, organizationId: ctx.organization.id },
        select: { id: true },
      });
      if (!member) throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });

      // Every requested department must belong to this organisation, so a limit
      // can never point at another organisation's department.
      const requested = [...new Set(input.businessUnitIds)];
      if (requested.length > 0) {
        const valid = await ctx.prisma.businessUnit.count({
          where: { organizationId: ctx.organization.id, id: { in: requested } },
        });
        if (valid !== requested.length) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown department in the list." });
        }
      }

      await ctx.prisma.$transaction([
        ctx.prisma.businessUnitMember.deleteMany({ where: { memberId: input.memberId } }),
        ...(requested.length > 0
          ? [
              ctx.prisma.businessUnitMember.createMany({
                data: requested.map((businessUnitId) => ({ businessUnitId, memberId: input.memberId })),
                skipDuplicates: true,
              }),
            ]
          : []),
      ]);

      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "OrganizationMember",
          entityId: input.memberId,
          action: "UPDATE",
          changes: { businessUnitIds: requested, scope: "department-limit" },
        },
      });

      return { ok: true };
    }),
});

const MANAGE_ROLES = ["OWNER", "ADMIN"];

/** Reading the manage view (members and their scopes) is a management action. */
function assertManage(role: string) {
  if (!MANAGE_ROLES.includes(role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only owners and admins can manage departments.",
    });
  }
}

/** A parent department must exist in the org and not be a child itself. */
async function assertParentInOrg(
  prisma: Pick<Db, "businessUnit">,
  organizationId: string,
  parentId: string | null,
  selfId: string | null,
) {
  if (!parentId) return;
  const parent = await prisma.businessUnit.findFirst({
    where: { id: parentId, organizationId },
    select: { id: true, parentId: true },
  });
  if (!parent) throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown parent department." });
  // One level of nesting only: the parent must be a top-level department.
  if (parent.parentId && parent.id !== selfId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Departments nest one level only." });
  }
}

/** An owner must be a member of this organisation. */
async function assertMemberInOrg(
  prisma: Pick<Db, "organizationMember">,
  organizationId: string,
  memberId: string | null,
) {
  if (!memberId) return;
  const member = await prisma.organizationMember.findFirst({
    where: { id: memberId, organizationId },
    select: { id: true },
  });
  if (!member) throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown owner." });
}
