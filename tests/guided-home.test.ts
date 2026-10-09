// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The dashboard home (F3, F9 of the September browser round; Classic retired
 * on 9 October 2026, decision d11).
 *
 * - It does not ask for the Vendor.Watch portfolio: the quick start reads it.
 * - The quick start refreshes the counts it changes.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const home = read("src/app/(dashboard)/privacy/page.tsx");

describe("dashboard home", () => {
  it("does not ask for the portfolio", () => {
    expect(home).not.toContain("quickstart.getPortfolio");
  });

  it("renders the one dashboard, with no layout switch", () => {
    expect(home).toContain("return <GuidedDashboard fromQuickstart={fromQuickstart} />;");
    expect(home).not.toMatch(/useSkin|skin !==/);
  });

  it("the quick start refreshes the counts it changes", () => {
    const qs = read("src/app/(dashboard)/privacy/quickstart/page.tsx");
    const onSuccess = qs.slice(qs.indexOf("quickstart.execute.useMutation"), qs.indexOf("onError"));
    expect(onSuccess).toContain("utils.organization.getDashboardStats.invalidate()");
    expect(onSuccess).toContain("utils.dataInventory.invalidate()");
  });
});
