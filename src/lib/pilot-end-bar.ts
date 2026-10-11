// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The pilot bar on signed-in pages (owner, 11 Oct 2026, second version). For
 * the WHOLE pilot, to every member (owners, admins and members alike), a
 * slim top bar gives the end date and the Cloud Plan's price in the reader's
 * currency (English $, Spanish €), with a link to the landing's pricing
 * block. In the last PILOT_END_BAR_DAYS days it switches to the stronger
 * "ending" wording; once the organisation is read-only it says so and that
 * the export stays open. Never shown off the hosted pilot, nor to an
 * organisation on the paid plan. A pilot begun before the window was
 * shortened (the transition) is told "Free until {date}", not "for 15 days".
 *
 * Pure: no React, no Prisma. The component in
 * src/components/pilot/hosted-pilot.tsx feeds it the Settings card's status.
 */

/** How many days before the end of the editing window the bar appears. */
export const PILOT_END_BAR_DAYS = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

export type PilotEndBarState = "hidden" | "trial" | "ending" | "readOnly";

/** What the bar needs from the pilot status (organization.getPilotStatus). */
export type PilotEndBarStatus =
  | { hosted: false }
  | { hosted: true; paid: true }
  | {
      hosted: true;
      paid: false;
      endsAt: Date | string | null;
      readOnly: boolean;
      /** Begun before the window was shortened to fifteen days (11 Oct 2026). */
      transition?: boolean;
    };

export function pilotEndBarState(
  status: PilotEndBarStatus | null | undefined,
  now: Date = new Date()
): PilotEndBarState {
  if (!status || !status.hosted || status.paid) return "hidden";
  if (status.readOnly) return "readOnly";
  // No end date yet: the clock has not started, so the end is far away.
  if (!status.endsAt) return "hidden";
  const remaining = new Date(status.endsAt).getTime() - now.getTime();
  if (remaining <= 0) return "readOnly";
  return remaining <= PILOT_END_BAR_DAYS * DAY_MS ? "ending" : "trial";
}

/**
 * Where the bar's link goes: the pricing block on this product's own landing
 * (owner, 11 Oct 2026), in the reader's language. Relative, so it stays on
 * the app's own domain. The `lang` parameter makes the landing show in that
 * language and lets a signed-in person see it (src/app/page.tsx sends a
 * signed-in visitor without it to the application).
 */
export const PILOT_END_BAR_PRICING_URL = {
  en: "/?lang=en#pricing",
  es: "/?lang=es#precios",
} as const;

export function pilotEndBarPricingUrl(locale: string | undefined): string {
  return locale?.toLowerCase().startsWith("es")
    ? PILOT_END_BAR_PRICING_URL.es
    : PILOT_END_BAR_PRICING_URL.en;
}

/** The end date as the bar writes it: "26 October 2026" / "26 de octubre de 2026". */
export function pilotEndBarDate(endsAt: Date | string, locale: string | undefined): string {
  const es = locale?.toLowerCase().startsWith("es");
  return new Date(endsAt).toLocaleDateString(es ? "es-ES" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
