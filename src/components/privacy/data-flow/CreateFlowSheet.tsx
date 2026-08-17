"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Server,
  Database,
  Cloud,
  Building2,
  FileSpreadsheet,
  HardDrive,
  Box,
  X,
} from "lucide-react";
import type { AssetData } from "./useDataFlowGraph";
import { DataCategory } from "@prisma/client";

const assetTypeIcons: Record<string, typeof Database> = {
  DATABASE: Server,
  APPLICATION: Database,
  CLOUD_SERVICE: Cloud,
  THIRD_PARTY: Building2,
  FILE_SYSTEM: FileSpreadsheet,
  PHYSICAL: HardDrive,
  OTHER: Box,
};

// Keys only — labels come from the shared `enums.dataCategory` messages.
const CATEGORY_KEYS: DataCategory[] = [
  "IDENTIFIERS",
  "DEMOGRAPHICS",
  "FINANCIAL",
  "HEALTH",
  "BIOMETRIC",
  "LOCATION",
  "BEHAVIORAL",
  "EMPLOYMENT",
  "EDUCATION",
  "POLITICAL",
  "RELIGIOUS",
  "GENETIC",
  "SEXUAL_ORIENTATION",
  "CRIMINAL",
  "OTHER",
];

const frequencyOptions = [
  "Real-time",
  "Hourly",
  "Daily",
  "Weekly",
  "Monthly",
  "On-demand",
  "Batch",
];

interface CreateFlowSheetProps {
  isOpen: boolean;
  onClose: () => void;
  assets: AssetData[];
  onSubmit: (data: CreateFlowData) => void;
  isSubmitting?: boolean;
  error?: string | null;
  defaultSourceId?: string;
  defaultDestinationId?: string;
  mode?: "create" | "edit";
  initialData?: CreateFlowData;
}

export interface CreateFlowData {
  name: string;
  description?: string;
  sourceAssetId: string;
  destinationAssetId: string;
  dataCategories: DataCategory[];
  frequency?: string;
  volume?: string;
  encryptionMethod?: string;
  isAutomated: boolean;
}

const emptyForm = (defaultSourceId?: string, defaultDestinationId?: string): CreateFlowData => ({
  name: "",
  description: "",
  sourceAssetId: defaultSourceId || "",
  destinationAssetId: defaultDestinationId || "",
  dataCategories: [],
  frequency: "",
  volume: "",
  encryptionMethod: "",
  isAutomated: true,
});

