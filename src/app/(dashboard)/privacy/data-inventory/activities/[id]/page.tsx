"use client";

import { useState } from "react";
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
  FileText,
  Scale,
  Users,
  Clock,
  ArrowRightLeft,
  ClipboardCheck,
  Loader2,
  Plus,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";

const legalBasisLabels: Record<string, string> = {
  CONSENT: "Consent",
  CONTRACT: "Contract",
  LEGAL_OBLIGATION: "Legal Obligation",
  VITAL_INTERESTS: "Vital Interests",
  PUBLIC_TASK: "Public Task",
  LEGITIMATE_INTERESTS: "Legitimate Interests",
};

export default function ActivityDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { organization } = useOrganization();
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);

  const utils = trpc.useUtils();

  const { data: activity, isLoading } = trpc.dataInventory.getActivity.useQuery(
    { organizationId: organization?.id ?? "", id },
    { enabled: !!organization?.id && !!id }
  );

  const { data: allAssetsPages } = trpc.dataInventory.listAssets.useInfiniteQuery(
    { organizationId: organization?.id ?? "", limit: 200 },
    {
      enabled: !!organization?.id && linkDialogOpen,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );
  const allAssets = allAssetsPages?.pages.flatMap((p) => p.assets) ?? [];

  const linkAssets = trpc.dataInventory.linkAssets.useMutation({
    onSuccess: () => {
      utils.dataInventory.getActivity.invalidate({ organizationId: organization?.id ?? "", id });
      setLinkDialogOpen(false);
    },
  });

  function openLinkDialog() {
    // Pre-select currently linked assets
    const currentIds = activity?.assets?.map((a) => a.dataAsset.id) ?? [];
    setSelectedAssetIds(currentIds);
    setLinkDialogOpen(true);
  }

  function toggleAsset(assetId: string) {
    setSelectedAssetIds((prev) =>
      prev.includes(assetId)
        ? prev.filter((id) => id !== assetId)
        : [...prev, assetId]
    );
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
            Back to Data Inventory
          </Button>
        </Link>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Processing activity not found
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
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/privacy/data-inventory?tab=activities">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Activities
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold truncate">{activity.name}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="outline">
              <Scale className="w-3 h-3 mr-1" />
              {legalBasisLabels[activity.legalBasis] || activity.legalBasis}
            </Badge>
            {!activity.isActive && <Badge variant="secondary">Inactive</Badge>}
          </div>
        </div>
      </div>

      {/* Purpose & Description */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Purpose
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">{activity.purpose}</p>
          {activity.description && (
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-1">Description</p>
              <p className="text-sm text-muted-foreground">{activity.description}</p>
            </div>
          )}
          {activity.legalBasisDetail && (
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-1">Legal Basis Detail</p>
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
              Data Subjects
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
              <p className="text-sm text-muted-foreground">No data subjects specified</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="w-4 h-4" />
              Data Categories
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
              <p className="text-sm text-muted-foreground">No categories specified</p>
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
                    Retention Period
                  </p>
                  <p className="text-sm">{activity.retentionPeriod}</p>
                </div>
              )}
              {activity.automatedDecisionMaking && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Automated Decision-Making</p>
                  <p className="text-sm">{activity.automatedDecisionDetail || "Yes"}</p>
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
            <CardTitle className="text-base">Recipients</CardTitle>
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
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="w-4 h-4" />
              Linked Data Assets ({activity.assets?.length ?? 0})
            </CardTitle>
            <Button variant="outline" size="sm" onClick={openLinkDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Manage Assets
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {activity.assets && activity.assets.length > 0 ? (
            <div className="space-y-2">
              {activity.assets.map((link) => (
                <Link
                  key={link.dataAsset.id}
                  href={`/privacy/data-inventory/${link.dataAsset.id}`}
                  className="block"
                >
                  <div className="flex items-center gap-3 p-2 -mx-2 rounded hover:bg-muted/50 transition-colors">
                    <Database className="w-4 h-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{link.dataAsset.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {link.dataAsset.dataElements?.length ?? 0} data elements
                      </p>
                    </div>
                    {link.purpose && (
                      <span className="text-xs text-muted-foreground hidden sm:inline">
                        {link.purpose}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No data assets linked to this activity</p>
          )}
        </CardContent>
      </Card>

      {/* Data Transfers */}
      {activity.transfers && activity.transfers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4" />
              Data Transfers ({activity.transfers.length})
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
                    {transfer.mechanism.replace("_", " ")}
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
              Assessments ({activity.assessments.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {activity.assessments.map((assessment) => (
                <Link
                  key={assessment.id}
                  href={`/privacy/assessments/${assessment.id}`}
                  className="block"
                >
                  <div className="flex items-center justify-between p-2 -mx-2 rounded hover:bg-muted/50 transition-colors">
                    <div>
                      <p className="text-sm font-medium">{assessment.name}</p>
                      {assessment.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{assessment.description}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {assessment.status}
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
            <DialogTitle>Link Data Assets</DialogTitle>
            <DialogDescription>
              Select which data assets are processed by this activity.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
            {allAssets.length > 0 ? (
              allAssets.map((asset) => (
                <label
                  key={asset.id}
                  className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedAssetIds.includes(asset.id)}
                    onCheckedChange={() => toggleAsset(asset.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{asset.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {asset.type?.replace("_", " ")} — {asset._count?.dataElements ?? 0} elements
                    </p>
                  </div>
                </label>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No data assets in this organization yet
              </p>
            )}
          </div>
          <div className="flex justify-between items-center pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              {selectedAssetIds.length} asset{selectedAssetIds.length !== 1 ? "s" : ""} selected
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  linkAssets.mutate({
                    organizationId: organization?.id ?? "",
                    activityId: id,
                    assetIds: selectedAssetIds,
                  })
                }
                disabled={linkAssets.isPending}
              >
                {linkAssets.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
