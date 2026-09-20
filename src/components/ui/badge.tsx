// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { toneChip } from "@/config/status-palette"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
        // The severity chips are dark text on a light tint, from the one tone
        // palette. Coloured text on the dark card is not readable, so there is
        // no such variant to reach for. Prefer StatusChip, which also carries
        // the icon that says the same thing as the hue.
        success: `border-transparent ${toneChip("success")}`,
        warning: `border-transparent ${toneChip("warning")}`,
        info: `border-transparent ${toneChip("info")}`,
        danger: `border-transparent ${toneChip("danger")}`,
        neutral: `border-transparent ${toneChip("neutral")}`,
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
