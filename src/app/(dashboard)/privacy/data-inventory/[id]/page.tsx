"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
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
  ArrowLeft,
  Database,
  Edit,
  Plus,
  Trash2,
  Server,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { DataCategory, DataSensitivity } from "@prisma/client";

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
      utils.dataInventory.listAssets.invalidate();
      router.push("/privacy/data-inventory");
    },
  });

  const addElement = trpc.dataInventory.addElement.useMutation({
    onSuccess: () => {
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
  });

  const deleteElement = trpc.dataInventory.deleteElement.useMutation({
    onSuccess: () => {
      utils.dataInventory.getAsset.invalidate();
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
            <Trash2 className="w-4 h-4 mr-2" />
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
                      className="flex items-center justify-between p-3 bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <Database className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium font-mono text-sm">{element.name}</p>
                          <p className="text-xs text-muted-foreground">{element.category}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={sensitivityColors[element.sensitivity] || ""}>
                          {element.sensitivity}
                        </Badge>
                        {element.isPersonalData && (
                          <Badge variant="outline">Personal Data</Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
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
              <CardTitle>Linked Processing Activities</CardTitle>
              <CardDescription>Activities that use data from this asset</CardDescription>
            </CardHeader>
            <CardContent>
              {asset.processingActivityAssets && asset.processingActivityAssets.length > 0 ? (
                <div className="space-y-2">
                  {asset.processingActivityAssets.map((link) => (
                    <div
                      key={link.id}
                      className="flex items-center justify-between p-3 bg-muted/50"
                    >
                      <div>
                        <p className="font-medium">{link.processingActivity.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Legal Basis: {link.processingActivity.legalBasis}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm">
                        View <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No linked processing activities</p>
                  <p className="text-sm">Link this asset to processing activities for ROPA</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="flows" className="mt-4">
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Data flow visualization coming soon</p>
            </CardContent>
          </Card>
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
    </div>
  );
}
