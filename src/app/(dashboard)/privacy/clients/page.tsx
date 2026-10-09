"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * "All clients": the consultant's firm view (owner's decision d9, 9 October
 * 2026). One row per client organisation the member belongs to:
 *
 *   client | confirmed figure | the six areas in words | documents ready |
 *   next deadline | next action
 *
 * sorted by the nearest deadline (the soonest or most overdue first; clients
 * with no deadline after them, by name). On a phone the table becomes one
 * card per client with the same fields.
 *
 * Every reading is the client's own dashboard's: the figure from the path
 * (`figureFor`), the areas and the next action from
 * src/lib/programme-overview.ts, the documents from the register, the
 * deadlines from the same server query, so a row never disagrees with the
 * client's dashboard. "Add a client" stays beside the title; "Start a new
 * client from this one" stays on each row's menu.
 */

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Building2, Loader2, MoreVertical, Copy, Plus } from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import { trpc } from "@/lib/trpc";
import type { AppRouter } from "@/server/routers";
import { useOrganization } from "@/lib/organization-context";
import { CopyFromClientDialog } from "@/components/privacy/copy-from-client-dialog";
import { NewOrganizationDialog } from "@/components/privacy/new-organization-dialog";
import { canUseForTemplate } from "@/config/client-template";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEnumLabels } from "@/lib/enum-labels";
import { cn, formatDateIn, formatDateTimeIn } from "@/lib/utils";
import { formatRequestRef } from "@/lib/request-ref";
import { formatIncidentRef } from "@/lib/incident-ref";
import { canHandleDsars } from "@/lib/dsar-access";
import { documentEntry } from "@/config/document-register";
import { DPO_CENTRAL_PATH, PLAN_WINDOWS } from "@/components/guided/path-config";
import { withoutSteps, type PathStatuses } from "@/components/guided/path";
import { planState } from "@/components/guided/plan";
import { figureFor, ProgramFigureLine } from "@/components/guided/program-figure";
import {
  documentsReady,
  nearestDeadline,
  nextActions,
  planMilestone,
  programmeAreas,
  sortByNearestDeadline,
  type ClientDeadline,
  type NextAction,
} from "@/lib/programme-overview";
import type { PathCounts } from "@/components/guided/path-config";
import type { Area } from "@/lib/programme-overview";

type Client = inferRouterOutputs<AppRouter>["clients"]["listClients"][number];

interface Row {
  client: Client;
  name: string;
  limited: boolean;
  statuses: PathStatuses;
  areas: Area<PathCounts>[];
  docs: { ready: number; total: number };
  deadline: ClientDeadline | null;
  action: NextAction | null;
}

/** One client's row, read the way its own dashboard reads it. */
function toRow(client: Client, now: Date): Row {
  const statuses = client.steps as PathStatuses;
  // A member who does not handle rights requests sees none of them, as on the dashboard.
  const dsar = canHandleDsars(client.role);
  const config = dsar ? DPO_CENTRAL_PATH : withoutSteps(DPO_CENTRAL_PATH, ["dsar"]);
  const plan = planState(DPO_CENTRAL_PATH, PLAN_WINDOWS, statuses, client.planStart, now);
  const documents = dsar
    ? client.documents
    : client.documents.filter((d) => documentEntry(d.id)?.stepId !== "dsar");
  const hasStatuses = Object.keys(statuses).length > 0;
  return {
    client,
    name: client.organizationName,
    limited: client.limited,
    statuses,
    areas: hasStatuses && !client.limited ? programmeAreas(config, statuses, client.needsAction) : [],
    docs: documentsReady(documents),
    deadline: client.limited ? null : nearestDeadline(client.deadlines, planMilestone(PLAN_WINDOWS, client.planStart, plan)),
    action: hasStatuses && !client.limited ? (nextActions(config, statuses, client.needsAction, 1)[0] ?? null) : null,
  };
}

