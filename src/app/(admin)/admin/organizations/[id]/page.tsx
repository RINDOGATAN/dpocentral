"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Loader2,
  Users,
  Box,
  Activity,
  FileText,
  ShieldAlert,
  Store,
  ScrollText,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function OrganizationDetailPage() {
  const params = useParams();
  const orgId = params.id as string;

  const { data: org, isLoading } = trpc.platformAdmin.getOrganization.useQuery(
    { id: orgId }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold">Organization not found</h2>
        <Link href="/admin/organizations" className="mt-4 inline-block">
          <Button variant="outline">Back to Organizations</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/organizations">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">{org.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline">{org.slug}</Badge>
            {org.domain && <Badge variant="secondary">{org.domain}</Badge>}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Org Info */}
          <Card>
            <CardHeader>
              <CardTitle>Organization Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">ID</span>
                <code className="text-xs">{org.id}</code>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Slug</span>
                <span>{org.slug}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Domain</span>
                <span>{org.domain || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{new Date(org.createdAt).toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>

          {/* Members */}
          <Card>
            <CardHeader>
              <CardTitle>Members ({org.members.length})</CardTitle>
              <CardDescription>Organization team members</CardDescription>
            </CardHeader>
            <CardContent>
              {org.members.length > 0 ? (
                <div className="space-y-2">
                  {org.members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <Link
                          href={`/admin/users/${member.user.id}`}
                          className="font-medium hover:underline"
                        >
                          {member.user.name || "Unnamed"}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {member.user.email}
                        </p>
                      </div>
                      <Badge variant="outline">{member.role}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No members
                </p>
              )}
            </CardContent>
          </Card>

          {/* Linked Customer */}
          {org.customerLinks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Linked Customer</CardTitle>
              </CardHeader>
              <CardContent>
                {org.customerLinks.map((link) => (
                  <div
                    key={link.customer.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{link.customer.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {link.customer.email}
                      </p>
                    </div>
                    <Link href={`/admin/customers/${link.customer.id}`}>
                      <Button variant="outline" size="sm">View</Button>
                    </Link>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2 p-3 border rounded-lg">
                  <Box className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-lg font-bold">{org._count.dataAssets}</p>
                    <p className="text-xs text-muted-foreground">Assets</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 border rounded-lg">
                  <Activity className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-lg font-bold">{org._count.processingActivities}</p>
                    <p className="text-xs text-muted-foreground">Activities</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 border rounded-lg">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-lg font-bold">{org._count.dsarRequests}</p>
                    <p className="text-xs text-muted-foreground">DSARs</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 border rounded-lg">
                  <ScrollText className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-lg font-bold">{org._count.assessments}</p>
                    <p className="text-xs text-muted-foreground">Assessments</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 border rounded-lg">
                  <ShieldAlert className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-lg font-bold">{org._count.incidents}</p>
                    <p className="text-xs text-muted-foreground">Incidents</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 border rounded-lg">
                  <Store className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-lg font-bold">{org._count.vendors}</p>
                    <p className="text-xs text-muted-foreground">Vendors</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Audit Logs */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Audit Logs</CardTitle>
              <CardDescription>Last 20 actions in this organization</CardDescription>
            </CardHeader>
            <CardContent>
              {org.recentLogs.length > 0 ? (
                <div className="space-y-2">
                  {org.recentLogs.map((log) => (
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
                      <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                        <span>{log.user?.name || log.user?.email || "System"}</span>
                        <span>{new Date(log.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No audit logs
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
