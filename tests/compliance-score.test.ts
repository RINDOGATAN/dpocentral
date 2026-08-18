/**
 * Regression tests for the compliance score.
 *
 * Locks the fix for the "empty programme scores 97/100" bug. Every module
 * score used to fall back to 100 when its denominator was zero, so an
 * organisation with no assessments, DSARs, incidents or vendor reviews was
 * badged "Sólida" on the strength of four vacuous 100s sitting directly above
 * the words "0 de 0 cumplen". For a compliance tool that reads exactly
 * backwards, so unrated modules must now be excluded from the weighted average
 * rather than counted as perfect.
 *
 * Weights: ROPA 25%, Assessment 20%, DSAR 25%, Incident 15%, Vendor 15%.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    organizationMember: { findUnique: vi.fn() },
    dataAsset: { count: vi.fn() },
    assessment: { count: vi.fn() },
    dSARRequest: { count: vi.fn() },
    incident: { count: vi.fn() },
    vendor: { count: vi.fn() },
    vendorContract: { count: vi.fn() },
    complianceSnapshot: { upsert: vi.fn() },
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

import { reportsRouter } from "@/server/routers/privacy/reports";
import { callerFor, sessionFor } from "./helpers";

const ORG = { id: "org-1", name: "Org", slug: "org" };

/**
 * The score reads 15 counts in a fixed order inside one Promise.all. Queue
 * them per model in call order:
 *   dataAsset     → totalAssets, assetsWithActivities
 *   assessment    → total, approved, draft
 *   dSARRequest   → total, overdue, overdueRiskIndicator
 *   incident      → requiringNotification, deadlineMet, criticalOpen
 *   vendor        → active, reviewedRecently, highRiskUnassessed
 *   vendorContract→ expiringSoon
 */
function queueCounts(opts: {
  assets?: [number, number];
  assessments?: [number, number, number];
  dsars?: [number, number, number];
  incidents?: [number, number, number];
  vendors?: [number, number, number];
  contracts?: number;
}) {
  const {
    assets = [0, 0],
    assessments = [0, 0, 0],
    dsars = [0, 0, 0],
    incidents = [0, 0, 0],
    vendors = [0, 0, 0],
    contracts = 0,
  } = opts;

  assets.forEach((n) => mocks.prisma.dataAsset.count.mockResolvedValueOnce(n));
  assessments.forEach((n) => mocks.prisma.assessment.count.mockResolvedValueOnce(n));
  dsars.forEach((n) => mocks.prisma.dSARRequest.count.mockResolvedValueOnce(n));
  incidents.forEach((n) => mocks.prisma.incident.count.mockResolvedValueOnce(n));
  vendors.forEach((n) => mocks.prisma.vendor.count.mockResolvedValueOnce(n));
  mocks.prisma.vendorContract.count.mockResolvedValueOnce(contracts);
}

function caller() {
  mocks.prisma.organizationMember.findUnique.mockResolvedValue({
    id: "member-1",
    userId: "user-1",
    organizationId: ORG.id,
    role: "OWNER",
    organization: ORG,
  });
  return callerFor(reportsRouter, sessionFor("user-1")) as ReturnType<
    typeof reportsRouter.createCaller
  >;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("compliance score: empty modules are unrated, not compliant", () => {
  it("reports no score at all for a completely empty organization", async () => {
    queueCounts({});
    const result = await caller().getComplianceScore({ organizationId: ORG.id });

    // The original bug: this returned 100.
    expect(result.score).toBeNull();
    expect(result.coverage.ratedModules).toBe(0);
    expect(result.coverage.ratedWeightPct).toBe(0);
    for (const mod of Object.values(result.breakdown)) {
      expect(mod.score).toBeNull();
    }
  });

  it("does not let empty modules inflate a partially populated org", async () => {
    // 8 assets, 7 linked → ROPA 88%. Nothing else has any data.
    queueCounts({ assets: [8, 7] });
    const result = await caller().getComplianceScore({ organizationId: ORG.id });

    // Previously: 88*0.25 + 100*0.75 = 97. Now ROPA is the only rated module.
    expect(result.score).toBe(88);
    expect(result.coverage.ratedModules).toBe(1);
    expect(result.coverage.ratedWeightPct).toBe(25);
    expect(result.breakdown.assessment.score).toBeNull();
    expect(result.breakdown.dsar.score).toBeNull();
    expect(result.breakdown.incident.score).toBeNull();
    expect(result.breakdown.vendor.score).toBeNull();
  });

  it("renormalises weights across only the rated modules", async () => {
    // ROPA 50% (weight .25) and assessments 100% (weight .20); nothing else.
    // Renormalised: (50*.25 + 100*.20) / .45 = 32.5 / .45 = 72.2 → 72.
    // Without renormalisation the same inputs would give 32.5 + three vacuous
    // 100s = 87, which is the inflation this fix removes.
    queueCounts({ assets: [10, 5], assessments: [4, 4, 0] });
    const result = await caller().getComplianceScore({ organizationId: ORG.id });

    expect(result.score).toBe(72);
    expect(result.coverage.ratedModules).toBe(2);
    expect(result.coverage.ratedWeightPct).toBe(45);
  });

  it("still scores a fully populated org on the plain weighted formula", async () => {
    // Every module 100% → 100 regardless of renormalisation.
    queueCounts({
      assets: [4, 4],
      assessments: [2, 2, 0],
      dsars: [5, 0, 0],
      incidents: [3, 3, 0],
      vendors: [6, 6, 0],
    });
    const result = await caller().getComplianceScore({ organizationId: ORG.id });

    expect(result.score).toBe(100);
    expect(result.coverage.ratedModules).toBe(5);
    expect(result.coverage.ratedWeightPct).toBe(100);
  });

  it("a poor rated module still drags the score down", async () => {
    // ROPA 0/10 is the only rated module: the score must be 0, not 75.
    queueCounts({ assets: [10, 0] });
    const result = await caller().getComplianceScore({ organizationId: ORG.id });

    expect(result.score).toBe(0);
    expect(result.breakdown.ropa.score).toBe(0);
  });
});

describe("compliance snapshots", () => {
  it("refuses to record a snapshot when nothing is rated", async () => {
    queueCounts({});
    await expect(
      caller().createSnapshot({ organizationId: ORG.id })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

    // Nothing may reach the trend line — a placeholder would poison it.
    expect(mocks.prisma.complianceSnapshot.upsert).not.toHaveBeenCalled();
  });

  it("records a snapshot once at least one module is rated", async () => {
    queueCounts({ assets: [8, 7] });
    mocks.prisma.complianceSnapshot.upsert.mockResolvedValue({ id: "snap-1", score: 88 });

    await caller().createSnapshot({ organizationId: ORG.id });

    expect(mocks.prisma.complianceSnapshot.upsert).toHaveBeenCalledTimes(1);
    const arg = mocks.prisma.complianceSnapshot.upsert.mock.calls[0][0];
    expect(arg.create.score).toBe(88);
  });
});
