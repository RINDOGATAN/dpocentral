// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * One sender name across the suite: every e-mail goes out as
 * "<Product> by TODO.LAW <address>", with the product name in title case.
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
    expect(emailFrom()).toBe("DPO Central by TODO.LAW <noreply@todo.law>");
  });

  it("drops a display name the variable already carries", async () => {
    vi.stubEnv("NEXT_PUBLIC_BRAND_NAME", "");
    vi.stubEnv("NEXT_PUBLIC_COMPANY_NAME", "");
    vi.stubEnv("NEXT_PUBLIC_EMAIL_FROM", "DPO CENTRAL <mail@example.com>");
    const { emailFrom } = await loadBrand();
    expect(emailFrom()).toBe("DPO Central by TODO.LAW <mail@example.com>");
  });

  it("keeps a bare address from the variable", () => {
    expect(formatMailFrom("DPO Central", "TODO.LAW", " mail@example.com ")).toBe(
      "DPO Central by TODO.LAW <mail@example.com>"
    );
  });

  it("falls back to the standing address when the variable holds no address", () => {
    expect(formatMailFrom("DPO Central", "TODO.LAW", undefined)).toBe(
      "DPO Central by TODO.LAW <noreply@todo.law>"
    );
    expect(formatMailFrom("DPO Central", "TODO.LAW", "Name <>")).toBe(
      "DPO Central by TODO.LAW <noreply@todo.law>"
    );
  });

  it("keeps a white-label name and company", () => {
    expect(formatMailFrom("Acme Privacy", "Acme", "noreply@acme.example")).toBe(
      "Acme Privacy by Acme <noreply@acme.example>"
    );
  });
});
