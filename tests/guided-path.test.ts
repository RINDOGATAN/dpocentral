// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The privacy program path: its shape, where each step leads, and each "done"
 * rule as a pure function over counts.
 */

import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { DPO_CENTRAL_PATH, EMPTY_PATH_COUNTS, type PathCounts } from "@/components/guided/path-config";
import {
  currentLibraryId,
  currentStepId,
  evaluatePath,
  isCounted,
  nextStep,
  overallPercent,
  overallProgress,
  stageOfStep,
  stageOpenByDefault,
  stageProgress,
  stageToCelebrate,
  stepAndFollowing,
  stepSequence,
  type PathStatuses,
  type SequenceEntry,
} from "@/components/guided/path";

const PATH = DPO_CENTRAL_PATH;
const steps = PATH.stages.flatMap((s) => s.steps);
const step = (id: string) => {
  const found = steps.find((s) => s.id === id);
  if (!found) throw new Error(`no step ${id}`);
  return found;
};
const statusOf = (id: string, over: Partial<PathCounts>) =>
  evaluatePath(PATH, { ...EMPTY_PATH_COUNTS, ...over })[id];

/** An organisation that has done everything the counted rules ask. */
const COMPLETE: PathCounts = {
  quickstartCompleted: true,
  dataAssets: 4,
  processingActivities: 3,
  jurisdictions: 2,
  vendors: 2,
  vendorsAssessed: 2,
  vendorAssessments: 2,
  assessments: 2,
  assessmentsApproved: 1,
  transfers: 1,
  dsarRequests: 1,
  dsarIntakeForms: 1,
  incidents: 1,
  aiSystems: 0,
};

