// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * A vendor's website as stored is free text (typed, imported from a CSV or
 * sent by the API): "https://acme.com", "acme.com" or anything else. These
 * never throw, so a page that shows one never fails on it.
 */

/** A link target: the address with https:// added when it has no scheme. */
export function websiteHref(website: string): string {
  const w = website.trim();
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(w) ? w : `https://${w}`;
}

/** The host to show ("acme.com"), or the text as written when it is not an address. */
export function websiteHost(website: string): string {
  try {
    return new URL(websiteHref(website)).hostname || website;
  } catch {
    return website;
  }
}
