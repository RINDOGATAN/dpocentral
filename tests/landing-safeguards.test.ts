// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The landing's safeguards guide, ported from the storefront (todolaw PR #59): the level
 * table of the owner's mockup (10 Oct 2026), every answer row and every level-to-way row,
 * in both markets, plus the copy rules and DPO Central's own product facts.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import {
  COPY,
  LADDER,
  QUESTIONS,
  WAY_INDEX,
  levelOf,
  meets,
  optionsFor,
  pickWay,
  recommend,
  requirementsOf,
  type Answers,
  type Locale,
} from "@/landing/content/safeguards";

const ROOT = path.resolve(__dirname, "..");
const dict = (l: Locale) =>
  JSON.parse(readFileSync(path.join(ROOT, `src/landing/i18n/${l}/dpo-startups.json`), "utf8")) as Record<string, string>;

const LOCALES: Locale[] = ["en", "es"];

/** Question, answer, minimum level: the mockup's first table. */
const ROWS: [keyof Answers, string, number][] = [
  ["loc", "any", 0],
  ["loc", "servers", 2],
  ["data", "test", 0],
  ["data", "real", 1],
  ["data", "special", 1],
  ["ai", "none", 0],
  ["ai", "ext", 0],
  ["ai", "key", 1],
  // Owner, 10 Oct 2026: the managed instance runs open-weight models, so level 1.
  ["ai", "local", 1],
  ["iso", "yes", 1],
  ["iso", "no", 0],
  ["it", "yes", 0],
  ["it", "no", 0],
  ["cert", "yes", 2],
  ["cert", "no", 0],
];

describe.each(LOCALES)("level table (%s)", (locale) => {
  it.each(ROWS)("%s = %s sets level %i", (q, v, level) => {
    expect(levelOf({ [q]: v }, locale)).toBe(level);
  });

  it("takes the highest level any answer asks for", () => {
    expect(levelOf({ data: "real", ai: "ext" }, locale)).toBe(1);
    expect(levelOf({ data: "real", cert: "yes" }, locale)).toBe(2);
    expect(levelOf({ iso: "no", it: "no", data: "test" }, locale)).toBe(0);
  });

  it("counts unanswered questions as the lightest answer", () => {
    expect(levelOf({}, locale)).toBe(0);
    expect(recommend({}, locale)).toBeNull();
  });

  it("level 0 leads to the cloud and level 1 to managed", () => {
    expect(pickWay({ loc: "any" }, locale)).toBe("cloud");
    expect(pickWay({ data: "real" }, locale)).toBe("managed");
    expect(pickWay({ ai: "key" }, locale)).toBe("managed");
    expect(pickWay({ iso: "yes" }, locale)).toBe("managed");
    expect(pickWay({ ai: "local" }, locale)).toBe("managed");
    expect(pickWay({ ai: "local", it: "no", data: "special" }, locale)).toBe("managed");
  });

  it("sends special-category or privileged data to managed", () => {
    expect(pickWay({ data: "special" }, locale)).toBe("managed");
  });

  it("has copy for every option it offers and a note for every way on the ladder", () => {
    const c = COPY[locale];
    for (const q of QUESTIONS) for (const o of optionsFor(q, locale)) expect(c.questions[q.id].options[o.value]).toBeTruthy();
    for (const w of LADDER[locale]) expect(c.summaries[w]).toBeTruthy();
    for (const w of LADDER[locale]) expect(c.names[w]).toBeTruthy();
    // Every requirement reachable in this market has a label and a note for every way it can be shown against.
    for (const q of QUESTIONS)
      for (const o of optionsFor(q, locale))
        for (const k of requirementsOf({ [q.id]: o.value }, locale)) {
          expect(c.safeguards[k]).toBeTruthy();
          for (const w of LADDER[locale]) expect(c.notes[k][w]).toBeTruthy();
        }
  });
});

describe("level 2 in Spain: three ways only", () => {
  it.each([
    [{ loc: "servers" }],
    [{ cert: "yes" }],
    [{ loc: "servers", it: "yes" }],
    [{ loc: "servers", ai: "local", it: "no" }],
  ] as Answers[][])("%o leads to the deployment", (a) => {
    expect(pickWay(a, "es")).toBe("deploy");
  });

  it("does not offer 'inside our office' and ignores it if it arrives", () => {
    const loc = QUESTIONS.find((q) => q.id === "loc")!;
    expect(optionsFor(loc, "es").map((o) => o.value)).toEqual(["any", "servers"]);
    expect(levelOf({ loc: "office" }, "es")).toBe(0);
    expect(requirementsOf({ loc: "office" }, "es")).toEqual([]);
  });

  it("never recommends or neighbours the kit or the Box", () => {
    const values = QUESTIONS.map((q) => optionsFor(q, "es").map((o) => o.value));
    // Every combination of answers (unanswered included).
    const combos = values.reduce<Answers[]>(
      (acc, opts, i) => acc.flatMap((a) => [a, ...opts.map((v) => ({ ...a, [QUESTIONS[i].id]: v }))]),
      [{}],
    );
    for (const a of combos) {
      const r = recommend(a, "es");
      if (!r) continue;
      expect(["cloud", "managed", "deploy"]).toContain(r.way);
      for (const n of [r.up, r.down]) if (n) expect(["cloud", "managed", "deploy"]).toContain(n.way);
    }
  });
});

