"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The sign-out confirmation, in the app's own layout.
 *
 * The account menu signs out directly (src/lib/sign-out.ts) and never comes
 * here. This page answers the other way in: NextAuth's GET /api/auth/signout,
 * which would otherwise show the library's unstyled default page. It is
 * registered as `pages.signOut` in src/lib/auth.ts, and it signs out through
 * the same single path as the menu.
 */

import { useState } from "react";
import { LogOut } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { signOutOfSuite } from "@/lib/sign-out";

export default function SignOutPage() {
  const t = useTranslations("auth.signOutPage");
  const [leaving, setLeaving] = useState(false);

  return (
    <div className="w-full max-w-md">
      <div className="card-brutal text-center">
        <div className="w-16 h-16 bg-primary/20 flex items-center justify-center mx-auto mb-6">
          <LogOut className="w-8 h-8 text-primary" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold mb-2">{t("title")}</h1>
        <p className="text-muted-foreground mb-6">{t("body")}</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            type="button"
            disabled={leaving}
            onClick={() => {
              setLeaving(true);
              void signOutOfSuite();
            }}
          >
            {leaving ? t("leaving") : t("confirm")}
          </Button>
          <Button asChild variant="outline">
            <Link href="/privacy">{t("cancel")}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
