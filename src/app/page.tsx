// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import LandingPage from "@/landing/LandingPage";
import { brand } from "@/config/brand";
import { LANDING_SEO, landingLocale } from "@/config/seo";
import { localeFromCookieHeader } from "@/i18n/locale-cookie";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

/**
 * The landing's title and description in the language it shows: `?lang=`
 * first, then the `locale` cookie, then Accept-Language (src/config/seo.ts);
 * the page body is rendered in the same language on the server. The layout's own metadata follows
 * the request locale, which ignores `?lang=` and may come from
 * Accept-Language while the landing shows English, so the landing sets both
 * languages explicitly (absolute, outside the layout's "%s | ..." template).
 */
async function pageLocale(searchParams: SearchParams) {
  const { lang } = await searchParams;
  const h = await headers();
  return landingLocale(lang, localeFromCookieHeader(h.get("cookie")), h.get("accept-language"));
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const locale = await pageLocale(searchParams);
  const { title, description } = LANDING_SEO[locale];
  return {
    title: { absolute: title },
    description,
    openGraph: {
      type: "website",
      siteName: brand.nameUppercase,
      title,
      description,
      url: brand.appUrl,
      locale,
    },
    twitter: { card: "summary", title, description },
  };
}

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getServerSession(authOptions);
  const { lang } = await searchParams;

  // A signed-in visitor goes to the application, unless the address asks for
  // the landing in a language (`?lang=`): the in-app pilot bar's "See
  // pricing" link opens the landing's pricing block that way.
  if (session && !lang) {
    redirect("/privacy");
  }

  // Self-hosted / local-auth builds have no marketing landing. Send logged-out
  // visitors straight to the local sign-in.
  if (process.env.NEXT_PUBLIC_LOCAL_AUTH_ENABLED === "true") {
    redirect("/sign-in");
  }

  // Rendered in its language on the server, so the first paint is never in the other one.
  return <LandingPage initialLocale={await pageLocale(searchParams)} />;
}
