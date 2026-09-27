"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The program path as a menu: numbered stages that open to their steps, each
 * step with its state, then a small "Library and tools" group.
 *
 * Product-neutral. It is given a path config, the statuses for it and a
 * translator over the product's `guided` namespace (keys `stages.<id>`,
 * `steps.<id>.label`, `library.<id>` and the fixed keys used below), and
 * knows nothing else about the product. The same component draws the desktop
 * left menu (`sidebar`) and the phone side sheet (`sheet`, 44 px targets).
 */

import Link from "next/link";
import { useState } from "react";
import { Check, ChevronDown, Circle, CircleDot, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  currentLibraryId,
  currentStepId,
  isCounted,
  isShown,
  overallPercent,
  stageOfStep,
  stageOpenByDefault,
  stageProgress,
  type PathConfig,
  type PathStage,
  type PathStatuses,
  type PathStep,
  type StepStatus,
} from "./path";
import { ProgressBar, ProgressRing } from "./progress-ring";

export type Translate = (key: string, values?: Record<string, string | number>) => string;

interface PathMenuProps<C> {
  config: PathConfig<C>;
  statuses: PathStatuses | null;
  pathname: string;
  /** The address's query (`view=due-diligence`): some steps are views of a page. */
  search?: string;
  stripeEnabled: boolean;
  /** The account works for client organisations (the library shows the client cards). */
  clientMode?: boolean;
  variant: "sidebar" | "sheet";
  /** Sidebar only: icons, no words. */
  collapsed?: boolean;
  /** Called after any link is followed (the sheet closes itself). */
  onNavigate?: () => void;
  t: Translate;
  overview: { href: string; icon: LucideIcon };
  /**
   * One quiet line under the overall progress: where the organisation is in
   * its plan ("Day 12 of 90"). Nothing when null.
   */
  planLine?: string | null;
}

/**
 * Stage and step labels wrap to a second line instead of being cut: Spanish
 * labels are long ("Diligencia debida de proveedores"). Tested in
 * src/phone-width.test.ts.
 */
export const WRAP_LABEL = "min-w-0 flex-1 break-words leading-snug";

const FOCUS =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Where a stage's icon leads when the menu shows icons only: its first step not done. */
function stageTarget<C>(stage: PathStage<C>, statuses: PathStatuses | null): string | null {
  const open = stage.steps.find(
    (s) => s.href && isCounted(s) && isShown(s, statuses) && statuses?.[s.id] !== "done",
  );
  return (open ?? stage.steps.find((s) => s.href))?.href ?? null;
}

