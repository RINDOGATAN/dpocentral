// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The identity decision on DPO Central's /api/import/* routes, run through
 * the real route handlers over a module-mocked Prisma.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const userFindUnique = vi.fn();
const pvFindUnique = vi.fn();
const upsert = vi.fn();
const ensureDpoUser = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
    vwPortfolioVendor: {
      findUnique: (...a: unknown[]) => pvFindUnique(...a),
      upsert: (...a: unknown[]) => upsert(...a),
    },
  },
}));
vi.mock("@/lib/jit-provisioning", () => ({
  ensureDpoUser: (...a: unknown[]) => ensureDpoUser(...a),
}));

import { POST as checkAccount } from "@/app/api/import/check-account/route";
import { POST as portfolioVendors } from "@/app/api/import/portfolio-vendors/route";
import { signImportIdentity } from "@/lib/import-identity";

const SECRET = "receiver-secret";

function token(email = "person@example.com", overrides: Partial<{ secret: string; audience: string; issuer: string }> = {}) {
  return signImportIdentity({
    issuer: overrides.issuer ?? "vendorwatch",
    audience: overrides.audience ?? "dpocentral-import",
    email,
    secret: overrides.secret ?? SECRET,
  });
}

function req(path: string, body: unknown, identity?: string) {
  return new Request(`http://localhost/api/import/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": "app-key",
      ...(identity ? { "x-import-identity": identity } : {}),
    },
    body: JSON.stringify(body),
  });
}

const routes = [
  { name: "check-account", call: checkAccount, body: { userEmail: "Person@Example.com" } },
  { name: "portfolio-vendors", call: portfolioVendors, body: { userEmail: "Person@Example.com", vendors: [{ slug: "v1" }] } },
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("DPC_IMPORT_API_KEYS", "app-key");
  userFindUnique.mockResolvedValue(null);
  ensureDpoUser.mockResolvedValue({ id: "u1" });
  pvFindUnique.mockResolvedValue(null);
  upsert.mockResolvedValue({ id: "pv1" });
});
afterEach(() => vi.unstubAllEnvs());

describe.each(routes)("$name identity guard", ({ name, call, body }) => {
  it("keeps today's behaviour when no receiver secret is configured", async () => {
    vi.stubEnv("IMPORT_IDENTITY_SECRETS", "");
    expect((await call(req(name, body))).status).toBe(200);
    // A header cannot be checked without a secret, so it is ignored.
    expect((await call(req(name, body, "not.a.token"))).status).toBe(200);
  });

  it("accepts a call without a statement while it is not required", async () => {
    vi.stubEnv("IMPORT_IDENTITY_SECRETS", SECRET);
    expect((await call(req(name, body))).status).toBe(200);
  });

  it("refuses a call without a statement once required", async () => {
    vi.stubEnv("IMPORT_IDENTITY_SECRETS", SECRET);
    vi.stubEnv("IMPORT_IDENTITY_REQUIRED", "true");
    const res = await call(req(name, body));
    expect(res.status).toBe(401);
    expect(userFindUnique).not.toHaveBeenCalled();
    expect(ensureDpoUser).not.toHaveBeenCalled();
  });

  it("accepts a valid statement for the named account (case-insensitive)", async () => {
    vi.stubEnv("IMPORT_IDENTITY_SECRETS", `old, ${SECRET}`);
    vi.stubEnv("IMPORT_IDENTITY_REQUIRED", "true");
    expect((await call(req(name, body, token()))).status).toBe(200);
  });

  it("refuses an invalid statement with 401", async () => {
    vi.stubEnv("IMPORT_IDENTITY_SECRETS", SECRET);
    for (const bad of [token("person@example.com", { secret: "x" }), token("person@example.com", { audience: "aisentinel-import" }), token("person@example.com", { issuer: "dpocentral" }), "garbage"]) {
      const res = await call(req(name, body, bad));
      expect(res.status).toBe(401);
    }
    expect(userFindUnique).not.toHaveBeenCalled();
    expect(ensureDpoUser).not.toHaveBeenCalled();
  });

  it("refuses a statement for another person with 403", async () => {
    vi.stubEnv("IMPORT_IDENTITY_SECRETS", SECRET);
    const res = await call(req(name, body, token("someone.else@example.com")));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Identity does not match the account" });
    expect(userFindUnique).not.toHaveBeenCalled();
    expect(ensureDpoUser).not.toHaveBeenCalled();
  });

  it("still checks the application key first", async () => {
    vi.stubEnv("IMPORT_IDENTITY_SECRETS", SECRET);
    const r = new Request(`http://localhost/api/import/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-import-identity": token() },
      body: JSON.stringify(body),
    });
    expect((await call(r)).status).toBe(401);
  });
});
