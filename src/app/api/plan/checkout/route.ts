// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * GET /api/plan/checkout?org=<organisation id>[&interval=month|year]
 *
 * "Move to the paid plan": sends an owner or admin of a pilot organisation to
 * the plan's Stripe payment link for the visitor's currency (one currency per
 * visitor, src/lib/plan-currency.ts) and the interval asked for (yearly when
 * absent; the links come from src/lib/plan-upgrade.ts paymentLinkFor), carrying a signed reference to the
 * organisation (client_reference_id) and their e-mail (prefilled_email). The
 * payment then lifts the limits through POST /api/plan/stripe-sync, for every
 * organisation of the same paying customer (one plan per customer).
 *
 * Answers 404 unless this is the hosted service with the automatic upgrade
 * switched on, its secret set and a link set for the visitor's currency and
 * that interval, 400 for an unknown interval, 401 without a session, 403 to anyone who is
 * not an owner or admin of the organisation, 409 when the organisation, or
 * another of the same customer, is already on the paid plan, and otherwise 303 to the payment link.
 */

import { getSessionToken } from "@/lib/session-cookie";
import prisma from "@/lib/prisma";
import { checkoutUrl, parsePlanInterval, planSyncSecret, upgradeLinkFor } from "@/lib/plan-upgrade";
import { groupWhere } from "@/server/services/pilot/umbrella";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const interval = parsePlanInterval(params.get("interval"));
  if (!interval) return Response.json({ error: "interval must be month or year" }, { status: 400 });

  const secret = planSyncSecret();
  const link = upgradeLinkFor(request.headers, process.env, interval);
  if (!link || !secret) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const org = params.get("org");
  if (!org || !/^[A-Za-z0-9]+$/.test(org)) {
    return Response.json({ error: "org is required" }, { status: 400 });
  }

  const token = await getSessionToken(request);
  const email = token?.email as string | undefined;
  if (!email) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await prisma.organizationMember.findFirst({
    where: { organizationId: org, user: { email } },
    include: { organization: true },
  });
  if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  // One plan per paying customer: when any organisation of this one's group
  // (same billing owner) is paid, the whole group is covered already.
  const group = membership.organization?.billingOwnerId
    ? await prisma.organization.findMany({
        where: groupWhere(membership.organization),
        select: { plan: true },
      })
    : [];
  if (membership.organization?.plan === "EU_CLOUD" || group.some((o) => o.plan === "EU_CLOUD")) {
    return Response.json({ error: "Already on the paid plan" }, { status: 409 });
  }

  return new Response(null, {
    status: 303,
    headers: { Location: checkoutUrl(link, org, email, secret), "Cache-Control": "no-store" },
  });
}
