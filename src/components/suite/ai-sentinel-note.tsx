// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

"use client";

/**
 * On an AI system that came from AI Sentinel through the suite link
 * (src/server/services/suite/link-ais.ts): that it waits for confirmation,
 * and a note when the original is no longer in AI Sentinel. Texts are this
 * application's own, in the reader's language.
 */
import { useLocale, useTranslations } from "next-intl";

export function AiSentinelNote({ metadata }: { metadata: unknown }) {
  const t = useTranslations("suite");
  const locale = useLocale();
  const meta = metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : {};
  if (meta.importedFrom !== "aisentinel") return null;
  const note = meta.suiteNote && typeof meta.suiteNote === "object" ? (meta.suiteNote as { kind?: string; at?: string }) : null;
  const at = note?.at ? new Date(note.at) : null;
  return (
    <div className="text-sm space-y-1" data-testid="ais-note">
      <p className="text-muted-foreground">{t("fromAisBadge")}</p>
      {note?.kind === "removedInAiSentinel" && at && (
        <p>
          {t("noteRemovedInAis", {
            date: at.toLocaleDateString(locale === "es" ? "es-ES" : "en-GB", { day: "numeric", month: "long", year: "numeric" }),
          })}
        </p>
      )}
    </div>
  );
}
