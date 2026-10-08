// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The page for an address that does not exist, in the reader's language and
 * the app's own style (instead of the framework's English default), with a
 * way back to the home page and to the dashboard.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { brand } from "@/config/brand";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata.pageTitles");
  return { title: t("notFound") };
}

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center p-4 sm:p-6">
      <p className="text-lg mb-6 text-white uppercase tracking-wide" style={{ fontFamily: "var(--font-jost), 'Jost', sans-serif", fontWeight: 600 }}>
        {brand.nameUppercase}
      </p>
      <Card className="max-w-lg w-full">
        <CardContent className="p-6 sm:p-8 text-center">
          <SearchX className="w-12 h-12 mx-auto text-muted-foreground mb-4" aria-hidden />
          <p className="text-xs font-mono text-muted-foreground mb-2">{t("code")}</p>
          <h1 className="text-xl font-semibold mb-2">{t("title")}</h1>
          <p className="text-muted-foreground mb-6">{t("body")}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/">{t("home")}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/privacy">{t("dashboard")}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
