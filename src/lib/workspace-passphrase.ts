// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { timingSafeEqual } from "crypto";

/**
 * Timing-safe comparison of a user-supplied workspace passphrase against the
 * required one (WORKSPACE_PASSPHRASE from the suite's .env).
 *
 * The length check leaks only the length, which is acceptable: the passphrase
 * is a local speed bump against casual snooping, and timingSafeEqual requires
 * equal-length buffers anyway.
 */
export function verifyWorkspacePassphrase(
  input: string,
  required: string
): boolean {
  const a = Buffer.from(input, "utf8");
  const b = Buffer.from(required, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
