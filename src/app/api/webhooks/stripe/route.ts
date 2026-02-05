/**
 * Stripe Webhook Handler
 *
 * Processes Stripe webhook events to create/update entitlements.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import prisma from "@/lib/prisma";
import { verifyWebhookSignature, getSubscription } from "@/lib/stripe";
import { features } from "@/config/features";

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
      console.error("Webhook signature verification failed:", err);
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    // Handle events
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionChange(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

/**
 * Handle successful checkout session
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const { organizationId, skillPackageId, customerId } = session.metadata || {};

  if (!organizationId || !skillPackageId) {
    console.error("Missing metadata in checkout session:", session.id);
    return;
  }

  // Get subscription details
  if (!session.subscription) {
    console.error("No subscription in checkout session:", session.id);
    return;
  }

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription.id;

  const subscription = await getSubscription(subscriptionId);

  // Find or create customer record
  let customer = customerId
    ? await prisma.customer.findUnique({ where: { id: customerId } })
    : null;

  if (!customer && session.customer_email) {
    customer = await prisma.customer.findUnique({
      where: { email: session.customer_email },
    });
  }

  if (!customer) {
    console.error("Customer not found for checkout session:", session.id);
    return;
  }

  // Update Stripe customer ID if needed
  const stripeCustomerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;

  if (stripeCustomerId && customer.stripeCustomerId !== stripeCustomerId) {
    await prisma.customer.update({
      where: { id: customer.id },
      data: { stripeCustomerId },
    });
  }

  // Ensure customer-organization link exists
  await prisma.customerOrganization.upsert({
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

  // Get current_period_end from subscription
  const periodEnd = (subscription as unknown as { current_period_end?: number }).current_period_end;

  // Create or update entitlement
  await prisma.skillEntitlement.upsert({
    where: {
      customerId_skillPackageId: {
        customerId: customer.id,
        skillPackageId,
      },
    },
    update: {
      status: "ACTIVE",
      licenseType: "SUBSCRIPTION",
      expiresAt: periodEnd
        ? new Date(periodEnd * 1000)
        : null,
    },
    create: {
      customerId: customer.id,
      skillPackageId,
      licenseType: "SUBSCRIPTION",
      status: "ACTIVE",
      expiresAt: periodEnd
        ? new Date(periodEnd * 1000)
        : null,
    },
  });

  console.log(
    `Created entitlement for customer ${customer.id}, skill ${skillPackageId}`
  );
}

/**
 * Handle subscription changes (create, update)
 */
async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const { organizationId, skillPackageId } = subscription.metadata || {};

  if (!organizationId || !skillPackageId) {
    // Might be a subscription not related to our app
    return;
  }

  // Find customer by Stripe customer ID
  const stripeCustomerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const customer = await prisma.customer.findFirst({
    where: { stripeCustomerId },
  });

  if (!customer) {
    console.error(
      "Customer not found for Stripe customer:",
      stripeCustomerId
    );
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

  // Get current_period_end from subscription (may be on different property depending on Stripe version)
  const periodEnd = (subscription as unknown as { current_period_end?: number }).current_period_end;

  await prisma.skillEntitlement.upsert({
    where: {
      customerId_skillPackageId: {
        customerId: customer.id,
        skillPackageId,
      },
    },
    update: {
      status: entitlementStatus,
      expiresAt: periodEnd
        ? new Date(periodEnd * 1000)
        : null,
    },
    create: {
      customerId: customer.id,
      skillPackageId,
      licenseType: "SUBSCRIPTION",
      status: entitlementStatus,
      expiresAt: periodEnd
        ? new Date(periodEnd * 1000)
        : null,
    },
  });
}

/**
 * Handle subscription deletion
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const { skillPackageId } = subscription.metadata || {};

  if (!skillPackageId) {
    return;
  }

  const stripeCustomerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const customer = await prisma.customer.findFirst({
    where: { stripeCustomerId },
  });

  if (!customer) {
    return;
  }

  // Mark entitlement as expired
  await prisma.skillEntitlement.updateMany({
    where: {
      customerId: customer.id,
      skillPackageId,
    },
    data: {
      status: "EXPIRED",
    },
  });

  console.log(
    `Expired entitlement for customer ${customer.id}, skill ${skillPackageId}`
  );
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const stripeCustomerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;

  if (!stripeCustomerId) {
    return;
  }

  const customer = await prisma.customer.findFirst({
    where: { stripeCustomerId },
  });

  if (!customer) {
    return;
  }

  // Suspend all entitlements for this customer
  await prisma.skillEntitlement.updateMany({
    where: {
      customerId: customer.id,
      status: "ACTIVE",
    },
    data: {
      status: "SUSPENDED",
    },
  });

  console.log(`Suspended entitlements for customer ${customer.id} due to payment failure`);

  // TODO: Send notification email to customer
}
