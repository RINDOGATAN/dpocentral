// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The Guided home (F3, F9 of the September browser round).
 *
 * - It does not ask for the Vendor.Watch portfolio: only the Classic quick
 *   start card reads it.
 * - The Data Inventory card names both counts: "N assets" and "M activities",
 *   the activities being the real count, refreshed after a quick start.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

const ROOT = path.resolve(__dirname, "..");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const home = read("src/app/(dashboard)/privacy/page.tsx");

describe("Guided home", () => {
  it("asks for the portfolio only in Classic", () => {
    const call = home.slice(home.indexOf("quickstart.getPortfolio.useQuery"));
    const enabled = call.slice(0, call.indexOf(");"));
    expect(enabled).toContain('skin !== "guided"');
  });

  it("labels the asset count and the activity count", () => {
    expect(home).toMatch(/stats\.assetsCount", \{ count: dashboardStats\.dataAssets \}/);
    expect(home).toMatch(/stats\.activitiesCount", \{ count: dashboardStats\.processingActivities \}/);
    for (const bundle of [en, es]) {
      expect(bundle.pages.dashboard.stats.assetsCount).toMatch(/\{count, plural/);
      expect(bundle.pages.dashboard.stats.activitiesCount).toMatch(/\{count, plural/);
    }
  });

  it("the quick start refreshes the counts it changes", () => {
    const qs = read("src/app/(dashboard)/privacy/quickstart/page.tsx");
    const onSuccess = qs.slice(qs.indexOf("quickstart.execute.useMutation"), qs.indexOf("onError"));
    expect(onSuccess).toContain("utils.organization.getDashboardStats.invalidate()");
    expect(onSuccess).toContain("utils.dataInventory.invalidate()");
  });
});
