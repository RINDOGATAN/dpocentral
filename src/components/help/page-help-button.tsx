"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The "?" in the top bar. It reads the current path, finds that page's help in
 * the registry, and opens a side panel with: what the page is for, what to do
 * first, the terms it uses with their meanings, the three short guides, a way
 * into the fuller docs, and a link to the words of the law where the page
 * enforces one.
 *
 * Product-neutral but for the registry it reads. Mounted in both the Guided and
 * the Classic header, so the help is one tap away from every page. When a page
 * has no entry (outside the privacy area) the button does not render.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { HelpCircle, ExternalLink, ArrowRight, BookOpen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { helpForPath } from "@/config/help/pages";
import { glossaryTerm } from "@/config/help/glossary";
import { HELP_GUIDES } from "@/config/help/guide-links";
import { setIntroCookie } from "@/lib/help-intro";
import { useContentLocale } from "@/lib/content-locale";
import { features } from "@/config/features";

export function PageHelpButton() {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("help");
  const locale = useContentLocale();
  const [open, setOpen] = useState(false);

  const help = helpForPath(pathname);
  if (!help) return null;

  // Reopen the one-minute introduction: mark it open and go to the dashboard,
  // where the card lives (src/components/help/first-run-card.tsx).
  const reopenIntro = () => {
    setIntroCookie("open");
    setOpen(false);
    if (pathname === "/privacy") router.refresh();
    else router.push("/privacy");
  };

  const terms = help.terms
    .map((id) => glossaryTerm(id))
    .filter((term): term is NonNullable<typeof term> => Boolean(term));

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)} title={t("open")}>
        <HelpCircle className="w-4 h-4" />
        <span className="sr-only">{t("open")}</span>
      </Button>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{help.title[locale]}</SheetTitle>
          <SheetDescription>{t("subtitle")}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-8 text-sm">
          <Section heading={t("purpose")}>
            <p className="text-muted-foreground leading-relaxed">{help.purpose[locale]}</p>
          </Section>

          <Section heading={t("firstStep")}>
            <p className="text-muted-foreground leading-relaxed">{help.firstStep[locale]}</p>
          </Section>

          {terms.length > 0 && (
            <Section heading={t("terms")}>
              <dl className="flex flex-col gap-3">
                {terms.map((term) => (
                  <div key={term.id}>
                    <dt className="font-medium text-foreground">{term.label[locale]}</dt>
                    <dd className="text-muted-foreground leading-relaxed">{term.meaning[locale]}</dd>
                  </div>
                ))}
              </dl>
            </Section>
          )}

          <Section heading={t("guides")}>
            <ul className="flex flex-col gap-1">
              {HELP_GUIDES.map((guide) => (
                <li key={guide.href}>
                  <Link
                    href={guide.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 -mx-2 text-foreground hover:bg-secondary"
                  >
                    <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    {t(guide.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </Section>

          {help.docs.length > 0 && (
            <Section heading={t("learnMore")}>
              <ul className="flex flex-col gap-1">
                {help.docs.map((doc) => (
                  <li key={doc.href}>
                    <Link
                      href={doc.href}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 -mx-2 text-primary hover:bg-secondary"
                    >
                      <BookOpen className="size-3.5 shrink-0" aria-hidden="true" />
                      {doc.label[locale]}
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {help.official.length > 0 && (
            <Section heading={t("officialText")}>
              <ul className="flex flex-col gap-1">
                {help.official.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-2 rounded-md px-2 py-1.5 -mx-2 text-primary hover:bg-secondary"
                    >
                      <ExternalLink className="size-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                      <span>{link.label[locale]}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* The one line left of the dashboard's two expert banners (owner's
              decision d7, 9 October 2026). */}
          {features.expertDirectoryEnabled && (
            <p className="text-muted-foreground leading-relaxed" data-testid="help-experts-line">
              {t("expertsLine")}{" "}
              <Link
                href="/privacy/experts"
                onClick={() => setOpen(false)}
                className="text-primary underline underline-offset-4"
              >
                {t("expertsLink")}
              </Link>
            </p>
          )}

          <button
            type="button"
            onClick={reopenIntro}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 -mx-2 text-left text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <Sparkles className="size-3.5 shrink-0" aria-hidden="true" />
            {t("firstRun.title")}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {heading}
      </h3>
      {children}
    </section>
  );
}
