// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * AI Sentinel REST API Client
 *
 * Follows the Dealroom client pattern: env var check, isConfigured(),
 * graceful no-op when not configured.
 *
 * Auth: x-api-key header (same as VW → AIS, validated against VW_IMPORT_API_KEYS on AIS side)
 * identifies this application. When AI_SENTINEL_IDENTITY_SECRET is set, each
 * call also carries x-import-identity: a five-minute signed statement of the
 * signed-in person (src/lib/import-identity.ts). Every caller passes the
 * e-mail of the server-side session (src/server/routers/privacy/aiGovernance.ts).
 */

import { logger } from "@/lib/logger";
import { IMPORT_IDENTITY_HEADER, signImportIdentity } from "@/lib/import-identity";
import type {
  DPCSystemPayload,
  ExportResult,
  CheckAccountResult,
  AiSentinelSystemStatus,
} from "./types";

const AI_SENTINEL_API_URL = process.env.AI_SENTINEL_API_URL;
const AI_SENTINEL_API_KEY = process.env.AI_SENTINEL_API_KEY;

/** Issuer and audience of the identity statement sent to AI Sentinel. */
const IDENTITY_ISSUER = "dpocentral";
const IDENTITY_AUDIENCE = "aisentinel-import";

/**
 * Request headers for an AI Sentinel import call made for `userEmail`.
 * The identity statement is added only when the secret is configured (read
 * at call time) and there is a person to name; otherwise the call is sent
 * exactly as before.
 */
export function aiSentinelHeaders(userEmail: string): Record<string, string> {
  const headers: Record<string, string> = {
    "x-api-key": AI_SENTINEL_API_KEY ?? "",
    "Content-Type": "application/json",
  };
  const secret = process.env.AI_SENTINEL_IDENTITY_SECRET?.trim();
  if (secret && userEmail.trim()) {
    headers[IMPORT_IDENTITY_HEADER] = signImportIdentity({
      issuer: IDENTITY_ISSUER,
      audience: IDENTITY_AUDIENCE,
      email: userEmail,
      secret,
    });
  }
  return headers;
}

/**
 * Whether the AI Sentinel integration is configured (env vars present).
 */
export function isAiSentinelConfigured(): boolean {
  return !!(AI_SENTINEL_API_URL && AI_SENTINEL_API_KEY);
}

/**
 * Check if a user has an AI Sentinel account and organization.
 */
export async function checkAiSentinelAccount(
  email: string,
): Promise<CheckAccountResult> {
  if (!isAiSentinelConfigured()) {
    return { hasAccount: false, hasOrg: false };
  }

  try {
    const res = await fetch(`${AI_SENTINEL_API_URL}/api/import/check-account`, {
      method: "POST",
      headers: aiSentinelHeaders(email),
      // AI Sentinel's import routes all take the account as `userEmail`.
      body: JSON.stringify({ userEmail: email }),
    });

    if (!res.ok) {
      logger.error("AI Sentinel check-account failed", undefined, { status: res.status });
      return { hasAccount: false, hasOrg: false };
    }

    return res.json();
  } catch (error) {
    logger.error("AI Sentinel check-account error", error instanceof Error ? error : undefined);
    return { hasAccount: false, hasOrg: false };
  }
}

/**
 * Export DPC AI Systems to AI Sentinel.
 * Calls AIS POST /api/import/dpc-ai-systems
 */
export async function exportAISystems(
  userEmail: string,
  systems: DPCSystemPayload[],
): Promise<ExportResult> {
  if (!isAiSentinelConfigured()) {
    return { exported: 0, alreadyExisted: 0, skipped: systems.length, mapped: [] };
  }

  try {
    const res = await fetch(`${AI_SENTINEL_API_URL}/api/import/dpc-ai-systems`, {
      method: "POST",
      headers: aiSentinelHeaders(userEmail),
      body: JSON.stringify({ userEmail, systems }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      logger.error("AI Sentinel export failed", undefined, { status: res.status, body: text });
      return { exported: 0, alreadyExisted: 0, skipped: systems.length, mapped: [] };
    }

    return res.json();
  } catch (error) {
    logger.error("AI Sentinel export error", error instanceof Error ? error : undefined);
    return { exported: 0, alreadyExisted: 0, skipped: systems.length, mapped: [] };
  }
}

/**
 * Fetch the AI-Act status summary of a linked AI Sentinel system.
 * Returns null when the integration is not configured or unreachable, so the
 * caller can simply not render the panel.
 */
export async function getAiSentinelSystemStatus(
  userEmail: string,
  aisSystemId: string,
): Promise<AiSentinelSystemStatus | null> {
  if (!isAiSentinelConfigured()) {
    return null;
  }

  try {
    const res = await fetch(`${AI_SENTINEL_API_URL}/api/import/ai-system-status`, {
      method: "POST",
      headers: aiSentinelHeaders(userEmail),
      body: JSON.stringify({ userEmail, aisSystemId }),
    });

    if (!res.ok) {
      logger.error("AI Sentinel system-status failed", undefined, { status: res.status });
      return null;
    }

    return res.json();
  } catch (error) {
    logger.error("AI Sentinel system-status error", error instanceof Error ? error : undefined);
    return null;
  }
}
