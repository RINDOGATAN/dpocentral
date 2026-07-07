// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Shared-secret auth for DPO Central's cross-app import API.
 *
 * A sibling todo.law app (vendor.watch) pushes a user's portfolio to DPO
 * over HTTP, never through a shared database. Requests carry an `x-api-key`
 * header that must match one of the comma-separated keys in
 * `DPC_IMPORT_API_KEYS`. Mirrors AI Sentinel's import-auth exactly.
 */
export function validateImportApiKey(request: Request): boolean {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) return false;

  const validKeys = (process.env.DPC_IMPORT_API_KEYS ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  return validKeys.includes(apiKey);
}
