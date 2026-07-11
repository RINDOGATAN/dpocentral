// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Cross-app canonical-bytes parity test (DPO Central verifier side).
 *
 * The todo.law storefront signs a licence over the canonical bytes; this app
 * recomputes the SAME bytes to verify the signature. If they disagree on a
 * single byte, offline activation silently breaks. The two golden SHA-256
 * hashes below pin the byte contract identically across all four repos
 * (todolaw signer + deal-room + dpocentral + aisentinel).
 */
import { describe, it, expect } from "vitest";
import { createHash } from "crypto";
import { canonicalLicensePayload, type LicenseFile } from "@/lib/license-crypto";

const sha256hex = (b: Buffer) => createHash("sha256").update(b).digest("hex");

// If a hash below changes, the canonical serialization drifted — do NOT patch
// the hash in one repo. Re-align field order / undefined-handling and update all
// four repos in lockstep.
const VECTOR_A: Omit<LicenseFile, "signature"> = {
  licenseKey: "LIC-0000-1111-2222-3333",
  customerId: "buyer@example.com",
  customerName: "Buyer Example",
  skillId: "com.todolaw.dealroom.saas-agreement",
  jurisdictions: ["CALIFORNIA", "SPAIN"],
  licenseType: "SUBSCRIPTION",
  maxActivations: 1,
  issuedAt: "2026-01-01T00:00:00.000Z",
  expiresAt: "2027-01-01T00:00:00.000Z",
};
const VECTOR_A_SHA256 =
  "842859360ab37eafed245eca38e8e0b207c4618d3daf43f1084ce46ce5118c1e";

const VECTOR_B: Omit<LicenseFile, "signature"> = {
  licenseKey: "LIC-4444-5555-6666-7777",
  customerId: "owner@example.com",
  customerName: "Owner Example",
  skillId: "com.nel.dpocentral.dpia-companion",
  jurisdictions: ["SPAIN"],
  licenseType: "PERPETUAL",
  maxActivations: 3,
  issuedAt: "2026-02-02T00:00:00.000Z",
  // expiresAt intentionally omitted — perpetual licence
};
const VECTOR_B_SHA256 =
  "2bc399ecab951c512959dbf159344ff2c59a81abd92496c3077a53484d95efbf";

describe("canonical licence bytes — cross-app golden vectors", () => {
  it("vector A (subscription, expiresAt present) hashes to the pinned value", () => {
    expect(sha256hex(canonicalLicensePayload(VECTOR_A))).toBe(VECTOR_A_SHA256);
  });

  it("vector B (perpetual) omits expiresAt and hashes to the pinned value", () => {
    const bytes = canonicalLicensePayload(VECTOR_B);
    expect(bytes.toString("utf-8")).not.toContain("expiresAt");
    expect(sha256hex(bytes)).toBe(VECTOR_B_SHA256);
  });
});
