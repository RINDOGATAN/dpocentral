// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * First-run journey fixes (quick start, review, reports, "What applies"):
 * - counts agree in number, in both languages;
 * - the import summary names the internal-systems record it counts, and the
 *   build links that record to the vendor activities its flows feed;
 * - the English quick start is in sentence case;
 * - vendor search ranks names first; the example buttons add the vendor;
 * - the review intro speaks to a company without mentioning other clients;
 * - the places picker folds the United States and the rest of the world;
 * - the reports' module titles wrap; "What applies" opens on what applies;
 * - one name for Settings; one reassurance line under the build button;
 *   all five steps shown from the start.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { IntlMessageFormat } from "intl-messageformat";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { nameMatchRank, rankCatalogSearch } from "@/lib/vendor-catalog-search";
import { OPEN_PLACE_GROUPS } from "@/components/privacy/jurisdiction-picker";

const src = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8");
const QS = "src/app/(dashboard)/privacy/quickstart/page.tsx";
const fmt = (msg: string, locale: string, values: Record<string, unknown>) =>
  String(new IntlMessageFormat(msg, locale).format(values));

let seq = 0;
const made = (prefix: string) => async ({ data }: { data: Record<string, unknown> }) => ({
  id: `${prefix}-${++seq}`,
  ...data,
});

const mocks = vi.hoisted(() => ({
  prisma: {
    organizationMember: { findUnique: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    vendor: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    vendorCatalog: { findMany: vi.fn() },
    dataAsset: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    dataElement: { createMany: vi.fn() },
    processingActivity: { findMany: vi.fn(), create: vi.fn() },
    processingActivityAsset: { create: vi.fn() },
    dataFlow: { create: vi.fn(), findMany: vi.fn() },
    dataTransfer: { createMany: vi.fn() },
    auditLog: { create: vi.fn(), createMany: vi.fn() },
    organization: { findUnique: vi.fn(), update: vi.fn() },
    businessUnitMember: { findMany: vi.fn().mockResolvedValue([]) },
    aISystem: { create: vi.fn(), findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
  createAssessment: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/server/services/assessment-auto-create", () => ({
  createAssessmentFromActivity: mocks.createAssessment,
}));
vi.mock("@/server/services/licensing/entitlement", () => ({
  hasVendorCatalogAccess: vi.fn().mockResolvedValue(true),
}));

import { quickstartRouter } from "@/server/routers/privacy/quickstart";
import { VENDOR_DATA_MAPPINGS } from "@/config/vendor-data-mappings";
import { callerFor, sessionFor } from "./helpers";

const ORG = { id: "org-1", name: "Org", slug: "org", pilotStartedAt: null };
const LOW = Object.values(VENDOR_DATA_MAPPINGS).find((m) => !m.isHighRisk)!;

function catalogVendor(slug: string, name: string) {
  return {
    slug,
    name,
    category: LOW.catalogCategories[0]!,
    subcategory: null,
    description: `${name} description`,
    website: `https://${slug}.example.com`,
    dataLocations: [],
    certifications: [],
    privacyTechnologies: [],
    aiCapabilities: [],
    aiTechniques: [],
    euAiActRole: null,
    euAiActCompliant: null,
    iso42001Certified: null,
    aiModels: null,
    euAiActAnnexIIIDomains: [],
    tags: [],
  };
}
const ONE = catalogVendor("one", "One Vendor");
const TWO = catalogVendor("two", "Two Vendor");

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("AUTH_COOKIE_DOMAIN", "");
  seq = 0;
  const p = mocks.prisma;
  p.organizationMember.findUnique.mockResolvedValue({
    id: "m-1",
    userId: "user-1",
    organizationId: ORG.id,
    role: "OWNER",
    organization: ORG,
  });
  p.vendor.findMany.mockResolvedValue([]);
  p.vendor.create.mockImplementation(made("vendor"));
  p.vendorCatalog.findMany.mockResolvedValue([ONE, TWO]);
  p.dataAsset.findMany.mockResolvedValue([]);
  p.dataAsset.findFirst.mockResolvedValue(null);
  p.processingActivity.findMany.mockResolvedValue([]);
  p.dataAsset.create.mockImplementation(made("asset"));
  p.processingActivity.create.mockImplementation(made("activity"));
  p.dataFlow.create.mockImplementation(made("flow"));
  p.dataFlow.findMany.mockResolvedValue([]);
  p.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(p));
  mocks.createAssessment.mockResolvedValue({ created: true });
});

