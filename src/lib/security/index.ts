// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Security module — public API
 *
 * AGPL-3.0 License - Part of the open-source core
 */

export type { SecurityModule, OrgRole } from "./types";
export { loadSecurityModule, getSecurityModule } from "./loader";
