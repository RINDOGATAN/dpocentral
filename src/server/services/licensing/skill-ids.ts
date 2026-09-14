// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Feature-skill ids shared by the entitlement gates and the paywall grace
 * service. Kept in a leaf module so neither side imports the other.
 * These ids are the contract with the storefront and the seed
 * (prisma/seed.ts, src/config/skill-packages.ts).
 */
export const VENDOR_CATALOG_SKILL_ID = "com.nel.dpocentral.vendor-catalog";
export const ROPA_EXPORT_SKILL_ID = "com.nel.dpocentral.ropa-export";
export const COMPLETE_PACKAGE_SKILL_ID = "com.nel.dpocentral.complete";
