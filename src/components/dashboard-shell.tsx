"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import {
  Database,
  FileText,
  ClipboardCheck,
  AlertTriangle,
  Building2,
  LogOut,
  User,
  Menu,
  BookOpen,
  CreditCard,
  Scale,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useOrganization } from "@/lib/organization-context";
import { OrganizationSetup } from "@/components/privacy/organization-setup";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { features } from "@/config/features";

const navItems = [
  { href: "/privacy/data-inventory", label: "Data Inventory", icon: Database },
  { href: "/privacy/dsar", label: "DSAR", icon: FileText },
  { href: "/privacy/assessments", label: "Assessments", icon: ClipboardCheck },
  { href: "/privacy/incidents", label: "Incidents", icon: AlertTriangle },
  { href: "/privacy/vendors", label: "Vendors", icon: Building2 },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const { organization, organizations, isLoading: orgLoading } = useOrganization();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (orgLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Show organization setup if user has no organizations
  if (!organization && organizations.length === 0) {
    return <OrganizationSetup />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            {/* Mobile Menu Button */}
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden shrink-0">
                  <Menu className="w-5 h-5" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] sm:w-[320px]">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <span className="text-lg font-bold tracking-tight">DPO CENTRAL</span>
                  </SheetTitle>
                </SheetHeader>
                <nav className="mt-6 flex flex-col gap-1">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href ||
                      (item.href !== "/privacy" && pathname.startsWith(item.href));

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileNavOpen(false)}
                      >
                        <Button
                          variant="ghost"
                          className={`w-full justify-start gap-3 h-12 text-base ${
                            isActive ? "bg-primary/20 text-primary hover:bg-primary/30 hover:text-primary" : ""
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                          {item.label}
                        </Button>
                      </Link>
                    );
                  })}
                </nav>
              </SheetContent>
            </Sheet>

            <Link href="/privacy" className="flex items-center shrink-0 text-lg font-bold tracking-tight">
              DPO CENTRAL
            </Link>

          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href ||
                (item.href !== "/privacy" && pathname.startsWith(item.href));

              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`gap-2 ${isActive ? "bg-primary/20 text-primary hover:bg-primary/30 hover:text-primary" : ""}`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden lg:inline">{item.label}</span>
                  </Button>
                </Link>
              );
            })}
          </nav>

          {/* Right side actions */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <LanguageSwitcher />
            <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
              <User className="w-4 h-4" />
              <span className="hidden lg:inline max-w-[150px] truncate">{session?.user?.email}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => signOut({ callbackUrl: "/sign-in" })}
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-auto py-4">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 text-center text-xs text-muted-foreground space-y-1">
          <p>DPO CENTRAL is a <a href="https://todo.law" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">TODO.LAW</a> service.</p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/privacy/docs" className="flex items-center gap-1.5 hover:text-foreground transition-colors">
              <BookOpen className="w-3.5 h-3.5" />
              User Guide
            </Link>
            {features.selfServiceUpgrade && (
              <>
                <span className="text-border">&middot;</span>
                <Link href="/privacy/billing" className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                  <CreditCard className="w-3.5 h-3.5" />
                  Billing
                </Link>
              </>
            )}
            <span className="text-border">&middot;</span>
            <a href="https://todo.law/terms" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-foreground transition-colors">
              <Scale className="w-3.5 h-3.5" />
              Terms of Service
            </a>
            <span className="text-border">&middot;</span>
            <a href="https://todo.law/privacy" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-foreground transition-colors">
              <Shield className="w-3.5 h-3.5" />
              Privacy Policy
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
