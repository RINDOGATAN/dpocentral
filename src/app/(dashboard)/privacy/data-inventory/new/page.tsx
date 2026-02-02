"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";

const assetTypes = [
  { value: "DATABASE", label: "Database" },
  { value: "APPLICATION", label: "Application" },
  { value: "CLOUD_SERVICE", label: "Cloud Service" },
  { value: "FILE_SYSTEM", label: "File System" },
  { value: "THIRD_PARTY", label: "Third Party" },
  { value: "PHYSICAL", label: "Physical" },
  { value: "OTHER", label: "Other" },
];

const hostingTypes = [
  { value: "ON_PREMISE", label: "On-Premise" },
  { value: "CLOUD", label: "Cloud" },
  { value: "HYBRID", label: "Hybrid" },
  { value: "SAAS", label: "SaaS" },
];

export default function NewDataAssetPage() {
  const router = useRouter();
  const { organization } = useOrganization();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "",
    owner: "",
    location: "",
    hostingType: "",
    vendor: "",
    isProduction: true,
  });

  const utils = trpc.useUtils();

  const createAsset = trpc.dataInventory.createAsset.useMutation({
    onSuccess: () => {
      utils.dataInventory.listAssets.invalidate();
      router.push("/privacy/data-inventory");
    },
    onError: (error) => {
      console.error("Failed to create asset:", error);
      setIsSubmitting(false);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id || !formData.name || !formData.type) return;

    setIsSubmitting(true);

    createAsset.mutate({
      organizationId: organization.id,
      name: formData.name,
      description: formData.description || undefined,
      type: formData.type as any,
      owner: formData.owner || undefined,
      location: formData.location || undefined,
      hostingType: formData.hostingType || undefined,
      vendor: formData.vendor || undefined,
      isProduction: formData.isProduction,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/privacy/data-inventory">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">Add Data Asset</h1>
          <p className="text-muted-foreground">
            Register a new system or data store
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Asset Details</CardTitle>
          <CardDescription>
            Provide information about the data asset
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Asset Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Customer Database"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Asset Type *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {assetTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe the asset and its purpose..."
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="owner">Owner/Department</Label>
                <Input
                  id="owner"
                  placeholder="e.g., Engineering"
                  value={formData.owner}
                  onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  placeholder="e.g., AWS US-East-1"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="hostingType">Hosting Type</Label>
                <Select
                  value={formData.hostingType}
                  onValueChange={(value) => setFormData({ ...formData, hostingType: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select hosting type" />
                  </SelectTrigger>
                  <SelectContent>
                    {hostingTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor">Vendor (if applicable)</Label>
                <Input
                  id="vendor"
                  placeholder="e.g., AWS, Salesforce"
                  value={formData.vendor}
                  onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="isProduction"
                checked={formData.isProduction}
                onCheckedChange={(checked) => setFormData({ ...formData, isProduction: checked })}
              />
              <Label htmlFor="isProduction">Production environment</Label>
            </div>

            {createAsset.error && (
              <div className="text-sm text-destructive">
                Error: {createAsset.error.message}
              </div>
            )}

            <div className="flex justify-end gap-4">
              <Link href="/privacy/data-inventory">
                <Button variant="outline" type="button">Cancel</Button>
              </Link>
              <Button type="submit" disabled={isSubmitting || !formData.name || !formData.type}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Asset"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
