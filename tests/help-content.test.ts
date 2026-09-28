// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The in-place help is a product feature: every page a person can reach must
 * open help, and every piece of help content must exist in both English and
 * Castilian Spanish. These tests guard that, and that the glossary and the
 * three guides never gain a term that only exists in one language.
 */

import { describe, expect, it } from "vitest";
import { DPO_CENTRAL_PATH } from "@/components/guided/path-config";
import { helpForPath, HELP_ROUTES, PAGE_HELP } from "@/config/help/pages";
import { GLOSSARY, glossaryTerm } from "@/config/help/glossary";
import { GUIDES } from "@/config/help/guides";
import { HELP_GUIDES } from "@/config/help/guide-links";
import type { Localized } from "@/config/help/localized";
import {
  parseIntroCookie,
  shouldShowIntro,
} from "@/lib/help-intro";

/** A localized value carries a non-empty string in both languages. */
function expectLocalized(value: Localized, where: string) {
  expect(value.en?.trim(), `${where}: missing en`).toBeTruthy();
  expect(value.es?.trim(), `${where}: missing es`).toBeTruthy();
}

/** Every place a person can navigate to on the path, plus the fixed entries. */
const NAV_HREFS: string[] = [
  "/privacy",
  "/privacy/clients",
  ...DPO_CENTRAL_PATH.stages.flatMap((stage) =>
    stage.steps.map((step) => step.href).filter((href): href is string => Boolean(href)),
  ),
  ...DPO_CENTRAL_PATH.library({ stripeEnabled: true, clientMode: true }).map((item) => item.href),
];

describe("every dashboard route a person can reach opens help", () => {
  for (const href of NAV_HREFS) {
    it(`${href} resolves to a help entry`, () => {
      expect(helpForPath(href), `no help for ${href}`).not.toBeNull();
    });
  }
});

describe("the page help registry is well formed", () => {
  it("every entry is bilingual", () => {
    for (const entry of PAGE_HELP) {
      expectLocalized(entry.title, `${entry.route}.title`);
      expectLocalized(entry.purpose, `${entry.route}.purpose`);
      expectLocalized(entry.firstStep, `${entry.route}.firstStep`);
      for (const doc of entry.docs) expectLocalized(doc.label, `${entry.route}.doc`);
      for (const link of entry.official) expectLocalized(link.label, `${entry.route}.official`);
    }
  });

  it("every term an entry names exists in the glossary", () => {
    for (const entry of PAGE_HELP) {
      for (const id of entry.terms) {
        expect(glossaryTerm(id), `${entry.route}: unknown term "${id}"`).toBeTruthy();
      }
    }
  });

  it("has no duplicate routes", () => {
    const seen = new Set<string>();
    for (const route of HELP_ROUTES) {
      expect(seen.has(route), `duplicate route ${route}`).toBe(false);
      seen.add(route);
    }
  });

  it("the root never swallows a child route", () => {
    // A section route resolves to itself, not to the dashboard.
    expect(helpForPath("/privacy/vendors")?.route).toBe("/privacy/vendors");
    expect(helpForPath("/privacy/vendors/abc123")?.route).toBe("/privacy/vendors");
    expect(helpForPath("/privacy")?.route).toBe("/privacy");
  });

  it("returns null outside the privacy area", () => {
    expect(helpForPath("/admin")).toBeNull();
    expect(helpForPath("/sign-in")).toBeNull();
  });
});

describe("the glossary is bilingual and complete", () => {
  it("every term has a label and a meaning in both languages", () => {
    for (const term of GLOSSARY) {
      expectLocalized(term.label, `${term.id}.label`);
      expectLocalized(term.meaning, `${term.id}.meaning`);
    }
  });

  it("carries the terms the directive names", () => {
    const required = [
      "controller", "processor", "joint-controller", "lawful-basis",
      "legitimate-interest", "special-category-data", "dpia", "lia", "tia",
      "sccs", "adequacy", "rights-request", "breach", "seventy-two-hours",
      "sale-share",
    ];
    for (const id of required) {
      expect(glossaryTerm(id), `missing glossary term "${id}"`).toBeTruthy();
    }
  });
});

describe("the three guides are bilingual and linked", () => {
  it("there are exactly three guides", () => {
    expect(GUIDES).toHaveLength(3);
    expect(HELP_GUIDES).toHaveLength(3);
  });

  it("every guide link resolves to a guide", () => {
    const slugs = new Set(GUIDES.map((g) => g.slug));
    for (const link of HELP_GUIDES) {
      const slug = link.href.split("/").pop()!;
      expect(slugs.has(slug as never), `link ${link.href} has no guide`).toBe(true);
    }
  });

  it("every guide is bilingual through its content", () => {
    for (const guide of GUIDES) {
      expectLocalized(guide.title, `${guide.slug}.title`);
      expectLocalized(guide.lead, `${guide.slug}.lead`);
      for (const section of guide.sections) {
        expectLocalized(section.heading, `${guide.slug}.heading`);
        if (section.intro) expectLocalized(section.intro, `${guide.slug}.intro`);
        for (const item of section.items ?? []) {
          expectLocalized(item.term, `${guide.slug}.item.term`);
          expectLocalized(item.body, `${guide.slug}.item.body`);
          if (item.example) expectLocalized(item.example, `${guide.slug}.item.example`);
        }
      }
      expect(guide.official.length, `${guide.slug} has no official link`).toBeGreaterThan(0);
    }
  });
});

describe("the intro cookie logic is pure and correct", () => {
  it("shows until dismissed", () => {
    expect(shouldShowIntro(null)).toBe(true);
    expect(shouldShowIntro("open")).toBe(true);
    expect(shouldShowIntro("dismissed")).toBe(false);
  });

  it("parses the cookie value", () => {
    expect(parseIntroCookie("dpc_intro=dismissed")).toBe("dismissed");
    expect(parseIntroCookie("a=1; dpc_intro=open; b=2")).toBe("open");
    expect(parseIntroCookie("other=1")).toBeNull();
    expect(parseIntroCookie(null)).toBeNull();
  });
});
