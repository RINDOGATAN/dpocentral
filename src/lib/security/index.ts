// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Security extension point.
 *
 * A fork may supply a stricter sanitizer or a longer list of public e-mail
 * domains by returning a module here. The community edition returns none:
 * the baseline sanitizer (src/lib/sanitize.ts) and the built-in domain list
 * (src/lib/org-domain.ts) apply.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import type { SecurityModule } from "./types";

export type { SecurityModule, OrgRole } from "./types";

/** The installed security module, or null (the community edition). */
export function getSecurityModule(): SecurityModule | null {
  return null;
}
