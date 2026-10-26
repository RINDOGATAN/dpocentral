// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The build's migration step (scripts/build-migrate.mjs): which builds
 * migrate, which Prisma failures are retried, and that output never carries a
 * connection string or host.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isRetryable, nextDelay, redact, shouldMigrate } from "../scripts/build-migrate.mjs";

describe("build-migrate script", () => {
  it("migrates on production and local builds, skips other Vercel builds", () => {
    expect(shouldMigrate({ VERCEL_ENV: "production" })).toBe(true);
    expect(shouldMigrate({})).toBe(true);
    expect(shouldMigrate({ VERCEL_ENV: "preview" })).toBe(false);
    expect(shouldMigrate({ VERCEL_ENV: "development" })).toBe(false);
  });

  it("retries only an unreachable database or a held migration lock", () => {
    expect(isRetryable("Error: P1001: Can't reach database server at `x`:`5432`")).toBe(true);
    expect(isRetryable("Error: P1002\nThe database server was reached but timed out.")).toBe(true);
    expect(isRetryable("Timed out trying to acquire a postgres advisory lock")).toBe(true);
    expect(isRetryable("Timed out acquiring advisory lock")).toBe(true);
    expect(isRetryable("Error: P3009 migrate found failed migrations")).toBe(false);
    expect(isRetryable("Error: P3018 A migration failed to apply")).toBe(false);
    expect(isRetryable("")).toBe(false);
  });

  it("backs off from 5 s, doubling, capped at 60 s", () => {
    expect(nextDelay(5_000)).toBe(10_000);
    expect(nextDelay(40_000)).toBe(60_000);
    expect(nextDelay(60_000)).toBe(60_000);
  });

  it("masks connection strings, passwords and hosts", () => {
    const out = redact(
      "at postgresql://user:secret@host.example/db?sslmode=require and password=hunter2&x=1\n" +
        "Can't reach database server at `db.example.com:5432`\n" +
        'Datasource "db": PostgreSQL database "x", schema "public" at "db.example.com:5432"',
    );
    expect(out).not.toContain("secret");
    expect(out).not.toContain("hunter2");
    expect(out).not.toContain("db.example.com");
    expect(out).toContain("postgresql://[redacted]");
  });

  it("is what the build script runs instead of a bare migrate deploy", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf-8")) as { scripts: Record<string, string> };
    expect(pkg.scripts.build).toContain("node scripts/build-migrate.mjs");
    expect(pkg.scripts.build).not.toContain("prisma migrate deploy");
  });
});
