// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The compliance status of an international transfer
 * (src/config/transfer-compliance-rules.ts), for every mechanism and every
 * kind of destination: within the EEA, a full adequacy decision, a partial
 * one (US under the EU-US Data Privacy Framework, Canada under PIPEDA) with
 * and without the recipient's scope recorded, and no decision.
 *
 * A partial decision covers the transfer only when the record confirms the
 * recipient is within its scope; otherwise the mechanism rules apply, so
 * "SCCs, no TIA" to an uncertified US recipient needs review.
 */

import { describe, expect, it } from "vitest";
import {
  ADEQUACY_DECISIONS,
  adequacyCoverage,
  getAdequacyDecision,
  getTransferComplianceExplanation,
  getTransferComplianceStatus,
  isAdequateCountry,
  isEeaCountry,
  type TransferComplianceStatus,
} from "@/config/transfer-compliance-rules";
import { canonicalCountryCode, isIsoCountryCode } from "@/lib/country-code";

const PAST = new Date("2020-01-01");
const FUTURE = new Date("2099-01-01");

type Case = {
  mechanism: string;
  tia: boolean;
  expiry?: Date | null;
};

const MECHANISMS: Case[] = [
  { mechanism: "ADEQUACY_DECISION", tia: false },
  { mechanism: "STANDARD_CONTRACTUAL_CLAUSES", tia: false },
  { mechanism: "STANDARD_CONTRACTUAL_CLAUSES", tia: true },
  { mechanism: "STANDARD_CONTRACTUAL_CLAUSES", tia: true, expiry: PAST },
  { mechanism: "STANDARD_CONTRACTUAL_CLAUSES", tia: true, expiry: FUTURE },
  { mechanism: "BINDING_CORPORATE_RULES", tia: false },
  { mechanism: "BINDING_CORPORATE_RULES", tia: true },
  { mechanism: "CERTIFICATION", tia: false },
  { mechanism: "CERTIFICATION", tia: true },
  { mechanism: "CODE_OF_CONDUCT", tia: false },
  { mechanism: "CODE_OF_CONDUCT", tia: true },
  { mechanism: "DEROGATION", tia: false },
  { mechanism: "DEROGATION", tia: true },
  { mechanism: "OTHER", tia: false },
  { mechanism: "", tia: false },
];

/** The status the mechanism alone earns (no adequacy covering the transfer). */
function mechanismOnly(c: Case): TransferComplianceStatus {
  switch (c.mechanism) {
    case "ADEQUACY_DECISION":
      return "NEEDS_REVIEW";
    case "STANDARD_CONTRACTUAL_CLAUSES":
      if (c.expiry && c.expiry < new Date()) return "NON_COMPLIANT";
      return c.tia ? "COMPLIANT" : "NEEDS_REVIEW";
    case "BINDING_CORPORATE_RULES":
    case "CERTIFICATION":
    case "CODE_OF_CONDUCT":
      return c.tia ? "COMPLIANT" : "NEEDS_REVIEW";
    case "DEROGATION":
      return "NEEDS_REVIEW";
    case "OTHER":
      return "PENDING";
    default:
      return "NON_COMPLIANT";
  }
}

const status = (country: string, c: Case, adequacyScopeConfirmed?: boolean | null) =>
  getTransferComplianceStatus({
    mechanism: c.mechanism,
    destinationCountry: country,
    tiaCompleted: c.tia,
    sccExpiryDate: c.expiry ?? null,
    adequacyScopeConfirmed,
  });

const label = (c: Case) => `${c.mechanism || "(none)"} tia=${c.tia} expiry=${c.expiry?.getFullYear() ?? "-"}`;

