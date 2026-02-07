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
            todo.law<span className="text-xs align-super text-muted-foreground ml-0.5">TM</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6">
        <div className="container mx-auto px-6 text-center text-sm text-muted-foreground space-y-2">
          <div className="flex justify-center gap-4">
            <a
              href="https://todo.law/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Privacy Policy
            </a>
            <a
              href="https://todo.law/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Terms of Service
            </a>
            <Link
              href="/privacy/docs"
              className="hover:text-foreground transition-colors"
            >
              User Guide
            </Link>
          </div>
          <p>DPO Central is a <a href="https://todo.law" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">todo.law</a> service.</p>
        </div>
      </footer>
    </div>
  );
}
