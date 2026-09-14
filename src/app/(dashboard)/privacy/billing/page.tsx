"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, Clock } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { EnableFeatureModal } from "@/components/premium/enable-feature-modal";
import { EnableMultipleFeaturesModal } from "@/components/premium/enable-multiple-features-modal";
import { COMING_SOON_SKILL_IDS, SKILL_PRICE_UNITS } from "@/config/skill-packages";
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
import { formatPrice, getCurrency, type Currency } from "@/lib/currency";

export default function BillingPage() {
  const router = useRouter();
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

  // Self-hosted (Stripe disabled): there is nothing to bill — every feature
  // is included. Showing "Inactive — price/year" rows here would contradict the
  // Skills page ("Installed"/"Included"), so redirect there instead.
  useEffect(() => {
    if (!features.stripeEnabled) {
      router.replace("/privacy/skills");
    }
  }, [router]);

  if (!features.stripeEnabled) return null;

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
    // A TRIAL row is the flip-day grace (scripts/grant-paywall-grace.ts):
    // the module still works, but it is not bought — offer it for purchase.
    const isTrial = entitlement?.licenseType === "TRIAL";
    const isActive = (!!entitlement && !isTrial) || pkg.isEntitled;
    const isComingSoon = COMING_SOON_SKILL_IDS.has(pkg.skillId);
    return {
      id: pkg.id,
      skillId: pkg.skillId,
      name: pkg.name,
      // Price per module from the package row (seeded from
      // src/config/skill-packages.ts); the constant is only a fallback.
      priceUnits: pkg.priceAmount != null ? pkg.priceAmount / 100 : SKILL_PRICE_UNITS,
      // The row's currency, unless the visitor is on the USD override that
      // checkout applies by geo-IP (STRIPE_PRICE_ID_USD, same amount in USD).
      priceCurrency: (getCurrency() === "USD"
        ? "USD"
        : pkg.priceCurrency?.toUpperCase() === "USD"
          ? "USD"
          : "EUR") as Currency,
      perInterval: pkg.billingInterval === "MONTH" ? "/month" : "/year",
      isActive,
      isTrial,
      isComingSoon,
      entitlementId: entitlement?.id ?? null,
      stripeSubscriptionId: entitlement?.stripeSubscriptionId ?? null,
      renewsAt: entitlement?.expiresAt
        ? new Date(entitlement.expiresAt).toLocaleDateString()
        : null,
    };
  });

  const inactiveRows = addOnRows.filter((r) => !r.isActive && !r.isComingSoon);
  const activeRows = addOnRows.filter((r) => r.isActive);
  const activeCount = activeRows.length;
  const annualTotal = activeRows.reduce((sum, r) => sum + r.priceUnits, 0);
  const selectedTotal = inactiveRows
    .filter((r) => selectedIds.has(r.id))
    .reduce((sum, r) => sum + r.priceUnits, 0);
  const graceEndsAt = addOnRows
    .filter((r) => r.isTrial && r.renewsAt)
    .map((r) => r.renewsAt)[0] ?? null;

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

      {/* Paywall grace period: the organization pre-dates hosted billing */}
      {graceEndsAt && (
        <Card className="border-amber-500/50">
          <CardContent className="pt-6">
            <p className="text-sm">
              Add-on features you were already using stay available until{" "}
              <span className="font-semibold">{graceEndsAt}</span>. Enable them
              below before then to keep access.
            </p>
          </CardContent>
        </Card>
      )}

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
                <TableRow key={row.id} className={row.isComingSoon ? "opacity-60" : ""}>
                  {features.selfServiceUpgrade && inactiveRows.length > 0 && (
                    <TableCell>
                      {!row.isActive && !row.isComingSoon ? (
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
                    {row.isComingSoon ? (
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-amber-500" />
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-500">Coming Soon</Badge>
                      </div>
                    ) : row.isActive ? (
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        <span className="text-sm">Active</span>
                      </div>
                    ) : row.isTrial ? (
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-amber-500" />
                        <span className="text-sm">Trial until {row.renewsAt}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Inactive</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.isComingSoon ? (
                      <span className="text-sm text-muted-foreground">-</span>
                    ) : row.isActive ? (
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
                        <span className="text-sm text-muted-foreground">{formatPrice(row.priceUnits, row.priceCurrency)}{row.perInterval}</span>
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
                      {row.isActive && !row.isComingSoon && row.stripeSubscriptionId && row.entitlementId && (
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
                &mdash; {formatPrice(selectedTotal)}/year
              </p>
              <Button size="sm" onClick={handleEnableSelected}>
                Enable Selected ({selectedIds.size})
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Annual total */}
      {activeCount > 0 && (
        <div className="text-sm text-muted-foreground">
          <p>
            Your current annual total:{" "}
            <span className="font-semibold text-foreground">{formatPrice(annualTotal)}</span>
          </p>
          <p>
            Based on {activeCount} active add-on{activeCount !== 1 ? "s" : ""},
            billed yearly.
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
