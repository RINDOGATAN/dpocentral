// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Flip-day grace for hosted organizations that pre-date billing.
 *
 *   npm run db:grant-paywall-grace -- --flip=2026-10-01T00:00:00Z            # plan only
 *   npm run db:grant-paywall-grace -- --flip=2026-10-01T00:00:00Z --days=30 --apply
 *
 * Writes one TRIAL entitlement per organization per premium module it was
 * already using before the flip, expiring at flip + days (see
 * src/server/services/licensing/paywall-grace.ts). Without --apply it prints
 * the plan and changes nothing. Prints ids and counts only — no e-mail
 * address or name leaves this process.
 *
 * Run it ONCE, on the day the Stripe flag build goes live, against the
 * hosted database (the assert-safe-db preflight applies). A second run is
 * harmless: live rows are skipped.
 */

import { PrismaClient } from "@prisma/client";
import {
  DEFAULT_PAYWALL_GRACE_DAYS,
  applyPaywallGrace,
  planPaywallGrace,
} from "../src/server/services/licensing/paywall-grace";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

async function main() {
  const flipRaw = arg("flip");
  if (!flipRaw) {
    throw new Error("Missing --flip=<ISO date-time of the billing switch-on>");
  }
  const flipAt = new Date(flipRaw);
  if (Number.isNaN(flipAt.getTime())) {
    throw new Error(`Unparseable --flip value: ${flipRaw}`);
  }
  const daysRaw = arg("days");
  const days = daysRaw ? Number.parseInt(daysRaw, 10) : DEFAULT_PAYWALL_GRACE_DAYS;
  if (!Number.isFinite(days) || days < 0) {
    throw new Error(`Unparseable --days value: ${daysRaw}`);
  }
  const apply = process.argv.includes("--apply");

  const prisma = new PrismaClient();
  try {
    const plan = await planPaywallGrace(prisma, { flipAt, days });

    const byOrg = new Map<string, string[]>();
    for (const e of plan.entries) {
      byOrg.set(e.organizationId, [...(byOrg.get(e.organizationId) ?? []), e.skillId]);
    }
    const report = {
      mode: apply ? "apply" : "plan",
      flipAt: plan.flipAt.toISOString(),
      days: plan.days,
      expiresAt: plan.expiresAt.toISOString(),
      organizationsGranted: byOrg.size,
      entitlementsPlanned: plan.entries.length,
      grants: Object.fromEntries(byOrg),
      skipped: plan.skipped,
    };
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");

    if (!apply) {
      process.stdout.write("Plan only. Re-run with --apply to write it.\n");
      return;
    }

    const result = await applyPaywallGrace(prisma, plan);
    process.stdout.write(
      `Applied: ${result.created} entitlements written, ${result.skipped} already live.\n`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
