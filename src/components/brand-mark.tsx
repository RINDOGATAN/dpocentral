// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The product name in capitals, in Jost 600, as the top bar and the sign-in
 * screens show it. The caller supplies the wrapping link and its layout.
 */

import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";

const BRAND_STYLE = { fontFamily: "var(--font-jost), 'Jost', sans-serif", fontWeight: 600 } as const;

/** The product name alone, in capitals. */
export function BrandName({ nameClassName }: { nameClassName?: string }) {
  return (
    <span className={cn("text-lg tracking-tight", nameClassName)} style={BRAND_STYLE}>
      {brand.nameUppercase}
    </span>
  );
}

export function BrandMark({ nameClassName }: { nameClassName?: string }) {
  return <BrandName nameClassName={nameClassName} />;
}
