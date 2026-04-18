/**
 * Renders all three design-system reports (Privacy Program, ROPA, Vendor Register)
 * for visual review against a chosen organization.
 *
 *   set -a && source .env.local && set +a && npx tsx scripts/render-all-rebuilt-previews.ts [orgNameFilter] [locale]
 *
 * Both args are optional. `locale` is "en" or "es"; defaults to "en".
 */
import { PrismaClient } from "@prisma/client";
import { renderToBuffer } from "@react-pdf/renderer";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { createTranslator } from "next-intl";
import { PrivacyProgramDocument } from "../src/server/services/export/privacy-program/PrivacyProgramDocument";
import type { ProgramInput, PdfT } from "../src/server/services/export/privacy-program/data-mapping";
import { buildFlowGraphInputs } from "../src/server/services/export/privacy-program/flow-input";
import type { FlowPageBatch } from "../src/server/services/export/privacy-program/pages/DataFlowPage";
import { renderFlowGraphPng, type PdfFlowAsset, type PdfFlowEdge, type PdfFlowCluster } from "../src/server/services/export/flow-graph-pdf";
import { RopaDocument } from "../src/server/services/export/ropa/RopaDocument";
import { VendorRegisterDocument } from "../src/server/services/export/vendor-register/VendorRegisterDocument";
import type { VendorCsvRow } from "../src/server/services/export/vendor-register/csv";
import type { ROPAEntry } from "../src/server/services/privacy/ropaGenerator";
import enMessages from "../src/messages/en.json";
import esMessages from "../src/messages/es.json";

const prisma = new PrismaClient();
const OUTPUT_DIR = "/tmp/dpocentral-exports";

function fmtDate(d: Date): string {
  return d.toISOString().split("T")[0]!;
}

