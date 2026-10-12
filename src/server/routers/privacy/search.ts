// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * One search box across the programme, over record NAMES only: systems,
 * processing activities, vendors, assessments, incidents and rights requests.
 * Never descriptions, answers or notes.
 *
 * Scope, enforced here and not only on the screen:
 * - the organisation: every query carries `organizationId` of the caller's
 *   membership (organizationProcedure);
 * - departments: a member limited to departments finds only the systems and
 *   activities of those departments, as the inventory lists do
 *   (services/business-units/scope.ts);
 * - rights requests: searched only where the module is part of this
 *   deployment, and only those the caller may open (officers, admins and
 *   owners every request; anyone else the requests on which they hold a task,
 *   src/server/services/dsar/access.ts). A request is found by its reference
 *   or the requester's name, which is what the requests list shows.
 */

import { z } from "zod";
import { createTRPCRouter, organizationProcedure } from "../../trpc";
import { isDsarModuleEnabled } from "@/config/features";
import { dsarReadFilter } from "@/server/services/dsar/access";
import {
  departmentScopeConditions,
  loadBusinessUnitScope,
} from "@/server/services/business-units/scope";

/** Most results per kind of record. */
export const SEARCH_PER_KIND = 5;

export type SearchKind = "system" | "activity" | "vendor" | "assessment" | "incident" | "request";

/**
 * The part of a typed reference to match against a public id: the label a
 * person reads is "INC-", "REQ-" or "SOL-" and the last six characters of
 * the id (src/lib/incident-ref.ts, src/lib/request-ref.ts).
 */
export function referenceTerm(q: string): string {
  return q.trim().replace(/^(inc|req|sol)-/i, "");
}

export interface SearchHit {
  kind: SearchKind;
  id: string;
  name: string;
  /** The incident's or request's public reference, when it has one. */
  publicId?: string;
  href: string;
}

export const searchRouter = createTRPCRouter({
  names: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        q: z.string().trim().min(2).max(100),
      })
    )
    .query(async ({ ctx, input }): Promise<SearchHit[]> => {
      const org = { organizationId: ctx.organization.id };
      const name = { contains: input.q, mode: "insensitive" as const };
      const take = SEARCH_PER_KIND;
      const order = { name: "asc" as const };
      const ref = { contains: referenceTerm(input.q), mode: "insensitive" as const };

      const scope = await loadBusinessUnitScope(ctx.prisma, ctx.membership.id);
      const dept = departmentScopeConditions(scope);
      const deptWhere = dept.length > 0 ? { AND: dept as never } : {};

      const dsarOn = isDsarModuleEnabled();

      const [systems, activities, vendors, assessments, incidents, requests] = await Promise.all([
        ctx.prisma.dataAsset.findMany({
          where: { ...org, ...deptWhere, name },
          select: { id: true, name: true },
          orderBy: order,
          take,
        }),
        ctx.prisma.processingActivity.findMany({
          where: { ...org, ...deptWhere, name },
          select: { id: true, name: true },
          orderBy: order,
          take,
        }),
        ctx.prisma.vendor.findMany({
          where: { ...org, name },
          select: { id: true, name: true },
          orderBy: order,
          take,
        }),
        ctx.prisma.assessment.findMany({
          where: { ...org, name },
          select: { id: true, name: true },
          orderBy: order,
          take,
        }),
        ctx.prisma.incident.findMany({
          where: {
            ...org,
            OR: [{ title: name }, { publicId: ref }],
          },
          select: { id: true, title: true, publicId: true },
          orderBy: { createdAt: "desc" },
          take,
        }),
        dsarOn
          ? ctx.prisma.dSARRequest.findMany({
              where: {
                ...org,
                ...dsarReadFilter(ctx.membership.role, ctx.session.user.id),
                OR: [
                  { requesterName: name },
                  { publicId: ref },
                ],
              },
              select: { id: true, requesterName: true, publicId: true },
              orderBy: { createdAt: "desc" },
              take,
            })
          : Promise.resolve([] as Array<{ id: string; requesterName: string; publicId: string }>),
      ]);

      return [
        ...systems.map((r) => ({ kind: "system" as const, id: r.id, name: r.name, href: `/privacy/data-inventory/${r.id}` })),
        ...activities.map((r) => ({
          kind: "activity" as const,
          id: r.id,
          name: r.name,
          href: `/privacy/data-inventory/activities/${r.id}`,
        })),
        ...vendors.map((r) => ({ kind: "vendor" as const, id: r.id, name: r.name, href: `/privacy/vendors/${r.id}` })),
        ...assessments.map((r) => ({
          kind: "assessment" as const,
          id: r.id,
          name: r.name,
          href: `/privacy/assessments/${r.id}`,
        })),
        ...incidents.map((r) => ({
          kind: "incident" as const,
          id: r.id,
          name: r.title,
          publicId: r.publicId,
          href: `/privacy/incidents/${r.id}`,
        })),
        ...requests.map((r) => ({
          kind: "request" as const,
          id: r.id,
          name: r.requesterName,
          publicId: r.publicId,
          href: `/privacy/dsar/${r.id}`,
        })),
      ];
    }),
});
