// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Which template the auto-filled answers may be written against.
 *
 * The suggestions the auto-fill produces are keyed to the question ids of the
 * standard DPIA template (src/config/dpia-template-v2.ts): "s1_legal_basis",
 * "s3_data_categories" and so on. Another DPIA template, for instance the
 * global health-data one, has its own ids and its own questions.
 *
 * The wizard used to fall back to the first DPIA template in the list when the
 * standard one was absent, which wrote answers against questions that were
 * never asked: the answers landed nowhere a reader would find them, and the
 * assessment looked part-answered when nothing had been answered. It refuses
 * instead.
 */

import { DPIA_TEMPLATE_ID } from "@/config/dpia-template-v2";

/** The standard DPIA template, or null. Never a guess. */
export function autoFillTemplate<T extends { id: string }>(
  templates: readonly T[] | null | undefined
): T | null {
  return templates?.find((template) => template.id === DPIA_TEMPLATE_ID) ?? null;
}
