/**
 * Stripe Integration
 *
 * Provides Stripe client and utility functions for payment processing.
 * This module is only active when Stripe is enabled via feature flags.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import Stripe from "stripe";
import { features } from "@/config/features";

/**
 * Stripe client instance (server-side only)
 */
let stripeClient: Stripe | null = null;

/**
 * Get the Stripe client instance
 *
 * @throws Error if Stripe is not configured
 */
export function getStripe(): Stripe {
  if (!features.stripeEnabled) {
    throw new Error("Stripe is not enabled. Set NEXT_PUBLIC_STRIPE_ENABLED=true");
  }

  if (!stripeClient) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }

    stripeClient = new Stripe(secretKey, {
      apiVersion: "2026-01-28.clover",
      typescript: true,
    });
  }

  return stripeClient;
}

/**
 * Get the Stripe publishable key for client-side use
 */
export function getStripePublishableKey(): string | null {
  if (!features.stripeEnabled) {
    return null;
  }
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || null;
}

/**
 * Checkout session parameters
 */
export interface CreateCheckoutParams {
  customerId?: string;
  customerEmail: string;
  organizationId: string;
  lineItems: { priceId: string; skillPackageId: string }[];
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

/**
 * Create a Stripe Checkout session for skill purchase (supports multiple line items)
 */
export async function createCheckoutSession(
  params: CreateCheckoutParams
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();

  const skillPackageIds = params.lineItems.map((li) => li.skillPackageId).join(",");

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: params.lineItems.map((li) => ({
      price: li.priceId,
      quantity: 1,
    })),
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: {
      organizationId: params.organizationId,
      skillPackageIds,
      ...params.metadata,
    },
    subscription_data: {
      metadata: {
        organizationId: params.organizationId,
        skillPackageIds,
      },
    },
  };

  // Use existing customer or create by email
  if (params.customerId) {
    sessionParams.customer = params.customerId;
  } else {
    sessionParams.customer_email = params.customerEmail;
  }

  return stripe.checkout.sessions.create(sessionParams);
}

/**
 * Retrieve a Stripe customer by ID
 */
export async function getCustomer(
  customerId: string
): Promise<Stripe.Customer | Stripe.DeletedCustomer> {
  const stripe = getStripe();
  return stripe.customers.retrieve(customerId);
}

/**
 * Create a Stripe customer
 */
export async function createCustomer(params: {
  email: string;
  name?: string;
  metadata?: Record<string, string>;
}): Promise<Stripe.Customer> {
  const stripe = getStripe();
  return stripe.customers.create({
    email: params.email,
    name: params.name,
    metadata: params.metadata,
  });
}

/**
 * Get subscription details
 */
export async function getSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  return stripe.subscriptions.retrieve(subscriptionId);
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(
  subscriptionId: string,
  immediately: boolean = false
): Promise<Stripe.Subscription> {
  const stripe = getStripe();

  if (immediately) {
    return stripe.subscriptions.cancel(subscriptionId);
  }

  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
}

/**
 * Create a billing portal session for customer self-service
 */
export async function createPortalSession(
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  const stripe = getStripe();
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

/**
 * Remove a single subscription item (by price) from a subscription.
 * If it's the only item, cancels the entire subscription immediately.
 *
 * Returns { cancelled: true } if the whole subscription was cancelled,
 * or { cancelled: false } if only the item was removed.
 */
export async function removeSubscriptionItem(
  subscriptionId: string,
  stripePriceId: string
): Promise<{ cancelled: boolean }> {
  const stripe = getStripe();

  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items"],
  });

  const items = subscription.items.data;
  const target = items.find((item) => item.price.id === stripePriceId);

  if (!target) {
    throw new Error(
      `No subscription item found for price ${stripePriceId} on subscription ${subscriptionId}`
    );
  }

  if (items.length === 1) {
    // Only item — cancel the entire subscription immediately
    await stripe.subscriptions.cancel(subscriptionId);
    return { cancelled: true };
  }

  // Multiple items — remove just this one with proration
  await stripe.subscriptionItems.del(target.id, {
    proration_behavior: "create_prorations",
  });

  // Update subscription metadata to remove the cancelled skillPackageId
  const currentSkillIds = (subscription.metadata?.skillPackageIds ?? "")
    .split(",")
    .filter(Boolean);

  // We don't know the skillPackageId here, but the caller can handle metadata
  // if needed. For now, we just remove the item.

  return { cancelled: false };
}

/**
 * Verify Stripe webhook signature
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }

  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}
