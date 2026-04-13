"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Pencil,
  Save,
  X,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function OrganizationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.id as string;

  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editDomain, setEditDomain] = useState("");

  const utils = trpc.useUtils();

  const { data: org, isLoading } = trpc.platformAdmin.getOrganization.useQuery(
    { id: orgId }
  );

  const deleteMutation = trpc.platformAdmin.deleteOrganization.useMutation({
    onSuccess: (result) => {
      toast.success(`Deleted "${result.name}"`);
      utils.platformAdmin.listOrganizations.invalidate();
      router.push("/admin/organizations");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const updateMutation = trpc.platformAdmin.updateOrganization.useMutation({
    onSuccess: () => {
      toast.success("Organization updated");
      setEditing(false);
      utils.platformAdmin.getOrganization.invalidate({ id: orgId });
      utils.platformAdmin.listOrganizations.invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  useEffect(() => {
    if (org) {
      setEditName(org.name);
      setEditSlug(org.slug);
      setEditDomain(org.domain || "");
    }
  }, [org]);

  function handleSave() {
    if (!org) return;
    const changes: Record<string, string | null | undefined> = {};
    if (editName !== org.name) changes.name = editName;
    if (editSlug !== org.slug) changes.slug = editSlug;
    if (editDomain !== (org.domain || ""))
      changes.domain = editDomain || null;

    if (Object.keys(changes).length === 0) {
      setEditing(false);
      return;
    }
    updateMutation.mutate({ id: orgId, ...changes });
  }

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
      <div className="flex items-center justify-between">
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
        {!editing && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="w-4 h-4 mr-2" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Org Info */}
          <Card>
            <CardHeader>
              <CardTitle>Organization Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {editing ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="org-name">Name</Label>
                    <Input
                      id="org-name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="org-slug">Slug</Label>
                    <Input
                      id="org-slug"
                      value={editSlug}
                      onChange={(e) =>
                        setEditSlug(
                          e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
                        )
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Lowercase letters, numbers, and hyphens only
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="org-domain">Domain</Label>
                    <Input
                      id="org-domain"
                      value={editDomain}
                      onChange={(e) => setEditDomain(e.target.value)}
                      placeholder="example.com"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      onClick={handleSave}
                      disabled={updateMutation.isPending || !editName || !editSlug}
                    >
                      {updateMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      Save
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditing(false);
                        setEditName(org.name);
                        setEditSlug(org.slug);
                        setEditDomain(org.domain || "");
                      }}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
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
                </div>
              )}
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Delete Organization
            </DialogTitle>
            <DialogDescription>
              This permanently deletes <strong>{org.name}</strong> and cascades to every member,
              data asset, processing activity, DSAR, incident, vendor, and assessment owned by
              this organization. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm text-muted-foreground space-y-1 py-2">
            <div>{org._count?.members ?? 0} member(s) will lose access immediately.</div>
            <div>{org._count?.dataAssets ?? 0} data asset(s), {org._count?.dsarRequests ?? 0} DSAR(s), {org._count?.incidents ?? 0} incident(s), {org._count?.vendors ?? 0} vendor(s) will be deleted.</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate({ id: orgId })}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
