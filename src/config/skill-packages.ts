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

/** Skills that are announced but not yet purchasable (templates not created yet) */
export const COMING_SOON_SKILL_IDS = new Set([
  "com.nel.dpocentral.pia",
  "com.nel.dpocentral.vendor",
]);

/**
 * Price list. Every premium module is sold as an ANNUAL licence at the same
 * figure the todo.law marketplace charges self-hosted buyers (owner decision,
 * 2026-09-13: hosted and self-hosted buyers pay the same). Stripe prices must
 * be created with a yearly interval; the app never multiplies by 12.
 */
export const SKILL_PRICE_CENTS = 6000;
export const SKILL_PRICE_CURRENCY = "eur";
export const SKILL_PRICE_INTERVAL = "YEAR" as const;
/** Whole units for display when a package row carries no priceAmount. */
export const SKILL_PRICE_UNITS = SKILL_PRICE_CENTS / 100;

/**
 * Marker this app writes into the metadata of every Checkout Session and
 * Subscription it creates (`metadata.app`). The three suite apps share ONE
 * Stripe account, so every app's webhook endpoint receives every app's
 * events; the webhook uses this marker (and, failing that, whether the skill
 * package ids resolve in this database) to ignore events that are not its own.
 */
export const BILLING_APP_ID = "dpocentral";
