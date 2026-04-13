"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft,
  Database,
  Edit,
  Plus,
  Trash2,
  Server,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { DataCategory, DataSensitivity } from "@prisma/client";

const DataFlowVisualization = dynamic(
  () => import("@/components/privacy/data-flow/DataFlowVisualization").then((m) => m.DataFlowVisualization),
  { loading: () => <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> }
);

const sensitivityColors: Record<string, string> = {
  PUBLIC: "border-primary text-primary",
  INTERNAL: "border-primary text-primary",
  CONFIDENTIAL: "border-muted-foreground text-muted-foreground",
  RESTRICTED: "border-muted-foreground bg-muted-foreground/20 text-foreground",
  SPECIAL_CATEGORY: "border-muted-foreground bg-muted-foreground text-foreground",
};

const categoryLabels: Record<DataCategory, string> = {
  IDENTIFIERS: "Identifiers",
  DEMOGRAPHICS: "Demographics",
  FINANCIAL: "Financial",
  HEALTH: "Health",
  BIOMETRIC: "Biometric",
  LOCATION: "Location",
  BEHAVIORAL: "Behavioral",
  EMPLOYMENT: "Employment",
  EDUCATION: "Education",
  POLITICAL: "Political",
  RELIGIOUS: "Religious",
  GENETIC: "Genetic",
  SEXUAL_ORIENTATION: "Sexual Orientation",
  CRIMINAL: "Criminal",
  OTHER: "Other",
};

const legalBasisLabels: Record<string, string> = {
  CONSENT: "Consent",
  CONTRACT: "Contract",
  LEGAL_OBLIGATION: "Legal Obligation",
  VITAL_INTERESTS: "Vital Interests",
  PUBLIC_TASK: "Public Task",
  LEGITIMATE_INTERESTS: "Legitimate Interests",
};

const sensitivityLabels: Record<DataSensitivity, string> = {
  PUBLIC: "Public",
  INTERNAL: "Internal",
  CONFIDENTIAL: "Confidential",
  RESTRICTED: "Restricted",
  SPECIAL_CATEGORY: "Special Category",
};

