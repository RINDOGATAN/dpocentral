"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Guided only, top of every page reached from the path: one slim band that
 * says what to do here, in one sentence ("Step 3.1 · Record each data
 * asset..."), and on its right "Next step →" to the following step. A person
 * can walk the whole path with that one button.
 *
 * The first time a stage is seen done, the band says so instead, once and
 * quietly ("Stage 3 complete. Next: Assess the risk."). "Next" names the stage
 * holding the next step not done, wherever it is on the path; "Every stage is
 * done" only when no counted step is left. No sound, no confetti;
 * the fade is skipped when reduced motion is asked for.
 *
 * Mounted by the Guided layout with a key per address, so the message lasts
 * for the page on which it was shown.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, Check } from "lucide-react";
import { useOrganization } from "@/lib/organization-context";
import { DPO_CENTRAL_PATH } from "./path-config";
import { useProgramPathQuery } from "./use-program-path";
import { stepFinishText } from "./step-finish";
import {
  nextStep,
  stageAfterCelebration,
  stageNumber,
  stageToCelebrate,
  stepAndFollowing,
  type PathStatuses,
} from "./path";

const SEEN_KEY = "dpc_stages_done";

/**
 * Steps whose band also says, in one sentence, what completes them (the same
 * sentence as the dashboard's next actions, src/components/guided/step-finish.ts).
 * The assessments step has its own lines; the breach register is left to its own panel.
 */
const BAND_FINISH_STEPS: ReadonlySet<string> = new Set([
  "quickstart",
  "applies",
  "dataInventory",
  "ropa",
  "vendors",
  "transfers",
  "dsar",
]);

/** Optional steps whose band says they are optional (keys under `guided.band.optional`). */
const BAND_OPTIONAL_STEPS: ReadonlySet<string> = new Set(["aiSystems", "lia"]);

/** Where "See what is missing" leads for a step whose records lack fields. */
const MISSING_HREF: Partial<Record<string, string>> = {
  ropa: "/privacy/incomplete",
};

function readSeen(key: string): string[] | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function writeSeen(key: string, ids: string[]): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // Private browsing or a full store: the message may show again. Harmless.
  }
}

