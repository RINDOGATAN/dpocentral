"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Database,
  FileText,
  ClipboardCheck,
  AlertTriangle,
  Building2,
  ArrowRight,
  Clock,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Sparkles,
  Plus,
  Check,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { ExpertHelpCta } from "@/components/privacy/expert-help-cta";
import { DeploymentExpertCta } from "@/components/privacy/deployment-expert-cta";
import { toast } from "sonner";

export default function PrivacyDashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { organization, organizations, setOrganization, refetchOrganizations } = useOrganization();
  const [createOrgOpen, setCreateOrgOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const createOrg = trpc.organization.create.useMutation({
    onSuccess: (org) => {
      setOrganization(org);
      refetchOrganizations();
      setCreateOrgOpen(false);
      setNewOrgName("");
      toast.success(`Created "${org.name}"`);
    },
    onError: (err) => {
      toast.error(err.message);
    },
    onSettled: () => setIsCreating(false),
  });

  const generateSlug = (text: string) =>
    text.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  const handleCreateOrg = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    setIsCreating(true);
    createOrg.mutate({ name: newOrgName.trim(), slug: generateSlug(newOrgName) });
  };

  const { data: stats, isLoading } = trpc.organization.getDashboardStats.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id }
  );

  const { data: dsarList } = trpc.dsar.list.useQuery(
    { organizationId: organization?.id ?? "", limit: 3 },
    { enabled: !!organization?.id }
  );

  const { data: vendorList } = trpc.vendor.list.useQuery(
    { organizationId: organization?.id ?? "", limit: 3 },
    { enabled: !!organization?.id }
  );

  // Show quickstart card for orgs that haven't built out their privacy program yet
  const showQuickstart = !isLoading &&
    (stats?.totalAssets ?? 0) <= 5 &&
    (stats?.totalActivities ?? 0) <= 3 &&
    (stats?.activeVendors ?? 0) <= 3;

  // Auto-redirect brand-new orgs (all zeros) straight to quickstart
  const isEmptyOrg = !isLoading &&
    (stats?.totalAssets ?? 0) === 0 &&
    (stats?.totalActivities ?? 0) === 0 &&
    (stats?.activeVendors ?? 0) === 0;
  const fromQuickstart = searchParams.get("from") === "quickstart";

  useEffect(() => {
    if (isEmptyOrg && !fromQuickstart) {
      router.replace("/privacy/quickstart");
    }
  }, [isEmptyOrg, fromQuickstart, router]);

  const { data: portfolio } = trpc.quickstart.getPortfolio.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id && showQuickstart === true }
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
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">{organization?.name || "Privacy Dashboard"}</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Privacy Dashboard
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 shrink-0">
              <Building2 className="w-4 h-4" />
              <span className="hidden sm:inline">Switch</span>
              <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[240px]">
            {organizations.map((org) => (
              <DropdownMenuItem
                key={org.id}
                onClick={() => setOrganization(org)}
                className="flex items-center gap-2"
              >
                <span className="truncate flex-1">{org.name}</span>
                {org.id === organization?.id && (
                  <Check className="w-4 h-4 shrink-0 text-primary" />
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setCreateOrgOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              New Organization
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Quickstart Card — shown when org has few records */}
      {showQuickstart &&
        (portfolio?.hasPortfolio ? (
          /* VW portfolio detected — show tailored card */
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="p-4 sm:p-6 space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm sm:text-base">
                    Build your privacy program from your vendor portfolio
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    We found <strong>{portfolio.vendors.length} vendor{portfolio.vendors.length !== 1 ? "s" : ""}</strong> in
                    your Vendor.Watch portfolio. We can auto-generate data assets,
                    processing activities, and data flows — you&apos;ll be able to add
                    more later.
                  </p>
                </div>
                <Link href="/privacy/quickstart?from=vendorwatch">
                  <Button size="sm" className="shrink-0 gap-2">
                    <Sparkles className="w-4 h-4" />
                    <span>Build Now</span>
                  </Button>
                </Link>
              </div>
              <div className="flex flex-wrap gap-2 ml-0 sm:ml-12">
                {portfolio.vendors.slice(0, 5).map((v) => (
                  <Badge key={v!.slug} variant="secondary" className="text-xs">
                    {v!.name}
                  </Badge>
                ))}
                {portfolio.vendors.length > 5 && (
                  <Badge variant="outline" className="text-xs">
                    +{portfolio.vendors.length - 5} more
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          /* No VW portfolio — show generic quickstart card */
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm sm:text-base">
                  Get Started with Quickstart
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Bootstrap your privacy program in minutes. Import vendors from
                  the catalog or start from an industry template to auto-generate
                  data assets, processing activities, and data flows.
                </p>
              </div>
              <Link href="/privacy/quickstart">
                <Button size="sm" className="shrink-0 gap-2">
                  <Sparkles className="w-4 h-4" />
                  <span>Get Started</span>
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}

      <ExpertHelpCta context="general" />
      <DeploymentExpertCta />

      {/* Quick Stats - 2 columns on mobile, 4 on desktop */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Data Inventory</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold text-foreground">{dashboardStats.dataAssets}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {dashboardStats.processingActivities} activities
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Open DSARs</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold text-foreground">{dashboardStats.openDSARs}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {dashboardStats.overdueDSARs > 0 ? (
                <span className="text-amber-400/90 font-medium">{dashboardStats.overdueDSARs} overdue</span>
              ) : (
                "All on track"
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Assessments</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold text-foreground">{dashboardStats.activeAssessments}</div>
            <p className="text-xs text-muted-foreground mt-1">
              In progress
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Incidents</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold text-foreground">{dashboardStats.openIncidents}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Open cases
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        {/* DSAR Queue */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <CardTitle className="text-base sm:text-lg">DSAR Queue</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Data subject access requests</CardDescription>
              </div>
              <Link href="/privacy/dsar">
                <Button variant="ghost" size="sm" className="shrink-0">
                  <span className="hidden sm:inline">View all</span>
                  <ArrowRight className="sm:ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
            {dsarList?.requests && dsarList.requests.length > 0 ? (
              dsarList.requests.map((dsar) => (
                <Link key={dsar.id} href={`/privacy/dsar/${dsar.id}`} className="block">
                  <div className="flex items-start sm:items-center gap-3 sm:gap-4 p-2 -mx-2 hover:bg-muted/50 transition-colors">
                    <div className="flex-1 space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium font-mono text-primary text-sm">{dsar.publicId}</span>
                        <Badge variant="outline" className="text-xs">{dsar.type}</Badge>
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">{dsar.requesterName}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {dsar.status === "COMPLETED" ? (
                        <Badge variant="outline" className="text-xs border-primary bg-primary text-primary-foreground">
                          <CheckCircle2 className="inline h-3 w-3 mr-1" />
                          Done
                        </Badge>
                      ) : dsar.slaStatus === "overdue" ? (
                        <p className="text-xs sm:text-sm font-medium">
                          <Clock className="inline h-3 w-3 mr-1" />
                          <span className="text-foreground">Overdue</span>
                        </p>
                      ) : (
                        <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                          <Clock className="inline h-3 w-3 mr-1" />
                          {dsar.daysUntilDue ?? 0}d
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No open DSARs</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Recent Activity</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Latest updates across your privacy program</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
            {recentActivity.length > 0 ? (
              recentActivity.slice(0, 4).map((activity) => (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className="mt-0.5 p-1.5 border border-muted-foreground text-muted-foreground shrink-0">
                    <Clock className="h-3 w-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm truncate">{activity.action} - {activity.entityType}</p>
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
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Quick Actions</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Common tasks</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 grid-cols-1 sm:grid-cols-2 p-4 pt-0 sm:p-6 sm:pt-0">
            <Link href="/privacy/data-inventory/new">
              <Button variant="outline" className="w-full justify-start h-11">
                <Database className="w-4 h-4 mr-2 shrink-0" />
                <span className="truncate">Add Data Asset</span>
              </Button>
            </Link>
            <Link href="/privacy/dsar">
              <Button variant="outline" className="w-full justify-start h-11">
                <FileText className="w-4 h-4 mr-2 shrink-0" />
                <span className="truncate">New DSAR</span>
              </Button>
            </Link>
            <Link href="/privacy/incidents/new">
              <Button variant="outline" className="w-full justify-start h-11">
                <AlertTriangle className="w-4 h-4 mr-2 shrink-0" />
                <span className="truncate">Report Incident</span>
              </Button>
            </Link>
            <Link href="/privacy/vendors/new">
              <Button variant="outline" className="w-full justify-start h-11">
                <Building2 className="w-4 h-4 mr-2 shrink-0" />
                <span className="truncate">Add Vendor</span>
              </Button>
            </Link>
            <Link href="/privacy/quickstart">
              <Button variant="outline" className="w-full justify-start h-11">
                <Sparkles className="w-4 h-4 mr-2 shrink-0" />
                <span className="truncate">Quickstart Wizard</span>
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Vendor Overview */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base sm:text-lg">Vendors</CardTitle>
                <CardDescription className="text-xs sm:text-sm">{dashboardStats.activeVendors} active vendors</CardDescription>
              </div>
              <Link href="/privacy/vendors">
                <Button variant="ghost" size="sm" className="shrink-0">
                  <span className="hidden sm:inline">View all</span>
                  <ArrowRight className="sm:ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
            {vendorList?.vendors && vendorList.vendors.length > 0 ? (
              vendorList.vendors.map((vendor) => (
                <Link key={vendor.id} href={`/privacy/vendors/${vendor.id}`} className="block">
                  <div className="flex items-center gap-3 p-2 -mx-2 hover:bg-muted/50 transition-colors">
                    <div className="p-1.5 border border-primary/50 text-primary shrink-0">
                      <Building2 className="h-3 w-3" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{vendor.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{vendor.categories?.[0] || "Vendor"}</p>
                    </div>
                    {vendor.riskTier && (
                      <Badge
                        variant="outline"
                        className={`text-xs shrink-0 ${
                          vendor.riskTier === "CRITICAL" || vendor.riskTier === "HIGH"
                            ? "border-destructive/50 text-destructive"
                            : vendor.riskTier === "LOW"
                            ? "border-green-500/50 text-green-500"
                            : ""
                        }`}
                      >
                        {vendor.riskTier}
                      </Badge>
                    )}
                  </div>
                </Link>
              ))
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs sm:text-sm">Add vendors to track third-party risk</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Organization Dialog */}
      <Dialog open={createOrgOpen} onOpenChange={setCreateOrgOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Organization</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateOrg} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-org-name">Organization Name</Label>
              <Input
                id="new-org-name"
                placeholder="e.g., Acme Corporation"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setCreateOrgOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating || !newOrgName.trim()}>
                {isCreating ? "Creating..." : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
