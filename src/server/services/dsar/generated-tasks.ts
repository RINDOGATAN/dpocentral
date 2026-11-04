// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Title and description of the tasks dsar.generateTasks creates, one per
 * system holding personal data, in the language of the person generating
 * them (English or Spanish).
 */

import { createTranslator } from "next-intl";
import enMessages from "@/messages/en.json";
import esMessages from "@/messages/es.json";

const BUNDLES = { en: enMessages, es: esMessages } as const;

export function generatedTaskText(
  locale: "en" | "es",
  values: { asset: string; requester: string }
): { title: string; description: string } {
  const t = createTranslator({ locale, messages: BUNDLES[locale], namespace: "dsarGeneratedTask" });
  return { title: t("title", values), description: t("description", values) };
}