describe("transfer compliance status: every mechanism by kind of destination", () => {
  it("within the EEA, every mechanism is compliant (not a restricted transfer)", () => {
    for (const country of ["ES", "de", " FR ", "IS", "LI", "NO", "EL"]) {
      for (const c of MECHANISMS) expect(status(country, c), `${country} ${label(c)}`).toBe("COMPLIANT");
    }
  });

  it("with a full adequacy decision, every mechanism is compliant", () => {
    for (const country of ["GB", "UK", "CH", "JP", "KR", "BR", "NZ", "IL", "UY", "AR", "AD", "FO", "GG", "IM", "JE"]) {
      for (const c of MECHANISMS) expect(status(country, c), `${country} ${label(c)}`).toBe("COMPLIANT");
    }
  });

  it("with a partial decision whose scope is recorded, every mechanism is compliant", () => {
    for (const country of ["US", "CA"]) {
      for (const c of MECHANISMS) expect(status(country, c, true), `${country} ${label(c)}`).toBe("COMPLIANT");
    }
  });

  it("with a partial decision whose scope is not recorded, the mechanism decides", () => {
    for (const country of ["US", "CA"]) {
      for (const scope of [undefined, null, false]) {
        for (const c of MECHANISMS) {
          expect(status(country, c, scope), `${country} scope=${scope} ${label(c)}`).toBe(mechanismOnly(c));
        }
      }
    }
  });

  it("with no adequacy decision, the mechanism decides", () => {
    for (const country of ["IN", "SG", "AU", "CN", "ZA"]) {
      for (const c of MECHANISMS) expect(status(country, c), `${country} ${label(c)}`).toBe(mechanismOnly(c));
    }
  });

  it("SCCs to the US with no TIA and no DPF certification need review, never compliant", () => {
    expect(status("US", { mechanism: "STANDARD_CONTRACTUAL_CLAUSES", tia: false })).toBe("NEEDS_REVIEW");
    expect(status("US", { mechanism: "ADEQUACY_DECISION", tia: false })).toBe("NEEDS_REVIEW");
    expect(status("US", { mechanism: "ADEQUACY_DECISION", tia: false }, true)).toBe("COMPLIANT");
  });

  it("accepts mechanism names as free text", () => {
    expect(status("IN", { mechanism: "Standard Contractual Clauses", tia: false })).toBe("NEEDS_REVIEW");
    expect(status("IN", { mechanism: "bcr", tia: true })).toBe("COMPLIANT");
    expect(status("IN", { mechanism: "Art. 49 derogation", tia: false })).toBe("NEEDS_REVIEW");
    expect(status("IN", { mechanism: "none", tia: false })).toBe("NON_COMPLIANT");
  });
});

describe("adequacy coverage", () => {
  it("tells the EEA, full, partial (recorded or not) and none apart", () => {
    expect(adequacyCoverage("ES")).toBe("EEA");
    expect(adequacyCoverage("EL")).toBe("EEA");
    expect(adequacyCoverage("UK")).toBe("FULL");
    expect(adequacyCoverage("US")).toBe("PARTIAL_UNCONFIRMED");
    expect(adequacyCoverage("US", true)).toBe("PARTIAL_CONFIRMED");
    expect(adequacyCoverage("CA", false)).toBe("PARTIAL_UNCONFIRMED");
    expect(adequacyCoverage("IN")).toBe("NONE");
    expect(adequacyCoverage("")).toBe("NONE");
    expect(adequacyCoverage(null)).toBe("NONE");
  });

  it("does not call a partial decision adequate until the scope is recorded", () => {
    expect(isAdequateCountry("US")).toBe(false);
    expect(isAdequateCountry("CA")).toBe(false);
    expect(isAdequateCountry("US", true)).toBe(true);
    expect(isAdequateCountry("GB")).toBe(true);
    expect(isAdequateCountry("ES")).toBe(true);
    expect(isAdequateCountry("IN")).toBe(false);
  });

  it("explains a partial decision without the recorded scope", () => {
    const text = getTransferComplianceExplanation({
      mechanism: "ADEQUACY_DECISION",
      destinationCountry: "US",
      tiaCompleted: false,
    });
    expect(text).toContain("covers only some recipients");
  });
});

describe("the adequacy list (European Commission, checked October 2026)", () => {
  it("lists every country decision once, with valid ISO codes", () => {
    const codes = ADEQUACY_DECISIONS.map((d) => d.countryCode);
    expect(new Set(codes).size).toBe(codes.length);
    for (const c of codes) expect(isIsoCountryCode(c), c).toBe(true);
    expect([...codes].sort()).toEqual(
      ["AD", "AR", "BR", "CA", "CH", "FO", "GB", "GG", "IL", "IM", "JE", "JP", "KR", "NZ", "US", "UY"].sort()
    );
  });

  it("marks exactly the US (DPF) and Canada (PIPEDA) as partial, each with its scope", () => {
    const partial = ADEQUACY_DECISIONS.filter((d) => d.isPartial);
    expect(partial.map((d) => [d.countryCode, d.partialScope]).sort()).toEqual([
      ["CA", "PIPEDA"],
      ["US", "DPF"],
    ]);
  });

  it("carries the decision dates of Brazil (2026), Korea (2021) and the UK (2021, renewed 2025)", () => {
    expect(getAdequacyDecision("BR")?.decisionDate).toBe("2026-01-26");
    expect(getAdequacyDecision("KR")?.decisionDate).toBe("2021-12-17");
    expect(getAdequacyDecision("uk")?.decisionDate).toBe("2021-06-28");
    expect(getAdequacyDecision("GB")?.notes).toContain("19 December 2025");
  });
});

describe("country codes", () => {
  it("maps the UK and EL aliases and rejects what is not an ISO code", () => {
    expect(canonicalCountryCode(" uk ")).toBe("GB");
    expect(canonicalCountryCode("el")).toBe("GR");
    expect(isIsoCountryCode("UK")).toBe(true);
    expect(isIsoCountryCode("EU")).toBe(false);
    expect(isIsoCountryCode("ZZ")).toBe(false);
    expect(isEeaCountry("el")).toBe(true);
    expect(isEeaCountry("GB")).toBe(false);
  });
});
