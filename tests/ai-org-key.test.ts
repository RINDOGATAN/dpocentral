// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The organisation's own API inference key: encryption at rest, redaction,
 * who may set it, the deployment mode (AI_REQUIRE_ORG_KEY, defaulting to the
 * shared hosted service), the door using only the organisation's key where
 * required, and requireAi without a key. Mocked Prisma and fetch: no DB, no
 * network.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    organizationMember: { findUnique: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    organizationAiSettings: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    organizationJurisdiction: { findMany: vi.fn() },
    aiGeneration: { count: vi.fn().mockResolvedValue(0), create: vi.fn(), updateMany: vi.fn() },
    auditLog: { create: vi.fn(), count: vi.fn().mockResolvedValue(0) },
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import {
  checkBaseUrl,
  checkOrgKeyInput,
  decryptOrgKey,
  encryptOrgKey,
  keyLast4,
  OrgKeyInputError,
  orgKeyRequired,
  resolveOrgEngine,
} from "@/server/services/ai/org-key";
import { chatComplete, getProvider, isAIConfigured } from "@/server/services/ai/llm-door";
import { requireAi, requireAiEngine } from "@/server/services/ai/posture";
import { aiRouter } from "@/server/routers/privacy/ai";
import { callerFor, sessionFor } from "./helpers";

const ORG = { id: "org-1", name: "Org", slug: "org-1", pilotStartedAt: null };
const KEY = "sk-ant-api03-abcdefghijklmnop-WXYZ";

const ENV = [
  "AI_REQUIRE_ORG_KEY",
  "VERCEL_ENV",
  "AUTH_COOKIE_DOMAIN",
  "LLM_GATEWAY_URL",
  "LLM_GATEWAY_KEY",
  "LLM_MODEL_ALIAS",
  "ANTHROPIC_API_KEY",
  "AI_ALLOW_US_JURISDICTIONS",
];

function savedRow(overrides: Record<string, unknown> = {}) {
  const sealed = encryptOrgKey(KEY, ORG.id);
  return {
    id: "s-1",
    organizationId: ORG.id,
    posture: "cloud_us",
    acknowledgedAt: null,
    acknowledgedBy: null,
    keyProvider: "anthropic",
    keyBaseUrl: null,
    keyModel: null,
    keyCiphertext: sealed.ciphertext,
    keyIv: sealed.iv,
    keyLast4: "WXYZ",
    keySetById: "user-1",
    keySetAt: new Date("2026-10-26T00:00:00Z"),
    ...overrides,
  };
}

function member(role: string) {
  mocks.prisma.organizationMember.findUnique.mockResolvedValue({
    id: "m-1",
    userId: "user-1",
    organizationId: ORG.id,
    role,
    organization: ORG,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of ENV) vi.stubEnv(k, "");
  vi.stubEnv("NEXTAUTH_SECRET", "test-session-secret-for-org-keys");
  mocks.prisma.organizationJurisdiction.findMany.mockResolvedValue([]);
  member("OWNER");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Encryption at rest", () => {
  it("round-trips, never stores the key in clear, and keeps only the last four characters", () => {
    const sealed = encryptOrgKey(KEY, ORG.id);
    expect(sealed.ciphertext).not.toContain("abcdefghijklmnop");
    expect(Buffer.from(sealed.ciphertext, "base64").toString("utf8")).not.toContain(KEY);
    expect(decryptOrgKey(sealed.ciphertext, sealed.iv, ORG.id)).toBe(KEY);
    expect(keyLast4(KEY)).toBe("WXYZ");
    // A fresh iv every time.
    expect(encryptOrgKey(KEY, ORG.id).ciphertext).not.toBe(sealed.ciphertext);
  });

  it("does not decrypt for another organisation, under another secret, or when damaged", () => {
    const sealed = encryptOrgKey(KEY, ORG.id);
    expect(decryptOrgKey(sealed.ciphertext, sealed.iv, "org-2")).toBeNull();
    const damaged = Buffer.from(sealed.ciphertext, "base64");
    damaged[0] = damaged[0]! ^ 1;
    expect(decryptOrgKey(damaged.toString("base64"), sealed.iv, ORG.id)).toBeNull();
    vi.stubEnv("NEXTAUTH_SECRET", "a-rotated-secret");
    expect(decryptOrgKey(sealed.ciphertext, sealed.iv, ORG.id)).toBeNull();
    expect(resolveOrgEngine(savedRow({ keyCiphertext: sealed.ciphertext, keyIv: sealed.iv }))).toEqual({ state: "unreadable", engine: null });
  });

  it("refuses to store a key without a session secret", () => {
    vi.stubEnv("NEXTAUTH_SECRET", "");
    vi.stubEnv("AUTH_SECRET", "");
    expect(() => encryptOrgKey(KEY, ORG.id)).toThrow(/NEXTAUTH_SECRET/);
  });
});

describe("Deployment mode", () => {
  it("defaults to organisation keys only on the shared hosted service; the variable decides when set", () => {
    expect(orgKeyRequired({})).toBe(false);
    expect(orgKeyRequired({ VERCEL_ENV: "production" })).toBe(true);
    expect(orgKeyRequired({ AUTH_COOKIE_DOMAIN: ".todo.law" })).toBe(true);
    expect(orgKeyRequired({ VERCEL_ENV: "production", AI_REQUIRE_ORG_KEY: "false" })).toBe(false);
    expect(orgKeyRequired({ AI_REQUIRE_ORG_KEY: "true" })).toBe(true);
  });
});

describe("What an administrator saves", () => {
  it("checks the key's form and the provider's prefix", () => {
    expect(checkOrgKeyInput({ provider: "anthropic", apiKey: ` ${KEY} ` }, true)).toMatchObject({ apiKey: KEY, baseUrl: null });
    expect(() => checkOrgKeyInput({ provider: "anthropic", apiKey: "sk-proj-123456789" }, true)).toThrow(OrgKeyInputError);
    expect(() => checkOrgKeyInput({ provider: "openai", apiKey: "short" }, true)).toThrow(/key_format/);
    expect(() => checkOrgKeyInput({ provider: "openai_compatible", apiKey: "abcdefghij", baseUrl: "https://llm.example.com/v1" }, true)).toThrow(/model_required/);
  });

  it("on the shared service, an endpoint must be public HTTPS; elsewhere a local gateway is fine", () => {
    for (const bad of ["http://llm.example.com/v1", "https://localhost/v1", "https://10.0.0.5/v1", "https://169.254.169.254/v1", "https://[::1]/v1", "https://gateway.internal/v1"]) {
      expect(() => checkBaseUrl(bad, true)).toThrow(/base_url_not_allowed/);
    }
    expect(() => checkBaseUrl("https://user:pw@llm.example.com/v1", true)).toThrow(/base_url_invalid/);
    expect(checkBaseUrl("https://llm.example.com/v1/", true)).toBe("https://llm.example.com/v1");
    expect(checkBaseUrl("http://localhost:11434/v1", false)).toBe("http://localhost:11434/v1");
  });
});

describe("The door: organisation key first, deployment engines ignored where required", () => {
  it("ignores the deployment's engines when organisation keys are required, and makes no call", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-deployment");
    vi.stubEnv("LLM_GATEWAY_URL", "http://gateway.example");
    vi.stubEnv("LLM_MODEL_ALIAS", "m");
    expect(getProvider()).toBe("gateway");
    vi.stubEnv("VERCEL_ENV", "production");
    expect(getProvider()).toBeNull();
    expect(isAIConfigured("cloud_us")).toBe(false);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await chatComplete({ system: "s", user: "u" })).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("calls the provider with the organisation's key, never the deployment's", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-deployment");
    vi.stubEnv("AI_REQUIRE_ORG_KEY", "true");
    const fetchSpy = vi.fn(async (_url: string, init: RequestInit) => {
      void init;
      return new Response(JSON.stringify({ model: "m", content: [{ type: "tool_use", input: { rows: [] } }] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchSpy);
    const { engine } = resolveOrgEngine(savedRow());
    const result = await chatComplete({ system: "s", user: "u", engine, json: { name: "x", schema: { type: "object" } } });
    expect(result?.content).toBe('{"rows":[]}');
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe(KEY);
    const body = JSON.parse(String(init.body));
    expect(body.tool_choice).toEqual({ type: "tool", name: "x" });
  });

  it("reaches an OpenAI-compatible endpoint, retrying once without response_format when refused", async () => {
    const calls: Array<{ url: string; body: Record<string, unknown>; auth: string }> = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      calls.push({ url, body, auth: (init.headers as Record<string, string>).Authorization! });
      if (body.response_format) return new Response("unsupported", { status: 400 });
      return new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { status: 200 });
    });
    const sealed = encryptOrgKey("abcdefghijkl", ORG.id);
    const { engine } = resolveOrgEngine(
      savedRow({ keyProvider: "openai_compatible", keyBaseUrl: "https://llm.example.com/v1", keyModel: "my-model", keyCiphertext: sealed.ciphertext, keyIv: sealed.iv }),
    );
    expect(await chatComplete({ system: "s", user: "u", engine, json: { name: "x", schema: {} } })).toMatchObject({ content: "{}" });
    expect(calls.map((c) => c.url)).toEqual(["https://llm.example.com/v1/chat/completions", "https://llm.example.com/v1/chat/completions"]);
    expect(calls[0]!.auth).toBe("Bearer abcdefghijkl");
    expect(calls[1]!.body).not.toHaveProperty("response_format");
    expect(calls[1]!.body.model).toBe("my-model");
  });
});

describe("requireAi with and without a key", () => {
  it("where organisation keys are required, no key means ai_not_configured even with a deployment engine", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-deployment");
    mocks.prisma.organizationAiSettings.findUnique.mockResolvedValue(savedRow({ keyCiphertext: null, keyIv: null }));
    await expect(requireAi(mocks.prisma as never, ORG.id)).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: "ai_not_configured" });
  });

  it("with a key, passes and hands back the organisation's engine", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    mocks.prisma.organizationAiSettings.findUnique.mockResolvedValue(savedRow());
    const { engine } = await requireAiEngine(mocks.prisma as never, ORG.id);
    expect(engine).toMatchObject({ kind: "anthropic", apiKey: KEY });
  });

  it("self-hosted: the deployment engine still answers, and a saved key overrides it", async () => {
    vi.stubEnv("LLM_GATEWAY_URL", "http://gateway.example");
    vi.stubEnv("LLM_MODEL_ALIAS", "m");
    mocks.prisma.organizationAiSettings.findUnique.mockResolvedValue(savedRow({ keyCiphertext: null, keyIv: null }));
    expect((await requireAiEngine(mocks.prisma as never, ORG.id)).engine).toBeNull();
    mocks.prisma.organizationAiSettings.findUnique.mockResolvedValue(savedRow());
    expect((await requireAiEngine(mocks.prisma as never, ORG.id)).engine).toMatchObject({ apiKey: KEY });
  });
});

