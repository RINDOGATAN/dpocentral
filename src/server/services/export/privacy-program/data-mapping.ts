/**
 * Pure functions that transform raw Prisma rows into page-ready view-models for
 * the Privacy Program Report. Unit-testable and completely free of @react-pdf.
 */
import type { SemanticTone } from "../design-system/tokens";

/**
 * Minimal translate function signature — structurally compatible with the
 * `Translator` type returned by `next-intl`'s `getTranslations` /
 * `createTranslator`, without pulling next-intl types into the pure data layer.
 */
export type PdfT = (
  key: string,
  values?: Record<string, string | number | Date>
) => string;

// ─── Raw input shapes ─────────────────────────────────────────────────────────

export interface RawAsset {
  id: string;
  name: string;
  type: string;
  owner: string | null;
  location: string | null;
  isProduction: boolean;
  elementCount: number;
  personalCount: number;
  specialCatCount: number;
}

export interface RawActivity {
  id: string;
  name: string;
  legalBasis: string;
  automatedDecisionMaking: boolean;
  transferCount: number;
  systemCount: number;
  nextReview: Date | null;
}

export interface RawVendor {
  id: string;
  name: string;
  status: string;
  riskTier: string | null;
  categories: string[];
  countries: string[];
  certifications: string[];
  hasDpa: boolean;
  dpaStatus: string | null;
  nextReview: Date | null;
}

export interface RawAISystem {
  id: string;
  name: string;
  category: string | null;
  riskLevel: string;
  status: string;
  euAiActRole: string | null;
  euAiActCompliant: boolean | null;
  iso42001Certified: boolean | null;
  provider: string | null;
}

export interface RawCounts {
  openDsars: number;
  overdueDsars: number;
  completedDsarsOnTime: number;
  completedDsarsTotal: number;
  openIncidents: number;
  activeAssessments: number;
}

export interface ProgramInput {
  assets: RawAsset[];
  activities: RawActivity[];
  vendors: RawVendor[];
  aiSystems: RawAISystem[];
  counts: RawCounts;
}

// ─── Derived numbers ──────────────────────────────────────────────────────────

export function computeHeroStats(input: ProgramInput) {
  const { assets, activities, vendors, counts } = input;
  const dsarOnTimePct =
    counts.completedDsarsTotal > 0
      ? Math.round((counts.completedDsarsOnTime / counts.completedDsarsTotal) * 100)
      : null;
  return {
    assetCount: assets.length,
    activityCount: activities.length,
    vendorCount: vendors.length,
    dsarOnTimePct, // null when no completed DSARs yet
  };
}

export function computeCoverageBars(
  input: ProgramInput,
  t: PdfT
): Array<{
  label: string;
  value: number;
  total: number;
}> {
  const { assets, activities, vendors } = input;
  const now = Date.now();
  const assetsWithElements = assets.filter((a) => a.elementCount > 0).length;
  const activitiesReviewedOnTime = activities.filter(
    (a) => a.nextReview && new Date(a.nextReview).getTime() >= now
  ).length;
  const vendorsWithDpa = vendors.filter((v) => v.status === "ACTIVE" && v.hasDpa).length;
  const activeVendors = vendors.filter((v) => v.status === "ACTIVE").length;
  return [
    { label: t("cover.coverage.assetsClassified"), value: assetsWithElements, total: assets.length },
    { label: t("cover.coverage.activitiesReviewed"), value: activitiesReviewedOnTime, total: activities.length },
    { label: t("cover.coverage.vendorsWithDpa"), value: vendorsWithDpa, total: activeVendors },
  ];
}

export interface KeyFindingItem {
  tone: SemanticTone;
  text: string;
}

