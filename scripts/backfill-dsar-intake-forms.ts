import prisma from "../src/lib/prisma";
import { ensureDefaultIntakeForm } from "../src/server/services/dsar/defaultIntakeForm";

async function main() {
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true, slug: true } });
  console.log(`Scanning ${orgs.length} organizations…`);

  let createdCount = 0;
  let skippedCount = 0;
  for (const org of orgs) {
    const result = await ensureDefaultIntakeForm(prisma, org.id);
    if (result.created) {
      console.log(`  ✓ ${org.name} (${org.slug}) — created default form`);
      createdCount++;
    } else {
      skippedCount++;
    }
  }

  console.log(`\nDone. Created: ${createdCount}, skipped (already had a form): ${skippedCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
