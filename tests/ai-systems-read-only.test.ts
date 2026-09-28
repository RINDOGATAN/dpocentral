// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * AI systems are read-only in DPO Central (the owner's decision, 27 Sep 2026:
 * "show AI systems read-only with 'Govern this in AI Sentinel'"). The three
 * mutating procedures — create, update, delete — must refuse, with a plain
 * message pointing to AI Sentinel, and must write nothing to the ai_systems
 * table. A legitimate OWNER is used, so it is the read-only rule that refuses,
 * not the role gate. Prisma is module-mocked.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    organizationMember: { findUnique: vi.fn() },
    aISystem: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), findFirst: vi.fn() },
    vendor: { count: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { aiGovernanceRouter } from "@/server/routers/privacy/aiGovernance";
import { callerFor, sessionFor } from "./helpers";

const ORG = "org-a";

function ownerCaller() {
  mocks.prisma.organizationMember.findUnique.mockResolvedValue({
    id: "member-owner-a",
    userId: "user-a",
    organizationId: ORG,
    role: "OWNER",
    organization: { id: ORG, name: "Org A", slug: "org-a", pilotStartedAt: null },
  });
  return callerFor(aiGovernanceRouter, sessionFor("user-a")) as ReturnType<
    typeof aiGovernanceRouter.createCaller
  >;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.auditLog.create.mockResolvedValue({});
  mocks.prisma.vendor.count.mockResolvedValue(0);
});

describe("AI systems are read-only in DPO Central", () => {
  it("refuses to register an AI system, pointing to AI Sentinel, and writes nothing", async () => {
    await expect(ownerCaller().create({ organizationId: ORG, name: "Support bot" })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringContaining("AI Sentinel"),
    });
    expect(mocks.prisma.aISystem.create).not.toHaveBeenCalled();
    expect(mocks.prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("refuses to edit an AI system and writes nothing", async () => {
    await expect(
      ownerCaller().update({ organizationId: ORG, id: "sys-1", name: "Renamed" })
    ).rejects.toMatchObject({ code: "FORBIDDEN", message: expect.stringContaining("AI Sentinel") });
    expect(mocks.prisma.aISystem.update).not.toHaveBeenCalled();
    // Never even reads the row: it refuses before touching the database.
    expect(mocks.prisma.aISystem.findFirst).not.toHaveBeenCalled();
  });

  it("refuses to delete an AI system: nothing is ever removed here", async () => {
    await expect(ownerCaller().delete({ organizationId: ORG, id: "sys-1" })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringContaining("AI Sentinel"),
    });
    expect(mocks.prisma.aISystem.delete).not.toHaveBeenCalled();
  });
});
