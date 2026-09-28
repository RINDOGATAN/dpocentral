// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The one-minute introduction's dismissal, remembered per browser in a cookie.
 * A leaf module so the first-run card (which reads and sets it) and the help
 * panel (which reopens it) share one source of truth without a circular import.
 *
 * The values:
 * - unset       → show on the first dashboard visit
 * - "open"      → the reader asked to see it again
 * - "dismissed" → hidden
 *
 * The parsing and the show/hide decision are pure so they can be tested without
 * a DOM (help-intro.test.ts); only readIntroCookie/setIntroCookie touch
 * document.cookie.
 */

export const INTRO_COOKIE = "dpc_intro";
const ONE_YEAR = 365 * 24 * 60 * 60;

/** The intro cookie's value out of a `document.cookie` string, or null. */
export function parseIntroCookie(cookieString: string | null | undefined): string | null {
  if (!cookieString) return null;
  const match = cookieString.match(/(?:^|;\s*)dpc_intro=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/** Show the introduction unless it has been dismissed. */
export function shouldShowIntro(value: string | null | undefined): boolean {
  return value !== "dismissed";
}

export function readIntroCookie(): string | null {
  if (typeof document === "undefined") return null;
  return parseIntroCookie(document.cookie);
}

// A tiny store so a card can subscribe to the cookie with useSyncExternalStore:
// SSR renders it hidden, the client reveals it after hydration without a
// setState-in-effect, and dismissing or reopening notifies every listener.
const listeners = new Set<() => void>();

export function subscribeIntro(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/** Client snapshot: whether the introduction should show right now. */
export function introSnapshot(): boolean {
  return shouldShowIntro(readIntroCookie());
}

/** Server snapshot: the cookie is unknown, so render nothing until hydration. */
export function introServerSnapshot(): boolean {
  return false;
}

export function setIntroCookie(value: "dismissed" | "open") {
  document.cookie = `${INTRO_COOKIE}=${value}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax`;
  listeners.forEach((listener) => listener());
}
