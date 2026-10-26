// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The data processing agreement a hosted pilot organisation accepts when it is
 * opened.
 *
 * From version 1.1 the storefront's EU Cloud Plan agreement also covers the free
 * pilot, and it is accepted when the pilot account is opened. The first-run
 * screen asks for it with a checkbox; the server refuses to open a hosted
 * organisation without it and records the acceptance as an audit-trail entry
 * on the new organisation (action PILOT_DPA_ACTION, with the version and the
 * language shown; the entry's own date and user say when and who). No column
 * is added for it. The kit (self-hosted) never asks: there we are not the
 * processor.
 *
 * Change `version` only when a new agreement is published; organisations
 * opened earlier keep the entry for the version they accepted. An acceptance
 * of any version from `minimumAccepted` on stays valid, so publishing a new
 * version does not ask existing organisations to accept again; only new
 * acceptances record the current version. Raise `minimumAccepted` only when
 * a change needs everyone to accept again.
 *
 * Pure leaf module: no Prisma, no Next, no React.
 */

export type PilotDpaLocale = "en" | "es";

export const PILOT_DPA = {
  version: "1.8",
  minimumAccepted: "1.1",
  href: {
    en: "https://www.todo.law/legal/eu-cloud-plan-dpa",
    es: "https://www.todo.law/es/legal/encargo-tratamiento-plan-nube-ue",
  },
} as const satisfies { version: string; minimumAccepted: string; href: Record<PilotDpaLocale, string> };

/** Compares dotted version strings numerically ("1.10" is after "1.9"). */
function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** Whether a recorded acceptance still counts: any version from `minimumAccepted` on. */
export function isAcceptedDpaVersion(version: unknown): boolean {
  if (typeof version !== "string" || !/^\d+(\.\d+)*$/.test(version)) return false;
  return compareVersions(version, PILOT_DPA.minimumAccepted) >= 0;
}

/** The audit-trail action that records the acceptance. */
export const PILOT_DPA_ACTION = "DPA_ACCEPTED";

/** The agreement's link in the reader's language (Spanish for "es", English otherwise). */
export function pilotDpaHref(locale: string | undefined): string {
  return locale?.toLowerCase().startsWith("es") ? PILOT_DPA.href.es : PILOT_DPA.href.en;
}

/** The message when a hosted organisation is opened without accepting it. */
export const PILOT_DPA_REQUIRED: Record<PilotDpaLocale, string> = {
  en: "To open an organization on the hosted pilot, accept the data processing agreement.",
  es: "Para abrir una organización en el piloto alojado, acepta el contrato de encargo del tratamiento.",
};
