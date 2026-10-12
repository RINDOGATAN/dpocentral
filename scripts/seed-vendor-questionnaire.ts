// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

// Safe to run on every boot of an existing install: the questionnaire is
// written through upsertSystemQuestionnaire, which refreshes only the system
// row and never replaces a newer version.

import { PrismaClient } from "@prisma/client";
import { describeOutcome, upsertSystemQuestionnaire } from "../src/lib/seed-system-content";
import { VENDOR_QUESTIONNAIRE_V2 } from "../src/config/vendor-questionnaires";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding vendor questionnaire template...");

  const questionnaire = VENDOR_QUESTIONNAIRE_V2;

  console.log(
    describeOutcome(
      "Vendor questionnaire",
      "system-vendor-questionnaire",
      await upsertSystemQuestionnaire(prisma, "system-vendor-questionnaire", questionnaire)
    )
  );
  console.log(
    "  8 sections, 38 questions — based on SIG, CAIQ, and GDPR Article 28"
  );
  console.log("Done!");
}

main()
  .catch((e) => {
    console.error("Error seeding vendor questionnaire:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
