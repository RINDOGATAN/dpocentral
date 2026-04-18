import type { Metadata, Viewport } from "next";
import { Jost, Archivo_Black } from "next/font/google";
import { getServerSession } from "next-auth";
import { getLocale, getMessages } from "next-intl/server";
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

export const metadata: Metadata = {
  title: {
    default: `${brand.nameUppercase} - ${brand.tagline}`,
    template: `%s | ${brand.nameUppercase}`,
  },
  description: `${brand.name} is ${brand.description.toLowerCase()} GDPR-ready data inventory, DSAR management, assessments, incident tracking, and vendor management in one platform.`,
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
    title: `${brand.nameUppercase} - ${brand.tagline}`,
    description: `${brand.name} is ${brand.description.toLowerCase()} GDPR-ready data inventory, DSAR management, assessments, incident tracking, and vendor management in one platform.`,
    url: brand.appUrl,
    locale: "en",
  },
  twitter: {
    card: "summary",
    title: `${brand.nameUppercase} - ${brand.tagline}`,
    description: `${brand.name} is ${brand.description.toLowerCase()} GDPR-ready data inventory, DSAR management, assessments, incident tracking, and vendor management in one platform.`,
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
      <head>
        <link rel="dns-prefetch" href="https://t.sealmetrics.com" />
        <script async src="https://t.sealmetrics.com/t.js?id=todolaw" />
      </head>
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
