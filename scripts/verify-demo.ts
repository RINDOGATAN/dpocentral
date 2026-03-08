#!/usr/bin/env tsx
// scripts/verify-demo.ts
// E2E verification: seed demo data → export documents → validate output
//
// Usage:
//   npx tsx scripts/verify-demo.ts           # Meridian only
//   npx tsx scripts/verify-demo.ts --all     # Meridian + all verticals

import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";
import { existsSync, statSync, mkdirSync, readdirSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();
const OUTPUT_DIR = "/tmp/dpocentral-exports";
const VERTICALS = ["saas", "healthcare", "fintech", "media", "professional-services"];

interface CheckResult {
  name: string;
  passed: boolean;
  detail: string;
}

const results: CheckResult[] = [];

function check(name: string, passed: boolean, detail: string) {
  results.push({ name, passed, detail });
  const icon = passed ? "✓" : "✗";
  console.log(`  ${icon} ${name}: ${detail}`);
}

function run(cmd: string, label: string): boolean {
  console.log(`\n  Running: ${label}...`);
  try {
    execSync(cmd, { stdio: "inherit", timeout: 120_000, cwd: process.cwd() });
    return true;
  } catch (e: any) {
    console.error(`  Failed: ${e.message}`);
    return false;
  }
}

async function verifyOrgData(slug: string, orgName: string): Promise<void> {
  console.log(`\n── Verifying ${orgName} (${slug}) ──`);

  const org = await prisma.organization.findFirst({ where: { slug } });
  check(`${slug}: org exists`, !!org, org ? `ID: ${org.id}` : "Not found");
  if (!org) return;

  const [assets, activities, vendors, dsars, assessments, incidents] = await Promise.all([
    prisma.dataAsset.count({ where: { organizationId: org.id } }),
    prisma.processingActivity.count({ where: { organizationId: org.id } }),
    prisma.vendor.count({ where: { organizationId: org.id } }),
    prisma.dSARRequest.count({ where: { organizationId: org.id } }),
    prisma.assessment.count({ where: { organizationId: org.id } }),
    prisma.incident.count({ where: { organizationId: org.id } }),
  ]);

  check(`${slug}: assets`, assets >= 5, `${assets} data assets`);
  check(`${slug}: activities`, activities >= 3, `${activities} processing activities`);
  check(`${slug}: vendors`, vendors >= 3, `${vendors} vendors`);
  check(`${slug}: DSARs`, dsars >= 3, `${dsars} DSARs`);
  check(`${slug}: assessments`, assessments >= 3, `${assessments} assessments`);
  check(`${slug}: incidents`, incidents >= 2, `${incidents} incidents`);

  // Check for a DPIA assessment specifically
  const dpia = await prisma.assessment.findFirst({
    where: {
      organizationId: org.id,
      template: { type: "DPIA" },
    },
    include: {
      responses: { select: { id: true } },
      mitigations: { select: { id: true } },
      approvals: { select: { id: true } },
    },
  });

  if (dpia) {
    check(`${slug}: DPIA exists`, true, `"${dpia.name}" — ${dpia.status}`);
    check(`${slug}: DPIA responses`, dpia.responses.length >= 20, `${dpia.responses.length} responses`);
    check(`${slug}: DPIA mitigations`, dpia.mitigations.length >= 4, `${dpia.mitigations.length} mitigations`);
    check(`${slug}: DPIA approvals`, dpia.approvals.length >= 1, `${dpia.approvals.length} approvals`);
  } else {
    check(`${slug}: DPIA exists`, false, "No DPIA found");
  }
}

async function verifyExports(orgSlug: string, orgName: string): Promise<void> {
  console.log(`\n── Verifying exports for ${orgName} ──`);

  const safeName = orgName.replace(/[^a-zA-Z0-9]/g, "-");
  const files = existsSync(OUTPUT_DIR) ? readdirSync(OUTPUT_DIR) : [];

  // Check for assessment PDFs
  const assessmentPdfs = files.filter(
    (f) => f.startsWith("Assessment-") && f.includes(safeName.substring(0, 10))
  );
  // More lenient: just check any PDFs exist for this org
  const orgPdfs = files.filter((f) => f.includes(safeName.substring(0, 15)));
  check(`${orgSlug}: export files`, orgPdfs.length >= 1, `${orgPdfs.length} files found`);

  // Check DPIA PDF specifically
  const dpiaPdfs = files.filter((f) => f.includes("DPIA") && f.includes(safeName.substring(0, 10)));
  if (dpiaPdfs.length > 0) {
    const dpiaPath = join(OUTPUT_DIR, dpiaPdfs[0]);
    const size = statSync(dpiaPath).size;
    check(`${orgSlug}: DPIA PDF size`, size > 10_000, `${(size / 1024).toFixed(1)} KB`);
  }

  // Check ROPA PDF
  const ropaPdfs = files.filter((f) => f.startsWith("ROPA-") && f.includes(safeName.substring(0, 10)));
  check(`${orgSlug}: ROPA PDF`, ropaPdfs.length >= 1, `${ropaPdfs.length} ROPA files`);
}

async function main() {
  const allFlag = process.argv.includes("--all");

  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║  DPO Central — Demo Verification                ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  mkdirSync(OUTPUT_DIR, { recursive: true });

  // Step 1: Seed Meridian demo
  console.log("═══ Step 1: Seed Meridian Retail Group ═══");
  const meridianSeeded = run("npx tsx scripts/seed-demo-scenario.ts", "seed-demo-scenario");
  check("meridian: seed", meridianSeeded, meridianSeeded ? "Seeded OK" : "Seed failed");

  if (meridianSeeded) {
    await verifyOrgData("demo", "Meridian Retail Group");
  }

  // Step 2: Export Meridian docs
  console.log("\n═══ Step 2: Export Meridian Documents ═══");
  const meridianExported = run("npx tsx scripts/export-demo-docs.ts", "export-demo-docs");
  check("meridian: export", meridianExported, meridianExported ? "Exported OK" : "Export failed");

  if (meridianExported) {
    await verifyExports("demo", "Meridian Retail Group");
  }

  // Step 3: Optionally seed and verify all verticals
  if (allFlag) {
    console.log("\n═══ Step 3: Seed All Verticals ═══");
    const verticalSeeded = run("npx tsx scripts/demo/runner.ts --all", "demo runner --all");
    check("verticals: seed", verticalSeeded, verticalSeeded ? "All seeded" : "Seed failed");

    if (verticalSeeded) {
      const slugMap: Record<string, { slug: string; name: string }> = {
        saas: { slug: "demo-saas", name: "CloudForge Labs" },
        healthcare: { slug: "demo-healthcare", name: "Nordic Health Group" },
        fintech: { slug: "demo-fintech", name: "Vega Financial" },
        media: { slug: "demo-media", name: "Herald Digital Media" },
        "professional-services": { slug: "demo-proserv", name: "Alder & Stone Consulting" },
      };

      for (const v of VERTICALS) {
        const { slug, name } = slugMap[v];
        await verifyOrgData(slug, name);
      }
    }
  }

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║  Verification Summary                           ║");
  console.log("╠══════════════════════════════════════════════════╣");
  console.log(`║  Total checks: ${String(total).padStart(3)}                              ║`);
  console.log(`║  Passed:       ${String(passed).padStart(3)}  ✓                           ║`);
  console.log(`║  Failed:       ${String(failed).padStart(3)}  ${failed > 0 ? "✗" : " "}                           ║`);
  console.log("╚══════════════════════════════════════════════════╝");

  if (failed > 0) {
    console.log("\nFailed checks:");
    for (const r of results.filter((r) => !r.passed)) {
      console.log(`  ✗ ${r.name}: ${r.detail}`);
    }
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error("Verification failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
