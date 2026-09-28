"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useLocale } from "next-intl";
import type { ContentLocale } from "@/config/help/localized";

/**
 * The locale to read bilingual help content in, on the client. The product has
 * two content languages; anything that is not Spanish reads as English.
 */
export function useContentLocale(): ContentLocale {
  return useLocale() === "es" ? "es" : "en";
}
