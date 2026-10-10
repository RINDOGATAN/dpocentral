// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The English landing in the format of the Spanish one (October 2026):
 *
 *   - the same sections in the same order (the three tools, the videos, the
 *     five stages, the ways to host it), with English copy of its own under
 *     `en.*`, written for law firms and privacy professionals in the US;
 *   - five ways to host it, as on the English storefront (cloud, the kit,
 *     the Box, a managed instance, deployment and training on the
 *     customer's servers), and the note that the program can be taken away;
 *   - five videos from public/videos/en/, shown only once recorded: the
 *     section is left out while none is published, and `published` in
 *     src/landing/config/videos.ts must match the files on disk;
 *   - no price, no certification or customer logo, no EU-hosting claim, no
 *     long dash, US spelling.
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import LandingSections, { KIT_URL } from "@/landing/components/LandingSections";
import { LANDING_VIDEOS, type LandingLocale } from "@/landing/config/videos";

const ROOT = path.resolve(__dirname, "..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const en = JSON.parse(read("src/landing/i18n/en/dpo-startups.json")) as Record<string, string>;
const tEn = (k: string) => en[k] ?? k;

const render = (videos?: Parameters<typeof LandingSections>[0]["videos"]) =>
  renderToStaticMarkup(createElement(LandingSections, { t: tEn, locale: "en", ...(videos ? { videos } : {}) }));

const allPublished = LANDING_VIDEOS.en.map((v) => ({ ...v, published: true }));
const nonePublished = LANDING_VIDEOS.en.map((v) => ({ ...v, published: false }));

// What the English page shows, apart from the parts the older page kept.
const shown = Object.entries(en).filter(
  ([k]) => k.startsWith("en.") || k.startsWith("hero.") || k.startsWith("social.") || k.startsWith("cta.")
);

describe("English landing page", () => {
  it("passes the shared sections for both languages", () => {
    const page = read("src/landing/LandingPage.tsx");
    expect(page).toContain("<LandingSections t={t} locale={locale} />");
    expect(page).not.toContain('locale === "es" ? <');
  });
});

describe("English sections", () => {
  const html = render(allPublished);

  it("render the four sections in order, with every key translated", () => {
    const order = ["Three tools", "See how it", "Five stages", "You choose"].map((s) => html.indexOf(s));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).not.toMatch(/>en\.[a-z]/);
    expect(html).toContain("DPO Central at a glance");
  });

  it("show no price, certification, customer logo or EU-hosting claim", () => {
    for (const [k, v] of shown) {
      expect(v, k).not.toMatch(/\$|€|\bEUR\b|\bUSD\b|\/mo\b|per month|a year/i);
      expect(v, k).not.toMatch(/\bISO\b|\bSOC ?2?\b|certified|HIPAA/i);
      expect(v, k).not.toMatch(/\bEU[- ]hosted|hosted in the EU|EU cloud/i);
      expect(v, k).not.toMatch(/\bthe (first|only)\b|\b(leading|best|unrivaled|world-class|revolutionary)\b/i);
      expect(v, k).not.toMatch(/\bexecute\b/i);
    }
    expect(html).not.toMatch(/<img/);
  });

  it("use no long dash and US spelling", () => {
    for (const [k, v] of shown) {
      expect(v, k).not.toMatch(/[–—]|--/);
      expect(v, k).not.toMatch(/programme|organisation|catalogue/i);
    }
  });

  it("offer five ways, as on the English storefront", () => {
    const titles = [1, 2, 3, 4, 5].map((n) => en[`en.ways.w${n}.title`]);
    expect(titles).toEqual([
      "TODO.LAW cloud",
      "The self-install kit",
      "TODO.LAW hardware",
      "A managed instance",
      "Deployment and training on your servers",
    ]);
    expect(en["en.ways.w6.title"]).toBeUndefined();
    for (const t of titles) expect(html).toContain(t.replace("&", "&amp;"));
    expect(en["en.ways.label"]).toBe("Guarantees and hosting");
    expect(en["en.ways.heading.prefix"] + en["en.ways.heading.accent"]).toBe("You choose where it lives");
    expect(en["en.ways.sub"]).toMatch(/take your program with you at any time/);
  });

  it("ask by email for the Box, the managed instance and the deployment, and link the kit", () => {
    expect(html.match(/href="mailto:[^"]+"/g)).toHaveLength(3);
    expect(html).toContain(`href="${KIT_URL}"`);
  });

  it("play five videos only on request, with a poster, two formats and English captions", () => {
    const videos = html.match(/<video[\s\S]*?<\/video>/g) ?? [];
    expect(videos).toHaveLength(5);
    for (const v of videos) {
      expect(v).not.toMatch(/autoplay/i);
      expect(v).toMatch(/preload="none"/);
      expect(v).toMatch(/controls/);
      expect(v).toMatch(/poster="\/videos\/en\/[^"]+\.png"/);
      expect(v).toMatch(/<track[^>]*kind="captions"[^>]*srclang="en"/i);
      // Subtitles are burned into the picture: the track must be offered but never on by default.
      expect(v).not.toMatch(/<track[^>]*\sdefault/i);
      expect(v).not.toMatch(/\/videos\/es\//);
    }
    expect(LANDING_VIDEOS.en.map((v) => v.file)).toEqual([
      "01-inicio-rapido",
      "02-progreso",
      "03-documentos",
      "04-informe-ejecutivo",
      "05-eipd",
    ]);
    expect(en["en.videos.v1.title"]).toBe("Your program running in minutes");
    expect(en["en.videos.v5.title"]).toBe("Your DPIA, step by step");
  });

  it("leave the video section out while no English video is published", () => {
    const none = render(nonePublished);
    expect(none).not.toContain("See how it");
    expect(none).not.toMatch(/<video/);
    expect(none.indexOf("Three tools")).toBeLessThan(none.indexOf("Five stages"));
  });

  it("show a published video alone and keep its own title", () => {
    const one = render(LANDING_VIDEOS.en.map((v, i) => ({ ...v, published: i === 2 })));
    expect(one.match(/<video/g)).toHaveLength(1);
    expect(one).toContain("/videos/en/03-documentos.png");
    expect(one).toContain(en["en.videos.v3.title"]);
  });
});

describe("landing video configuration", () => {
  it("publishes a video exactly when its four files are in public/videos/<locale>/", () => {
    for (const locale of Object.keys(LANDING_VIDEOS) as LandingLocale[]) {
      for (const { file, published } of LANDING_VIDEOS[locale]) {
        const present = ["png", "webm", "mp4", "vtt"].every((ext) =>
          existsSync(path.join(ROOT, "public/videos", locale, `${file}.${ext}`))
        );
        expect(published, `${locale}/${file}`).toBe(present);
      }
    }
  });

  it("has a title and caption for every configured video, in its language", () => {
    const dicts: Record<LandingLocale, Record<string, string>> = {
      en,
      es: JSON.parse(read("src/landing/i18n/es/dpo-startups.json")),
    };
    for (const locale of Object.keys(LANDING_VIDEOS) as LandingLocale[]) {
      LANDING_VIDEOS[locale].forEach((_, i) => {
        expect(dicts[locale][`${locale}.videos.v${i + 1}.title`], `${locale} v${i + 1}`).toBeTruthy();
        expect(dicts[locale][`${locale}.videos.v${i + 1}.caption`], `${locale} v${i + 1}`).toBeTruthy();
      });
    }
  });
});
