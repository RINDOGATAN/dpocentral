// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Next steps a first-time user follows:
 *
 * J1 "Add Activity" on the records of processing opens the new-activity form
 *    (it lives on the data inventory) instead of doing nothing
 * J2 the data inventory opens the tab an address names (?tab=) and the
 *    new-activity form on ?new=activity
 * J3 after "Stage N complete. Next: <stage>", the step band's button leads to
 *    the step that sentence names
 * J4 the quick start review counts the flows it will create (a two-way flow
 *    is two)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DPO_CENTRAL_PATH as PATH, EMPTY_PATH_COUNTS } from "@/components/guided/path-config";
import { evaluatePath, nextStep, stepAndFollowing } from "@/components/guided/path";

const read = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8");

describe("J1: Add Activity on the records of processing", () => {
  const page = read("src/app/(dashboard)/privacy/data-inventory/processing-activities/page.tsx");

  it("links to the data inventory with the new-activity form open", () => {
    expect(page).toContain('"/privacy/data-inventory?tab=activities&new=activity"');
    const links = page.match(/<Link href=\{NEW_ACTIVITY_HREF\}>/g) ?? [];
    expect(links.length).toBe(2);
  });

  it("is shown only to people who may write", () => {
    expect(page).toContain("const { canWrite } = useOrgRole();");
    expect(page.match(/\{canWrite && \(\s*<Button asChild>/g)?.length).toBe(2);
  });

  it("leaves no Add Activity button without an action", () => {
    expect(page).not.toMatch(/<Button>\s*<Plus[^>]*\/>\s*\{t\("addActivity"\)\}/);
  });
});

describe("J2: the data inventory follows its address", () => {
  const page = read("src/app/(dashboard)/privacy/data-inventory/page.tsx");

  it("opens the tab named by ?tab=", () => {
    expect(page).toContain('const INVENTORY_TABS = ["assets", "activities", "flows", "transfers"] as const;');
    expect(page).toContain("<Tabs defaultValue={initialTab}>");
  });

  it("opens the new-activity form once on ?new=activity, for writers only", () => {
    expect(page).toContain('searchParams.get("new") === "activity"');
    expect(page).toContain("if (wantsNewActivity && canWrite)");
    expect(page).toContain('router.replace("/privacy/data-inventory?tab=activities"');
  });
});

describe("J3: the step band's button after a stage is complete", () => {
  it("names the next step not done, not the step after this page", () => {
    // Quick start done and jurisdictions declared: stage 1 is complete, and
    // the step after the quick start (What applies) is already done.
    const statuses = evaluatePath(PATH, {
      ...EMPTY_PATH_COUNTS,
      quickstartCompleted: true,
      jurisdictions: 1,
      dataAssets: 5,
      dataAssetsDrafts: 5,
    });
    const place = stepAndFollowing(PATH, "quickstart", statuses);
    expect(place?.following?.step.id).toBe("applies");
    expect(statuses.applies).toBe("done");
    expect(nextStep(PATH, statuses)?.step.id).toBe("dataInventory");
  });

  it("is what the band reads", () => {
    const band = read("src/components/guided/step-band.tsx");
    expect(band).toContain("nextStep(DPO_CENTRAL_PATH, statuses)");
    expect(band).toContain("celebrate !== null ? (ahead ? { step: ahead.step } : null) : place.following");
  });
});

describe("J4: the quick start review counts the flows it will create", () => {
  it("counts a two-way flow twice", async () => {
    const { getLocalizedTemplates, flowRecordCount } = await import("@/config/industry-templates");
    const ecommerce = getLocalizedTemplates("en").find((t) => /commerce/i.test(t.name))!;
    const withReturn = ecommerce.flows.filter((f) => f.returnFlow).length;
    expect(withReturn).toBeGreaterThan(0);
    expect(flowRecordCount(ecommerce.flows)).toBe(ecommerce.flows.length + withReturn);
  });

  it("is what the review and the template list read", () => {
    const router = read("src/server/routers/privacy/quickstart.ts");
    expect(router).toContain("flows: flowRecordCount(template.flows)");
    expect(router).toContain("flowCount: flowRecordCount(t.flows)");
  });
});
