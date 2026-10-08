"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Database,
  Edit,
  FileText,
  Scale,
  Users,
  Clock,
  ArrowRightLeft,
  ClipboardCheck,
  Loader2,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useEnumLabels } from "@/lib/enum-labels";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { RecordHeader } from "@/components/privacy/record-header";
import { TemplateBadge } from "@/components/privacy/template-badge";

export default function ActivityDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { organization } = useOrganization();
  const t = useTranslations("toasts");
  const tp = useTranslations("pages.activityDetail");
  const tc = useTranslations("common");
  const { label: enumLabel } = useEnumLabels();
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  // Map of assetId -> elementIds (undefined = all elements)
  const [selectedElements, setSelectedElements] = useState<Record<string, string[] | undefined>>({});
  const [expandedAssets, setExpandedAssets] = useState<Set<string>>(new Set());

  const utils = trpc.useUtils();

  const { data: activity, isLoading } = trpc.dataInventory.getActivity.useQuery(
    { organizationId: organization?.id ?? "", id },
    { enabled: !!organization?.id && !!id }
  );

  const {
    data: allAssetsPages,
    fetchNextPage: fetchNextAssetsPage,
    hasNextPage: hasMoreAssets,
    isFetchingNextPage: isFetchingMoreAssets,
  } = trpc.dataInventory.listAssets.useInfiniteQuery(
    { organizationId: organization?.id ?? "", limit: 100 },
    {
      enabled: !!organization?.id,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );
  const allAssets = allAssetsPages?.pages.flatMap((p) => p.assets) ?? [];

  // Progressively load all pages so the picker covers large inventories
  useEffect(() => {
    if (hasMoreAssets && !isFetchingMoreAssets) {
      fetchNextAssetsPage();
    }
  }, [hasMoreAssets, isFetchingMoreAssets, fetchNextAssetsPage]);

  const linkAssets = trpc.dataInventory.linkAssets.useMutation({
    onSuccess: (result) => {
      utils.dataInventory.getActivity.invalidate({ organizationId: organization?.id ?? "", id });
      utils.dataInventory.listFlows.invalidate();
      setLinkDialogOpen(false);
      if (result.flowsCreated > 0) {
        toast.success(t("activity.assetsLinkedWithFlows", { count: result.flowsCreated }));
      } else {
        toast.success(t("activity.assetsLinked"));
      }
    },
    onError: (error) => toast.error(error.message || t("generic.somethingWentWrong")),
  });

  const regenerateFlows = trpc.dataInventory.regenerateFlows.useMutation({
    onSuccess: (result) => {
      utils.dataInventory.listFlows.invalidate();
      toast.success(
        result.flowsCreated > 0
          ? t("activity.flowsGenerated", { count: result.flowsCreated })
          : t("activity.noNewFlows")
      );
    },
    onError: (error) => toast.error(error.message || t("generic.somethingWentWrong")),
  });

  function openLinkDialog() {
    // Pre-select currently linked assets and their element selections
    const currentIds = activity?.assets?.map((a: any) => a.dataAsset.id) ?? [];
    setSelectedAssetIds(currentIds);

    const elMap: Record<string, string[] | undefined> = {};
    for (const link of activity?.assets ?? []) {
      const le = (link as any).linkedElements ?? [];
      // Empty linkedElements = all elements (undefined)
      elMap[(link as any).dataAsset.id] = le.length > 0 ? le.map((l: any) => l.dataElement.id) : undefined;
    }
    setSelectedElements(elMap);
    setExpandedAssets(new Set());
    setLinkDialogOpen(true);
  }

  function toggleAsset(assetId: string) {
    setSelectedAssetIds((prev) => {
      if (prev.includes(assetId)) {
        // Unchecking — remove element selections too
        setSelectedElements((sel) => {
          const next = { ...sel };
          delete next[assetId];
          return next;
        });
        setExpandedAssets((exp) => { const n = new Set(exp); n.delete(assetId); return n; });
        return prev.filter((id) => id !== assetId);
      }
      // Checking — default to all elements (undefined)
      setSelectedElements((sel) => ({ ...sel, [assetId]: undefined }));
      return [...prev, assetId];
    });
  }

  function toggleElement(assetId: string, elementId: string, totalElements: number) {
    setSelectedElements((prev) => {
      const current = prev[assetId];
      if (current === undefined) {
        // Was "all" — switch to all-except-this-one
        const asset = allAssets.find((a) => a.id === assetId);
        const allElementIds = ((asset as any)?.dataElements ?? []).map((e: any) => e.id);
        if (allElementIds.length === 0) return prev;
        return { ...prev, [assetId]: allElementIds.filter((id: string) => id !== elementId) };
      }
      if (current.includes(elementId)) {
        return { ...prev, [assetId]: current.filter((id) => id !== elementId) };
      }
      const added = [...current, elementId];
      // If all elements selected, switch back to undefined (= all)
      if (added.length >= totalElements) {
        return { ...prev, [assetId]: undefined };
      }
      return { ...prev, [assetId]: added };
    });
  }

  function toggleAllElements(assetId: string) {
    setSelectedElements((prev) => {
      if (prev[assetId] === undefined) {
        // All selected — deselect all
        return { ...prev, [assetId]: [] };
      }
      // Not all — select all
      return { ...prev, [assetId]: undefined };
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="space-y-4">
        <Link href="/privacy/data-inventory">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {tp("backToInventory")}
          </Button>
        </Link>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {tp("notFound")}
          </CardContent>
        </Card>
      </div>
    );
  }

  const dataSubjects = (activity.dataSubjects as string[]) ?? [];
  const categories = (activity.categories as string[]) ?? [];
  const recipients = (activity.recipients as string[]) ?? [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <RecordHeader
        back={{ href: "/privacy/data-inventory/processing-activities", label: tp("back") }}
        icon={FileText}
        title={activity.name}
        badges={
          <>
            <Badge variant="outline">
              <Scale className="w-3 h-3 mr-1" />
              {enumLabel("legalBasis", activity.legalBasis)}
            </Badge>
            {!activity.isActive && <Badge variant="secondary">{tp("inactive")}</Badge>}
            <TemplateBadge metadata={activity.metadata} className="text-xs" />
          </>
        }
        actions={
          <Link href={`/privacy/data-inventory/activities/${activity.id}/edit`}>
            <Button variant="outline" size="sm">
              <Edit className="w-4 h-4 mr-2" />
              {tp("edit")}
            </Button>
          </Link>
        }
      />

      {/* Purpose & Description */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {tp("purpose")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">{activity.purpose}</p>
          {activity.description && (
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-1">{tp("description")}</p>
              <p className="text-sm text-muted-foreground">{activity.description}</p>
            </div>
          )}
          {activity.legalBasisDetail && (
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-1">{tp("legalBasisDetail")}</p>
              <p className="text-sm text-muted-foreground">{activity.legalBasisDetail}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Subjects & Categories */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" />
              {tp("dataSubjects")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dataSubjects.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {dataSubjects.map((subject) => (
                  <Badge key={subject} variant="outline" className="text-xs">
                    {subject}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{tp("noDataSubjects")}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="w-4 h-4" />
              {tp("dataCategories")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {categories.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <Badge key={cat} variant="secondary" className="text-xs">
                    {cat.replace("_", " ")}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{tp("noCategories")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Retention & Automated Decisions */}
      {(activity.retentionPeriod || activity.automatedDecisionMaking) && (
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-wrap gap-6">
              {activity.retentionPeriod && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {tp("retentionPeriod")}
                  </p>
                  <p className="text-sm">{activity.retentionPeriod}</p>
                </div>
              )}
              {activity.automatedDecisionMaking && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">{tp("automatedDecisionMaking")}</p>
                  <p className="text-sm">{activity.automatedDecisionDetail || tc("yes")}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recipients */}
      {recipients.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{tp("recipients")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {recipients.map((r) => (
                <Badge key={r} variant="outline" className="text-xs">
                  {r}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Linked Data Assets */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="w-4 h-4" />
              {tp("linkedAssets", { count: activity.assets?.length ?? 0 })}
            </CardTitle>
            <div className="flex gap-2">
              {(activity.assets?.length ?? 0) >= 2 && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={regenerateFlows.isPending}
                  onClick={() =>
                    regenerateFlows.mutate({
                      organizationId: organization?.id ?? "",
                      activityId: id,
                    })
                  }
                >
                  {regenerateFlows.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  {tp("generateFlows")}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={openLinkDialog}>
                <Plus className="w-4 h-4 mr-2" />
                {tp("manageAssets")}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {activity.assets && activity.assets.length > 0 ? (
            <div className="space-y-3">
              {activity.assets.map((link: any) => {
                const allElements = link.dataAsset.dataElements ?? [];
                const linkedEls = link.linkedElements ?? [];
                const effectiveElements = linkedEls.length > 0
                  ? linkedEls.map((le: any) => le.dataElement)
                  : allElements;
                const isFiltered = linkedEls.length > 0 && linkedEls.length < allElements.length;
                return (
                  <div key={link.dataAsset.id} className="border rounded-lg p-3 space-y-2">
                    <Link href={`/privacy/data-inventory/${link.dataAsset.id}`}>
                      <div className="flex items-center gap-3 hover:text-primary transition-colors">
                        <Database className="w-4 h-4 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{link.dataAsset.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {enumLabel("dataAssetType", link.dataAsset.type)}
                            {link.purpose && `: ${link.purpose}`}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {isFiltered
                            ? tp("elementCountOf", { count: effectiveElements.length, total: allElements.length })
                            : tp("elementCount", { count: effectiveElements.length })}
                        </Badge>
                      </div>
                    </Link>
                    {effectiveElements.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {effectiveElements.map((el: any) => (
                          <Link key={el.id} href={`/privacy/data-inventory/elements/${el.id}`}>
                            <Badge
                              variant={el.isSpecialCategory ? "destructive" : "secondary"}
                              className="text-xs font-normal cursor-pointer hover:opacity-80 py-1 px-2 min-h-[28px] inline-flex items-center"
                            >
                              {el.name}
                              <span className="ml-1 opacity-60">{el.sensitivity?.charAt(0)}</span>
                            </Badge>
                          </Link>
                        ))}
                        {isFiltered && (
                          <span className="text-xs text-muted-foreground self-center">
                            {tp("notLinked", { count: allElements.length - effectiveElements.length })}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">{tp("noLinkedAssets")}</p>
          )}
        </CardContent>
      </Card>

      {/* Data Transfers */}
      {activity.transfers && activity.transfers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4" />
              {tp("transfers", { count: activity.transfers.length })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {activity.transfers.map((transfer) => (
                <div
                  key={transfer.id}
                  className="flex items-center justify-between p-2 rounded border text-sm"
                >
                  <div>
                    <p className="font-medium">{transfer.destinationOrg ?? transfer.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {transfer.jurisdiction?.name ?? transfer.destinationCountry}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {enumLabel("transferMechanism", transfer.mechanism)}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assessments */}
      {activity.assessments && activity.assessments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4" />
              {tp("assessments", { count: activity.assessments.length })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {activity.assessments.map((assessment) => (
                <Link
                  key={assessment.id}
                  href={`/privacy/assessments/${assessment.id}`}
                  className="block rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <div className="flex items-center justify-between p-2 -mx-2 rounded hover:bg-muted/50 transition-colors">
                    <div>
                      <p className="text-sm font-medium">{assessment.name}</p>
                      {assessment.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{assessment.description}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {enumLabel("assessmentStatus", assessment.status)}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Link Assets Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{tp("linkDialog.title")}</DialogTitle>
            <DialogDescription>
              {tp("linkDialog.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
            {allAssets.length > 0 ? (
              allAssets.map((asset) => {
                const isSelected = selectedAssetIds.includes(asset.id);
                const isExpanded = expandedAssets.has(asset.id);
                const elements = (asset as any).dataElements ?? [];
                const elSelection = selectedElements[asset.id];
                const allSelected = elSelection === undefined;
                return (
                  <div key={asset.id}>
                    <div className="flex items-center gap-3 p-2 rounded hover:bg-muted/50">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleAsset(asset.id)}
                      />
                      <label
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => toggleAsset(asset.id)}
                      >
                        <p className="text-sm font-medium truncate">{asset.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {tp("linkDialog.assetMeta", { type: enumLabel("dataAssetType", asset.type), count: asset._count?.dataElements ?? 0 })}
                        </p>
                      </label>
                      {isSelected && elements.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() =>
                            setExpandedAssets((prev) => {
                              const next = new Set(prev);
                              next.has(asset.id) ? next.delete(asset.id) : next.add(asset.id);
                              return next;
                            })
                          }
                        >
                          {isExpanded ? tp("linkDialog.hide") : tp("linkDialog.elements")}
                        </Button>
                      )}
                    </div>
                    {isSelected && isExpanded && elements.length > 0 && (
                      <div className="ml-9 pl-2 border-l space-y-0.5 pb-1">
                        <label className="flex items-center gap-2 p-1 rounded hover:bg-muted/50 cursor-pointer">
                          <Checkbox
                            checked={allSelected}
                            onCheckedChange={() => toggleAllElements(asset.id)}
                          />
                          <span className="text-xs font-medium text-muted-foreground">
                            {tp("linkDialog.allElements")}
                          </span>
                        </label>
                        {elements.map((el: any) => {
                          const isElSelected = allSelected || (elSelection?.includes(el.id) ?? false);
                          return (
                            <label
                              key={el.id}
                              className="flex items-center gap-2 p-1 rounded hover:bg-muted/50 cursor-pointer"
                            >
                              <Checkbox
                                checked={isElSelected}
                                onCheckedChange={() => toggleElement(asset.id, el.id, elements.length)}
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
                {tp("linkDialog.noAssets")}
              </p>
            )}
          </div>
          <div className="flex justify-between items-center pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              {tp("linkDialog.selected", { count: selectedAssetIds.length })}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
                {tc("cancel")}
              </Button>
              <Button
                onClick={() =>
                  linkAssets.mutate({
                    organizationId: organization?.id ?? "",
                    activityId: id,
                    assets: selectedAssetIds.map((assetId) => ({
                      assetId,
                      elementIds: selectedElements[assetId],
                    })),
                  })
                }
                disabled={linkAssets.isPending}
              >
                {linkAssets.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {tc("save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
