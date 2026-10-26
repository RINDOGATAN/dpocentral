// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The build's migration step (scripts/migrate-deploy.mjs): which builds
 * migrate, which Prisma failures are retried, and that output never carries a
 * connection string.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { backoffSeconds, isTransientFailure, redact, shouldMigrate } from "../scripts/migrate-deploy.mjs";

describe("migrate-deploy script", () => {
  it("migrates on production and local builds, skips other Vercel builds", () => {
    expect(shouldMigrate({ VERCEL_ENV: "production" })).toBe(true);
    expect(shouldMigrate({})).toBe(true);
    expect(shouldMigrate({ VERCEL_ENV: "preview" })).toBe(false);
    expect(shouldMigrate({ VERCEL_ENV: "development" })).toBe(false);
  });

  it("retries only an unreachable database or a held migration lock", () => {
    expect(isTransientFailure("Error: P1001: Can't reach database server at `x`:`5432`")).toBe(true);
    expect(isTransientFailure("Error: P1002\nThe database server was reached but timed out.")).toBe(true);
    expect(isTransientFailure("Timed out acquiring advisory lock")).toBe(true);
    expect(isTransientFailure("Error: P3009 migrate found failed migrations")).toBe(false);
    expect(isTransientFailure("Error: P3018 A migration failed to apply")).toBe(false);
    expect(isTransientFailure("")).toBe(false);
  });

  it("backs off and caps the wait", () => {
    expect(backoffSeconds(0)).toBe(10);
    expect(backoffSeconds(4)).toBe(60);
    expect(backoffSeconds(20)).toBe(60);
  });

  it("masks connection strings and passwords", () => {
    const out = redact("at postgresql://user:secret@host.example/db?sslmode=require and password=hunter2&x=1");
    expect(out).not.toContain("secret");
    expect(out).not.toContain("hunter2");
    expect(out).toContain("postgresql://***");
  });

  it("is what the build script runs instead of a bare migrate deploy", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf-8")) as { scripts: Record<string, string> };
    expect(pkg.scripts.build).toContain("node scripts/migrate-deploy.mjs");
    expect(pkg.scripts.build).not.toContain("prisma migrate deploy");
  });
});