describe("counts agree in number", () => {
  const vendorsEs = es.pages.quickstart.vendors;
  const vendorsEn = en.pages.quickstart.vendors;
  it("one selected vendor reads in the singular", () => {
    expect(fmt(vendorsEs.selectedSuffix, "es", { count: 1 })).toBe("1 seleccionado");
    expect(fmt(vendorsEs.selectedSuffix, "es", { count: 3 })).toBe("3 seleccionados");
  });
  it("the import summary uses singular and plural, and names the internal systems", () => {
    const values = { vendors: 1, assets: 2, elements: 4, activities: 1, transfers: 1, internal: "yes" };
    expect(fmt(vendorsEs.previewSummaryWithTransfers, "es", values)).toBe(
      "1 proveedor, 2 sistemas (incluidos tus sistemas internos), 4 elementos, 1 actividad, 1 transferencia de datos",
    );
    expect(fmt(vendorsEn.previewSummary, "en", { ...values, internal: "no" })).toBe(
      "1 vendor, 2 systems, 4 elements, 1 activity",
    );
  });
  it("the review tiles agree with their number", () => {
    const stats = es.pages.quickstart.review.stats;
    expect(fmt(stats.vendors, "es", { count: 1 })).toBe("Proveedor");
    expect(fmt(stats.activities, "es", { count: 2 })).toBe("Actividades");
    expect(src(QS)).toContain('tp("review.stats.vendors", { count: reviewTotals.vendors })');
  });
  it("the industry summary uses singular and plural", () => {
    expect(fmt(es.pages.quickstart.industry.previewSummary, "es", { assets: 1, elements: 1, activities: 1, flows: 1 })).toBe(
      "1 sistema, 1 elemento, 1 actividad, 1 flujo",
    );
  });
});

describe("the internal-systems record", () => {
  it("the preview says when it is among the systems to create", async () => {
    mocks.prisma.vendorCatalog.findMany.mockResolvedValue([ONE]);
    const preview = await callerFor(quickstartRouter, sessionFor("user-1")).previewVendorImport({
      organizationId: ORG.id,
      vendorSlugs: [ONE.slug],
      locale: "es",
    });
    expect(preview.totals.internalSystems).toBe(1);
    expect(preview.totals.assets).toBe(2);
  });

  it("the build links it to each vendor activity its flows feed", async () => {
    await callerFor(quickstartRouter, sessionFor("user-1")).execute({
      organizationId: ORG.id,
      vendorSlugs: [ONE.slug, TWO.slug],
    });
    const assets = mocks.prisma.dataAsset.create.mock.calls.map((c) => c[0].data as { name: string });
    const internalIndex = assets.findIndex((a) => /internal|interno/i.test(a.name));
    expect(internalIndex).toBeGreaterThanOrEqual(0);
    const internalId = ((await mocks.prisma.dataAsset.create.mock.results[internalIndex]!.value) as { id: string }).id;
    const links = mocks.prisma.processingActivityAsset.create.mock.calls.map(
      (c) => c[0].data as { processingActivityId: string; dataAssetId: string },
    );
    const activities = mocks.prisma.processingActivity.create.mock.calls.length;
    expect(activities).toBe(2);
    expect(links.filter((l) => l.dataAssetId === internalId)).toHaveLength(2);
  });
});

describe("English quick start in sentence case", () => {
  it("step labels, titles and buttons", () => {
    const q = en.pages.quickstart;
    expect(Object.values(q.steps).filter((v) => !/depends|chosen path/.test(v))).toEqual([
      "What applies",
      "Choose a path",
      "Select vendors",
      "Your vendors",
      "Industry template",
      "Review and confirm",
    ]);
    expect([q.vendors.title, q.industry.title, q.review.title, q.review.build, q.vendors.continueToIndustry]).toEqual([
      "Select vendors",
      "Select an industry",
      "Review and confirm",
      "Build my privacy program",
      "Continue to industry",
    ]);
  });
});

