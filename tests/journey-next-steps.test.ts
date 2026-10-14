// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Next steps a first-time user follows:
 *
 * J1 "Add Activity" on the records of processing opens the new-activity form,
 *    which lives there (activities have one home)
 * J2 the data inventory opens the tab an address names (?tab=); the old
 *    activities and transfers tabs, and ?new=activity, go to their pages
 * J3 after "Stage N complete. Next: <stage>", the step band's button leads to
 *    the step that sentence names
 * J4 the quick start review counts the flows it will create (a two-way flow
 *    is two)
 * J5 "Start from another client" is offered only when there is a client to
 *    copy from
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DPO_CENTRAL_PATH as PATH, EMPTY_PATH_COUNTS } from "@/components/guided/path-config";
import { evaluatePath, nextStep, stepAndFollowing } from "@/components/guided/path";

const read = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8");

describe("J1: Add Activity on the records of processing", () => {
  const page = read("src/app/(dashboard)/privacy/data-inventory/processing-activities/page.tsx");

  it("opens the new-activity form on this page", () => {
    expect(page).toContain("<NewActivityDialog open={activityDialogOpen} onOpenChange={setActivityDialogOpen} />");
    expect(page.match(/onClick=\{\(\) => setActivityDialogOpen\(true\)\}/g)?.length).toBe(2);
  });

  it("is shown only to people who may write, and opens on ?new=activity for them", () => {
    expect(page).toContain("const { canWrite } = useOrgRole();");
    expect(page.match(/\{canWrite && \(\s*<Button onClick=\{\(\) => setActivityDialogOpen\(true\)\}/g)?.length).toBe(2);
    expect(page).toContain("if (wantsNewActivity && canWrite)");
  });

  it("leaves no Add Activity button without an action", () => {
    expect(page).not.toMatch(/<Button>\s*<Plus[^>]*\/>\s*\{t\("addActivity"\)\}/);
  });
});

describe("J2: the data inventory follows its address", () => {
  const page = read("src/app/(dashboard)/privacy/data-inventory/page.tsx");

  it("opens the tab named by ?tab=", () => {
    expect(page).toContain('const INVENTORY_TABS = ["assets", "flows"] as const;');
    expect(page).toContain("<Tabs defaultValue={initialTab}>");
  });

  it("sends the old activities and transfers addresses to their pages", () => {
    expect(page).toContain('tabParam === "activities" || wantsNewActivity');
    expect(page).toContain("router.replace(wantsNewActivity ? `${ACTIVITIES_HREF}?new=activity` : ACTIVITIES_HREF)");
    expect(page).toContain("router.replace(TRANSFERS_HREF)");
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
    // The review counts each two-way flow twice, less any direction already
    // recorded (src/server/services/program/quickstart-flows.ts).
    expect(router).toContain("flows: newTemplateFlowCount(template.flows, existingAssetIds, existingFlowPairs)");
    expect(router).toContain("flowCount: flowRecordCount(t.flows)");
  });
});

describe("J5: Start from another client only when there is one", () => {
  it("hides the card for a person with no other client to copy from", () => {
    const page = read("src/app/(dashboard)/privacy/quickstart/page.tsx");
    expect(page).toContain("trpc.clientTemplate.sources.useQuery(");
    expect(page).toContain("const canCopyFromAnother = (copySources?.length ?? 0) > 0;");
    expect(page).toContain("{canCopyFromAnother && (");
  });
});
