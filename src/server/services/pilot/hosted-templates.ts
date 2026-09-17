// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Assessment templates the hosted pilot always offers.
 *
 * On the hosted service every assessment type is open, so a type must not
 * open onto an empty template list. The first template query of each server
 * instance writes the missing system templates (created at runtime, no seed or
 * migration step needed on deploy):
 *
 *  - the standard DPIA (src/config/dpia-template-v2.ts), only when no row with
 *    its id exists, so a newer DPIA already in the database is never touched;
 *  - the global templates in HOSTED_SYSTEM_TEMPLATES, through the guarded
 *    upsert that refreshes system rows and never downgrades them.
 *
 * The self-hosted kit never runs this: there a premium type is offered only
 * once its template is installed from a signed skill (the licence gate).
 */

import type { PrismaClient } from "@prisma/client";
import prismaClient from "@/lib/prisma";
import { isHostedDeployment } from "@/lib/hosted";
import { upsertSystemTemplate } from "@/lib/seed-system-content";
import { DPIA_TEMPLATE_ID, dpiaTemplateData } from "@/config/dpia-template-v2";
import {
  HEALTH_ADTECH_TEMPLATE_ID,
  healthAdtechTemplateData,
} from "@/config/health-adtech-template";

/** Global system templates written on the hosted pilot (id -> data). */
export const HOSTED_SYSTEM_TEMPLATES: Array<{
  id: string;
  data: Parameters<typeof upsertSystemTemplate>[2];
}> = [
  {
    id: HEALTH_ADTECH_TEMPLATE_ID,
    data: {
      ...healthAdtechTemplateData,
      sections: healthAdtechTemplateData.sections as object,
      scoringLogic: healthAdtechTemplateData.scoringLogic as object,
    },
  },
];

let ensured: Promise<void> | null = null;

async function writeHostedTemplates(): Promise<void> {
  // The seed helpers take the plain client type; the app client is extended.
  const prisma = prismaClient as unknown as PrismaClient;
  const existing = await prisma.assessmentTemplate.findUnique({
    where: { id: DPIA_TEMPLATE_ID },
    select: { id: true },
  });
  if (!existing) {
    const { id, ...data } = dpiaTemplateData;
    await prisma.assessmentTemplate.create({
      data: {
        id,
        ...data,
        sections: data.sections as object,
        scoringLogic: data.scoringLogic as object,
      },
    });
  }
  for (const template of HOSTED_SYSTEM_TEMPLATES) {
    await upsertSystemTemplate(prisma, template.id, template.data);
  }
}

/**
 * Makes sure the hosted pilot's templates exist. No-op on the kit. Runs once
 * per server instance; a failure is retried on the next call and never blocks
 * the query that triggered it.
 */
export async function ensureHostedTemplates(): Promise<void> {
  if (!isHostedDeployment()) return;
  if (!ensured) {
    ensured = writeHostedTemplates().catch((err) => {
      ensured = null;
      console.error("[hosted-templates] could not write the pilot templates", err);
    });
  }
  await ensured;
}

/** Test hook: forget that the templates were written. */
export function resetHostedTemplatesForTests(): void {
  ensured = null;
}