describe("vendor search", () => {
  const rows = [
    { name: "Microsoft Clarity", slug: "clarity", isVerified: true },
    { name: "Microsoft 365", slug: "microsoft-365", isVerified: false },
    { name: "Zoom", slug: "zoom", isVerified: false },
    { name: "My 365 Tools", slug: "my-365-tools", isVerified: true },
  ];
  it("ranks an exact name first, then names that start with the query", () => {
    expect(rankCatalogSearch(rows, "Microsoft 365").map((r) => r.slug)).toEqual(["microsoft-365"]);
    expect(rankCatalogSearch(rows, "micro").map((r) => r.slug)).toEqual(["clarity", "microsoft-365"]);
    expect(nameMatchRank(rows[1]!, "365")).toBe(2);
  });
  it("falls back to description matches only when no name matches", () => {
    expect(rankCatalogSearch(rows, "video calls").map((r) => r.slug)).toEqual(["clarity", "my-365-tools", "microsoft-365", "zoom"]);
  });
  it("the server searches names first and descriptions only as a fallback", () => {
    const router = src("src/server/routers/vendorCatalog.ts");
    expect(router).toContain("rankCatalogSearch(rows, input.query)");
    expect(router).toMatch(/byName\.length > 0\s*\?\s*byName/);
  });
  it("an example button adds its vendor, and every example is in the catalogue", () => {
    const page = src(QS);
    expect(page).toContain("onClick={() => toggleVendorSlug(v.slug)}");
    const slugs = [...page.matchAll(/\{ name: "[^"]+", slug: "([a-z0-9-]+)" \}/g)].map((m) => m[1]);
    expect(slugs).toHaveLength(8);
    const snapshot = JSON.parse(src("vendors/catalog-snapshot.json")) as { vendors: { slug: string }[] };
    const known = new Set(snapshot.vendors.map((v) => v.slug));
    expect(slugs.filter((s) => !known.has(s!))).toEqual([]);
  });
});

describe("review page", () => {
  it("a company reads an intro without other clients", () => {
    expect(es.drafts.reviewSubtitleCompany).not.toMatch(/cliente/);
    expect(en.drafts.reviewSubtitleCompany).not.toMatch(/client/);
    const page = src("src/app/(dashboard)/privacy/review/page.tsx");
    expect(page).toContain('t(isProfessional ? "reviewSubtitle" : "reviewSubtitleCompany")');
  });
  it("record names look like links", () => {
    const page = src("src/app/(dashboard)/privacy/review/page.tsx");
    expect(page).toMatch(/hover:underline/);
    expect(page).toContain("<ChevronRight");
  });
});

describe("places, reports, What applies, Settings", () => {
  it("only Europe is open before a choice", () => {
    expect(OPEN_PLACE_GROUPS).toEqual(["europe"]);
    expect(fmt(es.jurisdictionPicker.placeCount, "es", { count: 19 })).toBe("19 lugares");
  });
  it("module titles on the reports page wrap", () => {
    const page = src("src/app/(dashboard)/privacy/reports/page.tsx");
    expect(page).toContain('className="text-sm font-medium leading-snug break-words hyphens-auto">{label}');
    expect(page).not.toContain('font-medium truncate">{label}');
  });
  it("What applies opens on the applied tab once something applies", () => {
    const page = src("src/app/(dashboard)/privacy/regulations/page.tsx");
    expect(page).toContain('tabChoice ?? (appliedItems.length > 0 ? "applied" : "catalog")');
  });
  it("one name for Settings in Spanish", () => {
    expect(es.pages.settings.title).toBe("Ajustes");
  });
});

describe("quick start frame", () => {
  it("no global search box during the quick start", () => {
    expect(src("src/components/guided/guided-layout.tsx")).toContain('pathname !== "/privacy/quickstart" && <GlobalSearch />');
  });
  it("one reassurance line under the build button, not a box", () => {
    const page = src(QS);
    expect(page).not.toContain("review.nondestructiveTitle");
    expect(page).toContain('tp("review.onlyNew")');
    expect(es.pages.quickstart.review.onlyNew).toBe("Solo crea registros nuevos; no cambia los que ya tienes.");
  });
  it("Back sits beside the main button on each step", () => {
    const page = src(QS);
    for (const key of ["vendors.back", "industry.back", "review.back"]) {
      const at = page.indexOf(`{tp("${key}")}`);
      expect(at).toBeGreaterThan(0);
      // The primary action follows within the same footer.
      expect(page.slice(at, at + 400)).toMatch(/<Button\s+onClick=\{handle(Proceed|Execute)/);
    }
  });
  it("skip reads 'Omitir por ahora'", () => {
    expect(es.pages.quickstart.applies.skip).toBe("Omitir por ahora");
    expect(en.pages.quickstart.applies.skip).toBe("Skip for now");
  });
  it("all five steps show from the start", () => {
    const page = src(QS);
    expect(page).toMatch(/state: !pathChosen \? "pending" : useVendors \? "on" : "skipped"/);
    expect(page).toMatch(/state: !pathChosen \? "pending" : useIndustry \? "on" : "skipped"/);
  });
});
