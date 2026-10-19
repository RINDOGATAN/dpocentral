// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Which systems on the data flow map send personal data outside the EEA,
 * from the organisation's transfer records. Pure: the router feeds it rows.
 *
 * A transfer is outside the EEA when its destination country (two-letter
 * code, aliases UK and EL accepted) is not one of the 27 EU member states,
 * Iceland, Liechtenstein or Norway. It is placed on a system when:
 *
 *   1. its receiving organisation, or its linked vendor's name, is the
 *      system's name or the system's vendor (case and surrounding spaces
 *      ignored); else
 *   2. its processing activity links exactly one external system (a third
 *      party or a cloud service): that one.
 *
 * Otherwise it is not placed on a system: the map still draws it, from its
 * vendor (when one is linked) or on its own, to the destination country, so
 * no transfer record is left out of the map.
 *
 * Each marker carries, per transfer, its safeguard (mechanism) and its
 * compliance status (the status recorded on the transfer, else the one the
 * rules suggest), and the worst status among them, so the map tells a UK
 * adequacy transfer from one under SCCs with no TIA.
 */

import { canonicalCountryCode, isIsoCountryCode } from "@/lib/country-code";
import {
  EEA_COUNTRY_CODES,
  getTransferComplianceStatus,
  isEeaCountry,
  type TransferComplianceStatus,
} from "@/config/transfer-compliance-rules";

export const EEA_COUNTRIES: readonly string[] = EEA_COUNTRY_CODES;

export function isOutsideEea(country: string | null | undefined): boolean {
  const c = canonicalCountryCode(country);
  // An ISO country code only: region words such as "EU" are not countries.
  return isIsoCountryCode(c) && !isEeaCountry(c);
}

const STATUS_RANK: Record<TransferComplianceStatus, number> = {
  COMPLIANT: 0,
  PENDING: 1,
  NEEDS_REVIEW: 2,
  NON_COMPLIANT: 3,
};

const KNOWN_STATUSES = new Set<string>(Object.keys(STATUS_RANK));

export function worseStatus(
  a: TransferComplianceStatus,
  b: TransferComplianceStatus
): TransferComplianceStatus {
  return STATUS_RANK[b] > STATUS_RANK[a] ? b : a;
}

export interface MarkerAsset {
  id: string;
  name: string;
  vendor?: string | null;
  type: string;
}

export interface MarkerTransfer {
  id: string;
  name?: string | null;
  destinationCountry: string;
  destinationOrg?: string | null;
  processingActivityId?: string | null;
  vendorId?: string | null;
  isActive?: boolean;
  mechanism?: string | null;
  tiaCompleted?: boolean | null;
  sccExpiryDate?: Date | null;
  complianceStatus?: string | null;
  adequacyScopeConfirmed?: boolean | null;
}

/**
 * The status a transfer shows on the map: the one recorded on it; with
 * none recorded, the rules' suggestion (the map marks it as suggested).
 */
export function effectiveTransferStatus(t: MarkerTransfer): TransferComplianceStatus {
  if (t.complianceStatus && KNOWN_STATUSES.has(t.complianceStatus)) {
    return t.complianceStatus as TransferComplianceStatus;
  }
  if (!t.mechanism) return "PENDING";
  return getTransferComplianceStatus({
    mechanism: t.mechanism,
    destinationCountry: t.destinationCountry,
    tiaCompleted: t.tiaCompleted ?? false,
    sccExpiryDate: t.sccExpiryDate ?? null,
    adequacyScopeConfirmed: t.adequacyScopeConfirmed ?? null,
  });
}

export interface MarkerTransferDetail {
  id: string;
  country: string;
  mechanism: string | null;
  status: TransferComplianceStatus;
  /** True when no status is recorded and `status` is the rules' suggestion. */
  suggested: boolean;
}

export interface TransferMarker {
  assetId: string;
  /** The transfers placed on this system, oldest record first as given. */
  transferIds: string[];
  /** Distinct destination countries, sorted. */
  countries: string[];
  /** One entry per transfer: country, safeguard and status. */
  transfers: MarkerTransferDetail[];
  /** The worst status among them (non-compliant > needs review > pending > compliant). */
  worstStatus: TransferComplianceStatus;
  /**
   * Countries outside the EEA where the system's vendor (in the vendor
   * register, matched by name) operates or stores data, with no transfer
   * record to that country placed on this system.
   */
  unrecordedCountries: string[];
}

export interface MarkerVendor {
  id?: string;
  name: string;
  countries: string[];
}

/** One transfer outside the EEA, as the map draws it (system or vendor to country). */
export interface OverlayTransfer extends MarkerTransferDetail {
  name: string;
  /** The systems it is placed on (none: drawn from its vendor, or alone). */
  assetIds: string[];
  vendorId: string | null;
}

/** A vendor the map draws as its own node: in use, and no system stands for it. */
export interface OverlayVendor {
  id: string;
  name: string;
  /** Its countries outside the EEA with no transfer record linked to it. */
  unrecordedCountries: string[];
}

export interface TransferOverlay {
  markers: TransferMarker[];
  transfers: OverlayTransfer[];
  vendors: OverlayVendor[];
}

const EXTERNAL_TYPES = new Set(["THIRD_PARTY", "CLOUD_SERVICE"]);
const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

