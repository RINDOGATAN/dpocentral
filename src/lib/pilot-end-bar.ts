// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The end-of-pilot bar (owner, 11 Oct 2026). It replaced the warning banner
 * that sat on every signed-in page: for most of the pilot nothing is shown;
 * in the last PILOT_END_BAR_DAYS days a slim, neutral bar gives the end date
 * and a link to the prices; once the organisation is read-only the bar says
 * so and that the export stays open. Never shown off the hosted pilot, nor to
 * an organisation on the paid plan.
 *
 * Pure: no React, no Prisma. The component in
 * src/components/pilot/hosted-pilot.tsx feeds it the Settings card's status.
 */

/** How many days before the end of the editing window the bar appears. */
export const PILOT_END_BAR_DAYS = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

export type PilotEndBarState = "hidden" | "ending" | "readOnly";

/** What the bar needs from the pilot status (organization.getPilotStatus). */
export type PilotEndBarStatus =
  | { hosted: false }
  | { hosted: true; paid: true }
  | { hosted: true; paid: false; endsAt: Date | string | null; readOnly: boolean };

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
  return remaining <= PILOT_END_BAR_DAYS * DAY_MS ? "ending" : "hidden";
}

/**
 * Where the bar's link goes: the storefront's prices page in the reader's
 * language, the same page as every other in-app prices link (owner, 11 Oct
 * 2026, consistency review DPC-3: one Spanish prices page for the whole app).
 */
export const PILOT_END_BAR_PRICING_URL = {
  en: "https://www.todo.law/pricing",
  es: "https://www.todo.law/es/precios",
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
