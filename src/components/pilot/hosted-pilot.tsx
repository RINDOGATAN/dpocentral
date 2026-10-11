"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { createContext, useContext } from "react";
import { useLocale, useTranslations } from "next-intl";
import { PILOT_DOCS_PATH } from "@/lib/hosted";
import { useSelectedOrganizationOrNull } from "@/lib/organization-context";
import { trpc } from "@/lib/trpc";
import {
  pilotEndBarDate,
  pilotEndBarPricingUrl,
  pilotEndBarState,
  type PilotEndBarState,
} from "@/lib/pilot-end-bar";

// Whether this deployment is the hosted pilot. Resolved on the server
// (src/lib/hosted.ts) and handed down from the root layout.
const HostedPilotContext = createContext(false);

export function HostedPilotProvider({
  hosted,
  children,
}: {
  hosted: boolean;
  children: React.ReactNode;
}) {
  return <HostedPilotContext.Provider value={hosted}>{children}</HostedPilotContext.Provider>;
}

export function useHostedPilot(): boolean {
  return useContext(HostedPilotContext);
}

/** The pilot sentence, with its link to the limits in the docs (owner's wording, 10 Oct 2026). */
export function HostedPilotSentence({ className }: { className?: string }) {
  const t = useTranslations("pilot");
  return (
    <span className={className} data-testid="hosted-pilot-sentence">
      {t.rich("banner", {
        // The banner sits on every signed-in page, so the link opens in a new tab and
        // nobody loses a half-filled form by reading the limits.
        docs: (chunks) => (
          <a
            href={PILOT_DOCS_PATH}
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-medium"
          >
            {chunks}
          </a>
        ),
      })}
    </span>
  );
}

/** The bar as drawn, given its state; renders nothing when hidden. */
export function PilotEndBar({
  state,
  endsOn,
  pricingUrl,
}: {
  state: PilotEndBarState;
  /** The end date, already written out in the reader's language. */
  endsOn: string | null;
  pricingUrl: string;
}) {
  const t = useTranslations("pilot.endBar");
  if (state === "hidden") return null;
  if (state === "ending" && !endsOn) return null;
  return (
    <div
      role="status"
      data-testid="pilot-end-bar"
      data-state={state}
      className="w-full border-b border-border bg-muted/60 text-xs sm:text-sm text-foreground"
    >
      <p className="mx-auto max-w-7xl px-4 py-1.5 text-center break-words">
        {state === "ending" ? t("ending", { date: endsOn ?? "" }) : t("readOnly")}{" "}
        <a
          href={pricingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 font-medium hover:text-primary"
        >
          {t("pricing")}
        </a>
      </p>
    </div>
  );
}

/**
 * The end-of-pilot bar for the selected organisation (owner, 11 Oct 2026):
 * nothing for most of the pilot, the end date in the last days, the read-only
 * line once the window is over. Nothing on the paid plan or on the kit. Reads
 * the same status as the Settings card, so the two never disagree.
 */
export function HostedPilotEndBar() {
  const locale = useLocale();
  const organization = useSelectedOrganizationOrNull();
  const onPaidPlan = organization?.plan === "EU_CLOUD";
  const { data: status } = trpc.organization.getPilotStatus.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id && !onPaidPlan, staleTime: 60 * 1000 }
  );
  if (!organization || onPaidPlan) return null;
  const state = pilotEndBarState(status);
  const endsAt = status && status.hosted && !status.paid ? status.endsAt : null;
  return (
    <PilotEndBar
      state={state}
      endsOn={endsAt ? pilotEndBarDate(endsAt, locale) : null}
      pricingUrl={pilotEndBarPricingUrl(locale)}
    />
  );
}
