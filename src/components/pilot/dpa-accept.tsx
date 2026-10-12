"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { PILOT_DPA, pilotDpaHref } from "@/config/pilot-dpa";

/**
 * The acceptance checkbox for the data processing agreement
 * (src/config/pilot-dpa.ts). The same box on every screen that asks for it:
 * the first-run screens that open an organisation, and the one-time step for
 * an organisation opened before acceptance was asked.
 */
export function DpaAcceptCheckbox({
  id,
  checked,
  onCheckedChange,
}: {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const t = useTranslations("organization");
  const locale = useLocale();
  return (
    <div className="flex items-start gap-2" data-testid="pilot-dpa-accept">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        className="mt-0.5"
      />
      <Label htmlFor={id} className="text-sm font-normal leading-snug">
        {t.rich("dpaAccept", {
          version: PILOT_DPA.version,
          link: (chunks) => (
            <a
              href={pilotDpaHref(locale)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-primary"
            >
              {chunks}
            </a>
          ),
        })}
      </Label>
    </div>
  );
}

/**
 * The one-time step for an organisation with no acceptance of the current
 * agreement on record (organisations opened before it was asked at opening).
 * Shown to an owner or administrator, who accepts on behalf of the
 * organisation; `onAccepted` lets the shell move on.
 */
export function DpaAcceptanceStep({
  organizationId,
  organizationName,
  onAccepted,
}: {
  organizationId: string;
  organizationName: string;
  onAccepted: () => void;
}) {
  const t = useTranslations("organization");
  const [accept, setAccept] = useState(false);
  const acceptDpa = trpc.organization.acceptDpa.useMutation({ onSuccess: onAccepted });

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("dpaStepTitle")}</CardTitle>
          <CardDescription>{t("dpaStepBody", { name: organizationName })}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (accept) acceptDpa.mutate({ organizationId, accept: true });
            }}
          >
            <DpaAcceptCheckbox id="reaccept-dpa" checked={accept} onCheckedChange={setAccept} />
            {acceptDpa.error && (
              <p className="text-sm text-destructive" role="alert">
                {acceptDpa.error.message}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={!accept || acceptDpa.isPending}>
              {acceptDpa.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {t("dpaStepContinue")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * The note a member who is not an owner or administrator sees while the
 * organisation has not accepted the current agreement. It blocks nothing.
 */
export function DpaPendingNote() {
  const t = useTranslations("organization");
  const locale = useLocale();
  return (
    <div
      className="border-b border-border bg-muted px-4 py-2 text-center text-sm text-muted-foreground"
      data-testid="pilot-dpa-pending"
      role="status"
    >
      {t.rich("dpaPendingNote", {
        version: PILOT_DPA.version,
        link: (chunks) => (
          <a href={pilotDpaHref(locale)} target="_blank" rel="noopener noreferrer" className="underline">
            {chunks}
          </a>
        ),
      })}
    </div>
  );
}
