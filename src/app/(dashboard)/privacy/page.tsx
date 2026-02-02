"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Database,
  FileText,
  ClipboardCheck,
  AlertTriangle,
  Building2,
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";

export default function PrivacyDashboardPage() {
  const { organization } = useOrganization();

  const { data: stats, isLoading } = trpc.organization.getDashboardStats.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id }
  );

  const { data: dsarList } = trpc.dsar.list.useQuery(
    { organizationId: organization?.id ?? "", limit: 3 },
    { enabled: !!organization?.id }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const dashboardStats = {
    dataAssets: stats?.totalAssets ?? 0,
    processingActivities: stats?.totalActivities ?? 0,
    openDSARs: stats?.openDSARs ?? 0,
    overdueDSARs: stats?.overdueDSARs ?? 0,
    activeAssessments: stats?.activeAssessments ?? 0,
    openIncidents: stats?.openIncidents ?? 0,
    activeVendors: stats?.activeVendors ?? 0,
  };

  const recentActivity = stats?.recentAuditLogs ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Privacy Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your privacy program
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Inventory</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{dashboardStats.dataAssets}</div>
            <p className="text-xs text-muted-foreground">
              {dashboardStats.processingActivities} processing activities
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open DSARs</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{dashboardStats.openDSARs}</div>
            <p className="text-xs text-muted-foreground">
              {dashboardStats.overdueDSARs > 0 ? (
                <span className="bg-destructive/20 text-foreground px-1.5 py-0.5">{dashboardStats.overdueDSARs} overdue</span>
              ) : (
                "All on track"
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Assessments</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{dashboardStats.activeAssessments}</div>
            <p className="text-xs text-muted-foreground">
              In progress or pending review
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Incidents</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{dashboardStats.openIncidents}</div>
            <p className="text-xs text-muted-foreground">
              Active investigations
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* DSAR Queue */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>DSAR Queue</CardTitle>
                <CardDescription>Data subject access requests</CardDescription>
              </div>
              <Link href="/privacy/dsar">
                <Button variant="ghost" size="sm">
                  View all <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {dsarList?.requests && dsarList.requests.length > 0 ? (
              dsarList.requests.map((dsar) => (
                <div key={dsar.id} className="flex items-center gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium font-mono text-primary">{dsar.publicId}</span>
                      <Badge variant="outline">{dsar.type}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{dsar.requesterName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-muted-foreground">
                      <Clock className="inline h-3 w-3 mr-1" />
                      {dsar.slaStatus === "overdue"
                        ? <span className="text-foreground">Overdue</span>
                        : `${dsar.daysUntilDue ?? 0} days`
                      }
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No open DSARs</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest updates across your privacy program</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentActivity.length > 0 ? (
              recentActivity.slice(0, 4).map((activity) => (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className="mt-0.5 p-1.5 border border-muted-foreground text-muted-foreground">
                    <Clock className="h-3 w-3" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm">{activity.action} - {activity.entityType}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(activity.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/privacy/data-inventory/new">
              <Button variant="outline" className="w-full justify-start">
                <Database className="w-4 h-4 mr-2" />
                Add Data Asset
              </Button>
            </Link>
            <Link href="/privacy/dsar">
              <Button variant="outline" className="w-full justify-start">
                <FileText className="w-4 h-4 mr-2" />
                New DSAR Request
              </Button>
            </Link>
            <Link href="/privacy/incidents/new">
              <Button variant="outline" className="w-full justify-start">
                <AlertTriangle className="w-4 h-4 mr-2" />
                Report Incident
              </Button>
            </Link>
            <Link href="/privacy/vendors/new">
              <Button variant="outline" className="w-full justify-start">
                <Building2 className="w-4 h-4 mr-2" />
                Add Vendor
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Vendor Overview */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Vendors</CardTitle>
                <CardDescription>{dashboardStats.activeVendors} active vendors</CardDescription>
              </div>
              <Link href="/privacy/vendors">
                <Button variant="ghost" size="sm">
                  View all <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-center py-4 text-muted-foreground">
              <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Add vendors to track third-party risk</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
