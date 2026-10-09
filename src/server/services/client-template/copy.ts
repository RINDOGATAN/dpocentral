// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * "Start from another client": copy a privacy programme from one organisation
 * into another, as drafts.
 *
 * Two steps, both built from the same plan so the preview shows exactly what
 * the copy will write:
 *
 *   planClientTemplate()  reads the source, scrubs every text, and returns the
 *                         rows to create, the counts and the flags. Writes nothing.
 *   applyClientTemplate() writes the plan into the target, in the caller's
 *                         transaction, and adds ONE audit entry to the target
 *                         that names nothing about the source.
 *
 * The rules (src/config/client-template.ts): COPIED, never linked. Nothing in
 * a copied row points back to the source (no id, no slug, no name). Requests,
 * incidents, evidence, contracts, people, dates and history stay behind: data
 * assets and their elements, processing activities, vendors and the DSAR intake
 * form arrive marked as a template copy (kept out of the "active" state until a
 * person edits them), the organisation's own assessment templates arrive ready
 * to reuse, and the jurisdictions fill a client that has declared none.
 *
 * Ported from AI Sentinel's client-template copy, adapted to DPO Central's
 * models.
 */

import { TRPCError } from "@trpc/server";
import type {
  Prisma,
  DataAssetType,
  DataSensitivity,
  DataCategory,
  LegalBasis,
  VendorRiskTier,
  AssessmentType,
  DSARType,
} from "@prisma/client";
import type { Db } from "@/lib/prisma";
import {
  templateAuditNote,
  withTemplateCopyMark,
  type CopyPart,
} from "@/config/client-template";
import { makeScrubber, type ScrubFlag, type Scrubber } from "@/lib/client-template/scrub";
import { isIntakeConfigured, type IntakeFormShape } from "@/server/services/dsar/defaultIntakeForm";
import { isDsarModuleEnabled } from "@/config/features";

// ─── Permission ──────────────────────────────────────────────────────────────

/**
 * The permission rule: the signed-in person must be an owner or an admin of
 * BOTH organisations, and they must be different organisations. Checked from
 * the person's own memberships, never from input.
 */
export async function assertTemplatePermission(
  db: Pick<Db, "organizationMember">,
  userId: string,
  sourceOrganizationId: string,
  targetOrganizationId: string | null,
): Promise<void> {
  if (targetOrganizationId && sourceOrganizationId === targetOrganizationId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a different client as the source" });
  }
  const ids = targetOrganizationId ? [sourceOrganizationId, targetOrganizationId] : [sourceOrganizationId];
  const memberships = await db.organizationMember.findMany({
    where: { userId, organizationId: { in: ids } },
    select: { organizationId: true, role: true },
  });
  const canUse = (role: string | null | undefined) => role === "OWNER" || role === "ADMIN";
  for (const id of ids) {
    const m = memberships.find((x) => x.organizationId === id);
    if (!m || !canUse(m.role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only an owner or an admin of both organizations can copy a template",
      });
    }
  }
}

// ─── Plan ────────────────────────────────────────────────────────────────────

export interface FlaggedItem {
  part: CopyPart;
  /** The item's title as it will read in the new client (already scrubbed). */
  title: string;
  flags: ScrubFlag[];
}

export type CopyCounts = Record<CopyPart, number>;

const EMPTY_COUNTS = (): CopyCounts => ({
  jurisdictions: 0,
  dataAssets: 0,
  processingActivities: 0,
  vendors: 0,
  assessmentTemplates: 0,
  dsarIntake: 0,
});

