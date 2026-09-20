// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { Lightbulb, AlertTriangle, Info, StickyNote } from "lucide-react";

import { toneBorder, toneMark, toneTint } from "@/config/status-palette";

type CalloutType = "tip" | "warning" | "info" | "note";

interface InfoCalloutProps {
  type: CalloutType;
  title?: string;
  children: React.ReactNode;
}

/**
 * Each callout says what it is three ways that do not need colour vision: its
 * icon, its left border and its heading. The sentence keeps the body colour.
 */
const calloutConfig: Record<CalloutType, { icon: React.ElementType; border: string; bg: string; iconColor: string }> = {
  tip: { icon: Lightbulb, border: "border-primary", bg: "bg-primary/5", iconColor: "text-primary" },
  warning: {
    icon: AlertTriangle,
    border: toneBorder("warning"),
    bg: toneTint("warning"),
    iconColor: toneMark("warning"),
  },
  info: {
    icon: Info,
    border: toneBorder("info"),
    bg: toneTint("info"),
    iconColor: toneMark("info"),
  },
  note: { icon: StickyNote, border: "border-muted-foreground", bg: "bg-muted/50", iconColor: "text-muted-foreground" },
};

export function InfoCallout({ type, title, children }: InfoCalloutProps) {
  const config = calloutConfig[type];
  const Icon = config.icon;

  return (
    <div className={`border-l-4 ${config.border} ${config.bg} rounded-r-lg p-4`}>
      <div className="flex gap-3">
        <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${config.iconColor}`} />
        <div className="space-y-1">
          {title && <p className="font-medium text-sm">{title}</p>}
          <div className="text-sm text-muted-foreground">{children}</div>
        </div>
      </div>
    </div>
  );
}
