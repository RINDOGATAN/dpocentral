// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Stage 3b: once the v2 question sets land, the v1 system templates are marked
 * superseded. New assessments must use v2: the picker (listTemplates) and the
 * "create a TIA for a transfer" shortcut must both filter supersededAt IS NULL,
 * so a retired v1 is never offered. An assessment already on a v1 template still
 * opens it through getTemplate (by id), which is unaffected.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    organizationMember: { findUnique: vi.fn() },
    auditLog: { create: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    assessment: { create: vi.fn(), findFirst: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    assessmentTemplate: { findMany: vi.fn(), findFirst: vi.fn() },
    dataTransfer: { findFirst: vi.fn() },
    organization: { updateMany: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
// The picker refreshes hosted templates first; not what we are testing here.
vi.mock("@/server/services/pilot/hosted-templates", () => ({ ensureHostedTemplates: vi.fn() }));

import { assessmentRouter } from "@/server/routers/privacy/assessment";
import { callerFor, sessionFor } from "./helpers";

const ORG = { id: "org-a", name: "Org A", slug: "org-a", pilotStartedAt: null };

// The same type, one retired (v1) and one current (v2).
const SUPERSEDED = new Date("2026-09-28T17:00:00Z");
const TEMPLATES = [
  { id: "system-lia-template", type: "LIA", isSystem: true, organizationId: null, isActive: true, supersededAt: SUPERSEDED, name: "LIA v1" },
  { id: "system-lia-template-v2", type: "LIA", isSystem: true, organizationId: null, isActive: true, supersededAt: null, name: "LIA v2" },
  { id: "system-tia-template", type: "TIA", isSystem: true, organizationId: null, isActive: true, supersededAt: SUPERSEDED, name: "TIA v1", createdAt: new Date("2026-01-01") },
  { id: "system-tia-template-v2", type: "TIA", isSystem: true, organizationId: null, isActive: true, supersededAt: null, name: "TIA v2", createdAt: new Date("2026-09-28") },
];

/** Honour the where-operators these queries use: OR, equality, null. */
function matchOne(row: Record<string, unknown>, key: string, cond: unknown): boolean {
  if (key === "OR") return (cond as Record<string, unknown>[]).some((c) => matches(row, c));
  if (cond === null) return row[key] === null || row[key] === undefined;
  return row[key] === cond;
}
function matches(row: Record<string, unknown>, where: Record<string, unknown> = {}): boolean {
  return Object.entries(where).every(([k, v]) => matchOne(row, k, v));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.organizationMember.findUnique.mockResolvedValue({ role: "OWNER", organization: ORG });
  mocks.prisma.assessmentTemplate.findMany.mockImplementation(async ({ where }: { where?: Record<string, unknown> }) =>
    TEMPLATES.filter((t) => matches(t, where)),
  );
  mocks.prisma.assessmentTemplate.findFirst.mockImplementation(async ({ where }: { where?: Record<string, unknown> }) =>
    TEMPLATES.filter((t) => matches(t, where))[0] ?? null,
  );
});

describe("superseded templates are hidden from new assessments", () => {
  it("listTemplates offers only the current (v2) template for a type", async () => {
    const caller = callerFor(assessmentRouter, sessionFor("u1")) as {
      listTemplates: (i: { organizationId: string; type: "LIA" }) => Promise<Array<{ id: string }>>;
    };
    const list = await caller.listTemplates({ organizationId: ORG.id, type: "LIA" });
    expect(list.map((t) => t.id)).toEqual(["system-lia-template-v2"]);

    // And the query itself asks for supersededAt: null (the guard, not luck).
    const where = mocks.prisma.assessmentTemplate.findMany.mock.calls[0][0].where;
    expect(where.supersededAt).toBeNull();
    expect(where.isActive).toBe(true);
  });

  it("createForTransfer picks the current (v2) TIA, never the retired v1", async () => {
    mocks.prisma.dataTransfer.findFirst.mockResolvedValue({ id: "tr1", organizationId: ORG.id });
    mocks.prisma.assessment.findFirst.mockResolvedValue(null); // no in-progress TIA yet
    mocks.prisma.assessment.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "as1", ...data }));

    const caller = callerFor(assessmentRouter, sessionFor("u1")) as {
      createForTransfer: (i: { organizationId: string; dataTransferId: string }) => Promise<{ templateId: string }>;
    };
    const created = await caller.createForTransfer({ organizationId: ORG.id, dataTransferId: "tr1" });
    expect(created.templateId).toBe("system-tia-template-v2");

    const where = mocks.prisma.assessmentTemplate.findFirst.mock.calls[0][0].where;
    expect(where.supersededAt).toBeNull();
  });
});
