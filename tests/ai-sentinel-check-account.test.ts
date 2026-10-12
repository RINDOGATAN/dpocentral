// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// AI Sentinel's /api/import/check-account reads `userEmail` (the same field as
// its other import routes and as the VendorWatch caller). A body with any
// other key is refused with a 400, which the client reports as "no account".
describe("checkAiSentinelAccount request body", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("AI_SENTINEL_API_URL", "https://ais.test");
    vi.stubEnv("AI_SENTINEL_API_KEY", "test-key");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sends the account as userEmail", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ hasAccount: true, hasOrg: true, orgId: "o1", orgName: "Org" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { checkAiSentinelAccount } = await import("@/server/services/ai-sentinel/client");

    const result = await checkAiSentinelAccount("person@example.com");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://ais.test/api/import/check-account");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({ userEmail: "person@example.com" });
    expect(body).not.toHaveProperty("email");
    expect(result).toMatchObject({ hasAccount: true, hasOrg: true });
  });

  it("uses the same field as the export calls", async () => {
    const bodies: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        bodies.push(JSON.parse(init.body as string));
        return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
      }),
    );
    const client = await import("@/server/services/ai-sentinel/client");
    await client.checkAiSentinelAccount("person@example.com");
    await client.exportAISystems("person@example.com", []);
    expect(bodies[0]).toHaveProperty("userEmail", "person@example.com");
    expect(bodies[1]).toHaveProperty("userEmail", "person@example.com");
  });
});
