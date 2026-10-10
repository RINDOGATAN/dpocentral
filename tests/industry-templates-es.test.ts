// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The industry quick-start templates read in Spanish on Spanish screens:
 * every user-visible string has a Spanish entry, the localized templates keep
 * their cross-references, and no template names a real company.
 */

import { describe, it, expect } from "vitest";
import {
  INDUSTRY_TEMPLATES,
  localizeTemplate,
  returnFlowName,
  type IndustryTemplate,
} from "@/config/industry-templates";
import { INDUSTRY_TEMPLATES_ES } from "@/config/industry-templates-es";

function visibleStrings(t: IndustryTemplate): string[] {
  const out: string[] = [t.name, t.description];
  for (const a of t.assets) {
    out.push(a.name, a.description, a.hostingType, a.owner, ...a.elements.map((e) => e.name));
  }
  for (const a of t.activities) {
    out.push(a.name, a.description, a.purpose, a.retentionPeriod, ...a.dataSubjects, ...a.recipients, ...a.assetNames);
  }
  for (const f of t.flows) {
    out.push(f.name, f.description, f.frequency, f.sourceAssetName, f.destAssetName);
    if (f.returnFlow) {
      out.push(f.returnFlow.description);
      if (f.returnFlow.frequency) out.push(f.returnFlow.frequency);
    }
  }
  return out;
}

describe("industry templates in Spanish", () => {
  it("every user-visible string has a Spanish entry", () => {
    const missing = INDUSTRY_TEMPLATES.flatMap(visibleStrings).filter((s) => !(s in INDUSTRY_TEMPLATES_ES));
    expect([...new Set(missing)]).toEqual([]);
  });

  it("English stays unchanged", () => {
    for (const t of INDUSTRY_TEMPLATES) expect(localizeTemplate(t, "en")).toBe(t);
  });

  it("localized cross-references still resolve and asset names stay distinct", () => {
    for (const t of INDUSTRY_TEMPLATES.map((x) => localizeTemplate(x, "es"))) {
      const names = t.assets.map((a) => a.name);
      expect(new Set(names).size).toBe(names.length);
      for (const a of t.activities) for (const n of a.assetNames) expect(names).toContain(n);
      for (const f of t.flows) {
        expect(names).toContain(f.sourceAssetName);
        expect(names).toContain(f.destAssetName);
      }
    }
  });

  it("the Spanish text names no real company and has no long dash", () => {
    const all = [
      ...INDUSTRY_TEMPLATES.flatMap(visibleStrings),
      ...Object.values(INDUSTRY_TEMPLATES_ES),
    ].join("\n");
    expect(all).not.toMatch(/stripe|paypal|datadog|sentry/i);
    expect(all).not.toMatch(/[–—]/);
    expect(Object.values(INDUSTRY_TEMPLATES_ES).join("\n")).not.toMatch(/\busted(es)?\b|\bvosotros\b/i);
  });

  it("return flows are named in the screen's language", () => {
    expect(returnFlowName("A", "B", "en")).toBe("A to B");
    expect(returnFlowName("A", "B", "es")).toBe("De A a B");
  });
});