export default function DataAssetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { organization } = useOrganization();
  const [isAddElementOpen, setIsAddElementOpen] = useState(false);
  const [linkActivitiesOpen, setLinkActivitiesOpen] = useState(false);
  const [selectedActivityIds, setSelectedActivityIds] = useState<string[]>([]);
  // Map of activityId -> elementIds (undefined = all elements of this asset)
  const [selectedElements, setSelectedElements] = useState<Record<string, string[] | undefined>>({});
  const [expandedActivities, setExpandedActivities] = useState<Set<string>>(new Set());
  const [elementForm, setElementForm] = useState({
    name: "",
    description: "",
    category: "IDENTIFIERS" as DataCategory,
    sensitivity: "INTERNAL" as DataSensitivity,
    isPersonalData: true,
    isSpecialCategory: false,
    retentionDays: "",
  });

  const { data: asset, isLoading } = trpc.dataInventory.getAsset.useQuery(
    { organizationId: organization?.id ?? "", id },
    { enabled: !!organization?.id && !!id }
  );

  const utils = trpc.useUtils();

  const deleteAsset = trpc.dataInventory.deleteAsset.useMutation({
    onSuccess: () => {
      toast.success("Asset deleted");
      utils.dataInventory.listAssets.invalidate();
      router.push("/privacy/data-inventory");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete asset");
    },
  });

  const addElement = trpc.dataInventory.addElement.useMutation({
    onSuccess: () => {
      toast.success("Data element added");
      utils.dataInventory.getAsset.invalidate();
      setIsAddElementOpen(false);
      setElementForm({
        name: "",
        description: "",
        category: "IDENTIFIERS",
        sensitivity: "INTERNAL",
        isPersonalData: true,
        isSpecialCategory: false,
        retentionDays: "",
      });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to add element");
    },
  });

  const {
    data: allActivitiesPages,
    fetchNextPage: fetchNextActivitiesPage,
    hasNextPage: hasMoreActivities,
    isFetchingNextPage: isFetchingMoreActivities,
  } = trpc.dataInventory.listActivities.useInfiniteQuery(
    { organizationId: organization?.id ?? "", limit: 100 },
    {
      enabled: !!organization?.id,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );
  const allActivities = allActivitiesPages?.pages.flatMap((p) => p.activities) ?? [];

  // Progressively load all pages so the picker covers large inventories
  useEffect(() => {
    if (hasMoreActivities && !isFetchingMoreActivities) {
      fetchNextActivitiesPage();
    }
  }, [hasMoreActivities, isFetchingMoreActivities, fetchNextActivitiesPage]);

  const linkActivities = trpc.dataInventory.linkActivitiesToAsset.useMutation({
    onSuccess: (result) => {
      utils.dataInventory.getAsset.invalidate();
      utils.dataInventory.listFlows.invalidate();
      setLinkActivitiesOpen(false);
      if (result.flowsCreated > 0) {
        toast.success(`Activities updated — auto-generated ${result.flowsCreated} data flow${result.flowsCreated !== 1 ? "s" : ""}`);
      } else {
        toast.success("Activities updated");
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to link activities");
    },
  });

  function openLinkActivities() {
    const currentIds = asset?.processingActivityAssets?.map((a: any) => a.processingActivity.id) ?? [];
    setSelectedActivityIds(currentIds);

    const elMap: Record<string, string[] | undefined> = {};
    for (const link of asset?.processingActivityAssets ?? []) {
      const le = (link as any).linkedElements ?? [];
      elMap[(link as any).processingActivity.id] = le.length > 0 ? le.map((l: any) => l.dataElement.id) : undefined;
    }
    setSelectedElements(elMap);
    setExpandedActivities(new Set());
    setLinkActivitiesOpen(true);
  }

  function toggleActivity(activityId: string) {
    setSelectedActivityIds((prev) => {
      if (prev.includes(activityId)) {
        setSelectedElements((sel) => {
          const next = { ...sel };
          delete next[activityId];
          return next;
        });
        setExpandedActivities((exp) => { const n = new Set(exp); n.delete(activityId); return n; });
        return prev.filter((id) => id !== activityId);
      }
      setSelectedElements((sel) => ({ ...sel, [activityId]: undefined }));
      return [...prev, activityId];
    });
  }

  function toggleElementForActivity(activityId: string, elementId: string) {
    setSelectedElements((prev) => {
      const current = prev[activityId];
      const allElementIds = (asset?.dataElements ?? []).map((e) => e.id);
      if (current === undefined) {
        // Was "all" — deselect one
        return { ...prev, [activityId]: allElementIds.filter((id) => id !== elementId) };
      }
      if (current.includes(elementId)) {
        return { ...prev, [activityId]: current.filter((id) => id !== elementId) };
      }
      const added = [...current, elementId];
      if (added.length >= allElementIds.length) {
        return { ...prev, [activityId]: undefined };
      }
      return { ...prev, [activityId]: added };
    });
  }

  function toggleAllElementsForActivity(activityId: string) {
    setSelectedElements((prev) =>
      prev[activityId] === undefined
        ? { ...prev, [activityId]: [] }
        : { ...prev, [activityId]: undefined }
    );
  }

  const deleteElement = trpc.dataInventory.deleteElement.useMutation({
    onSuccess: () => {
      toast.success("Element deleted");
      utils.dataInventory.getAsset.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete element");
    },
  });

  const handleDelete = () => {
    if (!organization?.id || !confirm("Are you sure you want to delete this asset?")) return;
    deleteAsset.mutate({ organizationId: organization.id, id });
  };

  const handleAddElement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id || !elementForm.name) return;

    addElement.mutate({
      organizationId: organization.id,
      dataAssetId: id,
      name: elementForm.name,
      description: elementForm.description || undefined,
      category: elementForm.category,
      sensitivity: elementForm.sensitivity,
      isPersonalData: elementForm.isPersonalData,
      isSpecialCategory: elementForm.isSpecialCategory,
      retentionDays: elementForm.retentionDays ? parseInt(elementForm.retentionDays) : undefined,
    });
  };

  const handleDeleteElement = (elementId: string, elementName: string) => {
    if (!organization?.id || !confirm(`Delete "${elementName}"?`)) return;
    deleteElement.mutate({ organizationId: organization.id, id: elementId });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Asset not found</p>
        <Link href="/privacy/data-inventory">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Inventory
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/privacy/data-inventory">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 flex items-center justify-center">
              <Server className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">{asset.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline">{asset.type}</Badge>
                {asset.isProduction && (
                  <Badge variant="outline" className="border-primary text-primary">Production</Badge>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive"
            onClick={handleDelete}
            disabled={deleteAsset.isPending}
          >
            {deleteAsset.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
            Delete
          </Button>
        </div>
      </div>

      {/* Overview */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">{asset.description || "No description provided"}</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Owner</p>
                <p className="font-medium">{asset.owner || "Not specified"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Location</p>
                <p className="font-medium">{asset.location || "Not specified"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Hosting</p>
                <p className="font-medium">{asset.hostingType || "Not specified"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Vendor</p>
                <p className="font-medium">{asset.vendor || "N/A"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-3xl font-bold">{asset.dataElements?.length ?? 0}</p>
              <p className="text-sm text-muted-foreground">Data Elements</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{asset.processingActivityAssets?.length ?? 0}</p>
              <p className="text-sm text-muted-foreground">Processing Activities</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Last Updated</p>
              <p className="font-medium">{new Date(asset.updatedAt).toLocaleDateString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="elements">
        <TabsList>
          <TabsTrigger value="elements">Data Elements</TabsTrigger>
          <TabsTrigger value="activities">Processing Activities</TabsTrigger>
          <TabsTrigger value="flows">Data Flows</TabsTrigger>
        </TabsList>

        <TabsContent value="elements" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Data Elements</CardTitle>
                <CardDescription>Fields and data points stored in this asset</CardDescription>
              </div>
              <Button size="sm" onClick={() => setIsAddElementOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Element
              </Button>
            </CardHeader>
            <CardContent>
              {asset.dataElements && asset.dataElements.length > 0 ? (
                <div className="space-y-2">
                  {asset.dataElements.map((element) => (
                    <div
                      key={element.id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <Link
                        href={`/privacy/data-inventory/elements/${element.id}`}
                        className="flex items-center gap-3 flex-1 min-w-0 min-h-[44px]"
                      >
                        <Database className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium font-mono text-sm hover:underline truncate">{element.name}</p>
                          <p className="text-xs text-muted-foreground">{element.category}</p>
                        </div>
                      </Link>
                      <div className="flex items-center gap-2 sm:shrink-0 pl-7 sm:pl-0">
                        <Badge variant="outline" className={sensitivityColors[element.sensitivity] || ""}>
                          {element.sensitivity}
                        </Badge>
                        {element.isPersonalData && (
                          <Badge variant="outline" className="hidden sm:inline-flex">Personal Data</Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive ml-auto"
                          onClick={() => handleDeleteElement(element.id, element.name)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No data elements defined yet</p>
                  <p className="text-sm">Add data elements to document what data is stored</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activities" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Linked Processing Activities</CardTitle>
                  <CardDescription>Activities that use data from this asset</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={openLinkActivities}>
                  <Plus className="w-4 h-4 mr-2" />
                  Manage Activities
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {asset.processingActivityAssets && asset.processingActivityAssets.length > 0 ? (
                <div className="space-y-3">
                  {asset.processingActivityAssets.map((link: any) => {
                    const linkedEls = link.linkedElements ?? [];
                    const allElements = asset.dataElements ?? [];
                    const effectiveElements = linkedEls.length > 0
                      ? linkedEls.map((le: any) => le.dataElement)
                      : allElements;
                    const isFiltered = linkedEls.length > 0 && linkedEls.length < allElements.length;

                    return (
                      <Link
                        key={link.id}
                        href={`/privacy/data-inventory/activities/${link.processingActivity.id}`}
                        className="block"
                      >
                        <div className="border rounded-lg p-3 hover:border-primary/50 transition-colors space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{link.processingActivity.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {legalBasisLabels[link.processingActivity.legalBasis] || link.processingActivity.legalBasis}
                                {link.processingActivity.purpose && ` — ${link.processingActivity.purpose}`}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge variant="outline" className="text-xs">
                                {effectiveElements.length}{isFiltered ? `/${allElements.length}` : ""} element{effectiveElements.length !== 1 ? "s" : ""}
                              </Badge>
                              <ArrowRight className="w-4 h-4 text-muted-foreground" />
                            </div>
                          </div>
                          {effectiveElements.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {effectiveElements.map((el: any) => (
                                <Badge
                                  key={el.id}
                                  variant={el.isSpecialCategory ? "destructive" : "secondary"}
                                  className="text-xs font-normal"
                                >
                                  {el.name}
                                </Badge>
                              ))}
                              {isFiltered && (
                                <span className="text-xs text-muted-foreground self-center">
                                  +{allElements.length - effectiveElements.length} not linked
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No linked processing activities
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="flows" className="mt-4">
          <DataFlowVisualization
            mode="asset"
            assetId={id}
            organizationId={organization?.id ?? ""}
            height="400px"
          />
        </TabsContent>
      </Tabs>

      {/* Add Element Sheet */}
      <Sheet open={isAddElementOpen} onOpenChange={setIsAddElementOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Add Data Element</SheetTitle>
            <SheetDescription>
              Add a new data field or element to this asset
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleAddElement} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="element-name">Element Name *</Label>
              <Input
                id="element-name"
                placeholder="e.g., email_address, phone_number"
                value={elementForm.name}
                onChange={(e) => setElementForm({ ...elementForm, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="element-description">Description</Label>
              <Textarea
                id="element-description"
                placeholder="Brief description of this data element"
                rows={2}
                value={elementForm.description}
                onChange={(e) => setElementForm({ ...elementForm, description: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="element-category">Category *</Label>
              <Select
                value={elementForm.category}
                onValueChange={(value) => setElementForm({ ...elementForm, category: value as DataCategory })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="element-sensitivity">Sensitivity *</Label>
              <Select
                value={elementForm.sensitivity}
                onValueChange={(value) => setElementForm({ ...elementForm, sensitivity: value as DataSensitivity })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(sensitivityLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="element-retention">Retention Period (days)</Label>
              <Input
                id="element-retention"
                type="number"
                placeholder="e.g., 365"
                value={elementForm.retentionDays}
                onChange={(e) => setElementForm({ ...elementForm, retentionDays: e.target.value })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is-personal-data" className="text-sm">Is Personal Data</Label>
              <Switch
                id="is-personal-data"
                checked={elementForm.isPersonalData}
                onCheckedChange={(checked) => setElementForm({ ...elementForm, isPersonalData: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is-special-category" className="text-sm">Is Special Category</Label>
              <Switch
                id="is-special-category"
                checked={elementForm.isSpecialCategory}
                onCheckedChange={(checked) => setElementForm({ ...elementForm, isSpecialCategory: checked })}
              />
            </div>

            {addElement.error && (
              <div className="text-sm text-destructive">
                Error: {addElement.error.message}
              </div>
            )}

            <SheetFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsAddElementOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={addElement.isPending || !elementForm.name}>
                {addElement.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add Element"
                )}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Link Activities Dialog */}
      <Dialog open={linkActivitiesOpen} onOpenChange={setLinkActivitiesOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Link Processing Activities</DialogTitle>
            <DialogDescription>
              Select which activities use data from this asset, and which elements they process.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
            {allActivities.length > 0 ? (
              allActivities.map((act: any) => {
                const isSelected = selectedActivityIds.includes(act.id);
                const isExpanded = expandedActivities.has(act.id);
                const elements = asset?.dataElements ?? [];
                const elSelection = selectedElements[act.id];
                const allSelected = elSelection === undefined;
                return (
                  <div key={act.id}>
                    <div className="flex items-center gap-3 p-2 rounded hover:bg-muted/50">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleActivity(act.id)}
                      />
                      <label
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => toggleActivity(act.id)}
                      >
                        <p className="text-sm font-medium truncate">{act.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {act.legalBasis?.replace("_", " ")} — {act.purpose}
                        </p>
                      </label>
                      {isSelected && elements.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() =>
                            setExpandedActivities((prev) => {
                              const next = new Set(prev);
                              next.has(act.id) ? next.delete(act.id) : next.add(act.id);
                              return next;
                            })
                          }
                        >
                          {isExpanded ? "Hide" : "Elements"}
                        </Button>
                      )}
                    </div>
                    {isSelected && isExpanded && elements.length > 0 && (
                      <div className="ml-9 pl-2 border-l space-y-0.5 pb-1">
                        <label className="flex items-center gap-2 p-1 rounded hover:bg-muted/50 cursor-pointer">
                          <Checkbox
                            checked={allSelected}
                            onCheckedChange={() => toggleAllElementsForActivity(act.id)}
                          />
                          <span className="text-xs font-medium text-muted-foreground">
                            All elements
                          </span>
                        </label>
                        {elements.map((el) => {
                          const isElSelected = allSelected || (elSelection?.includes(el.id) ?? false);
                          return (
                            <label
                              key={el.id}
                              className="flex items-center gap-2 p-1 rounded hover:bg-muted/50 cursor-pointer"
                            >
                              <Checkbox
                                checked={isElSelected}
                                onCheckedChange={() => toggleElementForActivity(act.id, el.id)}
                              />
                              <span className="text-xs truncate">{el.name}</span>
                              <Badge
                                variant={el.isSpecialCategory ? "destructive" : "secondary"}
                                className="text-[10px] px-1 py-0 shrink-0"
                              >
                                {el.category?.replace("_", " ")}
                              </Badge>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No processing activities in this organization yet
              </p>
            )}
          </div>
          <div className="flex justify-between items-center pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              {selectedActivityIds.length} activit{selectedActivityIds.length !== 1 ? "ies" : "y"} selected
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setLinkActivitiesOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  linkActivities.mutate({
                    organizationId: organization?.id ?? "",
                    assetId: id,
                    activities: selectedActivityIds.map((activityId) => ({
                      activityId,
                      elementIds: selectedElements[activityId],
                    })),
                  })
                }
                disabled={linkActivities.isPending}
              >
                {linkActivities.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
