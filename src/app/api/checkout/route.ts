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
    const { skillPackageId, skillPackageIds: rawIds, organizationId } = body;

    // Support both single ID (backward compat) and array of IDs
    const requestedIds: string[] = rawIds
      ? rawIds
      : skillPackageId
        ? [skillPackageId]
        : [];

    if (!requestedIds.length || !organizationId) {
      return NextResponse.json(
        { error: "Missing required fields: skillPackageId(s), organizationId" },
        { status: 400 }
      );
    }

    // Verify user is a member of the organization
    const membership = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        user: { email: session.user.email },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Not authorized to purchase for this organization" },
        { status: 403 }
      );
    }

    // Look up all requested skill packages (IDs may be DB id or skillId)
    const skillPackages = await prisma.skillPackage.findMany({
      where: {
        OR: requestedIds.flatMap((id) => [{ id }, { skillId: id }]),
      },
    });

    if (skillPackages.length !== requestedIds.length) {
      return NextResponse.json(
        { error: "One or more skill packages not found" },
        { status: 404 }
      );
    }

    // Verify all have a Stripe price
    const missingPrice = skillPackages.find((p) => !p.stripePriceId);
    if (missingPrice) {
      return NextResponse.json(
        { error: `Skill package "${missingPrice.name}" is not configured for purchase` },
        { status: 400 }
      );
    }

    // Check for existing entitlements
    const customerOrg = await prisma.customerOrganization.findFirst({
      where: { organizationId },
      include: {
        customer: {
          include: {
            entitlements: {
              where: {
                skillPackageId: { in: skillPackages.map((p) => p.id) },
                status: "ACTIVE",
              },
            },
          },
        },
      },
    });

    if (customerOrg?.customer.entitlements.length) {
      const alreadyEntitled = customerOrg.customer.entitlements
        .map((e) => skillPackages.find((p) => p.id === e.skillPackageId)?.name)
        .filter(Boolean);
      return NextResponse.json(
        { error: `Already entitled: ${alreadyEntitled.join(", ")}` },
        { status: 400 }
      );
    }

    // Get or create customer
    let customerId = customerOrg?.customer?.id;
    let stripeCustomerId = customerOrg?.customer?.stripeCustomerId;

    if (!customerId) {
      // Check if customer exists by email but isn't linked to this org
      const existingByEmail = await prisma.customer.findUnique({
        where: { email: session.user.email },
      });

      if (existingByEmail) {
        // Link existing customer to this organization
        await prisma.customerOrganization.create({
          data: {
            customerId: existingByEmail.id,
            organizationId,
          },
        });
        customerId = existingByEmail.id;
        stripeCustomerId = existingByEmail.stripeCustomerId;
      } else {
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
        stripeCustomerId = newCustomer.stripeCustomerId;
      }
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

    // Build line items
    const lineItems = skillPackages.map((pkg) => ({
      priceId: pkg.stripePriceId!,
      skillPackageId: pkg.id,
    }));

    // Create checkout session
    const origin = request.headers.get("origin") || process.env.NEXTAUTH_URL;
    const checkoutSession = await createCheckoutSession({
      customerId: stripeCustomerId || undefined,
      customerEmail: session.user.email,
      organizationId,
      lineItems,
      successUrl: `${origin}/privacy/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/privacy/billing?checkout=cancelled`,
      metadata: {
        customerId: customerId!,
        userName: session.user.name || "",
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Checkout error:", message, error);
    return NextResponse.json(
      { error: `Failed to create checkout session: ${message}` },
      { status: 500 }
    );
  }
}
