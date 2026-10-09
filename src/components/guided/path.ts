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
 * - `done`       the rule is met by records a person has confirmed
 * - `toConfirm`  the rule would be met, but only by drafts: records the quick
 *                start, a template or another client's copy created, which
 *                count once a person confirms them (owner's decision d2,
 *                9 October 2026). Never counted as done.
 * - `started`    there is something, but not yet enough
 * - `todo`       nothing yet
 * - `coming`     the product has no page for it yet
 * - `hidden`     the step does not concern this organisation (its `shownWhen`
 *                rule is not met): not shown, not counted, never the next step
 */
export type StepStatus = "done" | "toConfirm" | "started" | "todo" | "coming" | "hidden";

/**
 * A stage as a whole: not started, in progress, drafts waiting to be
 * confirmed, done, or "coming" (a stage whose steps all have no page yet, so
 * it carries no count and no progress).
 */
export type StageState = "todo" | "started" | "toConfirm" | "done" | "coming";

export interface PathStep<C> {
  /** Stable id; also the i18n key under `steps.<id>`. */
  id: string;
  /** The existing page the step opens. Null only for a step that is coming. */
  href: string | null;
  /**
   * Other places that belong to this step though they sit under another
   * step's path: a processing activity's own page lives at
   * /privacy/data-inventory/activities/<id>, under the assets step's prefix,
   * yet it is step 3.2. Matched like `href`, and the longest match wins.
   */
  alsoAt?: string[];
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
  /**
   * Acts on the whole organisation (the quick start): not shown to a member
   * limited to departments (src/lib/department-limit.ts).
   */
  orgWide?: boolean;
}

/**
 * The path as a department-limited member sees it: the organisation-wide steps
 * removed, and a stage left with no step removed with them. The library is
 * unchanged.
 */
export function withoutOrgWideSteps<C>(config: PathConfig<C>): PathConfig<C> {
  return {
    ...config,
    stages: config.stages
      .map((stage) => ({ ...stage, steps: stage.steps.filter((s) => !s.orgWide) }))
      .filter((stage) => stage.steps.length > 0),
  };
}

/** The path without the named steps (and without stages left empty). */
export function withoutSteps<C>(config: PathConfig<C>, ids: readonly string[]): PathConfig<C> {
  return {
    ...config,
    stages: config.stages
      .map((stage) => ({ ...stage, steps: stage.steps.filter((s) => !ids.includes(s.id)) }))
      .filter((stage) => stage.steps.length > 0),
  };
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

/**
 * Whether a stage opens and closes in the menu: only when it holds a step a
 * person can open. A stage with no step shown, or with only steps that are
 * coming, has no expand control; its coming steps are listed as they are.
 */
export function stageExpandable<C>(stage: PathStage<C>, statuses: PathStatuses | null): boolean {
  return stage.steps.some((step) => isShown(step, statuses) && !!step.href && !step.coming);
}

export interface StageProgress {
  done: number;
  total: number;
  state: StageState;
}

/**
 * "2 of 3" for a stage: done steps over counted steps. The stage is done when
 * every counted step is; in progress when any counted step is done or started.
 *
 * A stage with no counted steps at all — only steps whose page is still to
 * come — is "coming": it is shown with that word instead of a "0 of 0" count,
 * never counts towards overall progress, and is never offered as a next step.
 */
export function stageProgress<C>(stage: PathStage<C>, statuses: PathStatuses): StageProgress {
  const counted = stage.steps.filter((s) => isCounted(s) && isShown(s, statuses));
  const done = counted.filter((s) => statuses[s.id] === "done").length;
  const moving = counted.some(
    (s) => statuses[s.id] === "done" || statuses[s.id] === "started" || statuses[s.id] === "toConfirm",
  );
  const drafts = counted.some((s) => statuses[s.id] === "toConfirm");
  const allComing = counted.length === 0 && stage.steps.some((s) => s.coming);
  const state: StageState = allComing
    ? "coming"
    : counted.length > 0 && done === counted.length
      ? "done"
      : drafts
        ? "toConfirm"
        : moving
          ? "started"
          : "todo";
  return { done, total: counted.length, state };
}

/** Done over counted, across the whole path. */
export function overallProgress<C>(config: PathConfig<C>, statuses: PathStatuses) {
  const figure = programFigure(config, statuses);
  return { done: figure.confirmed, total: figure.total };
}

/**
 * THE programme figure ("2 of 10 steps confirmed"), owner's decision d3,
 * 9 October 2026. Computed here and only here: the dashboard, the menu, All
 * clients and the Reports page all read it through this function, so they
 * can never show different numbers.
 *
 * - `total`      the counted steps shown for this organisation (a step with a
 *                page, not optional, not hidden)
 * - `confirmed`  of those, the steps whose rule is met by confirmed records
 * - `toConfirm`  steps met only by drafts waiting for a person to confirm them
 * - `started`    steps with something, but not yet enough
 * - `notStarted` steps with nothing yet
 *
 * The four parts always add up to `total`.
 */
export interface ProgramFigure {
  confirmed: number;
  total: number;
  toConfirm: number;
  started: number;
  notStarted: number;
}

export function programFigure<C>(config: PathConfig<C>, statuses: PathStatuses): ProgramFigure {
  const figure: ProgramFigure = { confirmed: 0, total: 0, toConfirm: 0, started: 0, notStarted: 0 };
  for (const stage of config.stages) {
    for (const step of stage.steps) {
      if (!isCounted(step) || !isShown(step, statuses)) continue;
      figure.total += 1;
      const status = statuses[step.id];
      if (status === "done") figure.confirmed += 1;
      else if (status === "toConfirm") figure.toConfirm += 1;
      else if (status === "started") figure.started += 1;
      else figure.notStarted += 1;
    }
  }
  return figure;
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
      if (!step.href) continue;
      for (const href of [step.href, ...(step.alsoAt ?? [])]) {
        if (!matches(pathname, search, href)) continue;
        const score = hrefQuery(href).length * 10_000 + hrefPath(href).length;
        if (!best || score > best.score) best = { id: step.id, score };
      }
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

/**
 * What the band says after "Stage N complete": the stage that holds the next
 * step not done, or null when every counted step on the path is done. Read
 * from the whole path, never from the stage that follows the one just
 * finished: finishing the last stage while an earlier one is still open must
 * not announce "Every stage is done".
 */
export function stageAfterCelebration<C>(
  config: PathConfig<C>,
  statuses: PathStatuses,
): number | null {
  return nextStep(config, statuses)?.stageIndex ?? null;
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
