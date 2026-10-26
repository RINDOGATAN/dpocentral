// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The link between a DPO Central organisation and an AI Sentinel
 * organisation ("Start from DPO Central", AI Sentinel's first run).
 *
 * This application starts every call, with the import key and the signed
 * identity statement it already uses for AI Sentinel
 * (src/server/services/ai-sentinel/client.ts). AI Sentinel's side is
 * src/server/services/suite/dpc-link.ts there.
 *
 *   link    an owner or administrator of both picks this organisation; we
 *           send its details and declared laws, its AI vendors and AI systems
 *           (each with the processing that uses it and where its DPIA
 *           stands). They arrive there as drafts.
 *   sync    the hourly schedule (src/app/api/cron/suite-sync): what is new
 *           here goes there as a draft, what was created there comes here as
 *           a draft; a record gone on one side gets a note on the other,
 *           never a deletion.
 *   unlink  from here or from AI Sentinel; imported records stay.
 *
 * The link lives in Organization.settings.aiSentinelLink (no migration).
 */

import type { Prisma } from "@prisma/client";
import type { Db as PrismaDb } from "@/lib/prisma";
import enMessages from "@/messages/en.json";
import esMessages from "@/messages/es.json";
import { logger } from "@/lib/logger";
import { evaluateApplicability, readApplicabilityAnswers } from "@/config/applicability";
import { aiSentinelApiUrl, aiSentinelHeaders, isAiSentinelConfigured } from "@/server/services/ai-sentinel/client";

/** Roles that may create or remove a link. */
export const LINK_ROLES: readonly string[] = ["OWNER", "ADMIN"];

/** The hosted DPO Central, for links back from AI Sentinel. */
export const DPO_CENTRAL_PUBLIC_URL = "https://dpocentral.todo.law";

export function dpoCentralPublicUrl(env: Record<string, string | undefined> = process.env): string {
  return (env.NEXTAUTH_URL?.trim() || DPO_CENTRAL_PUBLIC_URL).replace(/\/$/, "");
}

export interface AiSentinelLink {
  active: boolean;
  aisOrganizationId: string;
  aisOrganizationName: string;
  linkedAt: string;
  linkedByUserId: string;
  linkedByEmail: string;
  unlinkedAt?: string | null;
  lastSyncAt?: string | null;
  lastSyncError?: string | null;
}

type Db = PrismaDb;

function settingsObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

export function readAisLink(settings: unknown): AiSentinelLink | null {
  const raw = settingsObject(settings).aiSentinelLink;
  if (!raw || typeof raw !== "object") return null;
  const l = raw as Partial<AiSentinelLink>;
  if (typeof l.aisOrganizationId !== "string" || !l.aisOrganizationId) return null;
  return {
    active: l.active === true,
    aisOrganizationId: l.aisOrganizationId,
    aisOrganizationName: String(l.aisOrganizationName ?? ""),
    linkedAt: String(l.linkedAt ?? ""),
    linkedByUserId: String(l.linkedByUserId ?? ""),
    linkedByEmail: String(l.linkedByEmail ?? ""),
    unlinkedAt: l.unlinkedAt ?? null,
    lastSyncAt: l.lastSyncAt ?? null,
    lastSyncError: l.lastSyncError ?? null,
  };
}

function withAisLink(settings: unknown, link: AiSentinelLink): Prisma.InputJsonValue {
  const next = settingsObject(settings);
  next.aiSentinelLink = link as unknown as Prisma.InputJsonValue;
  return next as Prisma.InputJsonValue;
}

// ── Payload ────────────────────────────────────────────────────────────────

type Labelled = { code: string; en: string; es: string };

function enumLabel(group: "dataCategory" | "legalBasis", code: string): Labelled {
  const en = (enMessages as { enums?: Record<string, Record<string, string>> }).enums?.[group]?.[code];
  const es = (esMessages as { enums?: Record<string, Record<string, string>> }).enums?.[group]?.[code];
  return { code, en: en ?? code, es: es ?? en ?? code };
}

export interface LinkPayload {
  dpcOrganization: { id: string; name: string; country: string | null; laws: { code: string; region: string }[] };
  vendors: { dpcId: string; name: string; website: string | null; description: string | null; catalogSlug: string | null }[];
  systems: {
    dpcId: string;
    name: string;
    description: string | null;
    purpose: string | null;
    riskLevel: string | null;
    category: string | null;
    modelType: string | null;
    provider: string | null;
    deployer: string | null;
    aiCapabilities: string[];
    aiTechniques: string[];
    euAiActRole: string | null;
    vendorDpcId: string | null;
    vendorName: string | null;
    aisId: string | null;
    processing: {
      activities: { id: string; name: string }[];
      dataCategories: Labelled[];
      dataSubjects: string[];
      legalBases: Labelled[];
    };
    dpia: { state: "approved" | "in_progress" | "due" | "none"; url: string | null };
  }[];
  /** AI Sentinel ids this organisation holds copies of (records that came from there). */
  knownAisSystemIds: string[];
  knownAisVendorIds: string[];
}

const AIS_VENDOR_SOURCE = (aisId: string) => `aisentinel:vendor:${aisId}`;

/** Everything AI Sentinel receives about this organisation. */
export async function buildLinkPayload(db: Db, organizationId: string, baseUrl: string): Promise<LinkPayload> {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      settings: true,
      jurisdictions: { select: { isPrimary: true, jurisdiction: { select: { code: true, region: true } } } },
    },
  });
  if (!org) throw new Error("Organization not found");
  const laws = org.jurisdictions.map((j) => ({ code: j.jurisdiction.code, region: j.jurisdiction.region }));
  const primary = org.jurisdictions.find((j) => j.isPrimary)?.jurisdiction.region ?? laws[0]?.region ?? null;

  const systems = await db.aISystem.findMany({
    where: { organizationId },
    include: { vendor: { select: { id: true, name: true, website: true, description: true, sourceRef: true } } },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  // AI vendors: those behind an AI system.
  const vendorMap = new Map<string, LinkPayload["vendors"][number]>();
  for (const s of systems) {
    if (!s.vendor) continue;
    // A vendor that came from AI Sentinel is not sent back as new.
    if ((s.vendor.sourceRef ?? "").startsWith("aisentinel:vendor:")) continue;
    const prev = vendorMap.get(s.vendor.id);
    vendorMap.set(s.vendor.id, {
      dpcId: s.vendor.id,
      name: s.vendor.name,
      website: s.vendor.website,
      description: s.vendor.description,
      catalogSlug: prev?.catalogSlug ?? s.catalogSlug ?? null,
    });
  }

  // The processing that uses each vendor: activities with a data asset hosted by it.
  const vendorNames = [...new Set([...vendorMap.values()].map((v) => v.name))];
  const assets = vendorNames.length
    ? await db.dataAsset.findMany({
        where: { organizationId, vendor: { in: vendorNames, mode: "insensitive" } },
        select: {
          vendor: true,
          processingActivityAssets: {
            select: {
              processingActivity: {
                select: { id: true, name: true, categories: true, dataSubjects: true, legalBasis: true },
              },
            },
          },
        },
      })
    : [];
  const activitiesByVendor = new Map<string, Map<string, { id: string; name: string; categories: string[]; dataSubjects: string[]; legalBasis: string }>>();
  for (const a of assets) {
    const key = (a.vendor ?? "").toLowerCase();
    const map = activitiesByVendor.get(key) ?? new Map();
    for (const link of a.processingActivityAssets) {
      const pa = link.processingActivity;
      map.set(pa.id, { id: pa.id, name: pa.name, categories: pa.categories, dataSubjects: pa.dataSubjects, legalBasis: pa.legalBasis });
    }
    activitiesByVendor.set(key, map);
  }

  const activityIds = [...new Set([...activitiesByVendor.values()].flatMap((m) => [...m.keys()]))];
  const dpias = activityIds.length
    ? await db.assessment.findMany({
        where: { organizationId, processingActivityId: { in: activityIds }, template: { type: "DPIA" } },
        select: { id: true, status: true, processingActivityId: true },
      })
    : [];
  const dpiaDutyApplies = (() => {
    const settings = settingsObject(org.settings);
    const item = evaluateApplicability(
      laws.map((l) => l.code),
      readApplicabilityAnswers(settings.applicability),
    ).find((i) => i.id === "dpiaLikely");
    return item?.state === "applies";
  })();

  const payloadSystems: LinkPayload["systems"] = systems
    .filter((s) => !(settingsObject(s.metadata).importedFrom === "aisentinel"))
    .map((s) => {
      const acts = s.vendor ? [...(activitiesByVendor.get(s.vendor.name.toLowerCase())?.values() ?? [])] : [];
      const ids = new Set(acts.map((a) => a.id));
      const own = dpias.filter((d) => d.processingActivityId && ids.has(d.processingActivityId));
      const approved = own.find((d) => d.status === "APPROVED");
      const any = approved ?? own[0];
      const state: "approved" | "in_progress" | "due" | "none" = approved
        ? "approved"
        : any
          ? "in_progress"
          : acts.length > 0 && dpiaDutyApplies
            ? "due"
            : "none";
      return {
        dpcId: s.id,
        name: s.name,
        description: s.description,
        purpose: s.purpose,
        riskLevel: s.riskLevel,
        category: s.category,
        modelType: s.modelType,
        provider: s.provider,
        deployer: s.deployer,
        aiCapabilities: s.aiCapabilities,
        aiTechniques: s.aiTechniques,
        euAiActRole: s.euAiActRole,
        vendorDpcId: s.vendorId,
        vendorName: s.vendor?.name ?? null,
        aisId: s.aiSentinelSystemId,
        processing: {
          activities: acts.map((a) => ({ id: a.id, name: a.name })),
          dataCategories: [...new Set(acts.flatMap((a) => a.categories))].map((c) => enumLabel("dataCategory", c)),
          dataSubjects: [...new Set(acts.flatMap((a) => a.dataSubjects))],
          legalBases: [...new Set(acts.map((a) => a.legalBasis))].map((b) => enumLabel("legalBasis", b)),
        },
        dpia: {
          state,
          url: any ? `${baseUrl}/privacy/assessments/${any.id}` : state === "due" ? `${baseUrl}/privacy/assessments` : null,
        },
      };
    });

  const fromAisSystems = systems
    .filter((s) => settingsObject(s.metadata).importedFrom === "aisentinel" && s.aiSentinelSystemId)
    .map((s) => s.aiSentinelSystemId as string);
  const fromAisVendors = await db.vendor.findMany({
    where: { organizationId, sourceRef: { startsWith: "aisentinel:vendor:" } },
    select: { sourceRef: true },
  });

  return {
    dpcOrganization: { id: org.id, name: org.name, country: primary, laws },
    vendors: [...vendorMap.values()],
    systems: payloadSystems,
    knownAisSystemIds: fromAisSystems,
    knownAisVendorIds: fromAisVendors
      .map((v) => (v.sourceRef ?? "").slice("aisentinel:vendor:".length))
      .filter(Boolean),
  };
}

// ── Calls to AI Sentinel ───────────────────────────────────────────────────

export class SuiteCallError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function callAis<T>(path: string, email: string, body: Record<string, unknown>): Promise<T> {
  const base = aiSentinelApiUrl();
  if (!isAiSentinelConfigured() || !base) throw new SuiteCallError(503, "AI Sentinel is not connected");
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: aiSentinelHeaders(email),
      body: JSON.stringify({ userEmail: email, ...body }),
    });
  } catch (err) {
    logger.error("AI Sentinel suite call failed", err instanceof Error ? err : undefined, { path });
    throw new SuiteCallError(502, "AI Sentinel could not be reached");
  }
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new SuiteCallError(res.status, json.error ?? `AI Sentinel answered ${res.status}`);
  return json;
}

