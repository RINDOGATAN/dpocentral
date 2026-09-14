// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Stripe Checkout API Route
 *
 * Creates Stripe Checkout sessions for premium skill purchases.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import prisma from "@/lib/prisma";
import {
  createCheckoutSession,
  findOrCreateCustomerByEmail,
  verifyCheckoutPrices,
} from "@/lib/stripe";
import { PriceMismatchError } from "@/lib/stripe-price-guard";
import { features } from "@/config/features";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  // Check if Stripe is enabled
  if (!features.stripeEnabled || !features.selfServiceUpgrade) {
    return NextResponse.json(
      { error: "Self-service upgrade is not enabled" },
      { status: 403 }
    );
  }

  try {
    // Get authenticated user from JWT token
    const token = await getToken({ req: request });
    const userEmail = token?.email as string | undefined;
    const userName = token?.name as string | undefined;
    if (!userEmail) {
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
        user: { email: userEmail },
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
                // A flip-day TRIAL row (paywall grace) is exactly what the
                // customer is buying their way out of — it never blocks.
                licenseType: { not: "TRIAL" },
                OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
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
        where: { email: userEmail },
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
        // Create new customer (reusing a Stripe customer a sibling suite app
        // may already have created for this e-mail)
        const stripeCustomer = await findOrCreateCustomerByEmail({
          email: userEmail,
          name: userName || undefined,
          metadata: {
            organizationId,
          },
        });

        const newCustomer = await prisma.customer.create({
          data: {
            name: userName || userEmail,
            email: userEmail,
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
      const stripeCustomer = await findOrCreateCustomerByEmail({
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

    // Determine currency from geo-IP (US → USD, else EUR)
    const country = request.headers.get("x-vercel-ip-country") || "";
    const isUSD = country === "US";
    const usdPriceId = process.env.STRIPE_PRICE_ID_USD;

    // Build line items (use USD price for US visitors if available)
    const useUsd = isUSD && Boolean(usdPriceId);
    const lineItems = skillPackages.map((pkg) => ({
      priceId: useUsd ? usdPriceId! : pkg.stripePriceId!,
      skillPackageId: pkg.id,
    }));

    // Refuse the purchase unless every Stripe price the session will carry
    // is the package's price at the package's amount: the price ids come
    // from env at seed time and the prices live in the Stripe dashboard, so
    // this is the only check that the buyer is charged what the app shows.
    // The USD price is a single yearly price at the same figure in USD.
    await verifyCheckoutPrices(
      skillPackages.map((pkg, i) => ({
        priceId: lineItems[i].priceId,
        pkg: {
          id: pkg.id,
          name: pkg.name,
          priceAmount: pkg.priceAmount,
          priceCurrency: pkg.priceCurrency,
          billingInterval: pkg.billingInterval,
        },
        currencyOverride: useUsd ? "usd" : undefined,
      }))
    );

    // Create checkout session
    const origin = request.headers.get("origin") || process.env.NEXTAUTH_URL;
    const checkoutSession = await createCheckoutSession({
      customerId: stripeCustomerId || undefined,
      customerEmail: userEmail,
      organizationId,
      lineItems,
      successUrl: `${origin}/privacy/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/privacy/billing?checkout=cancelled`,
      metadata: {
        customerId: customerId!,
        userName: userName || "",
      },
    });

    // Audit log the checkout attempt
    await prisma.auditLog.create({
      data: {
        organizationId,
        userId: membership.userId,
        entityType: "Checkout",
        entityId: checkoutSession.id,
        action: "CHECKOUT_INITIATED",
        changes: { skillPackageIds: requestedIds },
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    if (error instanceof PriceMismatchError) {
      // Configuration drift between skill_packages and the Stripe
      // dashboard. Refuse rather than charge an unadvertised figure; the
      // specifics stay in the log.
      logger.error("Checkout refused: Stripe price does not match package", error, {
        priceId: error.priceId,
        packageId: error.packageId,
      });
      return NextResponse.json(
        { error: "Purchase refused: price configuration mismatch" },
        { status: 500 }
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Checkout error", error);
    return NextResponse.json(
      { error: `Failed to create checkout session: ${message}` },
      { status: 500 }
    );
  }
}
