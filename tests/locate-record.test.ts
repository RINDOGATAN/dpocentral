// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * organization.locateRecord (src/server/routers/privacy/organization.ts,
 * src/server/services/record-locator.ts): a record page whose query answered
 * "not found" asks which of the caller's organisations holds the record, so
 * it can switch to it. Tenant isolation: the answer is null, and nothing
 * else, for a record of an organisation the caller is not a member of,
 * whether or not the record exists; the membership lookup is always scoped
 * to the caller's user id.
 *
 * Prisma is module-mocked: we assert on the queries the router issues.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    incident: { findUnique: vi.fn() },
    dSARRequest: { findUnique: vi.fn() },
    assessment: { findUnique: vi.fn() },
    vendor: { findUnique: vi.fn() },
    dataAsset: { findUnique: vi.fn() },
    aISystem: { findUnique: vi.fn() },
    organizationMember: { findUnique: vi.fn(), findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/server/services/dsar/defaultIntakeForm", () => ({ ensureDefaultIntakeForm: vi.fn() }));

import { organizationRouter } from "@/server/routers/privacy/organization";
import { delegateFor, RECORD_KINDS, type RecordLocatorDb } from "@/server/services/record-locator";
import { shouldSwitchTo } from "@/lib/record-org-switch";
import { callerFor, sessionFor } from "./helpers";

const ORG_B = { id: "org-b", name: "Client B", slug: "client-b" };

function caller(userId = "user-a") {
  return callerFor(organizationRouter, sessionFor(userId)) as ReturnType<typeof organizationRouter.createCaller>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("organization.locateRecord", () => {
  it("names the organisation of a record the caller is a member of", async () => {
    mocks.prisma.incident.findUnique.mockResolvedValue({ organizationId: "org-b" });
    mocks.prisma.organizationMember.findFirst.mockResolvedValue({ organization: ORG_B });

    const located = await caller().locateRecord({ kind: "incident", id: "inc-1" });

    expect(located).toEqual(ORG_B);
    expect(mocks.prisma.incident.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "inc-1" }, select: { organizationId: true } })
    );
    // The membership lookup is scoped to the caller: never a lookup by organisation alone.
    expect(mocks.prisma.organizationMember.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-a", organizationId: "org-b" } })
    );
  });

  it("answers null for a record of an organisation the caller is not in", async () => {
    mocks.prisma.assessment.findUnique.mockResolvedValue({ organizationId: "org-c" });
    mocks.prisma.organizationMember.findFirst.mockResolvedValue(null);

    const located = await caller().locateRecord({ kind: "assessment", id: "asm-1" });

    expect(located).toBeNull();
  });

  it("answers the same null for a record that does not exist", async () => {
    mocks.prisma.dSARRequest.findUnique.mockResolvedValue(null);

    const located = await caller().locateRecord({ kind: "dsar", id: "no-such" });

    expect(located).toBeNull();
    expect(mocks.prisma.organizationMember.findFirst).not.toHaveBeenCalled();
  });

  it("refuses an anonymous caller", async () => {
    const anonymous = callerFor(organizationRouter, null) as ReturnType<typeof organizationRouter.createCaller>;
    await expect(anonymous.locateRecord({ kind: "vendor", id: "v-1" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.prisma.vendor.findUnique).not.toHaveBeenCalled();
  });

  it("refuses an unknown kind of record", async () => {
    await expect(
      caller().locateRecord({ kind: "user" as unknown as "incident", id: "u-1" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("reads each kind from its own table", () => {
    const db = mocks.prisma as unknown as RecordLocatorDb;
    const seen = new Set(RECORD_KINDS.map((kind) => delegateFor(db, kind)));
    expect(seen.size).toBe(RECORD_KINDS.length);
    expect(delegateFor(db, "dsar")).toBe(db.dSARRequest);
    expect(delegateFor(db, "aiSystem")).toBe(db.aISystem);
    expect(delegateFor(db, "dataAsset")).toBe(db.dataAsset);
  });
});

describe("shouldSwitchTo", () => {
  it("switches only to another organisation that was found", () => {
    expect(shouldSwitchTo(ORG_B, "org-a")).toBe(true);
    // The record is in the selected organisation and was refused for another reason.
    expect(shouldSwitchTo(ORG_B, "org-b")).toBe(false);
    expect(shouldSwitchTo(null, "org-a")).toBe(false);
    expect(shouldSwitchTo(undefined, "org-a")).toBe(false);
    expect(shouldSwitchTo(ORG_B, undefined)).toBe(false);
  });
});
