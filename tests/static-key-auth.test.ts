/**
 * Static-key routes compare their secret in constant time
 * (src/lib/safe-equal.ts) and fail closed when unconfigured.
 *
 * Covers: safeEqual / safeEqualAny semantics; the import key check across
 * a key list; GET /api/cron/dsar-redaction (503 unconfigured, 401 wrong or
 * missing bearer, 200 with the secret); POST /api/admin/sync-templates
 * (500 unconfigured, 401 wrong key, 200 with the key). Prisma is mocked.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  organizationFindMany: vi.fn(),
  templateFindUnique: vi.fn(),
  templateCreate: vi.fn(),
  templateUpdate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const prisma = {
    organization: { findMany: (...a: unknown[]) => mocks.organizationFindMany(...a) },
    assessmentTemplate: {
      findUnique: (...a: unknown[]) => mocks.templateFindUnique(...a),
      create: (...a: unknown[]) => mocks.templateCreate(...a),
      update: (...a: unknown[]) => mocks.templateUpdate(...a),
    },
  };
  return { default: prisma, prisma };
});
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@prisma/client", () => ({ AssessmentType: {} }));

import { safeEqual, safeEqualAny } from "@/lib/safe-equal";
import { validateImportApiKey } from "@/lib/import-auth";
import { GET as cronGet } from "@/app/api/cron/dsar-redaction/route";
import { NextRequest } from "next/server";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.organizationFindMany.mockResolvedValue([]);
  mocks.templateFindUnique.mockResolvedValue(null);
  mocks.templateCreate.mockResolvedValue({});
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("safeEqual", () => {
  it("accepts identical strings and rejects different ones of any length", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "ab")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
    expect(safeEqual("", "x")).toBe(false);
    expect(safeEqual("ünï", "ünï")).toBe(true);
  });

  it("safeEqualAny matches against any entry and never against an empty list", () => {
    expect(safeEqualAny("k2", ["k1", "k2", "k3"])).toBe(true);
    expect(safeEqualAny("k9", ["k1", "k2", "k3"])).toBe(false);
    expect(safeEqualAny("k1", [])).toBe(false);
  });
});

describe("validateImportApiKey", () => {
  function withKey(key: string | null) {
    return new Request("http://localhost/api/import/check-account", {
      method: "POST",
      headers: key ? { "x-api-key": key } : {},
    });
  }

  it("accepts any configured key, trimmed, and rejects the rest", () => {
    vi.stubEnv("DPC_IMPORT_API_KEYS", " first-key ,second-key");
    expect(validateImportApiKey(withKey("first-key"))).toBe(true);
    expect(validateImportApiKey(withKey("second-key"))).toBe(true);
    expect(validateImportApiKey(withKey("second-kex"))).toBe(false); // same length, one byte off
    expect(validateImportApiKey(withKey("second"))).toBe(false);
    expect(validateImportApiKey(withKey(null))).toBe(false);
  });

  it("rejects everything when no key is configured (fail closed)", () => {
    vi.stubEnv("DPC_IMPORT_API_KEYS", "");
    expect(validateImportApiKey(withKey(""))).toBe(false);
    expect(validateImportApiKey(withKey("anything"))).toBe(false);
  });
});

describe("GET /api/cron/dsar-redaction", () => {
  function cronReq(auth?: string) {
    return new Request("http://localhost/api/cron/dsar-redaction", {
      headers: auth ? { authorization: auth } : {},
    });
  }

  it("refuses to run (503) when CRON_SECRET is unset", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = await cronGet(cronReq("Bearer whatever"));
    expect(res.status).toBe(503);
    expect(mocks.organizationFindMany).not.toHaveBeenCalled();
  });

  it("returns 401 on a missing, wrong, or same-length wrong bearer", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret-value");
    expect((await cronGet(cronReq())).status).toBe(401);
    expect((await cronGet(cronReq("Bearer nope"))).status).toBe(401);
    expect((await cronGet(cronReq("Bearer s3cret-valuf"))).status).toBe(401);
    expect((await cronGet(cronReq("s3cret-value"))).status).toBe(401);
    expect(mocks.organizationFindMany).not.toHaveBeenCalled();
  });

  it("runs with the right bearer", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret-value");
    const res = await cronGet(cronReq("Bearer s3cret-value"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      success: true,
      summary: { dsarRedacted: 0, errors: 0 },
    });
    expect(mocks.organizationFindMany).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/admin/sync-templates", () => {
  async function loadRoute() {
    // The route reads TEMPLATE_SYNC_API_KEY at module load; re-import per case.
    vi.resetModules();
    return (await import("@/app/api/admin/sync-templates/route")).POST;
  }

  function syncReq(key: string | null, body: unknown = { templates: [] }) {
    return new NextRequest("http://localhost/api/admin/sync-templates", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(key ? { "x-api-key": key } : {}),
      },
      body: JSON.stringify(body),
    });
  }

  it("answers 500 when the key is not configured, never touching the database", async () => {
    vi.stubEnv("TEMPLATE_SYNC_API_KEY", "");
    const POST = await loadRoute();
    const res = await POST(syncReq("anything"));
    expect(res.status).toBe(500);
    expect(mocks.templateFindUnique).not.toHaveBeenCalled();
  });

  it("answers 401 on a missing or wrong key (including same length)", async () => {
    vi.stubEnv("TEMPLATE_SYNC_API_KEY", "sync-key-1");
    const POST = await loadRoute();
    expect((await POST(syncReq(null))).status).toBe(401);
    expect((await POST(syncReq("sync-key-2"))).status).toBe(401);
    expect((await POST(syncReq("sync"))).status).toBe(401);
    expect(mocks.templateFindUnique).not.toHaveBeenCalled();
  });

  it("proceeds with the right key", async () => {
    vi.stubEnv("TEMPLATE_SYNC_API_KEY", "sync-key-1");
    const POST = await loadRoute();
    const res = await POST(
      syncReq("sync-key-1", {
        templates: [
          {
            id: "tpl-1",
            type: "DPIA",
            name: "T",
            version: "1",
            isSystem: true,
            isActive: true,
            sections: [],
          },
        ],
      })
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ success: true, created: 1, updated: 0 });
  });
});
