// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The directory of people available for technical help lists exactly one
 * person (owner's decision, 2026-09-20). No invented person may reach a user.
 *
 * These tests cover both sources the directory can be served from:
 *   - the local list, when no directory service is configured;
 *   - the upstream directory service, which is filtered at the point it is
 *     read, so a name added upstream cannot appear here.
 *
 * The local list is also checked for the shape of invented data the file used
 * to carry: reserved `.example` addresses and profiles marked "fictional".
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  searchExperts,
  getExpertById,
  isPermittedExpert,
  type ExpertProfile,
} from "@/server/services/dealroom/client";
import { directoryExperts } from "@/server/services/dealroom/directory-data";

/** A profile shaped like anything an upstream directory might return. */
function profile(over: Partial<ExpertProfile> & { name: string | null }): ExpertProfile {
  return {
    id: "upstream-1",
    email: null,
    title: null,
    firm: null,
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
    profileCompleteness: 50,
    ...over,
  };
}

const permittedName = directoryExperts[0].name!;

describe("the local directory list", () => {
  it("holds exactly one person", () => {
    expect(directoryExperts).toHaveLength(1);
  });

  it("carries no reserved .example address and no profile marked fictional", () => {
    const text = JSON.stringify(directoryExperts).toLowerCase();
    expect(text).not.toContain(".example");
    expect(text).not.toContain("fictional");
  });

  it("leaves the contact address unset rather than inventing one", () => {
    expect(directoryExperts[0].email).toBeNull();
  });

  it("is itself subject to the allow-list", () => {
    expect(directoryExperts.every(isPermittedExpert)).toBe(true);
  });
});

describe("the allow-list", () => {
  it("permits the one person, whatever the spacing or case", () => {
    expect(isPermittedExpert(profile({ name: permittedName }))).toBe(true);
    expect(isPermittedExpert(profile({ name: permittedName.toUpperCase() }))).toBe(true);
    expect(isPermittedExpert(profile({ name: `  ${permittedName}  ` }))).toBe(true);
  });

  it("permits nobody else, including plausible real-looking names", () => {
    expect(isPermittedExpert(profile({ name: "Dana Okoro" }))).toBe(false);
    expect(isPermittedExpert(profile({ name: null }))).toBe(false);
    expect(isPermittedExpert(profile({ name: "" }))).toBe(false);
  });
});

describe("with no directory service configured", () => {
  it("serves the one permitted person and nobody else", async () => {
    const result = await searchExperts({});
    expect(result.results.map((e) => e.name)).toEqual([permittedName]);
    expect(result.total).toBe(1);
  });

  it("resolves that person by id, and no one else", async () => {
    await expect(getExpertById(directoryExperts[0].id)).resolves.toMatchObject({
      name: permittedName,
    });
    await expect(getExpertById("someone-else")).resolves.toBeNull();
  });
});

describe("with a directory service configured", () => {
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

  it("drops upstream people who are not on the allow-list", async () => {
    const { searchExperts: search } = await configuredClient();
    respond({
      results: [
        profile({ id: "u1", name: "Dana Okoro", firm: "Okoro Privacy" }),
        profile({ id: "u2", name: permittedName }),
        profile({ id: "u3", name: "Lars Henriksen" }),
      ],
      total: 3,
      offset: 0,
    });

    const result = await search({});
    expect(result.results.map((e) => e.name)).toEqual([permittedName]);
    expect(result.total).toBe(1);
  });

  it("shows nobody rather than an unpermitted person, even alone", async () => {
    const { searchExperts: search } = await configuredClient();
    respond({
      results: [profile({ id: "u9", name: "Dana Okoro" })],
      total: 1,
      offset: 9,
    });

    const result = await search({ offset: 20 });
    expect(result.results).toEqual([]);
  });

  it("falls back to the local list when the upstream first page has nobody permitted", async () => {
    const { searchExperts: search } = await configuredClient();
    respond({ results: [profile({ id: "u9", name: "Dana Okoro" })], total: 1, offset: 0 });

    const result = await search({});
    expect(result.results.map((e) => e.name)).toEqual([permittedName]);
  });

  it("falls back to the local list when the upstream call fails", async () => {
    const { searchExperts: search } = await configuredClient();
    fetchMock.mockResolvedValue({ ok: false, status: 503, text: async () => "down" });

    const result = await search({});
    expect(result.results.map((e) => e.name)).toEqual([permittedName]);
  });

  it("refuses to resolve an unpermitted upstream id to a profile", async () => {
    const { getExpertById: byId } = await configuredClient();
    respond(profile({ id: "u1", name: "Dana Okoro" }));

    await expect(byId("u1")).resolves.toBeNull();
  });
});
