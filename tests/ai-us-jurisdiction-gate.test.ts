// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * AI is unavailable to an organization that declares a US state.
 *
 * The rule lives in requireAi (services/ai/posture.ts), which every AI
 * feature procedure runs before building a prompt. A posture saved before
 * the organization declared a US state does not reopen AI, and switching AI
 * on is refused while the declaration stands. AI_ALLOW_US_JURISDICTIONS=true
 * lifts the rule for a deployment whose engine terms cover US state laws.
 * Mocked Prisma, stubbed env: no DB, no network.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  declaresUsState,
  isAiBlockedForUsJurisdiction,
  requireAi,
  usJurisdictionAiBlockActive,
} from "@/server/services/ai/posture";

const prisma = {
  organizationAiSettings: { findUnique: vi.fn() },
  aiGeneration: { count: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  organizationJurisdiction: { findMany: vi.fn() },
} as any;

const regions = (...r: string[]) => r.map((region) => ({ jurisdiction: { region } }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AI_ALLOW_US_JURISDICTIONS", "");
  vi.stubEnv("LLM_GATEWAY_URL", "http://ollama:11434");
  vi.stubEnv("LLM_MODEL_ALIAS", "qwen2.5:7b-instruct");
  prisma.organizationAiSettings.findUnique.mockResolvedValue({
    organizationId: "org-1",
    posture: "cloud_us",
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("declaresUsState", () => {
  it.each([["US-CA"], ["US-VA"], ["us-tx"], ["US"]])("%s is a US state", (r) => {
    expect(declaresUsState([r])).toBe(true);
  });

  it.each([["EU"], ["UK"], ["CA"], ["CH"], ["BR"]])("%s is not (CA is Canada)", (r) => {
    expect(declaresUsState([r])).toBe(false);
  });

  it("one US state among others is enough", () => {
    expect(declaresUsState(["EU", "UK", "US-CO"])).toBe(true);
  });

  it("no declared jurisdiction is not a US state", () => {
    expect(declaresUsState([])).toBe(false);
  });
});

describe("usJurisdictionAiBlockActive", () => {
  it("is on by default", () => {
    expect(usJurisdictionAiBlockActive()).toBe(true);
  });

  it("is lifted only by AI_ALLOW_US_JURISDICTIONS=true", () => {
    vi.stubEnv("AI_ALLOW_US_JURISDICTIONS", "true");
    expect(usJurisdictionAiBlockActive()).toBe(false);
    vi.stubEnv("AI_ALLOW_US_JURISDICTIONS", "yes");
    expect(usJurisdictionAiBlockActive()).toBe(true);
  });
});

describe("isAiBlockedForUsJurisdiction", () => {
  it("reads the organization's own declared jurisdictions", async () => {
    prisma.organizationJurisdiction.findMany.mockResolvedValue(regions("US-CA"));
    await expect(isAiBlockedForUsJurisdiction(prisma, "org-1")).resolves.toBe(true);
    expect(prisma.organizationJurisdiction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: "org-1" } })
    );
  });

  it("does not query when the rule is lifted", async () => {
    vi.stubEnv("AI_ALLOW_US_JURISDICTIONS", "true");
    await expect(isAiBlockedForUsJurisdiction(prisma, "org-1")).resolves.toBe(false);
    expect(prisma.organizationJurisdiction.findMany).not.toHaveBeenCalled();
  });
});

describe("requireAi with a US state declared", () => {
  it("refuses with ai_us_jurisdiction even when AI was switched on before", async () => {
    prisma.organizationJurisdiction.findMany.mockResolvedValue(regions("EU", "US-CA"));
    await expect(requireAi(prisma, "org-1")).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "ai_us_jurisdiction",
    });
  });

  it("does not change the stored posture", async () => {
    prisma.organizationJurisdiction.findMany.mockResolvedValue(regions("US-VA"));
    await expect(requireAi(prisma, "org-1")).rejects.toThrow();
    expect(prisma.organizationAiSettings.findUnique).not.toHaveBeenCalled();
  });

  it("lets an organization with no US state through as before", async () => {
    prisma.organizationJurisdiction.findMany.mockResolvedValue(regions("EU", "CA"));
    await expect(requireAi(prisma, "org-1")).resolves.toMatchObject({ posture: "cloud_us" });
  });

  it("lets a US organization through when the rule is lifted", async () => {
    vi.stubEnv("AI_ALLOW_US_JURISDICTIONS", "true");
    prisma.organizationJurisdiction.findMany.mockResolvedValue(regions("US-CA"));
    await expect(requireAi(prisma, "org-1")).resolves.toMatchObject({ posture: "cloud_us" });
  });
});
