/**
 * Checkout price guard: every Stripe price a checkout session is about to
 * use must match the package it sells (id, amount, currency, interval,
 * active, recurring). A mismatch refuses the purchase before any session is
 * created. Two layers:
 *
 *  - the pure checks in src/lib/stripe-price-guard.ts, against Stripe.Price
 *    shapes;
 *  - the checkout route: verification runs before createCheckoutSession, a
 *    PriceMismatchError is a refusal with no session, and the USD override
 *    for US visitors is checked as USD at the package amount.
 *
 * Hermetic: Prisma, the Stripe helpers, next-auth's getToken and the feature
 * flags are module-mocked.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";
import { NextRequest } from "next/server";
import {
  assertPriceMatchesPackage,
  verifyPricesMatchPackages,
  PriceMismatchError,
  type CheckoutPriceLine,
} from "@/lib/stripe-price-guard";

const mocks = vi.hoisted(() => ({
  prisma: {
    organizationMember: { findFirst: vi.fn() },
    skillPackage: { findMany: vi.fn() },
    customerOrganization: { findFirst: vi.fn(), create: vi.fn() },
    customer: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
  },
  stripe: {
    createCheckoutSession: vi.fn(),
    findOrCreateCustomerByEmail: vi.fn(),
    verifyCheckoutPrices: vi.fn(),
  },
  getToken: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/stripe", () => mocks.stripe);
vi.mock("next-auth/jwt", () => ({ getToken: mocks.getToken }));
vi.mock("@/config/features", () => ({
  features: { stripeEnabled: true, selfServiceUpgrade: true },
}));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { POST } from "@/app/api/checkout/route";

const PKG_DPIA = {
  id: "skill-dpia",
  skillId: "com.nel.dpocentral.dpia",
  name: "DPIA",
  stripePriceId: "price_dpia_year",
  priceAmount: 6000,
  priceCurrency: "eur",
  billingInterval: "YEAR" as const,
};
const PKG_ROPA = {
  ...PKG_DPIA,
  id: "skill-ropa-export",
  skillId: "com.nel.dpocentral.ropa-export",
  name: "ROPA_EXPORT",
  stripePriceId: "price_ropa_year",
};

function price(overrides: Partial<Stripe.Price> = {}): Stripe.Price {
  return {
    id: "price_dpia_year",
    object: "price",
    active: true,
    currency: "eur",
    type: "recurring",
    unit_amount: 6000,
    recurring: { interval: "year", interval_count: 1 },
    ...overrides,
  } as unknown as Stripe.Price;
}

const LINE: CheckoutPriceLine = {
  priceId: "price_dpia_year",
  pkg: {
    id: PKG_DPIA.id,
    name: PKG_DPIA.name,
    priceAmount: 6000,
    priceCurrency: "eur",
    billingInterval: "YEAR",
  },
};

describe("assertPriceMatchesPackage", () => {
  it("accepts the package's own yearly price at the package amount and currency", () => {
    expect(() => assertPriceMatchesPackage(price(), LINE)).not.toThrow();
    // Currency case does not matter.
    expect(() =>
      assertPriceMatchesPackage(price({ currency: "EUR" }), {
        ...LINE,
        pkg: { ...LINE.pkg, priceCurrency: "Eur" },
      })
    ).not.toThrow();
  });

  it("refuses a different price id", () => {
    expect(() => assertPriceMatchesPackage(price({ id: "price_other" }), LINE)).toThrow(
      PriceMismatchError
    );
  });

  it("refuses a different amount (a stale monthly figure, a typo in the dashboard)", () => {
    expect(() => assertPriceMatchesPackage(price({ unit_amount: 900 }), LINE)).toThrow(
      /amount 900, expected 6000/
    );
    expect(() => assertPriceMatchesPackage(price({ unit_amount: null }), LINE)).toThrow(
      PriceMismatchError
    );
  });

  it("refuses a different currency unless the line declares that override", () => {
    expect(() => assertPriceMatchesPackage(price({ currency: "usd" }), LINE)).toThrow(
      /currency usd, expected eur/
    );
    expect(() =>
      assertPriceMatchesPackage(price({ currency: "usd" }), { ...LINE, currencyOverride: "usd" })
    ).not.toThrow();
  });

  it("refuses a monthly price for a yearly package, and a multi-year one", () => {
    expect(() =>
      assertPriceMatchesPackage(
        price({ recurring: { interval: "month", interval_count: 1 } } as Partial<Stripe.Price>),
        LINE
      )
    ).toThrow(/every 1 month, expected every 1 year/);
    expect(() =>
      assertPriceMatchesPackage(
        price({ recurring: { interval: "year", interval_count: 2 } } as Partial<Stripe.Price>),
        LINE
      )
    ).toThrow(PriceMismatchError);
  });

  it("refuses an inactive price and a one-time price", () => {
    expect(() => assertPriceMatchesPackage(price({ active: false }), LINE)).toThrow(/not active/);
    expect(() =>
      assertPriceMatchesPackage(
        price({ type: "one_time", recurring: null } as Partial<Stripe.Price>),
        LINE
      )
    ).toThrow(/one_time, expected recurring/);
  });

  it("refuses a package that carries no price of its own", () => {
    expect(() =>
      assertPriceMatchesPackage(price(), {
        ...LINE,
        pkg: { ...LINE.pkg, priceAmount: null, priceCurrency: null },
      })
    ).toThrow(/carries no price/);
  });
});

describe("verifyPricesMatchPackages", () => {
  it("fetches each distinct price once and checks every line", async () => {
    const retrieve = vi.fn(async (id: string) => price({ id }));
    const usdLine: CheckoutPriceLine = { ...LINE, priceId: "price_usd", currencyOverride: "usd" };
    await expect(
      verifyPricesMatchPackages([LINE, LINE], retrieve)
    ).resolves.toBeUndefined();
    expect(retrieve).toHaveBeenCalledTimes(1);

    retrieve.mockClear();
    retrieve.mockImplementation(async (id: string) =>
      price({ id, currency: id === "price_usd" ? "usd" : "eur" })
    );
    await expect(verifyPricesMatchPackages([usdLine, usdLine], retrieve)).resolves.toBeUndefined();
    expect(retrieve).toHaveBeenCalledTimes(1);
  });

  it("rejects on the first mismatching line", async () => {
    const retrieve = vi.fn(async (id: string) =>
      price({ id, unit_amount: id === "price_ropa_year" ? 900 : 6000 })
    );
    await expect(
      verifyPricesMatchPackages(
        [LINE, { ...LINE, priceId: "price_ropa_year", pkg: { ...LINE.pkg, id: "skill-ropa-export" } }],
        retrieve
      )
    ).rejects.toBeInstanceOf(PriceMismatchError);
  });
});

describe("checkout route", () => {
  function request(body: unknown, headers: Record<string, string> = {}) {
    return new NextRequest("http://localhost:3001/api/checkout", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json", origin: "http://localhost:3001", ...headers },
    });
  }

  beforeEach(() => {
    for (const group of Object.values(mocks.prisma)) {
      for (const fn of Object.values(group)) fn.mockReset();
    }
    for (const fn of Object.values(mocks.stripe)) fn.mockReset();
    mocks.getToken.mockReset();
    vi.unstubAllEnvs();

    mocks.getToken.mockResolvedValue({ email: "buyer@test.example", name: "Buyer" });
    mocks.prisma.organizationMember.findFirst.mockResolvedValue({ userId: "user-1" });
    // Resolve the requested ids only (the route 404s on a count mismatch).
    mocks.prisma.skillPackage.findMany.mockImplementation(async ({ where }) => {
      const wanted = new Set(
        (where.OR as { id?: string; skillId?: string }[]).flatMap((c) => [c.id, c.skillId])
      );
      return [PKG_DPIA, PKG_ROPA].filter((p) => wanted.has(p.id) || wanted.has(p.skillId));
    });
    mocks.prisma.customerOrganization.findFirst.mockResolvedValue({
      customer: { id: "cust-1", email: "buyer@test.example", stripeCustomerId: "cus_1", entitlements: [] },
    });
    mocks.prisma.auditLog.create.mockResolvedValue({});
    mocks.stripe.createCheckoutSession.mockResolvedValue({ id: "cs_1", url: "https://checkout.example/cs_1" });
    mocks.stripe.verifyCheckoutPrices.mockResolvedValue(undefined);
  });

  it("verifies every line's price against its package before creating the session", async () => {
    const res = await POST(
      request({ skillPackageIds: ["skill-dpia", "skill-ropa-export"], organizationId: "org-1" })
    );
    expect(res.status).toBe(200);

    expect(mocks.stripe.verifyCheckoutPrices).toHaveBeenCalledTimes(1);
    expect(mocks.stripe.verifyCheckoutPrices.mock.calls[0][0]).toEqual([
      {
        priceId: "price_dpia_year",
        pkg: { id: "skill-dpia", name: "DPIA", priceAmount: 6000, priceCurrency: "eur", billingInterval: "YEAR" },
        currencyOverride: undefined,
      },
      {
        priceId: "price_ropa_year",
        pkg: { id: "skill-ropa-export", name: "ROPA_EXPORT", priceAmount: 6000, priceCurrency: "eur", billingInterval: "YEAR" },
        currencyOverride: undefined,
      },
    ]);
    const verifyOrder = mocks.stripe.verifyCheckoutPrices.mock.invocationCallOrder[0];
    const createOrder = mocks.stripe.createCheckoutSession.mock.invocationCallOrder[0];
    expect(verifyOrder).toBeLessThan(createOrder);
    expect(mocks.stripe.createCheckoutSession.mock.calls[0][0].lineItems).toEqual([
      { priceId: "price_dpia_year", skillPackageId: "skill-dpia" },
      { priceId: "price_ropa_year", skillPackageId: "skill-ropa-export" },
    ]);
  });

  it("refuses the purchase on a mismatch: no session, no audit row, specifics kept out of the response", async () => {
    mocks.stripe.verifyCheckoutPrices.mockRejectedValue(
      new PriceMismatchError("price_dpia_year", "skill-dpia", "price amount 900, expected 6000")
    );
    const res = await POST(request({ skillPackageId: "skill-dpia", organizationId: "org-1" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Purchase refused: price configuration mismatch");
    expect(JSON.stringify(body)).not.toContain("price_dpia_year");
    expect(mocks.stripe.createCheckoutSession).not.toHaveBeenCalled();
    expect(mocks.prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("checks the USD override for US visitors as USD at the package amount", async () => {
    vi.stubEnv("STRIPE_PRICE_ID_USD", "price_usd_year");
    const res = await POST(
      request({ skillPackageId: "skill-dpia", organizationId: "org-1" }, { "x-vercel-ip-country": "US" })
    );
    expect(res.status).toBe(200);
    expect(mocks.stripe.verifyCheckoutPrices.mock.calls[0][0]).toEqual([
      {
        priceId: "price_usd_year",
        pkg: { id: "skill-dpia", name: "DPIA", priceAmount: 6000, priceCurrency: "eur", billingInterval: "YEAR" },
        currencyOverride: "usd",
      },
    ]);
  });
});
