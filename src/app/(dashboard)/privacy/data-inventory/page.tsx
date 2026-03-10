"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Database,
  Plus,
  Search,
  Server,
  Cloud,
  Building2,
  FileSpreadsheet,
  ArrowRight,
  Filter,
  Loader2,
  Lock,
  Download,
  FileText,
  Globe,
  Shield,
  CheckCircle2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { useDebounce } from "@/hooks/use-debounce";
import { ExpertHelpCta } from "@/components/privacy/expert-help-cta";
import { ListPageSkeleton } from "@/components/skeletons/list-page-skeleton";
import { EnableFeatureModal } from "@/components/premium/enable-feature-modal";


const DataFlowVisualization = dynamic(
  () => import("@/components/privacy/data-flow/DataFlowVisualization").then((m) => m.DataFlowVisualization),
  { loading: () => <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> }
);

const assetTypeIcons: Record<string, any> = {
  DATABASE: Server,
  APPLICATION: Database,
  CLOUD_SERVICE: Cloud,
  THIRD_PARTY: Building2,
  FILE_SYSTEM: FileSpreadsheet,
};

const mechanismLabels: Record<string, string> = {
  ADEQUACY_DECISION: "Adequacy Decision",
  STANDARD_CONTRACTUAL_CLAUSES: "SCCs",
  BINDING_CORPORATE_RULES: "BCRs",
  DEROGATION: "Derogation",
  CERTIFICATION: "Certification",
  CODE_OF_CONDUCT: "Code of Conduct",
  OTHER: "Other",
};

const INITIAL_TRANSFER_FORM = {
  name: "",
  destinationCountry: "",
  destinationOrg: "",
  mechanism: "" as string,
  safeguards: "",
  description: "",
};

