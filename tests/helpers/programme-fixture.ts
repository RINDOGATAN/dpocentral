// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * A synthetic privacy programme for the portability tests: every register,
 * every kind of reference, built in the in-memory database (./memory-db.ts).
 * `scale` multiplies the main registers, for the large-organisation test.
 */

import type { MemoryDb } from "./memory-db";

export const SOURCE_ORG = "org-source";
export const OTHER_ORG = "org-other";
export const TARGET_ORG = "org-target";
export const OWNER_EMAIL = "owner@example.test";
export const REQUESTER_EMAIL = "requester.private@example.test";

/** Global rows every organisation shares: laws, a built-in template, a questionnaire, users. */
export function seedGlobals(db: MemoryDb) {
  db.insert("jurisdiction", { id: "jur-gdpr", code: "GDPR", name: "General Data Protection Regulation", region: "EU", dsarDeadlineDays: 30, breachNotificationHours: 72 });
  db.insert("jurisdiction", { id: "jur-ccpa", code: "CCPA", name: "California Consumer Privacy Act", region: "US-CA", dsarDeadlineDays: 45, breachNotificationHours: 72 });
  db.insert("assessmentTemplate", { id: "tpl-system-dpia", organizationId: null, type: "DPIA", name: "DPIA (system)", version: "2.0", sections: [], isSystem: true, isActive: true, supersededAt: null });
  db.insert("vendorQuestionnaire", { id: "q-system", organizationId: null, name: "Security questionnaire", version: "1.0", sections: [], isSystem: true, isActive: true });
  db.insert("user", { id: "user-owner", email: OWNER_EMAIL, name: "Owner Person" });
  db.insert("user", { id: "user-gone", email: "gone@example.test", name: "Former Member" });
  db.insert("user", { id: "user-target", email: OWNER_EMAIL.toUpperCase(), name: "Owner Here" });
  db.insert("user", { id: "user-other", email: "other@example.test", name: "Other Org" });
}

export interface SeedIds {
  assets: string[];
  activities: string[];
  vendors: string[];
}

