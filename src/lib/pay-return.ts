// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Payment links open in a new tab, so the application stays open in this
 * one. When the person comes back to this tab after clicking one, the plan
 * state is read again so the page reflects the payment without a manual
 * reload.
 *
 * Narrow on purpose: the global refetch-on-window-focus stays off
 * (src/components/providers.tsx). Only a component that shows a payment link
 * calls usePayReturnRefetch for its own plan query, and the refetches run
 * only while a link of that kind was clicked in this tab:
 *   - armPayReturn(kind) on the link's click;
 *   - each return to the tab (focus, or the page becoming visible) refetches,
 *     at most once per RETURN_THROTTLE_MS;
 *   - after a return, while the tab stays visible, a refetch every
 *     POLL_INTERVAL_MS for POLL_WINDOW_MS (the payment notice may arrive a
 *     few seconds after Stripe's page says it is done);
 *   - disarmed once the plan state shows the purchase (`done`), or
 *     ARM_WINDOW_MS after the click.
 *
 * The flag lives in this tab's memory only: a reload reads everything again
 * anyway, and another tab never refetches because of this one.
 */

import { useEffect, useRef, useSyncExternalStore } from "react";

export type PayKind = "plan" | "dsarVolume";

export const RETURN_THROTTLE_MS = 2_000;
export const POLL_INTERVAL_MS = 10_000;
export const POLL_WINDOW_MS = 3 * 60_000;
export const ARM_WINDOW_MS = 30 * 60_000;

/** When a link of each kind was clicked in this tab (ms since epoch). */
const armedAt = new Map<PayKind, number>();
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

/** Marks that a payment link of this kind was clicked in this tab. */
export function armPayReturn(kind: PayKind, now: number = Date.now()): void {
  armedAt.set(kind, now);
  emit();
}

export function disarmPayReturn(kind: PayKind): void {
  if (armedAt.delete(kind)) emit();
}

/** Whether a payment link of this kind was clicked in this tab within ARM_WINDOW_MS. */
export function isPayReturnArmed(kind: PayKind, now: number = Date.now()): boolean {
  const at = armedAt.get(kind);
  return at !== undefined && now - at < ARM_WINDOW_MS;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** For tests: forget every click. */
export function resetPayReturn(): void {
  armedAt.clear();
  emit();
}

/** The props a payment link carries: a new tab, and the click arms the refetch. */
export function payLinkProps(kind: PayKind): {
  target: "_blank";
  rel: "noopener noreferrer";
  onClick: () => void;
} {
  return { target: "_blank", rel: "noopener noreferrer", onClick: () => armPayReturn(kind) };
}

/** What the watcher needs from the browser; the real window and document by default. */
export interface PayReturnHost {
  win: Pick<Window, "addEventListener" | "removeEventListener" | "setInterval" | "clearInterval">;
  doc: Pick<Document, "addEventListener" | "removeEventListener" | "visibilityState">;
  now: () => number;
}

/**
 * While a link of `kind` is armed: refetch on each return to the tab
 * (throttled), then every POLL_INTERVAL_MS for POLL_WINDOW_MS while the tab
 * stays visible. Disarms itself once ARM_WINDOW_MS has passed since the
 * click. Returns the cleanup.
 */
export function watchPayReturn(
  kind: PayKind,
  refetch: () => unknown,
  host: PayReturnHost = { win: window, doc: document, now: Date.now }
): () => void {
  const { win, doc, now: clock } = host;
  let lastReturn = 0;
  let lastRefetch = 0;
  const visible = () => doc.visibilityState === "visible";
  const run = (now: number) => {
    lastRefetch = now;
    void Promise.resolve()
      .then(() => refetch())
      .catch(() => {
        // A failed read is retried on the next tick or return.
      });
  };
  const onReturn = () => {
    const now = clock();
    if (!isPayReturnArmed(kind, now)) {
      disarmPayReturn(kind);
      return;
    }
    if (!visible() || now - lastRefetch < RETURN_THROTTLE_MS) return;
    lastReturn = now;
    run(now);
  };
  const onVisibility = () => {
    if (visible()) onReturn();
  };
  const timer = win.setInterval(() => {
    const now = clock();
    if (!isPayReturnArmed(kind, now)) {
      disarmPayReturn(kind);
      return;
    }
    if (lastReturn && visible() && now - lastReturn < POLL_WINDOW_MS) run(now);
  }, POLL_INTERVAL_MS);
  win.addEventListener("focus", onReturn);
  doc.addEventListener("visibilitychange", onVisibility);
  return () => {
    win.clearInterval(timer);
    win.removeEventListener("focus", onReturn);
    doc.removeEventListener("visibilitychange", onVisibility);
  };
}

/**
 * Refetches a plan query when the person returns to this tab after clicking
 * a payment link of `kind` (see the module comment). `done` is true once the
 * plan state shows the purchase; it disarms the refetches.
 */
export function usePayReturnRefetch(kind: PayKind, refetch: () => unknown, done: boolean): void {
  const armed = useSyncExternalStore(
    subscribe,
    () => armedAt.has(kind),
    () => false
  );
  const refetchRef = useRef(refetch);
  useEffect(() => {
    refetchRef.current = refetch;
  });

  useEffect(() => {
    if (armed && done) disarmPayReturn(kind);
  }, [armed, done, kind]);

  useEffect(() => {
    if (!armed || done) return;
    return watchPayReturn(kind, () => refetchRef.current());
  }, [armed, done, kind]);
}
