"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
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
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";

const ASSET_TYPE_KEYS = ["DATABASE", "APPLICATION", "CLOUD_SERVICE", "FILE_SYSTEM", "THIRD_PARTY", "PHYSICAL", "OTHER"] as const;
const HOSTING_TYPE_KEYS = ["ON_PREMISE", "CLOUD", "HYBRID", "SAAS"] as const;

export default function EditDataAssetPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { organization } = useOrganization();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const t = useTranslations("toasts");
  const tp = useTranslations("pages.newAsset");
  const tEdit = useTranslations("pages.editAsset");
  const tCommon = useTranslations("common");

  const initializedRef = useRef(false);
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

  const { data: asset, isLoading } = trpc.dataInventory.getAsset.useQuery(
    { organizationId: organization?.id ?? "", id },
    { enabled: !!organization?.id && !!id }
  );

  useEffect(() => {
    if (asset && !initializedRef.current) {
      initializedRef.current = true;
      setFormData({
        name: asset.name || "",
        description: asset.description || "",
        type: asset.type || "",
        owner: asset.owner || "",
        location: asset.location || "",
        hostingType: asset.hostingType || "",
        vendor: asset.vendor || "",
        isProduction: asset.isProduction ?? true,
      });
    }
  }, [asset]);

  const utils = trpc.useUtils();

  const updateAsset = trpc.dataInventory.updateAsset.useMutation({
    onSuccess: () => {
      toast.success(t("asset.updated"));
      utils.dataInventory.listAssets.invalidate();
      utils.dataInventory.getAsset.invalidate({ organizationId: organization!.id, id });
      router.push(`/privacy/data-inventory/${id}`);
    },
    onError: (error) => {
      toast.error(error.message || t("generic.somethingWentWrong"));
      setIsSubmitting(false);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id || !formData.name || !formData.type) return;
    setIsSubmitting(true);
    updateAsset.mutate({
      organizationId: organization.id,
      id,
      name: formData.name,
      description: formData.description || null,
      type: formData.type as any,
      owner: formData.owner || null,
      location: formData.location || null,
      hostingType: formData.hostingType || null,
      vendor: formData.vendor || null,
      isProduction: formData.isProduction,
    });
  };

  if (isLoading || !asset) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/privacy/data-inventory/${id}`}>
          <Button variant="ghost" size="icon" aria-label={tCommon("back")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">{tEdit("title")}</h1>
          <p className="text-muted-foreground">{tEdit("subtitle")}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{tp("details")}</CardTitle>
          <CardDescription>{tp("detailsSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">{tp("name")}</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">{tp("type")}</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSET_TYPE_KEYS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {tp(`assetType.${value}` as `assetType.DATABASE` | `assetType.APPLICATION` | `assetType.CLOUD_SERVICE` | `assetType.FILE_SYSTEM` | `assetType.THIRD_PARTY` | `assetType.PHYSICAL` | `assetType.OTHER`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{tp("description")}</Label>
              <Textarea
                id="description"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="owner">{tp("owner")}</Label>
                <Input
                  id="owner"
                  value={formData.owner}
                  onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">{tp("location")}</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="hostingType">{tp("hosting")}</Label>
                <Select
                  value={formData.hostingType}
                  onValueChange={(value) => setFormData({ ...formData, hostingType: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={tp("hostingPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {HOSTING_TYPE_KEYS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {tp(`hostingType.${value}` as `hostingType.ON_PREMISE` | `hostingType.CLOUD` | `hostingType.HYBRID` | `hostingType.SAAS`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor">{tp("vendor")}</Label>
                <Input
                  id="vendor"
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
              <Label htmlFor="isProduction">{tp("production")}</Label>
            </div>

            {updateAsset.error && (
              <div className="text-sm text-destructive">
                {tp("errorPrefix", { message: updateAsset.error.message })}
              </div>
            )}

            <div className="flex justify-end gap-4">
              <Link href={`/privacy/data-inventory/${id}`}>
                <Button variant="outline" type="button">{tCommon("cancel")}</Button>
              </Link>
              <Button type="submit" disabled={isSubmitting || !formData.name || !formData.type}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {tEdit("saving")}
                  </>
                ) : (
                  tEdit("save")
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