describe("level 2 in English: five ways", () => {
  it("leads to the kit with an IT team", () => {
    expect(pickWay({ loc: "servers", it: "yes" }, "en")).toBe("kit");
    expect(pickWay({ cert: "yes", it: "yes" }, "en")).toBe("kit");
    expect(pickWay({ loc: "office", it: "yes" }, "en")).toBe("kit");
  });

  it("leads to the Box with no IT team and the office or local models only", () => {
    expect(levelOf({ loc: "office" }, "en")).toBe(2);
    expect(pickWay({ loc: "office", it: "no" }, "en")).toBe("box");
    // Local models alone now ask only for managed; with the own servers (level 2), still the Box.
    expect(pickWay({ ai: "local", it: "no" }, "en")).toBe("managed");
    expect(pickWay({ loc: "servers", ai: "local", it: "no" }, "en")).toBe("box");
  });

  it("leads to the deployment with no IT team otherwise, or when the IT question is unanswered", () => {
    expect(pickWay({ loc: "servers", it: "no" }, "en")).toBe("deploy");
    expect(pickWay({ cert: "yes", it: "no" }, "en")).toBe("deploy");
    expect(pickWay({ loc: "servers" }, "en")).toBe("deploy");
    expect(pickWay({ loc: "office" }, "en")).toBe("deploy");
  });

  it("lists the safeguards each neighbour would not meet", () => {
    const r = recommend({ loc: "servers", it: "no", data: "real" }, "en")!;
    expect(r.way).toBe("deploy");
    expect(r.checks.every((c) => c.met)).toBe(true);
    expect(r.up).toEqual({ way: "box", missing: [] });
    expect(r.down).toEqual({ way: "kit", missing: ["it:no"] });
    const cloud = recommend({ loc: "any" }, "en")!;
    expect(cloud.down).toBeNull();
    expect(cloud.up?.way).toBe("managed");
    expect(recommend({ loc: "office", it: "no" }, "en")!.up).toBeNull();
  });
});

