// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * One seeding path for the global "Health data in advertising" template.
 *
 * The template is of type DPIA, so it accompanies a DPIA: it is written only
 * where a DPIA system template is already installed. That is the rule, and it
 * is applied in one place, by both paths that write templates:
 *
 *  - the content seed (scripts/seed-templates.ts), run on every boot of a
 *    self-hosted install, where the DPIA template arrives from a signed skill
 *    package and the rule keeps the licence gate;
 *  - the hosted service (src/server/services/pilot/hosted-templates.ts),
 *    which writes the standard DPIA first and so always satisfies the rule.
 *
 * Before, the hosted path wrote it unconditionally and the seed wrote it only
 * behind the check, so the same release produced a different set of templates
 * depending on where it ran.
 */

import type { PrismaClient } from "@prisma/client";
import { upsertSystemTemplate, type SystemUpsertOutcome } from "./seed-system-content";
// Relative, not aliased: this module is loaded by scripts/seed-templates.ts
// under tsx as well as by the app.
import {
  HEALTH_ADTECH_TEMPLATE_ID,
  healthAdtechTemplateData,
} from "../config/health-adtech-template";

export type HealthAdtechSeedResult =
  | { written: false; reason: "no-dpia-template" }
  | { written: true; outcome: SystemUpsertOutcome };

/** True when a DPIA system template other than this one is installed. */
export async function hasDpiaTemplate(prisma: PrismaClient): Promise<boolean> {
  const dpia = await prisma.assessmentTemplate.findFirst({
    where: {
      type: "DPIA",
      isSystem: true,
      organizationId: null,
      id: { not: HEALTH_ADTECH_TEMPLATE_ID },
    },
    select: { id: true },
  });
  return dpia !== null;
}

/**
 * Writes the template through the guarded upsert when the rule allows it.
 * Never downgrades a newer installed version (upsertSystemTemplate decides).
 */
export async function seedHealthAdtechTemplate(
  prisma: PrismaClient
): Promise<HealthAdtechSeedResult> {
  if (!(await hasDpiaTemplate(prisma))) {
    return { written: false, reason: "no-dpia-template" };
  }
  const outcome = await upsertSystemTemplate(prisma, HEALTH_ADTECH_TEMPLATE_ID, {
    ...healthAdtechTemplateData,
    sections: healthAdtechTemplateData.sections as object,
    scoringLogic: healthAdtechTemplateData.scoringLogic as object,
  });
  return { written: true, outcome };
}
