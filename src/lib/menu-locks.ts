// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Which steps of the menu carry a small lock (owner's decision, 9 October
 * 2026, with the retirement of Classic): a step that leads to a premium
 * assessment type (`premiumType` in path-config.ts) while the organisation is
 * not entitled to it, by the same rule the pages use (isAssessmentTypeLocked:
 * never on the hosted pilot; on the kit, locked until the type's template is
 * installed from a signed skill). Where nothing is locked, no lock is shown.
 * No price, ever.
 *
 * Pure: shared by the menu and its tests.
 */

import type { PathConfig } from "@/components/guided/path";
import { isAssessmentTypeLocked } from "@/lib/premium-gate";

export function lockedStepIds<C>(
  config: PathConfig<C>,
  params: { entitledTypes: readonly string[] | null | undefined; hosted: boolean },
): string[] {
  // Until the entitlement answer arrives, nothing is shown locked: better a
  // lock a moment late than one that then disappears.
  if (params.hosted || !params.entitledTypes) return [];
  const entitledTypes = params.entitledTypes;
  return config.stages.flatMap((stage) =>
    stage.steps
      .filter((step) => step.premiumType && isAssessmentTypeLocked({ type: step.premiumType, entitledTypes, hosted: false }))
      .map((step) => step.id),
  );
}
