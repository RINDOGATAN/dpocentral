// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The landing's middle, the same sections in both languages: the three
 * tools and how they connect, the short videos, the five stages of the
 * program, and the ways to host it. The Spanish page then shows the
 * customer logos (only when the configured list is not empty); the English
 * page shows none. No prices.
 *
 * Each language has its own copy under `<locale>.*` in the landing
 * dictionary, and its own list of ways: three in Spanish, five in English
 * (as on the English storefront). The videos come from
 * src/landing/config/videos.ts; a video that is not published there shows
 * no card, and with none published the section is left out.
 *
 * Motion is the page's existing fade-up on scroll, run under
 * MotionConfig reducedMotion="user": with reduced motion asked for, nothing
 * moves. The videos never play on their own and load nothing until asked.
 */

import { MotionConfig, motion } from "framer-motion";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bot,
  Check,
  Cloud,
  Compass,
  Database,
  ExternalLink,
  GraduationCap,
  HardDrive,
  Mail,
  Package,
  Scale,
  Server,
  ShieldCheck,
  Siren,
  Store,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { brand } from "@/config/brand";
import { LANDING_VIDEOS, type LandingLocale, type LandingVideo } from "../config/videos";
import CustomerLogos from "./CustomerLogos";

type T = (key: string) => string;

/** The public kit that installs the suite with Docker. */
export const KIT_URL = "https://github.com/RINDOGATAN/todolaw-suite";

type WayAction = "none" | "mail" | "link";

interface Way {
  icon: LucideIcon;
  action: WayAction;
  href?: string;
}

interface LocaleSetup {
  bullets: { ais: number; dpc: number; vw: number };
  ways: Way[];
  captionsLang: string;
  logos: boolean;
}

