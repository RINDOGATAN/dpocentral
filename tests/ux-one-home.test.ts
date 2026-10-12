// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * One home per feature (usability review of 12 October 2026): processing
 * activities are created and listed on Records of processing, transfers on
 * Transfers. The data inventory keeps systems and the flow map, and its
 * Activities and Transfers entries are links to those pages.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (p: string) => readFileSync(path.resolve(__dirname, "..", p), "utf8");

describe("U10: one home for activities and transfers", () => {
  const inventory = read("src/app/(dashboard)/privacy/data-inventory/page.tsx");

  it("the data inventory no longer creates or lists activities or transfers", () => {
    expect(inventory).not.toContain("createActivity");
    expect(inventory).not.toContain("createTransfer");
    expect(inventory).not.toContain('TabsContent value="activities"');
    expect(inventory).not.toContain('TabsContent value="transfers"');
  });

  it("its Activities and Transfers entries link to their pages", () => {
    expect(inventory).toContain('const ACTIVITIES_HREF = "/privacy/data-inventory/processing-activities";');
    expect(inventory).toContain('const TRANSFERS_HREF = "/privacy/transfers";');
    expect(inventory).toContain("href={ACTIVITIES_HREF}");
    expect(inventory).toContain("href={TRANSFERS_HREF}");
  });

  it("Records of processing creates activities and pages through all of them", () => {
    const ropa = read("src/app/(dashboard)/privacy/data-inventory/processing-activities/page.tsx");
    expect(ropa).toContain("<NewActivityDialog");
    expect(ropa).toContain("useInfiniteQuery");
    expect(ropa).toContain("<DraftBadge");
  });

  it("a transfer's TIA is started or opened from the transfer's page", () => {
    const detail = read("src/app/(dashboard)/privacy/transfers/[id]/page.tsx");
    expect(detail).toContain("trpc.assessment.createForTransfer.useMutation");
    expect(detail).toContain('data-testid="transfer-tia"');
  });

  it("the transfer requirement links to Transfers", () => {
    expect(read("src/config/jurisdiction-requirements.ts")).toContain('actionHref: "/privacy/transfers"');
  });
});
