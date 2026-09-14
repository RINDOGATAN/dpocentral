// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Stripe Webhook Handler
 *
 * Processes Stripe webhook events to create/update entitlements.
 *
 * Guarantees (shared design with the sibling suite apps, 2026-09-13):
 *  - Idempotent: the Stripe event id is recorded in `processed_stripe_events`
 *    in the SAME transaction as the entitlement writes it causes. A
 *    redelivery finds the id and changes nothing.
 *  - Stripe writers never touch an entitlement they do not own: a PERPETUAL
 *    row (offline licence) is never rewritten, and rows on another
 *    subscription are left alone. Only rows on this subscription, or rows
 *    with no billing source yet (TRIAL grace, admin grants), follow Stripe.
 *  - `invoice.payment_failed` suspends only the SUBSCRIPTION rows of the
 *    failed subscription, never an offline licence the customer also holds.
 *  - Foreign events are a 200 no-op: the suite's apps share ONE Stripe
 *    account, so this endpoint receives every app's events. An event whose
 *    metadata names another app, or whose skill package ids do not resolve
 *    in this database, is acknowledged and ignored before any write. (A
 *    failure would make Stripe retry it for days.)
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { Resend } from "resend";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { verifyWebhookSignature, getSubscription } from "@/lib/stripe";
import { features } from "@/config/features";
import { BILLING_APP_ID } from "@/config/skill-packages";
import { brand, emailFrom, emailFooterHtml } from "@/config/brand";
import { logger } from "@/lib/logger";

type Db = Prisma.TransactionClient;

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

/** Interactive-transaction budget; the handlers do no network calls inside it. */
const TRANSACTION_TIMEOUT_MS = 15_000;

/**
 * Parse skill package IDs from metadata (supports both legacy single and new multi format)
 */
function parseSkillPackageIds(metadata: Record<string, string> | null): string[] {
  if (!metadata) return [];
  if (metadata.skillPackageIds) {
    return metadata.skillPackageIds.split(",").filter(Boolean);
  }
  if (metadata.skillPackageId) {
    return [metadata.skillPackageId];
  }
  return [];
}

type EventMetadata = Record<string, string> | null;

/**
 * The metadata that names the app and the skill packages an event is about.
 * Checkout sessions and subscriptions carry it directly; an invoice mirrors
 * its subscription's metadata under `parent.subscription_details.metadata`
 * (older API versions: `subscription_details.metadata`).
 */
function eventMetadata(event: Stripe.Event): EventMetadata {
  switch (event.type) {
    case "checkout.session.completed":
      return ((event.data.object as Stripe.Checkout.Session).metadata ?? null) as EventMetadata;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return ((event.data.object as Stripe.Subscription).metadata ?? null) as EventMetadata;
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const legacy = (
        invoice as unknown as { subscription_details?: { metadata?: EventMetadata } | null }
      ).subscription_details?.metadata;
      return (invoice.parent?.subscription_details?.metadata ?? legacy ?? null) as EventMetadata;
    }
    default:
      return null;
  }
}

export type EventOwnership =
  | { ours: true }
  | { ours: false; reason: "foreign-app" | "unknown-skill-packages"; detail: string };

/**
 * Decide whether an event belongs to this app. Two signals, in order:
 *  1. `metadata.app` — written by this app's checkout since 2026-09-13; a
 *     different value is another suite app's event, our own value settles it.
 *  2. Without a marker (a sibling app that does not write one, or a session
 *     created before the marker), the skill package ids: every id must
 *     resolve to a `skill_packages` row here (by id or skillId). A list that
 *     resolves only in part is treated as foreign (conservative: an id
 *     collision with a sibling's seed must not grant anything here).
 * Events carrying neither a marker nor skill package ids (an invoice with no
 * subscription reference, an unhandled type) are left to the handlers, which
 * already no-op when nothing here matches.
 */
export async function classifyEventOwnership(event: Stripe.Event): Promise<EventOwnership> {
  const metadata = eventMetadata(event);
  const app = metadata?.app;
  if (app && app !== BILLING_APP_ID) {
    return { ours: false, reason: "foreign-app", detail: app };
  }
  if (app === BILLING_APP_ID) {
    return { ours: true };
  }

  const ids = parseSkillPackageIds(metadata);
  if (!ids.length) {
    return { ours: true };
  }
  const rows = await prisma.skillPackage.findMany({
    where: { OR: ids.flatMap((id) => [{ id }, { skillId: id }]) },
    select: { id: true, skillId: true },
  });
  const known = new Set<string>();
  for (const row of rows) {
    known.add(row.id);
    known.add(row.skillId);
  }
  const unknown = ids.filter((id) => !known.has(id));
  if (unknown.length) {
    return { ours: false, reason: "unknown-skill-packages", detail: unknown.join(",") };
  }
  return { ours: true };
}