async function main() {
  const orgNameArg = process.argv[2];
  const localeArg = (process.argv[3] ?? "en") as "en" | "es";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages = (localeArg === "es" ? esMessages : enMessages) as any;
  const t = createTranslator({ locale: localeArg, messages, namespace: "pdf.privacyProgram" }) as unknown as PdfT;
  const tCommon = createTranslator({ locale: localeArg, messages, namespace: "pdf.common" }) as unknown as PdfT;
  const tEnum = createTranslator({ locale: localeArg, messages, namespace: "pdf.enum" }) as unknown as PdfT;
  const tRopa = createTranslator({ locale: localeArg, messages, namespace: "pdf.ropaReport" }) as unknown as PdfT;
  const tVendor = createTranslator({ locale: localeArg, messages, namespace: "pdf.vendorRegister" }) as unknown as PdfT;

  const orgs = await prisma.organization.findMany({
    include: { _count: { select: { dataAssets: true, processingActivities: true, vendors: true, aiSystems: true } } },
  });
  const ranked = orgs
    .map((o) => ({ o, score: o._count.dataAssets + o._count.processingActivities + o._count.vendors + o._count.aiSystems * 5 }))
    .sort((a, b) => b.score - a.score);
  const org = orgNameArg
    ? orgs.find((o) => o.name.toLowerCase().includes(orgNameArg.toLowerCase()))
    : ranked[0]?.o;
  if (!org) throw new Error(orgNameArg ? `No org matching "${orgNameArg}"` : "No organization.");

  console.log(`Rendering all rebuilt reports for: ${org.name}`);
  const now = new Date();
  const safeName = org.name.replace(/[^a-zA-Z0-9]/g, "-");
  mkdirSync(OUTPUT_DIR, { recursive: true });

  // ── Shared data fetch ─────────────────────────────────────────────────────
  const [assets, activities, vendors, aiSystems, flows, ropaActivities, openDsars, overdueDsars, completedDsars, openIncidents, activeAssessments] =
    await Promise.all([
      prisma.dataAsset.findMany({ where: { organizationId: org.id }, include: { dataElements: true }, orderBy: { name: "asc" } }),
      prisma.processingActivity.findMany({ where: { organizationId: org.id, isActive: true }, include: { assets: true, transfers: true }, orderBy: { name: "asc" } }),
      prisma.vendor.findMany({ where: { organizationId: org.id }, include: { contracts: { orderBy: { createdAt: "desc" } } }, orderBy: { name: "asc" } }),
      prisma.aISystem.findMany({ where: { organizationId: org.id }, orderBy: { name: "asc" } }),
      prisma.dataFlow.findMany({
        where: { organizationId: org.id },
        include: {
          sourceAsset: { select: { id: true, name: true, type: true } },
          destinationAsset: { select: { id: true, name: true, type: true } },
        },
      }),
      prisma.processingActivity.findMany({
        where: { organizationId: org.id, isActive: true },
        include: {
          assets: { include: { linkedElements: { include: { dataElement: true } }, dataAsset: { include: { dataElements: true } } } },
          transfers: true,
        },
        orderBy: { name: "asc" },
      }),
      prisma.dSARRequest.count({ where: { organizationId: org.id, status: { notIn: ["COMPLETED", "REJECTED", "CANCELLED"] } } }),
      prisma.dSARRequest.count({ where: { organizationId: org.id, status: { notIn: ["COMPLETED", "REJECTED", "CANCELLED"] }, dueDate: { lt: now } } }),
      prisma.dSARRequest.findMany({ where: { organizationId: org.id, status: "COMPLETED" }, select: { dueDate: true, updatedAt: true } }),
      prisma.incident.count({ where: { organizationId: org.id, status: { notIn: ["CLOSED", "FALSE_POSITIVE"] } } }),
      prisma.assessment.count({ where: { organizationId: org.id, status: { in: ["DRAFT", "IN_PROGRESS", "PENDING_REVIEW", "PENDING_APPROVAL"] } } }),
    ]);

  const completedDsarsOnTime = completedDsars.filter((d) => !d.dueDate || d.updatedAt <= d.dueDate).length;

  // ── Privacy Program Report ────────────────────────────────────────────────
  const programInput: ProgramInput = {
    assets: assets.map((a) => ({
      id: a.id, name: a.name, type: a.type, owner: a.owner, location: a.location, isProduction: a.isProduction,
      elementCount: a.dataElements.length,
      personalCount: a.dataElements.filter((e) => e.isPersonalData).length,
      specialCatCount: a.dataElements.filter((e) => e.isSpecialCategory).length,
    })),
    activities: activities.map((a) => ({
      id: a.id, name: a.name, legalBasis: a.legalBasis, automatedDecisionMaking: a.automatedDecisionMaking,
      transferCount: a.transfers.length, systemCount: a.assets.length, nextReview: a.nextReviewAt,
    })),
    vendors: vendors.map((v) => {
      const dpa = v.contracts.find((c) => c.type === "DPA");
      return { id: v.id, name: v.name, status: v.status, riskTier: v.riskTier, categories: v.categories, countries: v.countries, certifications: v.certifications, hasDpa: !!dpa, dpaStatus: dpa ? dpa.status.replace(/_/g, " ") : null, nextReview: v.nextReviewAt };
    }),
    aiSystems: aiSystems.map((s) => ({
      id: s.id, name: s.name, category: s.category, riskLevel: s.riskLevel, status: s.status,
      euAiActRole: s.euAiActRole, euAiActCompliant: s.euAiActCompliant, iso42001Certified: s.iso42001Certified, provider: s.provider,
    })),
    counts: {
      openDsars, overdueDsars, completedDsarsOnTime,
      completedDsarsTotal: completedDsars.length,
      openIncidents, activeAssessments,
    },
  };

  const flowResult = buildFlowGraphInputs(
    assets.map((a) => ({ id: a.id, name: a.name, type: a.type, isProduction: a.isProduction })),
    flows.map((f) => {
      const meta = f.metadata as { autoGenerated?: boolean } | null;
      return { sourceAssetId: f.sourceAssetId, destinationAssetId: f.destinationAssetId, dataCategories: f.dataCategories, frequency: f.frequency, isAutoGenerated: meta?.autoGenerated === true };
    }),
    activities.map((a) => ({ id: a.id, name: a.name, assetIds: a.assets.map((l) => l.dataAssetId) })),
    undefined,
    {
      unassigned: t("flowMap.clusterUnassigned"),
      overview: t("flowMap.clusterOverview"),
      moreSuffix: (count) => ` ${t("flowMap.clusterMoreSuffix", { count })}`,
    }
  );
  const flowBatches: FlowPageBatch[] = await Promise.all(flowResult.batches.map(async (b) => ({
    label: b.label,
    graph: b.edges.length > 0
      ? await renderFlowGraphPng(b.assets, b.edges, { rankdir: "LR", clusters: b.clusters.length > 0 ? b.clusters : undefined, fitWidth: 720 })
      : null,
    assetTypes: [...new Set(b.assets.map((a) => a.type))],
  })));

  {
    const buffer = await renderToBuffer(
      PrivacyProgramDocument({
        orgName: org.name, date: fmtDate(now), input: programInput,
        t, tCommon, tEnum, locale: localeArg,
        flowBatches: flowBatches.filter((b) => b.graph !== null),
        flowOriginalCount: flowResult.originalAssetCount,
        flowFilteredCount: flowResult.filteredAssetCount,
        flowOrphansDropped: flowResult.orphansDropped,
      })
    );
    const path = join(OUTPUT_DIR, `Privacy-Program-${safeName}-${localeArg}-${fmtDate(now)}.pdf`);
    writeFileSync(path, buffer);
    console.log(`  Privacy Program → ${path} (${Math.round(buffer.length / 1024)}KB)`);
  }

  // ── ROPA ──────────────────────────────────────────────────────────────────
  const ropaEntries: ROPAEntry[] = ropaActivities.map((activity) => ({
    name: activity.name,
    description: activity.description,
    purpose: activity.purpose,
    legalBasis: activity.legalBasis,
    legalBasisDetail: activity.legalBasisDetail,
    dataSubjects: activity.dataSubjects,
    dataCategories: activity.categories,
    recipients: activity.recipients,
    retentionPeriod: activity.retentionPeriod,
    automatedDecisionMaking: activity.automatedDecisionMaking,
    automatedDecisionDetail: activity.automatedDecisionDetail,
    systems: activity.assets.map((a) => {
      const effective = a.linkedElements.length > 0 ? a.linkedElements.map((le) => le.dataElement) : a.dataAsset.dataElements;
      return {
        name: a.dataAsset.name, type: a.dataAsset.type, location: a.dataAsset.location,
        elements: effective.map((e) => ({ name: e.name, category: e.category, sensitivity: e.sensitivity })),
      };
    }),
    transfers: activity.transfers.map((t) => ({ destination: t.destinationCountry, organization: t.destinationOrg, mechanism: t.mechanism, safeguards: t.safeguards })),
    lastReviewed: activity.lastReviewedAt,
    nextReview: activity.nextReviewAt,
  }));

  // ROPA cluster graph (legacy approach — all activities)
  const ropaAssetMap = new Map<string, PdfFlowAsset>();
  for (const a of ropaActivities) for (const link of a.assets) ropaAssetMap.set(link.dataAsset.id, { id: link.dataAsset.id, name: link.dataAsset.name, type: link.dataAsset.type });
  for (const f of flows) { ropaAssetMap.set(f.sourceAsset.id, f.sourceAsset); ropaAssetMap.set(f.destinationAsset.id, f.destinationAsset); }
  const ropaOwner = new Map<string, string>();
  for (const a of [...ropaActivities].sort((a, b) => a.name.localeCompare(b.name))) for (const link of a.assets) if (!ropaOwner.has(link.dataAsset.id)) ropaOwner.set(link.dataAsset.id, a.id);
  const ropaClusters: PdfFlowCluster[] = ropaActivities
    .map((a) => ({ id: a.id, label: a.name, assetIds: a.assets.map((l) => l.dataAsset.id).filter((id) => ropaOwner.get(id) === a.id) }))
    .filter((c) => c.assetIds.length > 0);
  const ropaEdges: PdfFlowEdge[] = flows.map((f) => {
    const meta = f.metadata as { autoGenerated?: boolean } | null;
    return { sourceAssetId: f.sourceAssetId, destinationAssetId: f.destinationAssetId, label: [f.dataCategories[0], f.frequency].filter(Boolean).join(" · ") || undefined, isAutoGenerated: meta?.autoGenerated === true };
  });
  const ropaFlowGraph = ropaEdges.length > 0
    ? await renderFlowGraphPng([...ropaAssetMap.values()], ropaEdges, { rankdir: "LR", clusters: ropaClusters, fitWidth: 720 })
    : null;

  {
    const buffer = await renderToBuffer(RopaDocument({
      entries: ropaEntries,
      orgName: org.name,
      flowGraph: ropaFlowGraph,
      t: tRopa,
      tCommon,
      tEnum,
      locale: localeArg,
    }));
    const path = join(OUTPUT_DIR, `ROPA-${safeName}-${localeArg}-${fmtDate(now)}.pdf`);
    writeFileSync(path, buffer);
    console.log(`  ROPA            → ${path} (${Math.round(buffer.length / 1024)}KB)`);
  }

  // ── Vendor Register ───────────────────────────────────────────────────────
  const vendorRows: VendorCsvRow[] = vendors.map((v) => ({
    id: v.id, name: v.name, description: v.description, website: v.website, status: v.status,
    riskTier: v.riskTier, riskScore: v.riskScore, primaryContact: v.primaryContact, contactEmail: v.contactEmail,
    categories: v.categories, dataProcessed: v.dataProcessed, countries: v.countries, certifications: v.certifications,
    lastAssessedAt: v.lastAssessedAt, nextReviewAt: v.nextReviewAt,
    contracts: v.contracts.map((c) => ({ name: c.name, type: c.type, status: c.status, startDate: c.startDate, endDate: c.endDate })),
  }));

  {
    const buffer = await renderToBuffer(VendorRegisterDocument({
      vendors: vendorRows,
      orgName: org.name,
      t: tVendor,
      tCommon,
      tEnum,
      locale: localeArg,
    }));
    const path = join(OUTPUT_DIR, `Vendor-Register-${safeName}-${localeArg}-${fmtDate(now)}.pdf`);
    writeFileSync(path, buffer);
    console.log(`  Vendor Register → ${path} (${Math.round(buffer.length / 1024)}KB)`);
  }
}

main()
  .catch((e) => { console.error("Render failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
