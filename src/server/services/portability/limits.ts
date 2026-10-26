// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The ceilings an import must respect: on the hosted pilot, the records
 * ceiling (PILOT_LIMITS); nothing on the self-hosted kit. An import is a way in, never a way around a ceiling.
 */

import type { Db } from "@/lib/prisma";
import {
  assertPilotCapacity,
  pilotMessage,
  type PilotDb,
  type PilotResource,
} from "@/server/services/pilot/caps";
import { isHostedDeployment } from "@/lib/hosted";
import type { AddingCounts } from "./import";

const RESOURCES: Array<[PilotResource, keyof AddingCounts]> = [
  ["dataAssets", "dataAssets"],
  ["dataElements", "dataElements"],
  ["processingActivities", "processingActivities"],
  ["dataFlows", "dataFlows"],
  ["dataTransfers", "dataTransfers"],
  ["vendors", "vendors"],
  ["vendorContracts", "vendorContracts"],
  ["assessments", "assessments"],
  ["assessmentTemplates", "assessmentTemplates"],
  ["incidents", "incidents"],
  ["aiSystems", "aiSystems"],
];

export function importLimitChecker(db: Db, organizationId: string) {
  return async (adding: AddingCounts): Promise<Array<{ en: string; es: string }>> => {
    const out: Array<{ en: string; es: string }> = [];
    if (isHostedDeployment()) {
      for (const [resource, key] of RESOURCES) {
        const n = adding[key];
        if (!n) continue;
        try {
          await assertPilotCapacity(db as unknown as PilotDb, organizationId, resource, n);
        } catch {
          out.push({
            en: pilotMessage("ceiling", "en", resource),
            es: pilotMessage("ceiling", "es", resource),
          });
        }
      }
    }
    return out;
  };
}