export interface AisOrganizationOption {
  id: string;
  name: string;
  linkedTo: string | null;
}

/** The AI Sentinel organisations `email` may link. */
export async function aisLinkableOrganizations(email: string): Promise<AisOrganizationOption[]> {
  const out = await callAis<{ organizations: AisOrganizationOption[] }>("/api/import/dpc-link/organizations", email, {});
  return out.organizations ?? [];
}

type SyncResponse = {
  linked: boolean;
  mapped?: { systems: { dpcId: string; aisId: string }[]; vendors: { dpcId: string; aisId: string }[] };
  aisSystems?: { aisId: string; name: string; description: string | null; purpose: string | null; vendorAisId: string | null; vendorName: string | null }[];
  aisVendors?: { aisId: string; name: string; website: string | null; description: string | null; catalogSlug: string | null }[];
  presentAisSystemIds?: string[];
  presentAisVendorIds?: string[];
};

/** Store the AI Sentinel ids AI Sentinel gave back for what we sent. */
async function storeMappings(db: Db, organizationId: string, mapped: SyncResponse["mapped"]) {
  for (const m of mapped?.systems ?? []) {
    await db.aISystem.updateMany({
      where: { id: m.dpcId, organizationId },
      data: { aiSentinelSystemId: m.aisId, aiSentinelSyncedAt: new Date() },
    });
  }
}