export function StepBand({
  stepId,
  statuses,
}: {
  stepId: string | null;
  statuses: PathStatuses | null;
}) {
  const t = useTranslations("guided");
  const { organization } = useOrganization();
  const { missing, dpiaDuty } = useProgramPathQuery();
  const place = stepAndFollowing(DPO_CENTRAL_PATH, stepId, statuses);
  const orgId = organization?.id;
  const storageKey = orgId ? `${SEEN_KEY}:${orgId}` : null;

  // What was already known to be done when this page opened. Read once: the
  // band is mounted afresh for each address (and organisation), so a message
  // stays for the page on which it appeared even after it is remembered.
  const [seen] = useState<string[] | null | undefined>(() =>
    storageKey && typeof window !== "undefined" ? readSeen(storageKey) : undefined,
  );
  const result =
    place && statuses && seen !== undefined
      ? stageToCelebrate(DPO_CENTRAL_PATH, statuses, seen)
      : null;
  const celebrate = result?.celebrate ?? null;
  // The stage still open after the one just finished (null: every stage done).
  const openStage =
    celebrate !== null && statuses ? stageAfterCelebration(DPO_CENTRAL_PATH, statuses) : null;
  const remember = result ? result.remember.join(",") : null;

  useEffect(() => {
    if (storageKey && remember !== null) {
      writeSeen(storageKey, remember ? remember.split(",") : []);
    }
  }, [storageKey, remember]);

  if (!place) return null;
  const { current } = place;
  // After "Stage N complete. Next: <stage>", the button leads to the step that
  // sentence names (the first step not done, wherever it is), not to the step
  // that happens to follow this page, which may already be done.
  const ahead = celebrate !== null && statuses ? nextStep(DPO_CENTRAL_PATH, statuses) : null;
  const following = celebrate !== null ? (ahead ? { step: ahead.step } : null) : place.following;
  const stages = DPO_CENTRAL_PATH.stages;
  const currentStatus = statuses?.[current.step.id];
  // A step with records that are not yet enough: say what one more edit needs.
  const missingFields = currentStatus === "started" ? (missing[current.step.id] ?? []) : [];
  const missingHref = MISSING_HREF[current.step.id];

  return (
    <div
      className="mb-4 sm:mb-6 flex min-h-11 items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm"
    >
      {celebrate !== null ? (
        // Only the "Stage N complete" message is announced: the step sentence
        // is the same on every visit and would be read out on every page.
        <p role="status" className="flex min-w-0 flex-1 items-center gap-2 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="size-3" strokeWidth={3} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            {openStage !== null
              ? t("band.stageDone", {
                  number: stageNumber(DPO_CENTRAL_PATH, stages[celebrate].id) ?? celebrate + 1,
                  next: t(`stages.${stages[openStage].id}`),
                })
              : t("band.lastStageDone", { number: stageNumber(DPO_CENTRAL_PATH, stages[celebrate].id) ?? celebrate + 1 })}
          </span>
        </p>
      ) : (
        <p className="min-w-0 flex-1">
          <span className="font-semibold text-primary tabular-nums">
            {t("band.step", { number: current.number })}
          </span>
          <span aria-hidden="true"> · </span>
          <span className="sr-only">: </span>
          {t(`steps.${current.step.id}.do`)}
          {missingFields.length > 0 && (
            <span className="mt-0.5 block text-muted-foreground" data-testid="band-missing">
              {t("band.missing", { fields: missingFields.map((f) => t(`band.fields.${f}`)).join(", ") })}
              {missingHref && (
                <>
                  {" "}
                  <Link href={missingHref} className="font-medium text-primary underline-offset-2 hover:underline">
                    {t("band.missingLink")}
                  </Link>
                </>
              )}
            </span>
          )}
          {/* The assessments step says what finishes it: an approved DPIA where
              the organisation's answers require one, otherwise any risk assessment. */}
          {current.step.id === "assessments" && currentStatus !== undefined && currentStatus !== "done" && (
            <>
              <span className="mt-0.5 block text-muted-foreground" data-testid="band-finish">
                {stepFinishText(t, current.step.id, dpiaDuty)}
              </span>
              {/* Transfer, vendor and legitimate-interest assessments are
                  approved here too but do not count for this step: say so. */}
              <span className="mt-0.5 block text-muted-foreground" data-testid="band-assessments-counts">
                {t("band.assessmentsCounts")}
              </span>
            </>
          )}
          {/* Every other step with a finishing sentence says what completes it,
              unless the band already lists the fields one record lacks. */}
          {BAND_FINISH_STEPS.has(current.step.id) &&
            (currentStatus === "todo" || currentStatus === "started") &&
            missingFields.length === 0 && (
              <span className="mt-0.5 block text-muted-foreground" data-testid="band-finish">
                {stepFinishText(t, current.step.id, dpiaDuty)}
              </span>
            )}
          {/* An optional step says so, and that it never counts toward progress. */}
          {current.step.optional && BAND_OPTIONAL_STEPS.has(current.step.id) && currentStatus !== "done" && (
            <span className="mt-0.5 block text-muted-foreground" data-testid="band-optional">
              {t(`band.optional.${current.step.id}`)}
            </span>
          )}
          {currentStatus === "ready" && (
            <span className="mt-0.5 block text-muted-foreground" data-testid="band-ready">
              {t("band.readyWhenNeeded")}
            </span>
          )}
        </p>
      )}
      {following?.step.href ? (
        <Link
          href={following.step.href}
          className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-md px-2 font-medium text-primary hover:bg-primary/10 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title={t(`steps.${following.step.id}.label`)}
        >
          {t("band.next")}
          <ArrowRight className="size-4" aria-hidden="true" />
          <span className="sr-only">: {t(`steps.${following.step.id}.label`)}</span>
        </Link>
      ) : (
        <Link
          href="/privacy"
          className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-md px-2 font-medium text-primary hover:bg-primary/10 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("band.finish")}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
