/**
 * Flip-day paywall grace (scripts/grant-paywall-grace.ts via
 * src/server/services/licensing/paywall-grace.ts).
 *
 * Locks: only organizations created before the flip; only modules in use
 * before the flip; only where no live entitlement exists; TRIAL rows with
 * expiresAt = flip + days and no Stripe link; a second run writes nothing.
 * Hermetic: the Prisma client is a hand-rolled mock.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  applyPaywallGrace,
  graceExpiry,
  modulesInUse,
  planPaywallGrace,
} from "@/server/services/licensing/paywall-grace";

const FLIP = new Date("2026-10-01T00:00:00Z");

const PACKAGES = [
  { id: "pkg-dpia", skillId: "com.nel.dpocentral.dpia", assessmentType: "DPIA" as const },
  { id: "pkg-pia", skillId: "com.nel.dpocentral.pia", assessmentType: "PIA" as const },
  { id: "pkg-catalog", skillId: "com.nel.dpocentral.vendor-catalog", assessmentType: null },
  { id: "pkg-ropa", skillId: "com.nel.dpocentral.ropa-export", assessmentType: null },
  { id: "pkg-complete", skillId: "com.nel.dpocentral.complete", assessmentType: null },
];

function makeDb() {
  return {
    skillPackage: { findMany: vi.fn().mockResolvedValue(PACKAGES) },
    organization: { findMany: vi.fn() },
    assessment: { findMany: vi.fn().mockResolvedValue([]) },
    vendor: { count: vi.fn().mockResolvedValue(0) },
    processingActivity: { count: vi.fn().mockResolvedValue(0) },
    customerOrganization: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
    customer: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
    skillEntitlement: { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn() },
  };
}
type Db = ReturnType<typeof makeDb>;
const asDb = (db: Db) => db as unknown as Parameters<typeof planPaywallGrace>[0];

const owner = (email: string) => ({ role: "OWNER", user: { email, name: "Owner" } });

let db: Db;
beforeEach(() => {
  db = makeDb();
});

describe("graceExpiry", () => {
  it("is flip + days", () => {
    expect(graceExpiry(FLIP, 30)).toEqual(new Date("2026-10-31T00:00:00Z"));
  });
});

describe("modulesInUse", () => {
  it("maps rows created before the flip to packages, never the bundle", async () => {
    db.assessment.findMany.mockResolvedValue([{ template: { type: "DPIA" } }]);
    db.vendor.count.mockResolvedValue(3);
    const used = await modulesInUse(asDb(db), "org-1", FLIP, PACKAGES);
    expect(used.map((u) => u.id)).toEqual(["pkg-dpia", "pkg-catalog"]);
    // Every lookup is bounded by the flip date.
    expect(db.assessment.findMany.mock.calls[0][0].where.createdAt).toEqual({ lt: FLIP });
    expect(db.vendor.count.mock.calls[0][0].where.createdAt).toEqual({ lt: FLIP });
    expect(db.processingActivity.count.mock.calls[0][0].where.createdAt).toEqual({ lt: FLIP });
  });
});

describe("planPaywallGrace", () => {
  it("only considers organizations created before the flip and sellable packages", async () => {
    db.organization.findMany.mockResolvedValue([]);
    await planPaywallGrace(asDb(db), { flipAt: FLIP, days: 30 });
    expect(db.organization.findMany.mock.calls[0][0].where).toEqual({ createdAt: { lt: FLIP } });
    expect(db.skillPackage.findMany.mock.calls[0][0].where).toMatchObject({
      isPremium: true,
      isActive: true,
      priceAmount: { not: null },
    });
  });

  it("grants one TRIAL per module in use, skipping modules already live", async () => {
    db.organization.findMany.mockResolvedValue([
      {
        id: "org-live",
        members: [owner("a@test.example")],
        customerLinks: [
          {
            customer: {
              id: "cust-a",
              email: "a@test.example",
              name: "A",
              entitlements: [{ skillPackageId: "pkg-dpia" }],
            },
          },
        ],
      },
      { id: "org-unused", members: [owner("b@test.example")], customerLinks: [] },
      { id: "org-no-owner", members: [], customerLinks: [] },
    ]);
    db.assessment.findMany.mockImplementation(async ({ where }) =>
      where.organizationId === "org-live"
        ? [{ template: { type: "DPIA" } }, { template: { type: "PIA" } }]
        : []
    );
    db.processingActivity.count.mockImplementation(async ({ where }) =>
      where.organizationId === "org-no-owner" ? 2 : 0
    );

    const plan = await planPaywallGrace(asDb(db), { flipAt: FLIP, days: 30 });

    expect(plan.expiresAt).toEqual(new Date("2026-10-31T00:00:00Z"));
    // org-live: DPIA is live already, PIA is granted.
    expect(plan.entries).toEqual([
      expect.objectContaining({
        organizationId: "org-live",
        buyerEmail: "a@test.example",
        packageId: "pkg-pia",
        skillId: "com.nel.dpocentral.pia",
        expiresAt: plan.expiresAt,
      }),
    ]);
    expect(plan.skipped).toEqual([
      { organizationId: "org-unused", reason: "no premium module in use" },
      { organizationId: "org-no-owner", reason: "no owner or admin with an e-mail" },
    ]);
  });
});

describe("applyPaywallGrace", () => {
  const plan = {
    flipAt: FLIP,
    days: 30,
    expiresAt: graceExpiry(FLIP, 30),
    entries: [
      {
        organizationId: "org-1",
        buyerEmail: "a@test.example",
        buyerName: "A",
        packageId: "pkg-dpia",
        skillId: "com.nel.dpocentral.dpia",
        expiresAt: graceExpiry(FLIP, 30),
      },
    ],
    skipped: [],
  };

  it("creates the Customer when none exists and writes a TRIAL row with no Stripe link", async () => {
    db.customer.create.mockResolvedValue({ id: "cust-new", email: "a@test.example" });

    const result = await applyPaywallGrace(asDb(db), plan);

    expect(result).toEqual({ created: 1, skipped: 0 });
    expect(db.customer.create.mock.calls[0][0].data).toMatchObject({
      email: "a@test.example",
      type: "SAAS",
      organizations: { create: { organizationId: "org-1" } },
    });
    const upsert = db.skillEntitlement.upsert.mock.calls[0][0];
    expect(upsert.create).toEqual({
      customerId: "cust-new",
      skillPackageId: "pkg-dpia",
      licenseType: "TRIAL",
      status: "ACTIVE",
      expiresAt: plan.expiresAt,
    });
    expect(upsert.update).toMatchObject({ licenseType: "TRIAL", stripeSubscriptionId: null });
  });

  it("links an existing Customer found by e-mail instead of creating one", async () => {
    db.customer.findUnique.mockResolvedValue({ id: "cust-a", email: "a@test.example" });
    await applyPaywallGrace(asDb(db), plan);
    expect(db.customer.create).not.toHaveBeenCalled();
    expect(db.customerOrganization.create).toHaveBeenCalledWith({
      data: { customerId: "cust-a", organizationId: "org-1" },
    });
  });

  it("is idempotent: a live row is left alone on a second run", async () => {
    db.customerOrganization.findFirst.mockResolvedValue({
      customer: { id: "cust-a", email: "a@test.example" },
    });
    db.skillEntitlement.findUnique.mockResolvedValue({
      status: "ACTIVE",
      expiresAt: new Date("2027-01-01T00:00:00Z"),
    });
    const result = await applyPaywallGrace(asDb(db), plan);
    expect(result).toEqual({ created: 0, skipped: 1 });
    expect(db.skillEntitlement.upsert).not.toHaveBeenCalled();
  });
});
