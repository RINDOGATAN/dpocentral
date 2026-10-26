"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { createContext, useContext, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSelectedOrganizationOrNull } from "@/lib/organization-context";
import { trpc } from "@/lib/trpc";
import {
  pilotEndBarDate,
  pilotEndBarPrice,
  pilotEndBarPricingUrl,
  pilotEndBarState,
  type PilotEndBarState,
} from "@/lib/pilot-end-bar";
import { PILOT_DAYS } from "@/server/services/pilot/limits";
import { useChargeCurrency } from "@/components/region-provider";

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

/** The session key that remembers a dismissed trial bar until the tab is closed. */
export const PILOT_BAR_DISMISS_KEY = "pilot-bar-dismissed";

/** The trial bar's "closed for this session" flag, read without a render-time mismatch. */
const dismissListeners = new Set<() => void>();
function readDismissed(): boolean {
  try {
    return window.sessionStorage.getItem(PILOT_BAR_DISMISS_KEY) === "1";
  } catch {
    // No session storage (private mode, blocked): the bar simply stays.
    return false;
  }
}
function subscribeDismissed(listener: () => void): () => void {
  dismissListeners.add(listener);
  return () => {
    dismissListeners.delete(listener);
  };
}
function dismissForSession(): void {
  try {
    window.sessionStorage.setItem(PILOT_BAR_DISMISS_KEY, "1");
  } catch {
    // Not stored: the bar comes back on the next page.
  }
  dismissListeners.forEach((l) => l());
}

const UPGRADE_LINK =
  "ml-1 inline-block rounded-full border border-primary px-2.5 py-0.5 font-medium text-primary hover:bg-primary hover:text-primary-foreground";

/** The bar as drawn, given its state; renders nothing when hidden. */
export function PilotEndBar({
  state,
  endsOn,
  pricingUrl,
  transition = false,
  upgradeHref = null,
  upgradeMonthlyHref = null,
  suite = false,
}: {
  state: PilotEndBarState;
  /** The end date, already written out in the reader's language. */
  endsOn: string | null;
  pricingUrl: string;
  /** A pilot begun before the window was shortened: "Free until {date}". */
  transition?: boolean;
  /** The checkout route for "Move to the paid plan"; only for an owner or admin, with the switch on. */
  upgradeHref?: string | null;
  /**
   * The checkout route for paying monthly, when the monthly link is set. With
   * it, the bar offers two links (monthly, yearly) instead of the single
   * "Move to the paid plan"; `upgradeHref` is then the yearly one.
   */
  upgradeMonthlyHref?: string | null;
  /** The billing owner also has AI Sentinel: one sentence says one plan covers the suite. */
  suite?: boolean;
}) {
  const t = useTranslations("pilot.endBar");
  // The currency the customer will be charged, the same decision as the
  // "Move to the paid plan" link (inAppPlanOffer), whatever the language.
  const price = pilotEndBarPrice(useLocale(), useChargeCurrency());
  // The trial bar may be closed for the session; the ending and read-only bars stay.
  const dismissed = useSyncExternalStore(subscribeDismissed, readDismissed, () => false);
  if (state === "hidden") return null;
  if ((state === "trial" || state === "ending") && !endsOn) return null;
  if (state === "trial" && dismissed) return null;
  const text =
    state === "trial"
      ? t(transition ? "trialTransition" : "trial", { days: PILOT_DAYS, date: endsOn ?? "", price })
      : state === "ending"
        ? t("ending", { date: endsOn ?? "" })
        : t("readOnly");
  return (
    <div
      role="status"
      data-testid="pilot-end-bar"
      data-state={state}
      className="relative w-full border-b border-border bg-muted/60 text-xs sm:text-sm text-foreground"
    >
      <p className={`mx-auto max-w-7xl py-1.5 text-center break-words ${state === "trial" ? "px-10" : "px-4"}`}>
        {text}{" "}
        {suite && (
          <>
            <span data-testid="pilot-suite-line">{t("suite")}</span>{" "}
          </>
        )}
        <a
          href={pricingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 font-medium hover:text-primary"
        >
          {t("pricing")}
        </a>
        {upgradeHref && upgradeMonthlyHref && (
          <>
            {" "}
            <a href={upgradeMonthlyHref} data-testid="pilot-upgrade-monthly-link" className={UPGRADE_LINK}>
              {t("upgradeMonthly")}
            </a>{" "}
            <a href={upgradeHref} data-testid="pilot-upgrade-link" className={UPGRADE_LINK}>
              {t("upgradeYearly")}
            </a>
          </>
        )}
        {upgradeHref && !upgradeMonthlyHref && (
          <>
            {" "}
            <a href={upgradeHref} data-testid="pilot-upgrade-link" className={UPGRADE_LINK}>
              {t("upgrade")}
            </a>
          </>
        )}
      </p>
      {state === "trial" && (
        <button
          type="button"
          onClick={dismissForSession}
          aria-label={t("dismiss")}
          data-testid="pilot-end-bar-dismiss"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/**
 * The pilot bar for the selected organisation: the free
 * window and the Cloud Plan's price for the whole pilot, the stronger end
 * wording in the last days, the read-only line once the window is over.
 * Nothing on the paid plan or on the kit. Reads the same status as the
 * Settings card, so the two never disagree. With `upgrade` (the automatic
 * upgrade switched on), an owner or admin of the selected organisation also
 * sees "Move to the paid plan", which opens the plan's checkout for that
 * organisation (with `upgradeMonthly`, two links instead: pay monthly, pay
 * yearly); other members never see it.
 */
export function HostedPilotEndBar({
  upgrade = false,
  upgradeMonthly = false,
}: {
  upgrade?: boolean;
  upgradeMonthly?: boolean;
}) {
  const locale = useLocale();
  const organization = useSelectedOrganizationOrNull();
  const onPaidPlan = organization?.plan === "EU_CLOUD";
  const { data: status } = trpc.organization.getPilotStatus.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id && !onPaidPlan, staleTime: 60 * 1000 }
  );
  if (!organization || onPaidPlan) return null;
  const state = pilotEndBarState(status);
  const canUpgrade = upgrade && (organization.role === "OWNER" || organization.role === "ADMIN");
  const onPilot = status && status.hosted && !status.paid ? status : null;
  const endsAt = onPilot ? onPilot.endsAt : null;
  return (
    <PilotEndBar
      state={state}
      endsOn={endsAt ? pilotEndBarDate(endsAt, locale) : null}
      pricingUrl={pilotEndBarPricingUrl(locale)}
      transition={!!onPilot?.transition}
      upgradeHref={canUpgrade ? `/api/plan/checkout?org=${encodeURIComponent(organization.id)}` : null}
      upgradeMonthlyHref={
        canUpgrade && upgradeMonthly
          ? `/api/plan/checkout?org=${encodeURIComponent(organization.id)}&interval=month`
          : null
      }
      suite={!!(status && (status as { suite?: boolean }).suite)}
    />
  );
}
