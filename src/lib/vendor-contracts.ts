// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * When a processor contract (a VendorContract of type DPA) is in force, and
 * how the reports count processors covered by one. The vendor register, the
 * programme report and the board report all read these, so they print the
 * same figure for the same data.
 *
 * - In force: status ACTIVE or RENEWED, and no end date, or an end date that
 *   has not passed. A draft, a contract waiting for signature, an expired or a
 *   terminated one is not in force; neither is an ACTIVE one past its end date.
 * - Counted processors: vendors in use (status ACTIVE) that a person has
 *   confirmed (drafts are listed but not counted, as everywhere else).
 *
 * Pure; tested in tests/vendor-contracts.test.ts.
 */

export const IN_FORCE_CONTRACT_STATUSES = ["ACTIVE", "RENEWED"] as const;

export interface ContractLike {
  type: string;
  status: string;
  endDate?: Date | string | null;
}

/** True when the contract is in force on `now`. */
export function isContractInForce(contract: Pick<ContractLike, "status" | "endDate">, now: Date = new Date()): boolean {
  if (!(IN_FORCE_CONTRACT_STATUSES as readonly string[]).includes(contract.status)) return false;
  if (!contract.endDate) return true;
  return new Date(contract.endDate).getTime() >= now.getTime();
}

/** True when the vendor holds a processor contract (DPA) in force on `now`. */
export function hasDpaInForce(contracts: readonly ContractLike[], now: Date = new Date()): boolean {
  return contracts.some((c) => c.type === "DPA" && isContractInForce(c, now));
}

/**
 * The processor contract a register shows for a vendor: the one in force if
 * there is one, else the most recent (the list is expected newest first).
 */
export function displayedDpa<C extends ContractLike>(contracts: readonly C[], now: Date = new Date()): C | undefined {
  const dpas = contracts.filter((c) => c.type === "DPA");
  return dpas.find((c) => isContractInForce(c, now)) ?? dpas[0];
}

/**
 * The tone a register gives a processor contract: green in force, amber when
 * it waits for signature or is a draft, red when expired, terminated, or past
 * its end date.
 */
export function dpaTone(contract: Pick<ContractLike, "status" | "endDate">, now: Date = new Date()): "success" | "warning" | "danger" {
  if (isContractInForce(contract, now)) return "success";
  if (contract.status === "PENDING_SIGNATURE" || contract.status === "DRAFT") return "warning";
  return "danger";
}

/**
 * The status a register prints for a processor contract: its own status, or
 * EXPIRED for one still marked ACTIVE or RENEWED whose end date has passed.
 */
export function dpaDisplayStatus(contract: Pick<ContractLike, "status" | "endDate">, now: Date = new Date()): string {
  if ((IN_FORCE_CONTRACT_STATUSES as readonly string[]).includes(contract.status) && !isContractInForce(contract, now)) {
    return "EXPIRED";
  }
  return contract.status;
}

/** The Prisma filter for "a processor contract in force on `now`". */
export function dpaInForceWhere(now: Date = new Date()) {
  return {
    type: "DPA" as const,
    status: { in: [...IN_FORCE_CONTRACT_STATUSES] },
    OR: [{ endDate: null }, { endDate: { gte: now } }],
  };
}

export interface CoverageVendor {
  status: string;
  /** A draft nobody has confirmed (src/server/services/template-items/drafts.ts). */
  isDraft?: boolean;
  riskTier?: string | null;
  contracts: readonly ContractLike[];
}

export interface DpaCoverage {
  /** Confirmed vendors in use (status ACTIVE). */
  active: number;
  /** Of those, with a processor contract in force. */
  withDpa: number;
  /** Of those, without one. */
  withoutDpa: number;
  /** Of those without one, rated high or critical. */
  highRiskWithoutDpa: number;
}

/** Processor-contract coverage of the vendors in use, as every report prints it. */
export function dpaCoverage(vendors: readonly CoverageVendor[], now: Date = new Date()): DpaCoverage {
  const counted = vendors.filter((v) => v.status === "ACTIVE" && !v.isDraft);
  const covered = counted.filter((v) => hasDpaInForce(v.contracts, now));
  const uncovered = counted.filter((v) => !hasDpaInForce(v.contracts, now));
  return {
    active: counted.length,
    withDpa: covered.length,
    withoutDpa: uncovered.length,
    highRiskWithoutDpa: uncovered.filter((v) => v.riskTier === "HIGH" || v.riskTier === "CRITICAL").length,
  };
}
