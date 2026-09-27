// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The shape of a program path and the pure functions that read it.
 *
 * Product-neutral on purpose: nothing here knows about AI systems or
 * assessments. A product supplies a `PathConfig` over its own counts type
 * (AI Sentinel's is in ./path-config.ts); the Guided menu, the next-step
 * card, the phone progress bar and the portfolio all read it through the
 * functions below, so they can never disagree about where an organisation
 * stands.
 *
 * Progress is computed, never ticked by hand: each step carries a rule over
 * counts the product already holds, and the rule is the only thing that can
 * mark a step done.
 *
 * Pure: no React, no Prisma, no Next.
 */

import type { LucideIcon } from "lucide-react";

/**
 * - `done`     the rule is met
 * - `started`  there is something, but not yet enough
 * - `todo`     nothing yet
 * - `coming`   the product has no page for it yet
 * - `hidden`   the step does not concern this organisation (its `shownWhen`
 *              rule is not met): not shown, not counted, never the next step
 */
export type StepStatus = "done" | "started" | "todo" | "coming" | "hidden";

/** A stage as a whole: not started, in progress, or done. */
export type StageState = "todo" | "started" | "done";

export interface PathStep<C> {
  /** Stable id; also the i18n key under `steps.<id>`. */
  id: string;
  /** The existing page the step opens. Null only for a step that is coming. */
  href: string | null;
  icon: LucideIcon;
  /** The "done" rule in plain words, for the next person to change it. */
  rule: string;
  /** The rule itself. Never called for a step that is coming or hidden. */
  status?: (counts: C) => Exclude<StepStatus, "coming" | "hidden">;
  /**
   * Only for some organisations (testing AI agents, when the inventory holds
   * an agent): the step exists for this organisation only while this rule
   * holds; otherwise its status is `hidden`. While the statuses are still
   * loading, a step with this rule is not shown either: better to add a line
   * a moment later than to show one that then disappears.
   */
  shownWhen?: (counts: C) => boolean;
  /** No page carries it yet: shown, labelled "coming", never counted. */
  coming?: boolean;
  /**
   * Needed only when something happens (a proceeding) or kept by the product
   * on its own (the audit trail): shown with its state, never counted in a
   * stage's progress and never offered as the next step.
   */
  optional?: boolean;
}

export interface PathStage<C> {
  /** Stable id; also the i18n key under `stages.<id>`. */
  id: string;
  icon: LucideIcon;
  steps: PathStep<C>[];
}

export interface LibraryItem {
  /** i18n key under `library.<id>`. */
  id: string;
  href: string;
  icon: LucideIcon;
}

export interface PathConfig<C> {
  stages: PathStage<C>[];
  /** "Library and tools": everything that is not a step but must stay reachable. */
  library: (options: { stripeEnabled: boolean; clientMode?: boolean }) => LibraryItem[];
}

export type PathStatuses = Record<string, StepStatus>;

/** Every step's status for one organisation's counts. */
export function evaluatePath<C>(config: PathConfig<C>, counts: C): PathStatuses {
  const out: PathStatuses = {};
  for (const stage of config.stages) {
    for (const step of stage.steps) {
      out[step.id] =
        step.coming || !step.status
          ? "coming"
          : step.shownWhen && !step.shownWhen(counts)
            ? "hidden"
            : step.status(counts);
    }
  }
  return out;
}

/** A step that counts towards progress: it has a page and is not situational. */
export function isCounted<C>(step: PathStep<C>): boolean {
  return !step.coming && !step.optional;
}

/** Whether a step is shown for these statuses (null while they load). */
export function isShown<C>(step: PathStep<C>, statuses: PathStatuses | null): boolean {
  if (!step.shownWhen) return true;
  if (!statuses) return false;
  const status = statuses[step.id];
  return status !== undefined && status !== "hidden";
}

export interface StageProgress {
  done: number;
  total: number;
  state: StageState;
}

/**
 * "2 of 3" for a stage: done steps over counted steps. The stage is done when
 * every counted step is; in progress when any counted step is done or started.
 */
export function stageProgress<C>(stage: PathStage<C>, statuses: PathStatuses): StageProgress {
  const counted = stage.steps.filter((s) => isCounted(s) && isShown(s, statuses));
  const done = counted.filter((s) => statuses[s.id] === "done").length;
  const moving = counted.some((s) => statuses[s.id] === "done" || statuses[s.id] === "started");
  const state: StageState =
    counted.length > 0 && done === counted.length ? "done" : moving ? "started" : "todo";
  return { done, total: counted.length, state };
}

/** Done over counted, across the whole path. */
export function overallProgress<C>(config: PathConfig<C>, statuses: PathStatuses) {
  let done = 0;
  let total = 0;
  for (const stage of config.stages) {
    const p = stageProgress(stage, statuses);
    done += p.done;
    total += p.total;
  }
  return { done, total };
}

export interface NextStep<C> {
  stage: PathStage<C>;
  stageIndex: number;
  step: PathStep<C>;
}

/** The first counted step, in path order, that is not done. Null when all are. */
export function nextStep<C>(config: PathConfig<C>, statuses: PathStatuses): NextStep<C> | null {
  for (const [stageIndex, stage] of config.stages.entries()) {
    for (const step of stage.steps) {
      if (isCounted(step) && isShown(step, statuses) && statuses[step.id] !== "done") {
        return { stage, stageIndex, step };
      }
    }
  }
  return null;
}

/** The path part of an href, without a query or a fragment. */
function hrefPath(href: string): string {
  return href.split(/[?#]/)[0];
}

/** The query pairs an href carries (`?view=due-diligence`), as [key, value]. */
function hrefQuery(href: string): [string, string][] {
  const query = href.split("#")[0].split("?")[1];
  return query ? [...new URLSearchParams(query).entries()] : [];
}

function pathMatches(pathname: string, href: string): boolean {
  const path = hrefPath(href);
  return pathname === path || pathname.startsWith(path + "/");
}

/**
 * An href matches the current address when its path does and every query
 * pair it carries is present: `/governance/vendors?view=due-diligence` is a
 * different place from `/governance/vendors`.
 */
function matches(pathname: string, search: string, href: string): boolean {
  if (!pathMatches(pathname, href)) return false;
  const query = hrefQuery(href);
  if (query.length === 0) return true;
  const current = new URLSearchParams(search);
  return query.every(([key, value]) => current.get(key) === value);
}

/**
 * The step the current page belongs to, or null. Every step leads to its own
 * place (a page, or a view of a page named by its query), so exactly one step
 * is marked as the current page: a match on the query beats a match on the
 * path alone, and a longer path beats a shorter one (so
 * /governance/ai-registry/new is not claimed by a shorter prefix).
 */
export function currentStepId<C>(
  config: PathConfig<C>,
  pathname: string,
  search = "",
): string | null {
  let best: { id: string; score: number } | null = null;
  for (const stage of config.stages) {
    for (const step of stage.steps) {
      if (!step.href || !matches(pathname, search, step.href)) continue;
      const score = hrefQuery(step.href).length * 10_000 + hrefPath(step.href).length;
      if (!best || score > best.score) best = { id: step.id, score };
    }
  }
  return best?.id ?? null;
}

export interface SequenceEntry<C> {
  stage: PathStage<C>;
  stageIndex: number;
  step: PathStep<C>;
  /** "3.1": the stage's number, then the step's place within the stage. */
  number: string;
}

/**
 * Every step that has a page, in path order: the walk the "Next step" button
 * follows. Coming steps have no page and are skipped; optional steps are
 * places too, so they stay in the walk. Given `statuses`, a step hidden for
 * this organisation is skipped too, except `keep` (the page the person is
 * on, reached by its address). Numbers stay those of the config, which is
 * why a step that can be hidden goes last in its stage.
 */
export function stepSequence<C>(
  config: PathConfig<C>,
  statuses?: PathStatuses | null,
  keep?: string | null,
): SequenceEntry<C>[] {
  const out: SequenceEntry<C>[] = [];
  for (const [stageIndex, stage] of config.stages.entries()) {
    for (const [stepIndex, step] of stage.steps.entries()) {
      if (!step.href || step.coming) continue;
      if (statuses !== undefined && step.id !== keep && !isShown(step, statuses)) continue;
      out.push({ stage, stageIndex, step, number: `${stageIndex + 1}.${stepIndex + 1}` });
    }
  }
  return out;
}

/** A step's place in the walk, and the step after it (null after the last). */
export function stepAndFollowing<C>(
  config: PathConfig<C>,
  stepId: string | null,
  statuses?: PathStatuses | null,
): { current: SequenceEntry<C>; following: SequenceEntry<C> | null } | null {
  if (!stepId) return null;
  const sequence = stepSequence(config, statuses, stepId);
  const index = sequence.findIndex((e) => e.step.id === stepId);
  if (index < 0) return null;
  return { current: sequence[index], following: sequence[index + 1] ?? null };
}

/**
 * Which stage to congratulate, once. `seen` is the list of stage ids already
 * known to be done (kept per organisation in the browser), or null the first
 * time: then every stage already done is remembered silently, so a stage
 * finished long ago is never announced as news. Otherwise the last stage (in
 * path order) that is done and not yet seen is announced, and all done stages
 * are remembered.
 */
export function stageToCelebrate<C>(
  config: PathConfig<C>,
  statuses: PathStatuses,
  seen: string[] | null,
): { remember: string[]; celebrate: number | null } {
  const done = config.stages
    .filter((stage) => stageProgress(stage, statuses).state === "done")
    .map((stage) => stage.id);
  if (seen === null) return { remember: done, celebrate: null };
  let celebrate: number | null = null;
  for (const [index, stage] of config.stages.entries()) {
    if (done.includes(stage.id) && !seen.includes(stage.id)) celebrate = index;
  }
  return { remember: [...new Set([...seen, ...done])], celebrate };
}

/** Progress across the whole path as a whole percentage; 0 when nothing counts. */
export function overallPercent<C>(config: PathConfig<C>, statuses: PathStatuses): number {
  const { done, total } = overallProgress(config, statuses);
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

/** The stage holding a step, by id. */
export function stageOfStep<C>(config: PathConfig<C>, stepId: string | null): PathStage<C> | null {
  if (!stepId) return null;
  return config.stages.find((s) => s.steps.some((step) => step.id === stepId)) ?? null;
}

/**
 * The stage the menu opens without being asked. On a step's page, the stage
 * holding it. On the overview (the dashboard, where sign-in lands), the stage
 * holding the next step, or the first stage while the progress is still
 * loading: a new person arrives with stage 1 open. Elsewhere (the library),
 * none.
 */
export function stageOpenByDefault<C>(
  config: PathConfig<C>,
  stepId: string | null,
  statuses: PathStatuses | null,
  onOverview: boolean,
): PathStage<C> | null {
  if (stepId) return stageOfStep(config, stepId);
  if (!onOverview) return null;
  if (!statuses) return config.stages[0] ?? null;
  return nextStep(config, statuses)?.stage ?? null;
}

/** The library entry the current page belongs to, if it is not a step. */
export function currentLibraryId(items: LibraryItem[], pathname: string): string | null {
  const found = items.find((item) => matches(pathname, "", item.href));
  return found?.id ?? null;
}
