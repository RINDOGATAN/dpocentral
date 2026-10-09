// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import en from "../src/messages/en.json";
import es from "../src/messages/es.json";

// Prisma enum values must reach the screen as localised labels, never as the
// raw SCREAMING_SNAKE code (which also leaks English into the Spanish UI).
// This guards the class of defect: a list or detail page printing `{x.status}`,
// `{x.type}`, `{x.severity}`, `{x.mechanism}` or `{x.legalBasis}` directly.
//
// A verbatim render is a JSX text expression whose whole content is a single
// enum field access — `{x.type}`, optionally with a `.replace(...)` de-snake.
// It excludes attribute bindings (`value={…}`, `key={…}`, `href={…}` — the `=`
// before the brace), template-literal interpolations (`${x.status}` inside
// `t(`status.${x.status}`)` — the `$` before the brace), label calls (a `(`
// inside, e.g. `{t(...)}` or `{enumLabel(...)}`), and ternary/fallbacks, which
// already resolve to a label.
const VERBATIM_ENUM_RENDER =
  /(?<![=$])\{\s*[A-Za-z_$][\w$]*\.(?:type|status|severity|riskTier|riskLevel|mechanism|legalBasis|requestType|action|entityType)(?:\.replace\([^)]*\))?\s*\}/g;

// The live data components (list + detail) whose enums must all route through a
// label. Curated: the docs/* pages render hardcoded demo data, and a couple of
// pages show free-text fields that happen to be named `.type` (an AI model's
// type/source), so they are out of scope here.
const COMPONENTS = [
  "src/app/(dashboard)/privacy/page.tsx",
  "src/app/(dashboard)/privacy/vendors/page.tsx",
  "src/app/(dashboard)/privacy/vendors/[id]/page.tsx",
  "src/app/(dashboard)/privacy/assessments/page.tsx",
  "src/app/(dashboard)/privacy/assessments/[id]/page.tsx",
  "src/app/(dashboard)/privacy/assessments/templates/page.tsx",
  "src/app/(dashboard)/privacy/dsar/page.tsx",
  "src/app/(dashboard)/privacy/dsar/[id]/page.tsx",
  "src/app/(dashboard)/privacy/incidents/page.tsx",
  "src/app/(dashboard)/privacy/incidents/[id]/page.tsx",
  "src/app/(dashboard)/privacy/transfers/page.tsx",
  "src/app/(dashboard)/privacy/ai-systems/page.tsx",
  "src/app/(dashboard)/privacy/data-inventory/page.tsx",
  "src/app/(dashboard)/privacy/data-inventory/[id]/page.tsx",
  "src/app/(dashboard)/privacy/data-inventory/activities/[id]/page.tsx",
  "src/app/(dashboard)/privacy/data-inventory/elements/[id]/page.tsx",
  "src/app/(dashboard)/privacy/quickstart/page.tsx",
  "src/components/privacy/data-flow/FlowDetailsPanel.tsx",
  "src/components/privacy/data-flow/CreateFlowSheet.tsx",
];

describe("dashboard components never render an enum value verbatim", () => {
  for (const rel of COMPONENTS) {
    it(`${rel} routes enum fields through a label`, () => {
      const src = readFileSync(path.join(process.cwd(), rel), "utf8");
      const offenders = src.match(VERBATIM_ENUM_RENDER) ?? [];
      expect(offenders, `${rel}: ${offenders.join(", ")}`).toEqual([]);
    });
  }
});

