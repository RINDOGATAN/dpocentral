// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateImportApiKey } from "@/lib/import-auth";
import { ensureDpoUser } from "@/lib/jit-provisioning";

/**
 * Cross-app portfolio import (Part B of the DB decoupling). vendor.watch
 * pushes a user's vendor.watch portfolio to DPO over HTTP, keyed by email —
 * never through a shared database.
 *
 * Identity: resolved by email via JIT provisioning. A first-time cross-app
 * user (signed into vendor.watch but never DPO) is minted here, so the push
 * always lands. Rows are written into DPO's own `portfolio_vendors` staging
 * table (VwPortfolioVendor, keyed accountId = DPO user id). The user then
 * imports from staging through the existing quickstart flow — we do NOT write
 * into DPO's `vendors` table directly.
 */
interface VendorPayload {
  slug: string;
  criticality?: string;
  dataCategories?: string[];
  purposes?: string[];
}

export async function POST(request: Request) {
  if (!validateImportApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { userEmail, vendors } = body as {
    userEmail: string;
    vendors: VendorPayload[];
  };

  if (!userEmail || typeof userEmail !== "string") {
    return NextResponse.json(
      { error: "userEmail is required" },
      { status: 400 }
    );
  }

  if (!Array.isArray(vendors) || vendors.length === 0) {
    return NextResponse.json(
      { error: "vendors array is required" },
      { status: 400 }
    );
  }

  // Resolve (or JIT-mint) the DPO user by email. accountId on the staging
  // table is the DPO user id.
  const { id: accountId } = await ensureDpoUser(prisma, { email: userEmail });

  let exported = 0;
  let alreadyExisted = 0;
  let skipped = 0;

  for (const vendor of vendors) {
    if (!vendor.slug || typeof vendor.slug !== "string") {
      skipped++;
      continue;
    }

    try {
      const existing = await prisma.vwPortfolioVendor.findUnique({
        where: {
          accountId_vendorSlug: { accountId, vendorSlug: vendor.slug },
        },
        select: { id: true },
      });

      const data = {
        criticality: vendor.criticality ?? "medium",
        dataCategories: vendor.dataCategories ?? [],
        purposes: vendor.purposes ?? [],
      };

      await prisma.vwPortfolioVendor.upsert({
        where: {
          accountId_vendorSlug: { accountId, vendorSlug: vendor.slug },
        },
        update: data,
        create: { accountId, vendorSlug: vendor.slug, ...data },
      });

      if (existing) {
        alreadyExisted++;
      } else {
        exported++;
      }
    } catch (err) {
      // Skip the row but keep the reason observable — a silent counter made
      // partial imports impossible to debug.
      console.error(
        `[import/portfolio-vendors] skipped "${vendor.slug}":`,
        err
      );
      skipped++;
    }
  }

  return NextResponse.json({ exported, alreadyExisted, skipped });
}
