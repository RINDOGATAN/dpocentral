"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * AiPostureCard — the per-organization AI switch (org settings page).
 *
 * Posture defaults to off: no AI calls ever happen until an OWNER/ADMIN
 * picks a posture AND ticks the acknowledgment sentence. The acknowledgment
 * is recorded as acknowledgedById/At. Non-admins see the card read-only.
 *
 * The same card holds the organisation's own API inference key
 * (#ai-inference-key): OWNER/ADMIN save or remove it; once saved, only the
 * provider, the model and the last four characters are ever shown. Where the
 * deployment requires an organisation key, AI works only with it.
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
import { Input } from "@/components/ui/input";
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
import { useTranslations, useLocale } from "next-intl";
import { trpc } from "@/lib/trpc";
import { features } from "@/config/features";
import { toneBorder, toneMark, toneTint } from "@/config/status-palette";

import { formatDateIn } from "@/lib/utils";
import { isPickerDisabled, isPostureSelectable, showPostureSave } from "@/lib/ai-posture-picker";
type Posture = "off" | "local_gateway" | "cloud_eu" | "cloud_us";

// Mirrors AI Sentinel #19: the picker offers a
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
  const tCommon = useTranslations("common");
  const locale = useLocale();
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

  const [keyProvider, setKeyProvider] = useState<string>("anthropic");
  const [keyValue, setKeyValue] = useState("");
  const [keyBaseUrl, setKeyBaseUrl] = useState("");
  const [keyModel, setKeyModel] = useState("");
  const keyError = (message: string) =>
    toast.error(message.startsWith("ai_key_") ? t(`errors.${message}`) : message);
  const setKeyMutation = trpc.ai.setKey.useMutation({
    onSuccess: () => {
      toast.success(t("keyCard.saved"));
      setKeyValue("");
      utils.ai.getStatus.invalidate();
    },
    onError: (e) => keyError(e.message),
  });
  const removeKeyMutation = trpc.ai.removeKey.useMutation({
    onSuccess: () => {
      toast.success(t("keyCard.removed"));
      utils.ai.getStatus.invalidate();
    },
    onError: (e) => keyError(e.message),
  });

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
  const pickerState = {
    isAdmin,
    pending: setPostureMutation.isPending,
    usJurisdictionBlocked: status.usJurisdictionBlocked,
    posture,
    dirty,
  };

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
            disabled={isPickerDisabled(pickerState)}
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
                  <SelectItem key={p} value={p} disabled={!isPostureSelectable(p, status.usJurisdictionBlocked)}>
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
          {status.usJurisdictionBlocked && (
            <p className="text-xs text-muted-foreground">{t("errors.ai_us_jurisdiction")}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {status.configured
              ? t("postureCard.engineConfigured", { provider: status.providerName ?? tCommon("notStated") })
              : status.orgKeyRequired
                ? t("errors.ai_key_required")
                : t("postureCard.engineNotConfigured")}
          </p>
        </div>

        {showNotConfiguredWarning && (
          <div className={`flex items-start gap-2 p-3 rounded-md border text-sm ${toneBorder("warning")} ${toneTint("warning")}`}>
            <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${toneMark("warning")}`} />
            <span>{status.orgKeyRequired ? t("errors.ai_key_required") : t("postureCard.notConfiguredWarning")}</span>
          </div>
        )}

        {status.acknowledgedAt && status.acknowledgedBy && (
          <p className="text-xs text-muted-foreground">
            {t("postureCard.acknowledgedBy", {
              name: status.acknowledgedBy.name || status.acknowledgedBy.email || tCommon("notStated"),
              date: formatDateIn(new Date(status.acknowledgedAt), locale),
            })}
          </p>
        )}

        {showPostureSave(pickerState) && (
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
                  <li>{t("postureCard.ackBullets.provider")}</li>
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

        <div id="ai-inference-key" className="space-y-3 border-t pt-4 scroll-mt-24" data-testid="ai-inference-key">
          <div className="space-y-1">
            <p className="text-sm font-medium">{t("keyCard.title")}</p>
            <p className="text-xs text-muted-foreground">
              {status.orgKeyRequired ? t("keyCard.leadRequired") : t("keyCard.leadOptional")}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {status.key.state === "unreadable"
              ? t("keyCard.unreadable")
              : status.key.last4 && status.key.setAt
                ? `${t("keyCard.current", {
                    provider: status.providers.find((p) => p.id === status.key.provider)?.label ?? status.key.provider ?? "",
                    last4: status.key.last4,
                    date: formatDateIn(new Date(status.key.setAt), locale),
                  })}${status.key.model ? ` ${t("keyCard.currentModel", { model: status.key.model })}` : ""}`
                : t("keyCard.none")}
          </p>
          {isAdmin ? (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                setKeyMutation.mutate({
                  organizationId,
                  provider: keyProvider,
                  apiKey: keyValue,
                  baseUrl: keyProvider === "openai_compatible" ? keyBaseUrl : null,
                  model: keyModel || null,
                });
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="ai-key-provider">{t("keyCard.provider")}</Label>
                  <Select value={keyProvider} onValueChange={setKeyProvider}>
                    <SelectTrigger id="ai-key-provider">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {status.providers.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ai-key-model">{t("keyCard.model")}</Label>
                  <Input id="ai-key-model" value={keyModel} onChange={(e) => setKeyModel(e.target.value)} autoComplete="off" />
                  <p className="text-xs text-muted-foreground">
                    {(() => {
                      const def = status.providers.find((p) => p.id === keyProvider)?.defaultModel;
                      return def ? t("keyCard.modelHint", { model: def }) : t("keyCard.modelRequired");
                    })()}
                  </p>
                </div>
              </div>
              {keyProvider === "openai_compatible" && (
                <div className="space-y-1">
                  <Label htmlFor="ai-key-base-url">{t("keyCard.baseUrl")}</Label>
                  <Input
                    id="ai-key-base-url"
                    type="url"
                    value={keyBaseUrl}
                    onChange={(e) => setKeyBaseUrl(e.target.value)}
                    placeholder="https://api.example.com/v1"
                    autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground">{t("keyCard.baseUrlHint")}</p>
                </div>
              )}
              <div className="space-y-1">
                <Label htmlFor="ai-key-value">{t("keyCard.key")}</Label>
                <Input
                  id="ai-key-value"
                  type="password"
                  value={keyValue}
                  onChange={(e) => setKeyValue(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
                <p className="text-xs text-muted-foreground">{t("keyCard.keyHint")}</p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {status.key.state !== "none" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={removeKeyMutation.isPending}
                    onClick={() => removeKeyMutation.mutate({ organizationId })}
                  >
                    {t("keyCard.remove")}
                  </Button>
                )}
                <Button type="submit" size="sm" disabled={!keyValue.trim() || setKeyMutation.isPending}>
                  {setKeyMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {t("keyCard.save")}
                </Button>
              </div>
            </form>
          ) : (
            <p className="text-xs text-muted-foreground">{t("keyCard.adminOnly")}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
