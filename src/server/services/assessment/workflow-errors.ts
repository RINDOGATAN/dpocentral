// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Refusals of the assessment workflow, in the reader's language. The text
 * lives in the message bundles (`assessmentWorkflow.errors`), so English and
 * Spanish stay in step; the router picks the language from the locale cookie.
 */

import { TRPCError } from "@trpc/server";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

export type WorkflowErrorKey = keyof typeof en.assessmentWorkflow.errors;

const BUNDLES = {
  en: en.assessmentWorkflow.errors,
  es: (es as typeof en).assessmentWorkflow.errors,
};

export function workflowMessage(
  key: WorkflowErrorKey,
  locale: string | null | undefined,
  values: Record<string, string | number> = {}
): string {
  const bundle = locale?.toLowerCase().startsWith("es") ? BUNDLES.es : BUNDLES.en;
  return bundle[key].replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ""));
}

export function workflowError(
  key: WorkflowErrorKey,
  locale: string | null | undefined,
  values?: Record<string, string | number>,
  code: TRPCError["code"] = "BAD_REQUEST"
): TRPCError {
  return new TRPCError({ code, message: workflowMessage(key, locale, values) });
}

/** "Still to answer (n): a; b; c; and 2 more", in the reader's language. */
export function stillToAnswerMessage(
  texts: string[],
  locale: string | null | undefined,
  limit = 3
): string {
  const shown = texts.slice(0, limit).join("; ");
  const rest = texts.length - Math.min(limit, texts.length);
  const list = rest > 0 ? `${shown}; ${workflowMessage("andMore", locale, { count: rest })}` : shown;
  return workflowMessage("stillToAnswer", locale, { count: texts.length, list });
}
