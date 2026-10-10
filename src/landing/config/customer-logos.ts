// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Customer logos shown on the public landing.
 *
 * A customer's logo goes here ONLY with that customer's written consent to
 * be named on this page. The list ships empty, and while it is empty the
 * landing renders no logo section at all (no heading, no placeholder).
 *
 * Each entry: the organisation's name (the image's alt text), the logo's
 * path under public/ (a light or white version that reads on the dark
 * background), and optionally the organisation's site.
 */

export interface CustomerLogo {
  name: string;
  src: string;
  href?: string;
}

export const CUSTOMER_LOGOS: readonly CustomerLogo[] = [];
