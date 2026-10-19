// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The words of the record of processing in one language, and the one table
 * (one row per activity) that the CSV and the XLSX are written from.
 *
 * Column order: in Spanish, the order of the record the Spanish supervisory
 * authority publishes as its own model (activity, controller, purposes, legal
 * basis, data subjects, data, recipients, transfers, erasure, security); in
 * English, the order of the letters of Art. 30(1) and 30(2). Nothing here
 * prints a stored code: every enum goes through a label and every country
 * code through its name.
 */

import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/config";
import {
  SPECIAL_CATEGORIES,
  type ROPAEntry,
  type ROPATransfer,
  type RopaRecordKind,
  type RopaRole,
  type RopaWarning,
} from "@/server/services/privacy/ropaGenerator";
import type { ControllerDetails } from "./record-data";

type T = (key: string, values?: Record<string, string | number>) => string;

export interface RopaText {
  locale: Locale;
  /** Scoped to `pdf.ropaRecord`. */
  t: T;
  /** A date-only value, in UTC so it never moves a day: 02/01/2026 or 2026-01-02. */
  date(d: Date | string | null | undefined): string;
  /** A date in words, in UTC: "2 January 2026" / "2 de enero de 2026". */
  longDate(d: Date | string | null | undefined): string;
  country(code: string): string;
  mechanism(m: string): string;
  legalBasis(b: string, detail?: string | null): string;
  category(c: string): string;
  role(r: RopaRole | undefined): string;
  warning(w: RopaWarning): string;
  retention(e: Pick<ROPAEntry, "retentionPeriod" | "retentionDays">): string | null;
  transfer(tr: ROPATransfer): string;
  notSpecified: string;
}

const toDate = (d: Date | string) => (typeof d === "string" && d.length === 10 ? new Date(`${d}T00:00:00.000Z`) : new Date(d));

export function formatRopaDate(d: Date | string | null | undefined, locale: string): string {
  if (!d) return "";
  const date = toDate(d);
  if (Number.isNaN(date.getTime())) return "";
  if (locale === "es") {
    return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(date);
  }
  return date.toISOString().slice(0, 10);
}

