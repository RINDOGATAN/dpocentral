#!/usr/bin/env tsx
// scripts/demo/runner.ts
// CLI entry point: seeds one or all vertical demo scenarios
// Usage:
//   npx tsx scripts/demo/runner.ts --vertical saas
//   npx tsx scripts/demo/runner.ts --all

import { PrismaClient } from "@prisma/client";
import {
  verifyPrerequisites,
  upsertDpiaTemplate,
  seedScenario,
} from "./helpers";
import type { VerticalScenario } from "./types";

const VERTICALS: Record<string, () => Promise<{ scenario: VerticalScenario }>> = {
  saas: () => import("./verticals/saas"),
  healthcare: () => import("./verticals/healthcare"),
  fintech: () => import("./verticals/fintech"),
  media: () => import("./verticals/media"),
  "professional-services": () => import("./verticals/professional-services"),
};

async function main() {
  const args = process.argv.slice(2);
  const allFlag = args.includes("--all");
  const verticalIdx = args.indexOf("--vertical");
  const verticalName = verticalIdx >= 0 ? args[verticalIdx + 1] : undefined;

  if (!allFlag && !verticalName) {
    console.log("Usage:");
    console.log("  npx tsx scripts/demo/runner.ts --vertical <name>");
    console.log("  npx tsx scripts/demo/runner.ts --all");
    console.log("\nAvailable verticals:", Object.keys(VERTICALS).join(", "));
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    console.log("╔══════════════════════════════════════════════════╗");
    console.log("║  DPO Central — Vertical Demo Scenario Seed      ║");
    console.log("╚══════════════════════════════════════════════════╝\n");

    // Prerequisites
    console.log("Verifying prerequisites...");
    await verifyPrerequisites(prisma);
    console.log("  ✓ Templates and questionnaire found");

    console.log("Upserting DPIA v2 template...");
    await upsertDpiaTemplate(prisma);
    console.log("  ✓ DPIA template v2.0 ready\n");

    const targets = allFlag
      ? Object.keys(VERTICALS)
      : [verticalName!];

    for (const name of targets) {
      const loader = VERTICALS[name];
      if (!loader) {
        console.error(`Unknown vertical: ${name}`);
        console.error("Available:", Object.keys(VERTICALS).join(", "));
        process.exit(1);
      }

      const { scenario } = await loader();

      console.log("╔══════════════════════════════════════════════════╗");
      console.log(`║  ${scenario.orgName.padEnd(46)}  ║`);
      console.log(`║  Org: ${scenario.orgSlug.padEnd(42)}  ║`);
      console.log("╚══════════════════════════════════════════════════╝");

      await seedScenario(prisma, scenario);

      console.log(`\n  ✓ ${scenario.orgName} seeded successfully\n`);
    }

    // Summary
    console.log("╔══════════════════════════════════════════════════╗");
    console.log("║  All done!                                      ║");
    console.log("╠══════════════════════════════════════════════════╣");
    for (const name of targets) {
      const { scenario } = await VERTICALS[name]();
      const total =
        scenario.assets.length + scenario.elements.length +
        scenario.activities.length + scenario.flows.length +
        scenario.transfers.length + scenario.vendors.length +
        scenario.contracts.length + scenario.dsars.length +
        scenario.assessments.length + scenario.incidents.length +
        scenario.auditLogs.length + scenario.users.length;
      console.log(`║  ${scenario.orgName.padEnd(35)} ~${String(total).padStart(3)} records  ║`);
    }
    console.log("╚══════════════════════════════════════════════════╝");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
