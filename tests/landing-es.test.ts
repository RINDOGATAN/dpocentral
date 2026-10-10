// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The public landing after the owner's review of October 2026:
 *
 *   - the header carries the designer logo (the shared BrandMark), not the
 *     improvised house-symbol lockup, and no "a TODO.LAW product" line;
 *   - the hero's left column shows the badge, the title and the welcome line
 *     only (the summary lives in the sign-up card);
 *   - the Spanish page replaces "How it works" and "Features" with its own
 *     sections (since the English landing of October 2026, both languages
 *     do; see tests/landing-en.test.ts);
 *   - the Spanish sections show no price, and the three videos ship with a
 *     poster, both formats and Spanish captions;
 *   - customer logos render nothing while the configured list is empty, and
 *     the list ships empty (logos only with written consent).
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CustomerLogos from "@/landing/components/CustomerLogos";
import LandingSections from "@/landing/components/LandingSections";
import { CUSTOMER_LOGOS } from "@/landing/config/customer-logos";

const ROOT = path.resolve(__dirname, "..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const es = JSON.parse(read("src/landing/i18n/es/dpo-startups.json")) as Record<string, string>;
const en = JSON.parse(read("src/landing/i18n/en/dpo-startups.json")) as Record<string, string>;
const tEs = (k: string) => es[k] ?? k;

describe("landing header logo", () => {
  it("uses the shared designer logo and no house-symbol lockup", () => {
    const header = read("src/landing/components/StartupsHeader.tsx");
    expect(header).toContain('from "@/components/brand-mark"');
    expect(header).not.toContain("DpoCentralLogo");
    expect(header).not.toContain("productOf");
    expect(existsSync(path.join(ROOT, "src/landing/components/DpoCentralLogo.tsx"))).toBe(false);
    expect(read("src/components/brand-mark.tsx")).toContain("/logo-negative.svg");
    expect(read("src/components/guided/guided-layout.tsx")).toContain('from "@/components/brand-mark"');
  });

  it("drops the product-of line from both bundles", () => {
    expect(es["header.productOf"]).toBeUndefined();
    expect(en["header.productOf"]).toBeUndefined();
  });
});

describe("landing hero", () => {
  it("shows no subtitle or AI sentence in the left column", () => {
    const page = read("src/landing/components/StartupProductPage.tsx");
    expect(page).not.toContain('t("hero.ai")');
    // hero.subtitle is used once: its first sentence, in the sign-up card.
    expect(page.match(/t\("hero\.subtitle"\)/g)).toHaveLength(1);
    expect(page).toContain('t("hero.subtitle").split(".")[0]');
  });

  it("says «sin papeleos.» in Spanish and keeps the English title", () => {
    expect(es["hero.title.accent"]).toBe("sin papeleos.");
    expect(en["hero.title.accent"]).toBe("without spreadsheets.");
  });
});

describe("Spanish sections", () => {
  const html = renderToStaticMarkup(createElement(LandingSections, { t: tEs, locale: "es" }));
  const esOnly = Object.entries(es).filter(([k]) => k.startsWith("es."));

  it("render the four sections in order, with every key translated", () => {
    const order = ["Tres herramientas", "Descubre cómo", "Cinco etapas", "Tú eliges"].map((s) => html.indexOf(s));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).not.toMatch(/>es\.[a-z]/);
  });

  it("show no price and no superlative", () => {
    for (const [k, v] of esOnly) {
      expect(v, k).not.toMatch(/\d+\s?€|€|\b149\b|\bEUR\b|\$/);
      expect(v, k).not.toMatch(/\b(primer[oa]?|únic[oa]s?|líder(es)?|mejor(es)?)\b/i);
    }
  });

  it("leave the rights-requests module out of the three tools", () => {
    const suite = esOnly.filter(([k]) => k.startsWith("es.suite."));
    for (const [k, v] of suite) expect(v, k).not.toMatch(/derechos|solicitudes/i);
  });

  it("play three videos only on request, with a poster, two formats and Spanish captions", () => {
    const videos = html.match(/<video[\s\S]*?<\/video>/g) ?? [];
    expect(videos).toHaveLength(3);
    for (const v of videos) {
      expect(v).not.toMatch(/autoplay/i);
      expect(v).toMatch(/preload="none"/);
      expect(v).toMatch(/muted/);
      expect(v).toMatch(/playsinline/i);
      expect(v).toMatch(/controls/);
      expect(v).toMatch(/poster="\/videos\/es\/[^"]+\.png"/);
      expect(v).toMatch(/<track[^>]*kind="captions"[^>]*srclang="es"/i);
      // Subtitles are burned into the picture: the track must be offered but never on by default.
      expect(v).not.toMatch(/<track[^>]*\sdefault/i);
    }
    for (const name of ["01-inicio-rapido", "02-progreso", "04-informe-ejecutivo"]) {
      for (const ext of ["mp4", "webm", "png", "vtt"]) {
        expect(existsSync(path.join(ROOT, "public/videos/es", `${name}.${ext}`)), `${name}.${ext}`).toBe(true);
      }
    }
  });

  it("offer a request link for the managed server and own hardware only", () => {
    expect(html.match(/href="mailto:[^"]+"/g)).toHaveLength(2);
  });
});

describe("customer logos", () => {
  it("ship with an empty list", () => {
    expect(CUSTOMER_LOGOS).toEqual([]);
  });

  it("render nothing while the list is empty", () => {
    expect(renderToStaticMarkup(createElement(CustomerLogos, { t: tEs }))).toBe("");
  });

  it("render a labelled row once a logo is configured", () => {
    const html = renderToStaticMarkup(
      createElement(CustomerLogos, { t: tEs, logos: [{ name: "Example", src: "/x.svg" }] })
    );
    expect(html).toContain('alt="Example"');
    expect(html).toContain(es["es.logos.label"]);
  });
});
