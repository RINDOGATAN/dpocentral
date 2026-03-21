"use client";

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
import { locales, localeNames, type Locale } from "@/i18n/config";
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
    document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer">
        <Globe className="w-3.5 h-3.5" />
        {localeNames[locale]}
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
