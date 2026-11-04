"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Settings: where the organisation operates. The places chosen decide the
 * laws on record (src/config/jurisdiction-places.ts), and the laws set the
 * deadlines for rights requests and breach notifications. Saved with
 * regulations.setJurisdictions; writers only (enforced server-side).
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { JurisdictionPicker } from "@/components/privacy/jurisdiction-picker";
import { isPlaceCode } from "@/config/jurisdiction-places";
import { trpc } from "@/lib/trpc";

export function JurisdictionsCard({ organizationId, canWrite }: { organizationId: string; canWrite: boolean }) {
  const t = useTranslations("pages.settings.jurisdictions");
  const utils = trpc.useUtils();
  const { data } = trpc.regulations.listApplied.useQuery({ organizationId });
  const [codes, setCodes] = useState<string[] | null>(null);
  const stored = (data?.jurisdictions ?? []).map((j) => j.code).filter((c) => isPlaceCode(c));

  useEffect(() => {
    if (data && codes === null) setCodes(stored);
    // Only the first load seeds the choice; later edits are the person's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const save = trpc.regulations.setJurisdictions.useMutation({
    onSuccess: () => {
      toast.success(t("saved"));
      void utils.regulations.listApplied.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const value = codes ?? stored;
  return (
    <Card data-testid="jurisdictions-card">
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <JurisdictionPicker value={value} onChange={setCodes} disabled={!canWrite || save.isPending} />
        {canWrite && (
          <Button
            onClick={() => save.mutate({ organizationId, codes: value })}
            disabled={save.isPending || value.length === 0}
          >
            {t("save")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
