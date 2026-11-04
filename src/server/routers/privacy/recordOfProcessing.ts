// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The organisation's controller block for the record of processing (GDPR
 * Art. 30(1)(a) and (g), 30(2)(a) and (d)): name and contact details, the
 * data protection officer, the representative in the Union, and the general
 * description of security measures every activity inherits.
 *
 * Every member reads it (it is printed on every record export); privacy
 * officers, admins and owners change it.
 */

import { z } from "zod";
import { createTRPCRouter, organizationProcedure, officerProcedure } from "../../trpc";
import {
  CONTROLLER_FIELDS,
  loadControllerDetails,
  type ControllerField,
} from "@/server/services/export/ropa/record-data";

const short = z.string().max(300).nullable().optional();
const long = z.string().max(5000).nullable().optional();

const LONG_FIELDS: ReadonlySet<ControllerField> = new Set([
  "controllerAddress",
  "dpoContact",
  "euRepresentativeContact",
  "securityMeasures",
]);

const detailsInput = z.object(
  Object.fromEntries(CONTROLLER_FIELDS.map((f) => [f, LONG_FIELDS.has(f) ? long : short])) as Record<
    ControllerField,
    typeof short
  >,
);

export const recordOfProcessingRouter = createTRPCRouter({
  getControllerDetails: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      const { stored, known } = await loadControllerDetails(ctx.prisma, ctx.organization.id);
      return { stored, known };
    }),

  updateControllerDetails: officerProcedure
    .input(z.object({ organizationId: z.string() }).merge(detailsInput))
    .mutation(async ({ ctx, input }) => {
      const data: Partial<Record<ControllerField, string | null>> = {};
      for (const f of CONTROLLER_FIELDS) {
        const v = input[f];
        if (v === undefined) continue;
        data[f] = v === null || v.trim() === "" ? null : v.trim();
      }
      await ctx.prisma.organization.update({ where: { id: ctx.organization.id }, data });
      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "Organization",
          entityId: ctx.organization.id,
          action: "UPDATE",
          changes: { controllerDetails: Object.keys(data) },
        },
      });
      const { stored, known } = await loadControllerDetails(ctx.prisma, ctx.organization.id);
      return { stored, known };
    }),
});
