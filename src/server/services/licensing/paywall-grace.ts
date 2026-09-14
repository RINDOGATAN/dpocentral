// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Paywall grace for organizations that pre-date hosted billing.
 *
 * While Stripe is off, every premium gate answers "entitled" (entitlement.ts,
 * ALL_FEATURES_FREE). The build that switches NEXT_PUBLIC_STRIPE_ENABLED on
 * removes that bypass for every existing hosted organization at once. So, on
 * flip day, a one-off script writes a REAL entitlement per existing
 * organization per module it was already using: licenseType TRIAL, status
 * ACTIVE, expiresAt = flip + window. No gate changes: the gates already
 * honour expiresAt, and a purchase converts the TRIAL row to SUBSCRIPTION
 * (the Stripe writers may take over rows with no billing source).
 * Same design as the sibling suite apps (reconciled 2026-09-13).
 *
 * "In use" per module, judged on rows created before the flip:
 *   assessment packages  an assessment of that type
 *   vendor-catalog       a vendor record
 *   ropa-export          a processing activity
 * Modules never used, packages with no price, the legacy bundle, and
 * organizations created after the flip get nothing.
 *
 * The run is a plan first (dry-run), then apply. See
 * scripts/grant-paywall-grace.ts for the command.
 */

import type { AssessmentType, PrismaClient } from "@prisma/client";
import { COMPLETE_PACKAGE_SKILL_ID, ROPA_EXPORT_SKILL_ID, VENDOR_CATALOG_SKILL_ID } from "./skill-ids";

export const DEFAULT_PAYWALL_GRACE_DAYS = 30;

type Db = PrismaClient;

export interface GraceOptions {
  /** The moment hosted billing switched on. Organizations created after it get nothing. */
  flipAt: Date;
  /** Length of the window in days (owner confirms; default 30). */
  days?: number;
}

export interface GracePlanEntry {
  organizationId: string;
  /** E-mail of the OWNER (else ADMIN) who becomes the Customer; never printed. */
  buyerEmail: string;
  buyerName: string | null;
  packageId: string;
  skillId: string;
  expiresAt: Date;
}

export interface GracePlan {
  flipAt: Date;
  days: number;
  expiresAt: Date;
  entries: GracePlanEntry[];
  /** Organizations that pre-date the flip but got no entry, with the reason. */
  skipped: { organizationId: string; reason: string }[];
}

