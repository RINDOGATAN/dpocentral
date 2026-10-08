// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Server error messages in the reader's language.
 *
 * Procedures throw their refusals in English (the source of truth, and what
 * the log and the tests read). Before a message leaves the server, the tRPC
 * error formatter passes it through `localizeServerMessage`, which finds the
 * English text in the `serverErrors` namespace of the message bundles and
 * answers the same message in the reader's language. A message it does not
 * know is returned unchanged, so a new refusal is never lost, only left in
 * English until it is added to the bundles.
 *
 *  - `serverErrors.exact.*`: whole messages, matched as written.
 *  - `serverErrors.pattern.*`: messages with values in them, matched by the
 *    expressions below and refilled in the reader's language.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import { createTranslator } from "next-intl";
import enMessages from "@/messages/en.json";
import esMessages from "@/messages/es.json";
import type { Locale } from "@/i18n/config";

type Bundle = typeof enMessages;
const BUNDLES: Record<Locale, Bundle> = { en: enMessages, es: esMessages as Bundle };

/** Bundles may not carry a long dash; the English throw sites still may. */
function normalise(text: string): string {
  return text.replace(/\s+—\s+/g, ": ").trim();
}

let exactIndex: Map<string, string> | null = null;
function exactKeyOf(message: string): string | undefined {
  if (!exactIndex) {
    exactIndex = new Map(
      Object.entries(enMessages.serverErrors.exact).map(([key, text]) => [normalise(text), key])
    );
  }
  return exactIndex.get(normalise(message));
}

/** Assessment type codes as a Spanish reader knows them. */
const TYPE_LABELS: Record<Locale, Record<string, string>> = {
  en: {},
  es: { DPIA: "EIPD" },
};

type PatternKey = keyof Bundle["serverErrors"]["pattern"];
const PATTERNS: Array<{
  key: PatternKey;
  re: RegExp;
  values: (m: RegExpMatchArray, locale: Locale) => Record<string, string | number>;
}> = [
  {
    key: "freeSlotsPortfolio",
    re: /^You can import up to 5 vendors for free from your Vendor\.Watch portfolio\. You have (\d+) free slots? remaining\. Subscribe to the Vendor Catalog add-on to import more\.$/,
    values: (m) => ({ remaining: Number(m[1]) }),
  },
  {
    key: "freeSlotsQuickstart",
    re: /^You can import up to 5 vendors for free during quickstart\. You have (\d+) free slots? remaining\. Subscribe to the Vendor Catalog add-on to import more\.$/,
    values: (m) => ({ remaining: Number(m[1]) }),
  },
  {
    key: "premiumUpgrade",
    re: /^(\w+) assessments require a premium license\. Upgrade your plan to access this feature\.$/,
    values: (m, locale) => ({ type: TYPE_LABELS[locale][m[1]] ?? m[1] }),
  },
  {
    key: "premiumContact",
    re: /^(\w+) assessments require a premium license\. Contact (.+) to enable this feature\.$/,
    values: (m, locale) => ({ type: TYPE_LABELS[locale][m[1]] ?? m[1], company: m[2] }),
  },
  {
    key: "stillToAnswer",
    re: /^Still to answer \((\d+)\): ([\s\S]*)$/,
    values: (m, locale) => {
      const more = /^([\s\S]*); and (\d+) more$/.exec(m[2]);
      const list = more
        ? createTranslator({ locale, messages: BUNDLES[locale] })("serverErrors.pattern.andMore", {
            shown: more[1],
            rest: more[2],
          })
        : m[2];
      return { count: m[1], list };
    },
  },
  {
    key: "unconfirmedIssues",
    re: /^Unconfirmed consistency issues: (.*)$/,
    values: (m) => ({ codes: m[1] }),
  },
];

/** The message in the reader's language, or unchanged when it is not known. */
export function localizeServerMessage(message: string, locale: Locale): string {
  if (locale === "en" || !message) return message;
  const messages = BUNDLES[locale];
  if (!messages) return message;

  const key = exactKeyOf(message);
  if (key) {
    const exact = messages.serverErrors.exact as Record<string, string>;
    return exact[key] ?? message;
  }

  for (const pattern of PATTERNS) {
    const m = pattern.re.exec(message);
    if (!m) continue;
    const t = createTranslator({ locale, messages });
    return t(`serverErrors.pattern.${pattern.key}`, pattern.values(m, locale));
  }
  return message;
}
