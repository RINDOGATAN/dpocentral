// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The safeguards guide on the landing, ported from the storefront's guide
 * (todolaw PR #59, owner's mockup of 10 Oct 2026): six questions, each answer
 * sets a minimum level, the guide takes the highest level any answer asks for
 * and picks one way at that level. Unanswered questions count as the lightest
 * answer. The logic and the questions are the storefront's, unchanged.
 *
 *   Level 0  Cloud
 *   Level 1  Managed
 *   Level 2  Spain: Deployment (no kit, no hardware in this market).
 *            English: IT team -> the kit; no IT team and (office or local models only)
 *            -> the Box; otherwise -> Deployment and training.
 *
 * Copy rules: no prices, no certification logos, no competitor names, no long dashes.
 * The classifier sentence of the mockup is left out until it has a claims-register row
 * (owner's open question 5).
 *
 * Owner's decision of 10 Oct 2026: the managed instance is hosted in Gijón (Asturias,
 * Spain) and can run open-weight models on the instance itself, so "Never: local models
 * only" sets level 1 (managed), not 2; own servers or the office stay at level 2. Same
 * wording as the storefront's and AI Sentinel's guides.
 *
 * Product facts for DPO Central (where this copy differs from the storefront's):
 *   - AI features draft from a record's details (a DPIA narrative, a breach
 *     notification), so the copy says "the details of the record being drafted",
 *     not "the selected text". Off by default; an organization admin turns them on
 *     (services/ai/posture.ts requireAi, routers/privacy/ai.ts setPosture).
 *   - The cloud is hosted in the EU (database in Frankfurt, functions in fra1:
 *     vercel.json, PR #96), as the Spanish box says, not "served from the United
 *     States" as on the storefront. The AI provider set up on the service may be
 *     outside the EU, and the copy says so.
 *   - Spanish names are the boxes' own titles; "Tu propio hardware" is the
 *     customer's own equipment, not the TODO.LAW Box, and the deployment copy follows
 *     that box (installed on the organization's equipment, on its premises).
 */

export type Locale = "en" | "es";
export type WayId = "cloud" | "kit" | "box" | "managed" | "deploy";
export type QuestionId = "loc" | "data" | "ai" | "iso" | "it" | "cert";
export type Answers = Partial<Record<QuestionId, string>>;
type Level = 0 | 1 | 2;

/**
 * The position of each way among this landing's ways boxes, per language
 * (LandingSections SETUP: Spanish cloud, managed, own installation; English
 * cloud, kit, hardware, managed, deployment), so the result marks its box.
 */
export const WAY_INDEX: Record<Locale, Partial<Record<WayId, number>>> = {
  es: { cloud: 0, managed: 1, deploy: 2 },
  en: { cloud: 0, kit: 1, box: 2, managed: 3, deploy: 4 },
};

/** Lightest to strictest: "one step stricter / lighter" follows this order. */
export const LADDER: Record<Locale, WayId[]> = {
  es: ["cloud", "managed", "deploy"],
  en: ["cloud", "managed", "kit", "deploy", "box"],
};

type Option = { value: string; level: Level; only?: Locale };

export const QUESTIONS: { id: QuestionId; options: Option[] }[] = [
  {
    id: "loc",
    options: [
      { value: "any", level: 0 },
      { value: "servers", level: 2 },
      { value: "office", level: 2, only: "en" },
    ],
  },
  {
    id: "data",
    options: [
      { value: "test", level: 0 },
      { value: "real", level: 1 },
      { value: "special", level: 1 },
    ],
  },
  {
    id: "ai",
    options: [
      { value: "none", level: 0 },
      { value: "ext", level: 0 },
      { value: "key", level: 1 },
      { value: "local", level: 1 },
    ],
  },
  {
    id: "iso",
    options: [
      { value: "yes", level: 1 },
      { value: "no", level: 0 },
    ],
  },
  {
    id: "it",
    options: [
      { value: "yes", level: 0 },
      { value: "no", level: 0 },
    ],
  },
  {
    id: "cert",
    options: [
      { value: "yes", level: 2 },
      { value: "no", level: 0 },
    ],
  },
];

/** The options a visitor in this market is offered. */
export const optionsFor = (q: (typeof QUESTIONS)[number], locale: Locale) => q.options.filter((o) => !o.only || o.only === locale);

/** The answers that are requirements, and which ways meet them (the tick matrix). */
export type SafeguardKey = "loc:servers" | "loc:office" | "data:real" | "data:special" | "ai:none" | "ai:key" | "ai:local" | "iso:yes" | "it:no" | "cert:yes";

const MET: Record<SafeguardKey, Record<WayId, boolean>> = {
  "loc:servers": { cloud: false, managed: false, kit: true, deploy: true, box: true },
  "loc:office": { cloud: false, managed: false, kit: true, deploy: true, box: true },
  "data:real": { cloud: false, managed: true, kit: true, deploy: true, box: true },
  "data:special": { cloud: false, managed: true, kit: true, deploy: true, box: true },
  "ai:none": { cloud: true, managed: true, kit: true, deploy: true, box: true },
  "ai:key": { cloud: false, managed: true, kit: true, deploy: true, box: true },
  "ai:local": { cloud: false, managed: true, kit: true, deploy: true, box: true },
  "iso:yes": { cloud: false, managed: true, kit: true, deploy: true, box: true },
  "it:no": { cloud: true, managed: true, kit: false, deploy: true, box: true },
  "cert:yes": { cloud: false, managed: false, kit: true, deploy: true, box: true },
};

/** The level the answers ask for: the highest any answer sets. */
export function levelOf(answers: Answers, locale: Locale): Level {
  let level: Level = 0;
  for (const q of QUESTIONS) {
    const o = optionsFor(q, locale).find((x) => x.value === answers[q.id]);
    if (o && o.level > level) level = o.level;
  }
  return level;
}

/** The way that meets the answers, from the ways offered in this market. */
export function pickWay(answers: Answers, locale: Locale): WayId {
  const level = levelOf(answers, locale);
  if (level === 0) return "cloud";
  if (level === 1) return "managed";
  if (locale === "es") return "deploy";
  if (answers.it === "yes") return "kit";
  if (answers.it === "no" && (answers.loc === "office" || answers.ai === "local")) return "box";
  return "deploy";
}

/** The chosen answers that are requirements, in question order. */
export function requirementsOf(answers: Answers, locale: Locale): SafeguardKey[] {
  return QUESTIONS.flatMap((q) => {
    const v = answers[q.id];
    if (!v || !optionsFor(q, locale).some((o) => o.value === v)) return [];
    const key = `${q.id}:${v}`;
    return key in MET ? [key as SafeguardKey] : [];
  });
}

export const meets = (way: WayId, key: SafeguardKey) => MET[key][way];

export type Recommendation = {
  level: Level;
  way: WayId;
  checks: { key: SafeguardKey; met: boolean }[];
  /** The next way up and down the ladder, with the chosen safeguards each would not meet. */
  up: { way: WayId; missing: SafeguardKey[] } | null;
  down: { way: WayId; missing: SafeguardKey[] } | null;
};

/** The whole result, or null while nothing is answered. */
export function recommend(answers: Answers, locale: Locale): Recommendation | null {
  if (!QUESTIONS.some((q) => answers[q.id])) return null;
  const way = pickWay(answers, locale);
  const reqs = requirementsOf(answers, locale);
  const ladder = LADDER[locale];
  const i = ladder.indexOf(way);
  const near = (w: WayId | undefined) => (w ? { way: w, missing: reqs.filter((k) => !meets(w, k)) } : null);
  return {
    level: levelOf(answers, locale),
    way,
    checks: reqs.map((key) => ({ key, met: meets(way, key) })),
    up: near(ladder[i + 1]),
    down: near(ladder[i - 1]),
  };
}

/* ------------------------------------------------------------------ copy */

type Notes = Partial<Record<WayId, string>>;

export type SafeguardsCopy = {
  /** The name of each way offered here (English: the boxes' own titles). */
  names: Partial<Record<WayId, string>>;
  heading: string;
  lead: string;
  open: string;
  close: string;
  formLegend: string;
  formSub: string;
  reset: string;
  empty: string;
  rec: string;
  meets: string;
  none: string;
  up: string;
  down: string;
  top: string;
  bottom: string;
  all: string;
  miss: string;
  met: string;
  notMet: string;
  see: string;
  seeResult: string;
  whyH: string;
  whyP: string;
  questions: Record<QuestionId, { label: string; hint?: string; options: Record<string, string> }>;
  safeguards: Record<SafeguardKey, string>;
  notes: Record<SafeguardKey, Notes>;
  summaries: Partial<Record<WayId, string>>;
};

const AI_OFF_EN = "AI is off by default; while off, no AI calls are made.";
const AI_OFF_ES = "La IA viene desactivada; mientras lo está, no hay llamadas a una IA.";
const PERIMETER_EN = "It sits inside your perimeter, under your own controls and certifications.";

export const COPY: Record<Locale, SafeguardsCopy> = {
  en: {
    names: {
      cloud: "TODO.LAW cloud",
      kit: "The self-install kit",
      box: "TODO.LAW hardware",
      managed: "A managed instance",
      deploy: "Deployment and training on your servers",
    },
    heading: "Not sure which to choose?",
    lead: "Answer six short questions about the safeguards you need, and we show which way meets them.",
    open: "Answer the questions",
    close: "Hide the questions",
    formLegend: "Your safeguards",
    formSub: "The recommendation updates as you answer.",
    reset: "Start again",
    empty: "Answer any question to see the recommended way.",
    rec: "Recommended way",
    meets: "Which safeguards it meets",
    none: "You have not chosen a strict safeguard: the cloud pilot is enough to try it.",
    up: "One step stricter",
    down: "One step lighter",
    top: "This is the strictest way available.",
    bottom: "This is the lightest way.",
    all: "Meets everything you chose.",
    miss: "Does not meet: ",
    met: "Meets",
    notMet: "Does not meet",
    see: "See this way",
    seeResult: "See the result",
    whyH: "Why this matters",
    whyP:
      "Many tools with built-in AI send your text to an external AI provider. Here you choose. AI features are off until an administrator turns them on, and while they are off the product makes no AI calls at all. On a managed instance, on your own servers or on TODO.LAW hardware, AI features can use open-weight models hosted there, so the text does not leave that system.",
    questions: {
      loc: {
        label: "Where must your data stay?",
        options: { any: "Anywhere in the cloud: for now we only want to try it", servers: "On our own servers", office: "Inside our office" },
      },
      data: {
        label: "What data will you keep in it?",
        options: { test: "Test records or pseudonyms only", real: "Real client or business data", special: "Special-category data (health, for example) or privileged information" },
      },
      ai: {
        label: "May AI features send content to an external AI provider?",
        options: { none: "We do not need AI features", ext: "Yes, they may", key: "Only with our own provider key", local: "Never: local models only" },
      },
      iso: {
        label: "Must your instance be isolated from other customers?",
        options: { yes: "Yes", no: "No, a shared service is fine to start" },
      },
      it: {
        label: "Do you have your own IT team to maintain it?",
        options: { yes: "Yes", no: "No" },
      },
      cert: {
        label: "Must your own controls and certifications (for example ISO 27001) cover the system?",
        hint: "On your own servers or hardware, the system sits inside your perimeter, so your own controls and certifications apply.",
        options: { yes: "Yes", no: "No" },
      },
    },
    safeguards: {
      "loc:servers": "Data on your own servers",
      "loc:office": "Data inside your office",
      "data:real": "Real client data",
      "data:special": "Special-category data or privileged information",
      "ai:none": "No AI calls unless you turn them on",
      "ai:key": "AI only with your own provider key",
      "ai:local": "AI on local models only",
      "iso:yes": "An instance isolated from other customers",
      "it:no": "No IT team of your own",
      "cert:yes": "Your own controls and certifications cover the system",
    },
    notes: {
      "loc:servers": { cloud: "Hosted by us in the EU, on a shared service.", managed: "Hosted by us, on an instance for you alone.", kit: "Installed on a machine you choose.", deploy: "Installed on your servers.", box: "Your own hardware." },
      "loc:office": { cloud: "Hosted by us.", managed: "Hosted by us, outside your office.", kit: "On a machine in your office, if you choose.", deploy: "On your servers, in your office if they are there.", box: "The hardware sits in your office." },
      "data:real": { cloud: "The pilot is for test records or pseudonyms only.", managed: "An instance for your organization alone.", kit: "Your records stay on your machine.", deploy: "Your records stay on your servers.", box: "Your records stay on your hardware." },
      "data:special": { cloud: "The pilot is for test records or pseudonyms only.", managed: "An instance for your organization alone.", kit: "Your records stay on your machine.", deploy: "Your records stay on your servers.", box: "Your records stay on your hardware." },
      "ai:none": { cloud: AI_OFF_EN, managed: AI_OFF_EN, kit: AI_OFF_EN, deploy: AI_OFF_EN, box: AI_OFF_EN },
      "ai:key": { cloud: "We set the AI provider for the whole service; you cannot use your own key.", managed: "The instance can be set up with your own key.", kit: "You set the AI engine and key yourself.", deploy: "We set up AI with your own key.", box: "You can add your own key, or keep to the local models." },
      "ai:local": { cloud: "With AI on, the details of the record being drafted go to the service's external AI provider, which may be outside the EU.", managed: "Open-weight models can run on the instance itself, so the text does not leave it.", kit: "Point AI at a local model engine you run; the kit does not include one.", deploy: "We can set up an open-weight model on your servers, if they have the capacity.", box: "Open-weight models run on the hardware itself." },
      "iso:yes": { cloud: "A shared service: each organization's records are kept apart, but the system is shared.", managed: "An isolated instance for you alone.", kit: "Your own installation.", deploy: "Your own installation.", box: "Your own installation." },
      "it:no": { cloud: "We run it.", managed: "We run it for you.", kit: "Your team installs it, updates it and backs it up.", deploy: "We install it, train your people and leave a runbook.", box: "Set-up and maintenance are included." },
      "cert:yes": { cloud: "It works under our controls, with no independent certification.", managed: "It works under our controls; we hold no independent certification today.", kit: PERIMETER_EN, deploy: PERIMETER_EN, box: PERIMETER_EN },
    },
    summaries: {
      cloud:
        "Hosted by us in the EU. A free, capped pilot to try the workflows with test records. It is not for real client data, it is shared with other organizations (each one's records kept apart), and it has no service level or independent certification. If you turn AI features on, the details of the record being drafted go to the external AI provider set up on the service, which may be outside the EU.",
      managed: "An isolated instance we run for your organization alone, hosted in Asturias, Spain. Your records stay on that instance. AI features stay off until you turn them on, and can use open-weight models hosted on the instance itself, so the text does not leave it, or your own provider key.",
      kit: "Open source and Docker, installed by your own team on a machine you choose. Your data stays on that machine, unless you connect an outside AI service with your own key. AI features can also use a local model engine that you run on your own network; the kit does not include one.",
      deploy:
        "Six weeks with us: the suite installed on your servers, your people trained, and a runbook. Your records stay inside your perimeter, under your own controls. For AI features, we can set up an open-weight model on your servers, if they have the capacity, or your own key.",
      box: "Your own hardware in your office, with everything pre-loaded, set-up and maintenance. Open-weight models run on the hardware itself, so AI features can work without sending text out of your office. Specifications indicative for now.",
    },
  },
  es: {
    // The boxes' own titles (es.ways.w1..w3.title).
    names: {
      cloud: "En la nube de la UE",
      managed: "Servidor virtual gestionado",
      deploy: "Tu propio hardware",
    },
    heading: "¿No sabes cuál elegir?",
    lead: "Responde a seis preguntas breves sobre las garantías que necesitas y te indicamos qué modalidad las cumple.",
    open: "Responder a las preguntas",
    close: "Ocultar las preguntas",
    formLegend: "Tus garantías",
    formSub: "La recomendación cambia mientras respondes.",
    reset: "Empezar de nuevo",
    empty: "Responde a alguna pregunta para ver la modalidad recomendada.",
    rec: "Modalidad recomendada",
    meets: "Qué garantías cumple",
    none: "No has marcado ninguna garantía estricta: el piloto en la nube basta para probar.",
    up: "Un paso más estricto",
    down: "Un paso más ligero",
    top: "Es la modalidad más estricta disponible.",
    bottom: "Es la modalidad más ligera.",
    all: "Cumple todo lo que has marcado.",
    miss: "No cumple: ",
    met: "Cumple",
    notMet: "No cumple",
    see: "Ver esta modalidad",
    seeResult: "Ver el resultado",
    whyH: "Por qué importa",
    whyP:
      "Muchas herramientas con IA integrada envían tu texto a un proveedor de IA externo. Aquí eliges tú. Las funciones de IA están desactivadas hasta que un administrador las activa y, mientras lo están, el producto no hace ninguna llamada a una IA. En una instancia gestionada o en tus propios servidores, las funciones de IA pueden usar modelos de pesos abiertos alojados allí mismo, de modo que el texto no sale de ese sistema.",
    questions: {
      loc: {
        label: "¿Dónde deben estar tus datos?",
        options: { any: "En cualquier nube: de momento solo queremos probar", servers: "En nuestros propios servidores o en nuestra oficina" },
      },
      data: {
        label: "¿Qué datos vas a guardar?",
        options: {
          test: "Solo registros de prueba o seudónimos",
          real: "Datos reales de clientes o de la empresa",
          special: "Datos de categorías especiales (de salud, por ejemplo) o información sujeta a secreto profesional",
        },
      },
      ai: {
        label: "¿Pueden las funciones de IA enviar contenido a un proveedor de IA externo?",
        options: { none: "No necesitamos funciones de IA", ext: "Sí, pueden", key: "Solo con la clave de nuestro propio proveedor", local: "Nunca: solo modelos locales" },
      },
      iso: {
        label: "¿Debe tu instancia estar aislada de la de otros clientes?",
        options: { yes: "Sí", no: "No, un servicio compartido nos sirve para empezar" },
      },
      it: {
        label: "¿Tienes un equipo informático propio que pueda mantenerlo?",
        options: { yes: "Sí", no: "No" },
      },
      cert: {
        label: "¿Deben tus propios controles y certificaciones (por ejemplo, ISO 27001) cubrir el sistema?",
        hint: "En un equipo de tu organización, el sistema queda dentro de tu perímetro, así que se aplican tus propios controles y certificaciones.",
        options: { yes: "Sí", no: "No" },
      },
    },
    safeguards: {
      "loc:servers": "Datos en tus propios servidores o en tu oficina",
      "loc:office": "",
      "data:real": "Datos reales de clientes",
      "data:special": "Datos de categorías especiales o información sujeta a secreto profesional",
      "ai:none": "Ninguna llamada a una IA salvo que la actives",
      "ai:key": "IA solo con tu propia clave",
      "ai:local": "IA solo con modelos locales",
      "iso:yes": "Una instancia aislada de otros clientes",
      "it:no": "Sin equipo informático propio",
      "cert:yes": "Tus propios controles y certificaciones cubren el sistema",
    },
    notes: {
      "loc:servers": { cloud: "Lo alojamos nosotros en la UE, en un servicio compartido.", managed: "Lo alojamos nosotros, en una instancia solo para ti.", deploy: "Instalado en un equipo de tu organización." },
      "loc:office": {},
      "data:real": { cloud: "El piloto es solo para registros de prueba o seudónimos.", managed: "Una instancia solo para tu organización.", deploy: "Tus registros se quedan en tus instalaciones." },
      "data:special": { cloud: "El piloto es solo para registros de prueba o seudónimos.", managed: "Una instancia solo para tu organización.", deploy: "Tus registros se quedan en tus instalaciones." },
      "ai:none": { cloud: AI_OFF_ES, managed: AI_OFF_ES, deploy: AI_OFF_ES },
      "ai:key": { cloud: "El proveedor de IA lo configuramos nosotros para todo el servicio; no puedes usar tu clave.", managed: "La instancia se puede configurar con tu propia clave.", deploy: "Configuramos la IA con tu propia clave." },
      "ai:local": { cloud: "Con la IA activada, los datos del registro que se redacta van al proveedor de IA externo del servicio, que puede estar fuera de la UE.", managed: "Los modelos de pesos abiertos pueden funcionar en la propia instancia, de modo que el texto no sale de ella.", deploy: "Podemos configurar un modelo de pesos abiertos en ese equipo, si tiene capacidad." },
      "iso:yes": { cloud: "Es un servicio compartido: los registros de cada organización están separados, pero el sistema es común.", managed: "Una instancia aislada solo para ti.", deploy: "Tu propia instalación." },
      "it:no": { cloud: "Lo mantenemos nosotros.", managed: "Lo mantenemos nosotros para ti.", deploy: "Lo instalamos, formamos a tu equipo y te dejamos un manual de operación." },
      "cert:yes": { cloud: "Funciona bajo nuestros controles y sin certificación independiente.", managed: "Funciona bajo nuestros controles; hoy no tenemos certificación independiente.", deploy: "Queda dentro de tu perímetro, bajo tus propios controles y certificaciones." },
    },
    summaries: {
      cloud:
        "Lo alojamos nosotros, en la UE. Un piloto gratuito y con límites para probar los flujos de trabajo con registros de prueba. No es apto para datos reales de clientes, se comparte con otras organizaciones (los registros de cada una están separados) y no tiene acuerdo de nivel de servicio ni certificación independiente. Si activas las funciones de IA, los datos del registro que se redacta van al proveedor de IA externo configurado en el servicio, que puede estar fuera de la UE.",
      managed: "Una instancia aislada que operamos nosotros, solo para tu organización, alojada en Asturias (España). Tus registros se quedan en esa instancia. Las funciones de IA están desactivadas hasta que las activas, y pueden usar modelos de pesos abiertos alojados en la propia instancia, de modo que el texto no sale de ella, o la clave de tu propio proveedor.",
      deploy:
        "Seis semanas con nosotros: lo instalamos en un equipo de tu organización, formamos a tu equipo y te dejamos un manual de operación. Los registros se quedan en tus instalaciones, bajo tus propios controles. Para las funciones de IA, podemos configurar un modelo de pesos abiertos en ese equipo, si tiene capacidad, y así los datos no salen de tus instalaciones; o usar tu propia clave, y entonces los datos del registro que se redacta van a ese proveedor.",
    },
  },
};
