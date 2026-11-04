// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import * as React from "react";

import { cn } from "@/lib/utils";
import type { StatusTone } from "@/config/status-tone";
import { toneBorder, toneMark, toneTint } from "@/config/status-palette";
import { TONE_ICON } from "./status-chip";

/**
 * An alert or a banner.
 *
 * The severity is in three places that do not depend on seeing a hue: the icon,
 * the left border and the heading word. The sentence itself stays in the body
 * text colour, and so does any date or count inside it. A warning still looks
 * like a warning; it is simply readable.
 */
export interface StatusNoteProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  tone: StatusTone;
  /** The heading word. Say the severity here, it is what carries the meaning. */
  title?: React.ReactNode;
}

export function StatusNote({
  tone,
  title,
  className,
  children,
  ...props
}: StatusNoteProps) {
  const Icon = TONE_ICON[tone];
  return (
    <div
      role="note"
      className={cn(
        "rounded-r-lg border-l-4 p-4 text-sm text-foreground",
        toneBorder(tone),
        toneTint(tone),
        className
      )}
      {...props}
    >
      <div className="flex gap-3">
        <Icon aria-hidden className={cn("mt-0.5 h-5 w-5 shrink-0", toneMark(tone))} />
        <div className="min-w-0 space-y-1">
          {title && <p className="font-medium">{title}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}
