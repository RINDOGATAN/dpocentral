"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The board report (owner's decision d12, 9 October 2026): a short, plain
 * report a DPO gives to the board or management, on one screen and as a PDF
 * of two to three pages (English or Spanish), for a chosen period (the last
 * full quarter by default). Built from data already in DPO Central: no AI,
 * no new data entry, except the DPO's own comment, saved with the report for
 * that period.
 *
 * The screen and the PDF print the same words (src/lib/board-report-text.ts)
 * over the same data (src/server/services/program/board-report.ts). The
 * period lives in the address (?from=&to=), so a link opens the same report.
 */

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangle, Download, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { locales } from "@/i18n/config";
import {
  COMMENT_MAX,
  PERIOD_PRESETS,
  periodPreset,
  presetPeriod,
  resolvePeriod,
  type BoardPeriod,
  type BoardReport,
  type PeriodPreset,
} from "@/lib/board-report";
import { boardReportText, type BoardReportText, type Kpi, type Row } from "@/lib/board-report-text";
import { screenPalette } from "@/config/status-palette";

export default function BoardReportPage() {
  const t = useTranslations("boardReport");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const { organization } = useOrganization();
  const orgId = organization?.id ?? "";

  // The period in the address, or the last full quarter.
  const now = useMemo(() => new Date(), []);
  const period = resolvePeriod(search.get("from"), search.get("to"), now);
  const preset = periodPreset(period, now);
  const [custom, setCustom] = useState(preset === "custom");

  const setPeriod = (p: BoardPeriod) => {
    const params = new URLSearchParams(search.toString());
    params.set("from", p.from);
    params.set("to", p.to);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const { data, isLoading } = trpc.boardReport.get.useQuery(
    { organizationId: orgId, from: period.from, to: period.to },
    { enabled: !!orgId },
  );

  const pdfHref = (lang: string) =>
    `/api/export/board-report?organizationId=${encodeURIComponent(orgId)}&from=${period.from}&to=${period.to}&locale=${lang}`;
  const otherLocales = locales.filter((l) => l !== locale);

  return (
    <div className="space-y-4 sm:space-y-6 max-w-5xl" data-testid="board-report-page">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
          <History className="w-6 h-6 text-primary shrink-0" aria-hidden="true" />
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      {/* Period and download */}
      <Card>
        <CardContent className="p-4 sm:p-6 flex flex-col lg:flex-row lg:items-end gap-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 flex-1 min-w-0">
            <div className="flex flex-col gap-1.5 sm:w-56">
              <Label htmlFor="board-period">{t("period.label")}</Label>
              <Select
                value={custom ? "custom" : preset}
                onValueChange={(value) => {
                  if (value === "custom") {
                    setCustom(true);
                    return;
                  }
                  setCustom(false);
                  setPeriod(presetPeriod(value as PeriodPreset, now));
                }}
              >
                <SelectTrigger id="board-period" data-testid="board-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_PRESETS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {t(`period.${p}`)}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">{t("period.custom")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {custom && (
              <CustomPeriod
                key={`${period.from}_${period.to}`}
                period={period}
                onApply={(p) => setPeriod(resolvePeriod(p.from, p.to, now))}
              />
            )}
          </div>
          {data?.report && (
            <div className="flex flex-wrap gap-2">
              <a href={pdfHref(locale)} download data-testid="board-pdf">
                <Button className="gap-1.5" aria-label={t("downloadLabel", { language: t(`language.${locale}`) })}>
                  <Download className="size-4 shrink-0" aria-hidden="true" />
                  {t("download")}
                </Button>
              </a>
              {otherLocales.map((l) => (
                <a key={l} href={pdfHref(l)} download data-testid={`board-pdf-${l}`}>
                  <Button variant="outline" className="gap-1.5" aria-label={t("downloadLabel", { language: t(`language.${l}`) })}>
                    <Download className="size-4 shrink-0" aria-hidden="true" />
                    {t("downloadOther", { language: t(`language.${l}`) })}
                  </Button>
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {isLoading || !orgId ? (
        <Card>
          <CardContent className="p-6 space-y-3">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      ) : data?.limited ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground" data-testid="board-limited">
            {t("limited")}
          </CardContent>
        </Card>
      ) : data?.report ? (
        <ReportView report={data.report} />
      ) : null}
    </div>
  );
}

function CustomPeriod({ period, onApply }: { period: BoardPeriod; onApply: (p: BoardPeriod) => void }) {
  const t = useTranslations("boardReport");
  const [from, setFrom] = useState(period.from);
  const [to, setTo] = useState(period.to);
  return (
    <form
      className="flex flex-col sm:flex-row sm:items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onApply({ from, to });
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="board-from">{t("period.from")}</Label>
        <Input id="board-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="board-to">{t("period.to")}</Label>
        <Input id="board-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
      </div>
      <Button type="submit" variant="outline">
        {t("period.apply")}
      </Button>
    </form>
  );
}

function ReportView({ report }: { report: BoardReport }) {
  const locale = useLocale();
  const board = useTranslations("boardReport");
  const guided = useTranslations("guided");
  const register = useTranslations("documentRegister");
  const views = useTranslations("views");
  const text = boardReportText(report, { board, guided, register, views }, locale);

  return (
    <article className="space-y-4 sm:space-y-6" data-testid="board-report">
      <Card>
        <CardContent className="p-4 sm:p-6 space-y-1">
          <p className="text-lg sm:text-xl font-semibold break-words">{text.organization}</p>
          <p className="text-sm" data-testid="board-period-line">{text.periodLine}</p>
          <p className="text-sm text-muted-foreground">{text.generatedLine}</p>
          <p className="text-xs text-muted-foreground pt-1">{text.scopeNote}</p>
        </CardContent>
      </Card>

      <KpiStrip kpis={text.kpis} />

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <Section title={text.programme.title} testId="board-programme">
          <p className="text-base font-semibold" data-testid="board-figure">{text.programme.figure}</p>
          {text.programme.parts && <p className="text-xs text-muted-foreground mt-0.5">{text.programme.parts}</p>}
          <Rows rows={text.programme.areas} className="mt-3" />
        </Section>

        <DocumentsSection text={text} />

        <Section title={text.incidents.title} testId="board-incidents">
          <Rows rows={text.incidents.rows} numeric />
        </Section>

        {text.rights && (
          <Section title={text.rights.title} testId="board-rights">
            <Rows rows={text.rights.rows} numeric />
          </Section>
        )}

        <Section title={text.vendors.title} testId="board-vendors">
          <Rows rows={text.vendors.rows} numeric />
          {text.vendors.note && <p className="text-xs text-muted-foreground mt-2">{text.vendors.note}</p>}
        </Section>

        <Section title={text.assessments.title} testId="board-assessments">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground text-left">
                  {text.assessments.headers.map((h, i) => (
                    <th key={i} className={i === 0 ? "py-1.5 pr-3 font-medium" : "py-1.5 pl-3 font-medium text-right"}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border border-t border-border">
                {text.assessments.rows.map((row, i) => (
                  <tr key={i}>
                    <td className="py-1.5 pr-3">{row[0]}</td>
                    <td className="py-1.5 pl-3 text-right tabular-nums">{row[1]}</td>
                    <td className="py-1.5 pl-3 text-right tabular-nums">{row[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title={text.risks.title} testId="board-risks">
          {text.risks.items.length > 0 ? (
            <ol className="list-decimal pl-5 space-y-1.5 text-sm">
              {text.risks.items.map((item, i) => (
                <li key={i} className="break-words">{item}</li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">{text.risks.empty}</p>
          )}
        </Section>
      </div>

      <Section title={text.actions.title} testId="board-actions">
        {text.actions.rows.length > 0 ? (
          <ol className="divide-y divide-border border-y border-border">
            {text.actions.rows.map((row, i) => (
              <li key={i} className="py-2 grid gap-1 sm:grid-cols-[2fr_1fr_1fr] sm:gap-4 text-sm" data-testid="board-action">
                <span className="font-medium break-words">
                  {i + 1}. {row.action}
                </span>
                <span className="break-words">
                  <span className="sm:hidden text-muted-foreground">{text.actions.headers[1]}: </span>
                  {row.owner}
                </span>
                <span className="break-words">
                  <span className="sm:hidden text-muted-foreground">{text.actions.headers[2]}: </span>
                  {row.date}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">{text.actions.empty}</p>
        )}
        <p className="text-xs text-muted-foreground mt-2">{text.actions.note}</p>
      </Section>

      <CommentSection
        key={`${report.period.from}_${report.period.to}_${report.comment?.savedAt ?? ""}`}
        report={report}
        text={text}
      />

      <p className="text-xs text-muted-foreground" data-testid="board-disclaimer">{text.disclaimer}</p>
    </article>
  );
}

/**
 * "At a glance" (owner, 9 October 2026): the programme figure as a ring, then
 * the main figures as tiles with a bar, the same as the top of the PDF. One
 * accent, neutral greys, and the product's one warning mark for what needs
 * attention (the words stay in the body colour).
 */
function KpiStrip({ kpis }: { kpis: BoardReportText["kpis"] }) {
  const hero = kpis.hero;
  const size = 104;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  return (
    <Card data-testid="board-kpis">
      <CardContent className="p-4 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary mb-3">{kpis.title}</p>
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 sm:items-center">
          <div className="flex sm:flex-col items-center gap-4 sm:gap-2 shrink-0 sm:w-36" data-testid="board-kpi-programme">
            <div className="relative shrink-0" style={{ width: size, height: size }}>
              <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="-rotate-90">
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-foreground/10" />
                {(hero.ratio ?? 0) > 0 && (
                  <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray={`${(hero.ratio ?? 0) * circumference} ${circumference}`}
                    className="stroke-primary"
                  />
                )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display text-3xl leading-none tabular-nums">{hero.value}</span>
                {hero.of && <span className="text-xs text-muted-foreground mt-1">{hero.of}</span>}
              </div>
            </div>
            <p className="text-sm font-medium sm:text-center">{hero.label}</p>
          </div>
          <ul className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-4 flex-1 min-w-0">
            {kpis.tiles.map((kpi) => (
              <KpiTile key={kpi.id} kpi={kpi} />
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function KpiTile({ kpi }: { kpi: Kpi }) {
  const warn = screenPalette.warning.mark;
  return (
    <li className="min-w-0 sm:border-l sm:border-border sm:pl-4" data-testid={`board-kpi-${kpi.id}`}>
      <p className="flex items-baseline gap-1.5">
        <span className="font-display text-2xl leading-none tabular-nums" data-testid={`board-kpi-${kpi.id}-value`}>
          {kpi.value}
        </span>
        {kpi.of && <span className="text-xs text-muted-foreground">{kpi.of}</span>}
      </p>
      <p className="text-xs text-muted-foreground mt-1.5 break-words">{kpi.label}</p>
      {kpi.ratio !== null && (
        <div className="h-1.5 rounded-full bg-foreground/10 mt-2 overflow-hidden" aria-hidden="true">
          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(kpi.ratio * 100)}%` }} />
        </div>
      )}
      {kpi.flag && (
        <p className="flex items-start gap-1.5 text-xs mt-2 break-words" data-testid={`board-kpi-${kpi.id}-flag`}>
          <AlertTriangle className={`size-3.5 shrink-0 mt-px ${warn.class}`} aria-hidden="true" />
          {kpi.flag}
        </p>
      )}
    </li>
  );
}

function Section({ title, testId, children }: { title: string; testId: string; children: React.ReactNode }) {
  return (
    <Card data-testid={testId} className="min-w-0">
      <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
        <CardTitle className="text-base sm:text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">{children}</CardContent>
    </Card>
  );
}

function Rows({ rows, numeric = false, className = "" }: { rows: Row[]; numeric?: boolean; className?: string }) {
  return (
    <dl className={`divide-y divide-border border-y border-border text-sm ${className}`}>
      {rows.map((row, i) => (
        <div key={i} className="flex items-start justify-between gap-3 py-1.5">
          <dt className="min-w-0 break-words">{row.label}</dt>
          <dd className={numeric ? "font-semibold tabular-nums shrink-0" : "text-muted-foreground text-right shrink-0"}>
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function DocumentsSection({ text }: { text: BoardReportText }) {
  const d = text.documents;
  return (
    <Section title={d.title} testId="board-documents">
      <p className="text-sm font-semibold" data-testid="board-documents-line">{d.line}</p>
      <p className="text-xs font-medium text-muted-foreground mt-3">{d.readyTitle}</p>
      <p className="text-sm mt-0.5 break-words">{d.ready.length > 0 ? d.ready.join(" · ") : d.noneReady}</p>
      <p className="text-xs font-medium text-muted-foreground mt-3">{d.missingTitle}</p>
      {d.missing.length > 0 ? (
        <dl className="divide-y divide-border border-y border-border text-sm mt-1">
          {d.missing.map((row, i) => (
            <div key={i} className="grid gap-0.5 sm:grid-cols-2 sm:gap-3 py-1.5">
              <dt className="break-words">{row.label}</dt>
              <dd className="text-muted-foreground break-words">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm mt-0.5">{d.noneMissing}</p>
      )}
    </Section>
  );
}

function CommentSection({ report, text }: { report: BoardReport; text: BoardReportText }) {
  const t = useTranslations("boardReport");
  const { organization } = useOrganization();
  const utils = trpc.useUtils();
  // Keyed by the period and the save, so a new period or a save starts from what is saved.
  const savedText = report.comment?.text ?? "";
  const [draft, setDraft] = useState(savedText);

  const save = trpc.boardReport.saveComment.useMutation({
    onSuccess: async () => {
      toast.success(t("comment.toast"));
      await utils.boardReport.get.invalidate();
      await utils.programPath.invalidate();
    },
    onError: () => toast.error(t("comment.error")),
  });
  const dirty = draft.trim() !== savedText.trim();

  return (
    <Section title={text.comment.title} testId="board-comment">
      {report.canSave ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!organization) return;
            save.mutate({
              organizationId: organization.id,
              from: report.period.from,
              to: report.period.to,
              comment: draft,
            });
          }}
        >
          <Label htmlFor="board-comment-text" className="sr-only">
            {text.comment.title}
          </Label>
          <Textarea
            id="board-comment-text"
            value={draft}
            maxLength={COMMENT_MAX}
            rows={5}
            placeholder={t("comment.placeholder")}
            onChange={(e) => setDraft(e.target.value)}
            data-testid="board-comment-text"
          />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-xs text-muted-foreground tabular-nums">
              {t("comment.count", { count: draft.length, max: COMMENT_MAX })}
              {dirty && ` · ${t("comment.unsaved")}`}
            </p>
            <Button type="submit" size="sm" disabled={save.isPending} data-testid="board-comment-save">
              {save.isPending ? t("comment.saving") : t("comment.save")}
            </Button>
          </div>
          {text.comment.saved && (
            <p className="text-xs text-muted-foreground" data-testid="board-comment-saved">
              {text.comment.saved}
            </p>
          )}
        </form>
      ) : (
        <div className="space-y-2">
          <p className="text-sm whitespace-pre-wrap break-words">{text.comment.text ?? text.comment.none}</p>
          {text.comment.saved && <p className="text-xs text-muted-foreground">{text.comment.saved}</p>}
          <p className="text-xs text-muted-foreground">{t("comment.readOnly")}</p>
        </div>
      )}
    </Section>
  );
}
