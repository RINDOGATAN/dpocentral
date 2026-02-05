/**
 * Stripe Checkout API Route
 *
 * Creates Stripe Checkout sessions for premium skill purchases.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createCheckoutSession, createCustomer } from "@/lib/stripe";
import { features } from "@/config/features";

export async function POST(request: NextRequest) {
  // Check if Stripe is enabled
  if (!features.stripeEnabled || !features.selfServiceUpgrade) {
    return NextResponse.json(
      { error: "Self-service upgrade is not enabled" },
      { status: 403 }
    );
  }

  try {
    // Get authenticated session
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { skillPackageId, organizationId } = body;

    if (!skillPackageId || !organizationId) {
      return NextResponse.json(
        { error: "Missing required fields: skillPackageId, organizationId" },
        { status: 400 }
      );
    }

    // Verify user has access to organization
    const membership = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        user: { email: session.user.email },
        role: { in: ["OWNER", "ADMIN"] },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Not authorized to purchase for this organization" },
        { status: 403 }
      );
    }

    // Get skill package
    const skillPackage = await prisma.skillPackage.findUnique({
      where: { id: skillPackageId },
    });

    if (!skillPackage) {
      return NextResponse.json(
        { error: "Skill package not found" },
        { status: 404 }
      );
    }

    // Check for existing entitlement
    const customerOrg = await prisma.customerOrganization.findFirst({
      where: { organizationId },
      include: {
        customer: {
          include: {
            entitlements: {
              where: { skillPackageId, status: "ACTIVE" },
            },
          },
        },
      },
    });

    if (customerOrg?.customer.entitlements.length) {
      return NextResponse.json(
        { error: "Organization already has an active entitlement for this skill" },
        { status: 400 }
      );
    }

    // Get or create Stripe price ID from skill package metadata
    // Note: In production, stripePriceId would be stored on SkillPackage
    const stripePriceId = (skillPackage as { stripePriceId?: string }).stripePriceId;
    if (!stripePriceId) {
      return NextResponse.json(
        { error: "Skill package is not configured for purchase" },
        { status: 400 }
      );
    }

    // Get or create customer
    let customerId = customerOrg?.customer?.id;
    let stripeCustomerId = customerOrg?.customer?.stripeCustomerId;

    if (!customerId) {
      // Create new customer
      const stripeCustomer = await createCustomer({
        email: session.user.email,
        name: session.user.name || undefined,
        metadata: {
          organizationId,
        },
      });

      const newCustomer = await prisma.customer.create({
        data: {
          name: session.user.name || session.user.email,
          email: session.user.email,
          type: "SAAS",
          stripeCustomerId: stripeCustomer.id,
          organizations: {
            create: { organizationId },
          },
        },
      });

      customerId = newCustomer.id;
      stripeCustomerId = stripeCustomer.id;
    } else if (!stripeCustomerId && customerOrg?.customer) {
      // Create Stripe customer for existing customer
      const existingCustomer = customerOrg.customer;
      const stripeCustomer = await createCustomer({
        email: existingCustomer.email,
        name: existingCustomer.name,
        metadata: {
          customerId: existingCustomer.id,
          organizationId,
        },
      });

      await prisma.customer.update({
        where: { id: existingCustomer.id },
        data: { stripeCustomerId: stripeCustomer.id },
      });

      stripeCustomerId = stripeCustomer.id;
    }

    // Create checkout session
    const origin = request.headers.get("origin") || process.env.NEXTAUTH_URL;
    const checkoutSession = await createCheckoutSession({
      customerId: stripeCustomerId || undefined,
      customerEmail: session.user.email,
      organizationId,
      priceId: stripePriceId,
      skillPackageId,
      successUrl: `${origin}/privacy?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/privacy?checkout=cancelled`,
      metadata: {
        customerId: customerId!,
        userName: session.user.name || "",
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
