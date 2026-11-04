// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import * as React from "react";
import { CheckCircle2, AlertTriangle, OctagonAlert, Info, Circle } from "lucide-react";

import { cn } from "@/lib/utils";
import type { StatusTone } from "@/config/status-tone";
import { toneChip, toneMark } from "@/config/status-palette";

/**
 * A severity or status label: a word, and a shape that says the same thing.
 *
 * Each tone has its own icon, so the label still reads as good, careful or
 * serious to someone who cannot tell the hues apart. The chip is dark text on a
 * light tint rather than coloured text on the dark card, which is what makes it
 * readable.
 */

const TONE_ICON: Record<StatusTone, React.ElementType> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: OctagonAlert,
  info: Info,
  neutral: Circle,
};

export interface StatusChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone: StatusTone;
  /** Drop the icon only where the same shape is already shown beside the chip. */
  hideIcon?: boolean;
}

export function StatusChip({
  tone,
  hideIcon = false,
  className,
  children,
  ...props
}: StatusChipProps) {
  const Icon = TONE_ICON[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-transparent px-2.5 py-0.5 text-xs font-semibold",
        toneChip(tone),
        className
      )}
      {...props}
    >
      {!hideIcon && <Icon aria-hidden className="h-3 w-3 shrink-0" />}
      {children}
    </span>
  );
}

/**
 * The bare mark for a tone, for a list row or a legend where the word sits
 * next to it already. Never the only thing that says what the row is.
 */
export function StatusMark({
  tone,
  className,
}: {
  tone: StatusTone;
  className?: string;
}) {
  const Icon = TONE_ICON[tone];
  return <Icon aria-hidden className={cn("h-4 w-4 shrink-0", toneMark(tone), className)} />;
}

export { TONE_ICON };
