"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The page a person sees when a route fails to render: a plain sentence, a
 * way back, a reference and the way to report it. Never the error's own
 * text or stack. The reference is Next's digest when the failure happened
 * on the server (the server log carries the same digest), otherwise a fresh
 * id; either way it is logged with the error. Used by every route group's
 * error.tsx; the root's global-error.tsx is self-contained.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { isTransientDbMessage } from "@/lib/format-error";
import { newErrorReference } from "@/lib/error-reference";

export const SUPPORT_DOCS_PATH = "/docs#support";

export type ErrorPageBack = "dashboard" | "home" | "signIn" | null;

const BACK: Record<Exclude<ErrorPageBack, null>, { href: string; key: "backDashboard" | "backHome" | "backSignIn" }> = {
  dashboard: { href: "/privacy", key: "backDashboard" },
  home: { href: "/", key: "backHome" },
  signIn: { href: "/sign-in", key: "backSignIn" },
};

export function ErrorPage({
  error,
  reset,
  back,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  back: ErrorPageBack;
}) {
  const t = useTranslations("errorPage");
  const [reference] = useState(() => error.digest || newErrorReference());

  useEffect(() => {
    console.error(`[error ref ${reference}]`, error);
  }, [error, reference]);

  const transient = isTransientDbMessage(error.message ?? "");
  const way = back ? BACK[back] : null;

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4 sm:p-6">
      <Card className="max-w-lg w-full border-destructive/30">
        <CardContent className="p-6 sm:p-8 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto text-destructive mb-4" aria-hidden />
          <h1 className="text-xl font-semibold mb-2">{t("title")}</h1>
          <p className="text-muted-foreground mb-6">{transient ? t("transient") : t("body")}</p>
          <div className="flex flex-wrap justify-center gap-3 mb-6">
            <Button onClick={reset} variant="outline">
              <RotateCcw className="w-4 h-4 mr-2" aria-hidden />
              {t("tryAgain")}
            </Button>
            {way && (
              <Button asChild>
                <Link href={way.href}>{t(way.key)}</Link>
              </Button>
            )}
          </div>
          <p className="text-sm font-mono break-all" data-testid="error-reference">
            {t("reference", { reference })}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{t("referenceHelp")}</p>
          <p className="text-xs mt-3">
            <Link href={SUPPORT_DOCS_PATH} className="underline">
              {t("help")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
