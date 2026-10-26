// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The organisation's "Public website and apps" record: the source of the data
 * flows to client-side tools (src/config/client-side-collection.ts), which
 * collect on the public properties rather than receive data from internal
 * systems. One per organisation, found in either language, created once.
 *
 * The backfill (scripts/backfill-public-properties-flows.ts) moves, for
 * existing organisations, the quick start's unedited "internal systems →
 * client-side tool" flows so that they start from that record, and moves the
 * tool's activity link from the internal systems to it. A flow whose name or
 * description a person changed, or that a person drew, is never touched;
 * nor is a flow back from the tool, which may be the customer's declaration.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import { isClientSideCollection, PUBLIC_PROPERTIES_KIND } from "@/config/client-side-collection";
import { VENDOR_QUICKSTART_TEXT } from "@/config/vendor-data-mappings-es";
import { syncGeneratedFlows } from "./auto-flows";

type Lang = "en" | "es";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Tx = any;

/** The organisation's public-properties record, created when missing. */
export async function findOrCreatePublicProperties(
  tx: Tx,
  organizationId: string,
  lang: Lang
): Promise<{ id: string; name: string; created: boolean }> {
  const existing = await tx.dataAsset.findFirst({
    where: {
      organizationId,
      OR: [
        { sourceRef: PUBLIC_PROPERTIES_KIND },
        {
          name: {
            in: [VENDOR_QUICKSTART_TEXT.en.publicPropertiesName, VENDOR_QUICKSTART_TEXT.es.publicPropertiesName],
          },
        },
      ],
    },
    select: { id: true, name: true },
  });
  if (existing) return { ...existing, created: false };
  const text = VENDOR_QUICKSTART_TEXT[lang];
  const asset = await tx.dataAsset.create({
    data: {
      organizationId,
      name: text.publicPropertiesName,
      description: text.publicPropertiesDescription,
      type: "APPLICATION",
      hostingType: text.publicPropertiesHosting,
      isProduction: true,
      // Drafted like every other quick-start record: "To confirm" until a
      // person confirms it. The domains can be added to it later.
      provenance: "AUTO_TEMPLATE",
      sourceRef: PUBLIC_PROPERTIES_KIND,
      metadata: { source: "quickstart", kind: PUBLIC_PROPERTIES_KIND },
    },
    select: { id: true, name: true },
  });
  return { ...asset, created: true };
}

/** The language a quick-start "flow to vendor" was written in, or null when a person changed it. */
export function unchangedQuickstartFlowLanguage(
  flow: { name: string; description: string | null },
  vendor: string
): Lang | null {
  for (const lang of ["en", "es"] as const) {
    const t = VENDOR_QUICKSTART_TEXT[lang];
    if (flow.name === t.flowTo(vendor) && (flow.description === null || flow.description === t.flowToDescription(vendor)))
      return lang;
  }
  return null;
}

export interface PublicPropertiesBackfillRow {
  organizationId: string;
  /** Flows moved (or, in a dry run, that would move) to the public-properties record. */
  flows: number;
  /** Activity links moved from the internal systems to the public-properties record. */
  links: number;
  /** Flows back from a client-side tool left as they are (possibly declared by the customer). */
  returnFlowsKept: number;
}

