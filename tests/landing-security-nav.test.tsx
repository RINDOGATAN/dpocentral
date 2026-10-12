// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The landing's header carries "Security measures" / "Medidas de seguridad"
 * next to Pricing, to the same page as the footer's security link (the
 * footer keeps its link). The phone menu has the item too. The footer has no
 * link that only leads back to the storefront's home page.
 */

import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import StartupsHeader from "@/landing/components/StartupsHeader";
import StartupsFooter from "@/landing/components/StartupsFooter";
import EN from "@/landing/i18n/en/dpo-startups.json";
import ES from "@/landing/i18n/es/dpo-startups.json";

type L = "en" | "es";
const noop = () => {};
const header = (locale: L) =>
  renderToStaticMarkup(createElement(StartupsHeader, { t: (k: string) => k, locale, onLocaleToggle: noop, onSignup: noop }));
const footer = (locale: L) => renderToStaticMarkup(createElement(StartupsFooter, { t: (k: string) => k, locale }));
const SECURITY = "/security";

describe("security link in the landing header", () => {
  it.each(["en", "es"] as const)("%s: next to Pricing, to the footer's security page", (locale) => {
    const html = header(locale);
    const tag = html.match(/<a[^>]*data-testid="nav-security"[^>]*>([^<]*)<\/a>/);
    expect(tag?.[0]).toContain(`href="${SECURITY}"`);
    expect(tag?.[1]).toBe("header.security");
    expect(html.indexOf('data-testid="nav-pricing"')).toBeLessThan(html.indexOf('data-testid="nav-security"'));
    expect(footer(locale)).toContain(`href="${SECURITY}"`);
  });

  it("the phone menu has the item", () => {
    const src = readFileSync(join(process.cwd(), "src/landing/components/StartupsHeader.tsx"), "utf8");
    expect(src).toContain('data-testid="nav-security-phone"');
  });

  it("the labels, in both languages", () => {
    expect((EN as Record<string, string>)["header.security"]).toBe("Security measures");
    expect((ES as Record<string, string>)["header.security"]).toBe("Medidas de seguridad");
  });
});

describe("the footer", () => {
  it.each(["en", "es"] as const)("%s: no link that only leads to the storefront home", (locale) => {
    // The logo keeps leading to the storefront; the footer's link row does not.
    const html = footer(locale).match(/<nav[\s\S]*?<\/nav>/)?.[0] ?? "";
    expect(html).toContain("footer.security");
    expect(html).not.toMatch(/href="https:\/\/(www\.)?todo\.law\/?"/);
    expect(html).not.toContain("footer.forLawFirms");
  });
});
