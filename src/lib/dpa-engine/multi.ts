// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

// Kept dependency-free on purpose: consistency.ts imports this and is
// itself imported client-side — nothing here may pull in the pack JSON.

/** Split a comma-joined multi-select value into trimmed non-empty keys. */
export function splitMulti(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
