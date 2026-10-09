// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The board report in words: every sentence the report prints, built once
 * from the server's data (src/lib/board-report.ts) and the message bundles.
 * The page and the PDF both render this, so they say exactly the same thing
 * in the same language. Pure; tested in tests/board-report.test.ts.
 */

import type { BoardReport } from "./board-report";
import { documentSplit, draftGaps } from "./board-report";

export type Translate = (key: string, values?: Record<string, string | number>) => string;

/** The four message namespaces the report reads. */
export interface BoardTranslators {
  /** `boardReport` */
  board: Translate;
  /** `guided` (stages, state words, step labels, the programme figure) */
  guided: Translate;
  /** `documentRegister` (document names, states, gaps, inputs) */
  register: Translate;
  /** `views` (the Needs action categories) */
  views: Translate;
}

export interface Row {
  label: string;
  value: string;
}

export interface BoardReportText {
  title: string;
  organization: string;
  periodLine: string;
  generatedLine: string;
  scopeNote: string;
  disclaimer: string;
  programme: { title: string; figure: string; parts: string; headers: [string, string]; areas: Row[] };
  documents: { title: string; line: string; readyTitle: string; ready: string[]; noneReady: string; missingTitle: string; missing: Row[]; noneMissing: string };
  incidents: { title: string; rows: Row[] };
  rights: { title: string; rows: Row[] } | null;
  vendors: { title: string; rows: Row[]; note: string | null };
  assessments: { title: string; headers: [string, string, string]; rows: [string, string, string][] };
  risks: { title: string; items: string[]; empty: string };
  actions: { title: string; headers: [string, string, string]; rows: { action: string; owner: string; date: string }[]; note: string; empty: string };
  comment: { title: string; text: string | null; saved: string | null; none: string };
}

