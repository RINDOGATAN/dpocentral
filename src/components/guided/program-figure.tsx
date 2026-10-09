"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The one programme figure, "2 of 10 steps confirmed" (owner's decision d3,
 * 9 October 2026). The number comes from `programFigure` (./path.ts) and the
 * words from one message (`guided.figure.line`), so the dashboard, the menu,
 * All clients and the Reports page all say exactly the same thing.
 */

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ListChecks } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { DPO_CENTRAL_PATH } from "./path-config";
import { programFigure, type PathStatuses, type ProgramFigure } from "./path";
import { ProgressBar } from "./progress-ring";
import { useProgramPathQuery } from "./use-program-path";

/** The figure for statuses already in hand (All clients has one set per client). */
export function figureFor(statuses: PathStatuses | null | undefined): ProgramFigure | null {
  return statuses && Object.keys(statuses).length > 0 ? programFigure(DPO_CENTRAL_PATH, statuses) : null;
}

/** The current organisation's figure and its drafts; null while loading. */
export function useProgramFigure(): { figure: ProgramFigure | null; drafts: number | null } {
  const { steps, drafts } = useProgramPathQuery();
  return { figure: figureFor(steps), drafts };
}

/** "2 of 10 steps confirmed": the same words wherever the figure is shown. */
export function ProgramFigureLine({
  figure,
  className,
}: {
  figure: ProgramFigure;
  className?: string;
}) {
  const t = useTranslations("guided");
  return (
    <span className={cn("tabular-nums", className)} data-testid="program-figure">
      {t("figure.line", { done: figure.confirmed, total: figure.total })}
    </span>
  );
}

/** The parts that are not confirmed yet, in words: "7 to confirm · 1 not started". */
export function ProgramFigureParts({ figure, className }: { figure: ProgramFigure; className?: string }) {
  const t = useTranslations("guided");
  const parts = [
    figure.toConfirm > 0 ? t("figure.toConfirm", { count: figure.toConfirm }) : null,
    figure.started > 0 ? t("figure.started", { count: figure.started }) : null,
    figure.notStarted > 0 ? t("figure.notStarted", { count: figure.notStarted }) : null,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return <span className={cn("text-muted-foreground tabular-nums", className)}>{parts.join(" · ")}</span>;
}

/**
 * The dashboard's figure: the line, a bar, what is not confirmed yet, and the
 * way to the drafts when there are any.
 */
export function ProgramFigureCard() {
  const t = useTranslations("guided");
  const { figure, drafts } = useProgramFigure();

  return (
    <Card aria-busy={!figure} data-testid="program-figure-card">
      <CardContent className="p-4 sm:p-6 flex flex-col gap-3">
        {!figure ? (
          <div className="flex flex-col gap-2" aria-label={t("loading")}>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-2 w-full" />
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {t("overallLabel")}
                </p>
                <ProgramFigureLine figure={figure} className="block mt-1 text-lg sm:text-xl font-semibold" />
              </div>
              <ProgramFigureParts figure={figure} className="text-sm" />
            </div>
            <ProgressBar value={figure.confirmed} total={figure.total} />
            {drafts !== null && drafts > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <p className="flex-1 min-w-0 text-sm text-muted-foreground">
                  {t("figure.draftsWaiting", { count: drafts })}
                </p>
                <Link href="/privacy/review" className="shrink-0">
                  <Button size="sm" variant="outline" className="w-full sm:w-auto gap-2">
                    <ListChecks className="w-4 h-4" aria-hidden="true" />
                    {t("figure.review")}
                  </Button>
                </Link>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
