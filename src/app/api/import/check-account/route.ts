// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateImportApiKey } from "@/lib/import-auth";

/**
 * Cross-app account probe. vendor.watch calls this before an export to tell
 * the user whether they have a DPO account and org. Keyed by email — the
 * identity link across todo.law apps. Mirrors AI Sentinel's check-account.
 *
 * Read-only: does NOT mint a user (that is the portfolio-vendors route's job
 * via JIT). A user with no DPO row simply reports hasAccount:false.
 */
export async function POST(request: Request) {
  if (!validateImportApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const userEmail = body.userEmail;

  if (!userEmail || typeof userEmail !== "string") {
    return NextResponse.json(
      { error: "userEmail is required" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    include: {
      organizationMemberships: {
        include: { organization: true },
        take: 1,
      },
    },
  });

  if (!user) {
    return NextResponse.json({
      hasAccount: false,
      hasOrg: false,
      orgId: null,
      orgName: null,
    });
  }

  const membership = user.organizationMemberships[0];

  if (!membership) {
    return NextResponse.json({
      hasAccount: true,
      hasOrg: false,
      orgId: null,
      orgName: null,
    });
  }

  return NextResponse.json({
    hasAccount: true,
    hasOrg: true,
    orgId: membership.organization.id,
    orgName: membership.organization.name,
  });
}
