// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Which systems on the data flow map send personal data outside the EEA,
 * from the organisation's transfer records. Pure: the router feeds it rows.
 *
 * A transfer is outside the EEA when its destination country (two-letter
 * code) is not one of the 27 EU member states, Iceland, Liechtenstein or
 * Norway. It is placed on a system when:
 *
 *   1. its receiving organisation is the system's name or the system's
 *      vendor (case and surrounding spaces ignored); else
 *   2. its processing activity links exactly one external system (a third
 *      party or a cloud service): that one.
 *
 * Otherwise it is not drawn on the map (it stays in the transfers list), so
 * the marker never points at a system the record does not name.
 */

import { EU_COUNTRIES } from "@/lib/region";

export const EEA_COUNTRIES: readonly string[] = [...EU_COUNTRIES, "IS", "LI", "NO"];
const EEA = new Set(EEA_COUNTRIES);

export function isOutsideEea(country: string | null | undefined): boolean {
  const c = country?.trim().toUpperCase();
  return !!c && /^[A-Z]{2}$/.test(c) && !EEA.has(c);
}

export interface MarkerAsset {
  id: string;
  name: string;
  vendor?: string | null;
  type: string;
}

export interface MarkerTransfer {
  id: string;
  destinationCountry: string;
  destinationOrg?: string | null;
  processingActivityId?: string | null;
  isActive?: boolean;
}

export interface TransferMarker {
  assetId: string;
  /** The transfers placed on this system, oldest record first as given. */
  transferIds: string[];
  /** Distinct destination countries, sorted. */
  countries: string[];
}

const EXTERNAL_TYPES = new Set(["THIRD_PARTY", "CLOUD_SERVICE"]);
const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

export function transferMarkers(
  assets: MarkerAsset[],
  transfers: MarkerTransfer[],
  /** Activity id -> ids of the systems linked to it. */
  activityAssets: Map<string, string[]>
): TransferMarker[] {
  const byName = new Map<string, string[]>();
  for (const a of assets) {
    for (const key of new Set([norm(a.name), norm(a.vendor)])) {
      if (!key) continue;
      byName.set(key, [...(byName.get(key) ?? []), a.id]);
    }
  }
  const typeOf = new Map(assets.map((a) => [a.id, a.type]));

  const out = new Map<string, { transferIds: string[]; countries: Set<string> }>();
  for (const t of transfers) {
    if (t.isActive === false || !isOutsideEea(t.destinationCountry)) continue;
    let targets = byName.get(norm(t.destinationOrg)) ?? [];
    if (targets.length === 0 && t.processingActivityId) {
      const external = (activityAssets.get(t.processingActivityId) ?? []).filter((id) =>
        EXTERNAL_TYPES.has(typeOf.get(id) ?? "")
      );
      if (external.length === 1) targets = external;
    }
    for (const assetId of targets) {
      const m = out.get(assetId) ?? { transferIds: [], countries: new Set<string>() };
      m.transferIds.push(t.id);
      m.countries.add(t.destinationCountry.trim().toUpperCase());
      out.set(assetId, m);
    }
  }
  return [...out.entries()].map(([assetId, m]) => ({
    assetId,
    transferIds: m.transferIds,
    countries: [...m.countries].sort(),
  }));
}