/**
 * The map's transfer layer: markers on systems, every transfer outside the
 * EEA with where it starts, and the vendors that need a node of their own.
 */
export function transferOverlay(
  assets: MarkerAsset[],
  transfers: MarkerTransfer[],
  /** Activity id -> ids of the systems linked to it. */
  activityAssets: Map<string, string[]>,
  /** The vendor register (in use), for links and transfers not yet recorded. */
  vendors: MarkerVendor[] = []
): TransferOverlay {
  const byName = new Map<string, string[]>();
  for (const a of assets) {
    for (const key of new Set([norm(a.name), norm(a.vendor)])) {
      if (!key) continue;
      byName.set(key, [...(byName.get(key) ?? []), a.id]);
    }
  }
  const typeOf = new Map(assets.map((a) => [a.id, a.type]));
  const vendorById = new Map(vendors.filter((v) => v.id).map((v) => [v.id!, v]));

  const out = new Map<string, { transferIds: string[]; countries: Set<string>; details: MarkerTransferDetail[] }>();
  const overlayTransfers: OverlayTransfer[] = [];
  const recordedByVendor = new Map<string, Set<string>>();

  for (const t of transfers) {
    if (t.isActive === false || !isOutsideEea(t.destinationCountry)) continue;
    const country = canonicalCountryCode(t.destinationCountry);
    const vendor = t.vendorId ? vendorById.get(t.vendorId) : undefined;
    if (t.vendorId) {
      const set = recordedByVendor.get(t.vendorId) ?? new Set<string>();
      set.add(country);
      recordedByVendor.set(t.vendorId, set);
    }

    let targets = byName.get(norm(t.destinationOrg)) ?? [];
    if (targets.length === 0 && vendor) targets = byName.get(norm(vendor.name)) ?? [];
    if (targets.length === 0 && t.processingActivityId) {
      const external = (activityAssets.get(t.processingActivityId) ?? []).filter((id) =>
        EXTERNAL_TYPES.has(typeOf.get(id) ?? "")
      );
      if (external.length === 1) targets = external;
    }
    targets = [...new Set(targets)];

    const recorded = !!t.complianceStatus && KNOWN_STATUSES.has(t.complianceStatus);
    const detail: MarkerTransferDetail = {
      id: t.id,
      country,
      mechanism: t.mechanism ?? null,
      status: effectiveTransferStatus(t),
      suggested: !recorded,
    };
    overlayTransfers.push({
      ...detail,
      name: t.name ?? "",
      assetIds: targets,
      vendorId: vendor ? t.vendorId ?? null : null,
    });
    for (const assetId of targets) {
      const m = out.get(assetId) ?? { transferIds: [], countries: new Set<string>(), details: [] };
      m.transferIds.push(t.id);
      m.countries.add(country);
      m.details.push(detail);
      out.set(assetId, m);
    }
  }

  // Vendor countries outside the EEA with no transfer record on the system.
  const unrecorded = new Map<string, Set<string>>();
  const vendorNodes: OverlayVendor[] = [];
  for (const v of vendors) {
    const outside = [...new Set(v.countries.map(canonicalCountryCode).filter((c) => isOutsideEea(c)))];
    const systems = [...new Set(byName.get(norm(v.name)) ?? [])];
    for (const assetId of systems) {
      const recordedHere = out.get(assetId)?.countries ?? new Set<string>();
      for (const c of outside) {
        if (recordedHere.has(c)) continue;
        const set = unrecorded.get(assetId) ?? new Set<string>();
        set.add(c);
        unrecorded.set(assetId, set);
      }
    }
    // A vendor no system stands for gets a node of its own.
    if (systems.length === 0 && v.id) {
      const recordedForVendor = recordedByVendor.get(v.id) ?? new Set<string>();
      vendorNodes.push({
        id: v.id,
        name: v.name,
        unrecordedCountries: outside.filter((c) => !recordedForVendor.has(c)).sort(),
      });
    }
  }

  const markers: TransferMarker[] = [...out.entries()].map(([assetId, m]) => ({
    assetId,
    transferIds: m.transferIds,
    countries: [...m.countries].sort(),
    transfers: m.details,
    worstStatus: m.details.reduce<TransferComplianceStatus>((w, d) => worseStatus(w, d.status), "COMPLIANT"),
    unrecordedCountries: [...(unrecorded.get(assetId) ?? [])].sort(),
  }));
  for (const [assetId, set] of unrecorded) {
    if (out.has(assetId)) continue;
    markers.push({
      assetId,
      transferIds: [],
      countries: [],
      transfers: [],
      // No record yet, so nothing assessed: the map says "no transfer record".
      worstStatus: "PENDING",
      unrecordedCountries: [...set].sort(),
    });
  }

  // Vendor nodes are drawn when a transfer starts from them or when they
  // have unrecorded countries; vendors in use without either are also shown,
  // so the register and the map agree.
  return { markers, transfers: overlayTransfers, vendors: vendorNodes };
}

/** The markers on systems only (see transferOverlay). */
export function transferMarkers(
  assets: MarkerAsset[],
  transfers: MarkerTransfer[],
  activityAssets: Map<string, string[]>,
  vendors: MarkerVendor[] = []
): TransferMarker[] {
  return transferOverlay(assets, transfers, activityAssets, vendors).markers;
}
