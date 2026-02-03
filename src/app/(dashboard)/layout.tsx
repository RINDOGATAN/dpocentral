"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { redirect } from "next/navigation";
import { useState } from "react";
import {
  Shield,
  Database,
  FileText,
  ClipboardCheck,
  AlertTriangle,
  Building2,
  LogOut,
  User,
  Settings,
  LayoutDashboard,
  ChevronDown,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useOrganization } from "@/lib/organization-context";
import { OrganizationSetup } from "@/components/privacy/organization-setup";

const navItems = [
  { href: "/privacy", label: "Dashboard", icon: LayoutDashboard },
  { href: "/privacy/data-inventory", label: "Data Inventory", icon: Database },
  { href: "/privacy/dsar", label: "DSAR", icon: FileText },
  { href: "/privacy/assessments", label: "Assessments", icon: ClipboardCheck },
  { href: "/privacy/incidents", label: "Incidents", icon: AlertTriangle },
  { href: "/privacy/vendors", label: "Vendors", icon: Building2 },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const { organization, organizations, isLoading: orgLoading, setOrganization } = useOrganization();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (status === "loading" || orgLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    redirect("/sign-in");
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
                    <div className="w-8 h-8 bg-primary flex items-center justify-center">
                      <Shield className="w-5 h-5 text-primary-foreground" />
                    </div>
                    DPO Central
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
                {/* Mobile org selector */}
                {organizations.length > 1 && (
                  <div className="mt-6 pt-6 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-2 px-3">Organization</p>
                    <div className="space-y-1">
                      {organizations.map((org) => (
                        <Button
                          key={org.id}
                          variant="ghost"
                          className={`w-full justify-start gap-3 h-10 ${
                            org.id === organization?.id ? "bg-primary/10 text-primary" : ""
                          }`}
                          onClick={() => {
                            setOrganization(org);
                            setMobileNavOpen(false);
                          }}
                        >
                          <Building2 className="w-4 h-4" />
                          <span className="truncate">{org.name}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </SheetContent>
            </Sheet>

            <Link href="/privacy" className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 bg-primary flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-semibold text-lg hidden sm:inline">DPO Central</span>
            </Link>

            {/* Organization Selector - Desktop */}
            {organizations.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 hidden sm:flex max-w-[200px]">
                    <Building2 className="w-4 h-4 shrink-0" />
                    <span className="truncate">{organization?.name}</span>
                    <ChevronDown className="w-3 h-3 shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {organizations.map((org) => (
                    <DropdownMenuItem
                      key={org.id}
                      onClick={() => setOrganization(org)}
                      className={org.id === organization?.id ? "bg-primary/10" : ""}
                    >
                      {org.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
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
            <Button variant="ghost" size="icon" className="hidden sm:flex">
              <Settings className="w-4 h-4" />
            </Button>
            <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground border-l pl-3 ml-2">
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
          <p>DPO Central, a North End Law service</p>
          <div className="flex justify-center gap-4">
            <a href="https://northend.law/terms-of-use" target="_blank" rel="noopener noreferrer" className="hover:text-foreground underline">
              Terms of Use
            </a>
            <a href="https://northend.law/privacy-policy" target="_blank" rel="noopener noreferrer" className="hover:text-foreground underline">
              Privacy Policy
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
