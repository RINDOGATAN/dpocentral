"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  BookOpen,
  Database,
  FileText,
  ClipboardCheck,
  AlertTriangle,
  Building2,
} from "lucide-react";

const sections = [
  {
    key: "gettingStarted",
    href: "/docs",
    icon: BookOpen,
  },
  {
    key: "dataInventory",
    href: "/docs/data-inventory",
    icon: Database,
  },
  {
    key: "dsar",
    href: "/docs/dsar",
    icon: FileText,
  },
  {
    key: "assessments",
    href: "/docs/assessments",
    icon: ClipboardCheck,
  },
  {
    key: "incidents",
    href: "/docs/incidents",
    icon: AlertTriangle,
  },
  {
    key: "vendors",
    href: "/docs/vendors",
    icon: Building2,
  },
] as const;

export function DocsNav() {
  const pathname = usePathname();
  const t = useTranslations("docs.nav");

  return (
    <nav className="space-y-1">
      <p className="text-xs font-display uppercase tracking-wider text-muted-foreground mb-4">
        {t("heading")}
      </p>
      {sections.map((section) => {
        const Icon = section.icon;
        const isActive =
          pathname === section.href ||
          (section.href !== "/docs" && pathname.startsWith(section.href));

        return (
          <Link
            key={section.href}
            href={section.href}
            className={`flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
              isActive
                ? "text-primary bg-primary/10 border-l-2 border-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {t(section.key)}
          </Link>
        );
      })}
    </nav>
  );
}
