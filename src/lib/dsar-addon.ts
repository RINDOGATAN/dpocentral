// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The rights-request volume upgrade (hosted service): the public form's
 * monthly ceiling rises from 100 to 1,000 requests
 * (src/server/services/dsar/module.ts).
 *
 * The price: the same figure in the currency the customer is charged in
 * (src/lib/region.ts: euros for visitors in the EU, US dollars for everyone
 * else). Shared by the server module and client pages.
 *
 * The purchase: a Stripe payment link per currency, from
 * DSAR_VOLUME_EUR_LINK and DSAR_VOLUME_USD_LINK (no link is written in the
 * code). Unset, the app offers no purchase button and says to write to us.
 * The payment is recorded on the organisation by the operator's script
 * (scripts/set-dsar-module.ts --status ACTIVE).
 */

import type { Currency } from "@/lib/region";

export const DSAR_VOLUME_UPGRADE_MONTHLY_PRICE = 45;

/** Public-form requests an organisation may receive per calendar month. */
export const STANDARD_PUBLIC_REQUESTS_PER_MONTH = 100;
/** The same, with the volume upgrade. */
export const UPGRADED_PUBLIC_REQUESTS_PER_MONTH = 1000;

type Env = Record<string, string | undefined>;

function httpsLink(value: string | undefined): string | null {
  const link = (value ?? "").trim();
  return /^https:\/\/\S+$/.test(link) ? link : null;
}

/** The upgrade's payment link per currency; null where it is not set. */
export function volumeUpgradeLinks(env: Env = process.env): Record<Currency, string | null> {
  return {
    EUR: httpsLink(env.DSAR_VOLUME_EUR_LINK),
    USD: httpsLink(env.DSAR_VOLUME_USD_LINK),
  };
}

/**
 * The link the organisation's buyer follows: the payment link with the
 * organisation as Stripe's client reference (so the operator can match the
 * payment) and the buyer's e-mail prefilled.
 */
export function volumeUpgradeCheckoutUrl(
  link: string,
  organizationId: string,
  email: string | null | undefined
): string {
  const url = new URL(link);
  url.searchParams.set("client_reference_id", `dpc-dsar-${organizationId}`.replace(/[^A-Za-z0-9_-]/g, "_"));
  if (email) url.searchParams.set("prefilled_email", email);
  return url.toString();
}
