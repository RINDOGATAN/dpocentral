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
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";

const ASSET_TYPE_KEYS = ["DATABASE", "APPLICATION", "CLOUD_SERVICE", "FILE_SYSTEM", "THIRD_PARTY", "PHYSICAL", "OTHER"] as const;
const HOSTING_TYPE_KEYS = ["ON_PREMISE", "CLOUD", "HYBRID", "SAAS"] as const;

export default function NewDataAssetPage() {
  const router = useRouter();
  const { organization } = useOrganization();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const t = useTranslations("toasts");
  const tp = useTranslations("pages.newAsset");
  const tCommon = useTranslations("common");

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
      toast.success(t("asset.created"));
      utils.dataInventory.listAssets.invalidate();
      router.push("/privacy/data-inventory");
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
          <Button variant="ghost" size="icon" aria-label={tCommon("back")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">{tp("title")}</h1>
          <p className="text-muted-foreground">{tp("subtitle")}</p>
        </div>
      </div>

      {/* Form */}
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
                  placeholder={tp("namePlaceholder")}
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
                    <SelectValue placeholder={tp("typePlaceholder")} />
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
                placeholder={tp("descriptionPlaceholder")}
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
                  placeholder={tp("ownerPlaceholder")}
                  value={formData.owner}
                  onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">{tp("location")}</Label>
                <Input
                  id="location"
                  placeholder={tp("locationPlaceholder")}
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
                  placeholder={tp("vendorPlaceholder")}
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

            {createAsset.error && (
              <div className="text-sm text-destructive">
                {tp("errorPrefix", { message: createAsset.error.message })}
              </div>
            )}

            <div className="flex justify-end gap-4">
              <Link href="/privacy/data-inventory">
                <Button variant="outline" type="button">{tCommon("cancel")}</Button>
              </Link>
              <Button type="submit" disabled={isSubmitting || !formData.name || !formData.type}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {tp("creating")}
                  </>
                ) : (
                  tp("submit")
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
