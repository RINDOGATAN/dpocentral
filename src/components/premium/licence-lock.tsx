"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The small lock beside an option that needs a licence here (owner's
 * decision, 9 October 2026): on the DPIA option in the assessments page and
 * in the type picker, where the DPIA template is not licensed. The menu's
 * Assessments step carries no lock any more. Same rule as before
 * (isAssessmentTypeLocked: never on the hosted pilot). An accessible label,
 * "Requires a licence", and no price.
 */

import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export function LicenceLock({ className, testId }: { className?: string; testId?: string }) {
  const t = useTranslations("guided");
  return (
    <span
      className={cn("inline-flex items-center text-muted-foreground", className)}
      title={t("requiresLicence")}
      data-testid={testId}
    >
      <Lock className="size-3.5" aria-hidden="true" />
      <span className="sr-only">{t("requiresLicence")}</span>
    </span>
  );
}
