"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  BookOpen,
  Database,
  FileText,
  ClipboardCheck,
  AlertTriangle,
  Building2,
  Sparkles,
  Zap,
  ChevronRight,
  Search,
  BarChart3,
  Wand2,
  ArrowRightLeft,
  Globe,
  Bot,
} from "lucide-react";
import { PremiumBadge } from "./premium-badge";
import { cn } from "@/lib/utils";
import { isDsarModuleEnabled } from "@/config/features";

// Labels live in the message bundles under docs.toc.<key>.label and
// docs.toc.<key>.items.<child key>, in every language the guide speaks.
interface TocChild {
  key: string;
  hash: string;
}

interface TocSection {
  href: string;
  key: string;
  icon: React.ElementType;
  premium?: boolean;
  children?: TocChild[];
}

const allTocSections: TocSection[] = [
  {
    href: "/privacy/docs",
    key: "gettingStarted",
    icon: BookOpen,
    children: [
      { key: "dashboard", hash: "#dashboard" },
      { key: "documents", hash: "#documents" },
      { key: "nextActions", hash: "#next-actions" },
      { key: "quickstart", hash: "#quickstart" },
      { key: "navigation", hash: "#navigation" },
      { key: "roles", hash: "#roles" },
    ],
  },
  {
    href: "/privacy/docs/guides/controller-or-processor",
    key: "guideRole",
    icon: Building2,
  },
  {
    href: "/privacy/docs/guides/do-i-need-a-dpo",
    key: "guideDpo",
    icon: FileText,
  },
  {
    href: "/privacy/docs/guides/when-is-a-dpia-required",
    key: "guideDpia",
    icon: ClipboardCheck,
  },
  {
    href: "/privacy/docs/quickstart",
    key: "quickstart",
    icon: Zap,
    children: [
      { key: "howItWorks", hash: "#how-it-works" },
      { key: "vendorWatch", hash: "#vendor-watch" },
      { key: "industryTemplates", hash: "#industry-templates" },
      { key: "afterQuickstart", hash: "#after-quickstart" },
    ],
  },
  {
    href: "/privacy/docs/data-inventory",
    key: "dataInventory",
    icon: Database,
    children: [
      { key: "assets", hash: "#assets" },
      { key: "elements", hash: "#data-elements" },
      { key: "activities", hash: "#processing-activities" },
      { key: "flows", hash: "#data-flows" },
      { key: "transfers", hash: "#transfers" },
    ],
  },
  {
    href: "/privacy/docs/dsar",
    key: "dsar",
    icon: FileText,
    children: [
      { key: "creating", hash: "#creating" },
      { key: "tasks", hash: "#tasks" },
      { key: "sla", hash: "#sla" },
      { key: "portal", hash: "#portal" },
      { key: "intakeConfig", hash: "#intake-config" },
    ],
  },
  {
    href: "/privacy/docs/assessments",
    key: "assessments",
    icon: ClipboardCheck,
    children: [
      { key: "templates", hash: "#templates" },
      { key: "creating", hash: "#creating" },
      { key: "riskScoring", hash: "#risk-scoring" },
      { key: "mitigations", hash: "#mitigations" },
      { key: "approvals", hash: "#approvals" },
    ],
  },
  {
    href: "/privacy/docs/incidents",
    key: "incidents",
    icon: AlertTriangle,
    children: [
      { key: "reporting", hash: "#reporting" },
      { key: "timeline", hash: "#timeline" },
      { key: "notifications", hash: "#notifications" },
      { key: "tasks", hash: "#tasks" },
    ],
  },
  {
    href: "/privacy/docs/vendors",
    key: "vendors",
    icon: Building2,
    children: [
      { key: "adding", hash: "#adding" },
      { key: "contracts", hash: "#contracts" },
      { key: "questionnaires", hash: "#questionnaires" },
      { key: "riskReviews", hash: "#risk-reviews" },
    ],
  },
  {
    href: "/privacy/docs/experts",
    key: "experts",
    icon: Search,
    children: [
      { key: "personas", hash: "#personas" },
      { key: "directory", hash: "#expert-directory" },
      { key: "allClients", hash: "#all-clients" },
      { key: "settings", hash: "#settings" },
    ],
  },
  {
    href: "/privacy/docs/reports",
    key: "reports",
    icon: BarChart3,
    children: [
      { key: "score", hash: "#compliance-score" },
      { key: "modules", hash: "#module-breakdown" },
      { key: "risk", hash: "#risk-indicators" },
      { key: "snapshots", hash: "#snapshots" },
      { key: "executive", hash: "#executive-report" },
    ],
  },
  {
    href: "/privacy/docs/dpia-auto-fill",
    key: "dpiaAutoFill",
    icon: Wand2,
    children: [
      { key: "overview", hash: "#overview" },
      { key: "steps", hash: "#wizard-steps" },
      { key: "sources", hash: "#auto-fill-sources" },
      { key: "confidence", hash: "#confidence-levels" },
      { key: "ai", hash: "#ai-integration" },
    ],
  },
  {
    href: "/privacy/docs/transfer-compliance",
    key: "transferCompliance",
    icon: ArrowRightLeft,
    children: [
      { key: "overview", hash: "#overview" },
      { key: "complianceStatus", hash: "#compliance-status" },
      { key: "schremsIi", hash: "#schrems-ii" },
      { key: "adequacy", hash: "#adequacy" },
      { key: "supplementaryMeasures", hash: "#supplementary-measures" },
      { key: "sccTracking", hash: "#scc-tracking" },
    ],
  },
  {
    href: "/privacy/docs/regulations",
    key: "regulations",
    icon: Globe,
    children: [
      { key: "catalog", hash: "#catalog" },
      { key: "applicability", hash: "#applicability" },
      { key: "categories", hash: "#categories" },
      { key: "managing", hash: "#managing" },
      { key: "impact", hash: "#impact" },
    ],
  },
  {
    href: "/privacy/docs/ai-governance",
    key: "aiGovernance",
    icon: Bot,
    children: [
      { key: "overview", hash: "#overview" },
      { key: "riskLevels", hash: "#risk-levels" },
      { key: "registration", hash: "#registration" },
      { key: "suggestion", hash: "#risk-suggestion" },
      { key: "obligations", hash: "#obligations" },
      { key: "linking", hash: "#linking" },
      { key: "sentinel", hash: "#ai-sentinel" },
    ],
  },
  {
    href: "/privacy/docs/premium",
    key: "premium",
    icon: Sparkles,
    premium: true,
    children: [
      { key: "dpia", hash: "#dpia" },
      { key: "pia", hash: "#pia" },
      { key: "tia", hash: "#tia" },
      { key: "vendorRisk", hash: "#vendor-risk" },
      { key: "vendorCatalog", hash: "#vendor-catalog" },
    ],
  },
];