export default function ClientsPage() {
  const { data: clients, isLoading } = trpc.clients.listClients.useQuery();
  const { setOrganization } = useOrganization();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("portfolio");

  // "Start a new client from this one": the row's client is the source; the
  // dialog creates the new client and copies into it. Owner/admin only.
  const [copyFrom, setCopyFrom] = useState<{ id: string; name: string } | null>(null);
  // "Add a client": a blank client with only a name (the left menu's client
  // switcher offers the same dialog). The new client becomes the current one
  // and opens on its own dashboard.
  const [addOpen, setAddOpen] = useState(false);

  const now = new Date();
  const rows = sortByNearestDeadline((clients ?? []).map((c) => toRow(c, now)), locale);
  const attentionCount = clients?.filter((c) => c.needsAttention).length ?? 0;

  const open = (client: Client, href = "/privacy") => {
    setOrganization({
      id: client.organizationId,
      name: client.organizationName,
      slug: client.organizationSlug,
    });
    router.push(href);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-1" data-testid="clients-summary">
            {t("subtitle", { count: clients?.length ?? 0 })}
            {attentionCount > 0 && ` · ${t("needAttention", { count: attentionCount })}`}
          </p>
        </div>
        <Button size="sm" className="gap-2 shrink-0 self-start" onClick={() => setAddOpen(true)}>
          <Plus className="w-4 h-4" aria-hidden="true" />
          {t("addClient")}
        </Button>
      </div>

      {rows.length > 0 ? (
        <>
          {/* Wide screens: the table. */}
          <Card className="hidden lg:block">
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm" data-testid="clients-table">
                <caption className="sr-only">{t("sortNote")}</caption>
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th scope="col" className="px-4 py-3 font-medium">{t("columns.client")}</th>
                    <th scope="col" className="px-3 py-3 font-medium">{t("columns.confirmed")}</th>
                    <th scope="col" className="px-3 py-3 font-medium">{t("columns.areas")}</th>
                    <th scope="col" className="px-3 py-3 font-medium">{t("columns.documents")}</th>
                    <th scope="col" className="px-3 py-3 font-medium">{t("columns.deadline")}</th>
                    <th scope="col" className="px-3 py-3 font-medium">{t("columns.action")}</th>
                    <th scope="col" className="w-10 px-2 py-3"><span className="sr-only">{t("columns.menu")}</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row) => (
                    <tr
                      key={row.client.organizationId}
                      className="align-top hover:bg-secondary/40"
                      data-testid="client-row"
                      data-client={row.name}
                      data-deadline={row.deadline?.at ?? ""}
                    >
                      <th scope="row" className="px-4 py-3 text-left font-medium">
                        <ClientName row={row} onOpen={() => open(row.client)} />
                      </th>
                      {row.limited ? (
                        <td colSpan={5} className="px-3 py-3 text-muted-foreground">{t("limited")}</td>
                      ) : (
                        <>
                          <td className="px-3 py-3 min-w-[7rem]"><Confirmed row={row} /></td>
                          <td className="px-3 py-3 min-w-[12rem]"><AreasInWords row={row} /></td>
                          <td className="px-3 py-3 whitespace-nowrap" data-testid="client-docs">
                            {t("docsReady", { ready: row.docs.ready, total: row.docs.total })}
                          </td>
                          <td className="px-3 py-3 min-w-[9rem]"><DeadlineText deadline={row.deadline} now={now} onOpen={(href) => open(row.client, href)} /></td>
                          <td className="px-3 py-3 min-w-[8rem]"><ActionText row={row} onOpen={(href) => open(row.client, href)} /></td>
                        </>
                      )}
                      <td className="w-10 px-2 py-2"><RowMenu row={row} onCopy={setCopyFrom} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Phones and narrow windows: one card per client, the same fields. */}
          <ul className="flex flex-col gap-3 lg:hidden" data-testid="clients-cards">
            {rows.map((row) => (
              <li key={row.client.organizationId} data-testid="client-card" data-client={row.name}>
                <Card>
                  <CardContent className="p-4 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <ClientName row={row} onOpen={() => open(row.client)} />
                      <RowMenu row={row} onCopy={setCopyFrom} />
                    </div>
                    {row.limited ? (
                      <p className="text-sm text-muted-foreground">{t("limited")}</p>
                    ) : (
                      <dl className="grid grid-cols-1 gap-2 text-sm">
                        <Field label={t("columns.confirmed")}><Confirmed row={row} /></Field>
                        <Field label={t("columns.areas")}><AreasInWords row={row} /></Field>
                        <Field label={t("columns.documents")}>
                          <span data-testid="client-docs">{t("docsReady", { ready: row.docs.ready, total: row.docs.total })}</span>
                        </Field>
                        <Field label={t("columns.deadline")}>
                          <DeadlineText deadline={row.deadline} now={now} onOpen={(href) => open(row.client, href)} />
                        </Field>
                        <Field label={t("columns.action")}>
                          <ActionText row={row} onOpen={(href) => open(row.client, href)} />
                        </Field>
                      </dl>
                    )}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground" aria-hidden="true">{t("sortNote")}</p>
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>{t("empty.title")}</p>
            <p className="text-sm mt-1">{t("empty.body")}</p>
          </CardContent>
        </Card>
      )}

      <NewOrganizationDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={() => router.push("/privacy")}
      />

      <CopyFromClientDialog
        open={!!copyFrom}
        onOpenChange={(next) => {
          if (!next) setCopyFrom(null);
        }}
        mode={copyFrom ? { kind: "new", source: copyFrom } : { kind: "current" }}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-2 items-start">
      <dt className="text-xs text-muted-foreground pt-0.5">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function ClientName({ row, onOpen }: { row: Row; onOpen: () => void }) {
  const { label: enumLabel } = useEnumLabels();
  return (
    <span className="flex flex-col items-start gap-1 min-w-0">
      <button
        type="button"
        onClick={onOpen}
        className="text-left font-semibold text-primary hover:underline underline-offset-4 break-words focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        data-testid="client-open"
      >
        {row.name}
      </button>
      <Badge variant="outline" className="text-xs font-normal">
        {enumLabel("role", row.client.role)}
      </Badge>
    </span>
  );
}

function Confirmed({ row }: { row: Row }) {
  const t = useTranslations("portfolio");
  const figure = figureFor(row.statuses);
  if (!figure) return <span className="text-muted-foreground">{t("none")}</span>;
  return (
    <span className="flex flex-col gap-0.5">
      <ProgramFigureLine figure={figure} className="font-medium" />
      {row.client.drafts > 0 && (
        <span className="text-xs text-muted-foreground">{t("draftsToConfirm", { count: row.client.drafts })}</span>
      )}
    </span>
  );
}

/** The six areas with their state words, as the dashboard's tiles say them. */
function AreasInWords({ row }: { row: Row }) {
  const tg = useTranslations("guided");
  if (row.areas.length === 0) return null;
  return (
    <ul className="flex flex-col gap-0.5 text-xs" data-testid="client-areas">
      {row.areas.map((area) => (
        <li key={area.stage.id} className="flex flex-wrap items-baseline gap-x-1.5" data-word={area.word}>
          <span className="text-muted-foreground">{tg(`stages.${area.stage.id}`)}:</span>
          <span className={cn("font-medium", area.word === "action" && "text-destructive")}>
            {tg(`stageState.${area.word}`)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function DeadlineText({
  deadline,
  now,
  onOpen,
}: {
  deadline: ClientDeadline | null;
  now: Date;
  onOpen: (href: string) => void;
}) {
  const t = useTranslations("portfolio");
  const tg = useTranslations("guided");
  const locale = useLocale();
  if (!deadline) return <span className="text-muted-foreground" data-testid="client-deadline">{t("noDeadline")}</span>;
  const at = new Date(deadline.at);
  const overdue = at.getTime() < now.getTime();
  if (deadline.kind === "plan") {
    return (
      <span className="flex flex-col gap-0.5" data-testid="client-deadline">
        <span>{tg("deadlines.plan", { day: deadline.day })}</span>
        <span className="text-xs text-muted-foreground tabular-nums">{formatDateIn(at, locale)}</span>
      </span>
    );
  }
  const ref = deadline.kind === "dsarDue" ? formatRequestRef(deadline.publicId, locale) : formatIncidentRef(deadline.publicId);
  const when = deadline.kind === "dsarDue" ? formatDateIn(at, locale) : formatDateTimeIn(at, locale);
  return (
    <span className="flex flex-col gap-0.5" data-testid="client-deadline">
      <button
        type="button"
        onClick={() => onOpen(deadline.href)}
        className="text-left hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
      >
        {tg(`deadlines.${deadline.kind}`, { ref })}
      </button>
      <span className={cn("text-xs tabular-nums", overdue ? "font-medium text-foreground" : "text-muted-foreground")}>
        {overdue ? tg("deadlines.overdue", { date: when }) : when}
      </span>
    </span>
  );
}

function ActionText({ row, onOpen }: { row: Row; onOpen: (href: string) => void }) {
  const tg = useTranslations("guided");
  const tv = useTranslations("views");
  const action = row.action;
  if (!action) return <span className="text-muted-foreground">{tg("areas.done")}</span>;
  const label =
    action.kind === "needsAction"
      ? `${tv(`needsAction.kind.${action.item.kind}`)} (${action.item.count})`
      : action.toConfirm
        ? tg("areas.confirm")
        : tg(`steps.${action.step.id}.label`);
  const href =
    action.kind === "needsAction" ? action.item.href : action.toConfirm ? "/privacy/review" : action.step.href!;
  return (
    <button
      type="button"
      onClick={() => onOpen(href)}
      className="text-left text-primary hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
      data-testid="client-action"
    >
      {label}
    </button>
  );
}

function RowMenu({ row, onCopy }: { row: Row; onCopy: (c: { id: string; name: string }) => void }) {
  const tct = useTranslations("clientTemplate");
  if (!canUseForTemplate(row.client.role)) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={`${tct("titleNew")}: ${row.name}`}>
          <MoreVertical className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onCopy({ id: row.client.organizationId, name: row.name })}>
          <Copy className="w-4 h-4 mr-2" />
          {tct("titleNew")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
