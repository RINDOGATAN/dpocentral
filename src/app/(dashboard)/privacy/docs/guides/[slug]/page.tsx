// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The three short guides, rendered from typed content (src/config/help/guides).
 * One dynamic route serves all three; an unknown slug is a 404. The page is a
 * thin renderer, so the words live with the rest of the help feature and a
 * sister app can reuse the same shape. It sits inside the dashboard docs shell
 * (../../layout.tsx), so the User Guide sidebar stays alongside it.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRight, ExternalLink } from "lucide-react";
import { GUIDES, guideBySlug } from "@/config/help/guides";
import type { ContentLocale } from "@/config/help/localized";

export function generateStaticParams() {
  return GUIDES.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = guideBySlug(slug);
  if (!guide) return {};
  const locale = ((await getLocale()) === "es" ? "es" : "en") as ContentLocale;
  return {
    // The root layout's title template adds the brand.
    title: guide.title[locale],
    description: guide.lead[locale],
  };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = guideBySlug(slug);
  if (!guide) notFound();

  const locale = ((await getLocale()) === "es" ? "es" : "en") as ContentLocale;
  const t = await getTranslations("help");

  return (
    <div className="space-y-12">
      <section>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-4">
          {guide.title[locale]}
        </h1>
        <p className="text-lg text-muted-foreground leading-relaxed max-w-3xl">
          {guide.lead[locale]}
        </p>
      </section>

      {guide.sections.map((section, i) => (
        <section key={i}>
          <h2 className="text-2xl font-semibold tracking-tight mb-4">{section.heading[locale]}</h2>
          {section.intro && (
            <p className="text-muted-foreground leading-relaxed max-w-3xl">{section.intro[locale]}</p>
          )}
          {section.items && section.items.length > 0 && (
            <div className="grid gap-4 mt-4">
              {section.items.map((item, j) => (
                <div key={j} className="rounded-xl border border-border bg-card p-5">
                  <h3 className="font-semibold mb-1">{item.term[locale]}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.body[locale]}</p>
                  {item.example && (
                    <p className="text-sm text-muted-foreground/90 mt-2">
                      <span className="font-medium text-foreground">{t("exampleLead")}</span>{" "}
                      {item.example[locale]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      ))}

      <section>
        <h2 className="text-2xl font-semibold tracking-tight mb-4">{t("officialText")}</h2>
        <ul className="flex flex-col gap-2">
          {guide.official.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-start gap-2 text-primary hover:underline"
              >
                <ExternalLink className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{link.label[locale]}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      {guide.next && (
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-6">
          <Link
            href={guide.next.href}
            className="inline-flex items-center gap-2 font-medium text-primary hover:underline"
          >
            {guide.next.label[locale]}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </section>
      )}
    </div>
  );
}