/** Take what was created in AI Sentinel as drafts here; note what disappeared there. */
export async function applyAisRecords(db: Db, organizationId: string, link: AiSentinelLink, r: SyncResponse) {
  let createdSystems = 0;
  let createdVendors = 0;
  const vendorIdByAis = new Map<string, string>();

  for (const v of r.aisVendors ?? []) {
    const existing = await db.vendor.findFirst({
      where: {
        organizationId,
        OR: [{ sourceRef: AIS_VENDOR_SOURCE(v.aisId) }, { name: { equals: v.name, mode: "insensitive" } }],
      },
      select: { id: true },
    });
    if (existing) {
      vendorIdByAis.set(v.aisId, existing.id);
      continue;
    }
    const created = await db.vendor.create({
      data: {
        organizationId,
        name: v.name,
        website: v.website,
        description: v.description,
        status: "PROSPECTIVE",
        provenance: "IMPORTED",
        sourceRef: AIS_VENDOR_SOURCE(v.aisId),
        metadata: { importedFrom: "aisentinel", aiSentinelVendorId: v.aisId, catalogSlug: v.catalogSlug },
      },
      select: { id: true },
    });
    vendorIdByAis.set(v.aisId, created.id);
    createdVendors++;
  }

  for (const s of r.aisSystems ?? []) {
    const existing = await db.aISystem.findFirst({
      where: { organizationId, aiSentinelSystemId: s.aisId },
      select: { id: true },
    });
    if (existing) continue;
    await db.aISystem.create({
      data: {
        organizationId,
        name: s.name,
        description: s.description,
        purpose: s.purpose,
        status: "DRAFT",
        vendorId: s.vendorAisId ? vendorIdByAis.get(s.vendorAisId) ?? null : null,
        provider: s.vendorName,
        aiSentinelSystemId: s.aisId,
        aiSentinelOrgId: link.aisOrganizationId,
        aiSentinelSyncedAt: new Date(),
        metadata: { importedFrom: "aisentinel", aiSentinelSystemId: s.aisId },
      },
    });
    createdSystems++;
  }

  // Copies of AI Sentinel records whose original is gone there: a note, never a deletion.
  const present = new Set(r.presentAisSystemIds ?? []);
  const copies = await db.aISystem.findMany({
    where: { organizationId, aiSentinelSystemId: { not: null } },
    select: { id: true, aiSentinelSystemId: true, metadata: true },
  });
  const now = new Date().toISOString();
  for (const c of copies) {
    const meta = settingsObject(c.metadata);
    if (meta.importedFrom !== "aisentinel" || !c.aiSentinelSystemId || present.has(c.aiSentinelSystemId) || meta.suiteNote) continue;
    meta.suiteNote = { kind: "removedInAiSentinel", at: now };
    await db.aISystem.update({ where: { id: c.id }, data: { metadata: meta as Prisma.InputJsonValue } });
  }
  return { createdSystems, createdVendors };
}

