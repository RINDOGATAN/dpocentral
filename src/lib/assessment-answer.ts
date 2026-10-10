// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Whether a saved assessment response carries no answer at all: a multi-select
 * with every option unticked, sent either as an empty array or as its JSON
 * text "[]". Such a response is removed rather than stored, so the question
 * counts as unanswered everywhere (progress, required checks, export).
 */
export function isEmptyAnswer(value: unknown): boolean {
  if (Array.isArray(value)) return value.length === 0;
  return typeof value === "string" && /^\[\s*\]$/.test(value.trim());
}
