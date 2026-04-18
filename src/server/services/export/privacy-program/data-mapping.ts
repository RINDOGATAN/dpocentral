/**
 * Pure functions that transform raw Prisma rows into page-ready view-models for
 * the Privacy Program Report. Unit-testable and completely free of @react-pdf.
 */
import type { SemanticTone } from "../design-system/tokens";

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

export function computeCoverageBars(input: ProgramInput): Array<{
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
    { label: "Assets classified", value: assetsWithElements, total: assets.length },
    { label: "Activities reviewed", value: activitiesReviewedOnTime, total: activities.length },
    { label: "Vendors with DPA", value: vendorsWithDpa, total: activeVendors },
  ];
}

export interface KeyFindingItem {
  tone: SemanticTone;
  text: string;
}

export function computeKeyFindings(input: ProgramInput): KeyFindingItem[] {
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
      text: `${counts.overdueDsars} data-subject request${counts.overdueDsars !== 1 ? "s are" : " is"} past the statutory response deadline.`,
    });
  }

  if (vendorsMissingDpa > 0) {
    const pct = activeVendors > 0 ? Math.round((vendorsMissingDpa / activeVendors) * 100) : 0;
    items.push({
      tone: "warning",
      text: `${vendorsMissingDpa} active vendor${vendorsMissingDpa !== 1 ? "s" : ""} (${pct}%) have no Data Processing Agreement on file.`,
    });
  }

  if (highRiskVendors > 0) {
    items.push({
      tone: "warning",
      text: `${highRiskVendors} vendor${highRiskVendors !== 1 ? "s are" : " is"} classified as high or critical risk — governance review recommended.`,
    });
  }

  if (overdueReview > 0) {
    items.push({
      tone: "warning",
      text: `${overdueReview} processing activit${overdueReview !== 1 ? "ies are" : "y is"} overdue for periodic review.`,
    });
  }

  if (specialCat > 0) {
    items.push({
      tone: "info",
      text: `${specialCat} special category data element${specialCat !== 1 ? "s are" : " is"} catalogued — Article 9 safeguards apply.`,
    });
  }

  if (internationalTransfers > 0) {
    items.push({
      tone: "info",
      text: `${internationalTransfers} international transfer${internationalTransfers !== 1 ? "s are" : " is"} documented across processing activities.`,
    });
  }

  if (activitiesWithAdm > 0) {
    items.push({
      tone: "info",
      text: `${activitiesWithAdm} activit${activitiesWithAdm !== 1 ? "ies involve" : "y involves"} automated decision-making subject to Article 22.`,
    });
  }

  if (counts.openIncidents > 0) {
    items.push({
      tone: "warning",
      text: `${counts.openIncidents} incident${counts.openIncidents !== 1 ? "s are" : " is"} open and under investigation.`,
    });
  }

  // Positive signal: if we have no items at all, show a healthy-program finding
  if (items.length === 0 && (assets.length > 0 || activities.length > 0 || vendors.length > 0)) {
    items.push({
      tone: "success",
      text: "No material findings detected. The privacy program is in a steady state across inventory, processing, vendors, and incident response.",
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
  input: ProgramInput
): Array<{ label: string; value: number; type: string }> {
  const counts = new Map<string, number>();
  for (const a of input.assets) {
    counts.set(a.type, (counts.get(a.type) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({
      label: type.replace(/_/g, " "),
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
  input: ProgramInput
): Array<{ label: string; value: number }> {
  const counts = new Map<string, number>();
  for (const a of input.activities) {
    counts.set(a.legalBasis, (counts.get(a.legalBasis) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([basis, count]) => ({
      label: basis.replace(/_/g, " "),
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
  input: ProgramInput
): Array<{ label: string; value: number; color: string; labelColor: string }> {
  const counts = new Map<string, number>();
  for (const v of input.vendors) {
    const tier = v.riskTier ?? "—";
    counts.set(tier, (counts.get(tier) ?? 0) + 1);
  }
  const order = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
  return order.map((tier) => ({
    label: tier,
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
  input: ProgramInput
): Array<{ label: string; value: number; color: string; labelColor: string }> {
  const counts = new Map<string, number>();
  for (const s of input.aiSystems) {
    counts.set(s.riskLevel, (counts.get(s.riskLevel) ?? 0) + 1);
  }
  const order: Array<{ key: string; label: string; color: string }> = [
    { key: "UNACCEPTABLE", label: "Unacceptable", color: "#dc2626" },
    { key: "HIGH_RISK",    label: "High Risk",     color: "#d97706" },
    { key: "LIMITED",      label: "Limited",       color: "#2563eb" },
    { key: "MINIMAL",      label: "Minimal",       color: "#059669" },
  ];
  return order.map((o) => ({
    label: o.label,
    value: counts.get(o.key) ?? 0,
    color: o.color,
    labelColor: o.color,
  }));
}

export function computeAIRoleBars(
  input: ProgramInput
): Array<{ label: string; value: number }> {
  const counts = new Map<string, number>();
  for (const s of input.aiSystems) {
    const role = s.euAiActRole ?? "Unclassified";
    counts.set(role, (counts.get(role) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([role, count]) => ({ label: role, value: count }));
}
