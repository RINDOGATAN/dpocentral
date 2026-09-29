// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * A whole card that acts as one button: named, reachable with Tab, and
 * activated with Enter or Space, as well as with a click.
 *
 * Spread the result on the card (`<Card {...cardButton(...)}>`) and add
 * CARD_BUTTON_FOCUS to its classes. A card that is a choice among several
 * (a path, a template) passes `pressed`, so a screen reader hears whether it
 * is chosen. Keys pressed on a control inside the card (a menu trigger) are
 * left to that control.
 */

import type { KeyboardEvent } from "react";

export const CARD_BUTTON_FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export function cardButton(
  onActivate: () => void,
  opts: { label: string; pressed?: boolean }
) {
  return {
    role: "button" as const,
    tabIndex: 0,
    "aria-label": opts.label,
    ...(opts.pressed === undefined ? {} : { "aria-pressed": opts.pressed }),
    onClick: onActivate,
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onActivate();
      }
    },
  };
}
