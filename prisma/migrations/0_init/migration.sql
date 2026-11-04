-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('BUSINESS_OWNER', 'PRIVACY_PROFESSIONAL');

-- CreateEnum
CREATE TYPE "ExpertEngagementStatus" AS ENUM ('CONTACTED', 'RESPONDED', 'ENGAGED', 'COMPLETED', 'DECLINED');

-- CreateEnum
CREATE TYPE "OrganizationRole" AS ENUM ('OWNER', 'ADMIN', 'PRIVACY_OFFICER', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "DataAssetType" AS ENUM ('DATABASE', 'APPLICATION', 'FILE_SYSTEM', 'CLOUD_SERVICE', 'THIRD_PARTY', 'PHYSICAL', 'OTHER');

-- CreateEnum
CREATE TYPE "DataSensitivity" AS ENUM ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED', 'SPECIAL_CATEGORY');

-- CreateEnum
CREATE TYPE "DataCategory" AS ENUM ('IDENTIFIERS', 'DEMOGRAPHICS', 'FINANCIAL', 'HEALTH', 'BIOMETRIC', 'LOCATION', 'BEHAVIORAL', 'EMPLOYMENT', 'EDUCATION', 'POLITICAL', 'RELIGIOUS', 'GENETIC', 'SEXUAL_ORIENTATION', 'CRIMINAL', 'OTHER');

-- CreateEnum
CREATE TYPE "LegalBasis" AS ENUM ('CONSENT', 'CONTRACT', 'LEGAL_OBLIGATION', 'VITAL_INTERESTS', 'PUBLIC_TASK', 'LEGITIMATE_INTERESTS');

-- CreateEnum
CREATE TYPE "TransferMechanism" AS ENUM ('ADEQUACY_DECISION', 'STANDARD_CONTRACTUAL_CLAUSES', 'BINDING_CORPORATE_RULES', 'DEROGATION', 'CERTIFICATION', 'CODE_OF_CONDUCT', 'OTHER');

-- CreateEnum
CREATE TYPE "DSARType" AS ENUM ('ACCESS', 'RECTIFICATION', 'ERASURE', 'PORTABILITY', 'OBJECTION', 'RESTRICTION', 'AUTOMATED_DECISION', 'WITHDRAW_CONSENT', 'OTHER');

-- CreateEnum
CREATE TYPE "DSARStatus" AS ENUM ('SUBMITTED', 'IDENTITY_PENDING', 'IDENTITY_VERIFIED', 'IN_PROGRESS', 'DATA_COLLECTED', 'REVIEW_PENDING', 'APPROVED', 'COMPLETED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DSARTaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "CommunicationDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "AssessmentType" AS ENUM ('DPIA', 'PIA', 'TIA', 'LIA', 'VENDOR', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'PENDING_REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "MitigationStatus" AS ENUM ('IDENTIFIED', 'PLANNED', 'IN_PROGRESS', 'IMPLEMENTED', 'VERIFIED', 'NOT_REQUIRED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'DELEGATED');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('REPORTED', 'INVESTIGATING', 'CONTAINED', 'ERADICATED', 'RECOVERING', 'CLOSED', 'FALSE_POSITIVE');

-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('DATA_BREACH', 'UNAUTHORIZED_ACCESS', 'DATA_LOSS', 'SYSTEM_COMPROMISE', 'PHISHING', 'RANSOMWARE', 'INSIDER_THREAT', 'PHYSICAL_SECURITY', 'VENDOR_INCIDENT', 'OTHER');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'DRAFTED', 'SENT', 'ACKNOWLEDGED', 'FOLLOW_UP_REQUIRED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('EVIDENCE', 'REPORT', 'COMMUNICATION', 'LEGAL', 'OTHER');

-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('PROSPECTIVE', 'ACTIVE', 'UNDER_REVIEW', 'SUSPENDED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "VendorRiskTier" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('DPA', 'MSA', 'NDA', 'SCC', 'SUBPROCESSOR', 'OTHER');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'PENDING_SIGNATURE', 'ACTIVE', 'EXPIRED', 'TERMINATED', 'RENEWED');

-- CreateEnum
CREATE TYPE "QuestionnaireStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ReviewType" AS ENUM ('INITIAL', 'PERIODIC', 'TRIGGERED', 'RENEWAL');

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('SAAS', 'SELF_HOSTED');

-- CreateEnum
CREATE TYPE "LicenseType" AS ENUM ('TRIAL', 'SUBSCRIPTION', 'PERPETUAL');

-- CreateEnum
CREATE TYPE "EntitlementStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "NotificationEventType" AS ENUM ('DSAR_DEADLINE_APPROACHING', 'DSAR_DEADLINE_OVERDUE', 'DSAR_NEW_REQUEST', 'INCIDENT_SEVERITY_ESCALATION', 'INCIDENT_NOTIFICATION_DEADLINE', 'VENDOR_CONTRACT_EXPIRING', 'VENDOR_REVIEW_DUE', 'ASSESSMENT_OVERDUE', 'ASSESSMENT_AUTO_CREATED', 'ASSESSMENT_APPROVAL_REQUESTED', 'ASSESSMENT_APPROVED', 'ASSESSMENT_REJECTED', 'TRANSFER_SCC_EXPIRING', 'REGULATION_UPDATE', 'AI_SYSTEM_REVIEW_DUE');

-- CreateEnum
CREATE TYPE "AIRiskLevel" AS ENUM ('UNACCEPTABLE', 'HIGH_RISK', 'LIMITED', 'MINIMAL');

-- CreateEnum
CREATE TYPE "AISystemStatus" AS ENUM ('DRAFT', 'REGISTERED', 'UNDER_REVIEW', 'COMPLIANT', 'NON_COMPLIANT', 'DECOMMISSIONED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "userType" "UserType",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "domain" TEXT,
    "logoUrl" TEXT,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expert_engagements" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "expertId" TEXT NOT NULL,
    "expertName" TEXT NOT NULL,
    "expertFirm" TEXT,
    "expertEmail" TEXT,
    "contactedById" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT,
    "status" "ExpertEngagementStatus" NOT NULL DEFAULT 'CONTACTED',
    "externalRequestId" TEXT,
    "notes" TEXT,
    "contactedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "expert_engagements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_members" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "OrganizationRole" NOT NULL DEFAULT 'MEMBER',
    "invitedEmail" TEXT,
    "invitedAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jurisdictions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "dsarDeadlineDays" INTEGER NOT NULL,
    "breachNotificationHours" INTEGER NOT NULL,
    "dpaCContactInfo" JSONB,
    "requirements" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jurisdictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_jurisdictions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jurisdictionId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "customSettings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_jurisdictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_assets" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "DataAssetType" NOT NULL,
    "owner" TEXT,
    "location" TEXT,
    "hostingType" TEXT,
    "vendor" TEXT,
    "isProduction" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_elements" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "dataAssetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "DataCategory" NOT NULL,
    "sensitivity" "DataSensitivity" NOT NULL DEFAULT 'INTERNAL',
    "isPersonalData" BOOLEAN NOT NULL DEFAULT true,
    "isSpecialCategory" BOOLEAN NOT NULL DEFAULT false,
    "retentionDays" INTEGER,
    "legalBasis" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_elements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_activities" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "purpose" TEXT NOT NULL,
    "legalBasis" "LegalBasis" NOT NULL,
    "legalBasisDetail" TEXT,
    "dataSubjects" TEXT[],
    "categories" "DataCategory"[],
    "recipients" TEXT[],
    "retentionPeriod" TEXT,
    "retentionDays" INTEGER,
    "automatedDecisionMaking" BOOLEAN NOT NULL DEFAULT false,
    "automatedDecisionDetail" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastReviewedAt" TIMESTAMP(3),
    "nextReviewAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "processing_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_activity_assets" (
    "id" TEXT NOT NULL,
    "processingActivityId" TEXT NOT NULL,
    "dataAssetId" TEXT NOT NULL,
    "purpose" TEXT,

    CONSTRAINT "processing_activity_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_activity_asset_elements" (
    "id" TEXT NOT NULL,
    "processingActivityAssetId" TEXT NOT NULL,
    "dataElementId" TEXT NOT NULL,

    CONSTRAINT "processing_activity_asset_elements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_flows" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sourceAssetId" TEXT NOT NULL,
    "destinationAssetId" TEXT NOT NULL,
    "dataCategories" "DataCategory"[],
    "frequency" TEXT,
    "volume" TEXT,
    "encryptionMethod" TEXT,
    "isAutomated" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_flows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_transfers" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "processingActivityId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "destinationCountry" TEXT NOT NULL,
    "destinationOrg" TEXT,
    "jurisdictionId" TEXT,
    "mechanism" "TransferMechanism" NOT NULL,
    "safeguards" TEXT,
    "documentUrl" TEXT,
    "tiaCompleted" BOOLEAN NOT NULL DEFAULT false,
    "tiaDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sccExpiryDate" TIMESTAMP(3),
    "supplementaryMeasures" JSONB,
    "complianceStatus" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dsar_requests" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "type" "DSARType" NOT NULL,
    "status" "DSARStatus" NOT NULL DEFAULT 'SUBMITTED',
    "requesterName" TEXT NOT NULL,
    "requesterEmail" TEXT NOT NULL,
    "requesterPhone" TEXT,
    "requesterAddress" TEXT,
    "relationship" TEXT,
    "description" TEXT,
    "requestedData" TEXT,
    "verificationMethod" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "extensionReason" TEXT,
    "extendedDueDate" TIMESTAMP(3),
    "responseMethod" TEXT,
    "responseNotes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "redactedAt" TIMESTAMP(3),

    CONSTRAINT "dsar_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dsar_tasks" (
    "id" TEXT NOT NULL,
    "dsarRequestId" TEXT NOT NULL,
    "dataAssetId" TEXT,
    "assigneeId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "DSARTaskStatus" NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "dataExport" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dsar_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dsar_communications" (
    "id" TEXT NOT NULL,
    "dsarRequestId" TEXT NOT NULL,
    "direction" "CommunicationDirection" NOT NULL,
    "channel" TEXT NOT NULL,
    "subject" TEXT,
    "content" TEXT NOT NULL,
    "attachments" JSONB,
    "sentById" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "dsar_communications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dsar_audit_logs" (
    "id" TEXT NOT NULL,
    "dsarRequestId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "performedBy" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dsar_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dsar_intake_forms" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fields" JSONB NOT NULL,
    "enabledTypes" "DSARType"[],
    "customCss" TEXT,
    "thankYouMessage" TEXT,
    "privacyNoticeUrl" TEXT,
    "retentionDays" INTEGER NOT NULL DEFAULT 90,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dsar_intake_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_templates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "type" "AssessmentType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "sections" JSONB NOT NULL,
    "scoringLogic" JSONB,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "processingActivityId" TEXT,
    "vendorId" TEXT,
    "dataTransferId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "riskLevel" "RiskLevel",
    "riskScore" DOUBLE PRECISION,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_responses" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "riskScore" DOUBLE PRECISION,
    "notes" TEXT,
    "responderId" TEXT,
    "respondedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_mitigations" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "MitigationStatus" NOT NULL DEFAULT 'IDENTIFIED',
    "priority" INTEGER NOT NULL DEFAULT 3,
    "owner" TEXT,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "evidence" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_mitigations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_approvals" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "comments" TEXT,
    "decidedAt" TIMESTAMP(3),
    "delegatedTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_versions" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changedBy" TEXT,
    "changeNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "IncidentType" NOT NULL,
    "severity" "IncidentSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "IncidentStatus" NOT NULL DEFAULT 'REPORTED',
    "discoveredAt" TIMESTAMP(3) NOT NULL,
    "discoveredBy" TEXT,
    "discoveryMethod" TEXT,
    "affectedRecords" INTEGER,
    "affectedSubjects" TEXT[],
    "dataCategories" "DataCategory"[],
    "jurisdictionId" TEXT,
    "containedAt" TIMESTAMP(3),
    "containmentActions" TEXT,
    "rootCause" TEXT,
    "rootCauseCategory" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "lessonsLearned" TEXT,
    "notificationRequired" BOOLEAN NOT NULL DEFAULT false,
    "notificationDeadline" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_notifications" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "jurisdictionId" TEXT NOT NULL,
    "recipientType" TEXT NOT NULL,
    "recipientName" TEXT,
    "recipientEmail" TEXT,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "deadline" TIMESTAMP(3) NOT NULL,
    "content" TEXT,
    "sentAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "referenceNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incident_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_timeline_entries" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "entryType" TEXT NOT NULL,
    "createdById" TEXT,
    "metadata" JSONB,

    CONSTRAINT "incident_timeline_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_tasks" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incident_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_affected_assets" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "dataAssetId" TEXT NOT NULL,
    "impactLevel" TEXT,
    "compromised" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "incident_affected_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_documents" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL DEFAULT 'OTHER',
    "url" TEXT NOT NULL,
    "mimeType" TEXT,
    "size" INTEGER,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "website" TEXT,
    "status" "VendorStatus" NOT NULL DEFAULT 'PROSPECTIVE',
    "riskTier" "VendorRiskTier",
    "riskScore" DOUBLE PRECISION,
    "primaryContact" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "address" TEXT,
    "categories" TEXT[],
    "dataProcessed" "DataCategory"[],
    "countries" TEXT[],
    "certifications" TEXT[],
    "lastAssessedAt" TIMESTAMP(3),
    "nextReviewAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_contracts" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "type" "ContractType" NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "documentUrl" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "renewalDate" TIMESTAMP(3),
    "autoRenewal" BOOLEAN NOT NULL DEFAULT false,
    "value" DOUBLE PRECISION,
    "currency" TEXT,
    "terms" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_questionnaires" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "sections" JSONB NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_questionnaires_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_questionnaire_responses" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "questionnaireId" TEXT NOT NULL,
    "status" "QuestionnaireStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "responses" JSONB,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "score" DOUBLE PRECISION,
    "expiresAt" TIMESTAMP(3),
    "token" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_questionnaire_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_reviews" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "type" "ReviewType" NOT NULL DEFAULT 'PERIODIC',
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "findings" TEXT,
    "riskLevel" "RiskLevel",
    "recommendations" TEXT,
    "nextReviewAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_packages" (
    "id" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "assessmentType" "AssessmentType",
    "description" TEXT,
    "isPremium" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "stripePriceId" TEXT,
    "priceAmount" INTEGER,
    "priceCurrency" TEXT DEFAULT 'usd',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "type" "CustomerType" NOT NULL,
    "stripeCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_organizations" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_entitlements" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "skillPackageId" TEXT NOT NULL,
    "licenseKey" TEXT NOT NULL,
    "licenseType" "LicenseType" NOT NULL,
    "status" "EntitlementStatus" NOT NULL DEFAULT 'ACTIVE',
    "stripeSubscriptionId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_admins" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_catalog" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "description" TEXT,
    "website" TEXT,
    "privacyPolicyUrl" TEXT,
    "trustCenterUrl" TEXT,
    "dpaUrl" TEXT,
    "securityPageUrl" TEXT,
    "certifications" TEXT[],
    "frameworks" TEXT[],
    "gdprCompliant" BOOLEAN,
    "ccpaCompliant" BOOLEAN,
    "hipaaCompliant" BOOLEAN,
    "dataLocations" TEXT[],
    "hasEuDataCenter" BOOLEAN,
    "subprocessors" JSONB,
    "transferSafeguards" TEXT,
    "supportsDsars" BOOLEAN,
    "hasDesignatedDpo" BOOLEAN,
    "hasRecentBreach" BOOLEAN,
    "euAiActCompliant" BOOLEAN,
    "aiCapabilities" TEXT[],
    "modelHosting" TEXT,
    "aiTechniques" TEXT[],
    "euAiActRole" TEXT,
    "euAiActAnnexIIIDomains" TEXT[],
    "iso42001Certified" BOOLEAN,
    "supportsAuditLogs" BOOLEAN,
    "supportsExplainability" BOOLEAN,
    "hasBiasMonitoring" BOOLEAN,
    "hasModelCard" BOOLEAN,
    "aiIncidentNotificationSLA" TEXT,
    "dataProcessingTransparency" BOOLEAN,
    "aiModels" JSONB,
    "privacyTechnologies" TEXT[],
    "tags" TEXT[],
    "publicProfileEnabled" BOOLEAN DEFAULT false,
    "logoUrl" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "source" TEXT,
    "seneca_litigation" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_vendors" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "vendorSlug" TEXT NOT NULL,
    "dataCategories" TEXT[],
    "purposes" TEXT[],
    "criticality" TEXT NOT NULL DEFAULT 'medium',
    "notes" TEXT,
    "is_subprocessor" BOOLEAN NOT NULL DEFAULT true,
    "riskScore" INTEGER,
    "riskLevel" TEXT,
    "riskFactors" JSONB,
    "riskCalculatedAt" TIMESTAMP(3),
    "addedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portfolio_vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_claims" (
    "id" TEXT NOT NULL,
    "vendorSlug" TEXT NOT NULL,
    "claimantEmail" TEXT NOT NULL,
    "claimantName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "userId" TEXT,
    "accountId" TEXT,
    "emailDomain" TEXT,
    "vendorDomain" TEXT,
    "domainMatch" BOOLEAN NOT NULL DEFAULT false,
    "verificationEmail" TEXT,
    "verificationCode" TEXT,
    "verificationExpiresAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewNotes" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vw_vendor_questionnaires" (
    "id" TEXT NOT NULL,
    "vendorSlug" TEXT NOT NULL,
    "certifications" TEXT[],
    "frameworks" TEXT[],
    "gdprCompliant" BOOLEAN,
    "ccpaCompliant" BOOLEAN,
    "hipaaCompliant" BOOLEAN,
    "dataLocations" TEXT[],
    "hasEuDataCenter" BOOLEAN,
    "subprocessors" JSONB,
    "privacyPolicyUrl" TEXT,
    "trustCenterUrl" TEXT,
    "dpaUrl" TEXT,
    "securityPageUrl" TEXT,
    "dataRetentionPolicy" TEXT,
    "breachNotificationDays" INTEGER,
    "encryptionAtRest" BOOLEAN,
    "encryptionInTransit" BOOLEAN,
    "penTestFrequency" TEXT,
    "transferSafeguards" TEXT,
    "supportsDsars" BOOLEAN,
    "hasDesignatedDpo" BOOLEAN,
    "hasRecentBreach" BOOLEAN,
    "euAiActCompliant" BOOLEAN,
    "aiCapabilities" TEXT[],
    "modelHosting" TEXT,
    "aiTechniques" TEXT[],
    "euAiActRole" TEXT,
    "euAiActAnnexIIIDomains" TEXT[],
    "iso42001Certified" BOOLEAN,
    "supportsAuditLogs" BOOLEAN,
    "supportsExplainability" BOOLEAN,
    "hasBiasMonitoring" BOOLEAN,
    "hasModelCard" BOOLEAN,
    "aiIncidentNotificationSLA" TEXT,
    "dataProcessingTransparency" BOOLEAN,
    "aiModels" JSONB,
    "privacyTechnologies" TEXT[],
    "submittedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vw_vendor_questionnaires_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_suggestions" (
    "id" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "vendorWebsite" TEXT,
    "suggestedBy" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vw_enrichment_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "vendor_slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" TEXT NOT NULL DEFAULT 'standard',
    "is_free" BOOLEAN NOT NULL DEFAULT true,
    "stripe_payment_id" TEXT,
    "amount_cents" INTEGER,
    "completeness_before" JSONB,
    "completeness_after" JSONB,
    "completed_by" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "due_at" TIMESTAMP(3),

    CONSTRAINT "vw_enrichment_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vw_cert_evidence" (
    "id" TEXT NOT NULL,
    "vendorSlug" TEXT NOT NULL,
    "certName" TEXT NOT NULL,
    "evidenceType" TEXT NOT NULL DEFAULT 'url',
    "url" TEXT,
    "blobUrl" TEXT,
    "fileName" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "uploaderRole" TEXT NOT NULL DEFAULT 'vendor',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vw_cert_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vw_dpa_documents" (
    "id" TEXT NOT NULL,
    "vendor_slug" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "final_url" TEXT,
    "content_type" TEXT NOT NULL,
    "text_content" TEXT,
    "content_hash" TEXT,
    "content_length_bytes" INTEGER,
    "is_valid_dpa" BOOLEAN,
    "validation_method" TEXT,
    "compliance_analysis" JSONB,
    "analyzed_at" TIMESTAMP(3),
    "uploaded_by" TEXT,
    "upload_source" TEXT DEFAULT 'fetch',
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vw_dpa_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vw_expert_reviews" (
    "id" TEXT NOT NULL,
    "vendor_slug" TEXT NOT NULL,
    "requested_by" TEXT NOT NULL,
    "expert_id" TEXT,
    "expert_ref_code" TEXT,
    "expert_type" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "stripe_payment_id" TEXT,
    "amount_cents" INTEGER,
    "is_free" BOOLEAN NOT NULL DEFAULT false,
    "transparency" JSONB DEFAULT '{"status": "pending"}',
    "data_minimization" JSONB DEFAULT '{"status": "pending"}',
    "accountability" JSONB DEFAULT '{"status": "pending"}',
    "security" JSONB DEFAULT '{"status": "pending"}',
    "quality" JSONB DEFAULT '{"status": "pending"}',
    "participation" JSONB DEFAULT '{"status": "pending"}',
    "summary_report" TEXT,
    "assigned_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "due_at" TIMESTAMP(3),
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vw_expert_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventType" "NotificationEventType" NOT NULL,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "slackEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_snapshots" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "metrics" JSONB NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_systems" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "vendorId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "purpose" TEXT,
    "riskLevel" "AIRiskLevel" NOT NULL DEFAULT 'MINIMAL',
    "category" TEXT,
    "status" "AISystemStatus" NOT NULL DEFAULT 'DRAFT',
    "trainingDataSources" TEXT[],
    "humanOversight" TEXT,
    "transparencyMeasures" TEXT,
    "technicalDocUrl" TEXT,
    "modelType" TEXT,
    "deployer" TEXT,
    "provider" TEXT,
    "lastReviewedAt" TIMESTAMP(3),
    "nextReviewAt" TIMESTAMP(3),
    "assessmentId" TEXT,
    "aiSentinelSystemId" TEXT,
    "aiSentinelOrgId" TEXT,
    "aiSentinelSyncedAt" TIMESTAMP(3),
    "aiCapabilities" TEXT[],
    "aiTechniques" TEXT[],
    "euAiActRole" TEXT,
    "euAiActCompliant" BOOLEAN,
    "iso42001Certified" BOOLEAN,
    "aiModels" JSONB,
    "catalogSlug" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_systems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "changes" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "page" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "expert_engagements_organizationId_idx" ON "expert_engagements"("organizationId");

-- CreateIndex
CREATE INDEX "expert_engagements_expertId_idx" ON "expert_engagements"("expertId");

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_organizationId_userId_key" ON "organization_members"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "jurisdictions_code_key" ON "jurisdictions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "organization_jurisdictions_organizationId_jurisdictionId_key" ON "organization_jurisdictions"("organizationId", "jurisdictionId");

-- CreateIndex
CREATE INDEX "data_assets_organizationId_idx" ON "data_assets"("organizationId");

-- CreateIndex
CREATE INDEX "data_elements_organizationId_idx" ON "data_elements"("organizationId");

-- CreateIndex
CREATE INDEX "data_elements_dataAssetId_idx" ON "data_elements"("dataAssetId");

-- CreateIndex
CREATE INDEX "processing_activities_organizationId_idx" ON "processing_activities"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "processing_activity_assets_processingActivityId_dataAssetId_key" ON "processing_activity_assets"("processingActivityId", "dataAssetId");

-- CreateIndex
CREATE INDEX "processing_activity_asset_elements_dataElementId_idx" ON "processing_activity_asset_elements"("dataElementId");

-- CreateIndex
CREATE UNIQUE INDEX "processing_activity_asset_elements_processingActivityAssetI_key" ON "processing_activity_asset_elements"("processingActivityAssetId", "dataElementId");

-- CreateIndex
CREATE INDEX "data_flows_organizationId_idx" ON "data_flows"("organizationId");

-- CreateIndex
CREATE INDEX "data_transfers_organizationId_idx" ON "data_transfers"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "dsar_requests_publicId_key" ON "dsar_requests"("publicId");

-- CreateIndex
CREATE INDEX "dsar_requests_organizationId_idx" ON "dsar_requests"("organizationId");

-- CreateIndex
CREATE INDEX "dsar_requests_status_idx" ON "dsar_requests"("status");

-- CreateIndex
CREATE INDEX "dsar_requests_dueDate_idx" ON "dsar_requests"("dueDate");

-- CreateIndex
CREATE INDEX "dsar_tasks_dsarRequestId_idx" ON "dsar_tasks"("dsarRequestId");

-- CreateIndex
CREATE INDEX "dsar_communications_dsarRequestId_idx" ON "dsar_communications"("dsarRequestId");

-- CreateIndex
CREATE INDEX "dsar_audit_logs_dsarRequestId_idx" ON "dsar_audit_logs"("dsarRequestId");

-- CreateIndex
CREATE INDEX "dsar_intake_forms_organizationId_idx" ON "dsar_intake_forms"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "dsar_intake_forms_organizationId_slug_key" ON "dsar_intake_forms"("organizationId", "slug");

-- CreateIndex
CREATE INDEX "assessment_templates_organizationId_idx" ON "assessment_templates"("organizationId");

-- CreateIndex
CREATE INDEX "assessments_organizationId_idx" ON "assessments"("organizationId");

-- CreateIndex
CREATE INDEX "assessments_status_idx" ON "assessments"("status");

-- CreateIndex
CREATE INDEX "assessments_dataTransferId_idx" ON "assessments"("dataTransferId");

-- CreateIndex
CREATE INDEX "assessment_responses_assessmentId_idx" ON "assessment_responses"("assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_responses_assessmentId_questionId_key" ON "assessment_responses"("assessmentId", "questionId");

-- CreateIndex
CREATE INDEX "assessment_mitigations_assessmentId_idx" ON "assessment_mitigations"("assessmentId");

-- CreateIndex
CREATE INDEX "assessment_approvals_assessmentId_idx" ON "assessment_approvals"("assessmentId");

-- CreateIndex
CREATE INDEX "assessment_versions_assessmentId_idx" ON "assessment_versions"("assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_versions_assessmentId_version_key" ON "assessment_versions"("assessmentId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "incidents_publicId_key" ON "incidents"("publicId");

-- CreateIndex
CREATE INDEX "incidents_organizationId_idx" ON "incidents"("organizationId");

-- CreateIndex
CREATE INDEX "incidents_status_idx" ON "incidents"("status");

-- CreateIndex
CREATE INDEX "incidents_severity_idx" ON "incidents"("severity");

-- CreateIndex
CREATE INDEX "incident_notifications_incidentId_idx" ON "incident_notifications"("incidentId");

-- CreateIndex
CREATE INDEX "incident_timeline_entries_incidentId_idx" ON "incident_timeline_entries"("incidentId");

-- CreateIndex
CREATE INDEX "incident_tasks_incidentId_idx" ON "incident_tasks"("incidentId");

-- CreateIndex
CREATE UNIQUE INDEX "incident_affected_assets_incidentId_dataAssetId_key" ON "incident_affected_assets"("incidentId", "dataAssetId");

-- CreateIndex
CREATE INDEX "incident_documents_incidentId_idx" ON "incident_documents"("incidentId");

-- CreateIndex
CREATE INDEX "vendors_organizationId_idx" ON "vendors"("organizationId");

-- CreateIndex
CREATE INDEX "vendors_status_idx" ON "vendors"("status");

-- CreateIndex
CREATE INDEX "vendor_contracts_vendorId_idx" ON "vendor_contracts"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_questionnaire_responses_token_key" ON "vendor_questionnaire_responses"("token");

-- CreateIndex
CREATE INDEX "vendor_questionnaire_responses_vendorId_idx" ON "vendor_questionnaire_responses"("vendorId");

-- CreateIndex
CREATE INDEX "vendor_reviews_vendorId_idx" ON "vendor_reviews"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "skill_packages_skillId_key" ON "skill_packages"("skillId");

-- CreateIndex
CREATE UNIQUE INDEX "customers_email_key" ON "customers"("email");

-- CreateIndex
CREATE INDEX "customer_organizations_organizationId_idx" ON "customer_organizations"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "customer_organizations_customerId_organizationId_key" ON "customer_organizations"("customerId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "skill_entitlements_licenseKey_key" ON "skill_entitlements"("licenseKey");

-- CreateIndex
CREATE INDEX "skill_entitlements_status_idx" ON "skill_entitlements"("status");

-- CreateIndex
CREATE INDEX "skill_entitlements_stripeSubscriptionId_idx" ON "skill_entitlements"("stripeSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "skill_entitlements_customerId_skillPackageId_key" ON "skill_entitlements"("customerId", "skillPackageId");

-- CreateIndex
CREATE UNIQUE INDEX "platform_admins_email_key" ON "platform_admins"("email");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_catalog_slug_key" ON "vendor_catalog"("slug");

-- CreateIndex
CREATE INDEX "vendor_catalog_category_idx" ON "vendor_catalog"("category");

-- CreateIndex
CREATE INDEX "vendor_catalog_name_idx" ON "vendor_catalog"("name");

-- CreateIndex
CREATE INDEX "portfolio_vendors_accountId_idx" ON "portfolio_vendors"("accountId");

-- CreateIndex
CREATE INDEX "portfolio_vendors_vendorSlug_idx" ON "portfolio_vendors"("vendorSlug");

-- CreateIndex
CREATE UNIQUE INDEX "portfolio_vendors_accountId_vendorSlug_key" ON "portfolio_vendors"("accountId", "vendorSlug");

-- CreateIndex
CREATE INDEX "vendor_claims_vendorSlug_idx" ON "vendor_claims"("vendorSlug");

-- CreateIndex
CREATE INDEX "vendor_claims_claimantEmail_idx" ON "vendor_claims"("claimantEmail");

-- CreateIndex
CREATE INDEX "vendor_claims_userId_idx" ON "vendor_claims"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "vw_vendor_questionnaires_vendorSlug_key" ON "vw_vendor_questionnaires"("vendorSlug");

-- CreateIndex
CREATE INDEX "vw_enrichment_requests_user_id_idx" ON "vw_enrichment_requests"("user_id");

-- CreateIndex
CREATE INDEX "vw_enrichment_requests_status_idx" ON "vw_enrichment_requests"("status");

-- CreateIndex
CREATE INDEX "vw_enrichment_requests_priority_status_idx" ON "vw_enrichment_requests"("priority", "status");

-- CreateIndex
CREATE UNIQUE INDEX "vw_enrichment_requests_user_id_vendor_slug_key" ON "vw_enrichment_requests"("user_id", "vendor_slug");

-- CreateIndex
CREATE INDEX "vw_cert_evidence_vendorSlug_idx" ON "vw_cert_evidence"("vendorSlug");

-- CreateIndex
CREATE INDEX "vw_cert_evidence_vendorSlug_certName_idx" ON "vw_cert_evidence"("vendorSlug", "certName");

-- CreateIndex
CREATE INDEX "vw_dpa_documents_vendor_slug_idx" ON "vw_dpa_documents"("vendor_slug");

-- CreateIndex
CREATE INDEX "vw_expert_reviews_vendor_slug_idx" ON "vw_expert_reviews"("vendor_slug");

-- CreateIndex
CREATE INDEX "vw_expert_reviews_requested_by_idx" ON "vw_expert_reviews"("requested_by");

-- CreateIndex
CREATE INDEX "notifications_organizationId_idx" ON "notifications"("organizationId");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_organizationId_eventType_key" ON "notification_preferences"("userId", "organizationId", "eventType");

-- CreateIndex
CREATE INDEX "compliance_snapshots_organizationId_idx" ON "compliance_snapshots"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_snapshots_organizationId_month_key" ON "compliance_snapshots"("organizationId", "month");

-- CreateIndex
CREATE INDEX "ai_systems_organizationId_idx" ON "ai_systems"("organizationId");

-- CreateIndex
CREATE INDEX "ai_systems_riskLevel_idx" ON "ai_systems"("riskLevel");

-- CreateIndex
CREATE INDEX "audit_logs_organizationId_idx" ON "audit_logs"("organizationId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expert_engagements" ADD CONSTRAINT "expert_engagements_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expert_engagements" ADD CONSTRAINT "expert_engagements_contactedById_fkey" FOREIGN KEY ("contactedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_jurisdictions" ADD CONSTRAINT "organization_jurisdictions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_jurisdictions" ADD CONSTRAINT "organization_jurisdictions_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "jurisdictions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_assets" ADD CONSTRAINT "data_assets_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_elements" ADD CONSTRAINT "data_elements_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_elements" ADD CONSTRAINT "data_elements_dataAssetId_fkey" FOREIGN KEY ("dataAssetId") REFERENCES "data_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_activities" ADD CONSTRAINT "processing_activities_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_activity_assets" ADD CONSTRAINT "processing_activity_assets_processingActivityId_fkey" FOREIGN KEY ("processingActivityId") REFERENCES "processing_activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_activity_assets" ADD CONSTRAINT "processing_activity_assets_dataAssetId_fkey" FOREIGN KEY ("dataAssetId") REFERENCES "data_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_activity_asset_elements" ADD CONSTRAINT "processing_activity_asset_elements_processingActivityAsset_fkey" FOREIGN KEY ("processingActivityAssetId") REFERENCES "processing_activity_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_activity_asset_elements" ADD CONSTRAINT "processing_activity_asset_elements_dataElementId_fkey" FOREIGN KEY ("dataElementId") REFERENCES "data_elements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_flows" ADD CONSTRAINT "data_flows_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_flows" ADD CONSTRAINT "data_flows_sourceAssetId_fkey" FOREIGN KEY ("sourceAssetId") REFERENCES "data_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_flows" ADD CONSTRAINT "data_flows_destinationAssetId_fkey" FOREIGN KEY ("destinationAssetId") REFERENCES "data_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_transfers" ADD CONSTRAINT "data_transfers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_transfers" ADD CONSTRAINT "data_transfers_processingActivityId_fkey" FOREIGN KEY ("processingActivityId") REFERENCES "processing_activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_transfers" ADD CONSTRAINT "data_transfers_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "jurisdictions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsar_requests" ADD CONSTRAINT "dsar_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsar_tasks" ADD CONSTRAINT "dsar_tasks_dsarRequestId_fkey" FOREIGN KEY ("dsarRequestId") REFERENCES "dsar_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsar_tasks" ADD CONSTRAINT "dsar_tasks_dataAssetId_fkey" FOREIGN KEY ("dataAssetId") REFERENCES "data_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsar_tasks" ADD CONSTRAINT "dsar_tasks_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsar_communications" ADD CONSTRAINT "dsar_communications_dsarRequestId_fkey" FOREIGN KEY ("dsarRequestId") REFERENCES "dsar_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsar_communications" ADD CONSTRAINT "dsar_communications_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsar_audit_logs" ADD CONSTRAINT "dsar_audit_logs_dsarRequestId_fkey" FOREIGN KEY ("dsarRequestId") REFERENCES "dsar_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsar_intake_forms" ADD CONSTRAINT "dsar_intake_forms_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_templates" ADD CONSTRAINT "assessment_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "assessment_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_processingActivityId_fkey" FOREIGN KEY ("processingActivityId") REFERENCES "processing_activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_dataTransferId_fkey" FOREIGN KEY ("dataTransferId") REFERENCES "data_transfers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_responses" ADD CONSTRAINT "assessment_responses_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_responses" ADD CONSTRAINT "assessment_responses_responderId_fkey" FOREIGN KEY ("responderId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_mitigations" ADD CONSTRAINT "assessment_mitigations_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_approvals" ADD CONSTRAINT "assessment_approvals_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_approvals" ADD CONSTRAINT "assessment_approvals_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_versions" ADD CONSTRAINT "assessment_versions_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "jurisdictions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_notifications" ADD CONSTRAINT "incident_notifications_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_notifications" ADD CONSTRAINT "incident_notifications_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "jurisdictions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_timeline_entries" ADD CONSTRAINT "incident_timeline_entries_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_timeline_entries" ADD CONSTRAINT "incident_timeline_entries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_tasks" ADD CONSTRAINT "incident_tasks_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_tasks" ADD CONSTRAINT "incident_tasks_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_affected_assets" ADD CONSTRAINT "incident_affected_assets_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_affected_assets" ADD CONSTRAINT "incident_affected_assets_dataAssetId_fkey" FOREIGN KEY ("dataAssetId") REFERENCES "data_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_documents" ADD CONSTRAINT "incident_documents_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_contracts" ADD CONSTRAINT "vendor_contracts_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_questionnaire_responses" ADD CONSTRAINT "vendor_questionnaire_responses_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_questionnaire_responses" ADD CONSTRAINT "vendor_questionnaire_responses_questionnaireId_fkey" FOREIGN KEY ("questionnaireId") REFERENCES "vendor_questionnaires"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_reviews" ADD CONSTRAINT "vendor_reviews_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_reviews" ADD CONSTRAINT "vendor_reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_organizations" ADD CONSTRAINT "customer_organizations_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_organizations" ADD CONSTRAINT "customer_organizations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_entitlements" ADD CONSTRAINT "skill_entitlements_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_entitlements" ADD CONSTRAINT "skill_entitlements_skillPackageId_fkey" FOREIGN KEY ("skillPackageId") REFERENCES "skill_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_snapshots" ADD CONSTRAINT "compliance_snapshots_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_systems" ADD CONSTRAINT "ai_systems_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_systems" ADD CONSTRAINT "ai_systems_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

