"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useTranslations } from "next-intl";

// Prisma enum values (VendorStatus, DSARType, IncidentSeverity …) reach the UI
// as raw SCREAMING_SNAKE strings. Rendering them directly leaks an internal
// code onto the screen — "PENDING_REVIEW", "STANDARD_CONTRACTUAL_CLAUSES",
// "LEGITIMATE_INTERESTS" — and, worse, leaks English into the Spanish UI.
//
// This one hook localises every enum a list or detail page shows, from the
// `enums` namespace in the message catalogues. A value with no translation
// degrades to a de-snaked, title-cased version ("Pending Review"), never the
// raw code. Import from here instead of re-declaring `t(`status.${x}`)` maps
// per page. A regression test (enum-render.test.ts) scans the components to
// keep raw enum values off the screen.

/** The enum groups keyed under the `enums` message namespace. */
export type EnumKind =
  | "assessmentType"
  | "assessmentStatus"
  | "approvalStatus"
  | "dsarType"
  | "dsarStatus"
  | "dsarTaskStatus"
  | "incidentSeverity"
  | "incidentStatus"
  | "incidentType"
  | "transferMechanism"
  | "transferStatus"
  | "riskLevel"
  | "legalBasis"
  | "vendorStatus"
  | "contractType"
  | "contractStatus"
  | "dataAssetType"
  | "dataSensitivity"
  | "notificationStatus"
  | "reviewType"
  | "role"
  // The audit trail's action verbs (CREATE, UPDATE, …) and entity names
  // (Organization, DataAsset, …), shown on the dashboard's recent activity.
  // Entity names are model names, not SCREAMING_SNAKE, so the de-snake fallback
  // would mangle "AISystem"/"DSARRequest": every current value has a label.
  | "auditAction"
  | "auditEntity";

/** De-snake a raw enum value to a readable label of last resort. */
export function desnake(value: string): string {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function useEnumLabels() {
  const t = useTranslations("enums");

  /**
   * Localise one enum value. Empty/nullish → "". A key present in `enums.<kind>`
   * wins; otherwise the value is de-snaked so a newly added member never shows
   * as a raw code.
   */
  const label = (kind: EnumKind, value?: string | null): string => {
    if (!value) return "";
    const key = `${kind}.${value}`;
    return t.has(key) ? t(key) : desnake(value);
  };

  return { label, desnake };
}