export function formatRopaLongDate(d: Date | string | null | undefined, locale: string): string {
  if (!d) return "";
  const date = toDate(d);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** "US" gives "United States" / "Estados Unidos"; an unknown value is kept as written. */
export function countryName(code: string, locale: string): string {
  const value = (code ?? "").trim();
  if (!/^[A-Za-z]{2}$/.test(value)) return value;
  const upper = value.toUpperCase() === "UK" ? "GB" : value.toUpperCase();
  try {
    const name = new Intl.DisplayNames([locale === "es" ? "es-ES" : "en-GB"], { type: "region" }).of(upper);
    return name && name !== upper ? name : value;
  } catch {
    return value;
  }
}

type Translator = ((key: string, values?: Record<string, string | number>) => string) & {
  has: (key: string) => boolean;
};

export async function ropaText(locale: Locale): Promise<RopaText> {
  const [tr, tEnum] = await Promise.all([
    getTranslations({ locale, namespace: "pdf.ropaRecord" }),
    getTranslations({ locale, namespace: "enums" }),
  ]);
  return ropaTextFrom(locale, tr as unknown as T, tEnum as unknown as Translator);
}

/** The same, from translators already made (`pdf.ropaRecord` and `enums`). */
export function ropaTextFrom(locale: Locale, t: T, tEnum: Translator): RopaText {
  const label = (kind: string, value: string): string => {
    const key = `${kind}.${value}`;
    return tEnum.has(key) ? tEnum(key) : value.replace(/_/g, " ").toLowerCase();
  };
  const notSpecified = t("words.notSpecified");
  const text: RopaText = {
    locale,
    t,
    notSpecified,
    date: (d) => formatRopaDate(d, locale),
    longDate: (d) => formatRopaLongDate(d, locale),
    country: (c) => countryName(c, locale),
    mechanism: (m) => label("transferMechanism", m),
    legalBasis: (b, detail) => {
      if (!b) return notSpecified;
      const base = label("legalBasis", b);
      return detail ? `${base}: ${detail}` : base;
    },
    category: (c) => label("dataCategory", c),
    role: (r) => t(`role.${r ?? "CONTROLLER"}`),
    warning: (w) => t(`warnings.${w}`),
    retention: (e) => {
      const words = e.retentionPeriod?.trim() || null;
      const days = e.retentionDays != null && e.retentionDays > 0 ? t("words.days", { count: e.retentionDays }) : null;
      if (words && days) return `${words} (${days})`;
      return words ?? days;
    },
    transfer: (tr) => {
      const details = [
        text.mechanism(tr.mechanism),
        tr.safeguards?.trim().replace(/\.+$/, "") || null,
        tr.tiaCompleted
          ? tr.tiaDate
            ? t("words.tiaOn", { date: formatRopaDate(tr.tiaDate, locale) })
            : t("words.tiaDone")
          : null,
      ].filter(Boolean);
      const where = [text.country(tr.destination), tr.organization?.trim() || null].filter(Boolean).join(": ");
      return `${where} (${details.join("; ")})`;
    },
  };
  return text;
}

// ─── The controller block ─────────────────────────────────────────────────

/** "Name, Tax ID, Address, e-mail, phone" on one line, empty parts left out. */
export function controllerContactLine(c: ControllerDetails, x: RopaText): string {
  return [
    c.taxId ? `${x.t("controller.taxId")}: ${c.taxId}` : null,
    c.address,
    c.email,
    c.phone,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function personLine(name: string | null, contact: string | null): string | null {
  const parts = [name, contact].filter((p): p is string => !!p && !!p.trim());
  return parts.length ? parts.join(" · ") : null;
}

/** The block as label/value pairs, for the PDF cover and the XLSX sheet. */
export function controllerBlockRows(c: ControllerDetails, kind: RopaRecordKind, x: RopaText): Array<[string, string]> {
  const t = x.t;
  return [
    [kind === "processor" ? t("controller.processorName") : t("controller.name"), c.legalName || x.notSpecified],
    [t("controller.taxId"), c.taxId ?? x.notSpecified],
    [t("controller.address"), c.address ?? x.notSpecified],
    [t("controller.email"), c.email ?? x.notSpecified],
    [t("controller.phone"), c.phone ?? x.notSpecified],
    [t("controller.dpo"), personLine(c.dpoName, c.dpoContact) ?? t("words.notDesignated")],
    [t("controller.representative"), personLine(c.representativeName, c.representativeContact) ?? t("words.notDesignated")],
    [t("controller.securityMeasures"), c.securityMeasures ?? x.notSpecified],
  ];
}

// ─── The table (CSV and XLSX) ─────────────────────────────────────────────

export const CONTROLLER_COLUMNS_ART30 = [
  "activity",
  "controller",
  "controllerContact",
  "jointController",
  "dpo",
  "representative",
  "purpose",
  "dataSubjects",
  "dataCategories",
  "specialCategories",
  "recipients",
  "transfers",
  "retention",
  "security",
  "legalBasis",
  "role",
  "description",
  "automatedDecisions",
  "systems",
  "lastReviewed",
  "nextReview",
] as const;

/** The order of the Spanish authority's own published record. */
export const CONTROLLER_COLUMNS_AEPD = [
  "activity",
  "controller",
  "controllerContact",
  "jointController",
  "dpo",
  "representative",
  "purpose",
  "legalBasis",
  "dataSubjects",
  "dataCategories",
  "specialCategories",
  "recipients",
  "transfers",
  "retention",
  "security",
  "role",
  "description",
  "automatedDecisions",
  "systems",
  "lastReviewed",
  "nextReview",
] as const;

export const PROCESSOR_COLUMNS = [
  "processor",
  "processorContact",
  "dpo",
  "representative",
  "clientController",
  "clientControllerContact",
  "clientRepresentative",
  "clientDpo",
  "activity",
  "processingCategories",
  "dataSubjects",
  "dataCategories",
  "transfers",
  "security",
  "description",
  "systems",
  "lastReviewed",
  "nextReview",
] as const;

export type RopaColumn =
  | (typeof CONTROLLER_COLUMNS_ART30)[number]
  | (typeof PROCESSOR_COLUMNS)[number];

export function ropaColumns(kind: RopaRecordKind, locale: string): readonly RopaColumn[] {
  if (kind === "processor") return PROCESSOR_COLUMNS;
  return locale === "es" ? CONTROLLER_COLUMNS_AEPD : CONTROLLER_COLUMNS_ART30;
}

function cell(col: RopaColumn, e: ROPAEntry, c: ControllerDetails, x: RopaText): string {
  const ns = x.notSpecified;
  const list = (v: string[]) => (v.length ? v.join("; ") : ns);
  switch (col) {
    case "activity":
      return e.name;
    case "controller":
    case "processor":
      return c.legalName;
    case "controllerContact":
    case "processorContact":
      return controllerContactLine(c, x) || ns;
    case "jointController":
      return e.role === "JOINT_CONTROLLER" ? e.jointControllerDetails?.trim() || ns : x.t("words.none");
    case "dpo":
      return personLine(c.dpoName, c.dpoContact) ?? x.t("words.notDesignated");
    case "representative":
      return personLine(c.representativeName, c.representativeContact) ?? x.t("words.notDesignated");
    case "clientController":
      return e.clientControllerName?.trim() || ns;
    case "clientControllerContact":
      return e.clientControllerContact?.trim() || ns;
    case "clientRepresentative":
      return e.clientRepresentative?.trim() || x.t("words.notDesignated");
    case "clientDpo":
      return e.clientDpo?.trim() || x.t("words.notDesignated");
    case "purpose":
    case "processingCategories":
      return e.purpose || ns;
    case "legalBasis":
      return x.legalBasis(e.legalBasis, e.legalBasisDetail);
    case "dataSubjects":
      return list(e.dataSubjects);
    case "dataCategories":
      return list(e.dataCategories.map(x.category));
    case "specialCategories": {
      const special = e.dataCategories.filter((k) => SPECIAL_CATEGORIES.has(k));
      return special.length ? special.map(x.category).join("; ") : x.t("words.no");
    }
    case "recipients":
      return list(e.recipients);
    case "transfers":
      return e.transfers.length ? e.transfers.map(x.transfer).join("; ") : x.t("words.noTransfers");
    case "retention":
      return x.retention(e) ?? ns;
    case "security":
      return e.securityMeasures?.trim() || ns;
    case "role":
      return x.role(e.role);
    case "description":
      return e.description?.trim() || "";
    case "automatedDecisions":
      return e.automatedDecisionMaking
        ? `${x.t("words.yes")}${e.automatedDecisionDetail ? `: ${e.automatedDecisionDetail}` : ""}`
        : x.t("words.no");
    case "systems":
      return e.systems.map((s) => s.name).join("; ");
    case "lastReviewed":
      return e.lastReviewed ? x.date(e.lastReviewed) : x.t("words.neverReviewed");
    case "nextReview":
      return x.date(e.nextReview);
  }
}

export interface RopaTable {
  headers: string[];
  rows: string[][];
}

export function ropaTable(
  kind: RopaRecordKind,
  entries: ROPAEntry[],
  controller: ControllerDetails,
  x: RopaText,
): RopaTable {
  const columns = ropaColumns(kind, x.locale);
  return {
    headers: columns.map((col) => x.t(`columns.${col}`)),
    rows: entries.map((e) => columns.map((col) => cell(col, e, controller, x))),
  };
}

// ─── CSV ──────────────────────────────────────────────────────────────────

/** One cell; a value a spreadsheet would read as a formula gets a leading quote. */
export function csvCell(v: string, sep: string): string {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return safe.includes(sep) || /["\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * The CSV of a table: a UTF-8 byte order mark (so a spreadsheet reads the
 * accents), CRLF line ends, and the list separator the language's spreadsheet
 * expects (";" in Spanish, where the comma is the decimal mark).
 */
export function tableToCsv(table: RopaTable, locale: string): string {
  const sep = locale === "es" ? ";" : ",";
  const line = (r: string[]) => r.map((v) => csvCell(v, sep)).join(sep);
  return "﻿" + [line(table.headers), ...table.rows.map(line)].join("\r\n") + "\r\n";
}
