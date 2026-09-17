// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Server-side reader for the language cookie (see `locale-cookie.ts`).
 * Reads the raw Cookie header so the last-value rule is explicit.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import { headers } from "next/headers";
import { localeFromCookieHeader } from "./locale-cookie";
import type { Locale } from "./config";

export async function getCookieLocale(): Promise<Locale | null> {
  const headerStore = await headers();
  return localeFromCookieHeader(headerStore.get("cookie"));
}
