"use client";

import { useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { EnableFeatureModal } from "@/components/premium/enable-feature-modal";
import { EnableMultipleFeaturesModal } from "@/components/premium/enable-multiple-features-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { features } from "@/config/features";

export default function BillingPage() {
  const { organization } = useOrganization();
  const [enableSkill, setEnableSkill] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [enableSkills, setEnableSkills] = useState<
    { id: string; name: string }[] | null
  >(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [cancelSkill, setCancelSkill] = useState<{
    entitlementId: string;
    name: string;
  } | null>(null);

  const { data: status, isLoading: statusLoading } =
    trpc.billing.getSubscriptionStatus.useQuery(
      { organizationId: organization?.id ?? "" },
      { enabled: !!organization?.id }
    );

  const { data: plans, isLoading: plansLoading } =
    trpc.billing.getAvailablePlans.useQuery(
      { organizationId: organization?.id ?? "" },
      { enabled: !!organization?.id }
    );

  const utils = trpc.useUtils();

  const cancelFeature = trpc.billing.cancelFeature.useMutation({
    onSuccess: () => {
      setCancelSkill(null);
      utils.billing.getSubscriptionStatus.invalidate();
      utils.billing.getAvailablePlans.invalidate();
    },
  });

  if (statusLoading || plansLoading || !organization) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const entitlements = status?.entitlements ?? [];
  const entitlementsBySkill = new Map(
    entitlements.map((e) => [e.skillId, e])
  );

  // Build rows from available plans (all premium add-ons)
  const addOnRows = (plans ?? []).map((pkg) => {
    const entitlement = entitlementsBySkill.get(pkg.skillId);
    const isActive = !!entitlement || pkg.isEntitled;
    return {
      id: pkg.id,
      skillId: pkg.skillId,
      name: pkg.name,
      isActive,
      entitlementId: entitlement?.id ?? null,
      stripeSubscriptionId: entitlement?.stripeSubscriptionId ?? null,
      renewsAt: entitlement?.expiresAt
        ? new Date(entitlement.expiresAt).toLocaleDateString()
        : null,
    };
  });

  const inactiveRows = addOnRows.filter((r) => !r.isActive);
  const activeCount = addOnRows.filter((r) => r.isActive).length;
  const monthlyTotal = activeCount * 9;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === inactiveRows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(inactiveRows.map((r) => r.id)));
    }
  };

  const handleEnableSelected = () => {
    const selected = inactiveRows
      .filter((r) => selectedIds.has(r.id))
      .map((r) => ({ id: r.id, name: r.name }));
    if (selected.length === 1) {
      setEnableSkill(selected[0]);
    } else if (selected.length > 1) {
      setEnableSkills(selected);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-muted-foreground">
          Manage your add-on features
        </p>
      </div>

      {/* Add-on features table */}
      <Card>
        <CardHeader>
          <CardTitle>Add-on Features</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                {features.selfServiceUpgrade && inactiveRows.length > 0 && (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={
                        inactiveRows.length > 0 &&
                        selectedIds.size === inactiveRows.length
                      }
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all inactive features"
                    />
                  </TableHead>
                )}
                <TableHead>Feature</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Details</TableHead>
                {features.selfServiceUpgrade && (
                  <TableHead className="w-24"></TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {addOnRows.map((row) => (
                <TableRow key={row.id}>
                  {features.selfServiceUpgrade && inactiveRows.length > 0 && (
                    <TableCell>
                      {!row.isActive ? (
                        <Checkbox
                          checked={selectedIds.has(row.id)}
                          onCheckedChange={() => toggleSelect(row.id)}
                          aria-label={`Select ${row.name}`}
                        />
                      ) : null}
                    </TableCell>
                  )}
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>
                    {row.isActive ? (
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        <span className="text-sm">Active</span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Inactive</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.isActive ? (
                      row.renewsAt ? (
                        <span className="text-sm text-muted-foreground">
                          Renews {row.renewsAt}
                        </span>
                      ) : (
                        <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                          Active
                        </Badge>
                      )
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">€9/mo</span>
                        {features.selfServiceUpgrade && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setEnableSkill({ id: row.id, name: row.name })
                            }
                          >
                            Enable
                          </Button>
                        )}
                      </div>
                    )}
                  </TableCell>
                  {features.selfServiceUpgrade && (
                    <TableCell>
                      {row.isActive && row.stripeSubscriptionId && row.entitlementId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() =>
                            setCancelSkill({
                              entitlementId: row.entitlementId!,
                              name: row.name,
                            })
                          }
                        >
                          Cancel
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Selection summary */}
          {features.selfServiceUpgrade && selectedIds.size > 0 && (
            <div className="mt-4 flex items-center justify-between rounded-lg border p-3">
              <p className="text-sm text-muted-foreground">
                {selectedIds.size} feature{selectedIds.size !== 1 ? "s" : ""} selected
                &mdash; €{selectedIds.size * 9}/month
              </p>
              <Button size="sm" onClick={handleEnableSelected}>
                Enable Selected ({selectedIds.size})
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly total */}
      {activeCount > 0 && (
        <div className="text-sm text-muted-foreground">
          <p>
            Your current monthly total:{" "}
            <span className="font-semibold text-foreground">€{monthlyTotal}</span>
          </p>
          <p>
            Based on {activeCount} active add-on{activeCount !== 1 ? "s" : ""} at
            €9/month each.
          </p>
        </div>
      )}

      {/* Cancel confirmation */}
      {cancelSkill && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm">
              Cancel <span className="font-semibold">{cancelSkill.name}</span>?
              You&apos;ll lose access immediately and receive a prorated credit.
            </p>
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCancelSkill(null)}
                disabled={cancelFeature.isPending}
              >
                Keep Feature
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() =>
                  cancelFeature.mutate({
                    organizationId: organization.id,
                    entitlementId: cancelSkill.entitlementId,
                  })
                }
                disabled={cancelFeature.isPending}
              >
                {cancelFeature.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : null}
                Confirm Cancellation
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Enable single feature modal */}
      {enableSkill && (
        <EnableFeatureModal
          open={!!enableSkill}
          onClose={() => setEnableSkill(null)}
          organizationId={organization.id}
          skillPackageId={enableSkill.id}
          skillName={enableSkill.name}
        />
      )}

      {/* Enable multiple features modal */}
      {enableSkills && (
        <EnableMultipleFeaturesModal
          open={!!enableSkills}
          onClose={() => {
            setEnableSkills(null);
            setSelectedIds(new Set());
          }}
          organizationId={organization.id}
          skills={enableSkills}
        />
      )}
    </div>
  );
}
