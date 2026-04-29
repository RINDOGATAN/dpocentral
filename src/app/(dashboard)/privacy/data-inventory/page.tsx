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
import { useTranslations } from "next-intl";
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

const MECHANISM_KEYS = [
  "ADEQUACY_DECISION",
  "STANDARD_CONTRACTUAL_CLAUSES",
  "BINDING_CORPORATE_RULES",
  "DEROGATION",
  "CERTIFICATION",
  "CODE_OF_CONDUCT",
  "OTHER",
] as const;

const LEGAL_BASIS_KEYS = [
  "CONSENT",
  "CONTRACT",
  "LEGAL_OBLIGATION",
  "VITAL_INTERESTS",
  "PUBLIC_TASK",
  "LEGITIMATE_INTERESTS",
] as const;

const INITIAL_ACTIVITY_FORM = {
  name: "",
  purpose: "",
  legalBasis: "" as string,
  dataSubjects: "",
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
  const t = useTranslations("pages.dataInventory");
  const tCommon = useTranslations("common");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery);
  const { organization } = useOrganization();
  const router = useRouter();
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [activityForm, setActivityForm] = useState(INITIAL_ACTIVITY_FORM);
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
  const createActivity = trpc.dataInventory.createActivity.useMutation({
    onSuccess: (activity) => {
      utils.dataInventory.listActivities.invalidate();
      setActivityDialogOpen(false);
      setActivityForm(INITIAL_ACTIVITY_FORM);
      router.push(`/privacy/data-inventory/activities/${activity.id}`);
    },
  });
  const createTransfer = trpc.dataInventory.createTransfer.useMutation({
    onSuccess: () => {
      utils.dataInventory.listTransfers.invalidate();
      setTransferDialogOpen(false);
      setTransferForm(INITIAL_TRANSFER_FORM);
    },
  });
  const createTransferTia = trpc.assessment.createForTransfer.useMutation({
    onSuccess: (assessment) => {
      router.push(`/privacy/assessments/${assessment.id}`);
    },
  });

  const dataAssets = assetsPages?.pages.flatMap((p) => p.assets) ?? [];
  const processingActivities = activitiesPages?.pages.flatMap((p) => p.activities) ?? [];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label={t("export")} className="shrink-0 sm:size-auto sm:px-4 sm:py-2">
                <Download className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">{t("export")}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => window.open(`/api/export/privacy-program?organizationId=${organization?.id}`, "_blank")}>
                <FileText className="w-4 h-4 mr-2" />
                {t("exportPrivacyProgram")}
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
                {t("exportRopa")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Link href="/privacy/data-inventory/new" className="flex-1 sm:flex-none">
            <Button className="w-full sm:w-auto">
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">{t("addAsset")}</span>
              <span className="sm:hidden">{t("addAssetShort")}</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-2 sm:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("search")}
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button variant="outline" size="icon" aria-label={t("filters")} className="shrink-0 sm:hidden">
          <Filter className="w-4 h-4" />
        </Button>
        <Button variant="outline" className="shrink-0 hidden sm:flex">
          <Filter className="w-4 h-4 mr-2" />
          {t("filters")}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="assets">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="assets" className="text-xs sm:text-sm">
            {t("tabs.assets", { count: dataAssets.length })}
          </TabsTrigger>
          <TabsTrigger value="activities" className="text-xs sm:text-sm">
            {t("tabs.activities", { count: processingActivities.length })}
          </TabsTrigger>
          <TabsTrigger value="flows" className="text-xs sm:text-sm hidden sm:inline-flex">
            {t("tabs.flows")}
          </TabsTrigger>
          <TabsTrigger value="transfers" className="text-xs sm:text-sm hidden sm:inline-flex">
            {transfers?.length
              ? t("tabs.transfersWithCount", { count: transfers.length })
              : t("tabs.transfers")}
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
                    <Link key={asset.id} href={`/privacy/data-inventory/${asset.id}`} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 h-full">
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
                          <CardDescription className="text-xs sm:text-sm">{asset.owner || t("asset.ownerEmpty")}</CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                          <div className="flex justify-between text-xs sm:text-sm">
                            <span className="text-muted-foreground">
                              {t("asset.elements", { count: asset._count?.dataElements ?? 0 })}
                            </span>
                            <span className="text-muted-foreground">
                              {t("asset.activities", { count: asset._count?.processingActivityAssets ?? 0 })}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2 truncate">
                            {asset.location || t("asset.locationEmpty")}
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
                    {t("loadMore")}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{t("emptyAssets.title")}</p>
                <p className="text-sm mb-4">{t("emptyAssets.subtitle")}</p>
                <Link href="/privacy/data-inventory/new">
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    {t("addAsset")}
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
              <div className="flex justify-end mb-3">
                <Button onClick={() => setActivityDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  {t("addActivity")}
                </Button>
              </div>
              <div className="flex flex-col gap-4">
                {processingActivities.map((activity) => (
                  <Link key={activity.id} href={`/privacy/data-inventory/activities/${activity.id}`} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                    <Card className="hover:border-primary/50 transition-colors">
                      <CardContent className="p-4">
                        {/* Mobile Layout */}
                        <div className="flex flex-col gap-3 sm:hidden">
                          <div className="flex items-start justify-between gap-2">
                            <CardTitle className="text-base line-clamp-1">{activity.name}</CardTitle>
                            <Badge className="shrink-0 text-xs">{activity.legalBasis ? t(`legalBasis.${activity.legalBasis}`) : t("activity.noBasis")}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">{activity.purpose}</p>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{t("activity.assetsCount", { count: activity.assets?.length ?? 0 })}</span>
                            <Button variant="ghost" size="sm" className="h-8 px-2">
                              {t("activity.details")} <ArrowRight className="w-3 h-3 ml-1" />
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
                              <Badge>{activity.legalBasis ? t(`legalBasis.${activity.legalBasis}`) : t("activity.noBasis")}</Badge>
                            </div>
                          </CardHeader>
                          <div className="flex items-center justify-between">
                            <div className="flex gap-4 text-sm text-muted-foreground">
                              <span>{t("activity.assetsCount", { count: activity.assets?.length ?? 0 })}</span>
                              <span>{(activity.dataSubjects as string[])?.join(", ") || t("activity.noSubjects")}</span>
                            </div>
                            <Button variant="ghost" size="sm">
                              {t("activity.viewDetails")} <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
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
                <p>{t("emptyActivities.title")}</p>
                <p className="text-sm mb-4">{t("emptyActivities.subtitle")}</p>
                <Button onClick={() => setActivityDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  {t("addActivity")}
                </Button>
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
                  {t("addTransfer")}
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
                          {t(`mechanism.${transfer.mechanism}`)}
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
                          {(() => {
                            const tia = transfer.assessments?.[0];
                            const inProgress = tia && tia.status !== "APPROVED" && tia.status !== "REJECTED";
                            if (transfer.tiaCompleted || tia?.status === "APPROVED") {
                              return <><CheckCircle2 className="w-3 h-3 text-green-500" /> {t("transfer.tiaCompleted")}</>;
                            }
                            if (inProgress) {
                              return <><Shield className="w-3 h-3 text-amber-500" /> {t("transfer.tiaInProgress")}</>;
                            }
                            return <><Shield className="w-3 h-3 text-amber-500" /> {t("transfer.tiaPending")}</>;
                          })()}
                        </span>
                        {transfer.processingActivity && (
                          <span className="truncate ml-2">{transfer.processingActivity.name}</span>
                        )}
                      </div>
                      {transfer.safeguards && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{transfer.safeguards}</p>
                      )}
                      <div className="mt-3">
                        {(() => {
                          const tia = transfer.assessments?.[0];
                          if (tia) {
                            const isDone = tia.status === "APPROVED";
                            return (
                              <Link href={`/privacy/assessments/${tia.id}`}>
                                <Button variant="outline" size="sm" className="w-full">
                                  {isDone ? t("transfer.viewTia") : t("transfer.continueTia")}
                                  <ArrowRight className="w-3 h-3 ml-1" />
                                </Button>
                              </Link>
                            );
                          }
                          return (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() =>
                                createTransferTia.mutate({
                                  organizationId: organization?.id ?? "",
                                  dataTransferId: transfer.id,
                                })
                              }
                              disabled={createTransferTia.isPending}
                            >
                              {createTransferTia.isPending && createTransferTia.variables?.dataTransferId === transfer.id ? (
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              ) : (
                                <Shield className="w-3 h-3 mr-1" />
                              )}
                              {t("transfer.startTia")}
                            </Button>
                          );
                        })()}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Globe className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{t("emptyTransfers.title")}</p>
                <p className="text-sm mb-4">{t("emptyTransfers.subtitle")}</p>
                <Button onClick={() => setTransferDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  {t("addTransfer")}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {dataAssets.length === 0 && processingActivities.length === 0 && (
        <ExpertHelpCta context="empty-state" />
      )}

      {/* Add Activity Dialog */}
      <Dialog open={activityDialogOpen} onOpenChange={setActivityDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("activityDialog.title")}</DialogTitle>
            <DialogDescription>{t("activityDialog.description")}</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!activityForm.name || !activityForm.purpose || !activityForm.legalBasis) return;
              createActivity.mutate({
                organizationId: organization?.id ?? "",
                name: activityForm.name,
                purpose: activityForm.purpose,
                legalBasis: activityForm.legalBasis as any,
                dataSubjects: activityForm.dataSubjects
                  ? activityForm.dataSubjects.split(",").map((s) => s.trim()).filter(Boolean)
                  : [],
                categories: [],
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="activity-name">{t("activityDialog.nameLabel")}</Label>
              <Input
                id="activity-name"
                placeholder={t("activityDialog.namePlaceholder")}
                value={activityForm.name}
                onChange={(e) => setActivityForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="activity-purpose">{t("activityDialog.purposeLabel")}</Label>
              <Input
                id="activity-purpose"
                placeholder={t("activityDialog.purposePlaceholder")}
                value={activityForm.purpose}
                onChange={(e) => setActivityForm((f) => ({ ...f, purpose: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{t("activityDialog.legalBasisLabel")}</Label>
              <Select
                value={activityForm.legalBasis}
                onValueChange={(v) => setActivityForm((f) => ({ ...f, legalBasis: v }))}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("activityDialog.legalBasisPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {LEGAL_BASIS_KEYS.map((value) => (
                    <SelectItem key={value} value={value}>{t(`legalBasis.${value}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="activity-subjects">{t("activityDialog.subjectsLabel")}</Label>
              <Input
                id="activity-subjects"
                placeholder={t("activityDialog.subjectsPlaceholder")}
                value={activityForm.dataSubjects}
                onChange={(e) => setActivityForm((f) => ({ ...f, dataSubjects: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">{t("activityDialog.subjectsHelp")}</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setActivityDialogOpen(false)}>
                {tCommon("cancel")}
              </Button>
              <Button
                type="submit"
                disabled={createActivity.isPending || !activityForm.name || !activityForm.purpose || !activityForm.legalBasis}
              >
                {createActivity.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {t("addActivity")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Transfer Dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("transferDialog.title")}</DialogTitle>
            <DialogDescription>{t("transferDialog.description")}</DialogDescription>
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
              <Label htmlFor="transfer-name">{t("transferDialog.nameLabel")}</Label>
              <Input
                id="transfer-name"
                placeholder={t("transferDialog.namePlaceholder")}
                value={transferForm.name}
                onChange={(e) => setTransferForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="transfer-country">{t("transferDialog.countryLabel")}</Label>
                <Input
                  id="transfer-country"
                  placeholder={t("transferDialog.countryPlaceholder")}
                  value={transferForm.destinationCountry}
                  onChange={(e) => setTransferForm((f) => ({ ...f, destinationCountry: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="transfer-org">{t("transferDialog.orgLabel")}</Label>
                <Input
                  id="transfer-org"
                  placeholder={t("transferDialog.orgPlaceholder")}
                  value={transferForm.destinationOrg}
                  onChange={(e) => setTransferForm((f) => ({ ...f, destinationOrg: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("transferDialog.mechanismLabel")}</Label>
              <Select
                value={transferForm.mechanism}
                onValueChange={(v) => setTransferForm((f) => ({ ...f, mechanism: v }))}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("transferDialog.mechanismPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {MECHANISM_KEYS.map((value) => (
                    <SelectItem key={value} value={value}>{t(`mechanism.${value}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="transfer-safeguards">{t("transferDialog.safeguardsLabel")}</Label>
              <Input
                id="transfer-safeguards"
                placeholder={t("transferDialog.safeguardsPlaceholder")}
                value={transferForm.safeguards}
                onChange={(e) => setTransferForm((f) => ({ ...f, safeguards: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setTransferDialogOpen(false)}>
                {tCommon("cancel")}
              </Button>
              <Button
                type="submit"
                disabled={createTransfer.isPending || !transferForm.name || !transferForm.destinationCountry || !transferForm.mechanism}
              >
                {createTransfer.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {t("addTransfer")}
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
