// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The quick start's rule for template data flows: a direction already
 * recorded between two systems is not recorded again. The build skips it
 * (routers/privacy/quickstart.ts, execute) and the review leaves it out of the
 * count it promises (previewIndustryTemplate), so a second run with the same
 * template adds no duplicate flows and says so.
 *
 * Pure, so the rule is tested without a database.
 */

/** One direction between two systems, for skipping flows already recorded. */
export function flowPairKey(sourceAssetId: string, destinationAssetId: string): string {
  return `${sourceAssetId}>${destinationAssetId}`;
}

/**
 * How many flow records a template run would add: a one-way flow is one, a
 * two-way flow two, less each direction already recorded between two systems
 * that both exist. `assetIdByName` holds the template's systems that exist.
 */
export function newTemplateFlowCount(
  flows: readonly { sourceAssetName: string; destAssetName: string; returnFlow?: unknown }[],
  assetIdByName: ReadonlyMap<string, string>,
  existingPairs: ReadonlySet<string>,
): number {
  const recorded = (from: string, to: string) => {
    const a = assetIdByName.get(from);
    const b = assetIdByName.get(to);
    return !!a && !!b && existingPairs.has(flowPairKey(a, b));
  };
  return flows.reduce(
    (sum, f) =>
      sum +
      (recorded(f.sourceAssetName, f.destAssetName) ? 0 : 1) +
      (f.returnFlow && !recorded(f.destAssetName, f.sourceAssetName) ? 1 : 0),
    0,
  );
}
