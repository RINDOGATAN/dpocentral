/**
 * Stripe webhook: the guarantees reconciled with the sibling suite apps.
 *
 *  D1  invoice.payment_failed suspends only the SUBSCRIPTION rows of the
 *      failed subscription — never an offline (PERPETUAL) licence.
 *  D2  Stripe writers never rewrite a PERPETUAL row, nor a row on another
 *      subscription; rows with no billing source (TRIAL grace) are taken over.
 *  D3  Idempotency: the event id is written first, in the same transaction;
 *      a redelivery is a no-op that touches no entitlement.
 *  D6  Foreign events: the suite shares one Stripe account, so an event of
 *      another app (its `metadata.app`, or skill package ids unknown here)
 *      is a 200 no-op — no Stripe fetch, no transaction, no write.
 *
 * Hermetic: Prisma and the Stripe client are module-mocked; the transaction
 * mock runs the callback against the same mocked client.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import type Stripe from "stripe";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
    processedStripeEvent: { create: vi.fn() },
    customer: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    customerOrganization: { upsert: vi.fn() },
    skillEntitlement: { findUnique: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() },
    skillPackage: { findMany: vi.fn() },
  },
  stripe: { verifyWebhookSignature: vi.fn(), getSubscription: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/stripe", () => mocks.stripe);
vi.mock("@/config/features", () => ({ features: { stripeEnabled: true } }));
vi.mock("next/headers", () => ({ headers: async () => ({ get: () => "sig" }) }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import {
  POST,
  processStripeEvent,
  invoiceSubscriptionId,
  classifyEventOwnership,
} from "@/app/api/webhooks/stripe/route";

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
  // Ownership fallback: by default every skill package id an event names
  // exists in this database (D6 overrides this per case).
  mocks.prisma.skillPackage.findMany.mockImplementation(async ({ where }) =>
    (where.OR as { id?: string }[])
      .filter((clause) => clause.id)
      .map((clause) => ({ id: clause.id, skillId: `com.nel.dpocentral.${clause.id}` }))
  );
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

    expect(outcome).toEqual({ duplicate: true, ignored: false });
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

describe("D6 — events of another suite app are a 200 no-op", () => {
  function expectUntouched() {
    expect(mocks.stripe.getSubscription).not.toHaveBeenCalled();
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect(mocks.prisma.processedStripeEvent.create).not.toHaveBeenCalled();
    expect(mocks.prisma.skillEntitlement.upsert).not.toHaveBeenCalled();
    expect(mocks.prisma.skillEntitlement.updateMany).not.toHaveBeenCalled();
    expect(mocks.prisma.customerOrganization.upsert).not.toHaveBeenCalled();
  }

  it("another app's marker on a subscription event: ignored before any fetch or write", async () => {
    const outcome = await processStripeEvent(
      event("customer.subscription.updated", {
        id: "sub_ai",
        status: "active",
        customer: "cus_1", // the SAME Stripe customer: one account, one buyer
        metadata: { app: "aisentinel", organizationId: "org-ai", skillPackageIds: "skill-dpia" },
      })
    );
    expect(outcome).toEqual({ duplicate: false, ignored: true });
    expectUntouched();
  });

  it("another app's marker on a checkout session: no subscription fetch", async () => {
    const outcome = await processStripeEvent(
      event("checkout.session.completed", {
        id: "cs_ai",
        subscription: "sub_ai",
        customer: "cus_1",
        customer_email: CUSTOMER.email,
        metadata: { app: "dealroom", organizationId: "org-x", skillPackageIds: "skill-x" },
      })
    );
    expect(outcome).toEqual({ duplicate: false, ignored: true });
    expectUntouched();
  });

  it("another app's marker mirrored on a failed invoice: nothing suspended, no e-mail", async () => {
    const outcome = await processStripeEvent(
      event("invoice.payment_failed", {
        customer: "cus_1",
        parent: {
          subscription_details: {
            subscription: "sub_ai",
            metadata: { app: "aisentinel", skillPackageIds: "skill-x" },
          },
        },
      })
    );
    expect(outcome).toEqual({ duplicate: false, ignored: true });
    expectUntouched();
  });

  it("no marker and skill package ids unknown here: ignored", async () => {
    mocks.prisma.skillPackage.findMany.mockResolvedValue([]);
    const outcome = await processStripeEvent(
      event("customer.subscription.created", {
        id: "sub_9",
        status: "active",
        customer: "cus_1",
        metadata: { organizationId: "org-9", skillPackageIds: "ai-inventory,ai-registry" },
      })
    );
    expect(outcome).toEqual({ duplicate: false, ignored: true });
    expectUntouched();
    expect(mocks.prisma.skillPackage.findMany).toHaveBeenCalledTimes(1);
  });

  it("no marker and only some ids resolve here: ignored (conservative)", async () => {
    mocks.prisma.skillPackage.findMany.mockResolvedValue([
      { id: "skill-dpia", skillId: "com.nel.dpocentral.dpia" },
    ]);
    const ownership = await classifyEventOwnership(
      event("customer.subscription.updated", {
        id: "sub_9",
        customer: "cus_1",
        metadata: { skillPackageIds: "skill-dpia,ai-registry" },
      })
    );
    expect(ownership).toEqual({
      ours: false,
      reason: "unknown-skill-packages",
      detail: "ai-registry",
    });
  });

  it("our marker settles ownership without a database lookup; ids resolving by skillId are ours too", async () => {
    expect(
      await classifyEventOwnership(
        event("customer.subscription.updated", {
          id: "sub_1",
          customer: "cus_1",
          metadata: { app: "dpocentral", skillPackageIds: "anything" },
        })
      )
    ).toEqual({ ours: true });
    expect(mocks.prisma.skillPackage.findMany).not.toHaveBeenCalled();

    mocks.prisma.skillPackage.findMany.mockResolvedValue([
      { id: "skill-dpia", skillId: "com.nel.dpocentral.dpia" },
    ]);
    expect(
      await classifyEventOwnership(
        event("customer.subscription.updated", {
          id: "sub_1",
          customer: "cus_1",
          metadata: { skillPackageIds: "com.nel.dpocentral.dpia" },
        })
      )
    ).toEqual({ ours: true });
  });

  it("our own events still flow: no marker, ids known here", async () => {
    await processStripeEvent(
      event("customer.subscription.deleted", {
        id: "sub_1",
        customer: "cus_1",
        metadata: { skillPackageIds: "skill-dpia" },
      })
    );
    expect(mocks.prisma.skillEntitlement.updateMany).toHaveBeenCalledTimes(1);
  });

  it("POST answers 200 with ignored:true so Stripe does not retry", async () => {
    mocks.stripe.verifyWebhookSignature.mockReturnValue(
      event("customer.subscription.updated", {
        id: "sub_ai",
        status: "active",
        customer: "cus_1",
        metadata: { app: "aisentinel", skillPackageIds: "skill-x" },
      })
    );
    const res = await POST(
      new NextRequest("http://localhost:3001/api/webhooks/stripe", { method: "POST", body: "{}" })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true, duplicate: false, ignored: true });
    expectUntouched();
  });
});
