// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Reading an organisation's programme in the portability format (./format.ts),
 * one register at a time and one page at a time, so an organisation with tens
 * of thousands of records is never held in memory at once. Both the JSON
 * writer and the CSV writer (./export.ts) read through here.
 *
 * What is read, and what never is:
 *   - only rows of this organisation: every query filters on organizationId,
 *     or on parent ids that were themselves read with that filter;
 *   - never secrets, sessions, sign-in accounts, API keys, licence keys, the
 *     vendor questionnaire's private access token, or AI settings;
 *   - rights requests (the people who made them, their messages) only when
 *     the caller asked for them AND the rights-request module is on;
 *   - of the audit trail, only who did what to which record and when: never
 *     the recorded detail, the IP address or the browser, and for a rights
 *     request only its public reference (src/lib/audit-access.ts).
 *
 * A builder never reads the request or the session: the route checks who is
 * asking first.
 */

import type { Db } from "@/lib/prisma";
import { isRightsRequestEntry } from "@/lib/audit-access";
import type { RegisterKey } from "./format";

/** Rows fetched per query. */
export const PAGE_SIZE = 500;

export interface ReadOptions {
  organizationId: string;
  /** Rights requests (personal data): only when asked for and the module is on. */
  includeRightsRequests: boolean;
  /** The rights-request module is part of this deployment (forms and requests). */
  dsarModuleOn: boolean;
  pageSize?: number;
  /** The documents' states; the route passes the real register, tests a stub. */
  documents?: () => Promise<DocumentRow[]>;
}

export interface DocumentRow {
  id: string;
  state: "ready" | "draft" | "needsInput" | "notYet";
  gaps: string[];
  input: string | null;
}

type Row = Record<string, unknown> & { id: string };
type Delegate = {
  findMany: (args: Record<string, unknown>) => Promise<unknown[]>;
};

function delegate(db: Db, model: string): Delegate {
  return (db as unknown as Record<string, Delegate>)[model]!;
}

const iso = (v: unknown): string | null =>
  v instanceof Date ? v.toISOString() : typeof v === "string" ? v : null;

const nn = <T>(v: T | undefined): T | null => (v === undefined ? null : v);

/** Every row matching `where`, in pages ordered by id. */
async function* paged(
  db: Db,
  model: string,
  where: Record<string, unknown>,
  size: number,
  select?: Record<string, unknown>,
): AsyncGenerator<Row[]> {
  let after: string | undefined;
  for (;;) {
    const rows = (await delegate(db, model).findMany({
      where: after ? { ...where, id: { gt: after } } : where,
      orderBy: { id: "asc" },
      take: size,
      ...(select ? { select } : {}),
    })) as Row[];
    if (rows.length === 0) return;
    yield rows;
    if (rows.length < size) return;
    after = rows[rows.length - 1]!.id;
  }
}

/** Children of a page of parents, grouped by the parent's id. */
async function children(
  db: Db,
  model: string,
  parentField: string,
  parentIds: string[],
): Promise<Map<string, Row[]>> {
  const out = new Map<string, Row[]>();
  if (parentIds.length === 0) return out;
  const rows = (await delegate(db, model).findMany({
    where: { [parentField]: { in: parentIds } },
    orderBy: { id: "asc" },
  })) as Row[];
  for (const r of rows) {
    const key = r[parentField] as string;
    const list = out.get(key);
    if (list) list.push(r);
    else out.set(key, [r]);
  }
  return out;
}

/** Draft or confirmed, from the provenance columns. */
export function confirmationOf(r: Row) {
  const origin =
    r.provenance === "AUTO_TEMPLATE" ? "template" : r.provenance === "IMPORTED" ? "imported" : "entered";
  const draft = origin !== "entered" && !r.confirmedAt;
  return {
    state: draft ? ("draft" as const) : ("confirmed" as const),
    origin: origin as "entered" | "template" | "imported",
    sourceRef: nn(r.sourceRef as string | null | undefined),
    confirmedByPersonId: nn(r.confirmedBy as string | null | undefined),
    confirmedAt: iso(r.confirmedAt),
  };
}

