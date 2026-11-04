// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Reads what the record of processing prints (GDPR Art. 30): the controller
 * block of the organisation and the activities of one record (controller,
 * Art. 30(1), or processor, Art. 30(2)).
 *
 * The caller has checked the session and the membership; a department-limited
 * member passes its scope and sees only the activities of its departments.
 */

import type { Db } from "@/lib/prisma";
import {
  departmentScopeConditions,
  type BusinessUnitScope,
} from "@/server/services/business-units/scope";
import type { ROPAEntry, ROPATransfer, RopaRecordKind, RopaRole } from "@/server/services/privacy/ropaGenerator";

/** The organisation as controller (or, in the processor record, as processor). */
export interface ControllerDetails {
  legalName: string;
  taxId: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  dpoName: string | null;
  dpoContact: string | null;
  representativeName: string | null;
  representativeContact: string | null;
  /** The general description of security measures every activity inherits. */
  securityMeasures: string | null;
}

/** The stored columns, as the settings form reads and writes them. */
export const CONTROLLER_FIELDS = [
  "controllerLegalName",
  "controllerTaxId",
  "controllerAddress",
  "controllerEmail",
  "controllerPhone",
  "dpoName",
  "dpoContact",
  "euRepresentativeName",
  "euRepresentativeContact",
  "securityMeasures",
] as const;
export type ControllerField = (typeof CONTROLLER_FIELDS)[number];
export type StoredControllerDetails = Record<ControllerField, string | null>;

const blank = (v: string | null | undefined): string | null => (v && v.trim() ? v.trim() : null);

/**
 * The block as printed: what was filled in, and where nothing was, what the
 * app already knows (the organisation's name; the contact address of the
 * rights-request form).
 */
export function effectiveControllerDetails(
  stored: Partial<StoredControllerDetails>,
  known: { orgName: string; contactEmail?: string | null },
): ControllerDetails {
  return {
    legalName: blank(stored.controllerLegalName) ?? known.orgName,
    taxId: blank(stored.controllerTaxId),
    address: blank(stored.controllerAddress),
    email: blank(stored.controllerEmail) ?? blank(known.contactEmail),
    phone: blank(stored.controllerPhone),
    dpoName: blank(stored.dpoName),
    dpoContact: blank(stored.dpoContact),
    representativeName: blank(stored.euRepresentativeName),
    representativeContact: blank(stored.euRepresentativeContact),
    securityMeasures: blank(stored.securityMeasures),
  };
}

const CONTROLLER_SELECT = Object.fromEntries(CONTROLLER_FIELDS.map((f) => [f, true])) as Record<ControllerField, true>;

/** The stored block plus what the app knows, for the settings form and the exports. */
export async function loadControllerDetails(
  prisma: Db,
  organizationId: string,
): Promise<{ stored: StoredControllerDetails; known: { orgName: string; contactEmail: string | null }; effective: ControllerDetails }> {
  const [org, form] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, ...CONTROLLER_SELECT },
    }),
    prisma.dSARIntakeForm.findFirst({
      where: { organizationId, privacyContactEmail: { not: null } },
      orderBy: { createdAt: "asc" },
      select: { privacyContactEmail: true },
    }),
  ]);
  const stored = Object.fromEntries(
    CONTROLLER_FIELDS.map((f) => [f, (org?.[f] as string | null | undefined) ?? null]),
  ) as StoredControllerDetails;
  const known = { orgName: org?.name ?? "", contactEmail: form?.privacyContactEmail ?? null };
  return { stored, known, effective: effectiveControllerDetails(stored, known) };
}

/** Roles that belong in each record. */
export function rolesFor(kind: RopaRecordKind): RopaRole[] {
  return kind === "processor" ? ["PROCESSOR"] : ["CONTROLLER", "JOINT_CONTROLLER"];
}

const ACTIVITY_INCLUDE = {
  assets: {
    include: {
      linkedElements: { include: { dataElement: true } },
      dataAsset: { include: { dataElements: true } },
    },
  },
  // Ended transfers are not part of the record (Art. 30(1)(e) is what happens now).
  transfers: { where: { isActive: true } },
} as const;

