"use client";

import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-6 py-4">
          <Link href="/" className="text-lg font-bold tracking-tight text-foreground">
            TODO.LAW<sup className="text-xs align-super">™</sup> <span className="text-muted-foreground">DEALROOM</span>
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
            href="https://todo.law/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            Privacy Policy
          </a>
          <span className="hidden sm:inline">&middot;</span>
          <a
            href="https://todo.law/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            Terms of Service
          </a>
          <span className="hidden sm:inline">&middot;</span>
          <Link
            href="/docs"
            className="hover:text-foreground transition-colors"
          >
            How It Works
          </Link>
        </div>
      </footer>
    </div>
  );
}
