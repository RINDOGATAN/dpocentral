"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Language Switcher Component
 *
 * Compact locale switcher for the dashboard footer.
 * Only visible when i18n is enabled.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { locales, localeNames, localeShortNames, type Locale } from "@/i18n/config";
import { writeLocaleCookie } from "@/i18n/locale-cookie";
import { features } from "@/config/features";

export function LanguageSwitcher() {
  // Don't render if i18n is disabled - must check before hooks
  if (!features.i18nEnabled) {
    return null;
  }

  return <LanguageSwitcherInner />;
}

function LanguageSwitcherInner() {
  const locale = useLocale() as Locale;
  const router = useRouter();

  const handleLocaleChange = (newLocale: Locale) => {
    // Set locale cookie and reload to apply server-side
    writeLocaleCookie(newLocale);
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={localeNames[locale]}
        className="flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer"
      >
        <Globe className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        {/* Full name where there is room; a two-letter code on a narrow phone,
            where the top bar cannot spare the width. The accessible name above
            carries the full language name in both cases. */}
        <span className="hidden sm:inline" aria-hidden="true">{localeNames[locale]}</span>
        <span className="sm:hidden" aria-hidden="true">{localeShortNames[locale]}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center">
        {locales.map((loc) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => handleLocaleChange(loc)}
            className={loc === locale ? "bg-primary/10" : ""}
          >
            {localeNames[loc]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