interface ElementRow {
  name: string;
  description: string | null;
  category: DataCategory;
  sensitivity: DataSensitivity;
  isPersonalData: boolean;
  isSpecialCategory: boolean;
  retentionDays: number | null;
  legalBasis: string | null;
}
interface AssetRow {
  key: string;
  name: string;
  description: string | null;
  type: DataAssetType;
  owner: string | null;
  location: string | null;
  hostingType: string | null;
  vendor: string | null;
  isProduction: boolean;
  elements: ElementRow[];
}
interface ActivityAssetLink {
  assetKey: string;
  purpose: string | null;
}
interface ActivityRow {
  name: string;
  description: string | null;
  purpose: string;
  legalBasis: LegalBasis;
  legalBasisDetail: string | null;
  dataSubjects: string[];
  categories: DataCategory[];
  recipients: string[];
  retentionPeriod: string | null;
  retentionDays: number | null;
  automatedDecisionMaking: boolean;
  automatedDecisionDetail: string | null;
  assetLinks: ActivityAssetLink[];
}
interface VendorRow {
  name: string;
  description: string | null;
  website: string | null;
  riskTier: VendorRiskTier | null;
  categories: string[];
  dataProcessed: DataCategory[];
  countries: string[];
  certifications: string[];
}
interface TemplateRow {
  type: AssessmentType;
  name: string;
  description: string | null;
  version: string;
  sections: Prisma.InputJsonValue;
  scoringLogic: Prisma.InputJsonValue | undefined;
}
interface DsarRow {
  name: string;
  slug: string;
  title: string;
  description: string | null;
  fields: Prisma.InputJsonValue;
  enabledTypes: DSARType[];
  customCss: string | null;
  thankYouMessage: string | null;
  privacyNoticeUrl: string | null;
  retentionDays: number;
  /**
   * When set, the target already has an untouched seeded default form and the
   * copy replaces its wording and options in place rather than creating a
   * second form (the public slug is unique per organisation).
   */
  replaceFormId: string | null;
}
interface JurisdictionLink {
  jurisdictionId: string;
  isPrimary: boolean;
}

export interface ClientTemplatePlan {
  parts: CopyPart[];
  counts: CopyCounts;
  /** What the source holds but the target already has (same name): left alone. */
  skipped: CopyCounts;
  /**
   * True when the source has an intake form but the target's own form has been
   * set up by a person, so it is left as it is rather than overwritten. The
   * dialog says so instead of the generic "already here" note.
   */
  dsarIntakeSkippedEdited: boolean;
  flagged: FlaggedItem[];
  /** Times the source's name was replaced with the new client's. */
  replacements: number;
  jurisdictions: JurisdictionLink[];
  assets: AssetRow[];
  activities: ActivityRow[];
  vendors: VendorRow[];
  templates: TemplateRow[];
  dsarForms: DsarRow[];
}