export function PathMenu<C>({
  config,
  statuses,
  pathname,
  search = "",
  stripeEnabled,
  clientMode = false,
  variant,
  collapsed = false,
  onNavigate,
  t,
  overview,
  planLine = null,
}: PathMenuProps<C>) {
  const library = config.library({ stripeEnabled, clientMode });
  const currentStep = currentStepId(config, pathname, search);
  const percent = statuses ? overallPercent(config, statuses) : null;
  const onOverview = pathname === overview.href;
  const currentStage = stageOfStep(config, currentStep);
  const openStage = stageOpenByDefault(config, currentStep, statuses, onOverview);
  const currentLibrary = currentStep ? null : currentLibraryId(library, pathname);

  // The stage holding the current page (on the overview, the stage holding
  // the next step) is open unless it was closed on this very page; any other
  // stage is open only when opened by hand.
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const [closedCurrentOn, setClosedCurrentOn] = useState<string | null>(null);
  const isOpen = (stage: PathStage<C>) =>
    stage.id === openStage?.id ? closedCurrentOn !== pathname : !!opened[stage.id];
  const toggle = (stage: PathStage<C>) => {
    if (stage.id === openStage?.id) setClosedCurrentOn(isOpen(stage) ? pathname : null);
    else setOpened((o) => ({ ...o, [stage.id]: !o[stage.id] }));
  };

  const sheet = variant === "sheet";
  const rowHeight = sheet ? "min-h-11" : "min-h-9";
  const itemBase = cn(
    "flex w-full items-center gap-3 rounded-lg px-3 py-1.5 text-left motion-safe:transition-colors",
    rowHeight,
    sheet ? "text-base" : "text-sm",
    FOCUS,
  );
  const itemIdle = "text-muted-foreground hover:bg-secondary hover:text-foreground";
  const itemActive = "bg-primary/15 text-primary";

  if (collapsed && !sheet) {
    return (
      <nav aria-label={t("navLabel")} className="flex flex-col items-center gap-1 py-2">
        <span
          className="text-[11px] font-semibold tabular-nums text-primary"
          title={percent === null ? t("loading") : t("overall", { percent })}
        >
          {percent === null ? " " : `${percent}%`}
        </span>
        <IconLink
          href={overview.href}
          icon={overview.icon}
          label={t("overview")}
          active={onOverview}
          onNavigate={onNavigate}
        />
        <div className="my-1 h-px w-8 bg-border" />
        {config.stages.map((stage, index) => {
          const progress = statuses ? stageProgress(stage, statuses) : null;
          const href = stageTarget(stage, statuses);
          const label = `${t("stageNumber", { number: index + 1 })}: ${t(`stages.${stage.id}`)}${
            progress ? `, ${t("stageProgress", { done: progress.done, total: progress.total })}` : ""
          }`;
          const active = stage.id === currentStage?.id;
          const ring = (
            <ProgressRing
              value={progress?.done ?? null}
              total={progress?.total ?? 0}
              size={32}
              complete={progress?.state === "done"}
            >
              {index + 1}
            </ProgressRing>
          );
          return href ? (
            <Link
              key={stage.id}
              href={href}
              onClick={onNavigate}
              title={label}
              aria-current={active ? "true" : undefined}
              className={cn(
                "flex size-11 items-center justify-center rounded-lg",
                FOCUS,
                active ? itemActive : itemIdle,
              )}
            >
              {ring}
              <span className="sr-only">{label}</span>
            </Link>
          ) : null;
        })}
        <div className="my-1 h-px w-8 bg-border" />
        {library.map((item) => (
          <IconLink
            key={item.id}
            href={item.href}
            icon={item.icon}
            label={t(`library.${item.id}`)}
            active={currentLibrary === item.id}
            onNavigate={onNavigate}
          />
        ))}
      </nav>
    );
  }

  return (
    <nav aria-label={t("navLabel")} className="flex flex-col gap-1">
      {/* The whole program at a glance: always one line and a bar tall, so
          nothing moves when the figure arrives. */}
      <div className="px-3 pb-2 flex flex-col gap-1.5" aria-busy={percent === null}>
        <span className="flex items-baseline justify-between gap-2 text-sm">
          <span className="font-medium text-foreground">{t("overallLabel")}</span>
          <span className="tabular-nums text-primary font-semibold">
            {percent === null ? (
              <>
                <span aria-hidden="true">&nbsp;</span>
                <span className="sr-only">{t("loading")}</span>
              </>
            ) : (
              `${percent}%`
            )}
          </span>
        </span>
        <ProgressBar value={percent} total={100} />
        {planLine && (
          <span className="text-xs text-muted-foreground tabular-nums">{planLine}</span>
        )}
      </div>
      <Link
        href={overview.href}
        onClick={onNavigate}
        aria-current={onOverview ? "page" : undefined}
        className={cn(itemBase, onOverview ? itemActive : itemIdle)}
      >
        <overview.icon className="size-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 truncate">{t("overview")}</span>
      </Link>

      <p className="px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {t("pathTitle")}
      </p>
      <ol className="flex flex-col gap-0.5">
        {config.stages.map((stage, index) => {
          const open = isOpen(stage);
          const progress = statuses ? stageProgress(stage, statuses) : null;
          const panelId = `path-stage-${variant}-${stage.id}`;
          const holdsCurrent = stage.id === currentStage?.id;
          return (
            <li key={stage.id}>
              <button
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => toggle(stage)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left motion-safe:transition-colors hover:bg-secondary",
                  sheet ? "min-h-12" : "min-h-11",
                  FOCUS,
                )}
              >
                <ProgressRing
                  value={progress?.done ?? null}
                  total={progress?.total ?? 0}
                  complete={progress?.state === "done"}
                >
                  {index + 1}
                </ProgressRing>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span
                    className={cn(
                      WRAP_LABEL,
                      "font-medium",
                      sheet ? "text-base" : "text-sm",
                      holdsCurrent ? "text-primary" : "text-foreground",
                    )}
                  >
                    {t(`stages.${stage.id}`)}
                  </span>
                  {/* Always one line tall, filled or not, so nothing moves when progress arrives. */}
                  <span className="truncate text-xs text-muted-foreground tabular-nums">
                    {progress ? (
                      `${t("stageProgress", { done: progress.done, total: progress.total })} · ${t(
                        `stageState.${progress.state}`,
                      )}`
                    ) : (
                      <>
                        <span aria-hidden="true">&nbsp;</span>
                        <span className="sr-only">{t("loading")}</span>
                      </>
                    )}
                  </span>
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground motion-safe:transition-transform motion-safe:duration-200",
                    open && "rotate-180",
                  )}
                />
              </button>
              <div
                id={panelId}
                inert={!open}
                className={cn(
                  "grid grid-cols-1 motion-safe:transition-[grid-template-rows] motion-safe:duration-200",
                  open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                )}
              >
                <ul className="min-h-0 overflow-hidden flex flex-col gap-0.5 pl-5">
                  {stage.steps.filter((step) => isShown(step, statuses)).map((step) => (
                    <li key={step.id} className="border-l border-border pl-2 first:mt-0.5 last:mb-1">
                      <StepRow
                        step={step}
                        status={statuses ? statuses[step.id] ?? "todo" : null}
                        current={step.id === currentStep}
                        className={itemBase}
                        idle={itemIdle}
                        active={itemActive}
                        onNavigate={onNavigate}
                        t={t}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          );
        })}
      </ol>

      <p className="px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {t("libraryTitle")}
      </p>
      <ul className="flex flex-col gap-0.5">
        {library.map((item) => {
          const active = currentLibrary === item.id;
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(itemBase, active ? itemActive : itemIdle)}
              >
                <item.icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 truncate">{t(`library.${item.id}`)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function StepRow<C>({
  step,
  status,
  current,
  className,
  idle,
  active,
  onNavigate,
  t,
}: {
  step: PathStep<C>;
  status: StepStatus | null;
  current: boolean;
  className: string;
  idle: string;
  active: string;
  onNavigate?: () => void;
  t: Translate;
}) {
  const label = t(`steps.${step.id}.label`);
  if (!step.href || status === "coming" || step.coming) {
    return (
      <span className={cn(className, "cursor-default text-muted-foreground")} aria-disabled="true">
        <Circle className="size-3.5 shrink-0 opacity-40" aria-hidden="true" />
        <span className={WRAP_LABEL}>{label}</span>
        <span className="shrink-0 rounded-full border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wider">
          {t("stepStatus.coming")}
        </span>
      </span>
    );
  }
  return (
    <Link
      href={step.href}
      onClick={onNavigate}
      aria-current={current ? "page" : undefined}
      className={cn(className, current ? active : idle)}
    >
      <StepMark status={status} optional={!!step.optional} t={t} />
      <span className={WRAP_LABEL}>{label}</span>
    </Link>
  );
}

/** A fixed-size mark, drawn the same size before and after the status arrives. */
function StepMark({
  status,
  optional,
  t,
}: {
  status: StepStatus | null;
  optional: boolean;
  t: Translate;
}) {
  if (status === null) {
    return (
      <span className="inline-flex size-3.5 shrink-0">
        <Circle className="size-3.5 opacity-40" aria-hidden="true" />
        <span className="sr-only">{t("loading")}</span>
      </span>
    );
  }
  const text = optional && status === "todo" ? t("stepStatus.optional") : t(`stepStatus.${status}`);
  return (
    <span className="inline-flex size-3.5 shrink-0" title={text}>
      {status === "done" ? (
        <span className="flex size-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-2.5" strokeWidth={3} aria-hidden="true" />
        </span>
      ) : status === "started" ? (
        <CircleDot className="size-3.5 text-primary" aria-hidden="true" />
      ) : (
        <Circle className={cn("size-3.5", optional ? "opacity-40" : "")} aria-hidden="true" />
      )}
      <span className="sr-only">{text}</span>
    </span>
  );
}

function IconLink({
  href,
  icon: Icon,
  label,
  active,
  onNavigate,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      title={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex size-11 items-center justify-center rounded-lg motion-safe:transition-colors",
        FOCUS,
        active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </Link>
  );
}
