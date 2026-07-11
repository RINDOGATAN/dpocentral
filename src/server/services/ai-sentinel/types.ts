// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * AI Sentinel Integration Types
 *
 * Defines the API contract between DPO Central and AI Sentinel
 * for exporting AI system records.
 */

export interface DPCSystemPayload {
  name: string;
  description?: string | null;
  purpose?: string | null;
  riskLevel: string;
  category?: string | null;
  modelType?: string | null;
  provider?: string | null;
  deployer?: string | null;
  trainingDataSources: string[];
  aiCapabilities: string[];
  aiTechniques: string[];
  euAiActRole?: string | null;
  euAiActCompliant?: boolean | null;
  iso42001Certified?: boolean | null;
  humanOversight?: string | null;
  transparencyMeasures?: string | null;
  technicalDocUrl?: string | null;
  vendorName?: string | null;
  dpoCentralSystemId: string; // DPC AISystem.id for back-linking
  dpoCentralVendorId?: string; // DPC Vendor.id
}

export interface ExportResult {
  exported: number;
  alreadyExisted: number;
  skipped: number;
  mapped: { dpcId: string; aisId: string }[];
}

export interface CheckAccountResult {
  hasAccount: boolean;
  hasOrg: boolean;
  orgId?: string;
}

/**
 * Read-through AI-Act status of a linked AI Sentinel system, for the unified
 * "one system, both regimes" panel. All fields optional: `found: false` (or a
 * null response) means not linked / not reachable, and the UI hides the panel.
 */
export interface AiSentinelSystemStatus {
  found: boolean;
  systemId?: string;
  name?: string;
  status?: string;
  riskLevel?: string | null;
  annexIIICategory?: string | null;
  fria?: { status: string; riskScore: number | null; approvedAt: string | null } | null;
  conformity?: { status: string; approvedAt: string | null } | null;
  assessmentsTotal?: number;
  openOversightGates?: number;
}
