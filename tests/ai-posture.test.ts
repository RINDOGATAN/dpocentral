/**
 * AI posture gate truth table + rate limit + audit helpers.
 *
 * requireAi is THE gate every AI feature procedure runs before building any
 * prompt: no settings row or posture "off" must throw PRECONDITION_FAILED
 * "ai_off" (zero AI calls by default); posture on without an engine must
 * throw "ai_not_configured". Mocked Prisma, stubbed env — no DB, no network.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  requireAi,
  assertAiRateLimit,
  recordGeneration,
  markAccepted,
  AI_RATE_LIMIT_PER_ORG_PER_HOUR,
} from "@/server/services/ai/posture";

const prisma = {
  organizationAiSettings: { findUnique: vi.fn() },
  aiGeneration: { count: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
} as any;

const AI_ENV_KEYS = [
  "LLM_GATEWAY_URL",
  "LLM_GATEWAY_KEY",
  "LLM_MODEL_ALIAS",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
] as const;

function configureEngine() {
  vi.stubEnv("LLM_GATEWAY_URL", "http://ollama:11434");
  vi.stubEnv("LLM_MODEL_ALIAS", "qwen2.5:7b-instruct");
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of AI_ENV_KEYS) vi.stubEnv(key, "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("requireAi truth table", () => {
  it("no settings row -> ai_off (even with an engine configured)", async () => {
    configureEngine();
    prisma.organizationAiSettings.findUnique.mockResolvedValue(null);

    await expect(requireAi(prisma, "org-1")).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "ai_off",
    });
  });

  it("posture off -> ai_off (even with an engine configured)", async () => {
    configureEngine();
    prisma.organizationAiSettings.findUnique.mockResolvedValue({
      organizationId: "org-1",
      posture: "off",
    });

    await expect(requireAi(prisma, "org-1")).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "ai_off",
    });
  });

  it("posture on + no engine -> ai_not_configured", async () => {
    prisma.organizationAiSettings.findUnique.mockResolvedValue({
      organizationId: "org-1",
      posture: "local_gateway",
    });

    await expect(requireAi(prisma, "org-1")).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "ai_not_configured",
    });
  });

  it("posture on + engine configured -> returns the settings row", async () => {
    configureEngine();
    const row = { organizationId: "org-1", posture: "local_gateway" };
    prisma.organizationAiSettings.findUnique.mockResolvedValue(row);

    await expect(requireAi(prisma, "org-1")).resolves.toBe(row);
  });

  it.each(["local_gateway", "cloud_eu", "cloud_us"] as const)(
    "posture %s passes when configured",
    async (posture) => {
      configureEngine();
      prisma.organizationAiSettings.findUnique.mockResolvedValue({
        organizationId: "org-1",
        posture,
      });
      await expect(requireAi(prisma, "org-1")).resolves.toMatchObject({ posture });
    }
  );
});

describe("assertAiRateLimit", () => {
  it("allows generation below the hourly cap", async () => {
    prisma.aiGeneration.count.mockResolvedValue(AI_RATE_LIMIT_PER_ORG_PER_HOUR - 1);
    await expect(assertAiRateLimit(prisma, "org-1")).resolves.toBeUndefined();

    // Scoped to the org and the last hour
    const where = prisma.aiGeneration.count.mock.calls[0][0].where;
    expect(where.organizationId).toBe("org-1");
    expect(where.createdAt.gte).toBeInstanceOf(Date);
  });

  it("rejects with TOO_MANY_REQUESTS at the cap", async () => {
    prisma.aiGeneration.count.mockResolvedValue(AI_RATE_LIMIT_PER_ORG_PER_HOUR);
    await expect(assertAiRateLimit(prisma, "org-1")).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
      message: "ai_rate_limited",
    });
  });
});

describe("recordGeneration / markAccepted (metadata only)", () => {
  it("never receives prompt/output text — only metadata fields", async () => {
    prisma.aiGeneration.create.mockResolvedValue({ id: "gen-1" });

    await recordGeneration(prisma, {
      organizationId: "org-1",
      userId: "user-1",
      feature: "dpia_narrative",
      entityType: "Assessment",
      entityId: "a-1",
      model: "qwen2.5:7b-instruct",
      posture: "local_gateway" as any,
      promptTokens: 100,
      completionTokens: 200,
      totalTokens: 300,
      durationMs: 1234,
      status: "ok",
    });

    const data = prisma.aiGeneration.create.mock.calls[0][0].data;
    expect(Object.keys(data).sort()).toEqual(
      [
        "organizationId",
        "userId",
        "feature",
        "entityType",
        "entityId",
        "model",
        "posture",
        "promptTokens",
        "completionTokens",
        "totalTokens",
        "durationMs",
        "status",
      ].sort()
    );
    // No free-text content fields, ever
    expect(data).not.toHaveProperty("content");
    expect(data).not.toHaveProperty("prompt");
    expect(data).not.toHaveProperty("output");
  });

  it("markAccepted stamps acceptedAt org-scoped and reports a miss", async () => {
    prisma.aiGeneration.updateMany.mockResolvedValue({ count: 1 });
    await expect(markAccepted(prisma, "org-1", "gen-1")).resolves.toBe(true);
    expect(prisma.aiGeneration.updateMany).toHaveBeenCalledWith({
      where: { id: "gen-1", organizationId: "org-1" },
      data: { acceptedAt: expect.any(Date) },
    });

    prisma.aiGeneration.updateMany.mockResolvedValue({ count: 0 });
    await expect(markAccepted(prisma, "other-org", "gen-1")).resolves.toBe(false);
  });
});
