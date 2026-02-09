import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding vendor catalog from processors.json...");

  const processorsPath = path.join(process.cwd(), "vendors", "processors.json");
  const processorsFile = fs.readFileSync(processorsPath, "utf-8");
  const { processors } = JSON.parse(processorsFile);

  let vendorCount = 0;
  for (const p of processors) {
    const gdprCompliant = p.compliance?.gdpr?.compliant ?? null;
    const ccpaCompliant = p.compliance?.ccpa?.compliant ?? null;
    const certifications = p.compliance?.certifications || [];

    const frameworks: string[] = [];
    if (gdprCompliant) frameworks.push("GDPR");
    if (ccpaCompliant) frameworks.push("CCPA");

    await prisma.vendorCatalog.upsert({
      where: { slug: p.id },
      update: {
        name: p.name,
        category: p.category,
        description: p.description || null,
        website: p.website || null,
        privacyPolicyUrl: p.privacyPolicy || null,
        gdprCompliant,
        ccpaCompliant,
        certifications,
        frameworks,
        source: "processors.json",
      },
      create: {
        slug: p.id,
        name: p.name,
        category: p.category,
        description: p.description || null,
        website: p.website || null,
        privacyPolicyUrl: p.privacyPolicy || null,
        gdprCompliant,
        ccpaCompliant,
        certifications,
        frameworks,
        source: "processors.json",
      },
    });
    vendorCount++;
  }

  console.log(`Seeded ${vendorCount} vendors into catalog.`);
}

main()
  .catch((e) => {
    console.error("Error seeding vendor catalog:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
