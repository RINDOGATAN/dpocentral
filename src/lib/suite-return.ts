// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The way back to AI Sentinel after linking (src/app/(dashboard)/privacy/suite/ai-sentinel).
 * Only an address on AI Sentinel's own origin is followed; anything else is
 * dropped, so the page cannot be used to send someone elsewhere.
 */
export const AI_SENTINEL_PUBLIC_URL = process.env.NEXT_PUBLIC_AI_SENTINEL_URL || "https://aisentinel.todo.law";

export function safeAiSentinelReturn(value: string | null | undefined, base: string = AI_SENTINEL_PUBLIC_URL): string | null {
  if (!value) return null;
  try {
    const target = new URL(value);
    const allowed = new URL(base);
    if (target.protocol !== allowed.protocol || target.host !== allowed.host) return null;
    return target.toString();
  } catch {
    return null;
  }
}
