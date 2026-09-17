"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { useHostedPilot } from "@/components/pilot/hosted-pilot";

// Marks a premium module in the docs. No price here: the hosted pilot
// includes every module, and the kit price is stated on the premium page.
// Not shown on the hosted pilot, where nothing is premium.
export function PremiumBadge() {
  const t = useTranslations("docs.premium");
  if (useHostedPilot()) return null;
  return (
    <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0">
      {t("badgeLabel")}
    </Badge>
  );
}
