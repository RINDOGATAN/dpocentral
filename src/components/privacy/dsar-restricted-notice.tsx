"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import Link from "next/link";
import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/**
 * What a member who does not handle rights requests sees on a request page
 * meant for those who do (src/lib/dsar-access.ts): a plain explanation and a
 * way back, instead of a form the server would refuse.
 */
export function DsarRestrictedNotice() {
  const t = useTranslations("pages.dsar.restricted");
  return (
    <div className="text-center py-12 max-w-xl mx-auto">
      <Lock className="w-8 h-8 mx-auto mb-4 text-muted-foreground" />
      <p className="font-medium">{t("title")}</p>
      <p className="text-sm text-muted-foreground mt-2">{t("actionBody")}</p>
      <Link href="/privacy/dsar">
        <Button variant="outline" className="mt-4">{t("backToList")}</Button>
      </Link>
    </div>
  );
}
