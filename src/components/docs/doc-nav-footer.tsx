// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NavLink {
  title: string;
  href: string;
}

interface DocNavFooterProps {
  previous?: NavLink;
  next?: NavLink;
}

/**
 * Previous and next links at the foot of a help page. The titles wrap (a
 * Spanish title such as "Cumplimiento de transferencias" is wider than half a
 * phone screen), so the row never pushes the page sideways at 375 px.
 */
export function DocNavFooter({ previous, next }: DocNavFooterProps) {
  return (
    <div className="flex items-start justify-between gap-3 border-t pt-6 mt-10">
      {previous ? (
        <Button variant="ghost" asChild className="h-auto min-w-0 shrink gap-2 whitespace-normal py-2 text-left">
          <Link href={previous.href}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            {previous.title}
          </Link>
        </Button>
      ) : (
        <div />
      )}
      {next ? (
        <Button variant="ghost" asChild className="ml-auto h-auto min-w-0 shrink gap-2 whitespace-normal py-2 text-right">
          <Link href={next.href}>
            {next.title}
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      ) : (
        <div />
      )}
    </div>
  );
}
