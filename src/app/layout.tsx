// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import type { Metadata, Viewport } from "next";
import { Jost, Archivo_Black } from "next/font/google";
import { getServerSession } from "next-auth";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { authOptions } from "@/lib/auth";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";
import { BrandTheme } from "@/components/brand-theme";
import { brand } from "@/config/brand";
import { NOINDEX, OG_LOCALE, siteVerification } from "@/config/seo";
import { clientMessages } from "@/i18n/client-messages";
import { listOrganizationsForLayout } from "@/server/services/organization/list";

const jost = Jost({
  subsets: ["latin"],
  variable: "--font-jost",
  weight: ["400", "500", "600", "700"],
});

const archivoBlack = Archivo_Black({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// Metadata is generated per request so the title, description and OpenGraph
// locale follow the active locale. As a static export it always emitted the
// English tagline, so Spanish pages shipped English titles to browser tabs,
// bookmarks, search results and link previews.
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("metadata");
  const title = `${brand.nameUppercase} - ${t("tagline")}`;
  const description = t("description");

  return {
  title: {
    default: title,
    template: `%s | ${brand.nameUppercase}`,
  },
  description,
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.png", type: "image/png", sizes: "32x32" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/site.webmanifest",
  metadataBase: new URL(brand.appUrl),
  // No canonical here: a layout's canonical is inherited by every page that
  // does not set its own, which named the home page as the canonical of
  // /licenses and the other secondary pages. Each indexable page sets its own
  // (src/config/seo.ts); screens that are not public content are noindex.
  openGraph: {
    type: "website",
    siteName: brand.nameUppercase,
    title,
    description,
    locale: OG_LOCALE[locale === "es" ? "es" : "en"],
  },
  // Search Console ownership tag, rendered only when the variable is set.
  verification: siteVerification(),
  // A self-hosted workspace: kept out of search results by default.
  robots: NOINDEX,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);
  const locale = await getLocale();
  // Only the namespaces client components read (src/i18n/client-messages.ts).
  const messages = clientMessages(await getMessages());
  // The signed-in person's organisations, read here so the first render of
  // the shell does not wait on a round trip for them (null when signed out
  // or when the read fails: the browser then asks as before).
  const organizations = session?.user?.id ? await listOrganizationsForLayout(session.user.id) : null;

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${jost.variable} ${archivoBlack.variable} font-sans antialiased`}>
        <BrandTheme />
        <NextIntlClientProvider messages={messages}>
          <Providers session={session} organizations={organizations}>
            {children}
            <Toaster />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
