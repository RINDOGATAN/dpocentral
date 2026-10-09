// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The menu's locks (owner's decision, 9 October 2026, with the retirement of
 * Classic): a small lock beside a step that leads to a premium type the
 * organisation is not entitled to, only where licences are enforced, by the
 * pages' own rule, with an accessible label and no price.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { lockedStepIds } from "@/lib/menu-locks";
import { DPO_CENTRAL_PATH } from "@/components/guided/path-config";

const read = (p: string) => readFileSync(path.resolve(__dirname, "..", p), "utf8");

describe("which steps carry a lock", () => {
  it("none on the hosted pilot, whatever the entitlements", () => {
    expect(lockedStepIds(DPO_CENTRAL_PATH, { entitledTypes: [], hosted: true })).toEqual([]);
  });

  it("none while the entitlements are still loading", () => {
    expect(lockedStepIds(DPO_CENTRAL_PATH, { entitledTypes: undefined, hosted: false })).toEqual([]);
  });

  it("on the kit, the steps whose premium type is not installed", () => {
    expect(lockedStepIds(DPO_CENTRAL_PATH, { entitledTypes: [], hosted: false })).toEqual([
      "vendorDueDiligence",
    ]);
    expect(lockedStepIds(DPO_CENTRAL_PATH, { entitledTypes: ["DPIA"], hosted: false })).toEqual([
      "vendorDueDiligence",
    ]);
  });

  it("never on the Assessments step: the DPIA lock sits on the DPIA option instead (9 October 2026)", () => {
    const step = DPO_CENTRAL_PATH.stages.flatMap((s) => s.steps).find((s) => s.id === "assessments");
    expect(step?.premiumType).toBeUndefined();
    for (const entitledTypes of [[], ["PIA"], ["VENDOR"]]) {
      expect(lockedStepIds(DPO_CENTRAL_PATH, { entitledTypes, hosted: false })).not.toContain("assessments");
    }
  });

  it("none where nothing is locked", () => {
    expect(
      lockedStepIds(DPO_CENTRAL_PATH, { entitledTypes: ["DPIA", "PIA", "VENDOR"], hosted: false }),
    ).toEqual([]);
  });
});

describe("how the lock is shown", () => {
  it("uses the pages' entitlement check, and never asks on the hosted pilot", () => {
    const layout = read("src/components/guided/guided-layout.tsx");
    expect(layout).toContain("trpc.assessment.getEntitledTypes.useQuery");
    expect(layout).toContain("enabled: !!organization?.id && !hosted");
    expect(layout).toContain("lockedSteps: lockedStepIds(");
    expect(read("src/lib/menu-locks.ts")).toContain("isAssessmentTypeLocked(");
  });

  it("carries an accessible label and no price", () => {
    const menu = read("src/components/guided/path-menu.tsx");
    const start = menu.indexOf("{locked && (");
    const block = menu.slice(start, menu.indexOf("</span>\n          )}", start));
    expect(block).toContain('<Lock className="size-3" aria-hidden="true" />');
    expect(block).toContain('<span className="sr-only">{t("requiresLicence")}</span>');
    expect(block).not.toMatch(/€|\$\d|price|precio/i);
    expect(en.guided.requiresLicence).toBe("Requires a licence");
    expect(es.guided.requiresLicence).toBe("Requiere una licencia");
  });
});

describe("the DPIA option's lock", () => {
  it("the assessments page locks the DPIA card by the same rule, never on the hosted pilot", () => {
    const page = read("src/app/(dashboard)/privacy/assessments/page.tsx");
    expect(page).toContain('isAssessmentTypeLocked({ type: "DPIA", entitledTypes: entitledData.entitledTypes, hosted })');
    expect(page).toContain("enabled: !!organization?.id && !hosted");
    expect(page).toContain('item.type === "DPIA" && dpiaLocked && (');
    expect(page).toContain("<LicenceLock");
  });

  it("the type picker's lock carries the accessible label and a locked card shows no price", () => {
    const picker = read("src/app/(dashboard)/privacy/assessments/new/page.tsx");
    expect(picker).toContain('<span className="sr-only">{tg("requiresLicence")}</span>');
    const badge = picker.slice(picker.indexOf("{isLocked\n"), picker.indexOf(": tp(\"premiumSkill\")"));
    expect(badge).toContain('? tg("requiresLicence")');
    expect(en.pages.newAssessment.typeCardLockedLabel).toBe("{name} (requires a licence)");
    expect(es.pages.newAssessment.typeCardLockedLabel).toBe("{name} (requiere una licencia)");
  });

  it("the shared lock carries the accessible label and no price", () => {
    const lock = read("src/components/premium/licence-lock.tsx");
    expect(lock).toContain('<Lock className="size-3.5" aria-hidden="true" />');
    expect(lock).toContain('<span className="sr-only">{t("requiresLicence")}</span>');
    expect(lock.split("*/").slice(1).join("")).not.toMatch(/€|\$\d|price|precio|formatPrice/i);
  });
});
