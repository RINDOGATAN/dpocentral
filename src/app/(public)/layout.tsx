import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { brand } from "@/config/brand";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tFooter = await getTranslations("footer");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="text-lg font-bold tracking-tight text-foreground"
          >
            {brand.companyTrademark} <span className="text-muted-foreground">{brand.nameUppercase}</span>
          </Link>

          <div className="flex items-center gap-6">
            <Link
              href="/docs"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {tFooter("docs")}
            </Link>
            <Link
              href="/sign-in"
              className="btn-brutal text-sm px-4 py-2"
            >
              {tFooter("signIn")}
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t border-border py-6">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-muted-foreground">
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
            href="/security"
            className="hover:text-foreground transition-colors"
          >
            {tFooter("dataSecurity")}
          </Link>
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