async function saveLink(db: Db, organizationId: string, link: AiSentinelLink) {
  const org = await db.organization.findUnique({ where: { id: organizationId }, select: { settings: true } });
  await db.organization.update({ where: { id: organizationId }, data: { settings: withAisLink(org?.settings, link) } });
}

/** Link `organizationId` here to `aisOrganizationId` there, import and sync once. */
export async function linkToAiSentinel(
  db: Db,
  args: { organizationId: string; aisOrganizationId: string; userId: string; email: string; baseUrl: string },
) {
  const payload = await buildLinkPayload(db, args.organizationId, args.baseUrl);
  const out = await callAis<{
    linked: boolean;
    organizationName: string;
    mapped: SyncResponse["mapped"];
    created: { systems: number; vendors: number };
  }>("/api/import/dpc-link", args.email, {
    aisOrganizationId: args.aisOrganizationId,
    dpcOrganization: payload.dpcOrganization,
    vendors: payload.vendors,
    systems: payload.systems,
  });
  await storeMappings(db, args.organizationId, out.mapped);
  const now = new Date().toISOString();
  const link: AiSentinelLink = {
    active: true,
    aisOrganizationId: args.aisOrganizationId,
    aisOrganizationName: out.organizationName ?? "",
    linkedAt: now,
    linkedByUserId: args.userId,
    linkedByEmail: args.email,
    unlinkedAt: null,
    lastSyncAt: now,
    lastSyncError: null,
  };
  await saveLink(db, args.organizationId, link);
  await db.auditLog.create({
    data: {
      organizationId: args.organizationId,
      userId: args.userId,
      entityType: "Organization",
      entityId: args.organizationId,
      action: "SUITE_LINK_CREATED",
      changes: {
        aisOrganizationId: args.aisOrganizationId,
        systemsSent: payload.systems.length,
        vendorsSent: payload.vendors.length,
        createdThere: out.created,
      },
    },
  });
  // The first round back: what already exists in AI Sentinel comes here as drafts.
  const back = await syncWithAiSentinel(db, args.organizationId, args.baseUrl).catch((err) => {
    logger.error("First suite sync failed", err instanceof Error ? err : undefined);
    return null;
  });
  return { created: out.created, back, aisOrganizationName: out.organizationName };
}

