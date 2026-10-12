// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * A name placed at the end of a sentence that already ends with a full stop:
 * "Acme, S.L." must read "... con Acme, S.L." and not "... con Acme, S.L..".
 */
export function withoutFinalStop(name: string): string {
  return name.replace(/\.+$/, "");
}
