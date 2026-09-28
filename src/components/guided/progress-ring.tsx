// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * A small ring in the accent colour: the track is always drawn, the arc fills
 * in when the value arrives, so nothing moves when progress loads. Decorative:
 * the progress it shows is always also written out as text beside it.
 */

import { Check } from "lucide-react";

export function ProgressRing({
  value,
  total,
  size = 28,
  complete = false,
  children,
}: {
  /** Null while loading: only the track is drawn. */
  value: number | null;
  total: number;
  size?: number;
  /**
   * The stage is done: a solid accent disc with a check replaces the ring and
   * its number. Same size, so nothing moves.
   */
  complete?: boolean;
  children?: React.ReactNode;
}) {
  if (complete) {
    return (
      <span
        className="inline-flex items-center justify-center shrink-0 rounded-full bg-primary text-primary-foreground"
        style={{ width: size, height: size }}
        aria-hidden="true"
        data-complete="true"
      >
        <Check style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={3} />
      </span>
    );
  }
  const stroke = 2.5;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const fraction = value === null || total === 0 ? 0 : Math.min(1, value / total);
  return (
    <span
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-500"
          style={{ opacity: fraction === 0 ? 0 : 1 }}
        />
      </svg>
      {children && (
        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tabular-nums">
          {children}
        </span>
      )}
    </span>
  );
}

/** A thin bar in the accent colour, for the phone's stage line. */
export function ProgressBar({ value, total }: { value: number | null; total: number }) {
  const fraction = value === null || total === 0 ? 0 : Math.min(1, value / total);
  return (
    <span className="block h-1 w-full rounded-full bg-muted overflow-hidden" aria-hidden="true">
      <span
        className="block h-full rounded-full bg-primary motion-safe:transition-[width] motion-safe:duration-500"
        style={{ width: `${Math.round(fraction * 100)}%` }}
      />
    </span>
  );
}
