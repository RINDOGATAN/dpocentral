// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Cycle 12, F2: the assessment router refuses ids from another organisation.
 *
 * The org middleware proves the caller belongs to `organizationId`; it says
 * nothing about the other ids in the input. Here the caller is a legitimate
 * OWNER of organisation A and passes an id that belongs to organisation B
 * (the ownership count comes back 0). The call must read as NOT_FOUND and the
 * write must never happen. The same call with the caller's own ids still goes
 * through to the write.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    organizationMember: {
      findUnique: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    auditLog: { create: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    assessment: { create: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    assessmentTemplate: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    processingActivity: { findFirst: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    vendor: { findFirst: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    organization: { updateMany: vi.fn() },
  },
  ai: {
    requireAi: vi.fn(),
    assertAiRateLimit: vi.fn(),
    recordGeneration: vi.fn(),
    markAccepted: vi.fn(),
    postureLane: vi.fn(),
    generateRiskNarrative: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/server/services/ai/posture", () => ({
  requireAi: mocks.ai.requireAi,
  assertAiRateLimit: mocks.ai.assertAiRateLimit,
  recordGeneration: mocks.ai.recordGeneration,
  markAccepted: mocks.ai.markAccepted,
  postureLane: mocks.ai.postureLane,
}));
vi.mock("@/server/services/ai/assessment-generator", () => ({
  generateRiskNarrative: mocks.ai.generateRiskNarrative,
}));

import { assessmentRouter } from "@/server/routers/privacy/assessment";
import { callerFor, sessionFor } from "./helpers";

const ORG_A = { id: "org-a", name: "Org A", slug: "org-a", pilotStartedAt: null };
// A template type that is neither capped on the hosted trial nor premium.
const TEMPLATE = { id: "system-lia-template", type: "LIA", organizationId: null, isSystem: true };

const OWN_ACTIVITY = "activity-of-org-a";
const OWN_VENDOR = "vendor-of-org-a";
const OWN_ASSESSMENT = "assessment-of-org-a";
const FOREIGN_ACTIVITY = "activity-of-org-b";
const FOREIGN_VENDOR = "vendor-of-org-b";
const FOREIGN_ASSESSMENT = "assessment-of-org-b";

const caller = () => callerFor(assessmentRouter, sessionFor("user-a"));

/** The ownership count: only ids of organisation A are found inside it. */
const ownsOnly = (...own: string[]) =>
  async (args: { where?: { id?: { in?: string[] }; organizationId?: string } }) => {
    const wanted = args?.where?.id?.in ?? [];
    if (args?.where?.organizationId !== ORG_A.id) return 0;
    return wanted.filter((id) => own.includes(id)).length;
  };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.organizationMember.findUnique.mockResolvedValue({
    id: "m-a",
    userId: "user-a",
    organizationId: ORG_A.id,
    role: "OWNER",
    organization: ORG_A,
  });
  mocks.prisma.assessmentTemplate.findFirst.mockResolvedValue(TEMPLATE);
  mocks.prisma.assessment.create.mockResolvedValue({ id: "asm-1", template: TEMPLATE });
  mocks.prisma.auditLog.create.mockResolvedValue({});
  mocks.prisma.auditLog.count.mockResolvedValue(0);

  mocks.prisma.processingActivity.count.mockImplementation(ownsOnly(OWN_ACTIVITY));
  mocks.prisma.vendor.count.mockImplementation(ownsOnly(OWN_VENDOR));
  mocks.prisma.assessment.count.mockImplementation(ownsOnly(OWN_ASSESSMENT));

  // The auto-fill loader is already scoped by organisation.
  mocks.prisma.processingActivity.findFirst.mockResolvedValue({
    id: OWN_ACTIVITY,
    organizationId: ORG_A.id,
    name: "Payroll",
    purpose: "Paying staff",
    description: null,
    legalBasis: null,
    recipients: [],
    dataSubjects: [],
    categories: [],
    automatedDecisionMaking: false,
    automatedDecisionDetail: null,
    retentionPeriod: null,
    retentionDays: null,
    assets: [],
    transfers: [],
  });
  mocks.prisma.vendor.findFirst.mockResolvedValue(null);

  mocks.ai.requireAi.mockResolvedValue({ posture: "cloud_us" });
  mocks.ai.assertAiRateLimit.mockResolvedValue(undefined);
  mocks.ai.postureLane.mockReturnValue("cloud_us");
  mocks.ai.generateRiskNarrative.mockResolvedValue({
    model: "test-model",
    content: "A draft.",
    usage: null,
    durationMs: 1,
  });
  mocks.ai.recordGeneration.mockResolvedValue({ id: "gen-1" });
});

describe("assessment.create", () => {
  const create = (extra: { processingActivityId?: string; vendorId?: string }) =>
    caller().create({
      organizationId: ORG_A.id,
      templateId: TEMPLATE.id,
      name: "Payroll review",
      ...extra,
    });

  it("refuses a processing activity of another organisation", async () => {
    await expect(create({ processingActivityId: FOREIGN_ACTIVITY })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(mocks.prisma.assessment.create).not.toHaveBeenCalled();
    expect(mocks.prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("refuses a vendor of another organisation", async () => {
    await expect(
      create({ processingActivityId: OWN_ACTIVITY, vendorId: FOREIGN_VENDOR })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.prisma.assessment.create).not.toHaveBeenCalled();
    expect(mocks.prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("links the caller's own activity and vendor", async () => {
    await expect(
      create({ processingActivityId: OWN_ACTIVITY, vendorId: OWN_VENDOR })
    ).resolves.toMatchObject({ id: "asm-1" });

    expect(mocks.prisma.processingActivity.count).toHaveBeenCalledWith({
      where: { id: { in: [OWN_ACTIVITY] }, organizationId: ORG_A.id },
    });
    expect(mocks.prisma.vendor.count).toHaveBeenCalledWith({
      where: { id: { in: [OWN_VENDOR] }, organizationId: ORG_A.id },
    });
    expect(mocks.prisma.assessment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: ORG_A.id,
          processingActivityId: OWN_ACTIVITY,
          vendorId: OWN_VENDOR,
        }),
      })
    );
  });

  it("still creates an assessment linked to nothing, without an ownership count", async () => {
    await expect(create({})).resolves.toMatchObject({ id: "asm-1" });
    expect(mocks.prisma.processingActivity.count).not.toHaveBeenCalled();
    expect(mocks.prisma.vendor.count).not.toHaveBeenCalled();
    expect(mocks.prisma.assessment.create).toHaveBeenCalled();
  });
});

describe("assessment.generateAiNarrative", () => {
  const narrate = (assessmentId?: string) =>
    caller().generateAiNarrative({
      organizationId: ORG_A.id,
      processingActivityId: OWN_ACTIVITY,
      assessmentId,
    });

  it("refuses to log a draft against an assessment of another organisation", async () => {
    await expect(narrate(FOREIGN_ASSESSMENT)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.ai.generateRiskNarrative).not.toHaveBeenCalled();
    expect(mocks.ai.recordGeneration).not.toHaveBeenCalled();
  });

  it("logs a draft against the caller's own assessment", async () => {
    await expect(narrate(OWN_ASSESSMENT)).resolves.toMatchObject({ generationId: "gen-1" });
    expect(mocks.prisma.assessment.count).toHaveBeenCalledWith({
      where: { id: { in: [OWN_ASSESSMENT] }, organizationId: ORG_A.id },
    });
    expect(mocks.ai.recordGeneration).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        organizationId: ORG_A.id,
        entityType: "Assessment",
        entityId: OWN_ASSESSMENT,
      })
    );
  });
});
