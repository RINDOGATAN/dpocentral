"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The audit trail, readable and exportable (owner's decision, 9 October
 * 2026; mirrors AI Sentinel's page).
 *
 * Written by the actions themselves; this page only reads. Restricted to
 * owners, admins and privacy officers (src/lib/audit-access.ts, enforced by
 * the server in audit.list and in the CSV route), because it is a record
 * about colleagues as much as about records.
 *
 * Entries about rights requests show the reference and the action only; the
 * request itself is read on its own page, where the reading rule and the
 * "viewed" record apply. Any other recorded detail is shown verbatim rather
 * than prettified: a trail rewritten for presentation is worth less.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Download, Loader2, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/privacy/page-header";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { useAuditAccess } from "@/lib/use-audit-access";
import { isDsarModuleEnabled } from "@/config/features";
import { formatDateIn, formatDateTimeIn, formatNumberIn } from "@/lib/utils";
import type { AuditEntryView } from "@/lib/audit-access";

const ALL = "ALL";

/** A code shown as written, with only its separators made readable. */
function humanizeCode(code: string): string {
  return code
    .toLowerCase()
    .split("_")
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function detailOf(changes: unknown, metadata: unknown): string {
  const parts: string[] = [];
  if (changes && typeof changes === "object") parts.push(JSON.stringify(changes));
  if (metadata && typeof metadata === "object") parts.push(JSON.stringify(metadata));
  return parts.join(" · ");
}

export default function AuditTrailPage() {
  const t = useTranslations("auditTrail");
  const locale = useLocale();
  const { organization } = useOrganization();
  const { canRead } = useAuditAccess();
  const orgId = organization?.id ?? "";
  const enabled = !!orgId && canRead === true;

  const [action, setAction] = useState<string>(ALL);
  const [area, setArea] = useState<string>(ALL);
  const [actor, setActor] = useState<string>(ALL);
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const filters = useMemo(
    () => ({
      action: action === ALL ? undefined : action,
      entityType: area === ALL ? undefined : area,
      userId: actor === ALL ? undefined : actor,
      from: from ? new Date(`${from}T00:00:00`) : undefined,
      // An end date means the whole of that day.
      to: to ? new Date(`${to}T23:59:59.999`) : undefined,
    }),
    [action, area, actor, from, to],
  );

  const { data: facets } = trpc.audit.facets.useQuery({ organizationId: orgId }, { enabled });

  const { data, isLoading, isFetching, fetchNextPage, hasNextPage } =
    trpc.audit.list.useInfiniteQuery(
      { organizationId: orgId, ...filters },
      { enabled, getNextPageParam: (last) => last.nextCursor },
    );

  const entries = useMemo(() => (data?.pages ?? []).flatMap((p) => p.entries), [data]);
  const filtered = action !== ALL || area !== ALL || actor !== ALL || !!from || !!to;

  const areaLabel = (type: string) =>
    t.has(`areas.${type}` as "areas.Organization") ? t(`areas.${type}` as "areas.Organization") : type;
  const actionLabel = (code: string) =>
    t.has(`actions.${code}` as "actions.CREATE") ? t(`actions.${code}` as "actions.CREATE") : humanizeCode(code);

  const exportHref = () => {
    const p = new URLSearchParams({ organizationId: orgId, locale });
    if (filters.action) p.set("action", filters.action);
    if (filters.entityType) p.set("entityType", filters.entityType);
    if (filters.userId) p.set("userId", filters.userId);
    if (filters.from) p.set("from", filters.from.toISOString());
    if (filters.to) p.set("to", filters.to.toISOString());
    return `/api/export/audit-trail?${p.toString()}`;
  };

  if (canRead === null) {
    return (
      <div className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
      </div>
    );
  }

  if (!canRead) {
    return (
      <div className="max-w-4xl space-y-4" data-testid="audit-trail-restricted">
        <PageHeader icon={ScrollText} title={t("title")} />
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">{t("restricted")}</CardContent>
        </Card>
      </div>
    );
  }

  const record = (e: AuditEntryView) =>
    e.restricted ? (
      <>
        <div>{areaLabel(e.entityType)}</div>
        <div className="text-muted-foreground font-mono break-all">
          {t("reference", { reference: e.reference ?? "" })}
        </div>
      </>
    ) : (
      <>
        <div>{areaLabel(e.entityType)}</div>
        <div className="text-muted-foreground font-mono break-all">{e.entityId}</div>
      </>
    );

  const detail = (e: AuditEntryView) => {
    if (e.restricted) {
      // The reference resolved to a request that still exists: link to it,
      // where the reading rule applies.
      const linkable = isDsarModuleEnabled() && e.reference !== null && e.reference !== e.entityId;
      return (
        <span className="font-sans text-muted-foreground" data-testid="audit-dsar-withheld">
          {linkable ? (
            <Link href={`/privacy/dsar/${e.entityId}`} className="underline underline-offset-2">
              {t("rightsRequestWithheld")}
            </Link>
          ) : (
            t("rightsRequestWithheld")
          )}
        </span>
      );
    }
    const text = detailOf(e.changes, e.metadata);
    return text || <span className="text-muted-foreground italic font-sans">{t("noDetail")}</span>;
  };

  const who = (e: AuditEntryView) =>
    e.actorName ?? e.actorEmail ?? (
      <span className="text-muted-foreground italic">{t("actorRemoved")}</span>
    );

  return (
    <div className="space-y-4 sm:space-y-6 max-w-5xl" data-testid="audit-trail-page">
      <PageHeader
        icon={ScrollText}
        title={t("title")}
        description={t("subtitle")}
        actions={
          <a href={exportHref()} download data-testid="audit-export">
            <Button variant="outline" className="gap-1.5">
              <Download className="size-4 shrink-0" aria-hidden="true" />
              {t("export")}
            </Button>
          </a>
        }
      />

      <Card>
        <CardContent className="p-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5 min-w-0">
            <Label className="text-xs" htmlFor="audit-area">{t("filters.area")}</Label>
            <Select value={area} onValueChange={setArea}>
              <SelectTrigger id="audit-area" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("filters.all")}</SelectItem>
                {(facets?.entityTypes ?? []).map((e) => (
                  <SelectItem key={e.value} value={e.value}>
                    {areaLabel(e.value)} ({e.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 min-w-0">
            <Label className="text-xs" htmlFor="audit-action">{t("filters.action")}</Label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger id="audit-action" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("filters.all")}</SelectItem>
                {(facets?.actions ?? []).map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {actionLabel(a.value)} ({a.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 min-w-0">
            <Label className="text-xs" htmlFor="audit-actor">{t("filters.actor")}</Label>
            <Select value={actor} onValueChange={setActor}>
              <SelectTrigger id="audit-actor" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("filters.all")}</SelectItem>
                {(facets?.actors ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name ?? a.email ?? a.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 min-w-0">
            <Label className="text-xs" htmlFor="audit-from">{t("filters.from")}</Label>
            <Input id="audit-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>

          <div className="space-y-1.5 min-w-0">
            <Label className="text-xs" htmlFor="audit-to">{t("filters.to")}</Label>
            <Input id="audit-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {facets && (
          <span data-testid="audit-showing">
            {/* The total is the whole trail's; with a filter, only what matches is counted. */}
            {filtered
              ? t("showingFiltered", { count: formatNumberIn(entries.length, locale) })
              : t("showing", {
                  count: formatNumberIn(entries.length, locale),
                  total: formatNumberIn(facets.total, locale),
                })}
          </span>
        )}
        {facets?.earliest && (
          <span>{t("since", { date: formatDateIn(facets.earliest, locale) })}</span>
        )}
        {filtered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setAction(ALL);
              setArea(ALL);
              setActor(ALL);
              setFrom("");
              setTo("");
            }}
          >
            {t("filters.clear")}
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">{t("exportHint")}</p>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            </div>
          ) : entries.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              {filtered ? t("emptyFiltered") : t("empty")}
            </div>
          ) : (
            <>
              {/* Phones: one block per entry, nothing scrolls sideways. */}
              <ul className="divide-y sm:hidden" data-testid="audit-list-phone">
                {entries.map((e) => (
                  <li key={e.id} className="p-3 space-y-1 text-sm min-w-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                      <span className="font-medium">{actionLabel(e.action)}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTimeIn(e.createdAt, locale)}
                      </span>
                    </div>
                    <div className="text-xs">{who(e)}</div>
                    <div className="text-xs">{record(e)}</div>
                    <div className="text-xs font-mono break-all">{detail(e)}</div>
                  </li>
                ))}
              </ul>
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm" data-testid="audit-table">
                  <thead className="border-b">
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="p-3 font-medium whitespace-nowrap">{t("columns.when")}</th>
                      <th className="p-3 font-medium">{t("columns.who")}</th>
                      <th className="p-3 font-medium">{t("columns.action")}</th>
                      <th className="p-3 font-medium">{t("columns.entity")}</th>
                      <th className="p-3 font-medium">{t("columns.detail")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => (
                      <tr key={e.id} className="border-b last:border-0 align-top">
                        <td className="p-3 whitespace-nowrap text-xs text-muted-foreground">
                          {formatDateTimeIn(e.createdAt, locale)}
                        </td>
                        <td className="p-3 break-words">{who(e)}</td>
                        <td className="p-3">{actionLabel(e.action)}</td>
                        <td className="p-3 text-xs">{record(e)}</td>
                        <td className="p-3 text-xs font-mono break-all max-w-md">{detail(e)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {hasNextPage && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetching}>
            {isFetching && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" aria-hidden="true" />}
            {t("loadMore")}
          </Button>
        </div>
      )}
    </div>
  );
}
