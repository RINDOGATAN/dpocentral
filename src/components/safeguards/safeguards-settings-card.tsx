"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Settings: the safeguards question, next to the AI setting.
 * Hosted service only (nothing renders on the kit). An owner or admin can
 * change the answer; answers b and c can send the short request form.
 */

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { isEmailNotAcceptedError } from "@/components/ui/email-not-accepted";
import { formatDateIn } from "@/lib/utils";
import { useNamesEuHosting } from "@/components/region-provider";
import {
  SafeguardsChoiceList,
  SafeguardsRequestForm,
  isRequestChoice,
  type AnswerChoice,
} from "./safeguards-parts";

export function SafeguardsSettingsCard({
  organizationId,
  isAdmin,
}: {
  organizationId: string;
  isAdmin: boolean;
}) {
  const t = useTranslations("safeguards");
  const locale = useLocale();
  const euCopy = useNamesEuHosting();
  const utils = trpc.useUtils();
  const { data: status } = trpc.safeguards.getStatus.useQuery(
    { organizationId },
    { enabled: !!organizationId }
  );

  const [picked, setChoice] = useState<AnswerChoice | null>(null);
  const [dirty, setDirty] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const stored = status?.hosted ? status.choice : null;
  // Until the person picks, the stored answer is shown; "decide later" is
  // shown as answer a, which is what it counts as.
  const choice: AnswerChoice | null = dirty
    ? picked
    : stored === "later"
      ? "shared_eu"
      : (stored as AnswerChoice | null);

  const refresh = () => {
    setDirty(false);
    utils.safeguards.getStatus.invalidate({ organizationId });
  };

  const setChoiceMutation = trpc.safeguards.setChoice.useMutation({
    onSuccess: () => {
      toast.success(t("settings.saved"));
      refresh();
    },
    onError: () => toast.error(t("welcome.saveError")),
  });

  const submitRequest = trpc.safeguards.submitRequest.useMutation({
    onSuccess: () => {
      setFormError(null);
      setSent(true);
      refresh();
    },
    onError: (err) =>
      setFormError(isEmailNotAcceptedError(err)
          ? err.message
          : err.data?.code === "CONFLICT" ? t("form.alreadyOpen") : t("form.sendError")),
  });

  if (!status?.hosted) return null;

  // The shared cloud and "decide later" name EU hosting only where EU copy is shown.
  const sfx = euCopy ? "" : "OutsideEu";
  const storedLabel = !stored
    ? null
    : stored === "shared_eu" || stored === "later"
      ? t(`choices.${stored}.title${sfx}`)
      : t(`choices.${stored}.title`);
  const showForm =
    isAdmin && dirty && isRequestChoice(choice) && !status.openRequest && !sent;

  return (
    <Card id="safeguards">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" aria-hidden />
          {t("settings.title")}
        </CardTitle>
        <CardDescription>{t("settings.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm">
          {storedLabel ? t("settings.current", { choice: storedLabel }) : t(`settings.none${sfx}`)}
        </p>
        {status.openRequest && (
          <p className="text-sm text-muted-foreground">
            {t("settings.openRequest", {
              date: formatDateIn(status.openRequest.createdAt, locale),
            })}
          </p>
        )}
        {sent && (
          <p role="status" className="text-sm text-muted-foreground">
            {t("sent.text")}
          </p>
        )}

        {isAdmin ? (
          <>
            <SafeguardsChoiceList
              legend={t("settings.question")}
              value={choice}
              onChange={(next) => {
                setChoice(next);
                setDirty(true);
                setSent(false);
              }}
              disabled={setChoiceMutation.isPending || submitRequest.isPending}
            />
            {showForm ? (
              <div className="space-y-3 rounded-md border p-4">
                <p className="text-sm font-medium">{t("form.title")}</p>
                <p className="text-sm text-muted-foreground">{t("form.intro")}</p>
                <SafeguardsRequestForm
                  prefill={status.prefill}
                  pending={submitRequest.isPending || setChoiceMutation.isPending}
                  error={formError}
                  onNotNow={() => choice && setChoiceMutation.mutate({ organizationId, choice })}
                  onSubmit={(details) =>
                    isRequestChoice(choice) &&
                    submitRequest.mutate({ organizationId, choice, ...details })
                  }
                />
              </div>
            ) : (
              <div className="flex flex-wrap justify-end">
                <Button
                  disabled={!dirty || !choice || setChoiceMutation.isPending}
                  onClick={() => choice && setChoiceMutation.mutate({ organizationId, choice })}
                >
                  {setChoiceMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {t("settings.save")}
                </Button>
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">{t("settings.readOnly")}</p>
        )}
      </CardContent>
    </Card>
  );
}
