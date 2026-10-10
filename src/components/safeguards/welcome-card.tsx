"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The first-visit welcome card (hosted service only; owner's decisions O1 to
 * O3, 9 October 2026). Shown once, to the person who created the
 * organisation, on the first visit to /privacy and before the quick start.
 * The server decides who sees it (safeguards.getWelcome).
 *
 * Four elements: the welcome line, the AI sentence, the safeguards question
 * and its three answers. "Decide later" closes it and counts as answer a;
 * Escape and the close button do the same. Answers b and c open the short
 * request form; "Not now" there records the answer without a request.
 *
 * The dialog traps focus while open (Radix Dialog) and returns it on close.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  SafeguardsChoiceList,
  SafeguardsRequestForm,
  isRequestChoice,
  type AnswerChoice,
  type RequestChoice,
} from "./safeguards-parts";

type Step = "ask" | "form" | "sent";

export function WelcomeCard({
  organizationId,
  prefill,
  onDone,
}: {
  organizationId: string;
  prefill: { name: string; email: string; organizationName: string };
  onDone: () => void;
}) {
  const t = useTranslations("safeguards");
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState<Step>("ask");
  const [choice, setChoice] = useState<AnswerChoice | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const finish = () => {
    setOpen(false);
    utils.safeguards.getWelcome.invalidate({ organizationId });
    utils.safeguards.getStatus.invalidate({ organizationId });
    onDone();
  };

  const setChoiceMutation = trpc.safeguards.setChoice.useMutation({
    onError: () => toast.error(t("welcome.saveError")),
    onSettled: finish,
  });

  const submitRequest = trpc.safeguards.submitRequest.useMutation({
    onSuccess: () => {
      setFormError(null);
      setStep("sent");
    },
    onError: (err) => {
      setFormError(err.data?.code === "CONFLICT" ? t("form.alreadyOpen") : t("form.sendError"));
    },
  });

  const record = (value: AnswerChoice | "later") => {
    if (setChoiceMutation.isPending) return;
    setChoiceMutation.mutate({ organizationId, choice: value });
  };

  // Escape, the close button: "decide later" on the question, "not now" on
  // the form (the answer b or c is kept), a plain close once sent.
  const handleOpenChange = (next: boolean) => {
    if (next) return;
    if (step === "ask") record("later");
    else if (step === "form" && choice) record(choice);
    else finish();
  };

  const pending = setChoiceMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl"
        onInteractOutside={(e) => e.preventDefault()}
        data-testid="welcome-card"
      >
        {step === "ask" && (
          <div className="space-y-4">
            <DialogTitle className="text-lg leading-snug pr-6">{t("welcome.title")}</DialogTitle>
            <DialogDescription className="text-sm">{t("welcome.ai")}</DialogDescription>
            <SafeguardsChoiceList
              legend={t("welcome.question")}
              value={choice}
              onChange={setChoice}
              disabled={pending}
            />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <Button variant="ghost" onClick={() => record("later")} disabled={pending}>
                {t("welcome.later")}
              </Button>
              <Button
                disabled={!choice || pending}
                onClick={() => {
                  if (!choice) return;
                  if (isRequestChoice(choice)) setStep("form");
                  else record(choice);
                }}
              >
                {pending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t("welcome.continue")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("welcome.note")}{" "}
              <Link href="/security" target="_blank" className="underline underline-offset-2">
                {t("welcome.whereData")}
              </Link>
              .
            </p>
          </div>
        )}

        {step === "form" && isRequestChoice(choice) && (
          <div className="space-y-4">
            <DialogTitle className="text-lg leading-snug pr-6">{t("form.title")}</DialogTitle>
            <DialogDescription className="text-sm">{t("form.intro")}</DialogDescription>
            <SafeguardsRequestForm
              prefill={prefill}
              pending={submitRequest.isPending || pending}
              error={formError}
              autoFocus
              onNotNow={() => record(choice)}
              onSubmit={(details) =>
                submitRequest.mutate({ organizationId, choice: choice as RequestChoice, ...details })
              }
            />
          </div>
        )}

        {step === "sent" && (
          <div className="space-y-4" role="status">
            <DialogTitle className="text-lg leading-snug pr-6">{t("sent.title")}</DialogTitle>
            <DialogDescription className="text-sm">{t("sent.text")}</DialogDescription>
            <div className="flex flex-col sm:flex-row sm:justify-end">
              <Button onClick={finish} autoFocus>
                {t("sent.continue")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
