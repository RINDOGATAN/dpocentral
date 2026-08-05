// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Hermetic unit tests for mapVendorToUpsert — specifically the recovery of
 * double-JSON-encoded `subprocessors` strings that some vendor.watch exports
 * carry (upstream bug observed on conductrics/sealmetrics, 2026-08 snapshot).
 */

import { describe, it, expect } from "vitest";
import { mapVendorToUpsert } from "@/lib/vendor-watch-mapper";
import type { VendorWatchVendor } from "@/lib/vendor-watch-types";

const base: VendorWatchVendor = {
  slug: "test-vendor",
  name: "Test Vendor",
  category: "Analytics",
  subcategory: null,
  description: null,
  tags: [],
  website: null,
  privacyPolicyUrl: null,
  trustCenterUrl: null,
  dpaUrl: null,
  securityPageUrl: null,
  certifications: [],
  frameworks: [],
  gdprCompliant: null,
  ccpaCompliant: null,
  euAiActCompliant: null,
  hipaaCompliant: null,
  dataLocations: [],
  hasEuDataCenter: null,
  subprocessors: null,
  aiCapabilities: [],
  modelHosting: null,
  logoUrl: null,
  isVerified: false,
  verifiedAt: null,
  verifiedBy: null,
  aiModels: null,
  aiTechniques: [],
  euAiActRole: null,
  euAiActAnnexIIIDomains: [],
  iso42001Certified: null,
  supportsAuditLogs: null,
  supportsExplainability: null,
  hasBiasMonitoring: null,
  hasModelCard: null,
  aiIncidentNotificationSLA: null,
  dataProcessingTransparency: null,
  transferSafeguards: null,
  supportsDsars: null,
  hasDesignatedDpo: null,
  hasRecentBreach: null,
};

describe("mapVendorToUpsert subprocessors normalization", () => {
  it("passes a structured array through untouched", () => {
    const subs = [{ name: "AWS", purpose: "Hosting", location: "EU" }];
    expect(mapVendorToUpsert({ ...base, subprocessors: subs }).subprocessors).toEqual(subs);
  });

  it("recovers a double-JSON-encoded array string", () => {
    const encoded = JSON.stringify([{ name: "Noraina", purpose: "Cloud hosting / ISP", location: "Ireland" }]);
    expect(mapVendorToUpsert({ ...base, subprocessors: encoded }).subprocessors).toEqual([
      { name: "Noraina", purpose: "Cloud hosting / ISP", location: "Ireland" },
    ]);
  });

  it("keeps a non-JSON string as-is", () => {
    expect(
      mapVendorToUpsert({ ...base, subprocessors: "AWS, Cloudflare" }).subprocessors
    ).toBe("AWS, Cloudflare");
  });

  it("keeps a JSON string that is not an array as-is", () => {
    expect(mapVendorToUpsert({ ...base, subprocessors: '{"name":"AWS"}' }).subprocessors).toBe(
      '{"name":"AWS"}'
    );
  });

  it("maps null to undefined (Prisma: leave column untouched semantics preserved)", () => {
    expect(mapVendorToUpsert({ ...base, subprocessors: null }).subprocessors).toBeUndefined();
  });
});
