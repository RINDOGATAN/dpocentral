// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The PDPA (Singapore) sets no hour count from discovery: the organisation
 * assesses whether a breach is notifiable (PDPC guide: within 30 calendar
 * days) and then notifies the PDPC no later than 3 calendar days after that
 * assessment (ss. 26C, 26D). So no 72-hour window from discovery may be
 * computed for it, and the readiness table states both steps.
 */

import { describe, expect, it } from "vitest";
import { JURISDICTION_CORE_DATA } from "@/config/jurisdiction-data";
import { JURISDICTION_CATALOG } from "@/config/jurisdiction-catalog";
import { readinessLaws } from "@/config/breach-readiness";
import { calculateBreachNotificationDeadline } from "@/server/services/privacy/slaCalculator";

describe("PDPA (Singapore) breach window", () => {
  it("has no fixed hour count in the core data and the catalog", () => {
    expect(JURISDICTION_CORE_DATA.find((j) => j.code === "PDPA-SG")?.breachNotificationHours).toBe(0);
    expect(JURISDICTION_CATALOG.find((j) => j.code === "PDPA-SG")?.breachNotificationHours).toBe(0);
  });

  it("computes no hour deadline from discovery", () => {
    expect(calculateBreachNotificationDeadline(new Date("2026-10-26T00:00:00Z"), "PDPA-SG")).toBeNull();
  });

  it("states the assessment and the 3-day notice in English and Spanish", () => {
    const [sg] = readinessLaws(["PDPA-SG"], "en");
    expect(sg.verified).toBe(true);
    expect(sg.authority).toContain("30 calendar days");
    expect(sg.authority).toContain("3 calendar days of that assessment");
    expect(sg.authority).not.toContain("72");
    const [sgEs] = readinessLaws(["PDPA-SG"], "es");
    expect(sgEs.authority).toContain("30 días naturales");
    expect(sgEs.authority).toContain("3 días naturales desde esa valoración");
  });
});
