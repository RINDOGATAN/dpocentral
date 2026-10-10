"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Settings: "Import a programme". Two ways in, both checked before anything
 * is written:
 *   - a whole programme (the export ZIP or programme.json) into a new or empty
 *     organisation: POST /api/portability/programme;
 *   - one register from a CSV file, with a column-matching step:
 *     POST /api/portability/register.
 * The check shows the counts per register and every problem found; the
 * import then brings everything in as drafts to confirm. Owners and admins only.
 */

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { FileUp, Loader2, AlertTriangle, Info, CircleX } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isDsarModuleEnabled } from "@/config/features";
import { REVIEW_DRAFTS_HREF } from "@/components/privacy/draft-confirm";

type Problem = { level: "error" | "warning" | "info"; code: string; en: string; es: string };
type RegisterSummary = { inFile: number; toCreate: number; alreadyImported: number; leftOut: number };
type Summary = {
  registers: Record<string, RegisterSummary>;
  problems: Problem[];
  canImport: boolean;
  people: { inFile: number; matched: number };
};
type Field = { key: string; en: string; es: string; required: boolean };
type Columns = {
  headers: string[];
  mapping: Array<string | null>;
  fields: Field[];
  preview: string[][];
  rowProblems: Array<{ row: number; field: string; en: string; es: string }>;
  rowProblemCount: number;
};
type Reply = {
  summary?: Summary;
  columns?: Columns;
  created?: number;
  error?: string;
  problems?: Array<{ path: string; message: string; es?: string }>;
};

const REGISTERS = ["processingActivities", "dataAssets", "vendors"] as const;
type CsvRegister = (typeof REGISTERS)[number];

