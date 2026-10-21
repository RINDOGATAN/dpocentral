// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Every AI path refuses an organization that declares a US state.
 *
 * Real routers and the real posture gate over a mocked Prisma; the LLM door
 * and the generator are mocks so a call reaching them would show. The
 * organization saved posture "cloud_us" earlier and an engine is configured,
 * so the only reason to refuse is the declared US state.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    organizationMember: { findUnique: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    organizationAiSettings: { findUnique: vi.fn(), upsert: vi.fn() },
    organizationJurisdiction: { findMany: vi.fn() },
    aiGeneration: { count: vi.fn().mockResolvedValue(0), create: vi.fn(), updateMany: vi.fn() },
    auditLog: { create: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    assessment: { count: vi.fn().mockResolvedValue(0) },
    processingActivity: { findFirst: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    vendor: { findFirst: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    incident: { findFirst: vi.fn() },
    incidentNotification: { findFirst: vi.fn() },
  },
  chatComplete: vi.fn(),
  generateRiskNarrative: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/server/services/ai/llm-door", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/services/ai/llm-door")>()),
  chatComplete: mocks.chatComplete,
}));
vi.mock("@/server/services/ai/assessment-generator", () => ({
  generateRiskNarrative: mocks.generateRiskNarrative,
}));

import { aiRouter } from "@/server/routers/privacy/ai";
import { assessmentRouter } from "@/server/routers/privacy/assessment";
import { incidentRouter } from "@/server/routers/privacy/incident";
import { callerFor, sessionFor } from "./helpers";

const ORG = { id: "org-us", name: "Org", slug: "org-us", pilotStartedAt: null };
const session = sessionFor("user-1");

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AI_ALLOW_US_JURISDICTIONS", "");
  vi.stubEnv("LLM_GATEWAY_URL", "http://gateway.example");
  vi.stubEnv("LLM_MODEL_ALIAS", "test-model");
  mocks.prisma.organizationMember.findUnique.mockResolvedValue({
    id: "m-1",
    userId: "user-1",
    organizationId: ORG.id,
    role: "OWNER",
    organization: ORG,
  });
  mocks.prisma.organizationAiSettings.findUnique.mockResolvedValue({
    id: "s-1",
    organizationId: ORG.id,
    posture: "cloud_us",
    acknowledgedAt: null,
    acknowledgedBy: null,
  });
  mocks.prisma.organizationJurisdiction.findMany.mockResolvedValue([
    { jurisdiction: { region: "EU" } },
    { jurisdiction: { region: "US-CA" } },
  ]);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const refused = { code: "PRECONDITION_FAILED", message: "ai_us_jurisdiction" };

describe("AI paths refuse an organization that declares a US state", () => {
  it("assessment.generateAiNarrative", async () => {
    await expect(
      callerFor(assessmentRouter, session).generateAiNarrative({
        organizationId: ORG.id,
        processingActivityId: "activity-1",
      })
    ).rejects.toMatchObject(refused);
    expect(mocks.generateRiskNarrative).not.toHaveBeenCalled();
    expect(mocks.prisma.aiGeneration.create).not.toHaveBeenCalled();
  });

  it("incident.generateNotificationDraft", async () => {
    await expect(
      callerFor(incidentRouter, session).generateNotificationDraft({
        organizationId: ORG.id,
        incidentId: "incident-1",
        notificationId: "notification-1",
      })
    ).rejects.toMatchObject(refused);
    expect(mocks.chatComplete).not.toHaveBeenCalled();
    expect(mocks.prisma.incident.findFirst).not.toHaveBeenCalled();
  });

  it("ai.setPosture refuses switching AI on and stores nothing", async () => {
    await expect(
      callerFor(aiRouter, session).setPosture({
        organizationId: ORG.id,
        posture: "cloud_us",
        acknowledged: true,
      })
    ).rejects.toMatchObject(refused);
    expect(mocks.prisma.organizationAiSettings.upsert).not.toHaveBeenCalled();
  });

  it("ai.setPosture still lets the organization switch AI off", async () => {
    mocks.prisma.organizationAiSettings.upsert.mockResolvedValue({ id: "s-1", posture: "off" });
    await expect(
      callerFor(aiRouter, session).setPosture({
        organizationId: ORG.id,
        posture: "off",
        acknowledged: true,
      })
    ).resolves.toMatchObject({ posture: "off" });
  });

  it("ai.getStatus reports the block and that AI is not active", async () => {
    const status = await callerFor(aiRouter, session).getStatus({ organizationId: ORG.id });
    expect(status).toMatchObject({ posture: "cloud_us", usJurisdictionBlocked: true, active: false });
  });

  it("ai.getStatus is unchanged for an organization with no US state", async () => {
    mocks.prisma.organizationJurisdiction.findMany.mockResolvedValue([{ jurisdiction: { region: "EU" } }]);
    const status = await callerFor(aiRouter, session).getStatus({ organizationId: ORG.id });
    expect(status).toMatchObject({ usJurisdictionBlocked: false, active: true });
  });
});
