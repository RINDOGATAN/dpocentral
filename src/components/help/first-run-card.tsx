"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The one-minute introduction, shown once on the first visit to the dashboard
 * and reachable afterwards from the "?" panel.
 *
 * It says, in plain words, the three steps of the path, the promise in one
 * sentence, links to the three short guides, and, for accounts that work for
 * clients, the way to the "All clients" view. It shows on the first visit
 * only: the visit that shows it marks it as seen, and "Got it" hides it at
 * once. Both are remembered per browser in a cookie (there is no per-user
 * preference store).
 *
 * The card is hidden until the cookie has been read on the client, so the
 * server render (which cannot see the cookie) never disagrees with the client.
 */

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { X, ArrowRight, Sparkles, Briefcase } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUserType } from "@/lib/use-user-type";
import { HELP_GUIDES } from "@/config/help/guide-links";
import {
  markIntroSeen,
  setIntroCookie,
  subscribeIntro,
  introSnapshot,
  introServerSnapshot,
} from "@/lib/help-intro";

const CLIENTS_HREF = "/privacy/clients";

export function FirstRunCard() {
  const t = useTranslations("help");
  const { isProfessional } = useUserType();
  // The server renders nothing (it cannot see the cookie); the client reveals
  // the card after hydration and hides it again the moment it is dismissed.
  const visible = useSyncExternalStore(subscribeIntro, introSnapshot, introServerSnapshot);
  useEffect(() => {
    if (visible) markIntroSeen();
  }, [visible]);

  if (!visible) return null;

  const dismiss = () => setIntroCookie("dismissed");

  return (
    <Card className="border-primary/20 bg-primary/5" data-testid="first-run-card">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Sparkles className="size-4 shrink-0 text-primary" aria-hidden="true" />
            {t("firstRun.title")}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            className="-mt-1 -mr-1 shrink-0"
            onClick={dismiss}
            title={t("firstRun.dismiss")}
          >
            <X className="size-4" />
            <span className="sr-only">{t("firstRun.dismiss")}</span>
          </Button>
        </div>

        <p className="mt-2 text-sm text-muted-foreground">{t("firstRun.intro")}</p>
        <ol className="mt-3 flex flex-col gap-2">
          {["step1", "step2", "step3"].map((key, i) => (
            <li key={key} className="flex items-start gap-2.5 text-sm">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary tabular-nums">
                {i + 1}
              </span>
              <span className="text-foreground">{t(`firstRun.${key}`)}</span>
            </li>
          ))}
        </ol>

        {isProfessional && (
          <p className="mt-3 flex flex-wrap items-center gap-1.5 text-sm">
            <Briefcase className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="text-muted-foreground">{t("firstRun.clientsLine")}</span>
            <Link href={CLIENTS_HREF} className="font-medium text-primary hover:underline">
              {t("firstRun.clientsLink")}
            </Link>
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="text-xs text-muted-foreground">{t("firstRun.guidesTitle")}:</span>
          {HELP_GUIDES.map((guide) => (
            <Link
              key={guide.href}
              href={guide.href}
              className="inline-flex items-center gap-1 text-primary hover:underline underline-offset-4"
            >
              <ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />
              {t(guide.key)}
            </Link>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={dismiss}>
            {t("firstRun.dismiss")}
          </Button>
          <span className="text-xs text-muted-foreground">{t("firstRun.reopen")}</span>
        </div>
      </CardContent>
    </Card>
  );
}
