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

/**
 * Two privacy skills the storefront catalogues in the shared legal-skills
 * namespace (`com.nel.skills.*`) rather than under `com.nel.dpocentral.*`.
 * They are DPO Central content (assessment types DPIA and VENDOR) and the
 * storefront issues licence files under exactly these ids, so the seed
 * carries them verbatim (prisma/skill-package-seed.ts).
 */
export const DPIA_COMPANION_SKILL_ID = "com.nel.skills.dpia-companion";
export const VENDOR_RISK_SKILL_ID = "com.nel.skills.vendor-risk";

/** Storefront ids outside the dpocentral namespace that must activate here. */
export const STOREFRONT_SKILL_IDS = [DPIA_COMPANION_SKILL_ID, VENDOR_RISK_SKILL_ID] as const;
