"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * "All clients": the consultant portfolio. One row per client organisation with
 * its six stage rings, its next step, its 30/60/90-day plan, and the work due
 * (requests and open incidents). Everything is read through the same path and
 * plan functions the Guided menu reads, so a client's row never disagrees with
 * its own dashboard.
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
import { AlertTriangle, Building2, Clock, Loader2, AlertCircle, FileText, ArrowRight, MoreVertical, Copy } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { CopyFromClientDialog } from "@/components/privacy/copy-from-client-dialog";
import { canUseForTemplate } from "@/config/client-template";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { StatusMark } from "@/components/ui/status-chip";
import { toneMark } from "@/config/status-palette";
import { useEnumLabels } from "@/lib/enum-labels";
import { cn } from "@/lib/utils";
import { DPO_CENTRAL_PATH, PLAN_WINDOWS } from "@/components/guided/path-config";
import { nextStep, stageProgress, type PathStatuses, type StageState } from "@/components/guided/path";
import { planState } from "@/components/guided/plan";
import { planSummaryText } from "@/components/guided/plan-text";

/** A relative time in the active locale, or null for "no activity yet". */
function useRelativeTime() {
  const locale = useLocale();
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  return (date: Date | string | null): string | null => {
    if (!date) return null;
    const d = typeof date === "string" ? new Date(date) : date;
    const seconds = Math.round((d.getTime() - Date.now()) / 1000);
    const units: [Intl.RelativeTimeFormatUnit, number][] = [
      ["day", 86400],
      ["hour", 3600],
      ["minute", 60],
    ];
    for (const [unit, secs] of units) {
      if (Math.abs(seconds) >= secs) return rtf.format(Math.round(seconds / secs), unit);
    }
    return rtf.format(0, "minute");
  };
}

/** The dot's colour by stage state: done fills, in progress warns, the rest are quiet. */
const STAGE_DOT: Record<StageState, string> = {
  done: "bg-primary border-primary",
  started: "bg-amber-500 border-amber-500",
  todo: "bg-transparent border-muted-foreground/40",
  coming: "bg-transparent border-dashed border-muted-foreground/40",
};

function StageRings({ statuses }: { statuses: PathStatuses }) {
  const t = useTranslations("guided");
  return (
    <div className="flex items-center gap-1.5">
      {DPO_CENTRAL_PATH.stages.map((stage) => {
        const p = stageProgress(stage, statuses);
        return (
          <span
            key={stage.id}
            className={cn("size-3 rounded-full border-2", STAGE_DOT[p.state])}
            title={`${t(`stages.${stage.id}`)}: ${t(`stageState.${p.state}`)}`}
          >
            <span className="sr-only">
              {t(`stages.${stage.id}`)}: {t(`stageState.${p.state}`)}
            </span>
          </span>
        );
      })}
    </div>
  );
}

export default function ClientsPage() {
  const { data: clients, isLoading } = trpc.clients.listClients.useQuery();
  const { setOrganization } = useOrganization();
  const router = useRouter();
  const t = useTranslations("portfolio");
  const tg = useTranslations("guided");
  const tct = useTranslations("clientTemplate");
  const { label: enumLabel } = useEnumLabels();
  const relative = useRelativeTime();

  // "Start a new client from this one": the row's client is the source; the
  // dialog creates the new client and copies into it. Owner/admin only.
  const [copyFrom, setCopyFrom] = useState<{ id: string; name: string } | null>(null);

  const requestsDue = clients?.reduce((s, c) => s + c.overdueDsars + c.dueSoonDsars, 0) ?? 0;
  const totalIncidents = clients?.reduce((s, c) => s + c.openIncidents, 0) ?? 0;
  const attentionCount = clients?.filter((c) => c.needsAttention).length ?? 0;

  const handleClientClick = (client: NonNullable<typeof clients>[number]) => {
    setOrganization({
      id: client.organizationId,
      name: client.organizationName,
      slug: client.organizationSlug,
    });
    router.push("/privacy");
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
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("subtitle", { count: clients?.length ?? 0 })}
        </p>
      </div>

      {/* Summary tiles */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Tile value={requestsDue} label={t("tiles.requestsDue")} />
        <Tile value={totalIncidents} label={t("tiles.openIncidents")} />
        <Tile
          value={attentionCount}
          label={t("tiles.needAttention")}
          mark={attentionCount > 0 ? "warning" : undefined}
        />
        <Tile value={clients?.length ?? 0} label={t("tiles.clients")} />
      </div>

      {clients && clients.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {clients.map((client) => {
            const statuses = client.steps as PathStatuses;
            const next = nextStep(DPO_CENTRAL_PATH, statuses);
            const plan = planState(DPO_CENTRAL_PATH, PLAN_WINDOWS, statuses, client.planStart, new Date());
            const due = client.overdueDsars + client.dueSoonDsars;
            const lastActivity = relative(client.lastActivity);
            return (
              <Card
                key={client.organizationId}
                className="hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => handleClientClick(client)}
              >
                <CardContent className="p-4 sm:p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 className="w-4 h-4 text-primary shrink-0" />
                      <h3 className="font-semibold text-sm sm:text-base truncate">
                        {client.organizationName}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {client.needsAttention && (
                        <AlertCircle className={`w-4 h-4 ${toneMark("warning")}`} />
                      )}
                      <Badge variant="outline" className="text-xs">
                        {enumLabel("role", client.role)}
                      </Badge>
                      {canUseForTemplate(client.role) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              aria-label={tct("titleNew")}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem
                              onSelect={() =>
                                setCopyFrom({ id: client.organizationId, name: client.organizationName })
                              }
                            >
                              <Copy className="w-4 h-4 mr-2" />
                              {tct("titleNew")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>

                  {/* Stage rings */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">{t("stages")}</span>
                    <StageRings statuses={statuses} />
                  </div>

                  {/* Next step */}
                  <div className="flex items-center gap-2 text-xs">
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">{t("nextStep")}:</span>
                    <span className="min-w-0 truncate font-medium">
                      {next ? tg(`steps.${next.step.id}.label`) : t("allDone")}
                    </span>
                  </div>

                  {/* Plan */}
                  <div className="flex items-center gap-2 text-xs">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">{t("plan")}:</span>
                    <span className="font-medium">{planSummaryText(plan, tg)}</span>
                  </div>

                  {/* Work due */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border">
                    <div className="flex items-center gap-2 text-xs">
                      <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className={due > 0 ? "font-medium" : "text-muted-foreground"}>
                        {due > 0 ? t("requestsDue", { count: due }) : t("requestsDueNone")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className={client.openIncidents > 0 ? "font-medium" : "text-muted-foreground"}>
                        {client.openIncidents > 0
                          ? t("openIncidents", { count: client.openIncidents })
                          : t("openIncidentsNone")}
                      </span>
                    </div>
                  </div>

                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3 shrink-0" />
                    {lastActivity ? t("lastActivity", { when: lastActivity }) : t("noActivity")}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>{t("empty.title")}</p>
            <p className="text-sm mt-1">{t("empty.body")}</p>
          </CardContent>
        </Card>
      )}

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

function Tile({ value, label, mark }: { value: number; label: string; mark?: "warning" }) {
  return (
    <Card>
      <CardContent className="p-4 sm:pt-6">
        <div className="text-xl sm:text-2xl font-bold text-foreground">{value}</div>
        <p className="text-xs sm:text-sm text-muted-foreground inline-flex items-center gap-1">
          {mark && <StatusMark tone={mark} className="h-3.5 w-3.5" />}
          {label}
        </p>
      </CardContent>
    </Card>
  );
}
