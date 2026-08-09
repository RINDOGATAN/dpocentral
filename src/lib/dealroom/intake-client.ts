// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Dealroom intake client.
 *
 * Configuration (server-side env):
 *   DEALROOM_URL      — Dealroom origin. On the self-hosted suite this is
 *                       http://localhost:8486 (the suite default).
 *   DEALROOM_API_KEY  — a drk_ agent API key minted in Dealroom's admin
 *                       (/admin/customers) with scopes: negotiate, deals:read.
 *
 * All calls are server-to-server; the key must never reach a browser.
 */

import type {
  DealroomFactPackage,
  DealroomIntakeResponse,
} from "./intake-types";

function config() {
  const baseUrl = process.env.DEALROOM_URL || "http://localhost:8486";
  const apiKey = process.env.DEALROOM_API_KEY;
  if (!apiKey) {
    throw new Error(
      "DEALROOM_API_KEY is not set — mint a drk_ key in Dealroom (/admin/customers) with scopes negotiate + deals:read",
    );
  }
  return { baseUrl: baseUrl.replace(/\/$/, ""), apiKey };
}

/**
 * Create an agreed SOLO deal in Dealroom from a fact package.
 * Pass an idempotencyKey (e.g. derived from your own record id) so retries
 * never create duplicate deals — replays return the original response with
 * an `Idempotent-Replay: true` header.
 */
export async function createDealroomDeal(
  pkg: DealroomFactPackage,
  opts?: { idempotencyKey?: string; fetchImpl?: typeof fetch },
): Promise<DealroomIntakeResponse> {
  const { baseUrl, apiKey } = config();
  const doFetch = opts?.fetchImpl ?? fetch;
  const res = await doFetch(`${baseUrl}/api/v1/agent/deals`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(opts?.idempotencyKey
        ? { "Idempotency-Key": opts.idempotencyKey }
        : {}),
    },
    body: JSON.stringify(pkg),
  });
  const body = (await res.json()) as DealroomIntakeResponse & {
    error?: string;
    details?: unknown;
  };
  if (!res.ok) {
    throw new Error(
      `Dealroom intake failed (${res.status}): ${body.error ?? "unknown error"}` +
        (body.details ? ` — ${JSON.stringify(body.details)}` : ""),
    );
  }
  return body;
}

/**
 * Download a generated document (the paths come from the intake response's
 * `documents` object). Returns the raw bytes; `whiteLabel` strips Dealroom
 * branding for signature-ready finals.
 */
export async function downloadDealroomDocument(
  documentPath: string,
  opts?: { whiteLabel?: boolean; fetchImpl?: typeof fetch },
): Promise<ArrayBuffer> {
  const { baseUrl, apiKey } = config();
  const doFetch = opts?.fetchImpl ?? fetch;
  const url = new URL(`${baseUrl}${documentPath}`);
  if (opts?.whiteLabel) url.searchParams.set("whitelabel", "1");
  const res = await doFetch(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Dealroom document download failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.arrayBuffer();
}
