// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The Spanish landing's middle (locale es only; the English page keeps its
 * "How it works" and "Features" sections): the three tools and how they
 * connect, three short videos, the five stages of the program and the three
 * ways to run it, then the customer logos (shown only when the configured
 * list is not empty). No prices.
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
  HardDrive,
  Mail,
  Scale,
  Server,
  ShieldCheck,
  Siren,
  Store,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { brand } from "@/config/brand";
import CustomerLogos from "./CustomerLogos";

type T = (key: string) => string;

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

const TOOLS: Record<"ais" | "dpc" | "vw", Tool> = {
  ais: { key: "es.suite.ais", icon: Bot, bullets: 4 },
  dpc: { key: "es.suite.dpc", icon: ShieldCheck, bullets: 5, hub: true },
  vw: { key: "es.suite.vw", icon: Store, bullets: 3 },
};

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

function Suite({ t }: { t: T }) {
  return (
    <section className="py-20 md:py-28 bg-secondary/20 border-y border-border" aria-labelledby="es.suite-heading">
      <div className="container px-6">
        <SectionHead t={t} k="es.suite" />
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_7.5rem_minmax(0,1.12fr)_7.5rem_minmax(0,1fr)] items-stretch">
          <ToolPanel t={t} tool={TOOLS.ais} i={0} />
          <Connector t={t} labelKey="es.suite.link.ais" toward="right" i={1} />
          <ToolPanel t={t} tool={TOOLS.dpc} i={1} />
          <Connector t={t} labelKey="es.suite.link.vw" toward="left" i={2} />
          <ToolPanel t={t} tool={TOOLS.vw} i={2} />
        </div>
      </div>
    </section>
  );
}

/* ── b. Videos ──────────────────────────────────────────────────────── */

const VIDEOS = ["01-inicio-rapido", "02-progreso", "04-informe-ejecutivo"] as const;

function Videos({ t }: { t: T }) {
  return (
    <section className="py-20 md:py-28" aria-labelledby="es.videos-heading">
      <div className="container px-6">
        <SectionHead t={t} k="es.videos" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {VIDEOS.map((file, i) => {
            const n = i + 1;
            const base = `/videos/es/${file}`;
            const captionId = `es-video-${n}-caption`;
            return (
              <motion.figure key={file} {...reveal(i)} className="rounded-2xl border border-border bg-card overflow-hidden flex flex-col">
                <video
                  className="block w-full aspect-video bg-black"
                  controls
                  muted
                  playsInline
                  preload="none"
                  poster={`${base}.png`}
                  aria-label={t(`es.videos.v${n}.title`)}
                  aria-describedby={captionId}
                >
                  <source src={`${base}.webm`} type="video/webm" />
                  <source src={`${base}.mp4`} type="video/mp4" />
                  <track kind="captions" srcLang="es" label={t("es.videos.captions")} src={`${base}.vtt`} default />
                </video>
                <figcaption id={captionId} className="p-5">
                  <span className="block text-base font-display mb-1">{t(`es.videos.v${n}.title`)}</span>
                  <span className="block text-sm text-muted-foreground font-body leading-relaxed">{t(`es.videos.v${n}.caption`)}</span>
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

function Stages({ t }: { t: T }) {
  return (
    <section className="py-20 md:py-28 bg-secondary/20 border-y border-border" aria-labelledby="es.stages-heading">
      <div className="container px-6">
        <SectionHead t={t} k="es.stages" />
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
                      {t("es.stages.stage")} {n}
                    </span>
                    <h3 className="text-base font-display mb-2 leading-snug">{t(`es.stages.s${n}.title`)}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed font-body">{t(`es.stages.s${n}.desc`)}</p>
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

/* ── d. Where it runs ───────────────────────────────────────────────── */

const WAYS: Array<{ icon: LucideIcon; letter: string; request: boolean }> = [
  { icon: Cloud, letter: "a", request: false },
  { icon: Server, letter: "b", request: true },
  { icon: HardDrive, letter: "c", request: true },
];

function Ways({ t }: { t: T }) {
  return (
    <section className="py-20 md:py-28" aria-labelledby="es.ways-heading">
      <div className="container px-6">
        <SectionHead t={t} k="es.ways" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {WAYS.map(({ icon: Icon, letter, request }, i) => {
            const n = i + 1;
            const mailto = `mailto:${brand.supportEmail}?subject=${encodeURIComponent(t(`es.ways.w${n}.subject`))}`;
            return (
              <motion.article key={letter} {...reveal(i)} className="paper-card flex flex-col">
                <div className="flex items-center justify-between mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-accent/10 text-accent flex items-center justify-center">
                    <Icon className="w-6 h-6" aria-hidden="true" />
                  </div>
                  <span className="text-3xl font-display text-muted-foreground" aria-hidden="true">{letter}</span>
                </div>
                <h3 className="text-lg font-display mb-2">{t(`es.ways.w${n}.title`)}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed font-body mb-5">{t(`es.ways.w${n}.desc`)}</p>
                {request && (
                  <a
                    href={mailto}
                    className="mt-auto inline-flex items-center gap-2 self-start text-sm font-medium text-accent hover:text-foreground transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                  >
                    <Mail className="w-4 h-4" aria-hidden="true" />
                    {t("es.ways.request")}
                    <span className="sr-only">: {t(`es.ways.w${n}.title`)}</span>
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

export default function SpanishSections({ t }: { t: T }) {
  return (
    <MotionConfig reducedMotion="user">
      <Suite t={t} />
      <Videos t={t} />
      <Stages t={t} />
      <Ways t={t} />
      <CustomerLogos t={t} />
    </MotionConfig>
  );
}