describe("copy rules", () => {
  const all = (locale: Locale) => JSON.stringify(COPY[locale]);

  it("states no prices, no long dashes and no certification marks", () => {
    for (const l of LOCALES) {
      expect(all(l)).not.toMatch(/[$€]|\d{3}\s?(USD|EUR)|—|–|SOC\s?2|®|™/);
      expect(all(l)).not.toMatch(/guarantee|garantizamos/i);
    }
  });

  it("Spanish has no kit, TODO.LAW Box or Docker, no 'ejecut', and uses tú", () => {
    const es = all("es");
    // "Tu propio hardware" (the customer's own equipment) is allowed; the TODO.LAW Box is not.
    expect(es).not.toMatch(/\bkit\b|TODO\.LAW hardware|Hardware TODO\.LAW|Law-Firm-in-a-Box|\bBox\b|Docker|Instalador local|ejecut/i);
    expect(es).not.toMatch(/\busted(es)?\b|vosotros|\bvuestr/i);
  });

  it("managed: hosted in Asturias, open-weight models on the instance; the cloud states pilot, shared, no certification", () => {
    // Owner's wording of 10 Oct 2026, identical on the storefront and AI Sentinel.
    expect(COPY.en.summaries.managed).toBe(
      "An isolated instance we run for your organization alone, hosted in Asturias, Spain. Your records stay on that instance. AI features stay off until you turn them on, and can use open-weight models hosted on the instance itself, so the text does not leave it, or your own provider key."
    );
    expect(COPY.es.summaries.managed).toBe(
      "Una instancia aislada que operamos nosotros, solo para tu organización, alojada en Asturias (España). Tus registros se quedan en esa instancia. Las funciones de IA están desactivadas hasta que las activas, y pueden usar modelos de pesos abiertos alojados en la propia instancia, de modo que el texto no sale de ella, o la clave de tu propio proveedor."
    );
    for (const l of LOCALES) {
      expect(meets("managed", "ai:local")).toBe(true);
      expect(COPY[l].whyP).toMatch(/managed instance|instancia gestionada/);
    }
    // No unqualified "your data stays" where AI could send text out.
    for (const l of LOCALES) expect(all(l)).not.toMatch(/Your data stays on (that instance|your servers|your hardware)|Tus datos se quedan/);
    expect(COPY.en.summaries.cloud).toMatch(/capped pilot[\s\S]*test records[\s\S]*shared[\s\S]*no service level or independent certification/);
    expect(COPY.es.summaries.cloud).toMatch(/piloto[\s\S]*con límites[\s\S]*registros de prueba[\s\S]*comparte[\s\S]*certificación independiente/);
  });

  it("says the cloud is hosted in the EU, and that its AI provider may be outside it", () => {
    // Database in Frankfurt, functions in fra1 (vercel.json, PR #96): the storefront's
    // "served from the United States" is not true here.
    expect(JSON.parse(readFileSync(path.join(ROOT, "vercel.json"), "utf8")).regions).toEqual(["fra1"]);
    for (const l of LOCALES) expect(all(l)).not.toMatch(/United States|Estados Unidos|\bUS\b|\bEE\.? ?UU\.?\b/);
    expect(COPY.en.summaries.cloud).toMatch(/^Hosted by us in the EU\./);
    expect(COPY.en.summaries.cloud).toMatch(/go to the external AI provider set up on the service, which may be outside the EU\.$/);
    expect(COPY.es.summaries.cloud).toMatch(/^Lo alojamos nosotros, en la UE\./);
    expect(COPY.es.summaries.cloud).toMatch(
      /Si activas las funciones de IA, los datos del registro que se redacta van al proveedor de IA externo configurado en el servicio, que puede estar fuera de la UE\.$/
    );
    // The EU claim is the cloud's alone: no other way's summary says it.
    for (const l of LOCALES)
      for (const [w, s] of Object.entries(COPY[l].summaries)) if (w !== "cloud") expect(s).not.toMatch(/hosted in the EU|alojad[oa] en la UE|en la UE\./);
  });

  it("names each Spanish way as its box does, and keeps the deployment true to that box", () => {
    const es = dict("es");
    for (const [w, i] of Object.entries(WAY_INDEX.es)) expect(COPY.es.names[w as keyof typeof COPY.es.names]).toBe(es[`es.ways.w${i! + 1}.title`]);
    // The box: installed on the organization's equipment, data stays on its premises.
    expect(es["es.ways.w3.desc"]).toMatch(/equipo de tu organización[\s\S]*no salen de tus instalaciones/);
    expect(COPY.es.summaries.deploy).toMatch(/lo instalamos en un equipo de tu organización/);
    expect(COPY.es.summaries.deploy).toMatch(/se quedan en tus instalaciones/);
    expect(COPY.es.summaries.deploy).not.toMatch(/servidores/);
    expect(es["es.ways.label"]).toBe("Garantías y alojamiento");
  });

  it("says what DPO Central's AI features send: the record being drafted, never 'selected text'", () => {
    for (const l of LOCALES) expect(all(l)).not.toMatch(/selected text|texto seleccionado/i);
    expect(COPY.en.whyP).toMatch(/off until an administrator turns them on/);
    expect(COPY.es.whyP).toMatch(/desactivadas hasta que un administrador las activa/);
    // The facts behind it: posture defaults to off, only an org admin sets it, and every
    // AI call passes the posture gate first.
    const schema = readFileSync(path.join(ROOT, "prisma/schema.prisma"), "utf8");
    expect(schema).toMatch(/posture\s+AiPosture\s+@default\(off\)/);
    expect(readFileSync(path.join(ROOT, "src/server/routers/privacy/ai.ts"), "utf8")).toMatch(/setPosture:\s*adminOrgProcedure/);
    expect(readFileSync(path.join(ROOT, "src/server/services/ai/posture.ts"), "utf8")).toMatch(/posture === "off"\) \{\s*throw/);
  });

  it("names each English way as its box does, and maps every way to a box", () => {
    const en = dict("en");
    for (const [w, i] of Object.entries(WAY_INDEX.en)) expect(COPY.en.names[w as keyof typeof COPY.en.names]).toBe(en[`en.ways.w${i! + 1}.title`]);
    for (const l of LOCALES) expect(Object.keys(WAY_INDEX[l]).sort()).toEqual([...LADDER[l]].sort());
    expect(Object.values(WAY_INDEX.es).sort()).toEqual([0, 1, 2]);
  });

  it("leaves the classifier sentence out of the panel", () => {
    for (const l of LOCALES) expect(COPY[l].whyP).not.toMatch(/classifier|clasificador/i);
    expect(COPY.en.whyP).toMatch(/on TODO\.LAW hardware/);
    expect(COPY.en.whyP).not.toMatch(/the Box/);
    expect(COPY.es.whyP).not.toMatch(/Box/);
  });

  it("English uses US spelling", () => {
    expect(all("en")).not.toMatch(/organisation|licence|colour|programme|centre|catalogue|neighbour/);
  });

  it("keeps ISO 27001 as the example in question 6, in both languages", () => {
    expect(COPY.en.questions.cert.label).toMatch(/for example ISO 27001/);
    expect(COPY.es.questions.cert.label).toMatch(/por ejemplo, ISO 27001/);
  });
});
