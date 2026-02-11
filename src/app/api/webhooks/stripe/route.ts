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
import { Resend } from "resend";
import prisma from "@/lib/prisma";
import { verifyWebhookSignature, getSubscription } from "@/lib/stripe";
import { features } from "@/config/features";
import { brand } from "@/config/brand";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

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

  // Send notification email to customer
  if (resend && customer.email) {
    try {
      await resend.emails.send({
        from: process.env.EMAIL_FROM || "noreply@todo.law",
        to: customer.email,
        subject: `${brand.name} — Payment Failed`,
        html: `
          <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #1a1a1a; border-radius: 12px; overflow: hidden;">
            <div style="padding: 24px 24px 16px; border-bottom: 1px solid #2a2a2a;">
              <span style="font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: 0.05em;">DPO CENTRAL</span>
            </div>
            <div style="padding: 32px 24px;">
              <p style="color: #e5e5e5; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">We were unable to process your latest payment. Your premium features have been temporarily suspended.</p>
              <p style="color: #e5e5e5; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">Please update your payment method to restore access.</p>
              <a href="${process.env.NEXTAUTH_URL}/privacy/billing" style="display: inline-block; background: #53aecc; color: #1a1a1a; padding: 12px 28px; text-decoration: none; font-weight: 600; font-size: 14px; border-radius: 24px;">Update Payment Method</a>
            </div>
            <div style="padding: 16px 24px; border-top: 1px solid #2a2a2a;">
              <p style="color: #666666; font-size: 11px; margin: 0;">TODO.LAW\u2122 \u00b7 DPO CENTRAL \u00b7 <a href="https://dpocentral.todo.law" style="color: #53aecc; text-decoration: none;">dpocentral.todo.law</a></p>
            </div>
          </div>
        `,
      });
    } catch (emailErr) {
      console.error("Failed to send payment failure email:", emailErr);
    }
  }
}