describe("ai router: who may set the key, and what is ever returned", () => {
  const session = sessionFor("user-1");

  it.each(["MEMBER", "VIEWER", "PRIVACY_OFFICER"])("refuses %s", async (role) => {
    member(role);
    await expect(callerFor(aiRouter, session).setKey({ organizationId: ORG.id, provider: "anthropic", apiKey: KEY })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(callerFor(aiRouter, session).removeKey({ organizationId: ORG.id })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.prisma.organizationAiSettings.upsert).not.toHaveBeenCalled();
  });

  it("an admin saves it encrypted, the audit entry and the reply hold no key", async () => {
    member("ADMIN");
    mocks.prisma.organizationAiSettings.upsert.mockImplementation(async ({ create }: { create: Record<string, unknown> }) => ({ id: "s-1", ...create }));
    const reply = await callerFor(aiRouter, session).setKey({ organizationId: ORG.id, provider: "anthropic", apiKey: KEY });
    expect(JSON.stringify(reply)).not.toContain("abcdefghijklmnop");
    expect(reply).toMatchObject({ provider: "anthropic", last4: "WXYZ" });

    const stored = mocks.prisma.organizationAiSettings.upsert.mock.calls[0]![0].create;
    expect(stored.keyCiphertext).toBeTruthy();
    expect(JSON.stringify(stored)).not.toContain(KEY);
    expect(decryptOrgKey(stored.keyCiphertext, stored.keyIv, ORG.id)).toBe(KEY);

    const audit = mocks.prisma.auditLog.create.mock.calls[0]![0].data;
    expect(audit).toMatchObject({ action: "AI_KEY_SET", entityType: "OrganizationAiSettings" });
    expect(JSON.stringify(audit)).not.toContain("abcdefghijklmnop");
  });

  // AI_REQUIRE_ORG_KEY stands in for the hosted markers here, which would also switch on the pilot caps.
  it("refuses an endpoint the shared service may not call", async () => {
    vi.stubEnv("AI_REQUIRE_ORG_KEY", "true");
    await expect(
      callerFor(aiRouter, session).setKey({ organizationId: ORG.id, provider: "openai_compatible", apiKey: "abcdefghijkl", baseUrl: "http://10.0.0.1/v1", model: "m" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "ai_key_base_url_not_allowed" });
  });

  it("status never carries the key or its ciphertext; removal is audited", async () => {
    member("VIEWER");
    vi.stubEnv("AI_REQUIRE_ORG_KEY", "true");
    mocks.prisma.organizationAiSettings.findUnique.mockResolvedValue(savedRow());
    const status = await callerFor(aiRouter, session).getStatus({ organizationId: ORG.id });
    const text = JSON.stringify(status);
    expect(text).not.toContain("abcdefghijklmnop");
    expect(text).not.toContain(savedRow().keyIv.slice(0, 8));
    expect(status).toMatchObject({ orgKeyRequired: true, configured: true, key: { state: "ready", last4: "WXYZ" } });

    member("OWNER");
    mocks.prisma.organizationAiSettings.findUnique.mockResolvedValue(savedRow());
    await expect(callerFor(aiRouter, session).removeKey({ organizationId: ORG.id })).resolves.toEqual({ removed: true });
    expect(mocks.prisma.organizationAiSettings.update.mock.calls[0]![0].data).toMatchObject({ keyCiphertext: null, keyIv: null, keyLast4: null });
    expect(mocks.prisma.auditLog.create.mock.calls.at(-1)![0].data).toMatchObject({ action: "AI_KEY_REMOVED" });
  });

  it("setPosture no longer returns the whole settings row", async () => {
    mocks.prisma.organizationAiSettings.upsert.mockResolvedValue(savedRow());
    const reply = await callerFor(aiRouter, session).setPosture({ organizationId: ORG.id, posture: "cloud_us", acknowledged: true });
    expect(reply).not.toHaveProperty("keyCiphertext");
    expect(reply).not.toHaveProperty("keyIv");
  });
});