const selectClass =
  "h-8 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function ProgrammeImportCard({ organizationId }: { organizationId: string }) {
  const t = useTranslations("pages.settings.portability.import");
  const locale = useLocale();
  const es = locale === "es";
  const dsarOn = isDsarModuleEnabled();

  const [mode, setMode] = useState<"programme" | "register">("programme");
  const [file, setFile] = useState<File | null>(null);
  const [register, setRegister] = useState<CsvRegister>("processingActivities");
  const [withRequests, setWithRequests] = useState(false);
  const [mapping, setMapping] = useState<Array<string | null> | null>(null);
  const [reply, setReply] = useState<Reply | null>(null);
  const [busy, setBusy] = useState<"check" | "import" | null>(null);

  const reset = () => {
    setReply(null);
    setMapping(null);
  };

  async function send(step: "check" | "import") {
    if (!file) return;
    setBusy(step);
    try {
      const body = new FormData();
      body.set("organizationId", organizationId);
      body.set("step", step);
      body.set("locale", es ? "es" : "en");
      body.set("file", file);
      if (mode === "programme" && dsarOn && withRequests) {
        body.set("includeRightsRequests", "1");
        body.set("acknowledgePersonalData", "1");
      }
      if (mode === "register") {
        body.set("register", register);
        if (mapping) body.set("mapping", JSON.stringify(mapping));
      }
      const res = await fetch(mode === "programme" ? "/api/portability/programme" : "/api/portability/register", {
        method: "POST",
        body,
      });
      const data = (await res.json().catch(() => ({}))) as Reply;
      setReply(data);
      if (data.columns) setMapping(data.columns.mapping);
      if (!res.ok && !data.summary) {
        toast.error(data.problems?.[0] ? (es ? (data.problems[0].es ?? data.problems[0].message) : data.problems[0].message) : (data.error ?? t("failed")));
        return;
      }
      if (step === "import" && res.ok) {
        const created = data.created ?? 0;
        toast.success(created > 0 ? t("done", { count: created }) : t("nothingNew"));
      }
    } catch {
      toast.error(t("failed"));
    } finally {
      setBusy(null);
    }
  }

  const summary = reply?.summary;
  const columns = reply?.columns;
  const imported = reply?.created !== undefined;
  const text = (p: { en: string; es: string }) => (es ? p.es : p.en);

  const fileInput = (accept: string) => (
    <div className="space-y-1">
      <Label htmlFor={`import-file-${mode}`}>{t("file")}</Label>
      <input
        id={`import-file-${mode}`}
        type="file"
        accept={accept}
        className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm"
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
          reset();
        }}
      />
    </div>
  );

  return (
    <Card data-testid="programme-import-card">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileUp className="w-4 h-4 text-primary" aria-hidden="true" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("lead")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs
          value={mode}
          onValueChange={(v) => {
            setMode(v as "programme" | "register");
            setFile(null);
            reset();
          }}
        >
          <TabsList>
            <TabsTrigger value="programme">{t("tabProgramme")}</TabsTrigger>
            <TabsTrigger value="register">{t("tabRegister")}</TabsTrigger>
          </TabsList>

          <TabsContent value="programme" className="space-y-3 pt-2">
            <p className="text-xs text-muted-foreground">{t("programmeHint")}</p>
            {fileInput(".zip,.json,application/zip,application/json")}
            {dsarOn && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
                <Checkbox
                  id="import-include-rights"
                  checked={withRequests}
                  onCheckedChange={(v) => {
                    setWithRequests(v === true);
                    reset();
                  }}
                  className="mt-0.5"
                />
                <label htmlFor="import-include-rights" className="text-sm leading-snug cursor-pointer">
                  <span className="font-medium">{t("includeRights")}</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">{t("includeRightsWarning")}</span>
                </label>
              </div>
            )}
          </TabsContent>

          <TabsContent value="register" className="space-y-3 pt-2">
            <p className="text-xs text-muted-foreground">{t("registerHint")}</p>
            <div className="space-y-1">
              <Label htmlFor="import-register">{t("register")}</Label>
              <select
                id="import-register"
                className={selectClass}
                value={register}
                onChange={(e) => {
                  setRegister(e.target.value as CsvRegister);
                  reset();
                }}
              >
                {REGISTERS.map((r) => (
                  <option key={r} value={r}>
                    {t(`registers.${r}`)}
                  </option>
                ))}
              </select>
            </div>
            {fileInput(".csv,.txt,.tsv,text/csv")}
          </TabsContent>
        </Tabs>

        {columns && mode === "register" && mapping && (
          <div className="space-y-2" data-testid="import-mapping">
            <p className="text-sm font-medium">{t("mappingTitle")}</p>
            <p className="text-xs text-muted-foreground">{t("mappingLead")}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-1 pr-2 font-normal">{t("colHeader")}</th>
                    <th className="py-1 pr-2 font-normal">{t("colExample")}</th>
                    <th className="py-1 font-normal">{t("colField")}</th>
                  </tr>
                </thead>
                <tbody>
                  {columns.headers.map((h, i) => (
                    <tr key={`${i}-${h}`} className="border-t">
                      <td className="py-1 pr-2 align-middle">{h}</td>
                      <td className="py-1 pr-2 align-middle text-muted-foreground truncate max-w-[10rem]">
                        {columns.preview[0]?.[i] ?? ""}
                      </td>
                      <td className="py-1 align-middle min-w-[10rem]">
                        <select
                          aria-label={`${t("colField")}: ${h}`}
                          className={selectClass}
                          value={mapping[i] ?? ""}
                          onChange={(e) => {
                            const next = [...mapping];
                            const key = e.target.value || null;
                            // A field belongs to one column: taking it here frees it elsewhere.
                            if (key) for (let j = 0; j < next.length; j++) if (next[j] === key) next[j] = null;
                            next[i] = key;
                            setMapping(next);
                          }}
                        >
                          <option value="">{t("skip")}</option>
                          {columns.fields.map((f) => (
                            <option key={f.key} value={f.key}>
                              {es ? f.es : f.en}
                              {f.required ? ` (${t("required")})` : ""}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {columns.rowProblemCount > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer">{t("rowProblems", { count: columns.rowProblemCount })}</summary>
                <ul className="mt-1 space-y-0.5 text-muted-foreground">
                  {columns.rowProblems.slice(0, 50).map((p, i) => (
                    <li key={i}>
                      {t("row", { row: p.row })}: {text(p)}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        {summary && (
          <div className="space-y-3" data-testid="import-summary">
            <p className="text-sm font-medium">{t("summaryTitle")}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm tabular-nums">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-1 pr-2 font-normal">{t("colRegister")}</th>
                    <th className="py-1 pr-2 font-normal text-right">{t("colInFile")}</th>
                    <th className="py-1 pr-2 font-normal text-right">{t("colCreate")}</th>
                    <th className="py-1 pr-2 font-normal text-right">{t("colAlready")}</th>
                    <th className="py-1 font-normal text-right">{t("colLeftOut")}</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(summary.registers).map(([kind, s]) => (
                    <tr key={kind} className="border-t">
                      <td className="py-1 pr-2">{t(`kinds.${kind}`)}</td>
                      <td className="py-1 pr-2 text-right">{s.inFile}</td>
                      <td className="py-1 pr-2 text-right">{s.toCreate}</td>
                      <td className="py-1 pr-2 text-right">{s.alreadyImported}</td>
                      <td className="py-1 text-right">{s.leftOut}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {summary.people.inFile > 0 && (
              <p className="text-xs text-muted-foreground">
                {t("people", { matched: summary.people.matched, total: summary.people.inFile })}
              </p>
            )}
            <div className="space-y-1">
              <p className="text-sm font-medium">{t("problemsTitle")}</p>
              {summary.problems.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("noProblems")}</p>
              ) : (
                <ul className="space-y-1">
                  {summary.problems.slice(0, 50).map((p, i) => {
                    const Icon = p.level === "error" ? CircleX : p.level === "warning" ? AlertTriangle : Info;
                    const tone =
                      p.level === "error" ? "text-destructive" : p.level === "warning" ? "text-foreground" : "text-muted-foreground";
                    return (
                      <li key={i} className={`flex gap-2 text-xs ${tone}`}>
                        <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
                        <span>
                          {p.level === "error" ? <span className="sr-only">{t("error")}: </span> : null}
                          {p.level === "warning" ? <span className="sr-only">{t("warning")}: </span> : null}
                          {text(p)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {!summary.canImport && <p className="text-xs text-destructive">{t("blocked")}</p>}
            </div>
          </div>
        )}

        {imported && (
          <p role="status" className="text-sm font-medium" data-testid="import-result">
            {(reply?.created ?? 0) > 0 ? t("done", { count: reply?.created ?? 0 }) : t("nothingNew")}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" disabled={!file || busy !== null} onClick={() => send("check")}>
            {busy === "check" ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" aria-hidden="true" /> : null}
            {busy === "check" ? t("checking") : columns && mode === "register" ? t("recheck") : t("check")}
          </Button>
          {summary && !imported && (
            <Button size="sm" disabled={!summary.canImport || busy !== null} onClick={() => send("import")}>
              {busy === "import" ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" aria-hidden="true" /> : null}
              {busy === "import" ? t("importing") : t("importButton")}
            </Button>
          )}
          {imported && (reply?.created ?? 0) > 0 && (
            <Button variant="link" size="sm" asChild>
              <Link href={REVIEW_DRAFTS_HREF}>{t("review")}</Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
