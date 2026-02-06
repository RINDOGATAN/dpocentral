import type { Metadata } from "next";
import { Inter, Archivo_Black, Jost } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";
import { brand } from "@/config/brand";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const archivoBlack = Archivo_Black({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});

const jost = Jost({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: brand.name,
  description: `${brand.name} is ${brand.description.toLowerCase()}`,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${archivoBlack.variable} ${jost.variable} font-sans antialiased`}>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