const SETUP: Record<LandingLocale, LocaleSetup> = {
  es: {
    bullets: { ais: 4, dpc: 5, vw: 3 },
    ways: [
      { icon: Cloud, action: "none" },
      { icon: Server, action: "mail" },
      { icon: HardDrive, action: "mail" },
    ],
    captionsLang: "es",
    logos: true,
  },
  en: {
    bullets: { ais: 4, dpc: 5, vw: 3 },
    ways: [
      { icon: Cloud, action: "none" },
      { icon: Package, action: "link", href: KIT_URL },
      { icon: HardDrive, action: "mail" },
      { icon: Server, action: "mail" },
      { icon: GraduationCap, action: "mail" },
    ],
    captionsLang: "en",
    // No customer logos on the English page.
    logos: false,
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

const reveal = (i = 0) => ({
  custom: i,
  initial: "hidden" as const,
  whileInView: "visible" as const,
  viewport: { once: true, margin: "-40px" },
  variants: fadeUp,
});

/**
 * Card widths for a centred, wrapping row (gap-6 = 1.5rem): three cards sit
 * three across from `md`; any other count goes two across from `md` and
 * three across from `lg`, the last row centred.
 */
function cardWidth(count: number): string {
  return count === 3
    ? "w-full md:w-[calc((100%-3rem)/3)]"
    : "w-full md:w-[calc((100%-1.5rem)/2)] lg:w-[calc((100%-3rem)/3)]";
}

function SectionHead({ t, k, sub = true }: { t: T; k: string; sub?: boolean }) {
  return (
    <div className="max-w-3xl mx-auto text-center mb-12 md:mb-16">
      <span className="section-label">{t(`${k}.label`)}</span>
      <h2 id={`${k}-heading`} className="text-2xl md:text-4xl mt-2 mb-4">
        {t(`${k}.heading.prefix`)}
        <span className="text-accent">{t(`${k}.heading.accent`)}</span>
      </h2>
      {sub && <p className="text-base md:text-lg text-muted-foreground leading-relaxed font-body">{t(`${k}.sub`)}</p>}
    </div>
  );
}

/* ── a. The three tools ─────────────────────────────────────────────── */

interface Tool {
  key: string;
  icon: LucideIcon;
  bullets: number;
  hub?: boolean;
}

function ToolPanel({ t, tool, i }: { t: T; tool: Tool; i: number }) {
  const Icon = tool.icon;
  return (
    <motion.article
      {...reveal(i)}
      className={
        "relative h-full rounded-2xl border p-6 md:p-7 flex flex-col " +
        (tool.hub
          ? "bg-card border-accent/60 shadow-[0_0_0_1px_rgba(83,174,204,0.25),0_20px_60px_-20px_rgba(83,174,204,0.45)]"
          : "bg-card border-border")
      }
    >
      {tool.hub && (
        <div aria-hidden="true" className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 h-32 w-48 rounded-full bg-accent/15 blur-3xl" />
      )}
      <div className="relative flex items-center gap-3 mb-4">
        <div className={"w-11 h-11 rounded-xl flex items-center justify-center " + (tool.hub ? "bg-accent text-[#1a1a1a]" : "bg-accent/10 text-accent")}>
          <Icon className="w-5 h-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <span className="block text-[11px] uppercase tracking-wider text-muted-foreground font-medium font-body">
            {t(`${tool.key}.tag`)}
          </span>
          <h3 className="text-xl font-display leading-tight">{t(`${tool.key}.name`)}</h3>
        </div>
      </div>
      <p className="relative text-sm text-foreground/85 leading-relaxed font-body mb-5">{t(`${tool.key}.desc`)}</p>
      <ul className="relative space-y-2.5 mt-auto">
        {Array.from({ length: tool.bullets }, (_, n) => (
          <li key={n} className="flex items-start gap-2.5 text-sm font-body text-muted-foreground">
            <Check className="w-4 h-4 mt-0.5 text-accent flex-shrink-0" aria-hidden="true" />
            <span>{t(`${tool.key}.b${n + 1}`)}</span>
          </li>
        ))}
      </ul>
    </motion.article>
  );
}

/**
 * The link between a satellite tool and DPO Central: vertical on a phone
 * (the panels stack), horizontal from the `lg` breakpoint. `toward` is the
 * side DPO Central sits on in the wide layout.
 */
function Connector({ t, labelKey, toward, i }: { t: T; labelKey: string; toward: "left" | "right"; i: number }) {
  const Wide = toward === "right" ? ArrowRight : ArrowLeft;
  const Narrow = toward === "right" ? ArrowDown : ArrowUp;
  return (
    <motion.div {...reveal(i)} className="flex lg:flex-col items-center justify-center gap-3 py-3 lg:py-0 lg:px-1">
      {/* the line */}
      <div className="flex lg:w-full flex-col lg:flex-row items-center" aria-hidden="true">
        <span className="block w-px h-6 lg:h-px lg:w-full lg:flex-1 bg-gradient-to-b lg:bg-gradient-to-r from-accent/10 via-accent/70 to-accent/10" />
        <span className="flex items-center justify-center w-8 h-8 rounded-full border border-accent/50 bg-[#1a1a1a] text-accent my-1 lg:my-0 lg:mx-1">
          <Narrow className="w-4 h-4 lg:hidden" />
          <Wide className="w-4 h-4 hidden lg:block" />
        </span>
        <span className="block w-px h-6 lg:h-px lg:w-full lg:flex-1 bg-gradient-to-b lg:bg-gradient-to-r from-accent/10 via-accent/70 to-accent/10" />
      </div>
      <span className="max-w-[14rem] lg:max-w-none text-xs leading-snug text-accent/90 font-body font-medium lg:text-center">
        {t(labelKey)}
      </span>
    </motion.div>
  );
}

function Suite({ t, p, setup }: { t: T; p: LandingLocale; setup: LocaleSetup }) {
  const k = `${p}.suite`;
  const tool = (id: "ais" | "dpc" | "vw", icon: LucideIcon, hub = false): Tool => ({
    key: `${k}.${id}`,
    icon,
    bullets: setup.bullets[id],
    hub,
  });
  return (
    <section className="py-20 md:py-28 bg-secondary/20 border-y border-border" aria-labelledby={`${k}-heading`}>
      <div className="container px-6">
        <SectionHead t={t} k={k} />
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_7.5rem_minmax(0,1.12fr)_7.5rem_minmax(0,1fr)] items-stretch">
          <ToolPanel t={t} tool={tool("ais", Bot)} i={0} />
          <Connector t={t} labelKey={`${k}.link.ais`} toward="right" i={1} />
          <ToolPanel t={t} tool={tool("dpc", ShieldCheck, true)} i={1} />
          <Connector t={t} labelKey={`${k}.link.vw`} toward="left" i={2} />
          <ToolPanel t={t} tool={tool("vw", Store)} i={2} />
        </div>
      </div>
    </section>
  );
}

/* ── b. Videos ──────────────────────────────────────────────────────── */

function Videos({ t, p, setup, videos }: { t: T; p: LandingLocale; setup: LocaleSetup; videos: readonly LandingVideo[] }) {
  const k = `${p}.videos`;
  // n follows the position in the configured list, published or not, so a
  // card keeps its title and caption keys while its neighbours are pending.
  const cards = videos.map((v, i) => ({ ...v, n: i + 1 })).filter((v) => v.published);
  if (cards.length === 0) return null;
  const width = cardWidth(cards.length);
  return (
    <section className="py-20 md:py-28" aria-labelledby={`${k}-heading`}>
      <div className="container px-6">
        <SectionHead t={t} k={k} />
        <div className="flex flex-wrap justify-center gap-6 max-w-6xl mx-auto">
          {cards.map(({ file, n }, i) => {
            const base = `/videos/${p}/${file}`;
            const captionId = `${p}-video-${n}-caption`;
            return (
              <motion.figure key={file} {...reveal(i)} className={`${width} rounded-2xl border border-border bg-card overflow-hidden flex flex-col`}>
                <video
                  className="block w-full aspect-video bg-black"
                  controls
                  muted
                  playsInline
                  preload="none"
                  poster={`${base}.png`}
                  aria-label={t(`${k}.v${n}.title`)}
                  aria-describedby={captionId}
                >
                  <source src={`${base}.webm`} type="video/webm" />
                  <source src={`${base}.mp4`} type="video/mp4" />
                  <track kind="captions" srcLang={setup.captionsLang} label={t(`${k}.captions`)} src={`${base}.vtt`} default />
                </video>
                <figcaption id={captionId} className="p-5">
                  <span className="block text-base font-display mb-1">{t(`${k}.v${n}.title`)}</span>
                  <span className="block text-sm text-muted-foreground font-body leading-relaxed">{t(`${k}.v${n}.caption`)}</span>
                </figcaption>
              </motion.figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ── c. The five stages ─────────────────────────────────────────────── */

const STAGE_ICONS: LucideIcon[] = [Compass, Database, Scale, Users, Siren];

function Stages({ t, p }: { t: T; p: LandingLocale }) {
  const k = `${p}.stages`;
  return (
    <section className="py-20 md:py-28 bg-secondary/20 border-y border-border" aria-labelledby={`${k}-heading`}>
      <div className="container px-6">
        <SectionHead t={t} k={k} />
        <div className="relative max-w-6xl mx-auto">
          {/* the path that joins the stages */}
          <div aria-hidden="true" className="hidden lg:block absolute top-7 left-[10%] right-[10%] h-px bg-gradient-to-r from-accent/20 via-accent/70 to-accent/20" />
          <div aria-hidden="true" className="lg:hidden absolute top-7 bottom-7 left-7 w-px bg-gradient-to-b from-accent/20 via-accent/70 to-accent/20" />
          <ol className="relative grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-4">
            {STAGE_ICONS.map((Icon, i) => {
              const n = i + 1;
              return (
                <motion.li key={n} {...reveal(i)} className="flex lg:flex-col items-start lg:items-center gap-4 lg:text-center">
                  <div className="relative flex-shrink-0 w-14 h-14 rounded-full border border-accent/60 bg-[#1a1a1a] flex items-center justify-center text-accent">
                    <Icon className="w-6 h-6" aria-hidden="true" />
                    <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-accent text-[#1a1a1a] text-xs font-display flex items-center justify-center" aria-hidden="true">
                      {n}
                    </span>
                  </div>
                  <div className="paper-card flex-1 lg:w-full !p-5">
                    <span className="block text-[11px] uppercase tracking-wider text-muted-foreground font-medium font-body mb-1">
                      {t(`${k}.stage`)} {n}
                    </span>
                    <h3 className="text-base font-display mb-2 leading-snug">{t(`${k}.s${n}.title`)}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed font-body">{t(`${k}.s${n}.desc`)}</p>
                  </div>
                </motion.li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ── d. Where it is hosted ──────────────────────────────────────────── */

const LETTERS = "abcdefghij";

const linkClass =
  "mt-auto inline-flex items-center gap-2 self-start text-sm font-medium text-accent hover:text-foreground transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-card";

function Ways({ t, p, setup }: { t: T; p: LandingLocale; setup: LocaleSetup }) {
  const k = `${p}.ways`;
  const width = cardWidth(setup.ways.length);
  return (
    <section className="py-20 md:py-28" aria-labelledby={`${k}-heading`}>
      <div className="container px-6">
        <SectionHead t={t} k={k} />
        <div className="flex flex-wrap justify-center gap-6 max-w-6xl mx-auto">
          {setup.ways.map(({ icon: Icon, action, href }, i) => {
            const n = i + 1;
            const letter = LETTERS[i];
            const title = t(`${k}.w${n}.title`);
            return (
              <motion.article key={letter} {...reveal(i)} className={`${width} paper-card flex flex-col`}>
                <div className="flex items-center justify-between mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-accent/10 text-accent flex items-center justify-center">
                    <Icon className="w-6 h-6" aria-hidden="true" />
                  </div>
                  <span className="text-3xl font-display text-muted-foreground" aria-hidden="true">{letter}</span>
                </div>
                <h3 className="text-lg font-display mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed font-body mb-5">{t(`${k}.w${n}.desc`)}</p>
                {action === "mail" && (
                  <a
                    href={`mailto:${brand.supportEmail}?subject=${encodeURIComponent(t(`${k}.w${n}.subject`))}`}
                    className={linkClass}
                  >
                    <Mail className="w-4 h-4" aria-hidden="true" />
                    {t(`${k}.request`)}
                    <span className="sr-only">: {title}</span>
                  </a>
                )}
                {action === "link" && href && (
                  <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
                    <ExternalLink className="w-4 h-4" aria-hidden="true" />
                    {t(`${k}.w${n}.link`)}
                    <span className="sr-only">: {title}</span>
                  </a>
                )}
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

interface LandingSectionsProps {
  t: T;
  locale: LandingLocale;
  /** For tests; the page uses the configured list. */
  videos?: readonly LandingVideo[];
}

export default function LandingSections({ t, locale, videos = LANDING_VIDEOS[locale] }: LandingSectionsProps) {
  const setup = SETUP[locale];
  return (
    <MotionConfig reducedMotion="user">
      <Suite t={t} p={locale} setup={setup} />
      <Videos t={t} p={locale} setup={setup} videos={videos} />
      <Stages t={t} p={locale} />
      <Ways t={t} p={locale} setup={setup} />
      {setup.logos && <CustomerLogos t={t} />}
    </MotionConfig>
  );
}