/**
 * The subscription an invoice belongs to. Older API versions expose
 * `invoice.subscription`; the current one moves it under
 * `invoice.parent.subscription_details.subscription`. Handle both.
 */
export function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const legacy = (invoice as unknown as { subscription?: string | { id: string } | null })
    .subscription;
  const modern = invoice.parent?.subscription_details?.subscription;
  const ref = legacy ?? modern ?? null;
  if (!ref) return null;
  return typeof ref === "string" ? ref : ref.id;
}

function stripeId(ref: string | { id: string } | null | undefined): string | null {
  if (!ref) return null;
  return typeof ref === "string" ? ref : ref.id;
}

function periodEndOf(subscription: Stripe.Subscription): Date | null {
  const end = (subscription as unknown as { current_period_end?: number }).current_period_end;
  return end ? new Date(end * 1000) : null;
}

/**
 * A Stripe writer may take over an entitlement row only when the row is on
 * this subscription already, or has no billing source yet (TRIAL grace,
 * admin grant). PERPETUAL rows and rows on another subscription are owned by
 * something else and are never rewritten.
 */
function stripeMayWrite(
  existing: { stripeSubscriptionId: string | null; licenseType: string } | null,
  subscriptionId: string
): boolean {
  if (!existing) return true;
  if (existing.licenseType === "PERPETUAL") return false;
  return (
    existing.stripeSubscriptionId === null ||
    existing.stripeSubscriptionId === subscriptionId
  );
}

async function upsertSubscriptionEntitlements(
  db: Db,
  params: {
    customerId: string;
    skillPackageIds: string[];
    subscriptionId: string;
    status: "ACTIVE" | "SUSPENDED" | "EXPIRED";
    expiresAt: Date | null;
  }
): Promise<string[]> {
  const written: string[] = [];
  for (const skillPackageId of params.skillPackageIds) {
    const existing = await db.skillEntitlement.findUnique({
      where: {
        customerId_skillPackageId: { customerId: params.customerId, skillPackageId },
      },
      select: { stripeSubscriptionId: true, licenseType: true },
    });
    if (!stripeMayWrite(existing, params.subscriptionId)) {
      logger.info("Skipping entitlement not owned by this subscription", {
        customerId: params.customerId,
        skillPackageId,
        subscriptionId: params.subscriptionId,
      });
      continue;
    }

    await db.skillEntitlement.upsert({
      where: {
        customerId_skillPackageId: { customerId: params.customerId, skillPackageId },
      },
      update: {
        status: params.status,
        licenseType: "SUBSCRIPTION",
        stripeSubscriptionId: params.subscriptionId,
        expiresAt: params.expiresAt,
      },
      create: {
        customerId: params.customerId,
        skillPackageId,
        licenseType: "SUBSCRIPTION",
        status: params.status,
        stripeSubscriptionId: params.subscriptionId,
        expiresAt: params.expiresAt,
      },
    });
    written.push(skillPackageId);
  }
  return written;
}

/** Work that must happen after the transaction commits (never inside it). */
interface AfterCommit {
  paymentFailedEmail?: string;
}

export interface ProcessOutcome {
  duplicate: boolean;
  /** True when the event belongs to another suite app and was acknowledged untouched. */
  ignored: boolean;
}

/**
 * Process one verified event exactly once. Exported for tests.
 */
export async function processStripeEvent(event: Stripe.Event): Promise<ProcessOutcome> {
  // Another app's event on the shared Stripe account: acknowledge and stop
  // before any Stripe fetch or database write. Nothing is recorded either;
  // a redelivery is classified the same way.
  const ownership = await classifyEventOwnership(event);
  if (!ownership.ours) {
    logger.info("Ignoring Stripe event of another app", {
      id: event.id,
      type: event.type,
      reason: ownership.reason,
      detail: ownership.detail,
    });
    return { duplicate: false, ignored: true };
  }

  // Network calls happen BEFORE the transaction opens.
  let checkoutSubscription: Stripe.Subscription | null = null;
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const subscriptionId = stripeId(session.subscription as string | { id: string } | null);
    if (subscriptionId) {
      checkoutSubscription = await getSubscription(subscriptionId);
    }
  }

  let after: AfterCommit = {};
  try {
    after = await prisma.$transaction(
      async (client) => {
        // The extended client's transaction handle is structurally the
        // TransactionClient (same convention as quickstart.ts).
        const tx = client as unknown as Db;
        // Idempotency marker first: a redelivery fails here on the primary
        // key and the whole transaction, including this row, rolls back to
        // nothing — the first delivery's writes stand.
        await tx.processedStripeEvent.create({
          data: { id: event.id, type: event.type },
        });

        switch (event.type) {
          case "checkout.session.completed":
            await handleCheckoutCompleted(
              tx,
              event.data.object as Stripe.Checkout.Session,
              checkoutSubscription
            );
            return {};

          case "customer.subscription.created":
          case "customer.subscription.updated":
            await handleSubscriptionChange(tx, event.data.object as Stripe.Subscription);
            return {};

          case "customer.subscription.deleted":
            await handleSubscriptionDeleted(tx, event.data.object as Stripe.Subscription);
            return {};

          case "invoice.payment_failed":
            return handlePaymentFailed(tx, event.data.object as Stripe.Invoice);

          default:
            logger.info("Unhandled Stripe event type", { type: event.type });
            return {};
        }
      },
      { timeout: TRANSACTION_TIMEOUT_MS }
    );
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      logger.info("Duplicate Stripe event ignored", { id: event.id, type: event.type });
      return { duplicate: true, ignored: false };
    }
    throw err;
  }

  if (after.paymentFailedEmail) {
    await sendPaymentFailedEmail(after.paymentFailedEmail);
  }
  return { duplicate: false, ignored: false };
}

