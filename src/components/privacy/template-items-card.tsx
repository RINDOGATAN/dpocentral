"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * "Remove all template items": clears the vendors, data assets and processing
 * activities the quick start or an industry template created silently, but only
 * the ones nobody has edited. It shows how many will go and how many stay, and
 * asks once before acting. Owners and admins only.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { LayoutTemplate, Trash2, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function TemplateItemsCard({
  organizationId,
  canManage,
}: {
  organizationId: string;
  canManage: boolean;
}) {
  const t = useTranslations("pages.settings.templateItems");
  const utils = trpc.useUtils();
  const [confirming, setConfirming] = useState(false);

  const { data: plan } = trpc.organization.templateItemsPlan.useQuery(
    { organizationId },
    { staleTime: 30 * 1000, enabled: !!organizationId },
  );

  const remove = trpc.organization.removeTemplateItems.useMutation({
    onSuccess: async (res) => {
      setConfirming(false);
      await utils.organization.templateItemsPlan.invalidate();
      toast.success(t("removed", { count: res.total }));
    },
    onError: (err) => {
      setConfirming(false);
      toast.error(err.message);
    },
  });

  // Nothing to offer if no unedited template items remain.
  if (!plan || plan.totalRemove === 0) return null;

  return (
    <Card data-testid="template-items-card">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <LayoutTemplate className="w-4 h-4 text-primary" aria-hidden="true" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("lead")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">
          {t("count", { remove: plan.totalRemove, keep: plan.totalKeep })}
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {[
            `${plan.vendors.remove} ${t("vendors")}`,
            `${plan.dataAssets.remove} ${t("dataAssets")}`,
            `${plan.processingActivities.remove} ${t("processingActivities")}`,
          ].join(" · ")}
        </p>
        <p className="text-xs text-muted-foreground">{t("keptNote")}</p>
        {canManage &&
          (confirming ? (
            <div className="flex items-center gap-2">
              <Button
                variant="destructive"
                size="sm"
                disabled={remove.isPending}
                onClick={() => remove.mutate({ organizationId })}
              >
                {remove.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
                )}
                {t("confirm", { count: plan.totalRemove })}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={remove.isPending}
                onClick={() => setConfirming(false)}
              >
                {t("cancel")}
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
              <Trash2 className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
              {t("button")}
            </Button>
          ))}
      </CardContent>
    </Card>
  );
}
