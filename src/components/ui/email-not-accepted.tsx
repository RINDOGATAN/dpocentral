"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useTranslations } from "next-intl";
import { BLOCKED_EMAIL_MESSAGE_KEY } from "@/lib/email-policy";

/** True when a tRPC error is the e-mail policy refusal (src/lib/email-policy.ts). */
export function isEmailNotAcceptedError(error: unknown): boolean {
  const data = (error as { data?: { messageKey?: unknown } } | null | undefined)?.data;
  return data?.messageKey === BLOCKED_EMAIL_MESSAGE_KEY;
}

/** The one approved sentence, placed under an e-mail field. No error code. */
export function EmailNotAcceptedNote({ show }: { show: boolean }) {
  const t = useTranslations("auth");
  if (!show) return null;
  return (
    <p data-testid="email-not-accepted" className="text-xs text-muted-foreground">
      {t("emailNotAccepted")}
    </p>
  );
}
