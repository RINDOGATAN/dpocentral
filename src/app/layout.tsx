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
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: brand.nameUppercase,
    title,
    description,
    url: brand.appUrl,
    locale,
  },
  twitter: {
    card: "summary",
    title,
    description,
  },
  robots: {
    index: true,
    follow: true,
  },
  keywords: [
    "GDPR compliance",
    "privacy management",
    "DPO tool",
    "data protection officer",
    "DSAR management",
    "data inventory",
    "ROPA",
    "DPIA",
    "privacy impact assessment",
    "incident management",
    "vendor management",
    "data protection",
    "privacy software",
    "open source privacy",
  ],
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${jost.variable} ${archivoBlack.variable} font-sans antialiased`}>
        <BrandTheme />
        <NextIntlClientProvider messages={messages}>
          <Providers session={session}>
            {children}
            <Toaster />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
