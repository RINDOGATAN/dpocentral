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
import LandingSections from "@/landing/components/LandingSections";
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
  ([k]) =>
    k.startsWith("en.") ||
    k.startsWith("hero.") ||
    k.startsWith("social.") ||
    k.startsWith("value.") ||
    k.startsWith("cta.")
);

describe("English copy, after the owner's review", () => {
  it("says one subscription covers the three tools", () => {
    expect(en["en.suite.heading.prefix"] + en["en.suite.heading.accent"]).toBe("Three tools, one subscription");
    expect(en["en.suite.sub"]).toMatch(/One subscription/);
    for (const tool of ["DPO Central", "AI Sentinel", "VendorWatch"]) expect(en["en.suite.sub"]).toContain(tool);
  });

  it("combines US law with GDPR in each of the four value cards", () => {
    for (const n of [1, 2, 3, 4]) {
      const desc = en[`value.v${n}.desc`];
      expect(desc, `v${n}`).toMatch(/CCPA|US state/);
      expect(desc, `v${n}`).toMatch(/\bGDPR\b/);
      expect(desc, `v${n}`).toMatch(/UK GDPR/);
    }
  });

  // The hosting intro is the owner's own line since 10 Oct 2026; no comparisons anywhere.
  // Owner, 11 Oct 2026: the hero subtitle says the program can be migrated "to an
  // enterprise platform" (a way out, not a comparison); only that phrase is allowed.
  it("positions DPO Central calmly and without comparisons", () => {
    for (const [k, v] of shown) {
      const text = k === "hero.subtitle" ? v.replace("or to an enterprise platform at any time", "") : v;
      expect(text, k).not.toMatch(/\benterprise\b|replace|instead of|unlike|cheaper|competitor/i);
    }
  });

  it("promises no heat maps in either language", () => {
    const es = JSON.parse(read("src/landing/i18n/es/dpo-startups.json")) as Record<string, string>;
    for (const [k, v] of [...Object.entries(en), ...Object.entries(es)]) {
      expect(v, k).not.toMatch(/heat ?maps?|mapas? de calor/i);
    }
  });

  it("uses US spelling in every English landing string", () => {
    for (const file of ["dpo-startups.json", "startups-auth.json"]) {
      const bundle = JSON.parse(read(`src/landing/i18n/en/${file}`)) as Record<string, string>;
      for (const [k, v] of Object.entries(bundle)) {
        expect(v, `${file} ${k}`).not.toMatch(/programme|organisation|catalogue|licence|colour|analyse/i);
      }
    }
  });
});

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
    const order = ["Three tools", "See how it", "Five stages", "Tailored to"].map((s) => html.indexOf(s));
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
    // The only images are the customer logos (draft, 11 Oct 2026), above the footer.
    expect((html.match(/<img /g) ?? []).length).toBe((html.match(/src="\/images\/clients\//g) ?? []).length);
    expect(html).toContain(">Trusted by</h2>");
  });

  it("use no long dash and US spelling", () => {
    for (const [k, v] of shown) {
      expect(v, k).not.toMatch(/[–—]|--/);
      expect(v, k).not.toMatch(/programme|organisation|catalogue/i);
    }
  });

  // Three ways, as on the English storefront since 10 Oct 2026 (owner): the kit and the Box
  // stay on the storefront's Run it your way page only.
  it("offer three ways, as on the English storefront", () => {
    const titles = [1, 2, 3].map((n) => en[`en.ways.w${n}.title`]);
    expect(titles).toEqual(["In the TODO.LAW cloud", "Managed virtual server", "Your own hardware"]);
    expect(en["en.ways.w4.title"]).toBeUndefined();
    expect(en["en.ways.sub"]).toBe("Three hosting options, with different safeguards, certifications and levels of control.");
    expect(html).not.toMatch(/self-install kit|TODO\.LAW hardware|Law-Firm-in-a-Box|github\.com\/RINDOGATAN\/todolaw-suite/);
    for (const t of titles) expect(html).toContain(t.replace("&", "&amp;"));
    expect(en["en.ways.label"]).toBe("Safeguards and hosting");
    expect(en["en.ways.heading.prefix"] + en["en.ways.heading.accent"]).toBe("Tailored to your needs");
    // Portability now sits on the cloud box (owner, 10 Oct 2026).
    expect(en["en.ways.w1.desc"]).toMatch(/take your program elsewhere whenever you like with a simple export/);
  });

  it("ask by email for the managed server and your own hardware", () => {
    expect(html.match(/href="mailto:[^"]+"/g)).toHaveLength(2);
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
