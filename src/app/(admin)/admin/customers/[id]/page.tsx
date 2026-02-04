"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Building2,
  Key,
  Trash2,
  RefreshCw,
  Pause,
  X,
  Search,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { LicenseType } from "@prisma/client";

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;

  const [showAddEntitlement, setShowAddEntitlement] = useState(false);
  const [showLinkOrg, setShowLinkOrg] = useState(false);
  const [orgSearch, setOrgSearch] = useState("");
  const [newEntitlement, setNewEntitlement] = useState({
    skillPackageId: "",
    licenseType: "SUBSCRIPTION" as LicenseType,
  });

  const utils = trpc.useUtils();

  const { data: customer, isLoading } = trpc.platformAdmin.getCustomer.useQuery(
    { id: customerId }
  );

  const { data: skillPackages } = trpc.platformAdmin.listSkillPackages.useQuery();

  const { data: searchedOrgs } = trpc.platformAdmin.searchOrganizations.useQuery(
    { search: orgSearch },
    { enabled: showLinkOrg && orgSearch.length > 0 }
  );

  const createEntitlement = trpc.platformAdmin.createEntitlement.useMutation({
    onSuccess: () => {
      utils.platformAdmin.getCustomer.invalidate({ id: customerId });
      utils.platformAdmin.getDashboardStats.invalidate();
      setShowAddEntitlement(false);
      setNewEntitlement({ skillPackageId: "", licenseType: "SUBSCRIPTION" });
    },
  });

  const suspendEntitlement = trpc.platformAdmin.suspendEntitlement.useMutation({
    onSuccess: () => {
      utils.platformAdmin.getCustomer.invalidate({ id: customerId });
      utils.platformAdmin.getDashboardStats.invalidate();
    },
  });

  const reactivateEntitlement = trpc.platformAdmin.reactivateEntitlement.useMutation({
    onSuccess: () => {
      utils.platformAdmin.getCustomer.invalidate({ id: customerId });
      utils.platformAdmin.getDashboardStats.invalidate();
    },
  });

  const deleteEntitlement = trpc.platformAdmin.deleteEntitlement.useMutation({
    onSuccess: () => {
      utils.platformAdmin.getCustomer.invalidate({ id: customerId });
      utils.platformAdmin.getDashboardStats.invalidate();
    },
  });

  const linkOrganization = trpc.platformAdmin.linkOrganization.useMutation({
    onSuccess: () => {
      utils.platformAdmin.getCustomer.invalidate({ id: customerId });
      setShowLinkOrg(false);
      setOrgSearch("");
    },
  });

  const unlinkOrganization = trpc.platformAdmin.unlinkOrganization.useMutation({
    onSuccess: () => {
      utils.platformAdmin.getCustomer.invalidate({ id: customerId });
    },
  });

  const handleAddEntitlement = (e: React.FormEvent) => {
    e.preventDefault();
    createEntitlement.mutate({
      customerId,
      skillPackageId: newEntitlement.skillPackageId,
      licenseType: newEntitlement.licenseType,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold">Customer not found</h2>
        <Link href="/admin/customers" className="mt-4 inline-block">
          <Button variant="outline">Back to Customers</Button>
        </Link>
      </div>
    );
  }

  // Get skill packages that don't have entitlements yet
  const availableSkillPackages = skillPackages?.filter(
    (sp) => !customer.entitlements.some((e) => e.skillPackageId === sp.id)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/customers">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">{customer.name}</h1>
          <p className="text-muted-foreground">{customer.email}</p>
        </div>
        <Badge variant="outline" className="ml-2">
          {customer.type}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Linked Organizations */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Linked Organizations</CardTitle>
                <CardDescription>
                  Organizations using this customer's licenses
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => setShowLinkOrg(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Link Org
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {showLinkOrg && (
              <div className="mb-4 p-4 border rounded-lg bg-muted/50">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search organizations..."
                    value={orgSearch}
                    onChange={(e) => setOrgSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {searchedOrgs && searchedOrgs.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {searchedOrgs.map((org) => (
                      <div
                        key={org.id}
                        className="flex items-center justify-between p-2 rounded hover:bg-background"
                      >
                        <div>
                          <p className="font-medium text-sm">{org.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {org.slug} - {org._count.members} members
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            linkOrganization.mutate({
                              customerId,
                              organizationId: org.id,
                            })
                          }
                          disabled={linkOrganization.isPending}
                        >
                          Link
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    setShowLinkOrg(false);
                    setOrgSearch("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            )}

            {customer.organizations.length > 0 ? (
              <div className="space-y-2">
                {customer.organizations.map((link) => (
                  <div
                    key={link.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Building2 className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{link.organization.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {link.organization.slug}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        unlinkOrganization.mutate({
                          customerId,
                          organizationId: link.organizationId,
                        })
                      }
                      disabled={unlinkOrganization.isPending}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No organizations linked yet
              </p>
            )}
          </CardContent>
        </Card>

        {/* Entitlements */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Skill Entitlements</CardTitle>
                <CardDescription>
                  Premium features enabled for this customer
                </CardDescription>
              </div>
              {availableSkillPackages && availableSkillPackages.length > 0 && (
                <Button size="sm" onClick={() => setShowAddEntitlement(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Skill
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {showAddEntitlement && (
              <form
                onSubmit={handleAddEntitlement}
                className="mb-4 p-4 border rounded-lg bg-muted/50 space-y-4"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Skill Package</label>
                    <Select
                      value={newEntitlement.skillPackageId}
                      onValueChange={(value) =>
                        setNewEntitlement({
                          ...newEntitlement,
                          skillPackageId: value,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select skill..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSkillPackages?.map((sp) => (
                          <SelectItem key={sp.id} value={sp.id}>
                            {sp.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">License Type</label>
                    <Select
                      value={newEntitlement.licenseType}
                      onValueChange={(value) =>
                        setNewEntitlement({
                          ...newEntitlement,
                          licenseType: value as LicenseType,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TRIAL">Trial</SelectItem>
                        <SelectItem value="SUBSCRIPTION">Subscription</SelectItem>
                        <SelectItem value="PERPETUAL">Perpetual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {createEntitlement.error && (
                  <p className="text-sm text-destructive">
                    {createEntitlement.error.message}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={
                      createEntitlement.isPending || !newEntitlement.skillPackageId
                    }
                  >
                    {createEntitlement.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      "Add Entitlement"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddEntitlement(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}

            {customer.entitlements.length > 0 ? (
              <div className="space-y-2">
                {customer.entitlements.map((entitlement) => (
                  <div
                    key={entitlement.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Key className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">
                            {entitlement.skillPackage.displayName}
                          </p>
                          <Badge
                            variant={
                              entitlement.status === "ACTIVE"
                                ? "default"
                                : entitlement.status === "SUSPENDED"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {entitlement.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {entitlement.licenseType} license
                          {entitlement.expiresAt &&
                            ` - Expires ${new Date(entitlement.expiresAt).toLocaleDateString()}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {entitlement.status === "ACTIVE" ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Suspend"
                          onClick={() =>
                            suspendEntitlement.mutate({
                              entitlementId: entitlement.id,
                            })
                          }
                          disabled={suspendEntitlement.isPending}
                        >
                          <Pause className="w-4 h-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Reactivate"
                          onClick={() =>
                            reactivateEntitlement.mutate({
                              entitlementId: entitlement.id,
                            })
                          }
                          disabled={reactivateEntitlement.isPending}
                        >
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete"
                        onClick={() =>
                          deleteEntitlement.mutate({
                            entitlementId: entitlement.id,
                          })
                        }
                        disabled={deleteEntitlement.isPending}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No entitlements yet
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
