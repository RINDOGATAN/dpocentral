"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useTranslations } from "next-intl";
import { useEnumLabels } from "@/lib/enum-labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  ArrowRight,
  Clock,
  Database,
  Edit,
  Lock,
  Trash2,
  Zap,
  Server,
  Cloud,
  Building2,
  FileSpreadsheet,
  HardDrive,
  Box,
} from "lucide-react";
import type { FlowData } from "./useDataFlowGraph";
import { FREQUENCY_LABEL_KEYS } from "./CreateFlowSheet";

const assetTypeIcons: Record<string, typeof Database> = {
  DATABASE: Server,
  APPLICATION: Database,
  CLOUD_SERVICE: Cloud,
  THIRD_PARTY: Building2,
  FILE_SYSTEM: FileSpreadsheet,
  PHYSICAL: HardDrive,
  OTHER: Box,
};



interface FlowDetailsPanelProps {
  flow: FlowData | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (flow: FlowData) => void;
  onDelete?: (flow: FlowData) => void;
}

export function FlowDetailsPanel({
  flow,
  isOpen,
  onClose,
  onEdit,
  onDelete,
}: FlowDetailsPanelProps) {
  const tCategory = useTranslations("enums.dataCategory");
  const tFlow = useTranslations("dataFlow");
  const tCommon = useTranslations("common");
  const { label: enumLabel } = useEnumLabels();
  if (!flow) return null;

  const SourceIcon = assetTypeIcons[flow.sourceAsset.type] || Box;
  const DestIcon = assetTypeIcons[flow.destinationAsset.type] || Box;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {flow.name}
            {flow.isAutomated && (
              <Badge variant="outline" className="ml-2">
                <Zap className="w-3 h-3 mr-1" />
                {tFlow("details.automated")}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            {flow.description || tFlow("details.noDescription")}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Flow Direction */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">{tFlow("details.direction")}</h4>
            <div className="flex items-center gap-3 p-3 bg-muted/50">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="w-8 h-8 bg-primary/10 flex items-center justify-center shrink-0">
                  <SourceIcon className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{flow.sourceAsset.name}</p>
                  <p className="text-xs text-muted-foreground">{enumLabel("dataAssetType", flow.sourceAsset.type)}</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-primary shrink-0" />
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="w-8 h-8 bg-primary/10 flex items-center justify-center shrink-0">
                  <DestIcon className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{flow.destinationAsset.name}</p>
                  <p className="text-xs text-muted-foreground">{enumLabel("dataAssetType", flow.destinationAsset.type)}</p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Data Categories */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">{tFlow("sheet.categories")}</h4>
            {flow.dataCategories && flow.dataCategories.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {flow.dataCategories.map((category) => (
                  <Badge key={category} variant="outline">
                    {tCategory.has(category as never) ? tCategory(category as never) : category}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{tFlow("details.noCategories")}</p>
            )}
          </div>

          <Separator />

          {/* Metadata */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">{tFlow("details.title")}</h4>
            <div className="grid gap-3">
              {flow.frequency && (
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">{tFlow("sheet.frequency")}</p>
                    <p className="text-sm font-medium">
                      {FREQUENCY_LABEL_KEYS[flow.frequency]
                        ? tFlow(`frequencyOptions.${FREQUENCY_LABEL_KEYS[flow.frequency]}`)
                        : flow.frequency}
                    </p>
                  </div>
                </div>
              )}
              {flow.volume && (
                <div className="flex items-center gap-3">
                  <Database className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">{tFlow("details.volume")}</p>
                    <p className="text-sm font-medium">{flow.volume}</p>
                  </div>
                </div>
              )}
              {flow.encryptionMethod && (
                <div className="flex items-center gap-3">
                  <Lock className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">{tFlow("details.encryption")}</p>
                    <p className="text-sm font-medium">{flow.encryptionMethod}</p>
                  </div>
                </div>
              )}
              {!flow.frequency && !flow.volume && !flow.encryptionMethod && (
                <p className="text-sm text-muted-foreground">{tFlow("details.noDetails")}</p>
              )}
            </div>
          </div>
        </div>

        <SheetFooter className="mt-6 gap-2">
          {onDelete && (
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => onDelete(flow)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {tCommon("delete")}
            </Button>
          )}
          {onEdit && (
            <Button variant="outline" onClick={() => onEdit(flow)}>
              <Edit className="w-4 h-4 mr-2" />
              {tCommon("edit")}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
