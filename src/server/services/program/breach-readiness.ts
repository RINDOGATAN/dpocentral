// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The breach-readiness confirmation (step 5, src/config/breach-readiness.ts),
 * kept in the organisation's settings under `breachReadiness`: who confirmed,
 * when, for which declared laws, the internal contact, the supervisory
 * authority (null = the one each law names, shown in the reader's language)
 * and where the breach register is kept (null = DPO Central's own).
 *
 * A confirmation counts only while the declared laws are the same as when it
 * was given: adding or removing a law asks for it again. Every confirmation is
 * written to the activity log, without personal data beyond the user id.
 */

import type { Db } from "@/lib/prisma";
import { sameLaws } from "@/config/breach-readiness";

export const BREACH_READINESS_ACTION = "CONFIRM_BREACH_READINESS";
export const READINESS_TEXT_MAX = 300;

export interface BreachReadinessRecord {
  confirmedAt: string;
  confirmedBy: string;
  laws: string[];
  contact: string;
  authority: string | null;
  register: string | null;
}

function settingsObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, READINESS_TEXT_MAX) : null;
}

/** The confirmation kept in the settings, or null when there is none (or it is malformed). */
export function readBreachReadiness(settings: unknown): BreachReadinessRecord | null {
  const raw = settingsObject(settingsObject(settings).breachReadiness);
  const confirmedAt = typeof raw.confirmedAt === "string" ? raw.confirmedAt : null;
  const confirmedBy = typeof raw.confirmedBy === "string" ? raw.confirmedBy : null;
  const contact = text(raw.contact);
  if (!confirmedAt || !confirmedBy || !contact || !Array.isArray(raw.laws)) return null;
  return {
    confirmedAt,
    confirmedBy,
    laws: raw.laws.filter((c): c is string => typeof c === "string"),
    contact,
    authority: text(raw.authority),
    register: text(raw.register),
  };
}

/** Whether a confirmation is on record for exactly the laws declared now. */
export function isReadinessCurrent(record: BreachReadinessRecord | null, declared: readonly string[]): boolean {
  return !!record && sameLaws(record.laws, declared);
}

/** The codes of the laws the organisation has declared, in a stable order. */
export async function declaredLawCodes(prisma: Db, organizationId: string): Promise<string[]> {
  const rows = await prisma.organizationJurisdiction.findMany({
    where: { organizationId },
    select: { isPrimary: true, jurisdiction: { select: { code: true } } },
  });
  return rows
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.jurisdiction.code.localeCompare(b.jurisdiction.code))
    .map((r) => r.jurisdiction.code);
}

export async function confirmBreachReadiness(
  prisma: Db,
  args: {
    organizationId: string;
    userId: string;
    contact: string;
    authority?: string | null;
    register?: string | null;
    now?: Date;
  },
): Promise<BreachReadinessRecord> {
  const contact = text(args.contact);
  if (!contact) throw new Error("contact required");
  const laws = await declaredLawCodes(prisma, args.organizationId);
  const record: BreachReadinessRecord = {
    confirmedAt: (args.now ?? new Date()).toISOString(),
    confirmedBy: args.userId,
    laws,
    contact,
    authority: text(args.authority),
    register: text(args.register),
  };
  const organization = await prisma.organization.findFirst({
    where: { id: args.organizationId },
    select: { settings: true },
  });
  const settings = settingsObject(organization?.settings);
  await prisma.organization.update({
    where: { id: args.organizationId },
    data: { settings: { ...settings, breachReadiness: { ...record } } },
  });
  await prisma.auditLog.create({
    data: {
      organizationId: args.organizationId,
      userId: args.userId,
      entityType: "Organization",
      entityId: args.organizationId,
      action: BREACH_READINESS_ACTION,
      changes: { laws, customAuthority: record.authority !== null, customRegister: record.register !== null },
    },
  });
  return record;
}
