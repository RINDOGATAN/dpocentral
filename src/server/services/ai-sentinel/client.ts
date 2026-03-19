/**
 * AI Sentinel REST API Client
 *
 * Follows the Dealroom client pattern: env var check, isConfigured(),
 * graceful no-op when not configured.
 *
 * Auth: x-api-key header (same as VW → AIS, validated against VW_IMPORT_API_KEYS on AIS side).
 */

import { logger } from "@/lib/logger";
import type { DPCSystemPayload, ExportResult, CheckAccountResult } from "./types";

const AI_SENTINEL_API_URL = process.env.AI_SENTINEL_API_URL;
const AI_SENTINEL_API_KEY = process.env.AI_SENTINEL_API_KEY;

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
      headers: {
        "x-api-key": AI_SENTINEL_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
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
      headers: {
        "x-api-key": AI_SENTINEL_API_KEY!,
        "Content-Type": "application/json",
      },
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
