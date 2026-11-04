"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Adds namespaces to the messages already in context, for one route tree.
 *
 * The root layout sends the browser only the namespaces every page may read
 * (src/i18n/client-messages.ts). A route tree that reads a large namespace of
 * its own (the user guide, the assessment templates) wraps its pages in this
 * provider with just that namespace: it is sent once, with those pages, and
 * merged with the catalogue the root already sent (a nested provider does
 * not inherit its parent's messages, so the merge is done here).
 */

import { NextIntlClientProvider, useLocale, useMessages, useTimeZone } from "next-intl";
import type { AbstractIntlMessages } from "next-intl";

export function ExtraMessages({
  messages,
  children,
}: {
  /** The namespaces to add (a plain object of messages, from pickNamespaces). */
  messages: Record<string, unknown>;
  children: React.ReactNode;
}) {
  const inherited = useMessages();
  const locale = useLocale();
  const timeZone = useTimeZone();
  return (
    <NextIntlClientProvider locale={locale} timeZone={timeZone} messages={{ ...inherited, ...(messages as AbstractIntlMessages) }}>
      {children}
    </NextIntlClientProvider>
  );
}
