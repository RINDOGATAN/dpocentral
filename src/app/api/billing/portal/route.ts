/**
 * Stripe Customer Portal API Route
 *
 * Creates a Stripe Billing Portal session so customers can manage
 * their subscriptions, payment methods, and invoices.
 *
 * Proprietary - Requires commercial license
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createPortalSession } from "@/lib/stripe";
import { features } from "@/config/features";

export async function POST(request: NextRequest) {
  if (!features.stripeEnabled || !features.selfServiceUpgrade) {
    return NextResponse.json(
      { error: "Self-service billing is not enabled" },
      { status: 403 }
    );
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
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

    // Verify user has OWNER or ADMIN role
    const membership = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        user: { email: session.user.email },
        role: { in: ["OWNER", "ADMIN"] },
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
    console.error("Portal session error:", error);
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 }
    );
  }
}
