"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * A destination country, chosen by name in the screen's language (stored
 * as its ISO 3166-1 alpha-2 code). Typing a name's first letters moves the
 * list to it.
 */

import { useMemo } from "react";
import { useLocale } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ISO_COUNTRY_CODES, canonicalCountryCode, countryName } from "@/lib/country-code";

export function CountryPicker({
  id,
  value,
  onChange,
  placeholder,
  ariaDescribedBy,
}: {
  id?: string;
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
  ariaDescribedBy?: string;
}) {
  const locale = useLocale();
  const options = useMemo(() => {
    const collator = new Intl.Collator(locale);
    return ISO_COUNTRY_CODES.map((code) => ({ code, name: countryName(code, locale) })).sort((a, b) =>
      collator.compare(a.name, b.name)
    );
  }, [locale]);

  return (
    <Select value={canonicalCountryCode(value) || undefined} onValueChange={onChange}>
      <SelectTrigger id={id} aria-describedby={ariaDescribedBy} data-testid="country-picker">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {options.map((o) => (
          <SelectItem key={o.code} value={o.code}>
            {o.name} ({o.code})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
