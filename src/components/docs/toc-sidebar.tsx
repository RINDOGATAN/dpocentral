"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { BookOpen, Database, FileText, AlertTriangle, Building2, ChevronRight } from "lucide-react";
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
  children?: TocChild[];
}

const allTocSections: TocSection[] = [
  {
    href: "/privacy/docs",
    key: "gettingStarted",
    icon: BookOpen,
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
      { key: "riskReviews", hash: "#risk-reviews" },
    ],
  },
];

// The rights-request guide is left out when the module is not part of this
// build (NEXT_PUBLIC_DSAR_ENABLED=false, src/config/features.ts).
const tocSections: TocSection[] = allTocSections.filter(
  (s) => isDsarModuleEnabled() || s.href !== "/privacy/docs/dsar",
);

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
