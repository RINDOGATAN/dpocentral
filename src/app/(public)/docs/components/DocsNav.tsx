"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
    title: "Getting Started",
    href: "/docs",
    icon: BookOpen,
  },
  {
    title: "Data Inventory",
    href: "/docs/data-inventory",
    icon: Database,
  },
  {
    title: "DSAR Management",
    href: "/docs/dsar",
    icon: FileText,
  },
  {
    title: "Assessments",
    href: "/docs/assessments",
    icon: ClipboardCheck,
  },
  {
    title: "Incidents",
    href: "/docs/incidents",
    icon: AlertTriangle,
  },
  {
    title: "Vendor Management",
    href: "/docs/vendors",
    icon: Building2,
  },
];

export function DocsNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      <p className="text-xs font-display uppercase tracking-wider text-muted-foreground mb-4">
        Documentation
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
            {section.title}
          </Link>
        );
      })}
    </nav>
  );
}
