"use client";

/**
 * Language Switcher Component
 *
 * Allows users to switch between available locales.
 * Only visible when i18n is enabled.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { Globe } from "lucide-react";
import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { locales, localeNames, type Locale } from "@/i18n/config";
import { features } from "@/config/features";

export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();

  // Don't render if i18n is disabled
  if (!features.i18nEnabled) {
    return null;
  }

  const handleLocaleChange = (newLocale: Locale) => {
    // Remove current locale from pathname if present
    let newPathname = pathname;
    for (const loc of locales) {
      if (pathname.startsWith(`/${loc}/`) || pathname === `/${loc}`) {
        newPathname = pathname.replace(`/${loc}`, "") || "/";
        break;
      }
    }

    // Add new locale prefix if not default
    if (newLocale !== "en") {
      newPathname = `/${newLocale}${newPathname}`;
    }

    router.push(newPathname);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline">{localeNames[locale]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
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
