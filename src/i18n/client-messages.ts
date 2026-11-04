// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Which message namespaces reach the browser.
 *
 * The root layout hands the whole catalogue to NextIntlClientProvider, so
 * every page carried every namespace in its HTML (about 480 KB raw per
 * page, a third of it never read by a client component). Two cuts:
 *
 * - SERVER_ONLY_NAMESPACES are read with getTranslations on the server
 *   (PDF reports, e-mails, server error texts, the licence page, the
 *   not-found page). No client component reads them, so they stay out.
 * - ROUTE_SCOPED_NAMESPACES are read under one route tree only: "docs"
 *   (the in-app user guide, the largest namespace) under /privacy/docs. Its
 *   layout adds it back with ExtraMessages
 *   (src/components/intl/extra-messages.tsx), so its pages have it and every
 *   other page does not.
 *
 * tests/client-messages.test.ts checks the source tree against both lists:
 * a client component that starts reading one of these namespaces fails the
 * test instead of rendering a bare key.
 */

export type Messages = Record<string, unknown>;

export const SERVER_ONLY_NAMESPACES: readonly string[] = [
  "pdf",
  "serverErrors",
  "licenses",
  "notFound",
  "dsarReminderEmail",
  "dsarGeneratedTask",
];

export const DOCS_NAMESPACE = "docs";

/** Namespaces left out of every page and added back by their own route tree. */
export const ROUTE_SCOPED_NAMESPACES: readonly string[] = [DOCS_NAMESPACE];

/** The catalogue every page sends to the browser. */
export function clientMessages(all: Messages): Messages {
  const out: Messages = {};
  for (const [ns, value] of Object.entries(all)) {
    if (SERVER_ONLY_NAMESPACES.includes(ns) || ROUTE_SCOPED_NAMESPACES.includes(ns)) continue;
    out[ns] = value;
  }
  return out;
}

/** Only the given namespaces, for a route tree's ExtraMessages provider. */
export function pickNamespaces(all: Messages, namespaces: readonly string[]): Messages {
  const out: Messages = {};
  for (const ns of namespaces) if (all[ns] !== undefined) out[ns] = all[ns];
  return out;
}
