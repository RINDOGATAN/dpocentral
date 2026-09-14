/**
 * Stripe webhook: the guarantees reconciled with the sibling suite apps.
 *
 *  D1  invoice.payment_failed suspends only the SUBSCRIPTION rows of the
 *      failed subscription — never an offline (PERPETUAL) licence.
 *  D2  Stripe writers never rewrite a PERPETUAL row, nor a row on another
 *      subscription; rows with no billing source (TRIAL grace) are taken over.
 *  D3  Idempotency: the event id is written first, in the same transaction;
 *      a redelivery is a no-op that touches no entitlement.
 *
 * Hermetic: Prisma and the Stripe client are module-mocked; the transaction
 * mock runs the callback against the same mocked client.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import type Stripe from "stripe";

const mocks = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
    processedStripeEvent: { create: vi.fn() },
    customer: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    customerOrganization: { upsert: vi.fn() },
    skillEntitlement: { findUnique: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() },
  },
  stripe: { verifyWebhookSignature: vi.fn(), getSubscription: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/stripe", () => mocks.stripe);
vi.mock("@/config/features", () => ({ features: { stripeEnabled: true } }));
vi.mock("next/headers", () => ({ headers: async () => ({ get: () => "sig" }) }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { processStripeEvent, invoiceSubscriptionId } from "@/app/api/webhooks/stripe/route";

const CUSTOMER = { id: "cust-1", email: "buyer@test.example", stripeCustomerId: "cus_1" };

function event<T>(type: string, object: T, id = "evt_1"): Stripe.Event {
  return { id, type, data: { object } } as unknown as Stripe.Event;
}

beforeEach(() => {
  for (const group of Object.values(mocks.prisma)) {
    if (typeof group === "function") continue;
    for (const fn of Object.values(group)) fn.mockReset();
  }
  mocks.prisma.$transaction.mockReset();
  mocks.stripe.getSubscription.mockReset();
  // Interactive transaction: run the callback against the mocked client.
  mocks.prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
    fn(mocks.prisma)
  );
  mocks.prisma.processedStripeEvent.create.mockResolvedValue({});
  mocks.prisma.customer.findFirst.mockResolvedValue(CUSTOMER);
  mocks.prisma.skillEntitlement.updateMany.mockResolvedValue({ count: 1 });
});

describe("invoiceSubscriptionId", () => {
  it("reads the current API shape and the legacy field", () => {
    expect(
      invoiceSubscriptionId({
        parent: { subscription_details: { subscription: "sub_new" } },
      } as unknown as Stripe.Invoice)
    ).toBe("sub_new");
    expect(
      invoiceSubscriptionId({ subscription: { id: "sub_old" } } as unknown as Stripe.Invoice)
    ).toBe("sub_old");
    expect(invoiceSubscriptionId({} as Stripe.Invoice)).toBeNull();
  });
});

describe("D1 — invoice.payment_failed", () => {
  it("suspends only SUBSCRIPTION rows of the failed subscription", async () => {
    await processStripeEvent(
      event("invoice.payment_failed", {
        customer: "cus_1",
        parent: { subscription_details: { subscription: "sub_1" } },
      })
    );

    expect(mocks.prisma.skillEntitlement.updateMany).toHaveBeenCalledTimes(1);
    const { where, data } = mocks.prisma.skillEntitlement.updateMany.mock.calls[0][0];
    expect(data).toEqual({ status: "SUSPENDED" });
    expect(where).toMatchObject({
      customerId: "cust-1",
      status: "ACTIVE",
      licenseType: "SUBSCRIPTION",
      stripeSubscriptionId: "sub_1",
    });
  });

  it("without a subscription reference, still never touches rows with no subscription id", async () => {
    await processStripeEvent(event("invoice.payment_failed", { customer: "cus_1" }));
    const { where } = mocks.prisma.skillEntitlement.updateMany.mock.calls[0][0];
    expect(where.licenseType).toBe("SUBSCRIPTION");
    expect(where.stripeSubscriptionId).toEqual({ not: null });
  });
});

describe("D2 — Stripe writers and rows they do not own", () => {
  const subscription = {
    id: "sub_1",
    status: "active",
    customer: "cus_1",
    current_period_end: 1_800_000_000,
    metadata: { organizationId: "org-1", skillPackageIds: "pkg-perpetual,pkg-other-sub,pkg-trial,pkg-new" },
  };

  it("skips PERPETUAL rows and rows on another subscription; takes over TRIAL and new rows", async () => {
    mocks.prisma.skillEntitlement.findUnique.mockImplementation(async ({ where }) => {
      const id = where.customerId_skillPackageId.skillPackageId;
      if (id === "pkg-perpetual") return { stripeSubscriptionId: null, licenseType: "PERPETUAL" };
      if (id === "pkg-other-sub") return { stripeSubscriptionId: "sub_9", licenseType: "SUBSCRIPTION" };
      if (id === "pkg-trial") return { stripeSubscriptionId: null, licenseType: "TRIAL" };
      return null;
    });

    await processStripeEvent(event("customer.subscription.updated", subscription));

    const written = mocks.prisma.skillEntitlement.upsert.mock.calls.map(
      (c) => c[0].where.customerId_skillPackageId.skillPackageId
    );
    expect(written).toEqual(["pkg-trial", "pkg-new"]);
    for (const call of mocks.prisma.skillEntitlement.upsert.mock.calls) {
      expect(call[0].update).toMatchObject({
        licenseType: "SUBSCRIPTION",
        stripeSubscriptionId: "sub_1",
        status: "ACTIVE",
        expiresAt: new Date(1_800_000_000 * 1000),
      });
    }
  });

  it("subscription.deleted expires only the rows on that subscription", async () => {
    await processStripeEvent(
      event("customer.subscription.deleted", {
        id: "sub_1",
        customer: "cus_1",
        metadata: { skillPackageIds: "pkg-a,pkg-b" },
      })
    );
    const { where } = mocks.prisma.skillEntitlement.updateMany.mock.calls[0][0];
    expect(where).toMatchObject({
      customerId: "cust-1",
      skillPackageId: { in: ["pkg-a", "pkg-b"] },
      stripeSubscriptionId: "sub_1",
    });
  });

  it("checkout.session.completed fetches the subscription before the transaction and writes the period end", async () => {
    mocks.stripe.getSubscription.mockResolvedValue({
      id: "sub_1",
      current_period_end: 1_800_000_000,
    });
    mocks.prisma.customer.findUnique.mockResolvedValue(CUSTOMER);
    mocks.prisma.customerOrganization.upsert.mockResolvedValue({});
    mocks.prisma.skillEntitlement.findUnique.mockResolvedValue(null);

    await processStripeEvent(
      event("checkout.session.completed", {
        id: "cs_1",
        subscription: "sub_1",
        customer: "cus_1",
        customer_email: CUSTOMER.email,
        metadata: { organizationId: "org-1", customerId: "cust-1", skillPackageIds: "pkg-a" },
      })
    );

    expect(mocks.stripe.getSubscription).toHaveBeenCalledWith("sub_1");
    const txOrder = mocks.prisma.$transaction.mock.invocationCallOrder[0];
    const stripeOrder = mocks.stripe.getSubscription.mock.invocationCallOrder[0];
    expect(stripeOrder).toBeLessThan(txOrder);

    expect(mocks.prisma.skillEntitlement.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.skillEntitlement.upsert.mock.calls[0][0].create).toMatchObject({
      customerId: "cust-1",
      skillPackageId: "pkg-a",
      licenseType: "SUBSCRIPTION",
      status: "ACTIVE",
      stripeSubscriptionId: "sub_1",
      expiresAt: new Date(1_800_000_000 * 1000),
    });
  });
});

describe("D3 — idempotency", () => {
  it("records the event id before any entitlement write", async () => {
    await processStripeEvent(
      event("customer.subscription.deleted", {
        id: "sub_1",
        customer: "cus_1",
        metadata: { skillPackageIds: "pkg-a" },
      }, "evt_42")
    );
    expect(mocks.prisma.processedStripeEvent.create).toHaveBeenCalledWith({
      data: { id: "evt_42", type: "customer.subscription.deleted" },
    });
    const markerOrder = mocks.prisma.processedStripeEvent.create.mock.invocationCallOrder[0];
    const writeOrder = mocks.prisma.skillEntitlement.updateMany.mock.invocationCallOrder[0];
    expect(markerOrder).toBeLessThan(writeOrder);
  });

  it("a redelivered event is a no-op and reports duplicate", async () => {
    mocks.prisma.processedStripeEvent.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("duplicate", {
        code: "P2002",
        clientVersion: "test",
      })
    );

    const outcome = await processStripeEvent(
      event("customer.subscription.deleted", {
        id: "sub_1",
        customer: "cus_1",
        metadata: { skillPackageIds: "pkg-a" },
      })
    );

    expect(outcome).toEqual({ duplicate: true });
    expect(mocks.prisma.skillEntitlement.updateMany).not.toHaveBeenCalled();
    expect(mocks.prisma.skillEntitlement.upsert).not.toHaveBeenCalled();
  });

  it("any other failure propagates so Stripe retries", async () => {
    mocks.prisma.processedStripeEvent.create.mockRejectedValue(new Error("db down"));
    await expect(
      processStripeEvent(event("customer.subscription.deleted", { id: "sub_1", customer: "cus_1", metadata: {} }))
    ).rejects.toThrow("db down");
  });
});
