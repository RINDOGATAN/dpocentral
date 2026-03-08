// scripts/demo/types.ts
// TypeScript interfaces for vertical demo scenario data

import type {
  DataAssetType,
  DataCategory,
  DataSensitivity,
  LegalBasis,
  TransferMechanism,
  VendorStatus,
  VendorRiskTier,
  ContractType,
  ContractStatus,
  DSARType,
  DSARStatus,
  AssessmentStatus,
  RiskLevel,
  MitigationStatus,
  IncidentType,
  IncidentSeverity,
  IncidentStatus,
  NotificationStatus,
  TaskPriority,
  TaskStatus,
} from "@prisma/client";

// ── Data Inventory ─────────────────────────────────────────

export interface AssetDef {
  id: string;
  name: string;
  description: string;
  type: DataAssetType;
  owner: string;
  location: string;
  hostingType: string;
  vendor: string;
  isProduction: boolean;
}

export interface ElementDef {
  id: string;
  dataAssetId: string;
  name: string;
  category: DataCategory;
  sensitivity: DataSensitivity;
  isPersonalData: boolean;
  isSpecialCategory?: boolean;
  retentionDays: number;
  legalBasis: string;
}

export interface ActivityDef {
  id: string;
  name: string;
  description: string;
  purpose: string;
  legalBasis: LegalBasis;
  legalBasisDetail: string;
  dataSubjects: string[];
  categories: DataCategory[];
  recipients: string[];
  retentionPeriod: string;
  retentionDays: number;
  automatedDecisionMaking?: boolean;
  automatedDecisionDetail?: string;
  isActive: boolean;
  lastReviewedAt: string;
  nextReviewAt: string;
  /** Asset IDs this activity links to */
  assetIds: string[];
}

export interface FlowDef {
  id: string;
  name: string;
  description: string;
  sourceAssetId: string;
  destinationAssetId: string;
  dataCategories: DataCategory[];
  frequency: string;
  volume: string;
  encryptionMethod: string;
  isAutomated: boolean;
}

export interface TransferDef {
  id: string;
  name: string;
  description: string;
  destinationCountry: string;
  destinationOrg: string;
  mechanism: TransferMechanism;
  safeguards: string;
  tiaCompleted: boolean;
  tiaDate?: string;
  /** ID of the linked processing activity */
  activityId: string;
}

// ── Vendors ────────────────────────────────────────────────

export interface VendorDef {
  id: string;
  name: string;
  description: string;
  website: string;
  status: VendorStatus;
  riskTier: VendorRiskTier;
  riskScore: number;
  primaryContact: string;
  contactEmail: string;
  categories: string[];
  dataProcessed: DataCategory[];
  countries: string[];
  certifications: string[];
  lastAssessedAt: string | null;
  nextReviewAt: string;
}

export interface ContractDef {
  id: string;
  vendorId: string;
  type: ContractType;
  status: ContractStatus;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  autoRenewal: boolean;
  value?: number;
  currency?: string;
}

// ── DSARs ──────────────────────────────────────────────────

export interface DSARDef {
  id: string;
  publicId: string;
  type: DSARType;
  status: DSARStatus;
  requesterName: string;
  requesterEmail: string;
  requesterPhone?: string;
  relationship: string;
  description: string;
  receivedAt: string;
  acknowledgedAt?: string;
  dueDate: string;
  completedAt?: string;
  verificationMethod?: string;
  verifiedAt?: string;
  responseMethod?: string;
  responseNotes?: string;
  tasks: DSARTaskDef[];
  communications: DSARCommDef[];
}

export interface DSARTaskDef {
  id: string;
  dataAssetId: string;
  /** Symbolic user ref: "dpo" | "admin" | "member1" | "member2" */
  assignee: string;
  title: string;
  description: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  completedAt?: string;
  notes?: string;
}

export interface DSARCommDef {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  channel: string;
  subject: string;
  content: string;
  sentAt: string;
  /** Symbolic user ref for outbound — null for inbound */
  sentBy?: string;
}

// ── Assessments ────────────────────────────────────────────

