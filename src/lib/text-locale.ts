// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/** The language of generated text, e-mails and server messages: Spanish or English. */
export function textLocale(value: string | undefined): "en" | "es" {
  return value?.toLowerCase().startsWith("es") ? "es" : "en";
}
