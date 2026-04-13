"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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

interface TocChild {
  label: string;
  hash: string;
}

interface TocSection {
  href: string;
  label: string;
  icon: React.ElementType;
  premium?: boolean;
  children?: TocChild[];
}

const tocSections: TocSection[] = [
  {
    href: "/privacy/docs",
    label: "Getting Started",
    icon: BookOpen,
    children: [
      { label: "Dashboard Overview", hash: "#dashboard" },
      { label: "Quickstart Wizard", hash: "#quickstart" },
      { label: "Navigation", hash: "#navigation" },
      { label: "User Roles", hash: "#roles" },
      { label: "Quick Actions", hash: "#quick-actions" },
    ],
  },
  {
    href: "/privacy/docs/quickstart",
    label: "Quickstart",
    icon: Zap,
    children: [
      { label: "How It Works", hash: "#how-it-works" },
      { label: "Vendor.Watch Import", hash: "#vendor-watch" },
      { label: "Industry Templates", hash: "#industry-templates" },
      { label: "After Quickstart", hash: "#after-quickstart" },
    ],
  },
  {
    href: "/privacy/docs/data-inventory",
    label: "Data Inventory",
    icon: Database,
    children: [
      { label: "Assets", hash: "#assets" },
      { label: "Data Elements", hash: "#data-elements" },
      { label: "Processing Activities", hash: "#processing-activities" },
      { label: "Data Flows", hash: "#data-flows" },
      { label: "Cross-Border Transfers", hash: "#transfers" },
    ],
  },
  {
    href: "/privacy/docs/dsar",
    label: "DSAR Management",
    icon: FileText,
    children: [
      { label: "Creating Requests", hash: "#creating" },
      { label: "Task Management", hash: "#tasks" },
      { label: "SLA Tracking", hash: "#sla" },
      { label: "Public Portal", hash: "#portal" },
      { label: "Intake Form Config", hash: "#intake-config" },
    ],
  },
  {
    href: "/privacy/docs/assessments",
    label: "Assessments",
    icon: ClipboardCheck,
    children: [
      { label: "Templates", hash: "#templates" },
      { label: "Creating Assessments", hash: "#creating" },
      { label: "Risk Scoring", hash: "#risk-scoring" },
      { label: "Mitigations", hash: "#mitigations" },
      { label: "Approvals", hash: "#approvals" },
    ],
  },
  {
    href: "/privacy/docs/incidents",
    label: "Incidents",
    icon: AlertTriangle,
    children: [
      { label: "Reporting", hash: "#reporting" },
      { label: "Timeline", hash: "#timeline" },
      { label: "DPA Notifications", hash: "#notifications" },
      { label: "Response Tasks", hash: "#tasks" },
    ],
  },
  {
    href: "/privacy/docs/vendors",
    label: "Vendor Management",
    icon: Building2,
    children: [
      { label: "Adding Vendors", hash: "#adding" },
      { label: "Contracts", hash: "#contracts" },
      { label: "Questionnaires", hash: "#questionnaires" },
      { label: "Risk Reviews", hash: "#risk-reviews" },
    ],
  },
  {
    href: "/privacy/docs/experts",
    label: "Expert Help & Personas",
    icon: Search,
    children: [
      { label: "User Personas", hash: "#personas" },
      { label: "Expert Directory", hash: "#expert-directory" },
      { label: "Client Dashboard", hash: "#client-dashboard" },
      { label: "Settings", hash: "#settings" },
    ],
  },
  {
    href: "/privacy/docs/reports",
    label: "Compliance Reports",
    icon: BarChart3,
    children: [
      { label: "Compliance Score", hash: "#compliance-score" },
      { label: "Module Breakdown", hash: "#module-breakdown" },
      { label: "Risk Indicators", hash: "#risk-indicators" },
      { label: "Trend Tracking", hash: "#snapshots" },
      { label: "Board Reports", hash: "#board-reports" },
    ],
  },
  {
    href: "/privacy/docs/dpia-auto-fill",
    label: "DPIA Auto-Fill",
    icon: Wand2,
    children: [
      { label: "How It Works", hash: "#overview" },
      { label: "Wizard Steps", hash: "#wizard-steps" },
      { label: "Auto-Fill Sources", hash: "#auto-fill-sources" },
      { label: "Confidence Levels", hash: "#confidence-levels" },
      { label: "AI Enhancement", hash: "#ai-integration" },
    ],
  },
  {
    href: "/privacy/docs/transfer-compliance",
    label: "Transfer Compliance",
    icon: ArrowRightLeft,
    children: [
      { label: "Overview", hash: "#overview" },
      { label: "Compliance Status", hash: "#compliance-status" },
      { label: "Schrems II Checklist", hash: "#schrems-ii" },
      { label: "Adequacy Decisions", hash: "#adequacy" },
      { label: "Supplementary Measures", hash: "#supplementary-measures" },
      { label: "SCC Tracking", hash: "#scc-tracking" },
    ],
  },
  {
    href: "/privacy/docs/regulations",
    label: "Regulation Hub",
    icon: Globe,
    children: [
      { label: "Jurisdiction Catalog", hash: "#catalog" },
      { label: "Applicability Wizard", hash: "#applicability" },
      { label: "Categories", hash: "#categories" },
      { label: "Managing Jurisdictions", hash: "#managing" },
      { label: "System Impact", hash: "#impact" },
    ],
  },
  {
    href: "/privacy/docs/ai-governance",
    label: "AI Governance",
    icon: Bot,
    children: [
      { label: "Why AI Governance?", hash: "#overview" },
      { label: "Risk Classification", hash: "#risk-levels" },
      { label: "Registering Systems", hash: "#registration" },
      { label: "Risk Suggestion", hash: "#risk-suggestion" },
      { label: "Obligations", hash: "#obligations" },
      { label: "Module Integration", hash: "#linking" },
      { label: "AI Sentinel Integration", hash: "#ai-sentinel" },
    ],
  },
  {
    href: "/privacy/docs/premium",
    label: "Premium Features",
    icon: Sparkles,
    premium: true,
    children: [
      { label: "DPIA", hash: "#dpia" },
      { label: "PIA", hash: "#pia" },
      { label: "TIA", hash: "#tia" },
      { label: "Vendor Risk Assessment", hash: "#vendor-risk" },
      { label: "Vendor Catalog", hash: "#vendor-catalog" },
    ],
  },
];

export function TocSidebar() {
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
                <span className="truncate">{section.label}</span>
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
                    {child.label}
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
