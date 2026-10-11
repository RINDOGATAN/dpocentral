// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The shared counters (src/lib/shared-rate-limit.ts) and the public form's
 * wiring of the hidden field and the form token.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  envLimit,
  hashIdentifier,
  hitCounter,
  windowStart,
  DAY_MS,
} from "@/lib/shared-rate-limit";
import { checkFormToken, issueFormToken, MIN_FILL_MS } from "@/server/services/dsar/public-intake-guard";

afterEach(() => vi.unstubAllEnvs());

describe("shared counters", () => {
  it("counts in one atomic statement, keyed by bucket and window", async () => {
    const queryRaw = vi.fn().mockResolvedValue([{ count: 4 }]);
    const now = new Date("2026-10-11T15:30:00Z");
    await expect(hitCounter({ $queryRaw: queryRaw }, "dsar-org:o1", DAY_MS, now)).resolves.toBe(4);
    const [sql, key, start, expires] = queryRaw.mock.calls[0]!;
    expect((sql as string[]).join("?")).toMatch(/ON CONFLICT \("key", "windowStart"\)\s+DO UPDATE SET "count" = "rate_limit_counters"\."count" \+ 1\s+RETURNING "count"/);
    expect(key).toBe("dsar-org:o1");
    expect(start).toEqual(new Date("2026-10-11T00:00:00Z"));
    expect(expires).toEqual(new Date("2026-10-12T00:00:00Z"));
  });

  it("puts days on UTC boundaries", () => {
    expect(windowStart(new Date("2026-10-11T23:59:59Z"), DAY_MS)).toEqual(new Date("2026-10-11T00:00:00Z"));
    expect(windowStart(new Date("2026-10-12T00:00:00Z"), DAY_MS)).toEqual(new Date("2026-10-12T00:00:00Z"));
  });

  it("hashes an address after trimming and lower-casing, and never returns it", () => {
    const a = hashIdentifier("email", " Ana@Example.com ");
    expect(a).toBe(hashIdentifier("email", "ana@example.com"));
    expect(a).not.toContain("ana");
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(hashIdentifier("ip", "ana@example.com")).not.toBe(a);
  });

  it("reads limits from the environment, ignoring zero and typos", () => {
    vi.stubEnv("X_LIMIT", "25");
    expect(envLimit("X_LIMIT", 10)).toBe(25);
    vi.stubEnv("X_LIMIT", "0");
    expect(envLimit("X_LIMIT", 10)).toBe(10);
    vi.stubEnv("X_LIMIT", "lots");
    expect(envLimit("X_LIMIT", 10)).toBe(10);
  });
});

describe("form token", () => {
  const now = new Date("2026-10-11T12:00:00Z");
  const at = (msAgo: number) => issueFormToken("acme", new Date(now.getTime() - msAgo));

  it("is accepted from the minimum fill time up to a day", () => {
    expect(checkFormToken(at(MIN_FILL_MS), "acme", now)).toEqual({ ok: true });
    expect(checkFormToken(at(DAY_MS), "acme", now)).toEqual({ ok: true });
    expect(checkFormToken(at(MIN_FILL_MS - 1), "acme", now)).toEqual({ ok: false, reason: "too_fast" });
    expect(checkFormToken(at(DAY_MS + 1), "acme", now)).toEqual({ ok: false, reason: "token_expired" });
  });

  it("is bound to the organisation and cannot be re-dated", () => {
    expect(checkFormToken(at(10_000), "other", now)).toEqual({ ok: false, reason: "token_invalid" });
    const [, sig] = at(10_000).split(".");
    const redated = `${now.getTime() - 20_000}.${sig}`;
    expect(checkFormToken(redated, "acme", now)).toEqual({ ok: false, reason: "token_invalid" });
    expect(checkFormToken("garbage", "acme", now)).toEqual({ ok: false, reason: "token_invalid" });
    expect(checkFormToken(undefined, "acme", now)).toEqual({ ok: false, reason: "token_invalid" });
  });
});

describe("the public form page", () => {
  const page = readFileSync(
    path.resolve(__dirname, "../src/app/dsar/[orgSlug]/page.tsx"),
    "utf8"
  );

  it("carries the hidden field out of reach of people and screen readers", () => {
    expect(page).toMatch(/aria-hidden="true"/);
    expect(page).toMatch(/name="website"/);
    expect(page).toMatch(/tabIndex=\{-1\}/);
    expect(page).toMatch(/autoComplete="off"/);
  });

  it("sends the form token and does not refetch it on focus", () => {
    expect(page).toMatch(/formToken: formConfig\?\.formToken/);
    expect(page).toMatch(/refetchOnWindowFocus: false/);
  });

  it("tells the requester to keep the reference when no acknowledgement was sent", () => {
    expect(page).toMatch(/acknowledgementSent === false/);
    expect(page).toMatch(/success\.noEmailNote/);
  });
});
