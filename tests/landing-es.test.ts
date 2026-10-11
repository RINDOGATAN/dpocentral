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
 *   - customer logos render nothing while the configured list is empty; the
 *     draft list (11 Oct 2026) carries ten clean, sized files.
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, statSync } from "fs";
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
  // Owner, 10 Oct 2026: the generic welcome line is gone and the product summary is back
  // under the title; the sign-up card carries its own short line (hero.card).
  it("shows the product summary under the title, with no welcome or AI sentence", () => {
    const page = read("src/landing/components/StartupProductPage.tsx");
    expect(page).not.toContain('t("hero.ai")');
    expect(page).not.toContain('t("hero.welcome")');
    expect(page).toContain('{t("hero.subtitle")}');
    for (const d of [es, en]) expect(d["hero.welcome"]).toBeUndefined();
    expect(es["hero.card"]).toMatch(/Listo para volar en unos pocos minutos\.$/);
    expect(en["hero.card"]).toMatch(/Ready to fly in a few minutes\.$/);
  });

  // Owner, 11 Oct 2026: the subtitle no longer repeats the sign-up card's list of
  // modules; it introduces the setup wizard and says the program can be moved.
  it("introduces the setup wizard in both subtitles", () => {
    expect(en["hero.subtitle"]).toBe(
      "Use our setup wizard to put together a privacy program in minutes: select your industry and top vendors and let the magic happen. You can migrate it to other hosting alternatives or to an enterprise platform at any time.",
    );
    expect(es["hero.subtitle"]).toBe(
      "Usa nuestro asistente de configuración para montar un programa de protección de datos en unos pocos minutos: selecciona tu sector, tus proveedores principales y las decisiones clave. Podrás exportarlo a otra modalidad de alojamiento o a una plataforma de terceros cuando quieras.",
    );
    expect(es["hero.subtitle"]).not.toMatch(/startups|[—–]|\busted\b|vosotr/i);
    // The card keeps its own line, so the two no longer say the same thing.
    expect(en["hero.subtitle"]).not.toBe(en["hero.card"]);
    expect(es["hero.subtitle"]).not.toBe(es["hero.card"]);
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
    const order = ["Tres herramientas", "Descubre cómo", "Cinco etapas", "Adaptado a"].map((s) => html.indexOf(s));
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
  it("list the ten organizations, each with a clean file and a size", () => {
    expect(CUSTOMER_LOGOS).toHaveLength(10);
    for (const l of CUSTOMER_LOGOS) {
      const file = path.join(ROOT, "public", l.src);
      expect(existsSync(file), l.src).toBe(true);
      expect(statSync(file).size, l.src).toBeLessThan(20_000);
      if (l.src.endsWith(".svg")) expect(readFileSync(file, "utf8")).not.toMatch(/<script|href=|<image|<foreignObject|\son[a-z]+=/i);
      expect(l.width).toBeGreaterThan(0);
      expect(l.height).toBeGreaterThan(0);
    }
  });

  it("render nothing while the list is empty", () => {
    expect(renderToStaticMarkup(createElement(CustomerLogos, { label: es["es.logos.label"], logos: [] }))).toBe("");
  });

  it("render a labelled row with sized, lazy images", () => {
    const html = renderToStaticMarkup(createElement(CustomerLogos, { label: es["es.logos.label"] }));
    expect(html).toContain(es["es.logos.label"]);
    expect(html).toContain('alt="Toyota"');
    expect(html.match(/<img /g)).toHaveLength(10);
    expect(html.match(/loading="lazy"/g)).toHaveLength(10);
    expect(html.match(/width="\d+" height="\d+"/g)).toHaveLength(10);
  });
});
