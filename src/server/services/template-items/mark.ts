// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import type { Db } from "@/lib/prisma";

/**
 * A person has taken ownership of a record the quick start (or an industry
 * template) created. Records the first such moment (confirmedBy/confirmedAt)
 * and never overwrites it, so "the person who edited it" stays the first
 * person to edit it. Once confirmedAt is set, "Remove all template items"
 * keeps the record.
 *
 * A no-op for a row already confirmed. Harmless on a USER_ENTERED row (which is
 * never removed anyway), so callers need not check provenance first — call it
 * from the ordinary update path of the three template-created record types.
 */
export type TemplateItemModel = "vendor" | "dataAsset" | "processingActivity";

export async function markConfirmed(
  prisma: Db,
  args: { model: TemplateItemModel; id: string; organizationId: string; userId: string },
): Promise<void> {
  const where = { id: args.id, organizationId: args.organizationId, confirmedAt: null };
  const data = { confirmedBy: args.userId, confirmedAt: new Date() };
  if (args.model === "vendor") {
    await prisma.vendor.updateMany({ where, data });
  } else if (args.model === "dataAsset") {
    await prisma.dataAsset.updateMany({ where, data });
  } else {
    await prisma.processingActivity.updateMany({ where, data });
  }
}