type TransferRow = {
  destinationCountry: string;
  destinationOrg: string | null;
  mechanism: string;
  safeguards: string | null;
  tiaCompleted: boolean;
  tiaDate: Date | null;
};

function toTransfer(t: TransferRow): ROPATransfer {
  return {
    destination: t.destinationCountry,
    organization: t.destinationOrg,
    mechanism: t.mechanism,
    safeguards: t.safeguards,
    tiaCompleted: t.tiaCompleted,
    tiaDate: t.tiaDate,
  };
}

export interface RopaData {
  entries: ROPAEntry[];
  /** Activity ids, in the order of `entries` (for the flow map). */
  activityIds: string[];
  /** Active transfers not linked to any activity (organisation-wide view only). */
  unassignedTransfers: ROPATransfer[];
  controller: ControllerDetails;
  /** The raw activities, for the flow map of the PDF. */
  activities: Array<{
    id: string;
    name: string;
    assets: Array<{ dataAsset: { id: string; name: string; type: string } }>;
  }>;
}

export async function loadRopaData(
  prisma: Db,
  organizationId: string,
  opts: { kind?: RopaRecordKind; scope?: BusinessUnitScope } = {},
): Promise<RopaData> {
  const kind = opts.kind ?? "controller";
  const scope: BusinessUnitScope = opts.scope ?? { all: true };
  const deptConditions = departmentScopeConditions(scope);

  const [{ effective: controller }, activities, unassigned] = await Promise.all([
    loadControllerDetails(prisma, organizationId),
    prisma.processingActivity.findMany({
      where: {
        organizationId,
        isActive: true,
        role: { in: rolesFor(kind) },
        ...(deptConditions.length > 0 ? { AND: deptConditions as never } : {}),
      },
      include: ACTIVITY_INCLUDE,
      orderBy: kind === "processor" ? [{ clientControllerName: "asc" }, { name: "asc" }] : { name: "asc" },
    }),
    // Transfers outside any activity are organisation-wide: only a member
    // who sees the whole organisation gets them.
    kind === "controller" && scope.all
      ? prisma.dataTransfer.findMany({
          where: { organizationId, isActive: true, processingActivityId: null },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const entries: ROPAEntry[] = activities.map((activity) => {
    const own = blank(activity.securityMeasures);
    return {
      name: activity.name,
      description: activity.description,
      role: activity.role,
      jointControllerDetails: activity.jointControllerDetails,
      purpose: activity.purpose,
      legalBasis: activity.legalBasis,
      legalBasisDetail: activity.legalBasisDetail,
      dataSubjects: activity.dataSubjects,
      dataCategories: activity.categories,
      recipients: activity.recipients,
      retentionPeriod: activity.retentionPeriod,
      retentionDays: activity.retentionDays,
      securityMeasures: own ?? controller.securityMeasures,
      securityInherited: !own && !!controller.securityMeasures,
      automatedDecisionMaking: activity.automatedDecisionMaking,
      automatedDecisionDetail: activity.automatedDecisionDetail,
      clientControllerName: activity.clientControllerName,
      clientControllerContact: activity.clientControllerContact,
      clientRepresentative: activity.clientRepresentative,
      clientDpo: activity.clientDpo,
      systems: activity.assets.map((a) => {
        const effectiveElements =
          a.linkedElements.length > 0 ? a.linkedElements.map((le) => le.dataElement) : a.dataAsset.dataElements;
        return {
          name: a.dataAsset.name,
          type: a.dataAsset.type,
          location: a.dataAsset.location,
          elements: effectiveElements.map((e) => ({ name: e.name, category: e.category, sensitivity: e.sensitivity })),
        };
      }),
      transfers: activity.transfers.map(toTransfer),
      lastReviewed: activity.lastReviewedAt,
      nextReview: activity.nextReviewAt,
    };
  });

  return {
    entries,
    activityIds: activities.map((a) => a.id),
    unassignedTransfers: unassigned.map(toTransfer),
    controller,
    activities,
  };
}
