"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * A term with its plain meaning one tap away.
 *
 * The word is shown with a dotted underline and a "?" so it reads as
 * explainable, not as a broken link. Tapping or pressing it opens a small
 * popover with the one-line meaning from the glossary, and, where there is one,
 * a link to the fuller docs. Built on Radix Popover, so it works by keyboard and
 * by touch, not hover alone: a hover-only tip never reaches a touch reader.
 *
 * Usage: <Term id="controller" /> shows the glossary label; pass children to
 * override the shown word while keeping the same meaning (<Term id="processor">
 * processors</Term>).
 *
 * An unknown id renders its children (or nothing) with no popover, so a typo
 * degrades to plain text rather than an empty control.
 */

import Link from "next/link";
import * as Popover from "@radix-ui/react-popover";
import { useTranslations } from "next-intl";
import { HelpCircle } from "lucide-react";
import { glossaryTerm } from "@/config/help/glossary";
import { useContentLocale } from "@/lib/content-locale";
import { cn } from "@/lib/utils";

export function Term({
  id,
  children,
  className,
}: {
  id: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const t = useTranslations("help");
  const locale = useContentLocale();
  const term = glossaryTerm(id);

  if (!term) return <>{children}</>;

  const label = children ?? term.label[locale];

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={t("termMeaningOf", { term: term.label[locale] })}
          className={cn(
            "inline items-baseline gap-0.5 underline decoration-dotted decoration-muted-foreground/60 underline-offset-4 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background rounded-sm",
            className,
          )}
        >
          {label}
          <HelpCircle className="ml-0.5 inline size-3 shrink-0 translate-y-[1px] text-muted-foreground" aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          collisionPadding={12}
          className="z-[60] max-w-xs rounded-lg border border-border bg-popover p-3 text-sm shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        >
          <p className="font-medium text-foreground">{term.label[locale]}</p>
          <p className="mt-1 text-muted-foreground">{term.meaning[locale]}</p>
          {term.docHref && (
            <Link
              href={term.docHref}
              className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
            >
              {t("learnMore")}
            </Link>
          )}
          <Popover.Arrow className="fill-border" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
