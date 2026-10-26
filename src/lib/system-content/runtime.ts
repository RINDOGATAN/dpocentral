// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The reader's language for the records the app writes itself
 * (./localize.ts), per request.
 *
 * A request that shows data to a person runs inside `withReaderLanguage`
 * (the tRPC organisation procedures and the export routes do). Inside it,
 * every database result is passed through the packs below on its way out of
 * the database client (src/lib/prisma.ts), so pages, reports and exports all
 * read the same text. Outside it (scripts, scheduled jobs, the writers
 * themselves) results are left exactly as stored.
 *
 * To add a pack (a catalogue transfer pack, for example), add it to
 * SYSTEM_CONTENT_PACKS.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { TODOLAW_CONTENT_PACK } from "@/config/todolaw-content-pack";
import {
  createSystemContentLocalizer,
  type ContentLanguage,
  type SystemContentLocalizer,
  type SystemContentPack,
} from "./localize";

export const SYSTEM_CONTENT_PACKS: readonly SystemContentPack[] = [TODOLAW_CONTENT_PACK];

let localizer: SystemContentLocalizer | null = null;
function getLocalizer(): SystemContentLocalizer {
  localizer ??= createSystemContentLocalizer(SYSTEM_CONTENT_PACKS);
  return localizer;
}

const readerLanguage = new AsyncLocalStorage<ContentLanguage>();

/** Anything that is not Spanish reads as English, as in the interface. */
export function contentLanguageOf(locale: string | null | undefined): ContentLanguage {
  return locale === "es" ? "es" : "en";
}

/** Runs `fn` with database results shown in `locale`. */
export function withReaderLanguage<T>(locale: string | null | undefined, fn: () => T): T {
  return readerLanguage.run(contentLanguageOf(locale), fn);
}

/** The language of the current request, or null outside `withReaderLanguage`. */
export function currentReaderLanguage(): ContentLanguage | null {
  return readerLanguage.getStore() ?? null;
}

/** A value in the current reader's language; unchanged outside a request. */
export function localizeForReader<T>(value: T): T {
  const language = readerLanguage.getStore();
  return language ? getLocalizer().deep(value, language) : value;
}

/** A value in `locale`, whatever the request (for data read before it). */
export function localizeSystemContent<T>(value: T, locale: string | null | undefined): T {
  return getLocalizer().deep(value, contentLanguageOf(locale));
}
