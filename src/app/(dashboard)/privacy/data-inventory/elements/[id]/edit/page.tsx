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

const CATEGORY_KEYS = [
  "IDENTIFIERS", "DEMOGRAPHICS", "FINANCIAL", "HEALTH", "BIOMETRIC",
  "LOCATION", "BEHAVIORAL", "EMPLOYMENT", "EDUCATION", "POLITICAL",
  "RELIGIOUS", "GENETIC", "SEXUAL_ORIENTATION", "CRIMINAL", "OTHER",
] as const;

const SENSITIVITY_KEYS = [
  "PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED", "SPECIAL_CATEGORY",
] as const;

const LEGAL_BASIS_KEYS = [
  "CONSENT", "CONTRACT", "LEGAL_OBLIGATION", "VITAL_INTERESTS",
  "PUBLIC_TASK", "LEGITIMATE_INTERESTS",
] as const;

export default function EditDataElementPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { organization } = useOrganization();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const t = useTranslations("toasts");
  const tEdit = useTranslations("pages.editElement");
  const tExt = useTranslations("pages.editElementExt");
  const tCat = useTranslations("pages.editElementExt.category_option");
  const tSens = useTranslations("pages.editElementExt.sensitivity_option");
  const tLegal = useTranslations("pages.editElementExt.legalBasis_option");
  const tCommon = useTranslations("common");

  const initializedRef = useRef(false);
  const [parentAssetId, setParentAssetId] = useState<string>("");
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "" as string,
    sensitivity: "INTERNAL" as string,
    isPersonalData: true,
    isSpecialCategory: false,
    retentionDays: "" as string,
    legalBasis: "" as string,
  });

  const { data: element, isLoading } = trpc.dataInventory.getElement.useQuery(
    { organizationId: organization?.id ?? "", id },
    { enabled: !!organization?.id && !!id }
  );

  useEffect(() => {
    if (element && !initializedRef.current) {
      initializedRef.current = true;
      setParentAssetId(element.dataAsset.id);
      setFormData({
        name: element.name || "",
        description: element.description || "",
        category: element.category as string,
        sensitivity: element.sensitivity as string,
        isPersonalData: element.isPersonalData ?? true,
        isSpecialCategory: element.isSpecialCategory ?? false,
        retentionDays: element.retentionDays != null ? String(element.retentionDays) : "",
        legalBasis: (element.legalBasis as string) || "",
      });
    }
  }, [element]);

  const utils = trpc.useUtils();

  const updateElement = trpc.dataInventory.updateElement.useMutation({
    onSuccess: () => {
      toast.success(t("asset.elementUpdated"));
      utils.dataInventory.getElement.invalidate({ organizationId: organization!.id, id });
      router.push(`/privacy/data-inventory/elements/${id}`);
    },
    onError: (error) => {
      toast.error(error.message || t("generic.somethingWentWrong"));
      setIsSubmitting(false);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id || !formData.name || !formData.category) return;
    setIsSubmitting(true);
    updateElement.mutate({
      organizationId: organization.id,
      id,
      name: formData.name,
      description: formData.description || null,
      category: formData.category as any,
      sensitivity: formData.sensitivity as any,
      isPersonalData: formData.isPersonalData,
      isSpecialCategory: formData.isSpecialCategory,
      retentionDays: formData.retentionDays ? parseInt(formData.retentionDays, 10) : null,
      legalBasis: formData.legalBasis || null,
    });
  };

  if (isLoading || !element) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/privacy/data-inventory/elements/${id}`}>
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
          <CardTitle>{tEdit("title")}</CardTitle>
          <CardDescription>{tEdit("subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">{tExt("name")}</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">{tExt("category")}</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_KEYS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {tCat(value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{tExt("description")}</Label>
              <Textarea
                id="description"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="sensitivity">{tExt("sensitivity")}</Label>
                <Select
                  value={formData.sensitivity}
                  onValueChange={(value) => setFormData({ ...formData, sensitivity: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SENSITIVITY_KEYS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {tSens(value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="retentionDays">{tExt("retentionDays")}</Label>
                <Input
                  id="retentionDays"
                  type="number"
                  min={0}
                  value={formData.retentionDays}
                  onChange={(e) => setFormData({ ...formData, retentionDays: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="legalBasis">{tExt("legalBasis")}</Label>
                <Select
                  value={formData.legalBasis || "__none__"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, legalBasis: value === "__none__" ? "" : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={tExt("notSpecified")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{tExt("notSpecified")}</SelectItem>
                    {LEGAL_BASIS_KEYS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {tLegal(value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Switch
                  id="isPersonalData"
                  checked={formData.isPersonalData}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isPersonalData: checked })
                  }
                />
                <Label htmlFor="isPersonalData">{tExt("personalDataToggle")}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="isSpecialCategory"
                  checked={formData.isSpecialCategory}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isSpecialCategory: checked })
                  }
                />
                <Label htmlFor="isSpecialCategory">{tExt("specialCategoryToggle")}</Label>
              </div>
            </div>

            {updateElement.error && (
              <div className="text-sm text-destructive">
                {tExt("errorPrefix", { message: updateElement.error.message })}
              </div>
            )}

            <div className="flex justify-end gap-4">
              <Link href={`/privacy/data-inventory/elements/${id}`}>
                <Button variant="outline" type="button">{tCommon("cancel")}</Button>
              </Link>
              <Button type="submit" disabled={isSubmitting || !formData.name || !formData.category}>
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
      {parentAssetId && (
        <p className="text-xs text-muted-foreground text-right">
          <Link href={`/privacy/data-inventory/${parentAssetId}`} className="hover:underline">
            {tExt("backToAsset")}
          </Link>
        </p>
      )}
    </div>
  );
}
