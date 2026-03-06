"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, Building2, Key, Package, UserPlus, CreditCard, ScrollText } from "lucide-react";
import { trpc } from "@/lib/trpc";
import Link from "next/link";
import { Button } from "@/components/ui/button";

function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString();
}

export default function AdminDashboardPage() {
  const { data: stats, isLoading: statsLoading } = trpc.platformAdmin.getDashboardStats.useQuery();
  const { data: activity, isLoading: activityLoading } = trpc.platformAdmin.getRecentActivity.useQuery();

  const isLoading = statsLoading || activityLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Platform Dashboard</h1>
        <p className="text-muted-foreground">
          Manage customers, entitlements, and skill packages
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalCustomers ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Organizations</CardTitle>
            <Building2 className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalOrganizations ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Entitlements</CardTitle>
            <Key className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalEntitlements ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Licenses</CardTitle>
            <Package className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeEntitlements ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">New Users (7d)</CardTitle>
            <UserPlus className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activity?.newUsers7d ?? 0}</div>
            <p className="text-xs text-muted-foreground">{activity?.newUsers30d ?? 0} in 30d</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Subs</CardTitle>
            <CreditCard className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activity?.activeSubscriptions ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Entitlement Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Entitlements by Status</CardTitle>
            <CardDescription>Current license status distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(stats?.entitlementsByStatus ?? {}).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        status === "ACTIVE"
                          ? "default"
                          : status === "SUSPENDED"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {status}
                    </Badge>
                  </div>
                  <span className="font-medium">{count as number}</span>
                </div>
              ))}
              {Object.keys(stats?.entitlementsByStatus ?? {}).length === 0 && (
                <p className="text-sm text-muted-foreground">No entitlements yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/admin/customers" className="block">
              <Button variant="outline" className="w-full justify-start gap-2">
                <Users className="w-4 h-4" />
                Manage Customers
              </Button>
            </Link>
            <Link href="/admin/skills" className="block">
              <Button variant="outline" className="w-full justify-start gap-2">
                <Package className="w-4 h-4" />
                View Skill Packages
              </Button>
            </Link>
            <Link href="/admin/organizations" className="block">
              <Button variant="outline" className="w-full justify-start gap-2">
                <Building2 className="w-4 h-4" />
                Browse Organizations
              </Button>
            </Link>
            <Link href="/admin/users" className="block">
              <Button variant="outline" className="w-full justify-start gap-2">
                <UserPlus className="w-4 h-4" />
                Browse Users
              </Button>
            </Link>
            <Link href="/admin/audit-logs" className="block">
              <Button variant="outline" className="w-full justify-start gap-2">
                <ScrollText className="w-4 h-4" />
                View Audit Logs
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest platform-wide actions</CardDescription>
          </div>
          <Link href="/admin/audit-logs">
            <Button variant="outline" size="sm">View All Audit Logs</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {activity?.recentLogs && activity.recentLogs.length > 0 ? (
            <div className="space-y-2">
              {activity.recentLogs.slice(0, 10).map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-2 text-sm border rounded"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge
                      variant={
                        log.action === "CREATE"
                          ? "default"
                          : log.action === "DELETE"
                          ? "destructive"
                          : "secondary"
                      }
                      className="text-xs shrink-0"
                    >
                      {log.action}
                    </Badge>
                    <span className="truncate">{log.entityType}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                    <span>{log.user?.name || log.user?.email || "System"}</span>
                    {log.organization && (
                      <span className="hidden sm:inline">{log.organization.name}</span>
                    )}
                    <span>{formatRelativeTime(log.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No recent activity
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
