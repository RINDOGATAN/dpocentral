"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The one-minute introduction, shown once on the first visit to the dashboard
 * and reachable afterwards from the "?" panel.
 *
 * It says, in plain words, the three steps of the path, the promise in one
 * sentence, links to the three short guides, and, for accounts that work for
 * clients, the way to the "All clients" view. Dismissal is remembered per
 * browser in a cookie, so it does not return on the next visit.
 *
 * The card is hidden until the cookie has been read on the client, so the
 * server render (which cannot see the cookie) never disagrees with the client.
 */

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { X, ArrowRight, Sparkles, Briefcase } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUserType } from "@/lib/use-user-type";
import { HELP_GUIDES } from "@/config/help/guide-links";
import {
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

  if (!visible) return null;

  const dismiss = () => setIntroCookie("dismissed");

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-5 sm:p-6">
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

        <p className="mt-4 rounded-lg border border-border bg-background/60 p-3 text-sm text-muted-foreground">
          {t("firstRun.promise")}
        </p>

        {isProfessional && (
          <p className="mt-3 flex flex-wrap items-center gap-1.5 text-sm">
            <Briefcase className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="text-muted-foreground">{t("firstRun.clientsLine")}</span>
            <Link href={CLIENTS_HREF} className="font-medium text-primary hover:underline">
              {t("firstRun.clientsLink")}
            </Link>
          </p>
        )}

        <div className="mt-4">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("firstRun.guidesTitle")}
          </p>
          <ul className="flex flex-col gap-1">
            {HELP_GUIDES.map((guide) => (
              <li key={guide.href}>
                <Link
                  href={guide.href}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 -mx-2 text-foreground hover:bg-secondary"
                >
                  <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  {t(guide.key)}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Button size="sm" onClick={dismiss}>
            {t("firstRun.dismiss")}
          </Button>
          <span className="text-xs text-muted-foreground">{t("firstRun.reopen")}</span>
        </div>
      </CardContent>
    </Card>
  );
}