export function graceExpiry(flipAt: Date, days: number): Date {
  return new Date(flipAt.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Which packages an organization was using before `before`.
 */
export async function modulesInUse(
  db: Db,
  organizationId: string,
  before: Date,
  packages: { id: string; skillId: string; assessmentType: AssessmentType | null }[]
): Promise<{ id: string; skillId: string }[]> {
  const where = { organizationId, createdAt: { lt: before } };

  // An assessment's type lives on its template.
  const [assessments, vendors, activities] = await Promise.all([
    db.assessment.findMany({
      where,
      select: { template: { select: { type: true } } },
      distinct: ["templateId"],
    }),
    db.vendor.count({ where }),
    db.processingActivity.count({ where }),
  ]);
  const usedTypes = new Set(assessments.map((a) => a.template.type));

  return packages.filter((pkg) => {
    if (pkg.skillId === COMPLETE_PACKAGE_SKILL_ID) return false;
    if (pkg.skillId === VENDOR_CATALOG_SKILL_ID) return vendors > 0;
    if (pkg.skillId === ROPA_EXPORT_SKILL_ID) return activities > 0;
    if (pkg.assessmentType) return usedTypes.has(pkg.assessmentType);
    return false;
  });
}

/**
 * Build the plan: one entry per (organization, module in use) that has no
 * live entitlement yet. Reads only.
 */
export async function planPaywallGrace(db: Db, options: GraceOptions): Promise<GracePlan> {
  const days = options.days ?? DEFAULT_PAYWALL_GRACE_DAYS;
  const expiresAt = graceExpiry(options.flipAt, days);
  const now = new Date();

  // Sellable premium packages only: a module that cannot be bought needs no
  // grace to buy it in.
  const packages = await db.skillPackage.findMany({
    where: { isPremium: true, isActive: true, priceAmount: { not: null } },
    select: { id: true, skillId: true, assessmentType: true },
  });

  const organizations = await db.organization.findMany({
    where: { createdAt: { lt: options.flipAt } },
    select: {
      id: true,
      members: {
        where: { role: { in: ["OWNER", "ADMIN"] } },
        orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
        select: { role: true, user: { select: { email: true, name: true } } },
      },
      customerLinks: {
        select: {
          customer: {
            select: {
              id: true,
              email: true,
              name: true,
              entitlements: {
                where: {
                  status: "ACTIVE",
                  OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
                },
                select: { skillPackageId: true },
              },
            },
          },
        },
      },
    },
  });

  const entries: GracePlanEntry[] = [];
  const skipped: GracePlan["skipped"] = [];

  for (const org of organizations) {
    const used = await modulesInUse(db, org.id, options.flipAt, packages);
    if (used.length === 0) {
      skipped.push({ organizationId: org.id, reason: "no premium module in use" });
      continue;
    }

    // The buyer: an existing linked Customer first, else the first OWNER
    // (ADMIN as a fallback). OrganizationRole sorts ADMIN < OWNER
    // alphabetically, so pick explicitly.
    const linked = org.customerLinks[0]?.customer ?? null;
    const owner =
      org.members.find((m) => m.role === "OWNER") ??
      org.members.find((m) => m.role === "ADMIN");
    const buyerEmail = linked?.email ?? owner?.user.email ?? null;
    if (!buyerEmail) {
      skipped.push({ organizationId: org.id, reason: "no owner or admin with an e-mail" });
      continue;
    }
    const buyerName = linked?.name ?? owner?.user.name ?? null;
    const live = new Set(linked?.entitlements.map((e) => e.skillPackageId) ?? []);

    for (const pkg of used) {
      if (live.has(pkg.id)) continue; // already entitled — nothing to grant
      entries.push({
        organizationId: org.id,
        buyerEmail,
        buyerName,
        packageId: pkg.id,
        skillId: pkg.skillId,
        expiresAt,
      });
    }
  }

  return { flipAt: options.flipAt, days, expiresAt, entries, skipped };
}

/**
 * Apply the plan. Resolves the Customer the same way the checkout route and
 * the offline activation do (org link, then e-mail, then create) and writes
 * TRIAL rows only where no live entitlement exists. Idempotent: a second run
 * over the same plan finds the rows live and writes nothing.
 */
export async function applyPaywallGrace(
  db: Db,
  plan: GracePlan
): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;
  const now = new Date();

  for (const entry of plan.entries) {
    const link = await db.customerOrganization.findFirst({
      where: { organizationId: entry.organizationId },
      include: { customer: true },
    });
    let customer = link?.customer ?? null;
    if (!customer) {
      customer = await db.customer.findUnique({ where: { email: entry.buyerEmail } });
      if (customer) {
        await db.customerOrganization.create({
          data: { customerId: customer.id, organizationId: entry.organizationId },
        });
      } else {
        customer = await db.customer.create({
          data: {
            name: entry.buyerName || entry.buyerEmail,
            email: entry.buyerEmail,
            type: "SAAS",
            organizations: { create: { organizationId: entry.organizationId } },
          },
        });
      }
    }

    const existing = await db.skillEntitlement.findUnique({
      where: {
        customerId_skillPackageId: { customerId: customer.id, skillPackageId: entry.packageId },
      },
    });
    const isLive =
      existing &&
      existing.status === "ACTIVE" &&
      (!existing.expiresAt || existing.expiresAt > now);
    if (isLive) {
      skipped += 1;
      continue;
    }

    await db.skillEntitlement.upsert({
      where: {
        customerId_skillPackageId: { customerId: customer.id, skillPackageId: entry.packageId },
      },
      update: {
        licenseType: "TRIAL",
        status: "ACTIVE",
        stripeSubscriptionId: null,
        expiresAt: entry.expiresAt,
      },
      create: {
        customerId: customer.id,
        skillPackageId: entry.packageId,
        licenseType: "TRIAL",
        status: "ACTIVE",
        expiresAt: entry.expiresAt,
      },
    });
    created += 1;
  }

  return { created, skipped };
}
