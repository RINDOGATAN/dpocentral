// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The landing's safeguards guide, ported from the storefront (todolaw PR #59): the level
 * table of the mockup, every answer row and every level-to-way row,
 * in both locales, plus the copy rules and the AI facts the shared copy relies on.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import {
  HOSTING,
  hostingLine,
  COPY,
  LADDER,
  QUESTIONS,
  WAY_INDEX,
  WAY_NAMES,
  levelOf,
  meets,
  optionsFor,
  pickWay,
  recommend,
  requirementsOf,
  type Answers,
  type GuideWay,
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
  ["data", "real", 0],
  ["data", "special", 1],
  ["ai", "none", 0],
  ["ai", "ext", 0],
  ["ai", "key", 1],
  // The managed instance runs open-weight models, so level 1.
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
    expect(levelOf({ data: "real", ai: "ext" }, locale)).toBe(0);
    expect(levelOf({ data: "real", ai: "key" }, locale)).toBe(1);
    expect(levelOf({ data: "special", ai: "ext" }, locale)).toBe(1);
    expect(levelOf({ data: "real", cert: "yes" }, locale)).toBe(2);
    expect(levelOf({ iso: "no", it: "no", data: "test" }, locale)).toBe(0);
  });

  it("counts unanswered questions as the lightest answer", () => {
    expect(levelOf({}, locale)).toBe(0);
    expect(recommend({}, locale)).toBeNull();
  });

  it("level 0 leads to the cloud and level 1 to managed", () => {
    expect(pickWay({ loc: "any" }, locale)).toBe("cloud");
    expect(pickWay({ data: "real" }, locale)).toBe("cloud");
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
    for (const w of LADDER[locale]) expect(WAY_NAMES[locale][w as GuideWay]).toBeTruthy();
    // Every requirement reachable in this locale has a label and a note for every way it can be shown against.
    for (const q of QUESTIONS)
      for (const o of optionsFor(q, locale))
        for (const k of requirementsOf({ [q.id]: o.value }, locale)) {
          expect(c.safeguards[k]).toBeTruthy();
          for (const w of LADDER[locale]) expect(c.notes[k][w]).toBeTruthy();
        }
  });
});

describe("real client data: the cloud in both locales", () => {
  it("real data sets level 0 (cloud), special categories stay at level 1 (managed)", () => {
    for (const l of LOCALES) {
      expect(levelOf({ data: "real" }, l)).toBe(0);
      expect(pickWay({ data: "real" }, l)).toBe("cloud");
      expect(levelOf({ data: "special" }, l)).toBe(1);
      expect(pickWay({ data: "special" }, l)).toBe("managed");
    }
  });

  it("the cloud meets real data with the sub-processors note, and special categories stay unmet", () => {
    for (const l of LOCALES) {
      expect(meets("cloud", "data:real", l)).toBe(true);
      expect(meets("cloud", "data:special", l)).toBe(false);
      expect(recommend({ data: "real" }, l)!.checks).toEqual([{ key: "data:real", met: true }]);
      expect(recommend({ data: "special" }, l)!.down).toEqual({ way: "cloud", missing: ["data:special"] });
    }
    expect(COPY.en.notes["data:real"].cloud).toBe("Accepted: all our sub-processors have the necessary safeguards and certifications.");
    expect(COPY.es.notes["data:real"].cloud).toBe("Se admiten: todos nuestros subencargados cuentan con las certificaciones y garantías necesarias.");
    expect(COPY.es.notes["data:special"].cloud).toBe("Para estos datos, elige la instancia gestionada.");
  });

  it("question 1's first answer is the shared wording", () => {
    expect(COPY.en.questions.loc.options.any).toBe("We could use a SaaS, provided that all sub-processors have the necessary safeguards and certifications");
    expect(COPY.es.questions.loc.options.any).toBe("Pueden estar en nube siempre y cuando todos los subencargados cuenten con las certificaciones y garantías necesarias");
  });
});

