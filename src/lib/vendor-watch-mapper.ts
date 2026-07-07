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

export function mapVendorToUpsert(v: VendorWatchVendor) {
  return {
    name: v.name,
    category: v.category,
    subcategory: v.subcategory,
    description: v.description,
    tags: v.tags || [],
    website: v.website,
    privacyPolicyUrl: v.privacyPolicyUrl,
    trustCenterUrl: v.trustCenterUrl,
    dpaUrl: v.dpaUrl,
    securityPageUrl: v.securityPageUrl,
    certifications: v.certifications || [],
    frameworks: v.frameworks || [],
    gdprCompliant: v.gdprCompliant,
    ccpaCompliant: v.ccpaCompliant,
    euAiActCompliant: v.euAiActCompliant,
    hipaaCompliant: v.hipaaCompliant,
    dataLocations: v.dataLocations || [],
    hasEuDataCenter: v.hasEuDataCenter,
    subprocessors: v.subprocessors ?? undefined,
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
