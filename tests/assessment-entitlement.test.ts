/**
 * Assessment entitlement gate with more than one package per type.
 *
 * DPO Central's own DPIA module (com.nel.dpocentral.dpia) and the storefront's
 * DPIA companion (com.nel.skills.dpia-companion) both carry assessmentType
 * DPIA. The gate used to pick ONE package for the type (findFirst, no order),
 * so a licence on the other row could read as "not entitled". It must accept
 * an active entitlement on ANY active package of the type, or on the bundle.
 * Hermetic: Prisma is module-mocked; Stripe is forced on so the gate runs
 * (with Stripe off every gate answers "entitled").
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    skillPackage: { findMany: vi.fn(), findFirst: vi.fn() },
    customerOrganization: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/config/features", () => ({
  features: { stripeEnabled: true, selfServiceUpgrade: true },
}));

import { checkAssessmentEntitlement } from "@/server/services/licensing/entitlement";

const ORG_ID = "org-1";
const DPIA_PACKAGES = [{ id: "skill-dpia" }, { id: "skill-dpia-companion" }];
const COMPLETE = { id: "skill-complete", skillId: "com.nel.dpocentral.complete" };

function linkedWithEntitlements(entitlements: { skillPackageId: string; status: string; expiresAt: Date | null }[]) {
  mocks.prisma.customerOrganization.findFirst.mockImplementation(
    async ({ include }: { include: { customer: { include: { entitlements: { where: { skillPackageId: { in: string[] } } } } } } }) => {
      // Honour the query's `in` filter the way Postgres would.
      const wanted = new Set(include.customer.include.entitlements.where.skillPackageId.in);
      return {
        customer: {
          entitlements: entitlements
            .filter((e) => wanted.has(e.skillPackageId))
            .map((e) => ({ id: `ent-${e.skillPackageId}`, licenseType: "PERPETUAL", ...e })),
        },
      };
    }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.skillPackage.findMany.mockResolvedValue(DPIA_PACKAGES);
  mocks.prisma.skillPackage.findFirst.mockResolvedValue(COMPLETE);
});

describe("checkAssessmentEntitlement with several packages per type", () => {
  it("queries every active package of the type, not the first one", async () => {
    linkedWithEntitlements([]);
    await checkAssessmentEntitlement(ORG_ID, "DPIA");

    expect(mocks.prisma.skillPackage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { assessmentType: "DPIA", isActive: true } })
    );
    const query = mocks.prisma.customerOrganization.findFirst.mock.calls[0][0];
    expect(query.include.customer.include.entitlements.where.skillPackageId.in).toEqual([
      "skill-dpia",
      "skill-dpia-companion",
      "skill-complete",
    ]);
  });

  it("a licence on the storefront companion row unlocks DPIA", async () => {
    linkedWithEntitlements([
      { skillPackageId: "skill-dpia-companion", status: "ACTIVE", expiresAt: null },
    ]);
    const result = await checkAssessmentEntitlement(ORG_ID, "DPIA");
    expect(result.entitled).toBe(true);
    expect(result.entitlement?.id).toBe("ent-skill-dpia-companion");
  });

  it("a licence on DPO Central's own DPIA row still unlocks DPIA", async () => {
    linkedWithEntitlements([{ skillPackageId: "skill-dpia", status: "ACTIVE", expiresAt: null }]);
    const result = await checkAssessmentEntitlement(ORG_ID, "DPIA");
    expect(result.entitled).toBe(true);
    expect(result.entitlement?.id).toBe("ent-skill-dpia");
  });

  it("the bundle still unlocks the type", async () => {
    linkedWithEntitlements([{ skillPackageId: "skill-complete", status: "ACTIVE", expiresAt: null }]);
    const result = await checkAssessmentEntitlement(ORG_ID, "DPIA");
    expect(result.entitled).toBe(true);
  });

  it("an expired licence on either row does not unlock", async () => {
    linkedWithEntitlements([
      { skillPackageId: "skill-dpia-companion", status: "ACTIVE", expiresAt: new Date("2020-01-01") },
    ]);
    const result = await checkAssessmentEntitlement(ORG_ID, "DPIA");
    expect(result.entitled).toBe(false);
  });

  it("no package of the type at all reads as not entitled", async () => {
    mocks.prisma.skillPackage.findMany.mockResolvedValue([]);
    const result = await checkAssessmentEntitlement(ORG_ID, "DPIA");
    expect(result).toMatchObject({ entitled: false, reason: "No skill package found for DPIA" });
    expect(mocks.prisma.customerOrganization.findFirst).not.toHaveBeenCalled();
  });

  it("works without a bundle row", async () => {
    mocks.prisma.skillPackage.findFirst.mockResolvedValue(null);
    linkedWithEntitlements([
      { skillPackageId: "skill-dpia-companion", status: "ACTIVE", expiresAt: null },
    ]);
    const result = await checkAssessmentEntitlement(ORG_ID, "DPIA");
    expect(result.entitled).toBe(true);
    const query = mocks.prisma.customerOrganization.findFirst.mock.calls[0][0];
    expect(query.include.customer.include.entitlements.where.skillPackageId.in).toEqual([
      "skill-dpia",
      "skill-dpia-companion",
    ]);
  });
});
