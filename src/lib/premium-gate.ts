// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Where the product may show a lock, a price or a billing link.
 *
 * The hosted service is a free pilot: nothing is sold there, whatever
 * NEXT_PUBLIC_STRIPE_ENABLED says, so no lock, price or "premium" badge is
 * shown. The self-hosted kit keeps its licence gate: a premium assessment type
 * is offered only once its template is installed from a signed skill (see
 * getEntitledAssessmentTypes in server/services/licensing/entitlement.ts).
 *
 * Pure functions, shared by the server and the client pages, so the rule is
 * tested once.
 */

/** Premium assessment types (a template from a signed skill on the kit). */
export const PREMIUM_ASSESSMENT_TYPE_KEYS = ["DPIA", "PIA", "VENDOR"] as const;

export function isPremiumTypeKey(type: string): boolean {
  return (PREMIUM_ASSESSMENT_TYPE_KEYS as readonly string[]).includes(type);
}

/** A price, a billing link or an upgrade prompt may appear. */
export function sellingEnabled(stripeEnabled: boolean, hosted: boolean): boolean {
  return stripeEnabled && !hosted;
}

/**
 * Whether an assessment type card is shown locked. Never on the hosted pilot;
 * on the kit, a premium type is locked until the organisation is entitled to
 * it (its template is installed).
 */
export function isAssessmentTypeLocked(params: {
  type: string;
  entitledTypes: readonly string[];
  hosted: boolean;
  comingSoon?: boolean;
}): boolean {
  if (params.hosted || params.comingSoon) return false;
  return isPremiumTypeKey(params.type) && !params.entitledTypes.includes(params.type);
}

/**
 * Whether an assessment type is offered at all.
 *
 * A type announced as coming soon has no template behind it, so choosing it
 * leads nowhere: on the hosted service the lock is not shown either, which
 * made the card look available. Such a type is offered only once a template
 * for it exists, which is exactly what getEntitledAssessmentTypes reports
 * (it lists a type only when its template is installed). Every other type is
 * offered, locked or not: a locked card is a door that leads to the licence
 * notice, which is somewhere.
 */
export function isAssessmentTypeOffered(params: {
  type: string;
  entitledTypes: readonly string[];
  comingSoon?: boolean;
}): boolean {
  if (!params.comingSoon) return true;
  return params.entitledTypes.includes(params.type);
}