// Every enum member shown on screen has a label in the `enums` namespace, in
// both locales. A missing key silently degrades to a de-snaked English code, so
// this keeps the Spanish UI honest.
const MEMBERS: Record<string, string[]> = {
  assessmentType: ["DPIA", "PIA", "TIA", "LIA", "VENDOR", "CUSTOM"],
  assessmentStatus: ["DRAFT", "IN_PROGRESS", "PENDING_REVIEW", "PENDING_APPROVAL", "APPROVED", "REJECTED", "ARCHIVED"],
  approvalStatus: ["PENDING", "APPROVED", "REJECTED", "DELEGATED"],
  dsarType: ["ACCESS", "RECTIFICATION", "ERASURE", "PORTABILITY", "OBJECTION", "RESTRICTION", "AUTOMATED_DECISION", "WITHDRAW_CONSENT", "OTHER"],
  dsarStatus: ["SUBMITTED", "IDENTITY_PENDING", "IDENTITY_VERIFIED", "IN_PROGRESS", "DATA_COLLECTED", "REVIEW_PENDING", "APPROVED", "COMPLETED", "REJECTED", "CANCELLED"],
  incidentSeverity: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
  incidentStatus: ["REPORTED", "INVESTIGATING", "CONTAINED", "ERADICATED", "RECOVERING", "CLOSED", "FALSE_POSITIVE"],
  incidentType: ["DATA_BREACH", "UNAUTHORIZED_ACCESS", "DATA_LOSS", "SYSTEM_COMPROMISE", "PHISHING", "RANSOMWARE", "INSIDER_THREAT", "PHYSICAL_SECURITY", "VENDOR_INCIDENT", "OTHER"],
  transferMechanism: ["ADEQUACY_DECISION", "STANDARD_CONTRACTUAL_CLAUSES", "BINDING_CORPORATE_RULES", "DEROGATION", "CERTIFICATION", "CODE_OF_CONDUCT", "OTHER"],
  transferStatus: ["COMPLIANT", "NEEDS_REVIEW", "NON_COMPLIANT", "PENDING"],
  riskLevel: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
  legalBasis: ["CONSENT", "CONTRACT", "LEGAL_OBLIGATION", "VITAL_INTERESTS", "PUBLIC_TASK", "LEGITIMATE_INTERESTS"],
  vendorStatus: ["PROSPECTIVE", "ACTIVE", "UNDER_REVIEW", "SUSPENDED", "TERMINATED"],
  contractType: ["DPA", "MSA", "NDA", "SCC", "SUBPROCESSOR", "OTHER"],
  dataAssetType: ["DATABASE", "APPLICATION", "FILE_SYSTEM", "CLOUD_SERVICE", "THIRD_PARTY", "PHYSICAL", "OTHER"],
  dataSensitivity: ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED", "SPECIAL_CATEGORY"],
  role: ["OWNER", "ADMIN", "PRIVACY_OFFICER", "MEMBER", "VIEWER"],
  // The audit trail's verbs and entity names, shown on the dashboard's recent
  // activity. Entity names are model names, so a missing key would de-snake to
  // a mangled "Aisystem"/"Dsarrequest"; every current value must carry a label.
  auditAction: [
    "CREATE", "UPDATE", "DELETE", "VIEW", "SUBMIT", "SUBMIT_AND_APPROVE", "STATUS_CHANGED",
    "DEADLINE_EXTENDED", "TASKS_GENERATED", "PII_REDACTED", "GENERATE_DPA", "UPDATE_COMPLIANCE",
    "EXPORT_TO_AI_SENTINEL", "REQUEST_CREATED", "REQUEST_SUBMITTED_PUBLIC", "REQUEST_WITHDRAWN_PUBLIC",
    "PII_AUTO_REDACTED", "VIEWED",
  ],
  auditEntity: [
    "Organization", "OrganizationMember", "OrganizationJurisdiction", "OrganizationAiSettings",
    "DataAsset", "ProcessingActivity", "DataFlow", "DataTransfer", "Vendor", "VendorContract",
    "Assessment", "DSARRequest", "Incident", "IncidentNotification", "AISystem",
  ],
};

describe("every on-screen enum member has a localised label in both locales", () => {
  for (const [name, messages] of [["en", en], ["es", es]] as const) {
    const enums = (messages as { enums: Record<string, Record<string, string>> }).enums;
    for (const [kind, members] of Object.entries(MEMBERS)) {
      it(`${name}.enums.${kind} carries every member`, () => {
        for (const member of members) {
          expect(enums[kind]?.[member], `missing enums.${kind}.${member}`).toBeTruthy();
        }
      });
    }
  }
});