export default function DataInventoryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery);
  const { organization } = useOrganization();
  const router = useRouter();
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferForm, setTransferForm] = useState(INITIAL_TRANSFER_FORM);

  const { data: ropaAccess } = trpc.dataInventory.hasRopaExportAccess.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id }
  );
  const hasRopaAccess = ropaAccess?.hasAccess ?? false;

  const {
    data: assetsPages,
    isLoading: assetsLoading,
    hasNextPage: hasMoreAssets,
    fetchNextPage: fetchMoreAssets,
    isFetchingNextPage: fetchingMoreAssets,
  } = trpc.dataInventory.listAssets.useInfiniteQuery(
    { organizationId: organization?.id ?? "", search: debouncedSearch || undefined, limit: 50 },
    {
      enabled: !!organization?.id,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  const {
    data: activitiesPages,
    isLoading: activitiesLoading,
    hasNextPage: hasMoreActivities,
    fetchNextPage: fetchMoreActivities,
    isFetchingNextPage: fetchingMoreActivities,
  } = trpc.dataInventory.listActivities.useInfiniteQuery(
    { organizationId: organization?.id ?? "", search: debouncedSearch || undefined, limit: 50 },
    {
      enabled: !!organization?.id,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  const {
    data: transfers,
    isLoading: transfersLoading,
  } = trpc.dataInventory.listTransfers.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id }
  );

  const utils = trpc.useUtils();
  const createTransfer = trpc.dataInventory.createTransfer.useMutation({
    onSuccess: () => {
      utils.dataInventory.listTransfers.invalidate();
      setTransferDialogOpen(false);
      setTransferForm(INITIAL_TRANSFER_FORM);
    },
  });

  const dataAssets = assetsPages?.pages.flatMap((p) => p.assets) ?? [];
  const processingActivities = activitiesPages?.pages.flatMap((p) => p.activities) ?? [];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">Data Inventory</h1>
          <p className="text-sm text-muted-foreground">
            Manage data assets and processing activities
          </p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0 sm:size-auto sm:px-4 sm:py-2">
                <Download className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Export</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => window.open(`/api/export/data-inventory?organizationId=${organization?.id}`, "_blank")}>
                <FileText className="w-4 h-4 mr-2" />
                Inventory as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.open(`/api/export/data-inventory?organizationId=${organization?.id}&format=csv`, "_blank")}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Inventory as CSV
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  if (hasRopaAccess) {
                    router.push("/privacy/data-inventory/processing-activities");
                  } else {
                    setUpgradeModalOpen(true);
                  }
                }}
              >
                {hasRopaAccess ? (
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                ) : (
                  <Lock className="w-4 h-4 mr-2 text-amber-500" />
                )}
                ROPA Export
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Link href="/privacy/data-inventory/new" className="flex-1 sm:flex-none">
            <Button className="w-full sm:w-auto">
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Add Asset</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-2 sm:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search assets..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button variant="outline" size="icon" className="shrink-0 sm:hidden">
          <Filter className="w-4 h-4" />
        </Button>
        <Button variant="outline" className="shrink-0 hidden sm:flex">
          <Filter className="w-4 h-4 mr-2" />
          Filters
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="assets">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="assets" className="text-xs sm:text-sm">
            Assets ({dataAssets.length})
          </TabsTrigger>
          <TabsTrigger value="activities" className="text-xs sm:text-sm">
            Activities ({processingActivities.length})
          </TabsTrigger>
          <TabsTrigger value="flows" className="text-xs sm:text-sm hidden sm:inline-flex">
            Data Flows
          </TabsTrigger>
          <TabsTrigger value="transfers" className="text-xs sm:text-sm hidden sm:inline-flex">
            Transfers{transfers?.length ? ` (${transfers.length})` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assets" className="mt-4">
          {assetsLoading ? (
            <ListPageSkeleton />
          ) : dataAssets.length > 0 ? (
            <>
              <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {dataAssets.map((asset) => {
                  const Icon = assetTypeIcons[asset.type] || Database;
                  return (
                    <Link key={asset.id} href={`/privacy/data-inventory/${asset.id}`}>
                      <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                        <CardHeader className="pb-3 p-4 sm:p-6 sm:pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-primary/10 flex items-center justify-center shrink-0">
                              <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                            </div>
                            <Badge variant="outline" className="text-xs shrink-0">
                              {asset.type.replace("_", " ")}
                            </Badge>
                          </div>
                          <CardTitle className="mt-3 text-base sm:text-lg line-clamp-1">{asset.name}</CardTitle>
                          <CardDescription className="text-xs sm:text-sm">{asset.owner || "No owner"}</CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                          <div className="flex justify-between text-xs sm:text-sm">
                            <span className="text-muted-foreground">
                              {asset._count?.dataElements ?? 0} elements
                            </span>
                            <span className="text-muted-foreground">
                              {asset._count?.processingActivityAssets ?? 0} activities
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2 truncate">
                            {asset.location || "No location specified"}
                          </p>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
              {hasMoreAssets && (
                <div className="flex justify-center mt-4">
                  <Button
                    variant="outline"
                    onClick={() => fetchMoreAssets()}
                    disabled={fetchingMoreAssets}
                  >
                    {fetchingMoreAssets && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Load More
                  </Button>
                </div>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No data assets yet</p>
                <p className="text-sm mb-4">Start by adding your first data asset</p>
                <Link href="/privacy/data-inventory/new">
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Asset
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="activities" className="mt-4">
          {activitiesLoading ? (
            <ListPageSkeleton />
          ) : processingActivities.length > 0 ? (
            <>
              <div className="space-y-3">
                {processingActivities.map((activity) => (
                  <Card key={activity.id} className="hover:border-primary/50 transition-colors">
                    <CardContent className="p-4">
                      {/* Mobile Layout */}
                      <div className="flex flex-col gap-3 sm:hidden">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-base line-clamp-1">{activity.name}</CardTitle>
                          <Badge className="shrink-0 text-xs">{activity.legalBasis?.replace("_", " ") || "No basis"}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{activity.purpose}</p>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{activity.assets?.length ?? 0} assets</span>
                          <Button variant="ghost" size="sm" className="h-8 px-2">
                            Details <ArrowRight className="w-3 h-3 ml-1" />
                          </Button>
                        </div>
                      </div>

                      {/* Desktop Layout */}
                      <div className="hidden sm:block">
                        <CardHeader className="p-0 pb-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-base">{activity.name}</CardTitle>
                              <CardDescription className="line-clamp-1">{activity.purpose}</CardDescription>
                            </div>
                            <Badge>{activity.legalBasis?.replace("_", " ") || "No basis"}</Badge>
                          </div>
                        </CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex gap-4 text-sm text-muted-foreground">
                            <span>{activity.assets?.length ?? 0} assets</span>
                            <span>{(activity.dataSubjects as string[])?.join(", ") || "No subjects"}</span>
                          </div>
                          <Button variant="ghost" size="sm">
                            View Details <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {hasMoreActivities && (
                <div className="flex justify-center mt-4">
                  <Button
                    variant="outline"
                    onClick={() => fetchMoreActivities()}
                    disabled={fetchingMoreActivities}
                  >
                    {fetchingMoreActivities && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Load More
                  </Button>
                </div>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No processing activities yet</p>
                <p className="text-sm">Document your data processing activities for ROPA compliance</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="flows" className="mt-4">
          <DataFlowVisualization
            mode="all"
            organizationId={organization?.id ?? ""}
          />
        </TabsContent>

        <TabsContent value="transfers" className="mt-4">
          {transfersLoading ? (
            <ListPageSkeleton />
          ) : transfers && transfers.length > 0 ? (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => setTransferDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Transfer
                </Button>
              </div>
              <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {transfers.map((transfer) => (
                  <Card key={transfer.id}>
                    <CardHeader className="pb-3 p-4 sm:p-6 sm:pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 bg-primary/10 flex items-center justify-center shrink-0">
                          <Globe className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {mechanismLabels[transfer.mechanism] || transfer.mechanism}
                        </Badge>
                      </div>
                      <CardTitle className="mt-3 text-base sm:text-lg line-clamp-1">{transfer.name}</CardTitle>
                      <CardDescription className="text-xs sm:text-sm">
                        {transfer.destinationOrg ? `${transfer.destinationOrg} — ` : ""}{transfer.destinationCountry}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                      <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          {transfer.tiaCompleted ? (
                            <><CheckCircle2 className="w-3 h-3 text-green-500" /> TIA completed</>
                          ) : (
                            <><Shield className="w-3 h-3 text-amber-500" /> TIA pending</>
                          )}
                        </span>
                        {transfer.processingActivity && (
                          <span className="truncate ml-2">{transfer.processingActivity.name}</span>
                        )}
                      </div>
                      {transfer.safeguards && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{transfer.safeguards}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Globe className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No international transfers recorded</p>
                <p className="text-sm mb-4">Document cross-border data transfers and safeguards (Art. 44–49 GDPR)</p>
                <Button onClick={() => setTransferDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Transfer
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {dataAssets.length === 0 && processingActivities.length === 0 && (
        <ExpertHelpCta context="empty-state" />
      )}

      {/* Add Transfer Dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add International Transfer</DialogTitle>
            <DialogDescription>
              Record a cross-border data transfer under GDPR Art. 44–49.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!transferForm.name || !transferForm.destinationCountry || !transferForm.mechanism) return;
              createTransfer.mutate({
                organizationId: organization?.id ?? "",
                name: transferForm.name,
                destinationCountry: transferForm.destinationCountry,
                destinationOrg: transferForm.destinationOrg || undefined,
                mechanism: transferForm.mechanism as any,
                safeguards: transferForm.safeguards || undefined,
                description: transferForm.description || undefined,
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="transfer-name">Transfer Name</Label>
              <Input
                id="transfer-name"
                placeholder="e.g. Customer data to US analytics provider"
                value={transferForm.name}
                onChange={(e) => setTransferForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="transfer-country">Destination Country</Label>
                <Input
                  id="transfer-country"
                  placeholder="e.g. US, IN, GB"
                  value={transferForm.destinationCountry}
                  onChange={(e) => setTransferForm((f) => ({ ...f, destinationCountry: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="transfer-org">Receiving Organization</Label>
                <Input
                  id="transfer-org"
                  placeholder="e.g. Stripe Inc."
                  value={transferForm.destinationOrg}
                  onChange={(e) => setTransferForm((f) => ({ ...f, destinationOrg: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Transfer Mechanism</Label>
              <Select
                value={transferForm.mechanism}
                onValueChange={(v) => setTransferForm((f) => ({ ...f, mechanism: v }))}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select mechanism..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(mechanismLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="transfer-safeguards">Safeguards</Label>
              <Input
                id="transfer-safeguards"
                placeholder="e.g. EU SCCs (2021) + supplementary measures"
                value={transferForm.safeguards}
                onChange={(e) => setTransferForm((f) => ({ ...f, safeguards: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setTransferDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createTransfer.isPending || !transferForm.name || !transferForm.destinationCountry || !transferForm.mechanism}
              >
                {createTransfer.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Add Transfer
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ROPA Export Premium Gating */}
      <EnableFeatureModal
        open={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        organizationId={organization?.id ?? ""}
        skillPackageId="skill-ropa-export"
        skillName="ROPA Export"
      />
    </div>
  );
}
