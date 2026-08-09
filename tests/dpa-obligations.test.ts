// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

// §10: the recurring-obligation calendar derived from the same facts that
// rendered the DPA — entries appear only when the document actually asserts
// the underlying commitment.

import { describe, it, expect } from "vitest";
import { deriveObligations, earliestObligationDue } from "@/lib/dpa-engine";
import type { AssembleInput } from "@/lib/dpa-engine";

function input(
  facts: Record<string, string> = {},
  selections: Record<string, string> = {}
): AssembleInput {
  return {
    facts: {
      "processing-purpose": "SaaS service.",
      "data-categories": "contact-details",
      "processor-establishment": "US",
      ...facts,
    },
    selections: {
      "breach-notification": "breach-72h",
      "subprocessor-approval": "subproc-general-30d",
      "government-access-requests": "gov-access-full",
      ...selections,
    },
    context: {
      language: "en",
      effectiveDate: new Date("2026-08-09"),
      governingLaw: "SPAIN",
      controller: { name: "Acme" },
      processor: { name: "CloudCo" },
    },
  };
}

function codes(i: AssembleInput): string[] {
  return deriveObligations(i).map((o) => o.code);
}

describe("deriveObligations (§10)", () => {
  it("schedules the 12-month TIA re-evaluation only when Annex IV renders", () => {
    const withTia = deriveObligations(input());
    const tia = withTia.find((o) => o.code === "tia-reevaluation");
    expect(tia?.cadence).toBe("ANNUAL");
    expect(tia?.firstDue).toBe("2027-08-09");

    expect(codes(input({ "processor-establishment": "EEA" }))).not.toContain(
      "tia-reevaluation"
    );
    expect(codes(input({ "include-tia": "no" }))).not.toContain("tia-reevaluation");
  });

  it("adds the transparency report only for the commitments gov-access option", () => {
    expect(codes(input())).toContain("gov-access-transparency-report");
    expect(
      codes(input({}, { "government-access-requests": "gov-access-none" }))
    ).not.toContain("gov-access-transparency-report");
  });

  it("derives TOMs cadences only from confirmed measures", () => {
    expect(codes(input())).not.toContain("toms-access-reviews");
    const confirmed = codes(
      input({ "toms-confirmed": "toms-access-reviews,toms-testing,toms-backup-dr" })
    );
    expect(confirmed).toEqual(
      expect.arrayContaining([
        "toms-access-reviews",
        "toms-vulnerability-scans",
        "toms-penetration-test",
        "toms-restore-test",
      ])
    );
  });

  it("records the breach and sub-processor notice windows with bilingual labels", () => {
    const obligations = deriveObligations(input());
    const breach = obligations.find((o) => o.code === "breach-notification-window");
    expect(breach?.cadence).toBe("ON_EVENT");
    expect(breach?.label.en).toContain("72 hours");
    expect(breach?.label.es).toContain("72 horas");
    expect(
      obligations.find((o) => o.code === "subprocessor-notice")?.label.es
    ).toContain("30 días");
  });

  it("clamps month-end effective dates instead of overflowing the month", () => {
    const i = input({ "toms-confirmed": "toms-testing" });
    i.context.effectiveDate = new Date("2026-01-31");
    const obligations = deriveObligations(i);
    // Jan 31 + 1 month clamps to Feb 28, not Mar 3.
    expect(
      obligations.find((o) => o.code === "toms-vulnerability-scans")?.firstDue
    ).toBe("2026-02-28");
    expect(obligations.find((o) => o.code === "tia-reevaluation")?.firstDue).toBe(
      "2027-01-31"
    );
  });

  it("earliestObligationDue picks the soonest scheduled date", () => {
    const obligations = deriveObligations(
      input({ "toms-confirmed": "toms-testing" })
    );
    // Monthly scans come due before the annual entries.
    expect(earliestObligationDue(obligations)?.toISOString().slice(0, 10)).toBe(
      "2026-09-09"
    );
    expect(earliestObligationDue([])).toBeNull();
  });
});