export interface AssessmentDef {
  id: string;
  /** "lia" | "custom" | "dpia" — resolved to actual template ID by runner */
  templateType: "lia" | "custom" | "dpia";
  /** ID of linked processing activity */
  activityId?: string;
  /** ID of linked vendor */
  vendorId?: string;
  name: string;
  description: string;
  status: AssessmentStatus;
  riskLevel?: RiskLevel;
  riskScore?: number;
  startedAt: string;
  submittedAt?: string;
  completedAt?: string;
  dueDate: string;
  responses: AssessmentResponseDef[];
  mitigations: MitigationDef[];
  approvals: ApprovalDef[];
}

export interface AssessmentResponseDef {
  questionId: string;
  sectionId: string;
  response: any;
  /** Symbolic user ref */
  responder: string;
}

export interface MitigationDef {
  id: string;
  riskId: string;
  title: string;
  description: string;
  status: MitigationStatus;
  priority: number;
  owner: string;
  completedAt?: string;
  evidence?: string;
  dueDate?: string;
}

export interface ApprovalDef {
  id: string;
  /** Symbolic user ref */
  approver: string;
  level: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  comments: string | null;
  decidedAt?: string;
}

// ── Incidents ──────────────────────────────────────────────

export interface IncidentDef {
  id: string;
  publicId: string;
  title: string;
  description: string;
  type: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  discoveredAt: string;
  discoveredBy: string;
  discoveryMethod: string;
  affectedRecords: number;
  affectedSubjects: string[];
  dataCategories: DataCategory[];
  containedAt?: string;
  containmentActions?: string;
  rootCause?: string;
  rootCauseCategory?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  lessonsLearned?: string;
  notificationRequired: boolean;
  notificationDeadline?: string;
  timeline: TimelineEntryDef[];
  tasks: IncidentTaskDef[];
  affectedAssets: AffectedAssetDef[];
  notifications: IncidentNotificationDef[];
}

export interface TimelineEntryDef {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  entryType: string;
  /** Symbolic user ref */
  createdBy: string;
  metadata?: Record<string, any>;
}

export interface IncidentTaskDef {
  id: string;
  /** Symbolic user ref */
  assignee: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  completedAt?: string;
  dueDate?: string;
  notes?: string;
}

export interface AffectedAssetDef {
  id: string;
  dataAssetId: string;
  impactLevel: string;
  compromised: boolean;
  notes?: string;
}

export interface IncidentNotificationDef {
  id: string;
  /** "GDPR" jurisdiction code — resolved by runner */
  jurisdictionCode: string;
  recipientType: string;
  recipientName: string;
  status: NotificationStatus;
  deadline?: string;
  content?: string;
  notes?: string;
}

// ── Audit Logs ─────────────────────────────────────────────

export interface AuditLogDef {
  id: string;
  /** Symbolic user ref */
  user: string;
  entityType: string;
  /** ID of the entity — can reference assets, DSARs, assessments, incidents */
  entityId: string;
  action: string;
  changes: Record<string, any>;
  createdAt: string;
}

// ── Top-level Scenario ─────────────────────────────────────

export interface UserDef {
  id: string;
  email: string;
  name: string;
  role: "OWNER" | "ADMIN" | "PRIVACY_OFFICER" | "MEMBER" | "VIEWER";
  /** Symbolic key used to reference this user elsewhere */
  ref: string;
}

export interface VerticalScenario {
  /** Unique vertical key, e.g. "saas", "healthcare" */
  key: string;
  /** Organization name */
  orgName: string;
  /** Organization slug (used for org lookup) */
  orgSlug: string;
  /** Organization domain */
  domain: string;
  /** Primary jurisdictions to link (codes, e.g. ["GDPR"]) */
  jurisdictionCodes: string[];
  /** Additional jurisdictions to upsert if not already in DB */
  extraJurisdictions?: {
    code: string;
    name: string;
    region: string;
    dsarDeadlineDays: number;
    breachNotificationHours: number;
  }[];

  /** Users (first user is org owner, second is DPO, etc.) */
  users: UserDef[];

  // Data Inventory
  assets: AssetDef[];
  elements: ElementDef[];
  activities: ActivityDef[];
  flows: FlowDef[];
  transfers: TransferDef[];

  // Vendors
  vendors: VendorDef[];
  contracts: ContractDef[];

  // DSARs
  intakeForm: {
    name: string;
    slug: string;
    title: string;
    description: string;
  };
  dsars: DSARDef[];

  // Assessments
  assessments: AssessmentDef[];

  // Incidents
  incidents: IncidentDef[];

  // Audit Trail
  auditLogs: AuditLogDef[];
}
