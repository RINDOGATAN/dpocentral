/**
 * Hermetic unit tests for the cross-app portfolio import route (Part B).
 * Prisma and JIT provisioning are module-mocked — no database, no network.
 *
 * Asserts the contract of POST /api/import/portfolio-vendors:
 *  - x-api-key is validated against DPC_IMPORT_API_KEYS;
 *  - the user is resolved (or JIT-minted) by email;
 *  - each vendor is upserted into the `portfolio_vendors` staging table
 *    keyed by [accountId, vendorSlug], with created vs updated counted.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────
const upsert = vi.fn();
const findUnique = vi.fn();
const ensureDpoUser = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vwPortfolioVendor: {
      upsert: (...args: unknown[]) => upsert(...args),
      findUnique: (...args: unknown[]) => findUnique(...args),
    },
  },
}));

vi.mock("@/lib/jit-provisioning", () => ({
  ensureDpoUser: (...args: unknown[]) => ensureDpoUser(...args),
}));

import { POST } from "@/app/api/import/portfolio-vendors/route";

function makeRequest(body: unknown, apiKey: string | null = "secret-key") {
  return new Request("http://localhost/api/import/portfolio-vendors", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { "x-api-key": apiKey } : {}),
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.DPC_IMPORT_API_KEYS = "secret-key, other-key";
  ensureDpoUser.mockResolvedValue({ id: "dpo-user-1" });
  findUnique.mockResolvedValue(null);
  upsert.mockResolvedValue({ id: "pv-1" });
});

describe("POST /api/import/portfolio-vendors", () => {
  it("rejects a request with no/invalid x-api-key", async () => {
    const res = await POST(makeRequest({ userEmail: "a@b.com", vendors: [] }, null));
    expect(res.status).toBe(401);
    expect(ensureDpoUser).not.toHaveBeenCalled();
  });

  it("400s when userEmail is missing", async () => {
    const res = await POST(makeRequest({ vendors: [{ slug: "x" }] }));
    expect(res.status).toBe(400);
  });

  it("400s when vendors is empty", async () => {
    const res = await POST(makeRequest({ userEmail: "a@b.com", vendors: [] }));
    expect(res.status).toBe(400);
  });

  it("resolves the user by email via JIT and upserts new vendors keyed to the user id", async () => {
    const res = await POST(
      makeRequest({
        userEmail: "sso@example.com",
        vendors: [
          {
            slug: "acme",
            criticality: "HIGH",
            dataCategories: ["IDENTIFIERS"],
            purposes: ["analytics"],
          },
        ],
      })
    );

    expect(ensureDpoUser).toHaveBeenCalledWith(expect.anything(), {
      email: "sso@example.com",
    });

    const upsertArg = upsert.mock.calls[0][0];
    expect(upsertArg.where).toEqual({
      accountId_vendorSlug: { accountId: "dpo-user-1", vendorSlug: "acme" },
    });
    expect(upsertArg.create).toEqual({
      accountId: "dpo-user-1",
      vendorSlug: "acme",
      criticality: "HIGH",
      dataCategories: ["IDENTIFIERS"],
      purposes: ["analytics"],
    });
    expect(upsertArg.update).toEqual({
      criticality: "HIGH",
      dataCategories: ["IDENTIFIERS"],
      purposes: ["analytics"],
    });

    const json = await res.json();
    expect(json).toEqual({ exported: 1, alreadyExisted: 0, skipped: 0 });
  });

  it("counts an existing staged row as alreadyExisted (idempotent re-export)", async () => {
    findUnique.mockResolvedValue({ id: "pv-existing" });

    const res = await POST(
      makeRequest({
        userEmail: "sso@example.com",
        vendors: [{ slug: "acme" }],
      })
    );

    // Defaults applied for a bare payload.
    const upsertArg = upsert.mock.calls[0][0];
    expect(upsertArg.create).toEqual({
      accountId: "dpo-user-1",
      vendorSlug: "acme",
      criticality: "medium",
      dataCategories: [],
      purposes: [],
    });

    const json = await res.json();
    expect(json).toEqual({ exported: 0, alreadyExisted: 1, skipped: 0 });
  });

  it("skips rows without a slug and still processes the rest", async () => {
    const res = await POST(
      makeRequest({
        userEmail: "sso@example.com",
        vendors: [{ criticality: "LOW" } as unknown as { slug: string }, { slug: "acme" }],
      })
    );

    expect(upsert).toHaveBeenCalledTimes(1);
    const json = await res.json();
    expect(json).toEqual({ exported: 1, alreadyExisted: 0, skipped: 1 });
  });
});