/** One sync round for a linked organisation. */
export async function syncWithAiSentinel(db: Db, organizationId: string, baseUrl: string) {
  const org = await db.organization.findUnique({ where: { id: organizationId }, select: { settings: true } });
  const link = readAisLink(org?.settings);
  if (!link?.active) return { skipped: true as const };
  const payload = await buildLinkPayload(db, organizationId, baseUrl);
  let r: SyncResponse;
  try {
    r = await callAis<SyncResponse>("/api/import/dpc-link/sync", link.linkedByEmail, {
      aisOrganizationId: link.aisOrganizationId,
      dpcOrganizationId: organizationId,
      vendors: payload.vendors,
      systems: payload.systems,
      knownAisSystemIds: payload.knownAisSystemIds,
      knownAisVendorIds: payload.knownAisVendorIds,
    });
  } catch (err) {
    await saveLink(db, organizationId, { ...link, lastSyncError: err instanceof Error ? err.message : "error" });
    throw err;
  }
  if (!r.linked) {
    // Unlinked from AI Sentinel's side: stop here too.
    await saveLink(db, organizationId, { ...link, active: false, unlinkedAt: new Date().toISOString() });
    await db.auditLog.create({
      data: {
        organizationId,
        userId: null,
        entityType: "Organization",
        entityId: organizationId,
        action: "SUITE_LINK_REMOVED",
        changes: { aisOrganizationId: link.aisOrganizationId, origin: "aisentinel" },
      },
    });
    return { skipped: false as const, unlinked: true, createdSystems: 0, createdVendors: 0 };
  }
  await storeMappings(db, organizationId, r.mapped);
  const applied = await applyAisRecords(db, organizationId, link, r);
  await saveLink(db, organizationId, { ...link, lastSyncAt: new Date().toISOString(), lastSyncError: null });
  return { skipped: false as const, unlinked: false, ...applied };
}

/** Remove the link, here and there. */
export async function unlinkFromAiSentinel(db: Db, organizationId: string, userId: string, email: string) {
  const org = await db.organization.findUnique({ where: { id: organizationId }, select: { settings: true } });
  const link = readAisLink(org?.settings);
  if (!link?.active) return { changed: false };
  await callAis("/api/import/dpc-link/unlink", email, {
    aisOrganizationId: link.aisOrganizationId,
    dpcOrganizationId: organizationId,
  }).catch((err) => {
    // The link is removed here in any case; AI Sentinel stops at its next sync call.
    logger.warn("AI Sentinel unlink call failed", { error: err instanceof Error ? err.message : String(err) });
  });
  await saveLink(db, organizationId, { ...link, active: false, unlinkedAt: new Date().toISOString() });
  await db.auditLog.create({
    data: {
      organizationId,
      userId,
      entityType: "Organization",
      entityId: organizationId,
      action: "SUITE_LINK_REMOVED",
      changes: { aisOrganizationId: link.aisOrganizationId, origin: "dpocentral" },
    },
  });
  return { changed: true };
}
