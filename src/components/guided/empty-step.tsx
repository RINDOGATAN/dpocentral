// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Guided only: what a page on the path shows when its list is empty. One
 * sentence and, when the page has one, one button that does the step. Never
 * a blank table.
 */

import { Card, CardContent } from "@/components/ui/card";

export function EmptyStep({
  children,
  action,
}: {
  /** The one sentence. */
  children: React.ReactNode;
  /** One button (or a Link around one) that does the step. */
  action?: React.ReactNode;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-4 p-6 text-center sm:p-8">
        <p className="max-w-md text-sm text-muted-foreground">{children}</p>
        {action}
      </CardContent>
    </Card>
  );
}
