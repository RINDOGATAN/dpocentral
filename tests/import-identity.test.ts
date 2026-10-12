// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signImportIdentity, verifyImportIdentity } from "@/lib/import-identity";

const SECRET = "test-identity-secret";
const NOW = new Date("2026-10-12T12:00:00Z");
const opts = { secrets: [SECRET], audience: "dpocentral-import", issuers: ["vendorwatch"], now: NOW };

function sign(overrides: Partial<{ issuer: string; audience: string; email: string; secret: string; now: Date }> = {}) {
  return signImportIdentity({
    issuer: "vendorwatch",
    audience: "dpocentral-import",
    email: "Person@Example.com ",
    secret: SECRET,
    now: NOW,
    ...overrides,
  });
}

/** Builds a token from raw parts, to test claims the signer never emits. */
function forge(header: object, claims: object, secret = SECRET): string {
  const h = Buffer.from(JSON.stringify(header)).toString("base64url");
  const p = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const s = createHmac("sha256", secret).update(`${h}.${p}`).digest("base64url");
  return `${h}.${p}.${s}`;
}

const iat = Math.floor(NOW.getTime() / 1000);
const baseClaims = { iss: "vendorwatch", aud: "dpocentral-import", sub: "person@example.com", iat, exp: iat + 300, jti: "j1" };

describe("import identity statements", () => {
  it("accepts a valid statement and normalises the e-mail", () => {
    expect(verifyImportIdentity(sign(), opts)).toEqual({ ok: true, email: "person@example.com", issuer: "vendorwatch" });
  });

  it("accepts any of several configured secrets (rotation)", () => {
    expect(verifyImportIdentity(sign(), { ...opts, secrets: ["old", SECRET] }).ok).toBe(true);
  });

  it("refuses a wrong signature", () => {
    expect(verifyImportIdentity(sign({ secret: "other" }), opts)).toEqual({ ok: false, reason: "signature" });
  });

  it("refuses a statement for another receiver", () => {
    expect(verifyImportIdentity(sign({ audience: "aisentinel-import" }), opts)).toEqual({ ok: false, reason: "audience" });
  });

  it("refuses an issuer that is not accepted", () => {
    expect(verifyImportIdentity(sign({ issuer: "dpocentral" }), opts)).toEqual({ ok: false, reason: "issuer" });
  });

  it("refuses an expired statement", () => {
    const later = new Date(NOW.getTime() + 331_000);
    expect(verifyImportIdentity(sign(), { ...opts, now: later })).toEqual({ ok: false, reason: "expired" });
    const justInside = new Date(NOW.getTime() + 329_000);
    expect(verifyImportIdentity(sign(), { ...opts, now: justInside }).ok).toBe(true);
  });

  it("refuses a statement issued in the future beyond the tolerance", () => {
    const future = new Date(NOW.getTime() + 31_000);
    expect(verifyImportIdentity(sign({ now: future }), opts)).toEqual({ ok: false, reason: "not_yet_valid" });
  });

  it("refuses a lifetime longer than five minutes", () => {
    const token = forge({ alg: "HS256", typ: "JWT" }, { ...baseClaims, exp: iat + 301 });
    expect(verifyImportIdentity(token, opts)).toEqual({ ok: false, reason: "lifetime" });
  });

  it("refuses any algorithm other than HS256", () => {
    expect(verifyImportIdentity(forge({ alg: "none", typ: "JWT" }, baseClaims), opts)).toEqual({ ok: false, reason: "algorithm" });
    expect(verifyImportIdentity(forge({ alg: "HS512", typ: "JWT" }, baseClaims), opts)).toEqual({ ok: false, reason: "algorithm" });
  });

  it("refuses malformed input", () => {
    for (const bad of ["", "a.b", "a.b.c.d", "a.b.c", "x!.y.z", `${sign()}x=`]) {
      expect(verifyImportIdentity(bad, opts).ok).toBe(false);
    }
  });

  it("refuses missing claims", () => {
    const noJti: Partial<typeof baseClaims> = { ...baseClaims };
    delete noJti.jti;
    expect(verifyImportIdentity(forge({ alg: "HS256" }, noJti), opts)).toEqual({ ok: false, reason: "jti" });
    expect(verifyImportIdentity(forge({ alg: "HS256" }, { ...baseClaims, sub: "" }), opts)).toEqual({ ok: false, reason: "subject" });
  });
});