export async function POST(request: NextRequest) {
  // Check if Stripe is enabled
  if (!features.stripeEnabled) {
    return NextResponse.json(
      { error: "Stripe is not enabled" },
      { status: 403 }
    );
  }

  try {
    const body = await request.text();
    const headersList = await headers();
    const signature = headersList.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing stripe-signature header" },
        { status: 400 }
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = verifyWebhookSignature(body, signature);
    } catch (err) {
      logger.error("Webhook signature verification failed", err);
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    const outcome = await processStripeEvent(event);

    logger.info("Stripe webhook processed", {
      type: event.type,
      id: event.id,
      duplicate: outcome.duplicate,
      ignored: outcome.ignored,
    });
    return NextResponse.json({
      received: true,
      duplicate: outcome.duplicate,
      ignored: outcome.ignored,
    });
  } catch (error) {
    // A 500 makes Stripe retry; the idempotency row rolled back with the
    // transaction, so the retry is processed afresh.
    logger.error("Webhook error", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

/**
 * Handle successful checkout session
 */
async function handleCheckoutCompleted(
  db: Db,
  session: Stripe.Checkout.Session,
  subscription: Stripe.Subscription | null
) {
  const { organizationId, customerId } = session.metadata || {};
  const skillPackageIds = parseSkillPackageIds(session.metadata as Record<string, string> | null);

  if (!organizationId || !skillPackageIds.length) {
    logger.error("Missing metadata in checkout session", undefined, { sessionId: session.id });
    return;
  }

  const subscriptionId = stripeId(session.subscription as string | { id: string } | null);
  if (!subscriptionId || !subscription) {
    logger.error("No subscription in checkout session", undefined, { sessionId: session.id });
    return;
  }

  // Find or create customer record
  let customer = customerId
    ? await db.customer.findUnique({ where: { id: customerId } })
    : null;

  if (!customer && session.customer_email) {
    customer = await db.customer.findUnique({
      where: { email: session.customer_email },
    });
  }

  if (!customer) {
    logger.error("Customer not found for checkout session", undefined, { sessionId: session.id });
    return;
  }

  // Update Stripe customer ID if needed
  const stripeCustomerId = stripeId(session.customer as string | { id: string } | null);
  if (stripeCustomerId && customer.stripeCustomerId !== stripeCustomerId) {
    await db.customer.update({
      where: { id: customer.id },
      data: { stripeCustomerId },
    });
  }

  // Ensure customer-organization link exists
  await db.customerOrganization.upsert({
    where: {
      customerId_organizationId: {
        customerId: customer.id,
        organizationId,
      },
    },
    update: {},
    create: {
      customerId: customer.id,
      organizationId,
    },
  });

  const written = await upsertSubscriptionEntitlements(db, {
    customerId: customer.id,
    skillPackageIds,
    subscriptionId,
    status: "ACTIVE",
    expiresAt: periodEndOf(subscription),
  });

  logger.info("Created entitlements", { customerId: customer.id, skills: written });
}

/**
 * Handle subscription changes (create, update)
 */
async function handleSubscriptionChange(db: Db, subscription: Stripe.Subscription) {
  const { organizationId } = subscription.metadata || {};
  const skillPackageIds = parseSkillPackageIds(subscription.metadata as Record<string, string> | null);

  if (!organizationId || !skillPackageIds.length) {
    // Might be a subscription not related to our app
    return;
  }

  // Find customer by Stripe customer ID
  const stripeCustomerId = stripeId(subscription.customer as string | { id: string });
  const customer = stripeCustomerId
    ? await db.customer.findFirst({ where: { stripeCustomerId } })
    : null;

  if (!customer) {
    logger.error("Customer not found for Stripe customer", undefined, { stripeCustomerId });
    return;
  }

  // Update entitlement status based on subscription status
  let entitlementStatus: "ACTIVE" | "SUSPENDED" | "EXPIRED" = "ACTIVE";

  if (subscription.status === "past_due" || subscription.status === "unpaid") {
    entitlementStatus = "SUSPENDED";
  } else if (
    subscription.status === "canceled" ||
    subscription.status === "incomplete_expired"
  ) {
    entitlementStatus = "EXPIRED";
  }

  await upsertSubscriptionEntitlements(db, {
    customerId: customer.id,
    skillPackageIds,
    subscriptionId: subscription.id,
    status: entitlementStatus,
    expiresAt: periodEndOf(subscription),
  });
}

/**
 * Handle subscription deletion
 */
async function handleSubscriptionDeleted(db: Db, subscription: Stripe.Subscription) {
  const skillPackageIds = parseSkillPackageIds(subscription.metadata as Record<string, string> | null);

  if (!skillPackageIds.length) {
    return;
  }

  const stripeCustomerId = stripeId(subscription.customer as string | { id: string });
  const customer = stripeCustomerId
    ? await db.customer.findFirst({ where: { stripeCustomerId } })
    : null;

  if (!customer) {
    return;
  }

  // Mark entitlements as expired (bulk) — only the rows this subscription
  // paid for. A skill the customer also holds under an offline licence keeps
  // that licence.
  await db.skillEntitlement.updateMany({
    where: {
      customerId: customer.id,
      skillPackageId: { in: skillPackageIds },
      stripeSubscriptionId: subscription.id,
    },
    data: {
      status: "EXPIRED",
    },
  });

  logger.info("Expired entitlements", { customerId: customer.id, skills: skillPackageIds });
}

/**
 * Handle failed payment. Returns the e-mail to notify after commit, if any.
 */
async function handlePaymentFailed(db: Db, invoice: Stripe.Invoice): Promise<AfterCommit> {
  const stripeCustomerId = stripeId(invoice.customer as string | { id: string } | null);
  if (!stripeCustomerId) {
    return {};
  }

  const customer = await db.customer.findFirst({
    where: { stripeCustomerId },
  });

  if (!customer) {
    return {};
  }

  // Suspend the entitlements THIS invoice's subscription pays for — never
  // an offline licence (perpetual or otherwise) the same customer holds.
  // When the invoice carries no subscription reference, fall back to every
  // Stripe-billed SUBSCRIPTION row, still excluding rows with no
  // subscription id.
  const subscriptionId = invoiceSubscriptionId(invoice);
  const suspended = await db.skillEntitlement.updateMany({
    where: {
      customerId: customer.id,
      status: "ACTIVE",
      licenseType: "SUBSCRIPTION",
      stripeSubscriptionId: subscriptionId ? subscriptionId : { not: null },
    },
    data: {
      status: "SUSPENDED",
    },
  });

  if (suspended.count === 0) {
    // Nothing of ours to suspend (e.g. a sibling app's subscription on the
    // shared Stripe account) — no e-mail either.
    return {};
  }

  logger.info("Suspended entitlements due to payment failure", {
    customerId: customer.id,
    subscriptionId,
    count: suspended.count,
  });

  return customer.email ? { paymentFailedEmail: customer.email } : {};
}

async function sendPaymentFailedEmail(to: string) {
  if (!resend) return;
  try {
    await resend.emails.send({
      from: emailFrom(),
      to,
      subject: `${brand.name} — Payment Failed`,
      html: `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; background: ${brand.colors.background}; border-radius: 12px; overflow: hidden;">
          <div style="padding: 24px 24px 16px; border-bottom: 1px solid ${brand.colors.border};">
            <span style="font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: 0.05em;">${brand.nameUppercase}</span>
          </div>
          <div style="padding: 32px 24px;">
            <p style="color: ${brand.colors.foreground}; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">We were unable to process your latest payment. Your premium features have been temporarily suspended.</p>
            <p style="color: ${brand.colors.foreground}; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">Please update your payment method to restore access.</p>
            <a href="${process.env.NEXTAUTH_URL}/privacy/billing" style="display: inline-block; background: ${brand.colors.primary}; color: ${brand.colors.primaryForeground}; padding: 12px 28px; text-decoration: none; font-weight: 600; font-size: 14px; border-radius: 24px;">Update Payment Method</a>
          </div>
          <div style="padding: 16px 24px; border-top: 1px solid ${brand.colors.border};">
            <p style="color: #666666; font-size: 11px; margin: 0;">${emailFooterHtml()}</p>
          </div>
        </div>
      `,
    });
  } catch (emailErr) {
    logger.error("Failed to send payment failure email", emailErr);
  }
}