/** One organisation's programme. Ids are prefixed so a test can tell orgs apart. */
export function seedProgramme(db: MemoryDb, orgId: string, opts: { scale?: number; prefix?: string; ownerUserId?: string } = {}): SeedIds {
  const scale = opts.scale ?? 1;
  const p = opts.prefix ?? orgId;
  const owner = opts.ownerUserId ?? "user-owner";
  db.insert("organization", { id: orgId, name: `Org ${p}`, slug: p, domain: null, settings: { programName: "Programme" }, dsarRemindersEnabled: true });
  db.insert("organizationMember", { id: `${p}-mem-owner`, organizationId: orgId, userId: owner, role: "OWNER" });
  db.insert("organizationJurisdiction", { id: `${p}-oj-1`, organizationId: orgId, jurisdictionId: "jur-gdpr", isPrimary: true, customSettings: null });
  db.insert("businessUnit", { id: `${p}-bu-root`, organizationId: orgId, name: "Operations", parentId: null, ownerId: `${p}-mem-owner` });
  db.insert("businessUnit", { id: `${p}-bu-child`, organizationId: orgId, name: "Payroll", parentId: `${p}-bu-root`, ownerId: null });

  const assets: string[] = [];
  const elements: string[] = [];
  for (let i = 0; i < 3 * scale; i++) {
    const id = `${p}-asset-${String(i).padStart(5, "0")}`;
    assets.push(id);
    db.insert("dataAsset", {
      id,
      organizationId: orgId,
      name: `System ${i}`,
      description: i === 0 ? "=SUM(A1:A2) looks like a formula" : `Holds customer data ${i}`,
      type: i % 2 ? "CLOUD_SERVICE" : "DATABASE",
      owner: "IT",
      location: "EU",
      hostingType: "Cloud",
      vendor: null,
      isProduction: true,
      businessUnitId: i === 0 ? `${p}-bu-child` : null,
      metadata: { note: `asset ${i}` },
      provenance: i === 1 ? "AUTO_TEMPLATE" : "USER_ENTERED",
      sourceRef: i === 1 ? "quickstart" : null,
      confirmedBy: i === 0 ? owner : null,
      confirmedAt: i === 0 ? new Date("2026-09-01T10:00:00Z") : null,
    });
    const el = `${p}-el-${String(i).padStart(5, "0")}`;
    elements.push(el);
    db.insert("dataElement", {
      id: el,
      organizationId: orgId,
      dataAssetId: id,
      name: `email_${i}`,
      description: null,
      category: "IDENTIFIERS",
      sensitivity: "CONFIDENTIAL",
      isPersonalData: true,
      isSpecialCategory: false,
      retentionDays: 365,
      legalBasis: null,
      metadata: null,
    });
  }

  const activities: string[] = [];
  for (let i = 0; i < 2 * scale; i++) {
    const id = `${p}-act-${String(i).padStart(5, "0")}`;
    activities.push(id);
    db.insert("processingActivity", {
      id,
      organizationId: orgId,
      name: `Activity ${i}`,
      description: null,
      purpose: "Serve customers; keep accounts",
      legalBasis: i % 2 ? "LEGITIMATE_INTERESTS" : "CONTRACT",
      legalBasisDetail: null,
      dataSubjects: ["Customers", "Prospects"],
      categories: ["IDENTIFIERS", "FINANCIAL"],
      recipients: ["Payment provider"],
      retentionPeriod: "6 years",
      retentionDays: 2190,
      automatedDecisionMaking: false,
      automatedDecisionDetail: null,
      isActive: true,
      businessUnitId: `${p}-bu-root`,
      lastReviewedAt: null,
      nextReviewAt: new Date("2027-01-01T00:00:00Z"),
      metadata: null,
      provenance: "USER_ENTERED",
      sourceRef: null,
      confirmedBy: null,
      confirmedAt: null,
    });
    const link = `${p}-paa-${i}`;
    db.insert("processingActivityAsset", { id: link, processingActivityId: id, dataAssetId: assets[i % assets.length], purpose: "Storage" });
    db.insert("processingActivityAssetElement", { id: `${p}-paae-${i}`, processingActivityAssetId: link, dataElementId: elements[i % elements.length] });
  }

  db.insert("dataFlow", { id: `${p}-flow-1`, organizationId: orgId, name: "Sync", description: null, sourceAssetId: assets[0], destinationAssetId: assets[1], dataCategories: ["IDENTIFIERS"], frequency: "Daily", volume: null, encryptionMethod: "TLS", isAutomated: true, metadata: null });
  db.insert("dataTransfer", { id: `${p}-tr-1`, organizationId: orgId, processingActivityId: activities[0], name: "To the US", description: null, destinationCountry: "US", destinationOrg: "Hosting Inc", jurisdictionId: "jur-gdpr", mechanism: "STANDARD_CONTRACTUAL_CLAUSES", safeguards: "Encryption", documentUrl: "https://example.test/scc.pdf", tiaCompleted: true, tiaDate: new Date("2026-05-01T00:00:00Z"), isActive: true, sccExpiryDate: null, supplementaryMeasures: { encryption: true }, complianceStatus: "COMPLIANT", metadata: null });

  const vendors: string[] = [];
  for (let i = 0; i < 2 * scale; i++) {
    const id = `${p}-ven-${String(i).padStart(5, "0")}`;
    vendors.push(id);
    db.insert("vendor", {
      id,
      organizationId: orgId,
      name: `Vendor ${i}`,
      description: "Payroll services",
      website: "https://vendor.example.test",
      status: "ACTIVE",
      riskTier: "MEDIUM",
      riskScore: 42.5,
      primaryContact: "Ana",
      contactEmail: "ana@vendor.example.test",
      contactPhone: "+34 600 000 000",
      address: null,
      categories: ["Payroll"],
      dataProcessed: ["FINANCIAL", "EMPLOYMENT"],
      countries: ["ES", "US"],
      certifications: ["ISO 27001"],
      lastAssessedAt: null,
      nextReviewAt: null,
      metadata: null,
      provenance: i === 0 ? "AUTO_TEMPLATE" : "USER_ENTERED",
      sourceRef: null,
      confirmedBy: null,
      confirmedAt: null,
    });
    db.insert("vendorContract", { id: `${p}-con-${i}`, vendorId: id, type: "DPA", status: "ACTIVE", name: "Data processing agreement", description: null, documentUrl: "https://example.test/dpa.pdf", startDate: new Date("2026-01-01T00:00:00Z"), endDate: null, renewalDate: null, autoRenewal: true, value: 1200, currency: "EUR", terms: { clauses: 12 }, metadata: null });
    db.insert("vendorReview", { id: `${p}-rev-${i}`, vendorId: id, reviewerId: owner, type: "PERIODIC", status: "COMPLETED", scheduledAt: new Date("2026-06-01T00:00:00Z"), completedAt: new Date("2026-06-02T00:00:00Z"), findings: "Fine", riskLevel: "LOW", recommendations: null, nextReviewAt: null });
    db.insert("vendorQuestionnaireResponse", { id: `${p}-qr-${i}`, vendorId: id, questionnaireId: "q-system", status: "SUBMITTED", responses: { q1: "yes" }, submittedAt: new Date("2026-06-01T00:00:00Z"), reviewedAt: null, reviewNotes: null, score: 80, expiresAt: null, token: `SECRET-PORTAL-TOKEN-${p}-${i}` });
  }

  db.insert("assessmentTemplate", { id: `${p}-tpl-own`, organizationId: orgId, type: "LIA", name: "Our LIA", description: null, version: "1.0", sections: [{ id: "s1", questions: [{ id: "q1" }] }], scoringLogic: null, isSystem: false, isActive: true });
  db.insert("assessment", { id: `${p}-asm-1`, organizationId: orgId, templateId: "tpl-system-dpia", processingActivityId: activities[0], vendorId: null, dataTransferId: null, name: "DPIA of activity 0", description: null, status: "APPROVED", riskLevel: "HIGH", riskScore: 7, startedAt: new Date("2026-04-01T00:00:00Z"), submittedAt: new Date("2026-04-10T00:00:00Z"), completedAt: new Date("2026-04-20T00:00:00Z"), dueDate: null, metadata: null });
  db.insert("assessmentResponse", { id: `${p}-resp-1`, assessmentId: `${p}-asm-1`, questionId: "q1", sectionId: "s1", response: { value: "Yes" }, riskScore: 2, notes: null, responderId: owner, respondedAt: new Date("2026-04-02T00:00:00Z") });
  db.insert("assessmentMitigation", { id: `${p}-mit-1`, assessmentId: `${p}-asm-1`, riskId: "r1", title: "Encrypt backups", description: null, status: "PLANNED", priority: 2, owner: "IT", dueDate: null, completedAt: null, evidence: null });
  db.insert("assessmentApproval", { id: `${p}-appr-1`, assessmentId: `${p}-asm-1`, approverId: owner, level: 1, status: "APPROVED", comments: "OK", decidedAt: new Date("2026-04-20T00:00:00Z"), delegatedTo: null });
  db.insert("assessmentVersion", { id: `${p}-ver-1`, assessmentId: `${p}-asm-1`, version: 1, snapshot: { name: "DPIA of activity 0" }, changedBy: owner, changeNotes: null });
  db.insert("assessment", { id: `${p}-asm-2`, organizationId: orgId, templateId: `${p}-tpl-own`, processingActivityId: null, vendorId: vendors[0], dataTransferId: `${p}-tr-1`, name: "LIA of vendor 0", description: null, status: "IN_PROGRESS", riskLevel: null, riskScore: null, startedAt: new Date("2026-05-01T00:00:00Z"), submittedAt: null, completedAt: null, dueDate: null, metadata: null });

  db.insert("incident", { id: `${p}-inc-1`, organizationId: orgId, publicId: `${p}-INC-0001`, title: "Lost laptop", description: "A laptop was lost", type: "DATA_LOSS", severity: "HIGH", status: "CONTAINED", discoveredAt: new Date("2026-07-01T09:00:00Z"), discoveredBy: "Ana", discoveryMethod: "Report", affectedRecords: 120, affectedSubjects: ["Employees"], dataCategories: ["EMPLOYMENT"], jurisdictionId: "jur-gdpr", containedAt: null, containmentActions: null, rootCause: null, rootCauseCategory: null, resolvedAt: null, resolutionNotes: null, lessonsLearned: null, notificationRequired: true, notificationDeadline: new Date("2026-07-04T09:00:00Z"), metadata: null });
  db.insert("incidentTimelineEntry", { id: `${p}-tl-1`, incidentId: `${p}-inc-1`, timestamp: new Date("2026-07-01T09:30:00Z"), title: "Reported", description: null, entryType: "STATUS_CHANGE", createdById: owner, metadata: null });
  db.insert("incidentTimelineEntry", { id: `${p}-tl-2`, incidentId: `${p}-inc-1`, timestamp: new Date("2026-07-01T10:30:00Z"), title: "Contained", description: null, entryType: "ACTION", createdById: "user-gone", metadata: null });
  db.insert("incidentTask", { id: `${p}-it-1`, incidentId: `${p}-inc-1`, assigneeId: owner, title: "Wipe remotely", description: null, priority: "URGENT", status: "COMPLETED", dueDate: null, completedAt: null, notes: null });
  db.insert("incidentNotification", { id: `${p}-in-1`, incidentId: `${p}-inc-1`, jurisdictionId: "jur-gdpr", recipientType: "DPA", recipientName: "Authority", recipientEmail: null, status: "SENT", deadline: new Date("2026-07-04T09:00:00Z"), content: "Notice", sentAt: new Date("2026-07-02T09:00:00Z"), acknowledgedAt: null, referenceNumber: "REF-1", notes: null });
  db.insert("incidentAffectedAsset", { id: `${p}-ia-1`, incidentId: `${p}-inc-1`, dataAssetId: assets[0], impactLevel: "High", compromised: true, notes: null });
  db.insert("incidentDocument", { id: `${p}-id-1`, incidentId: `${p}-inc-1`, name: "Police report", type: "EVIDENCE", url: "https://example.test/report.pdf", mimeType: "application/pdf", size: 1000, uploadedBy: owner });

  db.insert("aISystem", { id: `${p}-ai-1`, organizationId: orgId, vendorId: vendors[0], assessmentId: `${p}-asm-1`, name: "Chat assistant", description: null, purpose: "Support", riskLevel: "LIMITED", category: "Support", status: "REGISTERED", trainingDataSources: [], humanOversight: "Agent reviews", transparencyMeasures: null, technicalDocUrl: null, modelType: "LLM", deployer: "Us", provider: "Vendor 0", lastReviewedAt: null, nextReviewAt: null, aiSentinelSystemId: "ais-secret-link", aiSentinelOrgId: null, aiSentinelSyncedAt: null, aiCapabilities: ["text"], aiTechniques: [], euAiActRole: "Deployer", euAiActCompliant: null, iso42001Certified: null, aiModels: null, catalogSlug: null, metadata: null });

  db.insert("dSARIntakeForm", { id: `${p}-form-1`, organizationId: orgId, name: "Main form", slug: "requests", title: "Your rights", description: null, fields: [], enabledTypes: ["ACCESS", "ERASURE"], customCss: null, thankYouMessage: null, privacyNoticeUrl: null, retentionDays: 90, isActive: true });
  db.insert("dSARRequest", { id: `${p}-dsar-1`, organizationId: orgId, publicId: `${p}-REQ-1`, type: "ACCESS", status: "IN_PROGRESS", requesterName: "Private Requester", requesterEmail: REQUESTER_EMAIL, requesterPhone: null, requesterAddress: null, relationship: "Customer", description: "Send me my data", requestedData: null, verificationMethod: null, verifiedAt: null, receivedAt: new Date("2026-08-01T00:00:00Z"), acknowledgedAt: null, dueDate: new Date("2026-08-31T00:00:00Z"), completedAt: null, extensionReason: null, extendedDueDate: null, responseMethod: null, responseNotes: null, metadata: null, redactedAt: null });
  db.insert("dSARTask", { id: `${p}-dt-1`, dsarRequestId: `${p}-dsar-1`, dataAssetId: assets[0], assigneeId: owner, title: "Search the CRM", description: null, status: "PENDING", dueDate: null, completedAt: null, notes: null, dataExport: { secret: "copy" } });
  db.insert("dSARCommunication", { id: `${p}-dc-1`, dsarRequestId: `${p}-dsar-1`, direction: "INBOUND", channel: "Email", subject: "Request", content: "Please send me my data", attachments: null, sentById: null, sentAt: new Date("2026-08-01T00:00:00Z"), metadata: null });

  db.insert("auditLog", { id: `${p}-log-1`, organizationId: orgId, userId: owner, entityType: "Vendor", entityId: vendors[0], action: "UPDATE", changes: { name: "SECRET-CHANGE-DETAIL" }, ipAddress: "203.0.113.9", userAgent: "Browser", metadata: null });
  db.insert("auditLog", { id: `${p}-log-2`, organizationId: orgId, userId: owner, entityType: "DSARRequest", entityId: `${p}-dsar-1`, action: "CREATE", changes: { requesterEmail: REQUESTER_EMAIL }, ipAddress: null, userAgent: null, metadata: null });

  // Secrets that must never leave.
  db.insert("account", { id: `${p}-acc`, userId: owner, provider: "google", access_token: "SECRET-OAUTH-TOKEN" });
  db.insert("session", { id: `${p}-ses`, userId: owner, sessionToken: "SECRET-SESSION-TOKEN" });

  return { assets, activities, vendors };
}
