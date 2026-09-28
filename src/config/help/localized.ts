// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The two content languages the help feature reads bilingual data in. Kept in
 * one leaf module so the glossary, the guides, the page registry and the
 * components all share the same shape, and so a sister app can reuse the
 * components by copying this data. Anything that is not Spanish reads as
 * English, matching the app's own en/es locales (src/i18n/config.ts).
 */

export type ContentLocale = "en" | "es";

export interface Localized {
  en: string;
  es: string;
}
