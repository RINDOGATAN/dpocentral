"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The signed-in layout: a top bar (product name, organisation switcher,
 * sign-out), a left menu with one entry per module, the page, and a footer
 * with the source offer. On a phone the menu becomes a row that scrolls
 * sideways under the top bar.
 *
 * A person who belongs to no organisation yet sees the first-run screen,
 * which creates one.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  BookOpen,
  Database,
  FileText,
  Globe,
  History,
  LayoutDashboard,
  LogOut,
  Network,
  Plus,
  Settings,
  ShieldAlert,
  Truck,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { useOrganization } from "@/lib/organization-context";
import { OrganizationSetup } from "@/components/privacy/organization-setup";
import { NewOrganizationDialog } from "@/components/privacy/new-organization-dialog";
import { AccountLanguageSwitcher, AccountLocaleSync } from "@/components/account-locale";
import { BrandName } from "@/components/brand-mark";
import { isDsarModuleEnabled } from "@/config/features";
import { brand } from "@/config/brand";
import { signOutOfApp } from "@/lib/sign-out";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  /** A key under the "pages" namespace, or under "dashboard" for the overview. */
  label: string;
  icon: LucideIcon;
  /** Matched exactly instead of by prefix. */
  exact?: boolean;
}

function navItems(): NavItem[] {
  const items: NavItem[] = [
    { href: "/privacy", label: "overview", icon: LayoutDashboard, exact: true },
    { href: "/privacy/data-inventory", label: "dataInventory.title", icon: Database, exact: true },
    { href: "/privacy/data-inventory/processing-activities", label: "processingActivities.title", icon: FileText },
    { href: "/privacy/transfers", label: "transfers.list.title", icon: Globe },
    { href: "/privacy/data-map", label: "dataMap.title", icon: Network },
    { href: "/privacy/vendors", label: "vendors.title", icon: Truck },
  ];
  if (isDsarModuleEnabled()) {
    items.push({ href: "/privacy/dsar", label: "dsar.title", icon: UserCheck });
  }
  items.push(
    { href: "/privacy/incidents", label: "incidents.title", icon: ShieldAlert },
    { href: "/privacy/audit-trail", label: "auditTrail", icon: History },
    { href: "/privacy/settings", label: "settings.title", icon: Settings },
  );
  return items;
}

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { organization, organizations, isLoading } = useOrganization();
  const tCommon = useTranslations("common");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <AccountLocaleSync />
        <div className="text-muted-foreground">{tCommon("loading")}</div>
      </div>
    );
  }

  // First run: no organisation yet.
  if (!organization && organizations.length === 0) {
    return (
      <>
        <AccountLocaleSync />
        <OrganizationSetup />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AccountLocaleSync />
      <TopBar />
      <div className="flex flex-1 w-full max-w-[1600px] mx-auto">
        <SideMenu />
        <main className="flex-1 min-w-0 px-4 sm:px-6 py-6">{children}</main>
      </div>
      <DashboardFooter />
    </div>
  );
}

function useLabel() {
  const tPages = useTranslations("pages");
  const tDashboard = useTranslations("dashboard");
  const tAudit = useTranslations("auditTrail");
  return (item: NavItem) => {
    if (item.label === "overview") return tDashboard("overview");
    if (item.label === "auditTrail") return tAudit("title");
    return tPages(item.label as never);
  };
}

function TopBar() {
  const { organization, organizations, setOrganization } = useOrganization();
  const tNav = useTranslations("nav");
  const tOrg = useTranslations("organization");
  const tDash = useTranslations("pages.dashboard");
  const [newOrgOpen, setNewOrgOpen] = useState(false);
  const pathname = usePathname() ?? "/privacy";
  const label = useLabel();

  return (
    <header className="border-b border-border bg-card">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
        <Link href="/privacy" className="flex items-center gap-2 shrink-0">
          <BrandName />
        </Link>
        <div className="flex-1" />
        {organizations.length > 0 && (
          <label className="flex items-center gap-2 text-sm min-w-0">
            <span className="sr-only">{tOrg("switchOrg")}</span>
            <select
              className="h-9 max-w-[14rem] truncate rounded-md border border-input bg-background px-2 text-sm"
              value={organization?.id ?? ""}
              onChange={(e) => {
                const next = organizations.find((o) => o.id === e.target.value);
                if (next) setOrganization(next);
              }}
              data-testid="organization-switcher"
            >
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="button"
          onClick={() => setNewOrgOpen(true)}
          className="inline-flex items-center gap-1 rounded-md px-2 h-9 text-sm text-muted-foreground hover:text-foreground"
          title={tDash("newOrgDialog.title")}
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline">{tDash("newOrgDialog.title")}</span>
        </button>
        <button
          type="button"
          onClick={() => void signOutOfApp()}
          className="inline-flex items-center gap-1 rounded-md px-2 h-9 text-sm text-muted-foreground hover:text-foreground"
          data-testid="sign-out"
        >
          <LogOut className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline">{tNav("signOut")}</span>
        </button>
      </div>
      {/* Phone: the menu as one row that scrolls sideways. */}
      <nav className="md:hidden border-t border-border overflow-x-auto" aria-label={tNav("openMenu")}>
        <ul className="flex gap-1 px-2 py-2 w-max">
          {navItems().map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "block whitespace-nowrap rounded-md px-3 py-1.5 text-sm",
                  isActive(pathname, item) ? "bg-primary/15 text-foreground" : "text-muted-foreground",
                )}
              >
                {label(item)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <NewOrganizationDialog open={newOrgOpen} onOpenChange={setNewOrgOpen} />
    </header>
  );
}

function SideMenu() {
  const pathname = usePathname() ?? "/privacy";
  const label = useLabel();
  const tFooter = useTranslations("footer");
  return (
    <aside className="hidden md:block w-60 shrink-0 border-r border-border py-6 px-3">
      <nav>
        <ul className="space-y-1">
          {navItems().map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                    active ? "bg-primary/15 text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{label(item)}</span>
                </Link>
              </li>
            );
          })}
          <li className="pt-4">
            <Link
              href="/privacy/docs"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <BookOpen className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{tFooter("userGuide")}</span>
            </Link>
          </li>
        </ul>
      </nav>
    </aside>
  );
}

/** The dashboard footer: the edition, the licence and source offer, the language. */
function DashboardFooter() {
  const tFooter = useTranslations("footer");
  return (
    <footer className="border-t border-border mt-auto py-4">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 text-center text-xs text-muted-foreground space-y-1">
        <p>
          {tFooter("communityEdition", { brandName: brand.name })} &middot; AGPL-3.0 &middot; &copy; Rindogatan LLC &middot;{" "}
          <Link href="/licenses" className="underline hover:text-foreground transition-colors">
            {tFooter("sourceAndLicence")}
          </Link>
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
          {brand.termsOfUseUrl && (
            <a href={brand.termsOfUseUrl} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
              {tFooter("termsOfService")}
            </a>
          )}
          {brand.privacyPolicyUrl && (
            <a href={brand.privacyPolicyUrl} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
              {tFooter("privacyPolicy")}
            </a>
          )}
          <AccountLanguageSwitcher />
        </div>
      </div>
    </footer>
  );
}