function key(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Read the source and build what would be written. `targetOrganizationId`
 * is null for a client that does not exist yet (the preview before
 * "Copy into a new client"); with one, anything the target already holds
 * under the same name is skipped rather than duplicated.
 */
export async function planClientTemplate(
  db: Db,
  input: {
    sourceOrganizationId: string;
    targetOrganizationId: string | null;
    targetName: string;
    parts: readonly CopyPart[];
  },
): Promise<ClientTemplatePlan> {
  const parts = effectivePartsLocal(input.parts);
  // The intake form is never copied when the rights-request module is not
  // part of this plan (src/config/features.ts).
  const want = (p: CopyPart) =>
    parts.includes(p) && (p !== "dsarIntake" || isDsarModuleEnabled());
  const src = { organizationId: input.sourceOrganizationId };
  const tgt = input.targetOrganizationId ? { organizationId: input.targetOrganizationId } : null;

  const source = await db.organization.findFirst({
    where: { id: input.sourceOrganizationId },
    select: { name: true, domain: true },
  });
  if (!source) throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });

  const scrubber: Scrubber = makeScrubber({ name: source.name, domain: source.domain }, input.targetName);
  const plan: ClientTemplatePlan = {
    parts,
    counts: EMPTY_COUNTS(),
    skipped: EMPTY_COUNTS(),
    dsarIntakeSkippedEdited: false,
    flagged: [],
    replacements: 0,
    jurisdictions: [],
    assets: [],
    activities: [],
    vendors: [],
    templates: [],
    dsarForms: [],
  };

  /**
   * Scrub every text of one item. The flags are held back until the item is
   * known to be copied (keep), so a skipped item never appears in the list.
   */
  const scrubItem = <T extends Record<string, unknown>>(part: CopyPart, titleField: keyof T, row: T) => {
    const out = { ...row };
    const flags: ScrubFlag[] = [];
    let replaced = 0;
    for (const [field, value] of Object.entries(row)) {
      if (typeof value === "string") {
        const r = scrubber.scrub(value);
        replaced += r.replaced;
        flags.push(...r.flags);
        (out as Record<string, unknown>)[field] = r.text;
      } else if (value && typeof value === "object") {
        const r = scrubber.scrubJson(value);
        replaced += r.replaced;
        flags.push(...r.flags);
        (out as Record<string, unknown>)[field] = r.value;
      }
    }
    const keep = (title: string = String(out[titleField] ?? "")): T => {
      plan.replacements += replaced;
      if (flags.length > 0) plan.flagged.push({ part, title, flags });
      return out;
    };
    return { out, keep };
  };

  // Jurisdictions: the regimes the client operates under, only into a client
  // that has declared none. No free text, so nothing to scrub or flag.
  if (want("jurisdictions")) {
    const [rows, existing] = await Promise.all([
      db.organizationJurisdiction.findMany({
        where: src,
        select: { jurisdictionId: true, isPrimary: true },
        orderBy: { createdAt: "asc" },
      }),
      tgt ? db.organizationJurisdiction.findMany({ where: tgt, select: { id: true } }) : Promise.resolve([]),
    ]);
    if ((existing?.length ?? 0) > 0) {
      plan.skipped.jurisdictions = rows.length;
    } else {
      plan.jurisdictions = rows.map((r) => ({ jurisdictionId: r.jurisdictionId, isPrimary: r.isPrimary }));
    }
  }

  // Data inventory: assets and their elements. Owners and locations are copied
  // as they describe the record; the incident, DSAR and flow links stay behind.
  if (want("dataAssets")) {
    const [rows, existing] = await Promise.all([
      db.dataAsset.findMany({
        where: src,
        select: {
          name: true,
          description: true,
          type: true,
          owner: true,
          location: true,
          hostingType: true,
          vendor: true,
          isProduction: true,
          dataElements: {
            select: {
              name: true,
              description: true,
              category: true,
              sensitivity: true,
              isPersonalData: true,
              isSpecialCategory: true,
              retentionDays: true,
              legalBasis: true,
            },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      tgt ? db.dataAsset.findMany({ where: tgt, select: { name: true } }) : Promise.resolve([]),
    ]);
    const taken = new Set(existing.map((a) => key(a.name)));
    for (const row of rows) {
      const { dataElements, ...fields } = row as typeof row & { dataElements: ElementRow[] };
      const item = scrubItem("dataAssets", "name", { ...fields, elements: dataElements ?? [] });
      if (taken.has(key(item.out.name))) {
        plan.skipped.dataAssets += 1;
        continue;
      }
      taken.add(key(item.out.name));
      item.keep();
      plan.assets.push({ ...(item.out as unknown as AssetRow), key: key(item.out.name) });
    }
  }

  // Processing activities. Their asset links are recreated by asset name when
  // the assets are copied too; transfers and assessments stay behind.
  if (want("processingActivities")) {
    const [rows, existing] = await Promise.all([
      db.processingActivity.findMany({
        where: src,
        select: {
          name: true,
          description: true,
          purpose: true,
          legalBasis: true,
          legalBasisDetail: true,
          dataSubjects: true,
          categories: true,
          recipients: true,
          retentionPeriod: true,
          retentionDays: true,
          automatedDecisionMaking: true,
          automatedDecisionDetail: true,
          assets: { select: { purpose: true, dataAsset: { select: { name: true } } } },
        },
        orderBy: { createdAt: "asc" },
      }),
      tgt ? db.processingActivity.findMany({ where: tgt, select: { name: true } }) : Promise.resolve([]),
    ]);
    const taken = new Set(existing.map((a) => key(a.name)));
    for (const row of rows) {
      const { assets, ...fields } = row as typeof row & {
        assets: { purpose: string | null; dataAsset: { name: string } }[];
      };
      const item = scrubItem("processingActivities", "name", { ...fields });
      if (taken.has(key(item.out.name))) {
        plan.skipped.processingActivities += 1;
        continue;
      }
      taken.add(key(item.out.name));
      item.keep();
      // The asset link is kept by the asset's scrubbed name, so it reaches the
      // copied asset (or one the target already had under that name).
      const assetLinks: ActivityAssetLink[] = (assets ?? []).map((a) => ({
        assetKey: key(scrubber.scrub(a.dataAsset.name).text),
        purpose: a.purpose,
      }));
      plan.activities.push({ ...(item.out as unknown as ActivityRow), assetLinks });
    }
  }

  // Vendors. The register entry itself is copied; contacts, contract dates,
  // reviews, questionnaires and the client's own risk score stay behind.
  if (want("vendors")) {
    const [rows, existing] = await Promise.all([
      db.vendor.findMany({
        where: src,
        select: {
          name: true,
          description: true,
          website: true,
          riskTier: true,
          categories: true,
          dataProcessed: true,
          countries: true,
          certifications: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      tgt ? db.vendor.findMany({ where: tgt, select: { name: true } }) : Promise.resolve([]),
    ]);
    const taken = new Set(existing.map((v) => key(v.name)));
    for (const row of rows) {
      const item = scrubItem("vendors", "name", { ...row });
      if (taken.has(key(item.out.name))) {
        plan.skipped.vendors += 1;
        continue;
      }
      taken.add(key(item.out.name));
      item.keep();
      plan.vendors.push(item.out as unknown as VendorRow);
    }
  }

  // Assessment templates: the organisation's OWN questionnaires (its custom
  // questions), never the built-in system templates.
  if (want("assessmentTemplates")) {
    const [rows, existing] = await Promise.all([
      db.assessmentTemplate.findMany({
        where: { ...src, isSystem: false },
        select: { type: true, name: true, description: true, version: true, sections: true, scoringLogic: true },
        orderBy: { createdAt: "asc" },
      }),
      tgt ? db.assessmentTemplate.findMany({ where: { ...tgt, isSystem: false }, select: { name: true } }) : Promise.resolve([]),
    ]);
    const taken = new Set(existing.map((t) => key(t.name)));
    for (const row of rows) {
      const item = scrubItem("assessmentTemplates", "name", {
        ...row,
        sections: (row.sections ?? []) as Prisma.InputJsonValue,
        scoringLogic: (row.scoringLogic ?? undefined) as Prisma.InputJsonValue | undefined,
      });
      if (taken.has(key(item.out.name))) {
        plan.skipped.assessmentTemplates += 1;
        continue;
      }
      taken.add(key(item.out.name));
      item.keep();
      plan.templates.push(item.out as unknown as TemplateRow);
    }
  }

  // DSAR intake form settings: the public form's wording and options. Copied
  // as an inactive draft; a live public form is never turned on by a copy.
  //
  // Every organisation is seeded with one default intake form so its public
  // portal works out of the box. That untouched default is not "already here":
  // the copy replaces its wording and options in place (the public slug is
  // unique per organisation, so a second form cannot be created), left inactive
  // until reviewed. A form a person has set up is never overwritten.
  if (want("dsarIntake")) {
    const [rows, existing] = await Promise.all([
      db.dSARIntakeForm.findMany({
        where: src,
        select: {
          name: true,
          slug: true,
          title: true,
          description: true,
          fields: true,
          enabledTypes: true,
          customCss: true,
          thankYouMessage: true,
          privacyNoticeUrl: true,
          retentionDays: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      tgt
        ? db.dSARIntakeForm.findMany({
            where: tgt,
            select: {
              id: true,
              name: true,
              slug: true,
              title: true,
              description: true,
              thankYouMessage: true,
              privacyNoticeUrl: true,
              customCss: true,
              fields: true,
            },
          })
        : Promise.resolve([]),
    ]);
    const untouchedDefault = existing.find((f) => !isIntakeConfigured(f as IntakeFormShape)) ?? null;
    // The target manages its own set-up intake form (no seeded default left to
    // replace): the source's form is left behind, and the dialog says so.
    if (rows.length > 0 && existing.length > 0 && !untouchedDefault) {
      plan.dsarIntakeSkippedEdited = true;
    } else {
      // The public slug is unique per organisation; the seeded default's slug is
      // freed because that row is replaced in place, not kept alongside.
      const takenSlugs = new Set(existing.map((f) => f.slug as string));
      if (untouchedDefault) takenSlugs.delete(untouchedDefault.slug as string);
      let replaced = false;
      for (const row of rows) {
        const item = scrubItem("dsarIntake", "name", {
          ...row,
          fields: (row.fields ?? {}) as Prisma.InputJsonValue,
        });
        if (untouchedDefault && !replaced) {
          // Replace the seeded default's wording and options in place.
          replaced = true;
          item.keep();
          plan.dsarForms.push({ ...(item.out as unknown as DsarRow), replaceFormId: untouchedDefault.id as string });
          continue;
        }
        if (takenSlugs.has(item.out.slug)) {
          plan.skipped.dsarIntake += 1;
          continue;
        }
        takenSlugs.add(item.out.slug);
        item.keep();
        plan.dsarForms.push({ ...(item.out as unknown as DsarRow), replaceFormId: null });
      }
    }
  }

  plan.counts.jurisdictions = plan.jurisdictions.length;
  plan.counts.dataAssets = plan.assets.length;
  plan.counts.processingActivities = plan.activities.length;
  plan.counts.vendors = plan.vendors.length;
  plan.counts.assessmentTemplates = plan.templates.length;
  plan.counts.dsarIntake = plan.dsarForms.length;
  return plan;
}

// ─── Apply ───────────────────────────────────────────────────────────────────

export interface AppliedTemplate {
  counts: CopyCounts;
  /** Items that carry a flag, by their id in the new client, for the follow-up list. */
  flagged: (FlaggedItem & { id: string | null })[];
}

/**
 * Write the plan into the target. Call inside a transaction so a refused copy
 * leaves nothing behind.
 */
export async function applyClientTemplate(
  db: Db,
  plan: ClientTemplatePlan,
  input: { targetOrganizationId: string; userId: string; now?: Date },
): Promise<AppliedTemplate> {
  const now = input.now ?? new Date();
  const organizationId = input.targetOrganizationId;
  const ids = new Map<string, string>(); // "<part>:<title>" -> new id
  const idKey = (part: CopyPart, title: string) => `${part}:${title}`;

  // Jurisdictions: the same global jurisdiction rows, linked to the target.
  for (const j of plan.jurisdictions) {
    await db.organizationJurisdiction.create({
      data: { organizationId, jurisdictionId: j.jurisdictionId, isPrimary: j.isPrimary },
    });
  }

  // Data assets, then their elements. The asset carries the template-copy mark.
  const assetIdByKey = new Map<string, string>();
  for (const a of plan.assets) {
    const asset = await db.dataAsset.create({
      data: {
        organizationId,
        name: a.name,
        description: a.description,
        type: a.type,
        owner: a.owner,
        location: a.location,
        hostingType: a.hostingType,
        vendor: a.vendor,
        isProduction: a.isProduction,
        metadata: withTemplateCopyMark(null, now) as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    assetIdByKey.set(a.key, asset.id);
    ids.set(idKey("dataAssets", a.name), asset.id);
    for (const e of a.elements) {
      await db.dataElement.create({
        data: {
          organizationId,
          dataAssetId: asset.id,
          name: e.name,
          description: e.description,
          category: e.category,
          sensitivity: e.sensitivity,
          isPersonalData: e.isPersonalData,
          isSpecialCategory: e.isSpecialCategory,
          retentionDays: e.retentionDays,
          legalBasis: e.legalBasis,
        },
      });
    }
  }

  // Activities can point at an asset the target already had under the same name.
  const wantedAssetKeys = plan.activities
    .flatMap((a) => a.assetLinks.map((l) => l.assetKey))
    .filter((k) => !assetIdByKey.has(k));
  if (wantedAssetKeys.length > 0) {
    const existing = await db.dataAsset.findMany({ where: { organizationId }, select: { id: true, name: true } });
    for (const v of existing) if (!assetIdByKey.has(key(v.name))) assetIdByKey.set(key(v.name), v.id);
  }

  for (const act of plan.activities) {
    const activity = await db.processingActivity.create({
      data: {
        organizationId,
        name: act.name,
        description: act.description,
        purpose: act.purpose,
        legalBasis: act.legalBasis,
        legalBasisDetail: act.legalBasisDetail,
        dataSubjects: act.dataSubjects,
        categories: act.categories,
        recipients: act.recipients,
        retentionPeriod: act.retentionPeriod,
        retentionDays: act.retentionDays,
        automatedDecisionMaking: act.automatedDecisionMaking,
        automatedDecisionDetail: act.automatedDecisionDetail,
        // A draft brought in from a template, not yet an active record.
        isActive: false,
        metadata: withTemplateCopyMark(null, now) as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    ids.set(idKey("processingActivities", act.name), activity.id);
    const linked = new Set<string>();
    for (const link of act.assetLinks) {
      const dataAssetId = assetIdByKey.get(link.assetKey);
      if (!dataAssetId || linked.has(dataAssetId)) continue;
      linked.add(dataAssetId);
      await db.processingActivityAsset.create({
        data: { processingActivityId: activity.id, dataAssetId, purpose: link.purpose },
      });
    }
  }

  for (const v of plan.vendors) {
    const vendor = await db.vendor.create({
      data: {
        organizationId,
        name: v.name,
        description: v.description,
        website: v.website,
        riskTier: v.riskTier,
        categories: v.categories,
        dataProcessed: v.dataProcessed,
        countries: v.countries,
        certifications: v.certifications,
        status: "UNDER_REVIEW",
        metadata: withTemplateCopyMark(null, now) as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    ids.set(idKey("vendors", v.name), vendor.id);
  }

  for (const t of plan.templates) {
    const template = await db.assessmentTemplate.create({
      data: {
        organizationId,
        type: t.type,
        name: t.name,
        description: t.description,
        version: t.version,
        sections: t.sections,
        scoringLogic: t.scoringLogic,
        isSystem: false,
      },
      select: { id: true },
    });
    ids.set(idKey("assessmentTemplates", t.name), template.id);
  }

  for (const f of plan.dsarForms) {
    const data = {
      name: f.name,
      slug: f.slug,
      title: f.title,
      description: f.description,
      fields: f.fields,
      enabledTypes: f.enabledTypes,
      customCss: f.customCss,
      thankYouMessage: f.thankYouMessage,
      privacyNoticeUrl: f.privacyNoticeUrl,
      retentionDays: f.retentionDays,
      // A copy never turns on a live public intake form.
      isActive: false,
    };
    // Replace the target's untouched seeded default in place, or create a new
    // form where there is none to replace.
    const form = f.replaceFormId
      ? await db.dSARIntakeForm.update({
          where: { id: f.replaceFormId },
          data,
          select: { id: true },
        })
      : await db.dSARIntakeForm.create({
          data: { organizationId, ...data },
          select: { id: true },
        });
    ids.set(idKey("dsarIntake", f.name), form.id);
  }

  // The one record of the copy: dated, with counts, and nothing about the source.
  await db.auditLog.create({
    data: {
      organizationId,
      userId: input.userId,
      entityType: "Organization",
      entityId: organizationId,
      action: "CREATE_FROM_TEMPLATE",
      changes: { note: templateAuditNote(now), counts: { ...plan.counts } },
    },
  });

  return {
    counts: plan.counts,
    flagged: plan.flagged.map((f) => ({ ...f, id: ids.get(idKey(f.part, f.title)) ?? null })),
  };
}

// A local copy of effectiveParts so the service does not import from the config
// twice (the config export is used by the router and the dialog); kept in sync.
function effectivePartsLocal(parts: readonly CopyPart[]): CopyPart[] {
  // No part depends on another in DPO Central (see PART_REQUIRES), so the
  // effective set is the chosen set, in the canonical order.
  return [...new Set(parts)];
}
