// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Signed identity statements for the cross-app import API.
 *
 * The shared `x-api-key` identifies the calling application. The statement
 * carried in `x-import-identity` identifies the signed-in person the call is
 * made for: a compact HS256 JWT minted by the caller from its own server-side
 * session, valid for at most five minutes, addressed to one receiver.
 *
 *   iss  the calling application ("dpocentral" | "vendorwatch")
 *   aud  the receiving application ("aisentinel-import" | "dpocentral-import")
 *   sub  the person's e-mail, trimmed and lower-cased
 *   iat, exp (exp - iat <= 300 s), jti (random)
 *
 * node:crypto only, so the same code runs in every sibling application
 * without a new dependency.
 */

import { createHmac, randomBytes } from "node:crypto";
import { safeEqual } from "@/lib/safe-equal";

export const IMPORT_IDENTITY_HEADER = "x-import-identity";
export const IMPORT_IDENTITY_MAX_LIFETIME_S = 300;
export const IMPORT_IDENTITY_CLOCK_TOLERANCE_S = 30;

const HEADER_B64 = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

function hmac(secret: string, data: string): string {
  return createHmac("sha256", secret).update(data, "utf8").digest("base64url");
}

/** Trimmed, lower-cased e-mail: the form `sub` is compared in. */
export function normalizeIdentityEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Comma-separated secret list from an environment variable (empty entries dropped). */
export function secretList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function signImportIdentity(args: {
  issuer: string;
  audience: string;
  email: string;
  secret: string;
  now?: Date;
}): string {
  const iat = Math.floor((args.now ?? new Date()).getTime() / 1000);
  const payload = {
    iss: args.issuer,
    aud: args.audience,
    sub: normalizeIdentityEmail(args.email),
    iat,
    exp: iat + IMPORT_IDENTITY_MAX_LIFETIME_S,
    jti: randomBytes(16).toString("base64url"),
  };
  const signingInput = `${HEADER_B64}.${base64url(JSON.stringify(payload))}`;
  return `${signingInput}.${hmac(args.secret, signingInput)}`;
}

export type ImportIdentityResult =
  | { ok: true; email: string; issuer: string }
  | { ok: false; reason: string };

function parseJson(part: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function verifyImportIdentity(
  token: string,
  opts: { secrets: readonly string[]; audience: string; issuers: readonly string[]; now?: Date },
): ImportIdentityResult {
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((p) => !/^[A-Za-z0-9_-]+$/.test(p))) {
    return { ok: false, reason: "malformed" };
  }
  const [h, p, sig] = parts as [string, string, string];

  const header = parseJson(h);
  if (!header || header.alg !== "HS256") return { ok: false, reason: "algorithm" };

  // Compare against every configured secret, so the time taken does not
  // reveal which one matched.
  let signed = false;
  for (const secret of opts.secrets) {
    if (safeEqual(sig, hmac(secret, `${h}.${p}`))) signed = true;
  }
  if (!signed) return { ok: false, reason: "signature" };

  const claims = parseJson(p);
  if (!claims) return { ok: false, reason: "malformed" };
  const { iss, aud, sub, iat, exp, jti } = claims;
  if (typeof iss !== "string" || !opts.issuers.includes(iss)) return { ok: false, reason: "issuer" };
  if (aud !== opts.audience) return { ok: false, reason: "audience" };
  if (typeof sub !== "string" || !sub.includes("@")) return { ok: false, reason: "subject" };
  if (typeof jti !== "string" || jti.length === 0) return { ok: false, reason: "jti" };
  if (typeof iat !== "number" || typeof exp !== "number") return { ok: false, reason: "times" };
  if (exp <= iat || exp - iat > IMPORT_IDENTITY_MAX_LIFETIME_S) return { ok: false, reason: "lifetime" };

  const now = Math.floor((opts.now ?? new Date()).getTime() / 1000);
  if (iat > now + IMPORT_IDENTITY_CLOCK_TOLERANCE_S) return { ok: false, reason: "not_yet_valid" };
  if (now > exp + IMPORT_IDENTITY_CLOCK_TOLERANCE_S) return { ok: false, reason: "expired" };

  return { ok: true, email: normalizeIdentityEmail(sub), issuer: iss };
}
