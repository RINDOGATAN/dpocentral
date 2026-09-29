// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Sign-out never shows the library's unstyled default page: NextAuth's
 * GET /api/auth/signout is sent to our own confirmation, which signs out
 * through the same single path as the account menu.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import path from "path";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

const ROOT = path.resolve(__dirname, "..");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

describe("sign-out page", () => {
  it("is registered as NextAuth's sign-out page", () => {
    expect(read("src/lib/auth.ts")).toMatch(/signOut:\s*"\/sign-out"/);
  });

  it("lives in the auth layout and signs out through signOutOfSuite", () => {
    const file = "src/app/(auth)/sign-out/page.tsx";
    expect(existsSync(path.join(ROOT, file))).toBe(true);
    const src = read(file);
    expect(src).toContain("signOutOfSuite()");
    expect(src).not.toMatch(/from "next-auth\/react"/);
  });

  it("the guided account menu signs out directly, with no intermediate page", () => {
    const src = read("src/components/guided/guided-layout.tsx");
    expect(src).toContain("signOutOfSuite()");
    expect(src).not.toContain("/api/auth/signout");
    expect(src).not.toContain('"/sign-out"');
  });

  it("ships its copy in English and Spanish", () => {
    expect(Object.keys(en.auth.signOutPage)).toEqual(Object.keys(es.auth.signOutPage));
  });
});