describe("the shape of the path", () => {
  it("has six stages, with the quick start first", () => {
    expect(PATH.stages.map((s) => s.id)).toEqual([
      "setup",
      "people",
      "inventory",
      "assess",
      "rights",
      "respond",
    ]);
    expect(PATH.stages[0].steps[0].id).toBe("quickstart");
    expect(PATH.stages[0].steps[0].href).toBe("/privacy/quickstart");
  });

  it("gives every step a unique id, a written rule, and either a page or the coming label", () => {
    const ids = steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of steps) {
      expect(s.rule.length, s.id).toBeGreaterThan(20);
      if (s.coming) {
        expect(s.href, s.id).toBeNull();
        expect(s.status, s.id).toBeUndefined();
      } else {
        expect(s.href, s.id).toMatch(/^\/privacy\//);
        expect(typeof s.status, s.id).toBe("function");
      }
    }
  });

  it("leads only to pages that exist", () => {
    const hrefs = [
      ...steps.flatMap((s) => (s.href ? [s.href] : [])),
      ...PATH.library({ stripeEnabled: true, clientMode: true }).map((i) => i.href),
    ];
    for (const href of hrefs) {
      const path = href.split(/[?#]/)[0];
      expect(existsSync(join("src/app/(dashboard)", path, "page.tsx")), href).toBe(true);
    }
  });

  it("keeps every entry of the Classic menus reachable", () => {
    const guided = new Set([
      ...steps.flatMap((s) => (s.href ? [s.href.split("?")[0]] : [])),
      ...PATH.library({ stripeEnabled: true, clientMode: true }).map((i) => i.href.split("?")[0]),
    ]);
    // The Classic top-bar entries (src/components/dashboard-shell.tsx) plus
    // Settings. Every one must be reachable from Guided, once.
    const classic = [
      "/privacy/data-inventory",
      "/privacy/assessments",
      "/privacy/vendors",
      "/privacy/dsar",
      "/privacy/incidents",
      "/privacy/transfers",
      "/privacy/skills",
      "/privacy/clients",
      "/privacy/reports",
      "/privacy/regulations",
      "/privacy/ai-systems",
      "/privacy/experts",
      "/privacy/settings",
    ];
    for (const href of classic) {
      expect(guided.has(href), href).toBe(true);
    }
  });

  it("shows Billing only when the store is on", () => {
    expect(PATH.library({ stripeEnabled: false }).some((i) => i.id === "billing")).toBe(false);
    expect(PATH.library({ stripeEnabled: true }).some((i) => i.id === "billing")).toBe(true);
  });

  it("never offers the older client cards as a step: 'All clients' is the one client view", () => {
    const hrefs = steps.flatMap((s) => (s.href ? [s.href] : []));
    expect(hrefs).not.toContain("/privacy/clients");
  });

  it("gives every step its own destination, and each destination marks its own step", () => {
    const withPage = steps.filter((s) => s.href);
    const hrefs = withPage.map((s) => s.href);
    expect(new Set(hrefs).size, hrefs.join(", ")).toBe(hrefs.length);
    for (const s of withPage) {
      const [path, query = ""] = s.href!.split("?");
      expect(currentStepId(PATH, path, query), s.id).toBe(s.id);
    }
  });

  it("keeps the library free of any step's destination", () => {
    const stepPaths = new Set(steps.flatMap((s) => (s.href ? [s.href.split("?")[0]] : [])));
    for (const item of PATH.library({ stripeEnabled: true, clientMode: true })) {
      expect(stepPaths.has(item.href.split("?")[0]), item.id).toBe(false);
    }
  });

  it("has every label in English and Spanish", () => {
    for (const messages of [en, es]) {
      const g = (messages as Record<string, unknown>).guided as unknown as {
        stages: Record<string, string>;
        steps: Record<string, { label: string; why: string; do: string }>;
        library: Record<string, string>;
      };
      for (const stage of PATH.stages) expect(g.stages[stage.id], stage.id).toBeTruthy();
      for (const s of steps) {
        expect(g.steps[s.id]?.label, s.id).toBeTruthy();
        expect(g.steps[s.id]?.why, s.id).toBeTruthy();
        expect(g.steps[s.id]?.do, s.id).toBeTruthy();
        expect(g.steps[s.id].do.length, s.id).toBeLessThanOrEqual(140);
      }
      expect(Object.keys(g.steps).sort()).toEqual(steps.map((s) => s.id).sort());
      for (const item of PATH.library({ stripeEnabled: true, clientMode: true })) {
        expect(g.library[item.id], item.id).toBeTruthy();
      }
    }
  });

  it("uses no long dash in its copy", () => {
    const text = JSON.stringify([
      (en as Record<string, unknown>).guided,
      (es as Record<string, unknown>).guided,
    ]);
    expect(text).not.toMatch(/[–—]/);
  });
});

describe("the done rules", () => {
  it("marks a new organisation not started everywhere, and the unbuilt steps coming", () => {
    const s = evaluatePath(PATH, EMPTY_PATH_COUNTS);
    for (const st of steps) {
      expect(s[st.id], st.id).toBe(st.coming ? "coming" : st.shownWhen ? "hidden" : "todo");
    }
    expect(s.privacyPolicy).toBe("coming");
    expect(s.training).toBe("coming");
  });

  it("marks a complete organisation done on every counted step", () => {
    const s = evaluatePath(PATH, COMPLETE);
    for (const st of steps.filter(isCounted)) expect(s[st.id], st.id).toBe("done");
    expect(nextStep(PATH, s)).toBeNull();
  });

  it("quick start: done once completed, started when records exist without it", () => {
    expect(statusOf("quickstart", { quickstartCompleted: true })).toBe("done");
    expect(statusOf("quickstart", { dataAssets: 1 })).toBe("started");
    expect(statusOf("quickstart", { vendors: 1 })).toBe("started");
    expect(statusOf("quickstart", { processingActivities: 1 })).toBe("started");
    expect(statusOf("quickstart", {})).toBe("todo");
  });

  it("quick start: done without the wizard when a data asset and a vendor both exist", () => {
    expect(statusOf("quickstart", { dataAssets: 8, vendors: 5 })).toBe("done");
    const s = evaluatePath(PATH, { ...EMPTY_PATH_COUNTS, dataAssets: 8, vendors: 5 });
    expect(nextStep(PATH, s)?.step.id).not.toBe("quickstart");
  });

  it("what applies: a declared jurisdiction finishes it", () => {
    expect(statusOf("applies", {})).toBe("todo");
    expect(statusOf("applies", { jurisdictions: 1 })).toBe("done");
  });

  it("data inventory: one data asset", () => {
    expect(statusOf("dataInventory", {})).toBe("todo");
    expect(statusOf("dataInventory", { dataAssets: 1 })).toBe("done");
  });

  it("records of processing: started with an asset, done with an activity", () => {
    expect(statusOf("ropa", { dataAssets: 1 })).toBe("started");
    expect(statusOf("ropa", { processingActivities: 1 })).toBe("done");
  });

  it("vendors: one recorded vendor", () => {
    expect(statusOf("vendors", { vendors: 1 })).toBe("done");
  });

  it("AI systems: shown only with an AI system, read-only and never counted", () => {
    expect(step("aiSystems").optional).toBe(true);
    expect(statusOf("aiSystems", {})).toBe("hidden");
    expect(statusOf("aiSystems", { aiSystems: 1 })).toBe("done");
    const inventory = PATH.stages.find((s) => s.id === "inventory")!;
    expect(inventory.steps.at(-1)?.id).toBe("aiSystems");
  });

  it("assessments: an approved one finishes it, a draft only starts it", () => {
    expect(statusOf("assessments", { assessments: 1 })).toBe("started");
    expect(statusOf("assessments", { assessments: 1, assessmentsApproved: 1 })).toBe("done");
  });

  it("transfers: one recorded transfer", () => {
    expect(statusOf("transfers", { transfers: 1 })).toBe("done");
  });

  it("vendor due diligence: every vendor assessed", () => {
    expect(statusOf("vendorDueDiligence", { vendors: 2, vendorsAssessed: 1, vendorAssessments: 1 })).toBe(
      "started",
    );
    expect(statusOf("vendorDueDiligence", { vendors: 2, vendorsAssessed: 2, vendorAssessments: 2 })).toBe(
      "done",
    );
  });

  it("rights: an intake form starts it, a received request finishes it", () => {
    expect(statusOf("dsar", { dsarIntakeForms: 1 })).toBe("started");
    expect(statusOf("dsar", { dsarRequests: 1 })).toBe("done");
  });

  it("incidents: one recorded incident", () => {
    expect(statusOf("incidents", { incidents: 1 })).toBe("done");
  });
});

describe("progress and the next step", () => {
  it("offers the first counted step not done, never a coming or optional one", () => {
    const s = evaluatePath(PATH, EMPTY_PATH_COUNTS);
    expect(nextStep(PATH, s)?.step.id).toBe("quickstart");

    const afterSetup = evaluatePath(PATH, {
      ...EMPTY_PATH_COUNTS,
      quickstartCompleted: true,
      dataAssets: 1,
      vendors: 1,
      jurisdictions: 1,
    });
    expect(nextStep(PATH, afterSetup)?.step.id).toBe("ropa");
  });

  it("gives the overall percentage as done over counted steps, rounded", () => {
    const counted = steps.filter(isCounted);
    expect(overallPercent(PATH, evaluatePath(PATH, EMPTY_PATH_COUNTS))).toBe(0);
    expect(overallPercent(PATH, evaluatePath(PATH, COMPLETE))).toBe(100);
    for (let n = 1; n <= counted.length; n++) {
      const statuses: PathStatuses = evaluatePath(PATH, EMPTY_PATH_COUNTS);
      for (const s of counted.slice(0, n)) statuses[s.id] = "done";
      expect(overallPercent(PATH, statuses), `${n} done`).toBe(
        Math.round((n / counted.length) * 100),
      );
    }
  });

  it("totals progress across the path", () => {
    const counted = steps.filter(isCounted).length;
    expect(overallProgress(PATH, evaluatePath(PATH, COMPLETE))).toEqual({
      done: counted,
      total: counted,
    });
  });
});

describe("the 'Next step' band", () => {
  const walk = stepSequence(PATH);

  it("walks every step that has a page, in path order, skipping only the coming ones", () => {
    const expected = PATH.stages.flatMap((stage) =>
      stage.steps.filter((s) => s.href && !s.coming).map((s) => s.id),
    );
    expect(walk.map((e) => e.step.id)).toEqual(expected);
  });

  it("numbers each step by its stage and its place in the stage", () => {
    const number = (id: string) => walk.find((e) => e.step.id === id)?.number;
    expect(number("quickstart")).toBe("1.1");
    expect(number("dataInventory")).toBe("3.1");
    expect(number("incidents")).toBe("6.1");
  });

  it("leads from each step to the next one, so one button walks the whole path", () => {
    const visited: string[] = [];
    let id: string | null = walk[0].step.id;
    while (id) {
      visited.push(id);
      const place: ReturnType<typeof stepAndFollowing<PathCounts>> = stepAndFollowing(PATH, id);
      expect(place, id).not.toBeNull();
      const following: SequenceEntry<PathCounts> | null = place!.following;
      if (following) {
        const [path, query = ""] = following.step.href!.split("?");
        expect(currentStepId(PATH, path, query)).toBe(following.step.id);
      }
      id = following?.step.id ?? null;
    }
    expect(visited).toEqual(walk.map((e) => e.step.id));
  });

  it("shows no band off the path", () => {
    expect(stepAndFollowing(PATH, null)).toBeNull();
    expect(stepAndFollowing(PATH, currentStepId(PATH, "/privacy/settings"))).toBeNull();
    expect(stepAndFollowing(PATH, "privacyPolicy")).toBeNull();
  });
});

describe("the current page", () => {
  it("marks exactly one step, telling a page's views apart by their query", () => {
    expect(currentStepId(PATH, "/privacy/quickstart")).toBe("quickstart");
    expect(currentStepId(PATH, "/privacy/vendors")).toBe("vendors");
    expect(currentStepId(PATH, "/privacy/vendors", "view=due-diligence")).toBe("vendorDueDiligence");
    expect(currentStepId(PATH, "/privacy/vendors/abc")).toBe("vendors");
    expect(currentStepId(PATH, "/privacy/data-inventory")).toBe("dataInventory");
    expect(currentStepId(PATH, "/privacy/data-inventory/processing-activities")).toBe("ropa");
  });

  it("does not claim the dashboard or a library page as a step", () => {
    expect(currentStepId(PATH, "/privacy")).toBeNull();
    expect(currentStepId(PATH, "/privacy/settings")).toBeNull();
    expect(currentLibraryId(PATH.library({ stripeEnabled: false }), "/privacy/settings")).toBe(
      "settings",
    );
  });

  it("opens the stage that holds the current page", () => {
    expect(stageOfStep(PATH, currentStepId(PATH, "/privacy/transfers"))?.id).toBe("assess");
    expect(stageOfStep(PATH, null)).toBeNull();
  });

  it("lands a new person on the dashboard with stage 1 open", () => {
    const fresh = evaluatePath(PATH, EMPTY_PATH_COUNTS);
    expect(stageOpenByDefault(PATH, null, null, true)?.id).toBe("setup");
    expect(stageOpenByDefault(PATH, null, fresh, true)?.id).toBe("setup");
  });
});

describe("the stage-complete message", () => {
  const withStages = (ids: string[]): PathStatuses => {
    const statuses = evaluatePath(PATH, EMPTY_PATH_COUNTS);
    for (const stage of PATH.stages) {
      if (!ids.includes(stage.id)) continue;
      for (const s of stage.steps.filter(isCounted)) statuses[s.id] = "done";
    }
    return statuses;
  };

  it("announces nothing the first time, and remembers what is already done", () => {
    const r = stageToCelebrate(PATH, withStages(["setup"]), null);
    expect(r.celebrate).toBeNull();
    expect(r.remember).toContain("setup");
  });

  it("announces a stage once, when it is first seen done", () => {
    const first = stageToCelebrate(PATH, withStages(["setup", "inventory"]), ["setup"]);
    expect(first.celebrate).toBe(2);
    const again = stageToCelebrate(PATH, withStages(["setup", "inventory"]), first.remember);
    expect(again.celebrate).toBeNull();
  });
});
