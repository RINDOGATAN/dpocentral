"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { createContext, useContext, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { RUN_YOUR_OWN_URL } from "@/lib/hosted";

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

const DISMISS_KEY = "dpc.pilotBanner.dismissed";
const DISMISS_EVENT = "dpc:pilot-banner-dismissed";

function subscribeDismiss(onChange: () => void) {
  window.addEventListener(DISMISS_EVENT, onChange);
  return () => window.removeEventListener(DISMISS_EVENT, onChange);
}

function readDismissed(): boolean {
  try {
    return window.sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/** The pilot sentence with its link to /run. */
export function HostedPilotSentence({ className }: { className?: string }) {
  const t = useTranslations("pilot");
  return (
    <span className={className} data-testid="hosted-pilot-sentence">
      {t.rich("banner", {
        run: (chunks) => (
          <a
            href={RUN_YOUR_OWN_URL}
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

/** One-line banner on every hosted page, dismissible for the browser session. */
export function HostedPilotBanner() {
  const t = useTranslations("pilot");
  // Dismissal lives in sessionStorage; the server render always shows the bar.
  const dismissedThisSession = useSyncExternalStore(
    subscribeDismiss,
    readDismissed,
    () => false
  );
  const [dismissedNow, setDismissedNow] = useState(false);

  if (dismissedThisSession || dismissedNow) return null;

  const dismiss = () => {
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
      window.dispatchEvent(new Event(DISMISS_EVENT));
    } catch {
      // Storage unavailable: hide for this page view only.
    }
    setDismissedNow(true);
  };

  return (
    <>
      {/* Spacer so the fixed bar never covers the end of the page */}
      <div aria-hidden className="h-10" />
      <div
        role="region"
        aria-label={t("bannerLabel")}
        data-testid="hosted-pilot-banner"
        className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur text-xs sm:text-sm"
      >
        <div className="mx-auto max-w-7xl px-4 h-10 flex items-center justify-between gap-3">
          <HostedPilotSentence className="truncate" />
          <button
            type="button"
            onClick={dismiss}
            aria-label={t("dismiss")}
            className="shrink-0 p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );
}
