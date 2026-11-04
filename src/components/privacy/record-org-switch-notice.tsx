"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * What a record page shows while src/lib/use-record-org-switch.ts asks which
 * organisation holds the record and, when it is another of the person's
 * organisations, switches to it: a spinner, and the name of the organisation
 * once known.
 */
export function RecordOrgSwitchNotice({ switchingTo }: { switchingTo: string | null }) {
  const t = useTranslations("common");
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12" role="status" aria-live="polite">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      {switchingTo && (
        <p className="text-sm text-muted-foreground">{t("recordBelongsTo", { client: switchingTo })}</p>
      )}
    </div>
  );
}