// The rights-request guide is left out when the module is not part of this
// plan (NEXT_PUBLIC_DSAR_ENABLED=false, src/config/features.ts).
const tocSections: TocSection[] = isDsarModuleEnabled()
  ? allTocSections
  : allTocSections.filter((s) => s.href !== "/privacy/docs/dsar");

export function TocSidebar() {
  const t = useTranslations("docs.toc");
  const pathname = usePathname();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => {
      const active = tocSections.find(
        (s) => pathname === s.href || (s.href !== "/privacy/docs" && pathname.startsWith(s.href))
      );
      return new Set(active ? [active.href] : ["/privacy/docs"]);
    }
  );

  function toggleSection(href: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(href)) {
        next.delete(href);
      } else {
        next.add(href);
      }
      return next;
    });
  }

  function isActive(href: string) {
    if (href === "/privacy/docs") return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <nav className="space-y-1">
      {tocSections.map((section) => {
        const Icon = section.icon;
        const active = isActive(section.href);
        const expanded = expandedSections.has(section.href);

        return (
          <div key={section.href}>
            <div className="flex items-center">
              <Link
                href={section.href}
                className={cn(
                  "flex-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{t(`${section.key}.label`)}</span>
                {section.premium && <PremiumBadge />}
              </Link>
              {section.children && (
                <button
                  onClick={() => toggleSection(section.href)}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <ChevronRight
                    className={cn(
                      "h-3.5 w-3.5 transition-transform",
                      expanded && "rotate-90"
                    )}
                  />
                </button>
              )}
            </div>
            {section.children && expanded && (
              <div className="ml-4 pl-4 border-l border-border space-y-0.5 mt-0.5 mb-1">
                {section.children.map((child) => (
                  <Link
                    key={child.hash}
                    href={`${section.href}${child.hash}`}
                    className="block text-xs text-muted-foreground hover:text-foreground py-1 px-2 rounded-md hover:bg-muted transition-colors"
                  >
                    {t(`${section.key}.items.${child.key}`)}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
