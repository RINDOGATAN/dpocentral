"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Guided only, top of the dashboard: the first step on the path that is not
 * done, one sentence on why, one button. Holds its height while the status
 * loads, so the dashboard below it does not move.
 */

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DPO_CENTRAL_PATH, PLAN_WINDOWS } from "./path-config";
import { nextStep } from "./path";
import { planState } from "./plan";
import { planPaceText } from "./plan-text";
import { useProgramPathQuery } from "./use-program-path";

export function NextStepCard({
  waitForFresh = false,
}: {
  /**
   * Show the placeholder while a newer answer is on its way. For the quick
   * start's result, where the answer cached before the run would still name
   * the quick start as the next step.
   */
  waitForFresh?: boolean;
} = {}) {
  const t = useTranslations("guided");
  const { steps, planStart, refreshing } = useProgramPathQuery();
  const statuses = waitForFresh && refreshing ? null : steps;
  const next = statuses ? nextStep(DPO_CENTRAL_PATH, statuses) : null;
  const pace = statuses
    ? planPaceText(planState(DPO_CENTRAL_PATH, PLAN_WINDOWS, statuses, planStart, new Date()), t)
    : null;
  const StepIcon = next?.step.icon;

  return (
    <Card className="border-primary/30 bg-primary/5" aria-busy={!statuses}>
      <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 min-h-[7.5rem]">
        {!statuses ? (
          <div className="flex w-full flex-col gap-2" aria-label={t("loading")}>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-2/3 max-w-xs" />
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
        ) : next && StepIcon ? (
          <>
            <div className="p-3 rounded-lg bg-primary/10 shrink-0">
              <StepIcon className="w-6 h-6 text-primary" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-primary">
                {t("nextStep.title")} · {t("nextStep.stage", {
                  number: next.stageIndex + 1,
                  stage: t(`stages.${next.stage.id}`),
                })}
              </p>
              <h2 className="mt-1 font-semibold text-base sm:text-lg">
                {t(`steps.${next.step.id}.label`)}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">{t(`steps.${next.step.id}.why`)}</p>
              {pace && (
                <p className="text-xs text-muted-foreground mt-2">
                  <span className="sr-only">{t("plan.label")}: </span>
                  {pace}
                </p>
              )}
            </div>
            {next.step.href && (
              <Link href={next.step.href} className="w-full sm:w-auto shrink-0">
                <Button className="w-full sm:w-auto gap-2">
                  {t("nextStep.button", { step: t(`steps.${next.step.id}.label`) })}
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Button>
              </Link>
            )}
          </>
        ) : (
          <>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-base sm:text-lg">{t("nextStep.allDoneTitle")}</h2>
              <p className="text-sm text-muted-foreground mt-1">{t("nextStep.allDoneBody")}</p>
              {pace && (
                <p className="text-xs text-muted-foreground mt-2">
                  <span className="sr-only">{t("plan.label")}: </span>
                  {pace}
                </p>
              )}
            </div>
            <Link href="/privacy" className="w-full sm:w-auto shrink-0">
              <Button variant="outline" className="w-full sm:w-auto">
                {t("nextStep.allDoneButton")}
              </Button>
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}