/** "1 July 2026" / "1 de julio de 2026", read in UTC so a day never shifts. */
export function formatBoardDate(value: string | Date, locale: string): string {
  const date = typeof value === "string" ? new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value) : value;
  return new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function boardReportText(report: BoardReport, tr: BoardTranslators, locale: string): BoardReportText {
  const { board, guided, register, views } = tr;
  const date = (d: string | Date) => formatBoardDate(d, locale);
  const num = (n: number) => String(n);

  // The programme: the one figure, its parts and the six areas.
  const f = report.figure;
  const parts = [
    f.toConfirm > 0 ? guided("figure.toConfirm", { count: f.toConfirm }) : null,
    f.started > 0 ? guided("figure.started", { count: f.started }) : null,
    f.notStarted > 0 ? guided("figure.notStarted", { count: f.notStarted }) : null,
  ].filter((p): p is string => !!p);
  const areas = report.areas.map((a) => ({
    label: guided(`stages.${a.stageId}`),
    value: a.word === "coming" ? guided("areas.coming") : guided(`stageState.${a.word}`),
  }));

  // Documents: ready, and the others DPO Central produces with what they lack.
  const { ready, missing } = documentSplit(report.documents);
  const produced = report.documents.filter((d) => d.status.state !== "notYet").length;
  const stateText = (status: (typeof report.documents)[number]["status"]) => {
    if (status.state === "needsInput") return register("needs", { input: register(`inputs.${status.input}`) });
    const gaps = draftGaps(status).map((g) => register(`gaps.${g.key}`, { count: g.count }));
    return gaps.length > 0 ? `${register(`state.${status.state}`)} (${gaps.join("; ")})` : register(`state.${status.state}`);
  };

  const incidents = report.incidents;
  const rights = report.rights;
  const vendors = report.vendors;
  const a = report.assessments;

  // Top risks or gaps.
  const risks = report.risks.map((risk) =>
    risk.kind === "needsAction"
      ? board("risks.needsAction", { kind: views(`needsAction.kind.${risk.needsKind}`), count: risk.count })
      : board("risks.document", { name: register(`items.${risk.id}`), state: stateText(risk.status) }),
  );

  // Next three actions, with owner and date.
  const actions = report.actions.map((action) => {
    const item = action.item;
    const label =
      item.kind === "needsAction"
        ? `${views(`needsAction.kind.${item.needsKind}`)} (${item.count})`
        : item.toConfirm
          ? board("actions.confirm", { step: guided(`steps.${item.stepId}.label`) })
          : board("actions.step", { step: guided(`steps.${item.stepId}.label`) });
    const when = action.date
      ? action.dateSource === "deadline"
        ? board("actions.deadline", { date: date(action.date) })
        : board("actions.plan", { date: date(action.date) })
      : board("actions.noDate");
    return { action: label, owner: action.owner ?? board("actions.noOwner"), date: when };
  });

  const comment = report.comment;
  const saved = comment
    ? comment.savedBy
      ? board("comment.saved", { date: date(comment.savedAt), name: comment.savedBy })
      : board("comment.savedNoName", { date: date(comment.savedAt) })
    : null;

  return {
    title: board("title"),
    organization: report.organizationName,
    periodLine: board("periodLine", { from: date(report.period.from), to: date(report.period.to) }),
    generatedLine: board("generatedLine", { date: date(report.generatedAt) }),
    scopeNote: board("scopeNote"),
    disclaimer: board("disclaimer"),
    programme: {
      title: board("programme.title"),
      figure: guided("figure.line", { done: f.confirmed, total: f.total }),
      parts: parts.join(" · "),
      headers: [board("programme.colArea"), board("programme.colState")],
      areas,
    },
    documents: {
      title: board("documents.title"),
      line: board("documents.line", { ready: ready.length, total: produced }),
      readyTitle: board("documents.ready"),
      ready: ready.map((d) => register(`items.${d.id}`)),
      noneReady: board("documents.noneReady"),
      missingTitle: board("documents.missing"),
      missing: missing.map((d) => ({ label: register(`items.${d.id}`), value: stateText(d.status) })),
      noneMissing: board("documents.noneMissing"),
    },
    incidents: {
      title: board("incidents.title"),
      rows: [
        { label: board("incidents.inPeriod"), value: num(incidents.inPeriod) },
        { label: board("incidents.notifiedWithin72h"), value: num(incidents.notifiedWithin72h) },
        { label: board("incidents.notifiedLate"), value: num(incidents.notifiedLate) },
        { label: board("incidents.notNotifiedYet"), value: num(incidents.notNotifiedYet) },
        { label: board("incidents.openNow"), value: num(incidents.openNow) },
      ],
    },
    rights: rights
      ? {
          title: board("rights.title"),
          rows: [
            { label: board("rights.received"), value: num(rights.received) },
            { label: board("rights.completedOnTime"), value: num(rights.completedOnTime) },
            { label: board("rights.completedLate"), value: num(rights.completedLate) },
            { label: board("rights.openOverdue"), value: num(rights.openOverdue) },
            { label: board("rights.openInTime"), value: num(rights.openInTime) },
            { label: board("rights.closedOther"), value: num(rights.closedOther) },
          ],
        }
      : null,
    vendors: {
      title: board("vendors.title"),
      rows: [
        { label: board("vendors.total"), value: num(vendors.total) },
        { label: board("vendors.withDpa"), value: num(vendors.withDpa) },
        { label: board("vendors.highRiskWithoutDpa"), value: num(vendors.highRiskWithoutDpa) },
      ],
      note: vendors.drafts > 0 ? board("vendors.drafts", { count: vendors.drafts }) : null,
    },
    assessments: {
      title: board("assessments.title"),
      headers: [board("assessments.colType"), board("assessments.colApproved"), board("assessments.colPending")],
      rows: [
        [board("assessments.dpia"), num(a.dpiaApproved), num(a.dpiaPending)],
        [board("assessments.lia"), num(a.liaApproved), num(a.liaPending)],
      ],
    },
    risks: { title: board("risks.title"), items: risks, empty: board("risks.empty") },
    actions: {
      title: board("actions.title"),
      headers: [board("actions.colAction"), board("actions.colOwner"), board("actions.colDate")],
      rows: actions,
      note: board("actions.ownerNote"),
      empty: board("actions.empty"),
    },
    comment: {
      title: board("comment.title"),
      text: comment && comment.text.trim() ? comment.text : null,
      saved,
      none: board("comment.none"),
    },
  };
}
