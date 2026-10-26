"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The language as an account setting, not only a browser cookie.
 *
 * - `AccountLocaleSync` (mounted once in the signed-in shell): on a browser
 *   with no language cookie yet, the language saved on the account is applied
 *   (cookie written, page reloaded once), so a Spanish user signing in on a new
 *   device is not met in English.
 * - `AccountLanguageSwitcher`: the usual switcher, which also saves the
 *   choice on the account. Used on the signed-in screens, including the first
 *   (onboarding) screen.
 */

import { useEffect, useRef } from "react";
import { useLocale } from "next-intl";
import { trpc } from "@/lib/trpc";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { readLocaleCookie, writeLocaleCookie } from "@/i18n/locale-cookie";
import { isValidLocale, type Locale } from "@/i18n/config";
import { features } from "@/config/features";

/** What to do on load: apply the account's language, or nothing. Pure, for tests. */
export function localeToApply(
  cookieLocale: Locale | null,
  accountLocale: string | null | undefined,
  current: string,
): Locale | null {
  if (cookieLocale) return null; // The browser's own choice stands.
  if (!accountLocale || !isValidLocale(accountLocale)) return null;
  return accountLocale === current ? null : accountLocale;
}

export function AccountLocaleSync() {
  const locale = useLocale();
  const done = useRef(false);
  const { data } = trpc.user.getLocale.useQuery(undefined, {
    enabled: features.i18nEnabled,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });
  useEffect(() => {
    if (done.current || !data) return;
    done.current = true;
    const apply = localeToApply(readLocaleCookie(), data.locale, locale);
    if (apply) {
      writeLocaleCookie(apply);
      // A full reload, once: the translations the client already holds are
      // not replaced by a server refresh alone.
      window.location.reload();
    }
  }, [data, locale]);
  return null;
}

export function AccountLanguageSwitcher() {
  const save = trpc.user.setLocale.useMutation();
  const utils = trpc.useUtils();
  // Saving is best effort: the cookie already carries the choice. The data
  // already on screen is fetched again, so the records the app wrote itself
  // (src/lib/system-content/) follow the new language too.
  return (
    <LanguageSwitcher
      onChange={(l) => {
        save.mutate({ locale: l }, { onError: () => undefined });
        void utils.invalidate();
      }}
    />
  );
}
