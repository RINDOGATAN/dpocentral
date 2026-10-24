// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The records the service adds on its own (TODO.LAW as processor, with its
 * transfer to the United States) say nothing about where the organisation's
 * own work stands: while nobody has confirmed them they are left out of the
 * path, so a new organisation's figure, phase line and stage states read as
 * if they were not there. They still count among the drafts to confirm. Once
 * a person confirms TODO.LAW, the vendor and its transfer count normally.
 */

import { describe, expect, it } from "vitest";
import { DPO_CENTRAL_PATH } from "@/components/guided/path-config";
import { currentPhase, evaluatePath, programFigure, stageProgress } from "@/components/guided/path";
import { draftTotal, loadPathCounts } from "@/server/services/program/path-counts";
import { TODOLAW_SOURCE_REF } from "@/server/services/todolaw-processor";

type Where = Record<string, unknown>;

/** A new hosted organisation holding only TODO.LAW and its transfer, confirmed or not. */
function fakeDb(confirmed: boolean) {
  const isSystemVendor = (w: Where | undefined) => !!w && w.sourceRef === TODOLAW_SOURCE_REF;
  const asksDrafts = (w: Where) => "provenance" in w || "confirmedAt" in w;
  const count = (model: string) => async ({ where }: { where: Where }) => {
    if (model === "vendor") {
      if (isSystemVendor(where)) return confirmed ? 0 : 1; // the service's unconfirmed vendor
      if (asksDrafts(where)) return confirmed ? 0 : 1;
      if ("assessments" in where) return 0;
      return 1;
    }
    if (model === "dataTransfer") {
      if ("complianceStatus" in where) return 0;
      if (isSystemVendor(where.vendor as Where)) return confirmed ? 0 : 1;
      if ("OR" in where) return confirmed ? 0 : 1; // on a draft activity or a draft vendor
      return 1;
    }
    return 0;
  };
  const model = (name: string) => ({
    count: count(name),
    findMany: async () => (name === "vendor" && confirmed ? [{ status: "ACTIVE", dataProcessed: ["CONTACT"], countries: ["US"] }] : []),
    findFirst: async () => (name === "organization" ? { settings: {} } : null),
  });
  return new Proxy({}, { get: (_t, name: string) => model(name) }) as never;
}

describe("the service's own drafts and the path", () => {
  it("leave a new organisation's figure, phase and stages as if they were not there", async () => {
    const counts = await loadPathCounts(fakeDb(false), "org");
    expect(counts.vendors).toBe(0);
    expect(counts.transfers).toBe(0);
    const statuses = evaluatePath(DPO_CENTRAL_PATH, counts);
    expect(statuses.quickstart).toBe("todo");
    expect(statuses.vendors).toBe("todo");
    expect(statuses.transfers).toBe("todo");
    const figure = programFigure(DPO_CENTRAL_PATH, statuses);
    expect(figure).toMatchObject({ confirmed: 0, toConfirm: 0, started: 0, notStarted: 5 });
    expect(currentPhase(DPO_CENTRAL_PATH, statuses)!.number).toBe(1);
    for (const stage of DPO_CENTRAL_PATH.stages) expect(stageProgress(stage, statuses).state).not.toBe("toConfirm");
    // Still offered for confirmation.
    expect(draftTotal(counts)).toBe(1);
  });

  it("count normally once a person has confirmed TODO.LAW", async () => {
    const counts = await loadPathCounts(fakeDb(true), "org");
    expect(counts.vendors).toBe(1);
    expect(counts.vendorsDrafts).toBe(0);
    expect(counts.transfers).toBe(1);
    expect(counts.transfersDrafts).toBe(0);
    expect(draftTotal(counts)).toBe(0);
    const statuses = evaluatePath(DPO_CENTRAL_PATH, counts);
    expect(statuses.vendors).toBe("done");
    // The transfer still waits for its compliance status, like any other.
    expect(statuses.transfers).toBe("started");
  });
});
