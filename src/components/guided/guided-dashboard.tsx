"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The Guided dashboard: the programme at one glance. Subtract before adding: what it shows replaces the
 * two expert banners (one line stays in Help), the four counters (now six
 * area tiles), and the Recent activity and Quick actions cards (folded into
 * "Next three actions").
 *
 * From the top: the first-run card (until "Got it"), the one programme figure,
 * the six areas with their state word and next action, the documents you can
 * produce today, the next three actions (with the way to Needs action), the
 * deadlines at risk, and what is missing.
 *
 * Every reading comes from src/lib/programme-overview.ts over the document
 * register (src/config/document-register.ts) and the path, the same readings
 * the Guided menu makes, so the two cannot disagree. Since Classic was
 * retired this is the only dashboard.
 */

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, ChevronRight, Download, ExternalLink, FileText, ListChecks } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/ui/status-chip";
import type { StatusTone } from "@/config/status-tone";
import { FirstRunCard } from "@/components/help/first-run-card";
import { useOrganization } from "@/lib/organization-context";
import { useMemberScope } from "@/lib/use-member-scope";
import { useDsarAccess } from "@/lib/use-dsar-access";
import { plansUrl } from "@/lib/hosted";
import { cn, formatDateIn, formatDateTimeIn } from "@/lib/utils";
import { formatRequestRef } from "@/lib/request-ref";
import { formatIncidentRef } from "@/lib/incident-ref";
import { needsActionTotal } from "@/lib/needs-action";
import { packCounts } from "@/lib/document-pack";
import {
  nextActions,
  panelRows,
  planMilestone,
  actionableAreas,
  programmeAreas,
  type Area,
  type NextAction,
  type RegisterRow,
} from "@/lib/programme-overview";
import { INPUTS } from "@/config/document-register";
import { DPO_CENTRAL_PATH, PLAN_WINDOWS, type PathCounts } from "./path-config";
import { withoutSteps, type PathStatuses, type StageWord } from "./path";
import { ProgramFigureCard } from "./program-figure";
import { planSummaryText } from "./plan-text";
import { usePlanState, useProgramPathQuery } from "./use-program-path";
import { useProgrammeOverview, type ProgrammeOverview } from "./use-programme-overview";
import { documentBadge, documentName, gapsText, type DocumentBadge } from "./document-words";

const DOC_TONE: Record<DocumentBadge, StatusTone> = {
  ready: "success",
  standby: "success",
  draft: "info",
  needsInput: "warning",
  needsModule: "neutral",
  needsSetting: "neutral",
  notYet: "neutral",
};

/** The legend, in the order the rows are listed. */
// "Not in DPO Central yet" has its own line above the legend, so it is not repeated here.
const LEGEND_ORDER: readonly DocumentBadge[] = ["ready", "standby", "draft", "needsInput", "needsModule", "needsSetting"];

/** Rows shown at once: those that can be produced now or are ready for when they are needed. */
const SHOWN_BADGES: ReadonlySet<DocumentBadge> = new Set(["ready", "standby", "draft"]);

const WORD_TONE: Record<StageWord, StatusTone> = {
  done: "success",
  ready: "success",
  toConfirm: "warning",
  started: "info",
  todo: "neutral",
  action: "danger",
  coming: "neutral",
};

export function GuidedDashboard({ fromQuickstart = false }: { fromQuickstart?: boolean }) {
  const tp = useTranslations("pages.dashboard");
  const { organization } = useOrganization();
  const { orgWide } = useMemberScope();
  const { canHandle: canHandleDsars } = useDsarAccess();
  const { steps, refreshing: pathRefreshing } = useProgramPathQuery();
  const { overview, refreshing } = useProgrammeOverview();
  // Right after the quick start, the answer cached before the run would still
  // name the quick start as the next step: wait for the fresh one.
  const fresh = !(fromQuickstart && (pathRefreshing || refreshing));
  const statuses = fresh ? steps : null;
  const ready = fresh ? overview : null;
  // A member who may not read rights requests sees no rights-request step.
  const config = canHandleDsars === false ? withoutSteps(DPO_CENTRAL_PATH, ["dsar"]) : DPO_CENTRAL_PATH;

  return (
    <div className="space-y-4 sm:space-y-6" data-testid="guided-dashboard">
      <FirstRunCard />

      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-semibold break-words">
          {organization?.name || tp("subtitle")}
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">{tp("subtitle")}</p>
      </div>

      {/* The organisation's own figures: not for a member limited to departments. */}
      {orgWide ? (
        <>
          <ProgramFigureCard />
          <AreasCard config={config} statuses={statuses} overview={ready} />
          <DocumentsPanel overview={ready} hideDsar={canHandleDsars === false} />
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            <NextActionsCard config={config} statuses={statuses} overview={ready} />
            <DeadlinesCard overview={ready} />
          </div>
        </>
      ) : (
        orgWide === false && <LimitedCard />
      )}
    </div>
  );
}

