"use client";

import { useState, useEffect } from "react";
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

export function CreateFlowSheet({
  isOpen,
  onClose,
  assets,
  onSubmit,
  isSubmitting = false,
  error,
  defaultSourceId,
  defaultDestinationId,
}: CreateFlowSheetProps) {
  const [form, setForm] = useState<CreateFlowData>({
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

  useEffect(() => {
    if (isOpen) {
      setForm({
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
    }
  }, [isOpen, defaultSourceId, defaultDestinationId]);

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
          <SheetTitle>Create Data Flow</SheetTitle>
          <SheetDescription>
            Define how data moves between systems
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="flow-name">Flow Name *</Label>
            <Input
              id="flow-name"
              placeholder="e.g., User sync to analytics"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="flow-description">Description</Label>
            <Textarea
              id="flow-description"
              placeholder="Describe the purpose of this data flow"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          {/* Source Asset */}
          <div className="space-y-2">
            <Label>Source Asset *</Label>
            <Select
              value={form.sourceAssetId}
              onValueChange={(value) => setForm({ ...form, sourceAssetId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select source system" />
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
            <Label>Destination Asset *</Label>
            <Select
              value={form.destinationAssetId}
              onValueChange={(value) => setForm({ ...form, destinationAssetId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select destination system" />
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
            <Label>Data Categories</Label>
            <div className="flex flex-wrap gap-2 p-3 bg-muted/50 max-h-[150px] overflow-y-auto">
              {Object.entries(categoryLabels).map(([value, label]) => {
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
                    {label}
                    {isSelected && (
                      <X className="w-3 h-3 ml-1" />
                    )}
                  </Badge>
                );
              })}
            </div>
            {form.dataCategories.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {form.dataCategories.length} selected
              </p>
            )}
          </div>

          {/* Frequency */}
          <div className="space-y-2">
            <Label>Frequency</Label>
            <Select
              value={form.frequency}
              onValueChange={(value) => setForm({ ...form, frequency: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="How often data is transferred" />
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
            <Label htmlFor="flow-volume">Data Volume</Label>
            <Input
              id="flow-volume"
              placeholder="e.g., ~10,000 records/day"
              value={form.volume}
              onChange={(e) => setForm({ ...form, volume: e.target.value })}
            />
          </div>

          {/* Encryption */}
          <div className="space-y-2">
            <Label htmlFor="flow-encryption">Encryption Method</Label>
            <Input
              id="flow-encryption"
              placeholder="e.g., TLS 1.3, AES-256"
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
              Cancel
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
                  Creating...
                </>
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