export function CreateFlowSheet({
  isOpen,
  onClose,
  assets,
  onSubmit,
  isSubmitting = false,
  error,
  defaultSourceId,
  defaultDestinationId,
  mode = "create",
  initialData,
}: CreateFlowSheetProps) {
  const tSheet = useTranslations("dataFlow.sheet");
  const tCategory = useTranslations("enums.dataCategory");
  const [form, setForm] = useState<CreateFlowData>(
    initialData ?? emptyForm(defaultSourceId, defaultDestinationId)
  );

  useEffect(() => {
    if (isOpen) {
      setForm(initialData ?? emptyForm(defaultSourceId, defaultDestinationId));
    }
  }, [isOpen, initialData, defaultSourceId, defaultDestinationId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.sourceAssetId || !form.destinationAssetId) return;
    onSubmit(form);
  };

  const toggleCategory = (category: DataCategory) => {
    setForm((prev) => ({
      ...prev,
      dataCategories: prev.dataCategories.includes(category)
        ? prev.dataCategories.filter((c) => c !== category)
        : [...prev.dataCategories, category],
    }));
  };

  const AssetOption = ({ asset }: { asset: AssetData }) => {
    const Icon = assetTypeIcons[asset.type] || Box;
    return (
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <span className="truncate">{asset.name}</span>
        <Badge variant="outline" className="text-[10px] ml-auto">
          {asset.type}
        </Badge>
      </div>
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{mode === "edit" ? tSheet("editTitle") : tSheet("createTitle")}</SheetTitle>
          <SheetDescription>
            {mode === "edit"
              ? tSheet("editDescription")
              : tSheet("createDescription")}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="flow-name">{tSheet("name")}</Label>
            <Input
              id="flow-name"
              placeholder={tSheet("namePlaceholder")}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="flow-description">{tSheet("description")}</Label>
            <Textarea
              id="flow-description"
              placeholder={tSheet("descriptionPlaceholder")}
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          {/* Source Asset */}
          <div className="space-y-2">
            <Label>{tSheet("source")}</Label>
            <Select
              value={form.sourceAssetId}
              onValueChange={(value) => setForm({ ...form, sourceAssetId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder={tSheet("sourcePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {assets
                  .filter((a) => a.id !== form.destinationAssetId)
                  .map((asset) => (
                    <SelectItem key={asset.id} value={asset.id}>
                      <AssetOption asset={asset} />
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Destination Asset */}
          <div className="space-y-2">
            <Label>{tSheet("destination")}</Label>
            <Select
              value={form.destinationAssetId}
              onValueChange={(value) => setForm({ ...form, destinationAssetId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder={tSheet("destinationPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {assets
                  .filter((a) => a.id !== form.sourceAssetId)
                  .map((asset) => (
                    <SelectItem key={asset.id} value={asset.id}>
                      <AssetOption asset={asset} />
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Data Categories */}
          <div className="space-y-2">
            <Label>{tSheet("categories")}</Label>
            <div className="flex flex-wrap gap-2 p-3 bg-muted/50 max-h-[150px] overflow-y-auto">
              {CATEGORY_KEYS.map((value) => {
                const category = value as DataCategory;
                const isSelected = form.dataCategories.includes(category);
                return (
                  <Badge
                    key={value}
                    variant={isSelected ? "default" : "outline"}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? "" : "hover:border-primary"
                    }`}
                    onClick={() => toggleCategory(category)}
                  >
                    {tCategory(value as never)}
                    {isSelected && (
                      <X className="w-3 h-3 ml-1" />
                    )}
                  </Badge>
                );
              })}
            </div>
            {form.dataCategories.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {tSheet("categoriesSelected", { count: form.dataCategories.length })}
              </p>
            )}
          </div>

          {/* Frequency */}
          <div className="space-y-2">
            <Label>{tSheet("frequency")}</Label>
            <Select
              value={form.frequency}
              onValueChange={(value) => setForm({ ...form, frequency: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder={tSheet("frequencyPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {frequencyOptions.map((freq) => (
                  <SelectItem key={freq} value={freq}>
                    {freq}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Volume */}
          <div className="space-y-2">
            <Label htmlFor="flow-volume">{tSheet("volume")}</Label>
            <Input
              id="flow-volume"
              placeholder={tSheet("volumePlaceholder")}
              value={form.volume}
              onChange={(e) => setForm({ ...form, volume: e.target.value })}
            />
          </div>

          {/* Encryption */}
          <div className="space-y-2">
            <Label htmlFor="flow-encryption">{tSheet("encryption")}</Label>
            <Input
              id="flow-encryption"
              placeholder={tSheet("encryptionPlaceholder")}
              value={form.encryptionMethod}
              onChange={(e) => setForm({ ...form, encryptionMethod: e.target.value })}
            />
          </div>

          {/* Is Automated */}
          <div className="flex items-center justify-between">
            <Label htmlFor="is-automated" className="text-sm">
              Automated Transfer
            </Label>
            <Switch
              id="is-automated"
              checked={form.isAutomated}
              onCheckedChange={(checked) => setForm({ ...form, isAutomated: checked })}
            />
          </div>

          {error && (
            <div className="text-sm text-destructive p-2 bg-destructive/10">
              {error}
            </div>
          )}

          <SheetFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              {tSheet("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={
                isSubmitting ||
                !form.name ||
                !form.sourceAssetId ||
                !form.destinationAssetId
              }
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {mode === "edit" ? "Saving…" : "Creating…"}
                </>
              ) : mode === "edit" ? (
                "Save Changes"
              ) : (
                "Create Flow"
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
