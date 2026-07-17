// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { describe, it, expect } from "vitest";
import { verifyWorkspacePassphrase } from "@/lib/workspace-passphrase";

describe("verifyWorkspacePassphrase", () => {
  it("accepts an exact match", () => {
    expect(verifyWorkspacePassphrase("a1b2-c3d4-e5f6", "a1b2-c3d4-e5f6")).toBe(
      true
    );
  });

  it("rejects a same-length mismatch", () => {
    expect(verifyWorkspacePassphrase("a1b2-c3d4-e5f7", "a1b2-c3d4-e5f6")).toBe(
      false
    );
  });

  it("rejects a different-length input without throwing", () => {
    expect(verifyWorkspacePassphrase("short", "a1b2-c3d4-e5f6")).toBe(false);
    expect(
      verifyWorkspacePassphrase("a1b2-c3d4-e5f6-extra", "a1b2-c3d4-e5f6")
    ).toBe(false);
  });

  it("rejects an empty input against a non-empty passphrase", () => {
    expect(verifyWorkspacePassphrase("", "a1b2-c3d4-e5f6")).toBe(false);
  });

  it("is case-sensitive", () => {
    expect(verifyWorkspacePassphrase("A1B2-C3D4-E5F6", "a1b2-c3d4-e5f6")).toBe(
      false
    );
  });

  it("handles multi-byte characters by byte length, not char length", () => {
    // "ñ" is 2 bytes in UTF-8; must not throw in timingSafeEqual
    expect(verifyWorkspacePassphrase("año", "ano")).toBe(false);
    expect(verifyWorkspacePassphrase("año", "año")).toBe(true);
  });
});
