// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

"use client";

/**
 * The organisation's link to AI Sentinel (src/server/services/suite/link-ais.ts):
 * its state, the sync on demand and the way to undo it; or, before a link,
 * the way to make one.
 */
import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { trpc } from "@/lib/trpc";

function formatDay(locale: string, iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(locale === "es" ? "es-ES" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function AiSentinelLinkCard({ organizationId }: { organizationId: string }) {
  const t = useTranslations("suite");
  const locale = useLocale();
  const utils = trpc.useUtils();
  const [confirm, setConfirm] = useState(false);
  const { data } = trpc.suite.status.useQuery({ organizationId }, { enabled: !!organizationId });
  const sync = trpc.suite.syncNow.useMutation({
    onSuccess: () => {
      toast.success(t("synced"));
      void utils.suite.invalidate();
      void utils.aiGovernance.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  const unlink = trpc.suite.unlink.useMutation({
    onSuccess: () => {
      toast.success(t("unlinked"));
      setConfirm(false);
      void utils.suite.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  if (!data?.configured) return null;
  const link = data.link;

  return (
    <Card data-testid="ais-link-card">
      <CardContent className="p-4 space-y-2 text-sm">
        <p className="font-semibold flex items-center gap-2">
          <Link2 className="w-4 h-4" />
          {t("cardTitle")}
        </p>
        {link?.active ? (
          <>
            <p className="text-muted-foreground">
              {t("cardLinked", { name: link.aisOrganizationName, date: formatDay(locale, link.linkedAt) })}
            </p>
            <p>{t("cardFromAis", { count: data.fromAiSentinel })}</p>
            {link.lastSyncAt && <p className="text-xs text-muted-foreground">{t("cardLastSync", { date: formatDay(locale, link.lastSyncAt) })}</p>}
            {link.lastSyncError && <p className="text-xs">{t("cardSyncError", { error: link.lastSyncError })}</p>}
            {data.canManage && (
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" variant="outline" disabled={sync.isPending} onClick={() => sync.mutate({ organizationId })}>
                  {t("syncNow")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirm(true)}>
                  {t("unlink")}
                </Button>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-muted-foreground">{t("cardNotLinked")}</p>
            {data.canManage && (
              <Button asChild size="sm">
                <Link href="/privacy/suite/ai-sentinel">{t("cardLink")}</Link>
              </Button>
            )}
          </>
        )}
      </CardContent>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t("unlinkTitle")}
        description={t("unlinkBody")}
        confirmText={t("unlink")}
        danger
        pending={unlink.isPending}
        onConfirm={() => unlink.mutate({ organizationId })}
      />
    </Card>
  );
}