function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The six areas
// ---------------------------------------------------------------------------

function areaHref(area: Area<PathCounts>): string | null {
  const { action, stage } = area;
  if (action.kind === "needsAction") return action.item.href;
  if (action.kind === "confirm") return "/privacy/review";
  if (action.kind === "step") return action.step.href;
  if (action.kind === "done" || action.kind === "ready")
    return stage.steps.find((s) => s.href && !s.coming)?.href ?? null;
  return null;
}

function AreasCard({
  config,
  statuses,
  overview,
}: {
  config: typeof DPO_CENTRAL_PATH;
  statuses: PathStatuses | null;
  overview: ProgrammeOverview | null;
}) {
  const t = useTranslations("guided");
  const tv = useTranslations("views");
  const plan = usePlanState();
  const areas = statuses && overview ? actionableAreas(programmeAreas(config, statuses, overview.needsAction)) : null;

  return (
    <Card data-testid="area-tiles" aria-busy={!areas}>
      <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <CardTitle className="text-base sm:text-lg">{t("areas.title")}</CardTitle>
          {plan && plan.kind !== "notStarted" && (
            <p className="text-xs text-muted-foreground tabular-nums">
              <span className="sr-only">{t("plan.label")}: </span>
              {planSummaryText(plan, t)}
            </p>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
        {!areas ? (
          <CardSkeleton rows={2} />
        ) : (
          <ul className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
            {areas.map((area) => {
              const href = areaHref(area);
              const actionText =
                area.action.kind === "needsAction"
                  ? tv(`needsAction.kind.${area.action.item.kind}`)
                  : area.action.kind === "step"
                    ? t("areas.step", { step: t(`steps.${area.action.step.id}.label`) })
                    : t(`areas.${area.action.kind}`);
              const body = (
                <>
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0 font-medium text-sm break-words">
                      {area.number !== null && (
                        <span className="tabular-nums text-muted-foreground mr-1.5">{area.number}</span>
                      )}
                      {t(`stages.${area.stage.id}`)}
                    </span>
                    <StatusChip tone={WORD_TONE[area.word]} className="text-xs shrink-0">
                      {t(`stageState.${area.word}`)}
                    </StatusChip>
                  </span>
                  <span className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <span className="min-w-0 break-words">{actionText}</span>
                    {href && <ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />}
                  </span>
                </>
              );
              return (
                <li key={area.stage.id} data-testid={`area-${area.stage.id}`} data-word={area.word}>
                  {href ? (
                    <Link
                      href={href}
                      className="flex h-full flex-col rounded-lg border border-border p-3 hover:border-primary/50 hover:bg-secondary/40 motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className="flex h-full flex-col rounded-lg border border-dashed border-border p-3">
                      {body}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Documents you can produce today (also on the Reports page)
// ---------------------------------------------------------------------------

export function DocumentsPanel({ overview, hideDsar }: { overview: ProgrammeOverview | null; hideDsar: boolean }) {
  const t = useTranslations("documentRegister");
  const rows = overview ? panelRows(overview.documents) : null;
  const produced = rows?.produced.filter((row) => !(hideDsar && row.entry.stepId === "dsar")) ?? [];
  const shown = produced.filter((row) => SHOWN_BADGES.has(documentBadge(row.doc.status)));
  const waiting = produced.filter((row) => !SHOWN_BADGES.has(documentBadge(row.doc.status)));
  const badges = new Set<DocumentBadge>([
    ...produced.map((row) => documentBadge(row.doc.status)),
    ...(rows && rows.notYet.length > 0 ? (["notYet"] as const) : []),
  ]);

  return (
    <Card data-testid="documents-panel" aria-busy={!rows}>
      <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3 flex flex-col md:flex-row md:items-start md:justify-between gap-3 space-y-0">
        <div className="min-w-0 flex flex-col gap-1.5">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <FileText className="size-4 text-primary shrink-0" aria-hidden="true" />
            {t("title")}
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">{t("subtitle")}</CardDescription>
        </div>
        {overview && <PackDownload overview={overview} hideDsar={hideDsar} />}
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
        {!rows ? (
          <CardSkeleton rows={4} />
        ) : (
          <>
            {shown.length > 0 && (
              <ul className="divide-y divide-border">
                {shown.map((row) => (
                  <DocumentRow key={row.entry.id} row={row} />
                ))}
              </ul>
            )}
            {waiting.length > 0 && (
              // Open by default only when nothing else is listed, so the
              // first screen is not a long list of what is missing.
              <details
                className={`group ${shown.length > 0 ? "border-t border-border" : ""}`}
                open={shown.length === 0}
                data-testid="doc-waiting"
              >
                <summary className="py-3 flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground motion-safe:transition-transform group-open:rotate-90"
                    aria-hidden="true"
                  />
                  {t("waitingLine", { count: waiting.length })}
                </summary>
                <ul className="divide-y divide-border border-t border-border">
                  {waiting.map((row) => (
                    <DocumentRow key={row.entry.id} row={row} />
                  ))}
                </ul>
              </details>
            )}
            {rows.notYet.length > 0 && (
              <p className="border-t border-border py-3 text-sm text-muted-foreground" data-testid="doc-not-yet">
                {t("notYetLine", { names: rows.notYet.map((r) => documentName(t, r.entry.id)).join(" · ") })}
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground" data-testid="documents-legend">
              {LEGEND_ORDER.filter((b) => badges.has(b)).map((b, i) => (
                <span key={b}>
                  {i > 0 && " · "}
                  {t(`legend.${b}`)}
                </span>
              ))}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * "Download ready documents":
 * one ZIP of every ready document, with an index and an integrity manifest
 * (/api/export/document-pack). With "Include drafts" the drafts go in too,
 * marked DRAFT in their file names, their gaps on their first page.
 */
function PackDownload({ overview, hideDsar }: { overview: ProgrammeOverview; hideDsar: boolean }) {
  const t = useTranslations("documentRegister");
  const locale = useLocale();
  const { organization } = useOrganization();
  const [withDrafts, setWithDrafts] = useState(false);
  const counts = packCounts(overview.documents, { dsarAllowed: !hideDsar });
  const count = counts.ready + (withDrafts ? counts.drafts : 0);
  const orgId = organization?.id ?? "";
  const href = `/api/export/document-pack?organizationId=${encodeURIComponent(orgId)}&locale=${locale}${withDrafts ? "&drafts=1" : ""}`;
  const button = (
    <Button size="sm" className="gap-1.5 h-auto min-h-8 py-1 whitespace-normal" disabled={count === 0 || !orgId}>
      <Download className="size-3.5 shrink-0" aria-hidden="true" />
      {t("pack.button")}
    </Button>
  );
  return (
    <div className="flex flex-col gap-1.5 md:items-end shrink-0" data-testid="pack-download">
      {count > 0 && orgId ? (
        <a href={href} download data-testid="pack-link" className="self-start md:self-end">
          {button}
        </a>
      ) : (
        <span className="self-start md:self-end">{button}</span>
      )}
      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
        <Checkbox
          checked={withDrafts}
          onCheckedChange={(v) => setWithDrafts(v === true)}
          disabled={counts.drafts === 0}
          data-testid="pack-drafts"
        />
        {t("pack.includeDrafts", { count: counts.drafts })}
      </label>
      <p className="text-xs text-muted-foreground tabular-nums" data-testid="pack-count">
        {count === 0 ? t("pack.none") : t("pack.count", { count })}
      </p>
    </div>
  );
}

function DocumentRow({ row }: { row: RegisterRow }) {
  const t = useTranslations("documentRegister");
  const locale = useLocale();
  const { organization } = useOrganization();
  const { entry, doc } = row;
  const status = doc.status;
  const name = documentName(t, entry.id);
  const badge = documentBadge(status);
  const detail =
    status.state === "draft"
      ? gapsText(t, status.gaps)
      : badge === "standby"
        ? t("standbyLine")
        : status.state === "needsInput"
        ? // Its own line, so capitalised like the other lines (the menu's
          // inline "· needs: ..." keeps the lower case).
          t("needsLine", { input: t(`inputs.${status.input}`) })
        : status.state === "ready"
          ? t("readyLine")
          : "";
  const producible = status.state === "ready" || status.state === "draft";
  const orgId = organization?.id ?? "";

  let actions: React.ReactNode = null;
  if (badge === "standby" && entry.href) {
    // Nothing to add until the event happens: the register itself opens.
    actions = (
      <Link href={entry.href} data-testid={`doc-open-${entry.id}`}>
        <Button size="sm" variant="outline" className="h-8">
          {t("open")}
        </Button>
      </Link>
    );
  } else if (status.state === "needsInput") {
    const input = INPUTS[status.input];
    const href = input.href === "plans" ? plansUrl(locale) : input.href;
    const label = t.has(`inputAction.${status.input}`)
      ? t(`inputAction.${status.input}`)
      : t("inputAction.default");
    actions = input.external ? (
      <a href={href} target="_blank" rel="noreferrer" data-testid={`doc-input-${entry.id}`}>
        <Button size="sm" variant="outline" className="gap-1.5 h-auto min-h-8 py-1 whitespace-normal">
          {label}
          <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
        </Button>
      </a>
    ) : (
      <Link href={href} data-testid={`doc-input-${entry.id}`}>
        <Button size="sm" variant="outline" className="h-auto min-h-8 py-1 whitespace-normal">
          {label}
        </Button>
      </Link>
    );
  } else if (producible && entry.download && orgId) {
    actions = (
      <span className="flex flex-wrap gap-1.5">
        {entry.formats
          .filter((f) => f !== "screen")
          .map((format) => (
            <a
              key={format}
              href={`${entry.download}?organizationId=${encodeURIComponent(orgId)}${format === "pdf" ? "" : `&format=${format}`}`}
              target="_blank"
              rel="noreferrer"
              aria-label={t("downloadLabel", { name, format: t(`format.${format}`) })}
              data-testid={`doc-download-${entry.id}-${format}`}
            >
              <Button size="sm" variant="outline" className="gap-1.5 h-8">
                <Download className="size-3.5" aria-hidden="true" />
                {t(`format.${format}`)}
              </Button>
            </a>
          ))}
      </span>
    );
  } else if (producible && entry.href) {
    actions = (
      <Link href={entry.href} data-testid={`doc-open-${entry.id}`}>
        <Button size="sm" variant="outline" className="h-8">
          {t("open")}
        </Button>
      </Link>
    );
  }

  return (
    <li
      className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4"
      data-testid={`doc-${entry.id}`}
      data-state={status.state}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium break-words">
          {entry.href ? (
            <Link href={entry.href} className="hover:underline underline-offset-4">
              {name}
            </Link>
          ) : (
            name
          )}
        </p>
        {detail && <p className="text-xs text-muted-foreground mt-0.5 break-words">{detail}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <StatusChip tone={DOC_TONE[badge]} className="text-xs" data-testid={`doc-state-${entry.id}`}>
          {t(`state.${badge}`)}
        </StatusChip>
        {actions}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Next three actions
// ---------------------------------------------------------------------------

function NextActionsCard({
  config,
  statuses,
  overview,
}: {
  config: typeof DPO_CENTRAL_PATH;
  statuses: PathStatuses | null;
  overview: ProgrammeOverview | null;
}) {
  const t = useTranslations("guided");
  const tv = useTranslations("views");
  const actions = statuses && overview ? nextActions(config, statuses, overview.needsAction) : null;
  const waiting = overview ? needsActionTotal(overview.needsAction) : 0;

  return (
    <Card data-testid="next-actions" aria-busy={!actions}>
      <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
        <CardTitle className="text-base sm:text-lg">{t("nextActions.title")}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0 flex flex-col gap-3">
        {!actions ? (
          <CardSkeleton rows={3} />
        ) : actions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("nextActions.empty")}</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {actions.map((action, index) => (
              <NextActionRow key={actionKey(action)} action={action} index={index} t={t} tv={tv} />
            ))}
          </ol>
        )}
        {waiting > 0 && (
          <Link
            href="/privacy/needs-action"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline underline-offset-4"
            data-testid="next-actions-needs-action"
          >
            <ListChecks className="size-4 shrink-0" aria-hidden="true" />
            {t("nextActions.allNeedsAction", { count: waiting })}
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

function actionKey(action: NextAction): string {
  return action.kind === "needsAction" ? `n-${action.item.kind}` : `s-${action.step.id}`;
}

type T = ReturnType<typeof useTranslations>;

function NextActionRow({ action, index, t, tv }: { action: NextAction; index: number; t: T; tv: T }) {
  const title =
    action.kind === "needsAction"
      ? `${tv(`needsAction.kind.${action.item.kind}`)} (${action.item.count})`
      : t(`steps.${action.step.id}.label`);
  const hint =
    action.kind === "needsAction"
      ? tv(`needsAction.hint.${action.item.kind}`)
      : action.toConfirm
        ? t("nextActions.toConfirm")
        : t(`steps.${action.step.id}.why`);
  const href =
    action.kind === "needsAction" ? action.item.href : action.toConfirm ? "/privacy/review" : action.step.href!;
  const button =
    action.kind === "needsAction"
      ? action.item.kind === "drafts-to-confirm"
        ? t("nextActions.review")
        : t("nextActions.open")
      : action.toConfirm
        ? t("nextActions.review")
        : t("nextActions.continue");
  return (
    <li className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3" data-testid="next-action">
      <span className="hidden sm:flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary tabular-nums">
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium break-words">
          <span className="sm:hidden tabular-nums">{index + 1}. </span>
          {title}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 break-words">{hint}</p>
      </div>
      <Link href={href} className="shrink-0">
        <Button size="sm" variant="outline" className="w-full sm:w-auto gap-1.5 h-8">
          {button}
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Button>
      </Link>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Upcoming deadlines
// ---------------------------------------------------------------------------

function DeadlinesCard({ overview }: { overview: ProgrammeOverview | null }) {
  const t = useTranslations("guided");
  const locale = useLocale();
  const { planStart } = useProgramPathQuery();
  const plan = usePlanState();
  const now = Date.now();

  // The plan's next milestone (day 30, 60 or 90), while the plan runs.
  const milestone = planMilestone(PLAN_WINDOWS, planStart, plan);

  return (
    <Card data-testid="deadlines" aria-busy={!overview}>
      <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
        <CardTitle className="text-base sm:text-lg">{t("deadlines.title")}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
        {!overview ? (
          <CardSkeleton rows={2} />
        ) : overview.deadlines.length === 0 && overview.reviews.length === 0 && !milestone ? (
          <p className="text-sm text-muted-foreground">{t("deadlines.empty")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {overview.deadlines.map((d) => {
              const ref =
                d.kind === "dsarDue" ? formatRequestRef(d.publicId, locale) : formatIncidentRef(d.publicId);
              const at = new Date(d.at);
              const overdue = at.getTime() < now;
              const when = d.kind === "dsarDue" ? formatDateIn(at, locale) : formatDateTimeIn(at, locale);
              return (
                <li key={`${d.kind}-${d.publicId}`} data-testid="deadline">
                  <Link
                    href={d.href}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 sm:gap-3 py-2.5 hover:bg-secondary/40 rounded-md -mx-2 px-2"
                  >
                    <span className="text-sm min-w-0 break-words">{t(`deadlines.${d.kind}`, { ref })}</span>
                    <span
                      className={cn(
                        "text-xs tabular-nums shrink-0",
                        overdue ? "font-medium text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {overdue ? t("deadlines.overdue", { date: when }) : when}
                    </span>
                  </Link>
                </li>
              );
            })}
            {overview.reviews.map((r) => {
              const at = new Date(r.at);
              const overdue = at.getTime() < now;
              const when = formatDateIn(at, locale);
              return (
                <li key={`${r.kind}-${r.id}`} data-testid="deadline-review">
                  <Link
                    href={r.href}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 sm:gap-3 py-2.5 hover:bg-secondary/40 rounded-md -mx-2 px-2"
                  >
                    <span className="text-sm min-w-0 break-words">{t(`deadlines.${r.kind}`, { name: r.name })}</span>
                    <span
                      className={cn(
                        "text-xs tabular-nums shrink-0",
                        overdue ? "font-medium text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {overdue ? t("deadlines.overdue", { date: when }) : when}
                    </span>
                  </Link>
                </li>
              );
            })}
            {milestone && (
              <li className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 sm:gap-3 py-2.5" data-testid="deadline-plan">
                <span className="text-sm">{t("deadlines.plan", { day: milestone.day })}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{formatDateIn(milestone.at, locale)}</span>
              </li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// A member limited to departments
// ---------------------------------------------------------------------------

function LimitedCard() {
  const tv = useTranslations("views");
  return (
    <Card>
      <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{tv("needsAction.title")}</p>
          <p className="text-sm text-muted-foreground">{tv("needsAction.subtitle")}</p>
        </div>
        <Link href="/privacy/needs-action" className="shrink-0">
          <Button size="sm" variant="outline" className="gap-1.5">
            <ListChecks className="size-4" aria-hidden="true" />
            {tv("needsAction.title")}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