describe("level 2 in Spanish (es): three ways only", () => {
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

// Three ways in English too: no kit or Box on the landing.
describe("level 2 in English: three ways, as in Spanish", () => {
  it("leads every strict answer to your own hardware, whatever the IT answer", () => {
    expect(levelOf({ loc: "office" }, "en")).toBe(2);
    for (const a of [{ loc: "servers", it: "yes" }, { loc: "servers", it: "no" }, { loc: "office", it: "no" }, { cert: "yes", it: "yes" }, { loc: "servers" }] as const) {
      expect(pickWay(a, "en")).toBe("deploy");
    }
    // Local models alone ask only for managed.
    expect(pickWay({ ai: "local", it: "no" }, "en")).toBe("managed");
    expect(LADDER.en).toEqual(["cloud", "managed", "deploy"]);
  });

  it("lists the safeguards each neighbour would not meet", () => {
    const r = recommend({ loc: "servers", it: "no", data: "real" }, "en")!;
    expect(r.way).toBe("deploy");
    expect(r.checks.every((c) => c.met)).toBe(true);
    expect(r.up).toBeNull();
    expect(r.down?.way).toBe("managed");
    const cloud = recommend({ loc: "any" }, "en")!;
    expect(cloud.down).toBeNull();
    expect(cloud.up?.way).toBe("managed");
  });
});

describe("copy rules", () => {
  const all = (locale: Locale) => JSON.stringify(COPY[locale]);

  it("states no prices, no long dashes and no certification marks", () => {
    for (const l of LOCALES) {
      const text = all(l);
      expect(text).not.toMatch(/[$€]|\d{3}\s?(USD|EUR)|—|–|SOC\s?2|®|™/);
      expect(all(l)).not.toMatch(/guarantee|garantizamos/i);
    }
  });

  it("Spanish has no kit, TODO.LAW Box or Docker, no 'ejecut', and uses tú", () => {
    const es = all("es");
    // "Tu propio hardware" (the customer's own equipment) is allowed; the TODO.LAW Box is not.
    expect(es).not.toMatch(/\bkit\b|TODO\.LAW hardware|Hardware TODO\.LAW|Law-Firm-in-a-Box|\bBox\b|Docker|Instalador local|ejecut/i);
    expect(es).not.toMatch(/\busted(es)?\b|vosotros|\bvuestr/i);
  });

  it("managed: hosted in Asturias, open-weight models on the instance; the cloud states pilot and shared, with no certification line", () => {
    // Same wording as on the storefront and AI Sentinel.
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
    expect(COPY.en.summaries.cloud).toMatch(/shared service[\s\S]*start free[\s\S]*real client data/);
    expect(COPY.es.summaries.cloud).toMatch(/servicio compartido[\s\S]*empezar gratis[\s\S]*datos reales/);
    for (const l of LOCALES) expect(all(l)).not.toMatch(/not for real client data|solo con datos de prueba|solo para registros de prueba/i);
    // No "no certification" line anywhere in the guide: we always have an answer.
    for (const l of LOCALES) expect(all(l)).not.toMatch(/independent certification|security certification|certificación independiente|certificación de seguridad/i);
    // No six-week engagement, training or runbook for your own hardware in English either.
    expect(all("en")).not.toMatch(/[Ss]ix weeks|train your people|runbook|\$15/);
  });

  it("names no hosting location for the cloud, and says in Spanish that its AI provider may be outside the EU", () => {
    for (const l of LOCALES) expect(all(l)).not.toMatch(/United States|Estados Unidos|\bUS\b|\bEE\.? ?UU\.?\b|Frankfurt|Fráncfort/);
    expect(all("en")).not.toMatch(/\bEU\b|Europe/);
    expect(COPY.en.summaries.cloud).toMatch(/^Hosted by us, on a shared service/);
    expect(COPY.en.summaries.cloud).toMatch(/go to the external AI provider set up on the service\.$/);
    expect(COPY.es.summaries.cloud).toMatch(
      /Si un administrador activa las funciones de IA, los datos del registro que se redacta van al proveedor de IA externo configurado en el servicio, que puede estar fuera de la UE\.$/
    );
  });

  it("names each Spanish way as its box does; no six-week engagement or training", () => {
    const es = dict("es");
    for (const [w, i] of Object.entries(WAY_INDEX.es)) expect(WAY_NAMES.es[w as keyof typeof WAY_NAMES.es]).toBe(es[`es.ways.w${i! + 1}.title`]);
    expect(COPY.es.summaries.deploy).toMatch(/^Instalado en tus propios servidores, con nuestra asistencia presencial o remota\./);
    expect(JSON.stringify(COPY.es)).not.toMatch(/[Ss]eis semanas|formamos|manual de operación|15\.000/);
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
    for (const [w, i] of Object.entries(WAY_INDEX.en)) expect(WAY_NAMES.en[w as keyof typeof WAY_NAMES.en]).toBe(en[`en.ways.w${i! + 1}.title`]);
    for (const l of LOCALES) expect(Object.keys(WAY_INDEX[l]).sort()).toEqual([...LADDER[l]].sort());
    expect(Object.values(WAY_INDEX.es).sort()).toEqual([0, 1, 2]);
  });

  it("leaves the classifier sentence out of the panel", () => {
    for (const l of LOCALES) expect(COPY[l].whyP).not.toMatch(/classifier|clasificador/i);
    expect(COPY.en.whyP).toMatch(/on your own servers/);
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

describe("the cloud's hosting line", () => {
  it("names EU hosting in Spanish and to EU visitors only, never to other visitors", () => {
    expect(hostingLine(HOSTING, "es", false)).toContain("UE (Fráncfort)");
    expect(hostingLine(HOSTING, "en", true)).toContain("EU (Frankfurt)");
    expect(hostingLine(HOSTING, "en", false)).toBeNull();
  });
});
