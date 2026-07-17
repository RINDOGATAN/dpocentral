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

const POSTURES = ["off", "local_gateway", "cloud_eu", "cloud_us"] as const;
type Posture = (typeof POSTURES)[number];

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
              {POSTURES.map((p) => (
                <SelectItem key={p} value={p}>
                  {t(`posture.${p}`)}
                </SelectItem>
              ))}
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
              />
              <Label
                htmlFor="ai-posture-ack"
                className="text-xs font-normal leading-relaxed cursor-pointer"
              >
                {t("postureCard.acknowledgment")}
              </Label>
            </div>
            <div className="flex justify-end">
              <Button
                size="sm"
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
