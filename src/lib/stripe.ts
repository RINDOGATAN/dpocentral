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
  priceId: string;
  skillPackageId: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

/**
 * Create a Stripe Checkout session for skill purchase
 */
export async function createCheckoutSession(
  params: CreateCheckoutParams
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: params.priceId,
        quantity: 1,
      },
    ],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: {
      organizationId: params.organizationId,
      skillPackageId: params.skillPackageId,
      ...params.metadata,
    },
    subscription_data: {
      metadata: {
        organizationId: params.organizationId,
        skillPackageId: params.skillPackageId,
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