export async function backfillPublicPropertiesFlows(
  db: any,
  opts: { execute: boolean; organizationId?: string }
): Promise<PublicPropertiesBackfillRow[]> {
  const orgs: { id: string; name: string }[] = await db.organization.findMany({
    where: opts.organizationId ? { id: opts.organizationId } : {},
    select: { id: true, name: true },
  });
  const catalogCache = new Map<string, boolean>();
  async function clientSide(vendor: string): Promise<boolean> {
    if (catalogCache.has(vendor)) return catalogCache.get(vendor)!;
    const c = await db.vendorCatalog.findFirst({ where: { name: vendor }, select: { category: true, subcategory: true } });
    const yes = !!c && isClientSideCollection(c.category, c.subcategory);
    catalogCache.set(vendor, yes);
    return yes;
  }

  const rows: PublicPropertiesBackfillRow[] = [];
  for (const org of orgs) {
    const internalNames = [
      VENDOR_QUICKSTART_TEXT.en.internalSystemsName(org.name),
      VENDOR_QUICKSTART_TEXT.es.internalSystemsName(org.name),
    ];
    const internal: { id: string }[] = await db.dataAsset.findMany({
      where: { organizationId: org.id, name: { in: internalNames } },
      select: { id: true },
    });
    if (internal.length === 0) continue;
    const internalIds = internal.map((a) => a.id);

    const outbound: Array<{
      id: string;
      name: string;
      description: string | null;
      metadata: unknown;
      destinationAsset: { id: string; vendor: string | null };
    }> = await db.dataFlow.findMany({
      where: { organizationId: org.id, sourceAssetId: { in: internalIds } },
      select: {
        id: true,
        name: true,
        description: true,
        metadata: true,
        destinationAsset: { select: { id: true, vendor: true } },
      },
    });

    const moves: Array<{ flowId: string; lang: Lang; vendor: string; vendorAssetId: string; metadata: unknown }> = [];
    for (const f of outbound) {
      const vendor = f.destinationAsset?.vendor;
      if (!vendor) continue;
      const lang = unchangedQuickstartFlowLanguage(f, vendor);
      if (!lang) continue;
      if (!(await clientSide(vendor))) continue;
      moves.push({ flowId: f.id, lang, vendor, vendorAssetId: f.destinationAsset.id, metadata: f.metadata });
    }
    if (moves.length === 0) continue;

    const vendorAssetIds = moves.map((m) => m.vendorAssetId);
    const returnFlowsKept: number = await db.dataFlow.count({
      where: { organizationId: org.id, sourceAssetId: { in: vendorAssetIds }, destinationAssetId: { in: internalIds } },
    });
    // The quick start's own activities for these tools, still linked to the internal systems.
    const activities: { id: string }[] = await db.processingActivity.findMany({
      where: {
        organizationId: org.id,
        sourceRef: "quickstart",
        AND: [
          { assets: { some: { dataAssetId: { in: vendorAssetIds } } } },
          { assets: { some: { dataAssetId: { in: internalIds } } } },
        ],
      },
      select: { id: true },
    });

    const row: PublicPropertiesBackfillRow = {
      organizationId: org.id,
      flows: moves.length,
      links: activities.length,
      returnFlowsKept,
    };

    if (opts.execute) {
      await db.$transaction(async (tx: Tx) => {
        const target = await findOrCreatePublicProperties(tx, org.id, moves[0]!.lang);
        for (const m of moves) {
          const t = VENDOR_QUICKSTART_TEXT[m.lang];
          const meta = m.metadata && typeof m.metadata === "object" ? (m.metadata as Record<string, unknown>) : {};
          await tx.dataFlow.update({
            where: { id: m.flowId },
            data: {
              sourceAssetId: target.id,
              name: t.flowFromProperties(m.vendor),
              description: t.flowFromPropertiesDescription(m.vendor),
              metadata: { ...meta, source: "quickstart", collectedOn: PUBLIC_PROPERTIES_KIND, movedFrom: "internal-systems" },
            },
          });
        }
        for (const a of activities) {
          await tx.processingActivityAsset.deleteMany({
            where: { processingActivityId: a.id, dataAssetId: { in: internalIds } },
          });
          await tx.processingActivityAsset.upsert({
            where: { processingActivityId_dataAssetId: { processingActivityId: a.id, dataAssetId: target.id } },
            update: {},
            create: { processingActivityId: a.id, dataAssetId: target.id },
          });
        }
        if (activities.length > 0) await syncGeneratedFlows(tx, org.id, activities.map((a) => a.id));
      });
    }
    rows.push(row);
  }
  return rows;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