export function computeKeyFindings(input: ProgramInput, t: PdfT): KeyFindingItem[] {
  const { assets, activities, vendors, counts } = input;
  const items: KeyFindingItem[] = [];
  const now = Date.now();

  const specialCat = assets.reduce((n, a) => n + a.specialCatCount, 0);
  const internationalTransfers = activities.reduce((n, a) => n + a.transferCount, 0);
  const activitiesWithAdm = activities.filter((a) => a.automatedDecisionMaking).length;
  const overdueReview = activities.filter(
    (a) => a.nextReview && new Date(a.nextReview).getTime() < now
  ).length;
  const vendorsMissingDpa = vendors.filter((v) => v.status === "ACTIVE" && !v.hasDpa).length;
  const activeVendors = vendors.filter((v) => v.status === "ACTIVE").length;
  const highRiskVendors = vendors.filter(
    (v) => v.riskTier === "HIGH" || v.riskTier === "CRITICAL"
  ).length;

  if (counts.overdueDsars > 0) {
    items.push({
      tone: "danger",
      text: t("findings.overdueDsars", { count: counts.overdueDsars }),
    });
  }

  if (vendorsMissingDpa > 0) {
    const pct = activeVendors > 0 ? Math.round((vendorsMissingDpa / activeVendors) * 100) : 0;
    items.push({
      tone: "warning",
      text: t("findings.vendorsMissingDpa", { count: vendorsMissingDpa, pct }),
    });
  }

  if (highRiskVendors > 0) {
    items.push({
      tone: "warning",
      text: t("findings.highRiskVendors", { count: highRiskVendors }),
    });
  }

  if (overdueReview > 0) {
    items.push({
      tone: "warning",
      text: t("findings.overdueReview", { count: overdueReview }),
    });
  }

  if (specialCat > 0) {
    items.push({
      tone: "info",
      text: t("findings.specialCat", { count: specialCat }),
    });
  }

  if (internationalTransfers > 0) {
    items.push({
      tone: "info",
      text: t("findings.intlTransfers", { count: internationalTransfers }),
    });
  }

  if (activitiesWithAdm > 0) {
    items.push({
      tone: "info",
      text: t("findings.adm", { count: activitiesWithAdm }),
    });
  }

  if (counts.openIncidents > 0) {
    items.push({
      tone: "warning",
      text: t("findings.openIncidents", { count: counts.openIncidents }),
    });
  }

  // Positive signal: if we have no items at all, show a healthy-program finding
  if (items.length === 0 && (assets.length > 0 || activities.length > 0 || vendors.length > 0)) {
    items.push({
      tone: "success",
      text: t("findings.healthyProgram"),
    });
  }

  return items;
}

export function computeVendorCategoryChips(
  input: ProgramInput
): Array<{ label: string; count: number }> {
  const counts = new Map<string, number>();
  for (const v of input.vendors) {
    for (const cat of v.categories) {
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }));
}

// ─── Inventory page ──────────────────────────────────────────────────────────

export function computeInventoryStats(input: ProgramInput) {
  const { assets } = input;
  const totalElements = assets.reduce((n, a) => n + a.elementCount, 0);
  const personal = assets.reduce((n, a) => n + a.personalCount, 0);
  const specialCat = assets.reduce((n, a) => n + a.specialCatCount, 0);
  return { totalElements, personal, specialCat };
}

