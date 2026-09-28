// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The three short guides, as links. Their `key` is the `help` i18n key for the
 * shown label; their content lives in src/config/help/guides.ts. Kept in a leaf
 * module so the help panel and the first-run card can both use it without a
 * circular import.
 */

export const HELP_GUIDES = [
  { href: "/privacy/docs/guides/controller-or-processor", key: "guideRole" },
  { href: "/privacy/docs/guides/do-i-need-a-dpo", key: "guideDpo" },
  { href: "/privacy/docs/guides/when-is-a-dpia-required", key: "guideDpia" },
] as const;