/** The laws known to this deployment (a small shared table), by id. */
async function jurisdictionsById(db: Db): Promise<Map<string, { code: string; name: string; region: string }>> {
  const rows = (await delegate(db, "jurisdiction").findMany({
    select: { id: true, code: true, name: true, region: true },
  })) as Row[];
  return new Map(
    rows.map((r) => [r.id, { code: r.code as string, name: r.name as string, region: r.region as string }]),
  );
}

// ── The header: organisation, laws, people ──────────────────────────────────

export async function readOrganization(db: Db, organizationId: string) {
  const [org] = (await delegate(db, "organization").findMany({ where: { id: organizationId }, take: 1 })) as Row[];
  if (!org) throw new Error("Organisation not found");
  return {
    id: org.id,
    name: org.name as string,
    domain: nn(org.domain as string | null),
    createdAt: iso(org.createdAt),
    dsarRemindersEnabled: nn(org.dsarRemindersEnabled as boolean | null),
    settings: org.settings ?? null,
  };
}

/** Context every register needs: the jurisdiction codes. Read once per export. */
export interface ReadContext {
  jurisdictions: Map<string, { code: string; name: string; region: string }>;
}

export async function readContext(db: Db): Promise<ReadContext> {
  return { jurisdictions: await jurisdictionsById(db) };
}

// ── One register ────────────────────────────────────────────────────────────

/**
 * The records of one register, page by page, in the format's shape. A
 * register the options leave out yields nothing.
 */
