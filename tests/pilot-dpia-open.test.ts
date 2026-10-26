// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * DPIAs on the hosted pilot are not capped: an organisation creates as many
 * as it needs, the server never refuses one for a count, and no screen shows
 * a "free for a limited time" note. The generic audit row for a pilot limit
 * (PILOT_LIMIT_REACHED) stays, as it is read by the account counts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    organizationMember: {
      findUnique: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    auditLog: { create: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    assessment: {
      create: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    assessmentTemplate: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    dataAsset: { count: vi.fn().mockResolvedValue(0) },
    dataElement: { count: vi.fn().mockResolvedValue(0) },
    processingActivity: { count: vi.fn().mockResolvedValue(0) },
    dataFlow: { count: vi.fn().mockResolvedValue(0) },
    dataTransfer: { count: vi.fn().mockResolvedValue(0) },
    vendor: { count: vi.fn().mockResolvedValue(0) },
    vendorContract: { count: vi.fn().mockResolvedValue(0) },
    dSARRequest: { count: vi.fn().mockResolvedValue(0) },
    incident: { count: vi.fn().mockResolvedValue(0) },
    aISystem: { count: vi.fn().mockResolvedValue(0) },
    organization: { updateMany: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { assessmentRouter } from "@/server/routers/privacy/assessment";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import * as caps from "@/server/services/pilot/caps";
import { PILOT_LIMIT_REACHED, recordPilotLimitReached } from "@/server/services/pilot/caps";
import { callerFor, sessionFor } from "./helpers";

const ORG = { id: "org-1", name: "Org", slug: "org", pilotStartedAt: null };
const DPIA_TEMPLATE = { id: "system-dpia-template", type: "DPIA", organizationId: null };

const hosted = () => vi.stubEnv("VERCEL_ENV", "production");

const read = (p: string) => readFileSync(path.resolve(__dirname, "..", p), "utf8");

const caller = () => callerFor(assessmentRouter, sessionFor("user-1"));

const createDpia = () =>
  caller().create({
    organizationId: ORG.id,
    templateId: DPIA_TEMPLATE.id,
    name: "Loyalty programme",
  });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.organizationMember.findUnique.mockResolvedValue({
    id: "m-1",
    userId: "user-1",
    organizationId: ORG.id,
    role: "OWNER",
    organization: ORG,
  });
  mocks.prisma.assessmentTemplate.findFirst.mockResolvedValue(DPIA_TEMPLATE);
  mocks.prisma.assessment.create.mockResolvedValue({ id: "asm-1", template: DPIA_TEMPLATE });
  mocks.prisma.auditLog.create.mockResolvedValue({});
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("DPIAs on the hosted pilot", () => {
  it("creates a DPIA however many have been created before", async () => {
    hosted();
    mocks.prisma.auditLog.count.mockResolvedValue(10);
    mocks.prisma.assessment.count.mockResolvedValue(10);
    await expect(createDpia()).resolves.toMatchObject({ id: "asm-1" });
    await expect(createDpia()).resolves.toMatchObject({ id: "asm-1" });
    expect(mocks.prisma.assessment.create).toHaveBeenCalledTimes(2);
    // No limit row is written: nothing was refused.
    expect(mocks.prisma.auditLog.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: PILOT_LIMIT_REACHED }) })
    );
  });

  it("has no DPIA count, quota or cap message left", () => {
    for (const name of ["PILOT_DPIA_LIMIT", "countDpiaCreated", "pilotDpiaQuota", "dpiaCapMessage", "assertPilotDpiaQuota"]) {
      expect(caps).not.toHaveProperty(name);
    }
    expect(Object.keys(assessmentRouter._def.procedures)).not.toContain("dpiaQuota");
  });

  it("shows no 'free for a limited time' note, in either language", () => {
    expect(en.pages).not.toHaveProperty("trialAssessments");
    expect(es.pages).not.toHaveProperty("trialAssessments");
    expect(JSON.stringify(en)).not.toMatch(/free for a limited time/i);
    expect(JSON.stringify(es)).not.toMatch(/gratis por tiempo limitado/i);
    expect(existsSync(path.resolve(__dirname, "../src/components/pilot/dpia-free-note.tsx"))).toBe(false);
    for (const page of [
      "src/app/(dashboard)/privacy/assessments/page.tsx",
      "src/app/(dashboard)/privacy/assessments/new/page.tsx",
      "src/app/(dashboard)/privacy/assessments/auto-fill/page.tsx",
      "src/app/(dashboard)/privacy/data-inventory/activities/[id]/page.tsx",
    ]) {
      const source = read(page);
      expect(source).not.toContain("DpiaFreeNote");
      expect(source).not.toContain("useDpiaQuota");
    }
  });
});

describe("a pilot organisation can read and export everything", () => {
  it("every export is a GET route that the pilot limits do not touch", () => {
    const root = path.resolve(__dirname, "../src/app/api/export");
    const routes: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (name === "route.ts") routes.push(full);
      }
    };
    walk(root);
    expect(routes.length).toBeGreaterThanOrEqual(8);
    for (const route of routes) {
      const source = readFileSync(route, "utf8");
      expect(source).toMatch(/export (async function|const) GET/);
      expect(source).not.toMatch(/export (async function|const) (POST|PUT|PATCH|DELETE)/);
      expect(source).not.toContain("pilot/caps");
    }
  });
});

describe("reaching a pilot limit is recorded, as a count", () => {
  /** An audit table that, like the real one, refuses a second row with the same id. */
  function auditTable() {
    const rows = new Map<string, Record<string, unknown>>();
    mocks.prisma.auditLog.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => {
        const id = String(data.id ?? `row-${rows.size}`);
        if (rows.has(id)) {
          throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
        }
        rows.set(id, data);
        return data;
      }
    );
    return () => [...rows.values()].filter((r) => r.action === PILOT_LIMIT_REACHED);
  }

  it("writes once and only once per organisation, per limit, per day", async () => {
    const limitRows = auditTable();
    const db = mocks.prisma as never;
    const morning = new Date("2026-10-05T08:00:00Z");
    const evening = new Date("2026-10-05T23:59:00Z");
    const nextDay = new Date("2026-10-06T00:01:00Z");

    await recordPilotLimitReached(db, "org-1", "impact_assessments", morning);
    await recordPilotLimitReached(db, "org-1", "impact_assessments", evening);
    await Promise.all([
      recordPilotLimitReached(db, "org-1", "impact_assessments", evening),
      recordPilotLimitReached(db, "org-1", "impact_assessments", evening),
    ]);
    expect(limitRows()).toHaveLength(1);
    expect(limitRows()[0]).toEqual({
      id: expect.any(String),
      organizationId: "org-1",
      entityType: "Organization",
      entityId: "org-1",
      action: "PILOT_LIMIT_REACHED",
      metadata: { limit: "impact_assessments" },
    });

    await recordPilotLimitReached(db, "org-2", "impact_assessments", evening);
    expect(limitRows()).toHaveLength(2);

    await recordPilotLimitReached(db, "org-1", "impact_assessments", nextDay);
    expect(limitRows()).toHaveLength(3);
  });
});
