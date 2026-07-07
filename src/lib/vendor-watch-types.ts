// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Types for the vendor.watch catalog sync API (`/catalog/sync`).
 *
 * DPO Central owns its own database and pulls the global vendor
 * catalog from vendor.watch over HTTP (never a shared DB). This
 * mirrors the shape AI Sentinel already consumes from the same
 * endpoint. Used by scripts/sync-vendor-catalog.ts.
 */

export interface CatalogAIModel {
  name: string;
  type: string;
  source: string;
}

export interface VendorWatchVendor {
  id?: string;
  slug: string;
  name: string;
  category: string;
  subcategory: string | null;
  description: string | null;
  tags: string[];
  website: string | null;
  privacyPolicyUrl: string | null;
  trustCenterUrl: string | null;
  dpaUrl: string | null;
  securityPageUrl: string | null;
  certifications: string[];
  frameworks: string[];
  gdprCompliant: boolean | null;
  ccpaCompliant: boolean | null;
  euAiActCompliant: boolean | null;
  hipaaCompliant: boolean | null;
  dataLocations: string[];
  hasEuDataCenter: boolean | null;
  subprocessors: unknown;
  aiCapabilities: string[];
  modelHosting: string | null;
  logoUrl: string | null;
  isVerified: boolean;
  verifiedAt: string | null;
  verifiedBy: string | null;
  source?: string | null;
  createdAt?: string;
  updatedAt?: string;
  // AI governance fields
  aiModels: CatalogAIModel[] | null;
  aiTechniques: string[];
  euAiActRole: string | null;
  euAiActAnnexIIIDomains: string[];
  iso42001Certified: boolean | null;
  supportsAuditLogs: boolean | null;
  supportsExplainability: boolean | null;
  hasBiasMonitoring: boolean | null;
  hasModelCard: boolean | null;
  aiIncidentNotificationSLA: string | null;
  // vendor.watch sends this as a descriptive string; DPO stores a
  // boolean flag, so the mapper coerces it. See vendor-watch-mapper.ts.
  dataProcessingTransparency: boolean | string | null;
  transferSafeguards: string | null;
  supportsDsars: boolean | null;
  hasDesignatedDpo: boolean | null;
  hasRecentBreach: boolean | null;
  // Present on some vendor.watch responses; optional here.
  privacyTechnologies?: string[];
}

export interface VendorWatchSyncResponse {
  vendors: VendorWatchVendor[];
  nextCursor: string | undefined;
  count: number;
}
