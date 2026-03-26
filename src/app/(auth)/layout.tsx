"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { brand } from "@/config/brand";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tFooter = useTranslations("footer");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo-negative.svg" alt="TODO.LAW" style={{ height: "28px", width: "auto" }} />
            <span className="text-muted-foreground" style={{ fontFamily: "var(--font-jost), 'Jost', sans-serif", fontWeight: 600 }}>{brand.nameUppercase}</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6">
        <div className="container mx-auto px-6 flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-muted-foreground">
          <a
            href={brand.privacyPolicyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            {tFooter("privacyPolicy")}
          </a>
          <span className="hidden sm:inline">&middot;</span>
          <a
            href={brand.termsOfUseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            {tFooter("termsOfService")}
          </a>
          <span className="hidden sm:inline">&middot;</span>
          <Link
            href="/docs"
            className="hover:text-foreground transition-colors"
          >
            {tFooter("howItWorks")}
          </Link>
        </div>
      </footer>
    </div>
  );
}
