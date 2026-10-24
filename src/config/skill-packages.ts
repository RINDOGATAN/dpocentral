// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Skill Package ID Mapping
 *
 * Maps assessment types and premium features to their Stripe skill package IDs.
 * Used by upgrade flows to create the correct checkout session.
 */

export const SKILL_PACKAGE_IDS: Record<string, string> = {
  DPIA: "com.nel.dpocentral.dpia",
  PIA: "com.nel.dpocentral.pia",
  TIA: "com.nel.dpocentral.tia",
  VENDOR: "com.nel.dpocentral.vendor",
  VENDOR_CATALOG: "com.nel.dpocentral.vendor-catalog",
  ROPA_EXPORT: "com.nel.dpocentral.ropa-export",
  DSAR_PORTAL: "com.nel.dpocentral.dsar-portal",
};

export const SKILL_DISPLAY_NAMES: Record<string, string> = {
  DPIA: "Data Protection Impact Assessment (DPIA)",
  PIA: "Privacy Impact Assessment (PIA)",
  TIA: "Transfer Impact Assessment (TIA)",
  VENDOR: "Vendor Risk Assessment",
  VENDOR_CATALOG: "Vendor Catalog",
  ROPA_EXPORT: "ROPA Export",
  DSAR_PORTAL: "DSAR Public Portal",
};

/**
 * Skills announced but not yet purchasable. A screen shows one as "coming"
 * only while its type has no template (the PIA's open-source template,
 * system-pia-template-v2, is seeded on every install, so it is offered).
 */
export const COMING_SOON_SKILL_IDS = new Set([
  "com.nel.dpocentral.pia",
  "com.nel.dpocentral.vendor",
]);