export async function* readRegister(
  db: Db,
  key: RegisterKey,
  opts: ReadOptions,
  ctx: ReadContext,
): AsyncGenerator<Record<string, unknown>[]> {
  const size = opts.pageSize ?? PAGE_SIZE;
  const org = { organizationId: opts.organizationId };
  const code = (jid: unknown) => (typeof jid === "string" ? (ctx.jurisdictions.get(jid)?.code ?? null) : null);

  switch (key) {
    case "jurisdictions": {
      for await (const page of paged(db, "organizationJurisdiction", org, size)) {
        yield page.map((r) => ({
          jurisdictionCode: code(r.jurisdictionId) ?? (r.jurisdictionId as string),
          name: ctx.jurisdictions.get(r.jurisdictionId as string)?.name ?? null,
          region: ctx.jurisdictions.get(r.jurisdictionId as string)?.region ?? null,
          isPrimary: r.isPrimary as boolean,
          customSettings: r.customSettings ?? null,
        }));
      }
      return;
    }

    case "people": {
      for await (const page of paged(db, "organizationMember", org, size)) {
        const users = (await delegate(db, "user").findMany({
          where: { id: { in: page.map((m) => m.userId as string) } },
          select: { id: true, name: true, email: true },
        })) as Row[];
        const byId = new Map(users.map((u) => [u.id, u]));
        yield page.map((m) => {
          const u = byId.get(m.userId as string);
          return {
            id: m.userId as string,
            name: nn(u?.name as string | null | undefined),
            email: nn(u?.email as string | null | undefined),
            role: m.role as string,
          };
        });
      }
      return;
    }

    case "businessUnits": {
      const members = new Map<string, string>();
      for await (const page of paged(db, "organizationMember", org, size)) {
        for (const m of page) members.set(m.id, m.userId as string);
      }
      for await (const page of paged(db, "businessUnit", org, size)) {
        yield page.map((r) => ({
          id: r.id,
          name: r.name as string,
          parentId: nn(r.parentId as string | null),
          ownerPersonId: typeof r.ownerId === "string" ? (members.get(r.ownerId) ?? null) : null,
          createdAt: iso(r.createdAt),
        }));
      }
      return;
    }

    case "dataAssets": {
      for await (const page of paged(db, "dataAsset", org, size)) {
        yield page.map((r) => ({
          id: r.id,
          name: r.name,
          description: nn(r.description),
          type: r.type,
          owner: nn(r.owner),
          location: nn(r.location),
          hostingType: nn(r.hostingType),
          vendor: nn(r.vendor),
          isProduction: r.isProduction,
          businessUnitId: nn(r.businessUnitId),
          confirmation: confirmationOf(r),
          metadata: r.metadata ?? null,
          createdAt: iso(r.createdAt),
          updatedAt: iso(r.updatedAt),
        }));
      }
      return;
    }

    case "dataElements": {
      for await (const page of paged(db, "dataElement", org, size)) {
        yield page.map((r) => ({
          id: r.id,
          dataAssetId: r.dataAssetId,
          name: r.name,
          description: nn(r.description),
          category: r.category,
          sensitivity: nn(r.sensitivity),
          isPersonalData: r.isPersonalData,
          isSpecialCategory: r.isSpecialCategory,
          retentionDays: nn(r.retentionDays),
          legalBasis: nn(r.legalBasis),
          metadata: r.metadata ?? null,
          createdAt: iso(r.createdAt),
          updatedAt: iso(r.updatedAt),
        }));
      }
      return;
    }

    case "processingActivities": {
      for await (const page of paged(db, "processingActivity", org, size)) {
        const links = await children(db, "processingActivityAsset", "processingActivityId", page.map((r) => r.id));
        const linkIds = [...links.values()].flat().map((l) => l.id);
        const elements = await children(db, "processingActivityAssetElement", "processingActivityAssetId", linkIds);
        yield page.map((r) => ({
          id: r.id,
          name: r.name,
          description: nn(r.description),
          purpose: r.purpose,
          legalBasis: r.legalBasis,
          legalBasisDetail: nn(r.legalBasisDetail),
          dataSubjects: r.dataSubjects ?? [],
          categories: r.categories ?? [],
          recipients: r.recipients ?? [],
          retentionPeriod: nn(r.retentionPeriod),
          retentionDays: nn(r.retentionDays),
          automatedDecisionMaking: r.automatedDecisionMaking,
          automatedDecisionDetail: nn(r.automatedDecisionDetail),
          isActive: r.isActive,
          businessUnitId: nn(r.businessUnitId),
          lastReviewedAt: iso(r.lastReviewedAt),
          nextReviewAt: iso(r.nextReviewAt),
          assets: (links.get(r.id) ?? []).map((l) => ({
            dataAssetId: l.dataAssetId,
            purpose: nn(l.purpose),
            dataElementIds: (elements.get(l.id) ?? []).map((x) => x.dataElementId as string),
          })),
          confirmation: confirmationOf(r),
          metadata: r.metadata ?? null,
          createdAt: iso(r.createdAt),
          updatedAt: iso(r.updatedAt),
        }));
      }
      return;
    }

    case "dataFlows": {
      for await (const page of paged(db, "dataFlow", org, size)) {
        yield page.map((r) => ({
          id: r.id,
          name: r.name,
          description: nn(r.description),
          sourceAssetId: r.sourceAssetId,
          destinationAssetId: r.destinationAssetId,
          dataCategories: r.dataCategories ?? [],
          frequency: nn(r.frequency),
          volume: nn(r.volume),
          encryptionMethod: nn(r.encryptionMethod),
          isAutomated: r.isAutomated,
          metadata: r.metadata ?? null,
          createdAt: iso(r.createdAt),
          updatedAt: iso(r.updatedAt),
        }));
      }
      return;
    }

    case "dataTransfers": {
      for await (const page of paged(db, "dataTransfer", org, size)) {
        yield page.map((r) => ({
          id: r.id,
          processingActivityId: nn(r.processingActivityId),
          name: r.name,
          description: nn(r.description),
          destinationCountry: r.destinationCountry,
          destinationOrg: nn(r.destinationOrg),
          jurisdictionCode: code(r.jurisdictionId),
          mechanism: r.mechanism,
          safeguards: nn(r.safeguards),
          documentUrl: nn(r.documentUrl),
          tiaCompleted: r.tiaCompleted,
          tiaDate: iso(r.tiaDate),
          isActive: r.isActive,
          sccExpiryDate: iso(r.sccExpiryDate),
          supplementaryMeasures: r.supplementaryMeasures ?? null,
          complianceStatus: nn(r.complianceStatus),
          metadata: r.metadata ?? null,
          createdAt: iso(r.createdAt),
          updatedAt: iso(r.updatedAt),
        }));
      }
      return;
    }

    case "vendors": {
      for await (const page of paged(db, "vendor", org, size)) {
        const ids = page.map((r) => r.id);
        const [contracts, reviews, answers] = await Promise.all([
          children(db, "vendorContract", "vendorId", ids),
          children(db, "vendorReview", "vendorId", ids),
          children(db, "vendorQuestionnaireResponse", "vendorId", ids),
        ]);
        const qIds = [...new Set([...answers.values()].flat().map((a) => a.questionnaireId as string))];
        const questionnaires = qIds.length
          ? ((await delegate(db, "vendorQuestionnaire").findMany({
              where: { id: { in: qIds } },
              select: { id: true, name: true, version: true },
            })) as Row[])
          : [];
        const q = new Map(questionnaires.map((x) => [x.id, x]));
        yield page.map((r) => ({
          id: r.id,
          name: r.name,
          description: nn(r.description),
          website: nn(r.website),
          status: nn(r.status),
          riskTier: nn(r.riskTier),
          riskScore: nn(r.riskScore),
          primaryContact: nn(r.primaryContact),
          contactEmail: nn(r.contactEmail),
          contactPhone: nn(r.contactPhone),
          address: nn(r.address),
          categories: r.categories ?? [],
          dataProcessed: r.dataProcessed ?? [],
          countries: r.countries ?? [],
          certifications: r.certifications ?? [],
          lastAssessedAt: iso(r.lastAssessedAt),
          nextReviewAt: iso(r.nextReviewAt),
          contracts: (contracts.get(r.id) ?? []).map((c) => ({
            id: c.id,
            type: c.type,
            status: nn(c.status),
            name: c.name,
            description: nn(c.description),
            documentUrl: nn(c.documentUrl),
            startDate: iso(c.startDate),
            endDate: iso(c.endDate),
            renewalDate: iso(c.renewalDate),
            autoRenewal: c.autoRenewal,
            value: nn(c.value),
            currency: nn(c.currency),
            terms: c.terms ?? null,
            metadata: c.metadata ?? null,
            createdAt: iso(c.createdAt),
            updatedAt: iso(c.updatedAt),
          })),
          reviews: (reviews.get(r.id) ?? []).map((v) => ({
            id: v.id,
            reviewerPersonId: nn(v.reviewerId),
            type: nn(v.type),
            status: nn(v.status),
            scheduledAt: iso(v.scheduledAt),
            completedAt: iso(v.completedAt),
            findings: nn(v.findings),
            riskLevel: nn(v.riskLevel),
            recommendations: nn(v.recommendations),
            nextReviewAt: iso(v.nextReviewAt),
            createdAt: iso(v.createdAt),
          })),
          // The vendor portal's access token is a secret: never read out.
          questionnaireResponses: (answers.get(r.id) ?? []).map((a) => ({
            id: a.id,
            questionnaireName: nn(q.get(a.questionnaireId as string)?.name as string | undefined),
            questionnaireVersion: nn(q.get(a.questionnaireId as string)?.version as string | undefined),
            status: nn(a.status),
            responses: a.responses ?? null,
            submittedAt: iso(a.submittedAt),
            reviewedAt: iso(a.reviewedAt),
            reviewNotes: nn(a.reviewNotes),
            score: nn(a.score),
            expiresAt: iso(a.expiresAt),
            createdAt: iso(a.createdAt),
          })),
          confirmation: confirmationOf(r),
          metadata: r.metadata ?? null,
          createdAt: iso(r.createdAt),
          updatedAt: iso(r.updatedAt),
        }));
      }
      return;
    }

    case "assessmentTemplates": {
      // The organisation's own templates in full; the built-in ones its
      // assessments use, by name and version.
      const used = new Set<string>();
      for await (const page of paged(db, "assessment", org, size, { id: true, templateId: true })) {
        for (const a of page) used.add(a.templateId as string);
      }
      const own = new Set<string>();
      for await (const page of paged(db, "assessmentTemplate", org, size)) {
        for (const t of page) own.add(t.id);
        yield page.map((t) => ({
          id: t.id,
          origin: "organization",
          type: t.type,
          name: t.name,
          description: nn(t.description),
          version: nn(t.version),
          sections: t.sections ?? null,
          scoringLogic: t.scoringLogic ?? null,
          isActive: t.isActive,
          createdAt: iso(t.createdAt),
        }));
      }
      const builtIn = [...used].filter((t) => !own.has(t));
      for (let i = 0; i < builtIn.length; i += size) {
        const rows = (await delegate(db, "assessmentTemplate").findMany({
          where: { id: { in: builtIn.slice(i, i + size) }, organizationId: null },
          orderBy: { id: "asc" },
        })) as Row[];
        yield rows.map((t) => ({
          id: t.id,
          origin: "system",
          type: t.type,
          name: t.name,
          description: nn(t.description),
          version: nn(t.version),
          isActive: t.isActive,
          createdAt: iso(t.createdAt),
        }));
      }
      return;
    }

    case "assessments": {
      for await (const page of paged(db, "assessment", org, size)) {
        const ids = page.map((r) => r.id);
        const [responses, mitigations, approvals, versions] = await Promise.all([
          children(db, "assessmentResponse", "assessmentId", ids),
          children(db, "assessmentMitigation", "assessmentId", ids),
          children(db, "assessmentApproval", "assessmentId", ids),
          children(db, "assessmentVersion", "assessmentId", ids),
        ]);
        yield page.map((r) => ({
          id: r.id,
          templateId: r.templateId,
          processingActivityId: nn(r.processingActivityId),
          vendorId: nn(r.vendorId),
          dataTransferId: nn(r.dataTransferId),
          name: r.name,
          description: nn(r.description),
          status: nn(r.status),
          riskLevel: nn(r.riskLevel),
          riskScore: nn(r.riskScore),
          startedAt: iso(r.startedAt),
          submittedAt: iso(r.submittedAt),
          completedAt: iso(r.completedAt),
          dueDate: iso(r.dueDate),
          responses: (responses.get(r.id) ?? []).map((x) => ({
            sectionId: x.sectionId,
            questionId: x.questionId,
            response: x.response ?? null,
            riskScore: nn(x.riskScore),
            notes: nn(x.notes),
            responderPersonId: nn(x.responderId),
            respondedAt: iso(x.respondedAt),
          })),
          mitigations: (mitigations.get(r.id) ?? []).map((x) => ({
            id: x.id,
            riskId: x.riskId,
            title: x.title,
            description: nn(x.description),
            status: nn(x.status),
            priority: nn(x.priority),
            owner: nn(x.owner),
            dueDate: iso(x.dueDate),
            completedAt: iso(x.completedAt),
            evidence: nn(x.evidence),
            createdAt: iso(x.createdAt),
          })),
          approvals: (approvals.get(r.id) ?? []).map((x) => ({
            level: nn(x.level),
            status: nn(x.status),
            approverPersonId: nn(x.approverId),
            comments: nn(x.comments),
            decidedAt: iso(x.decidedAt),
            delegatedTo: nn(x.delegatedTo),
            createdAt: iso(x.createdAt),
          })),
          versions: (versions.get(r.id) ?? []).map((x) => ({
            version: x.version,
            snapshot: x.snapshot ?? null,
            changedByPersonId: nn(x.changedBy),
            changeNotes: nn(x.changeNotes),
            createdAt: iso(x.createdAt),
          })),
          metadata: r.metadata ?? null,
          createdAt: iso(r.createdAt),
          updatedAt: iso(r.updatedAt),
        }));
      }
      return;
    }

    case "incidents": {
      for await (const page of paged(db, "incident", org, size)) {
        const ids = page.map((r) => r.id);
        const [timeline, tasks, notifications, affected, documents] = await Promise.all([
          children(db, "incidentTimelineEntry", "incidentId", ids),
          children(db, "incidentTask", "incidentId", ids),
          children(db, "incidentNotification", "incidentId", ids),
          children(db, "incidentAffectedAsset", "incidentId", ids),
          children(db, "incidentDocument", "incidentId", ids),
        ]);
        yield page.map((r) => ({
          id: r.id,
          reference: nn(r.publicId),
          title: r.title,
          description: r.description,
          type: r.type,
          severity: nn(r.severity),
          status: nn(r.status),
          discoveredAt: iso(r.discoveredAt),
          discoveredBy: nn(r.discoveredBy),
          discoveryMethod: nn(r.discoveryMethod),
          affectedRecords: nn(r.affectedRecords),
          affectedSubjects: r.affectedSubjects ?? [],
          dataCategories: r.dataCategories ?? [],
          jurisdictionCode: code(r.jurisdictionId),
          containedAt: iso(r.containedAt),
          containmentActions: nn(r.containmentActions),
          rootCause: nn(r.rootCause),
          rootCauseCategory: nn(r.rootCauseCategory),
          resolvedAt: iso(r.resolvedAt),
          resolutionNotes: nn(r.resolutionNotes),
          lessonsLearned: nn(r.lessonsLearned),
          notificationRequired: r.notificationRequired,
          notificationDeadline: iso(r.notificationDeadline),
          timeline: (timeline.get(r.id) ?? []).map((x) => ({
            id: x.id,
            timestamp: iso(x.timestamp),
            title: x.title,
            description: nn(x.description),
            entryType: x.entryType,
            createdByPersonId: nn(x.createdById),
            metadata: x.metadata ?? null,
          })),
          tasks: (tasks.get(r.id) ?? []).map((x) => ({
            id: x.id,
            assigneePersonId: nn(x.assigneeId),
            title: x.title,
            description: nn(x.description),
            priority: nn(x.priority),
            status: nn(x.status),
            dueDate: iso(x.dueDate),
            completedAt: iso(x.completedAt),
            notes: nn(x.notes),
            createdAt: iso(x.createdAt),
          })),
          notifications: (notifications.get(r.id) ?? []).map((x) => ({
            id: x.id,
            jurisdictionCode: code(x.jurisdictionId) ?? (x.jurisdictionId as string),
            recipientType: x.recipientType,
            recipientName: nn(x.recipientName),
            recipientEmail: nn(x.recipientEmail),
            status: nn(x.status),
            deadline: iso(x.deadline),
            content: nn(x.content),
            sentAt: iso(x.sentAt),
            acknowledgedAt: iso(x.acknowledgedAt),
            referenceNumber: nn(x.referenceNumber),
            notes: nn(x.notes),
            createdAt: iso(x.createdAt),
          })),
          affectedAssets: (affected.get(r.id) ?? []).map((x) => ({
            dataAssetId: x.dataAssetId,
            impactLevel: nn(x.impactLevel),
            compromised: x.compromised,
            notes: nn(x.notes),
          })),
          documents: (documents.get(r.id) ?? []).map((x) => ({
            id: x.id,
            name: x.name,
            type: nn(x.type),
            url: x.url,
            mimeType: nn(x.mimeType),
            size: nn(x.size),
            uploadedByPersonId: nn(x.uploadedBy),
            createdAt: iso(x.createdAt),
          })),
          metadata: r.metadata ?? null,
          createdAt: iso(r.createdAt),
          updatedAt: iso(r.updatedAt),
        }));
      }
      return;
    }

    case "aiSystems": {
      // The AI Sentinel cross-references and the catalogue slug are links to
      // other services of this deployment, not part of the programme.
      for await (const page of paged(db, "aISystem", org, size)) {
        yield page.map((r) => ({
          id: r.id,
          vendorId: nn(r.vendorId),
          assessmentId: nn(r.assessmentId),
          name: r.name,
          description: nn(r.description),
          purpose: nn(r.purpose),
          riskLevel: nn(r.riskLevel),
          category: nn(r.category),
          status: nn(r.status),
          trainingDataSources: r.trainingDataSources ?? [],
          humanOversight: nn(r.humanOversight),
          transparencyMeasures: nn(r.transparencyMeasures),
          technicalDocUrl: nn(r.technicalDocUrl),
          modelType: nn(r.modelType),
          deployer: nn(r.deployer),
          provider: nn(r.provider),
          lastReviewedAt: iso(r.lastReviewedAt),
          nextReviewAt: iso(r.nextReviewAt),
          aiCapabilities: r.aiCapabilities ?? [],
          aiTechniques: r.aiTechniques ?? [],
          euAiActRole: nn(r.euAiActRole),
          euAiActCompliant: nn(r.euAiActCompliant),
          iso42001Certified: nn(r.iso42001Certified),
          aiModels: r.aiModels ?? null,
          metadata: r.metadata ?? null,
          createdAt: iso(r.createdAt),
          updatedAt: iso(r.updatedAt),
        }));
      }
      return;
    }

    case "rightsRequestForms": {
      if (!opts.dsarModuleOn) return;
      // customCss is presentation for this deployment's public page: left out.
      for await (const page of paged(db, "dSARIntakeForm", org, size)) {
        yield page.map((r) => ({
          id: r.id,
          name: r.name,
          slug: r.slug,
          title: r.title,
          description: nn(r.description),
          fields: r.fields ?? null,
          enabledTypes: r.enabledTypes ?? [],
          thankYouMessage: nn(r.thankYouMessage),
          privacyNoticeUrl: nn(r.privacyNoticeUrl),
          retentionDays: nn(r.retentionDays),
          isActive: r.isActive,
          createdAt: iso(r.createdAt),
        }));
      }
      return;
    }

    case "rightsRequests": {
      if (!opts.dsarModuleOn || !opts.includeRightsRequests) return;
      for await (const page of paged(db, "dSARRequest", org, size)) {
        const ids = page.map((r) => r.id);
        const [tasks, messages] = await Promise.all([
          children(db, "dSARTask", "dsarRequestId", ids),
          children(db, "dSARCommunication", "dsarRequestId", ids),
        ]);
        yield page.map((r) => ({
          id: r.id,
          reference: nn(r.publicId),
          type: r.type,
          status: nn(r.status),
          requesterName: r.requesterName,
          requesterEmail: r.requesterEmail,
          requesterPhone: nn(r.requesterPhone),
          requesterAddress: nn(r.requesterAddress),
          relationship: nn(r.relationship),
          description: nn(r.description),
          requestedData: nn(r.requestedData),
          verificationMethod: nn(r.verificationMethod),
          verifiedAt: iso(r.verifiedAt),
          receivedAt: iso(r.receivedAt),
          acknowledgedAt: iso(r.acknowledgedAt),
          dueDate: iso(r.dueDate),
          completedAt: iso(r.completedAt),
          extensionReason: nn(r.extensionReason),
          extendedDueDate: iso(r.extendedDueDate),
          responseMethod: nn(r.responseMethod),
          responseNotes: nn(r.responseNotes),
          redactedAt: iso(r.redactedAt),
          tasks: (tasks.get(r.id) ?? []).map((x) => ({
            id: x.id,
            dataAssetId: nn(x.dataAssetId),
            assigneePersonId: nn(x.assigneeId),
            title: x.title,
            description: nn(x.description),
            status: nn(x.status),
            dueDate: iso(x.dueDate),
            completedAt: iso(x.completedAt),
            notes: nn(x.notes),
            createdAt: iso(x.createdAt),
          })),
          // Attachments are links kept by the source; the copy of the data
          // sent to the requester (tasks' dataExport) is not part of the record.
          communications: (messages.get(r.id) ?? []).map((x) => ({
            id: x.id,
            direction: x.direction,
            channel: x.channel,
            subject: nn(x.subject),
            content: x.content,
            sentByPersonId: nn(x.sentById),
            sentAt: iso(x.sentAt),
          })),
          metadata: r.metadata ?? null,
          createdAt: iso(r.createdAt),
          updatedAt: iso(r.updatedAt),
        }));
      }
      return;
    }

    case "documents": {
      if (!opts.documents) return;
      yield (await opts.documents()) as unknown as Record<string, unknown>[];
      return;
    }

    case "auditTrail": {
      const select = { id: true, createdAt: true, action: true, entityType: true, entityId: true, userId: true };
      for await (const page of paged(db, "auditLog", org, size, select)) {
        const dsar = opts.dsarModuleOn ? page.filter((r) => isRightsRequestEntry(r.entityType as string)) : [];
        const refs = new Map<string, string>();
        if (dsar.length) {
          const found = (await delegate(db, "dSARRequest").findMany({
            where: { ...org, id: { in: dsar.map((r) => r.entityId as string) } },
            select: { id: true, publicId: true },
          })) as Row[];
          for (const f of found) refs.set(f.id, f.publicId as string);
        }
        yield page
          // Without the rights-request module its entries stay out, as on the trail.
          .filter((r) => opts.dsarModuleOn || !isRightsRequestEntry(r.entityType as string))
          .map((r) => {
            const restricted = isRightsRequestEntry(r.entityType as string);
            return {
              id: r.id,
              at: iso(r.createdAt),
              action: r.action,
              entityType: r.entityType,
              entityId: restricted ? (refs.get(r.entityId as string) ?? r.entityId) : r.entityId,
              actorPersonId: nn(r.userId),
            };
          });
      }
      return;
    }
  }
}
