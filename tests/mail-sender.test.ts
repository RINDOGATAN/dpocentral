// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * One sender name: every e-mail goes out as "<Product> <address>", or
 * "<Product> by <Company> <address>" when a company name is set, with the
 * product name in title case.
 *
 * The address comes from NEXT_PUBLIC_EMAIL_FROM when set. If that variable
 * already carries a display name, only the address is kept, so the variable
 * cannot change the name the recipient sees.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { formatMailFrom } from "@/config/brand";

async function loadBrand() {
  vi.resetModules();
  return import("@/config/brand");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("mail sender header", () => {
  it("uses the title-case product name and the standing address by default", async () => {
    vi.stubEnv("NEXT_PUBLIC_BRAND_NAME", "");
    vi.stubEnv("NEXT_PUBLIC_COMPANY_NAME", "");
    vi.stubEnv("NEXT_PUBLIC_EMAIL_FROM", "");
    const { emailFrom } = await loadBrand();
    expect(emailFrom()).toBe("DPO Central <noreply@example.com>");
  });

  it("drops a display name the variable already carries", async () => {
    vi.stubEnv("NEXT_PUBLIC_BRAND_NAME", "");
    vi.stubEnv("NEXT_PUBLIC_COMPANY_NAME", "");
    vi.stubEnv("NEXT_PUBLIC_EMAIL_FROM", "DPO CENTRAL <mail@example.com>");
    const { emailFrom } = await loadBrand();
    expect(emailFrom()).toBe("DPO Central <mail@example.com>");
  });

  it("keeps a bare address from the variable", () => {
    expect(formatMailFrom("DPO Central", "Example Co", " mail@example.com ")).toBe(
      "DPO Central by Example Co <mail@example.com>"
    );
  });

  it("falls back to the standing address when the variable holds no address", () => {
    expect(formatMailFrom("DPO Central", "Example Co", undefined)).toBe(
      "DPO Central by Example Co <noreply@example.com>"
    );
    expect(formatMailFrom("DPO Central", "Example Co", "Name <>")).toBe(
      "DPO Central by Example Co <noreply@example.com>"
    );
  });

  it("leaves the company out when none is set", () => {
    expect(formatMailFrom("DPO Central", "", "noreply@acme.example")).toBe("DPO Central <noreply@acme.example>");
  });

  it("keeps a white-label name and company", () => {
    expect(formatMailFrom("Acme Privacy", "Acme", "noreply@acme.example")).toBe(
      "Acme Privacy by Acme <noreply@acme.example>"
    );
  });
});
