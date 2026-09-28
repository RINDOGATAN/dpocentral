// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The shape of the help content for one page.
 *
 * Content is data, kept apart from the component that shows it, so the same
 * "?" panel serves every page and a sister app can reuse the component by
 * supplying its own registry. Everything a reader sees is bilingual, so the
 * panel reads the same in English and Castilian Spanish.
 */

import type { Localized } from "@/config/help/localized";
import type { OfficialLink } from "@/config/help/official-links";

export type { Localized, OfficialLink };

/** A link into the product docs (an internal path). */
export interface HelpDocLink {
  href: string;
  label: Localized;
}

export interface PageHelp {
  /** The base path this help serves, e.g. "/privacy/data-inventory". */
  route: string;
  /** The page's name, shown at the top of the panel. */
  title: Localized;
  /** What the page is for, in about two sentences. */
  purpose: Localized;
  /** The one thing to do first on this page. */
  firstStep: Localized;
  /** Glossary term ids used on the page; the panel shows each with its meaning. */
  terms: string[];
  /** Links into the product docs for a fuller explanation. */
  docs: HelpDocLink[];
  /** Links to the official legal text, where the page enforces one. */
  official: OfficialLink[];
}
