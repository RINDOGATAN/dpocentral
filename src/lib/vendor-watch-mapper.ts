// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Maps a vendor.watch `/catalog/sync` vendor into DPO Central's
 * VendorCatalog (`vendor_catalog`) upsert shape. Field names here are
 * DPO's own column names. Fields vendor.watch exposes but DPO does not
 * model (e.g. dpaComplianceScore) are dropped; fields DPO models but
 * vendor.watch does not send (e.g. senecaLitigation) keep their default.
 *
 * Used by scripts/sync-vendor-catalog.ts.
 */

import type { VendorWatchVendor } from "./vendor-watch-types";

/**
 * A few vendor.watch exports carry `subprocessors` as a JSON-*string* (an
 * upstream double-encoding bug, e.g. conductrics/sealmetrics in the 2026-08
 * snapshot). Recover the array so the Json column stores structured data;
 * anything unparseable passes through untouched.
 */
function normalizeSubprocessors(s: unknown): unknown {
  if (typeof s === "string") {
    try {
      const parsed: unknown = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // not JSON — fall through and keep the raw string
    }
  }
  return s;
}

/**
 * vendor.watch's own profile UI tolerates availability sentinels like
 * "Upon request" in URL fields; our register renders these as links, so
 * anything that isn't http(s) becomes null. The exporter sanitizes since
 * vendor.watch 05e51bd — this guards the live-sync path (which skips the
 * snapshot verifier) against upstream regressions.
 */
function httpUrlOrNull(value: string | null | undefined): string | null {
  return value && /^https?:\/\//i.test(value) ? value : null;
}

export function mapVendorToUpsert(v: VendorWatchVendor) {
  return {
    name: v.name,
    category: v.category,
    subcategory: v.subcategory,
    description: v.description,
    tags: v.tags || [],
    website: v.website,
    privacyPolicyUrl: httpUrlOrNull(v.privacyPolicyUrl),
    trustCenterUrl: httpUrlOrNull(v.trustCenterUrl),
    dpaUrl: httpUrlOrNull(v.dpaUrl),
    securityPageUrl: httpUrlOrNull(v.securityPageUrl),
    certifications: v.certifications || [],
    frameworks: v.frameworks || [],
    gdprCompliant: v.gdprCompliant,
    ccpaCompliant: v.ccpaCompliant,
    euAiActCompliant: v.euAiActCompliant,
    hipaaCompliant: v.hipaaCompliant,
    dataLocations: v.dataLocations || [],
    hasEuDataCenter: v.hasEuDataCenter,
    subprocessors: normalizeSubprocessors(v.subprocessors) ?? undefined,
    aiCapabilities: v.aiCapabilities || [],
    modelHosting: v.modelHosting,
    logoUrl: v.logoUrl,
    isVerified: v.isVerified,
    verifiedAt: v.verifiedAt ? new Date(v.verifiedAt) : null,
    verifiedBy: v.verifiedBy,
    source: "vendor-watch",
    // AI governance fields
    aiModels: v.aiModels ? JSON.parse(JSON.stringify(v.aiModels)) : undefined,
    aiTechniques: v.aiTechniques || [],
    euAiActRole: v.euAiActRole,
    euAiActAnnexIIIDomains: v.euAiActAnnexIIIDomains || [],
    iso42001Certified: v.iso42001Certified,
    supportsAuditLogs: v.supportsAuditLogs,
    supportsExplainability: v.supportsExplainability,
    hasBiasMonitoring: v.hasBiasMonitoring,
    hasModelCard: v.hasModelCard,
    aiIncidentNotificationSLA: v.aiIncidentNotificationSLA,
    // DPO stores this as a boolean flag; vendor.watch may send a string.
    dataProcessingTransparency:
      typeof v.dataProcessingTransparency === "boolean"
        ? v.dataProcessingTransparency
        : null,
    transferSafeguards: v.transferSafeguards,
    supportsDsars: v.supportsDsars,
    hasDesignatedDpo: v.hasDesignatedDpo,
    hasRecentBreach: v.hasRecentBreach,
    privacyTechnologies: v.privacyTechnologies || [],
  };
}
