// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Checkout price guard.
 *
 * Before a Checkout Session is created, every Stripe price the session is
 * about to use is fetched and compared with the skill package it is meant to
 * sell. A mismatch (wrong id, wrong amount, wrong currency, wrong interval,
 * inactive or one-time price) refuses the purchase instead of charging the
 * buyer a figure the app never advertised. Configuration drift is the risk:
 * `skill_packages.stripePriceId` is filled from env at seed time and the price
 * itself lives in the Stripe dashboard, so nothing else ties the two together.
 *
 * Leaf module: no Stripe client, so the checks are unit-testable and the
 * checkout route can identify the error class while the client is mocked.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import type Stripe from "stripe";

/** What the package row promises the buyer. */
export interface PackagePriceExpectation {
  /** Package DB id, for messages only. */
  id: string;
  /** Package name, for messages only. */
  name: string;
  /** Minor units per billing interval (6000 = 60.00); null = not priced. */
  priceAmount: number | null;
  /** ISO currency, any case; null = not priced. */
  priceCurrency: string | null;
  billingInterval: "MONTH" | "YEAR";
}

/** One line the checkout session is about to carry. */
export interface CheckoutPriceLine {
  /** The Stripe price id the session will use for this package. */
  priceId: string;
  pkg: PackagePriceExpectation;
  /**
   * Currency the line is allowed to be billed in when it differs from the
   * package's own (the single USD price served to US visitors). Absent =
   * the package currency.
   */
  currencyOverride?: string;
}

export class PriceMismatchError extends Error {
  readonly priceId: string;
  readonly packageId: string;

  constructor(priceId: string, packageId: string, detail: string) {
    super(`Stripe price ${priceId} does not match package ${packageId}: ${detail}`);
    this.name = "PriceMismatchError";
    this.priceId = priceId;
    this.packageId = packageId;
  }
}

const INTERVAL_OF: Record<PackagePriceExpectation["billingInterval"], Stripe.Price.Recurring.Interval> = {
  MONTH: "month",
  YEAR: "year",
};

/**
 * Throw unless `price` is exactly what `line` promises: same id, active,
 * recurring at the package interval (interval_count 1), same amount in
 * minor units, and the package currency (or the declared override).
 */
export function assertPriceMatchesPackage(price: Stripe.Price, line: CheckoutPriceLine): void {
  const { pkg, priceId } = line;
  const fail = (detail: string) => new PriceMismatchError(priceId, pkg.id, detail);

  if (price.id !== priceId) {
    throw fail(`Stripe returned price ${price.id}`);
  }
  if (pkg.priceAmount === null || pkg.priceCurrency === null) {
    throw fail("package carries no price");
  }
  if (!price.active) {
    throw fail("price is not active");
  }
  if (price.type !== "recurring" || !price.recurring) {
    throw fail(`price is ${price.type}, expected recurring`);
  }
  const expectedInterval = INTERVAL_OF[pkg.billingInterval];
  if (price.recurring.interval !== expectedInterval || price.recurring.interval_count !== 1) {
    throw fail(
      `price recurs every ${price.recurring.interval_count} ${price.recurring.interval}, expected every 1 ${expectedInterval}`
    );
  }
  if (price.unit_amount !== pkg.priceAmount) {
    throw fail(`price amount ${price.unit_amount ?? "null"}, expected ${pkg.priceAmount}`);
  }
  const expectedCurrency = (line.currencyOverride ?? pkg.priceCurrency).toLowerCase();
  if (price.currency.toLowerCase() !== expectedCurrency) {
    throw fail(`price currency ${price.currency}, expected ${expectedCurrency}`);
  }
}

/**
 * Fetch each distinct price once and check every line against it. Rejects
 * with the first PriceMismatchError; a retrieval failure propagates as-is.
 */
export async function verifyPricesMatchPackages(
  lines: CheckoutPriceLine[],
  retrievePrice: (priceId: string) => Promise<Stripe.Price>
): Promise<void> {
  const prices = new Map<string, Stripe.Price>();
  for (const line of lines) {
    let price = prices.get(line.priceId);
    if (!price) {
      price = await retrievePrice(line.priceId);
      prices.set(line.priceId, price);
    }
    assertPriceMatchesPackage(price, line);
  }
}