export function computeAssetTypeBars(
  input: ProgramInput,
  tEnum: PdfT
): Array<{ label: string; value: number; type: string }> {
  const counts = new Map<string, number>();
  for (const a of input.assets) {
    counts.set(a.type, (counts.get(a.type) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({
      label: tEnum(`assetType.${type}`),
      value: count,
      type,
    }));
}

// ─── ROPA page ───────────────────────────────────────────────────────────────

export function computeRopaStats(input: ProgramInput) {
  const { activities } = input;
  const now = Date.now();
  const withTransfers = activities.filter((a) => a.transferCount > 0).length;
  const withAdm = activities.filter((a) => a.automatedDecisionMaking).length;
  const overdueReview = activities.filter(
    (a) => a.nextReview && new Date(a.nextReview).getTime() < now
  ).length;
  return { withTransfers, withAdm, overdueReview };
}

export function computeLegalBasisBars(
  input: ProgramInput,
  tEnum: PdfT
): Array<{ label: string; value: number }> {
  const counts = new Map<string, number>();
  for (const a of input.activities) {
    counts.set(a.legalBasis, (counts.get(a.legalBasis) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([basis, count]) => ({
      label: tEnum(`legalBasis.${basis}`),
      value: count,
    }));
}

// ─── Vendor Directory page ───────────────────────────────────────────────────

export function computeVendorStats(input: ProgramInput) {
  const { vendors } = input;
  const active = vendors.filter((v) => v.status === "ACTIVE").length;
  const withDpa = vendors.filter((v) => v.status === "ACTIVE" && v.hasDpa).length;
  const withCert = vendors.filter((v) => v.certifications.length > 0).length;
  return { total: vendors.length, active, withDpa, withCert };
}

export function computeCriticalityBars(
  input: ProgramInput,
  tEnum: PdfT
): Array<{ label: string; value: number; color: string; labelColor: string }> {
  const counts = new Map<string, number>();
  for (const v of input.vendors) {
    const tier = v.riskTier ?? "—";
    counts.set(tier, (counts.get(tier) ?? 0) + 1);
  }
  const order = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
  return order.map((tier) => ({
    label: tEnum(`riskTier.${tier}`).toUpperCase(),
    value: counts.get(tier) ?? 0,
    color: colorForCrit(tier),
    labelColor: colorForCrit(tier),
  }));
}

export function groupVendorsByCategory(
  input: ProgramInput
): Array<{ category: string; vendors: RawVendor[] }> {
  const groups = new Map<string, RawVendor[]>();
  for (const v of input.vendors) {
    const cat = v.categories[0] ?? "Uncategorized";
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(v);
  }
  return [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([category, vendors]) => ({
      category,
      vendors: vendors.sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

function colorForCrit(tier: string): string {
  switch (tier) {
    case "CRITICAL": return "#dc2626";
    case "HIGH":     return "#d97706";
    case "MEDIUM":   return "#2563eb";
    case "LOW":      return "#059669";
    default:         return "#64748b";
  }
}

// ─── AI Governance page ──────────────────────────────────────────────────────

export function computeAIStats(input: ProgramInput) {
  const { aiSystems } = input;
  const highRisk = aiSystems.filter(
    (s) => s.riskLevel === "HIGH_RISK" || s.riskLevel === "UNACCEPTABLE"
  ).length;
  const compliant = aiSystems.filter((s) => s.euAiActCompliant === true).length;
  const certified = aiSystems.filter((s) => s.iso42001Certified === true).length;
  return {
    total: aiSystems.length,
    highRisk,
    compliant,
    certified,
  };
}

export function computeAIRiskBars(
  input: ProgramInput,
  tEnum: PdfT
): Array<{ label: string; value: number; color: string; labelColor: string }> {
  const counts = new Map<string, number>();
  for (const s of input.aiSystems) {
    counts.set(s.riskLevel, (counts.get(s.riskLevel) ?? 0) + 1);
  }
  const order: Array<{ key: string; color: string }> = [
    { key: "UNACCEPTABLE", color: "#dc2626" },
    { key: "HIGH_RISK",    color: "#d97706" },
    { key: "LIMITED",      color: "#2563eb" },
    { key: "MINIMAL",      color: "#059669" },
  ];
  return order.map((o) => ({
    label: tEnum(`aiRisk.${o.key}`),
    value: counts.get(o.key) ?? 0,
    color: o.color,
    labelColor: o.color,
  }));
}

export function computeAIRoleBars(
  input: ProgramInput,
  unclassifiedLabel: string
): Array<{ label: string; value: number }> {
  const counts = new Map<string, number>();
  for (const s of input.aiSystems) {
    const role = s.euAiActRole ?? unclassifiedLabel;
    counts.set(role, (counts.get(role) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([role, count]) => ({ label: role, value: count }));
}
