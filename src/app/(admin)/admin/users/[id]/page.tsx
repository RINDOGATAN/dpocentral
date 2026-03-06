"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function UserDetailPage() {
  const params = useParams();
  const userId = params.id as string;

  const utils = trpc.useUtils();

  const { data: user, isLoading } = trpc.platformAdmin.getUser.useQuery(
    { id: userId }
  );

  const updateUser = trpc.platformAdmin.updateUser.useMutation({
    onSuccess: () => {
      utils.platformAdmin.getUser.invalidate({ id: userId });
      utils.platformAdmin.listUsers.invalidate();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold">User not found</h2>
        <Link href="/admin/users" className="mt-4 inline-block">
          <Button variant="outline">Back to Users</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/users">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">{user.name || "Unnamed User"}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-muted-foreground">{user.email}</span>
            {user.userType && <Badge variant="secondary">{user.userType}</Badge>}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column */}
        <div className="space-y-6">
          {/* User Info */}
          <Card>
            <CardHeader>
              <CardTitle>User Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ID</span>
                  <code className="text-xs">{user.id}</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span>{user.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Verified</span>
                  <span>{user.emailVerified ? new Date(user.emailVerified).toLocaleDateString() : "No"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span>{new Date(user.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="pt-2 border-t space-y-2">
                <label className="text-sm font-medium">User Type</label>
                <Select
                  value={user.userType || "__none__"}
                  onValueChange={(value) =>
                    updateUser.mutate({
                      id: userId,
                      userType: value === "__none__" ? null : (value as "BUSINESS_OWNER" | "PRIVACY_PROFESSIONAL"),
                    })
                  }
                  disabled={updateUser.isPending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Not set" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Not set</SelectItem>
                    <SelectItem value="BUSINESS_OWNER">Business Owner</SelectItem>
                    <SelectItem value="PRIVACY_PROFESSIONAL">Privacy Professional</SelectItem>
                  </SelectContent>
                </Select>
                {updateUser.error && (
                  <p className="text-sm text-destructive">{updateUser.error.message}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Organization Memberships */}
          <Card>
            <CardHeader>
              <CardTitle>Organization Memberships ({user.organizationMemberships.length})</CardTitle>
              <CardDescription>Organizations this user belongs to</CardDescription>
            </CardHeader>
            <CardContent>
              {user.organizationMemberships.length > 0 ? (
                <div className="space-y-2">
                  {user.organizationMemberships.map((membership) => (
                    <div
                      key={membership.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <Link
                          href={`/admin/organizations/${membership.organization.id}`}
                          className="font-medium hover:underline"
                        >
                          {membership.organization.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {membership.organization.slug}
                        </p>
                      </div>
                      <Badge variant="outline">{membership.role}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Not a member of any organization
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Last 20 actions by this user</CardDescription>
            </CardHeader>
            <CardContent>
              {user.recentLogs.length > 0 ? (
                <div className="space-y-2">
                  {user.recentLogs.map((log) => (
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
                        {log.organization && (
                          <Link
                            href={`/admin/organizations/${log.organization.id}`}
                            className="hover:underline"
                          >
                            {log.organization.name}
                          </Link>
                        )}
                        <span>{new Date(log.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No activity logged
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
