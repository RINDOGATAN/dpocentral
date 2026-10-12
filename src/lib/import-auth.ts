// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Shared-secret auth for DPO Central's cross-app import API.
 *
 * A sibling todo.law app (vendor.watch) pushes a user's portfolio to DPO
 * over HTTP, never through a shared database. Requests carry an `x-api-key`
 * header that must match one of the comma-separated keys in
 * `DPC_IMPORT_API_KEYS`. The comparison is constant-time across every
 * configured key (src/lib/safe-equal.ts). The routes themselves are
 * rate-limited per client address in src/middleware.ts ("import" bucket).
 *
 * The key identifies the calling application. The person the call is made
 * for is identified by a signed statement (checkImportIdentity below,
 * src/lib/import-identity.ts).
 */

import { NextResponse } from "next/server";
import { safeEqualAny } from "@/lib/safe-equal";
import { logger } from "@/lib/logger";
import {
  IMPORT_IDENTITY_HEADER,
  normalizeIdentityEmail,
  secretList,
  verifyImportIdentity,
} from "@/lib/import-identity";

export function validateImportApiKey(request: Request): boolean {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) return false;

  const validKeys = (process.env.DPC_IMPORT_API_KEYS ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  if (validKeys.length === 0) return false;
  return safeEqualAny(apiKey, validKeys);
}

// ── Signed identity of the person (x-import-identity) ───────────────────────

const IMPORT_IDENTITY_AUDIENCE = "dpocentral-import";
const IMPORT_IDENTITY_ISSUERS = ["vendorwatch"] as const;

let loggedNotConfigured = false;

function identityRefusal(status: 401 | 403, error: string): Response {
  return NextResponse.json({ error }, { status });
}

/**
 * The one identity decision every /api/import/* route takes, after the key
 * check and once it knows which account the body names.
 *
 *  - No IMPORT_IDENTITY_SECRETS configured: the header is ignored and the
 *    route behaves as before (the key alone).
 *  - Header present: it must verify (401 otherwise) and its subject must be
 *    the account the body names (403 otherwise).
 *  - Header absent: accepted as before, unless IMPORT_IDENTITY_REQUIRED is
 *    "true" (401).
 *
 * Returns a Response to send back, or null to carry on.
 */
export function checkImportIdentity(request: Request, accountEmail: string): Response | null {
  const secrets = secretList(process.env.IMPORT_IDENTITY_SECRETS);
  if (secrets.length === 0) {
    if (!loggedNotConfigured) {
      loggedNotConfigured = true;
      logger.info("Import identity verification is not configured; the import key alone is checked");
    }
    return null;
  }

  const token = request.headers.get(IMPORT_IDENTITY_HEADER);
  if (!token) {
    if (process.env.IMPORT_IDENTITY_REQUIRED === "true") {
      return identityRefusal(401, "Identity statement required");
    }
    return null;
  }

  const result = verifyImportIdentity(token, {
    secrets,
    audience: IMPORT_IDENTITY_AUDIENCE,
    issuers: IMPORT_IDENTITY_ISSUERS,
  });
  if (!result.ok) return identityRefusal(401, "Invalid identity statement");
  if (result.email !== normalizeIdentityEmail(accountEmail)) {
    return identityRefusal(403, "Identity does not match the account");
  }
  return null;
}
