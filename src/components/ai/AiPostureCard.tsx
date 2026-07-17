"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * AiPostureCard — the per-organization AI switch (org settings page).
 *
 * Posture defaults to off: no AI calls ever happen until an OWNER/ADMIN
 * picks a posture AND ticks the acknowledgment sentence. The acknowledgment
 * is recorded as acknowledgedById/At. Non-admins see the card read-only.
 */

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { features } from "@/config/features";

type Posture = "off" | "local_gateway" | "cloud_eu" | "cloud_us";

// Product decision (2026-07-17, mirrors AI Sentinel #19): the picker offers a
// SIMPLE choice — Off, Cloud LLM, or Local gateway (the latter only meaningful
// on self-host). "Cloud LLM" is stored as `cloud_us` (the enum keeps all four
// values — append-only DB discipline and canonical-door parity — and with a
// single base engine every lane routes identically, so the recorded posture
// and the physical traffic stay the same fact). `cloud_eu` remains valid for
// any org that already saved it and is shown only in that legacy case.
const OFFERED_POSTURES: readonly Posture[] = ["off", "cloud_us", "local_gateway"];

interface AiPostureCardProps {
  organizationId: string;
  isAdmin: boolean;
}

export function AiPostureCard({ organizationId, isAdmin }: AiPostureCardProps) {
  const t = useTranslations("ai");
  const utils = trpc.useUtils();

  const { data: status } = trpc.ai.getStatus.useQuery(
    { organizationId },
    { enabled: features.aiAssistEnabled && !!organizationId }
  );

  const [posture, setPosture] = useState<Posture>("off");
  const [dirty, setDirty] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    if (status && !dirty) {
      setPosture(status.posture as Posture);
    }
  }, [status, dirty]);

  const setPostureMutation = trpc.ai.setPosture.useMutation({
    onSuccess: () => {
      toast.success(t("postureCard.saved"));
      utils.ai.getStatus.invalidate();
      setDirty(false);
      setAcknowledged(false);
    },
    onError: (e) => toast.error(e.message),
  });

  if (!features.aiAssistEnabled || !status) return null;

  const showNotConfiguredWarning = posture !== "off" && !status.configured;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="w-4 h-4" /> {t("postureCard.title")}
        </CardTitle>
        <CardDescription>{t("postureCard.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>{t("postureCard.postureLabel")}</Label>
          <Select
            value={posture}
            onValueChange={(v) => {
              setPosture(v as Posture);
              setDirty(true);
            }}
            disabled={!isAdmin || setPostureMutation.isPending}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(OFFERED_POSTURES.includes(posture)
                ? OFFERED_POSTURES
                : [...OFFERED_POSTURES, posture]
              ).map((p) => {
                // Per-lane engine availability tag so an admin can't pick a
                // lane with no engine without seeing it. Selection stays
                // allowed — the server still answers ai_not_configured.
                const laneAvailable = p === "off" ? null : status.lanes?.[p];
                return (
                  <SelectItem key={p} value={p}>
                    <span className="flex items-center gap-2">
                      {t(`posture.${p}`)}
                      {laneAvailable !== null && laneAvailable !== undefined && (
                        <span
                          className={`text-[10px] leading-none px-1.5 py-0.5 rounded-full border ${
                            laneAvailable
                              ? "border-primary/50 text-primary"
                              : "border-muted-foreground/40 text-muted-foreground"
                          }`}
                        >
                          {laneAvailable
                            ? t("postureCard.laneAvailable")
                            : t("postureCard.laneUnavailable")}
                        </span>
                      )}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {status.configured
              ? t("postureCard.engineConfigured", { provider: status.providerName ?? "—" })
              : t("postureCard.engineNotConfigured")}
          </p>
        </div>

        {showNotConfiguredWarning && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-yellow-50 dark:bg-yellow-950 text-sm">
            <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 shrink-0" />
            <span>{t("postureCard.notConfiguredWarning")}</span>
          </div>
        )}

        {status.acknowledgedAt && status.acknowledgedBy && (
          <p className="text-xs text-muted-foreground">
            {t("postureCard.acknowledgedBy", {
              name: status.acknowledgedBy.name || status.acknowledgedBy.email || "—",
              date: new Date(status.acknowledgedAt).toLocaleDateString(),
            })}
          </p>
        )}

        {isAdmin && dirty && (
          <>
            <div className="flex items-start gap-2">
              <Checkbox
                id="ai-posture-ack"
                checked={acknowledged}
                onCheckedChange={(checked) => setAcknowledged(checked === true)}
                className="mt-0.5"
              />
              <div className="space-y-1">
                <Label
                  htmlFor="ai-posture-ack"
                  className="text-xs font-medium leading-relaxed cursor-pointer"
                >
                  {t("postureCard.ackLabel")}
                </Label>
                <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                  <li>{t("postureCard.ackBullets.data")}</li>
                  <li>{t("postureCard.ackBullets.review")}</li>
                  <li>{t("postureCard.ackBullets.off")}</li>
                </ul>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Button
                size="sm"
                className="disabled:opacity-40"
                disabled={!acknowledged || setPostureMutation.isPending}
                onClick={() =>
                  setPostureMutation.mutate({
                    organizationId,
                    posture,
                    acknowledged: true,
                  })
                }
              >
                {setPostureMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {t("postureCard.save")}
              </Button>
              {!acknowledged && (
                <p className="text-xs text-muted-foreground">
                  {t("postureCard.ackRequiredHint")}
                </p>
              )}
            </div>
          </>
        )}

        {!isAdmin && (
          <p className="text-xs text-muted-foreground">{t("postureCard.adminOnly")}</p>
        )}
      </CardContent>
    </Card>
  );
}
