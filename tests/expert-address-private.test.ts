// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The address of the person listed for technical help stays private.
 *
 * It is ours to hold, so we can contact them ourselves, and never ours to
 * hand out: no card, no detail panel, no export and no API response may carry
 * it. This file covers the directory reads, with an upstream record that
 * deliberately carries an address, since the one local entry has none on
 * file. What the contact mutation does with that address — stores it, mails
 * nothing to it — is in tests/expert-request-routing.test.ts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import type { ExpertProfile } from "@/server/services/dealroom/client";
import { directoryExperts } from "@/server/services/dealroom/directory-data";

const THE_ADDRESS = "private-address@example.test";
const permittedName = directoryExperts[0].name!;

/** The permitted person, as an upstream directory might hold them. */
function upstreamProfile(): ExpertProfile {
  return {
    id: "upstream-1",
    name: permittedName,
    email: THE_ADDRESS,
    title: null,
    firm: "A Firm",
    bio: null,
    expertTypes: ["technical"],
    specializations: [],
    certifications: [],
    languages: ["en"],
    location: { city: null, country: null },
    jurisdictions: [],
    contactUrl: null,
    imageUrl: null,
    acceptingClients: true,
    profileCompleteness: 60,
  };
}

describe("the one local entry", () => {
  it("carries no address to leak", () => {
    expect(directoryExperts[0].email).toBeNull();
  });
});

describe("what the directory hands to a client", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("DEALROOM_API_URL", "https://directory.test");
    vi.stubEnv("DEALROOM_API_KEY", "test-key");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  /** Re-import after the env is stubbed: the module reads it at load time. */
  async function configuredClient() {
    return import("@/server/services/dealroom/client");
  }

  function respond(body: unknown) {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => body,
      text: async () => JSON.stringify(body),
    });
  }

  it("drops the address from every profile in a search", async () => {
    const { searchExperts } = await configuredClient();
    respond({ results: [upstreamProfile()], total: 1, offset: 0 });

    const result = await searchExperts({});
    expect(result.results).toHaveLength(1);
    expect(result.results[0].name).toBe(permittedName);
    expect(JSON.stringify(result)).not.toContain(THE_ADDRESS);
    expect(Object.keys(result.results[0])).not.toContain("email");
  });

  it("drops the address from a profile looked up by id", async () => {
    const { getExpertById } = await configuredClient();
    respond(upstreamProfile());

    const profile = await getExpertById("upstream-1");
    expect(profile).not.toBeNull();
    expect(JSON.stringify(profile)).not.toContain(THE_ADDRESS);
    expect(Object.keys(profile!)).not.toContain("email");
  });

  it("keeps the address on the full record, which is ours alone", async () => {
    const { getExpertRecord } = await configuredClient();
    respond(upstreamProfile());

    await expect(getExpertRecord("upstream-1")).resolves.toMatchObject({
      email: THE_ADDRESS,
    });
  });
});
