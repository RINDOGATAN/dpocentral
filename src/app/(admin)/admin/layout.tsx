"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { redirect } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Package,
  LogOut,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

const adminNavItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/skills", label: "Skill Packages", icon: Package },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  // Check if user is platform admin
  const { data: adminCheck, isLoading: adminCheckLoading } =
    trpc.platformAdmin.isAdmin.useQuery(undefined, {
      enabled: status === "authenticated",
    });

  // Skip auth check for sign-in page
  const isSignInPage = pathname === "/admin/sign-in";

  if (isSignInPage) {
    return <>{children}</>;
  }

  if (status === "loading" || adminCheckLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    redirect("/admin/sign-in");
  }

  if (!adminCheck?.isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Shield className="w-16 h-16 mx-auto text-muted-foreground" />
          <h1 className="text-2xl font-semibold">Access Denied</h1>
          <p className="text-muted-foreground">
            You do not have platform admin privileges.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/privacy">
              <Button variant="outline">Go to Dashboard</Button>
            </Link>
            <Button
              variant="ghost"
              onClick={() => signOut({ callbackUrl: "/sign-in" })}
            >
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              <span className="font-semibold">DPO Central Admin</span>
            </Link>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {adminNavItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/admin" && pathname.startsWith(item.href));

                return (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`gap-2 ${
                        isActive
                          ? "bg-primary/20 text-primary hover:bg-primary/30 hover:text-primary"
                          : ""
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </Button>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {session?.user?.email}
            </span>
            <Link href="/privacy">
              <Button variant="outline" size="sm">
                Exit Admin
              </Button>
            </Link>
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
      <main className="max-w-[1600px] mx-auto px-6 py-6">{children}</main>

      {/* Footer */}
      <footer className="border-t border-border mt-auto py-4">
        <div className="max-w-[1600px] mx-auto px-6 text-center text-xs text-muted-foreground">
          <p>DPO Central Platform Administration - North End Law</p>
        </div>
      </footer>
    </div>
  );
}
