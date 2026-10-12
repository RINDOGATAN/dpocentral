// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyImportIdentity } from "@/lib/import-identity";

// Calls to AI Sentinel's import routes carry a signed statement of the person
// once AI_SENTINEL_IDENTITY_SECRET is configured, and are unchanged before.
describe("AI Sentinel client identity statement", () => {
  let headers: Record<string, string>[];

  beforeEach(() => {
    vi.resetModules();
    headers = [];
    vi.stubEnv("AI_SENTINEL_API_URL", "https://ais.test");
    vi.stubEnv("AI_SENTINEL_API_KEY", "app-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        headers.push(init.headers as Record<string, string>);
        return new Response(JSON.stringify({ mapped: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  async function callAll() {
    const client = await import("@/server/services/ai-sentinel/client");
    await client.checkAiSentinelAccount("Person@Example.com");
    await client.exportAISystems("Person@Example.com", []);
    await client.getAiSentinelSystemStatus("Person@Example.com", "sys-1");
  }

  it("sends no statement while the secret is not configured", async () => {
    vi.stubEnv("AI_SENTINEL_IDENTITY_SECRET", "");
    await callAll();
    expect(headers).toHaveLength(3);
    for (const h of headers) {
      expect(h).toEqual({ "x-api-key": "app-key", "Content-Type": "application/json" });
    }
  });

  it("signs a statement for AI Sentinel naming the person on every call", async () => {
    vi.stubEnv("AI_SENTINEL_IDENTITY_SECRET", "caller-secret");
    await callAll();
    expect(headers).toHaveLength(3);
    for (const h of headers) {
      expect(h["x-api-key"]).toBe("app-key");
      const result = verifyImportIdentity(h["x-import-identity"]!, {
        secrets: ["caller-secret"],
        audience: "aisentinel-import",
        issuers: ["dpocentral"],
      });
      expect(result).toEqual({ ok: true, email: "person@example.com", issuer: "dpocentral" });
    }
  });

  it("names no one when there is no e-mail", async () => {
    vi.stubEnv("AI_SENTINEL_IDENTITY_SECRET", "caller-secret");
    const client = await import("@/server/services/ai-sentinel/client");
    expect(client.aiSentinelHeaders("  ")).not.toHaveProperty("x-import-identity");
  });
});
