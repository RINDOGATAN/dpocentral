/**
 * Stripe Customer Portal API Route
 *
 * Creates a Stripe Billing Portal session so customers can manage
 * their subscriptions, payment methods, and invoices.
 *
 * Proprietary - Requires commercial license
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import prisma from "@/lib/prisma";
import { createPortalSession } from "@/lib/stripe";
import { features } from "@/config/features";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  if (!features.stripeEnabled || !features.selfServiceUpgrade) {
    return NextResponse.json(
      { error: "Self-service billing is not enabled" },
      { status: 403 }
    );
  }

  try {
    const token = await getToken({ req: request });
    const userEmail = token?.email as string | undefined;
    if (!userEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { organizationId } = body;

    if (!organizationId) {
      return NextResponse.json(
        { error: "Missing required field: organizationId" },
        { status: 400 }
      );
    }

    // Verify user is a member of this organization
    const membership = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        user: { email: userEmail },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Not authorized to manage billing for this organization" },
        { status: 403 }
      );
    }

    // Get the Stripe customer ID for this organization
    const customerOrg = await prisma.customerOrganization.findFirst({
      where: { organizationId },
      include: { customer: true },
    });

    if (!customerOrg?.customer?.stripeCustomerId) {
      return NextResponse.json(
        { error: "No billing account found for this organization" },
        { status: 404 }
      );
    }

    const origin = request.headers.get("origin") || process.env.NEXTAUTH_URL;
    const portalSession = await createPortalSession(
      customerOrg.customer.stripeCustomerId,
      `${origin}/privacy/billing`
    );

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    logger.error("Portal session error", error);
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 }
    );
  }
}
