// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/** Builds CsvLabels from the message catalogue. See ./csv-labels.ts. */

import { getTranslations } from "next-intl/server";
import type { CsvEnumKind, CsvLabels, CsvWords } from "./csv-labels";

export type CsvRegister = "ropa" | "vendors" | "breaches";

/**
 * The labels for `register` in `locale`, or undefined for English (the
 * generators then keep their built-in English text and raw codes).
 */
export async function csvLabelsFor<H extends string>(
  register: CsvRegister,
  keys: readonly H[],
  locale: string,
): Promise<CsvLabels<H> | undefined> {
  if (locale === "en") return undefined;
  const [tHead, tWords, tEnum] = await Promise.all([
    getTranslations({ locale, namespace: `pdf.csv.${register}` }),
    getTranslations({ locale, namespace: "pdf.csv.words" }),
    getTranslations({ locale, namespace: "enums" }),
  ]);
  const headers = Object.fromEntries(keys.map((k) => [k, tHead(k as never)])) as Record<H, string>;
  const words: CsvWords = {
    notSpecified: tWords("notSpecified"),
    yes: tWords("yes"),
    no: tWords("no"),
    none: tWords("none"),
    noDpa: tWords("noDpa"),
  };
  const code = (kind: CsvEnumKind, value: string): string => {
    const key = `${kind}.${value}`;
    return tEnum.has(key as never) ? tEnum(key as never) : value;
  };
  return { headers, words, code };
}
