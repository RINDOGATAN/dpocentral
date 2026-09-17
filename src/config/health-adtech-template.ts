// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Global assessment template: "Health data in advertising: CCPA risk
 * assessment and GDPR DPIA".
 *
 * Structure: the nine elements of a CCPA risk assessment (11 CCR 7152(a))
 * combined with the content GDPR Article 35(7) requires, plus a
 * jurisdiction-specific section and an approval section. The five-factor
 * health-data classification and its scoring are this template's own method.
 *
 * This file is the single bilingual source. The English text is what the
 * database stores (AssessmentTemplate.sections); the Spanish text is written
 * into src/messages/es.json under templates.dpia by
 * scripts/sync-health-adtech-messages.ts, and tests/health-adtech-template.test.ts
 * fails if the two drift apart.
 *
 * Every legal statement names its source in the help text. A statement the
 * app's own regulation data does not support is marked "[to verify]". This is
 * a draft for counsel's review, not legal advice.
 *
 * The first question selects the jurisdictions; `showIf` on the later
 * questions (src/lib/assessment-conditions.ts) adds the questions each
 * jurisdiction needs, and src/lib/health-adtech/results.ts turns the same
 * answers into the per-jurisdiction report.
 */

import type { ShowIf } from "@/lib/assessment-conditions";

export const HEALTH_ADTECH_TEMPLATE_ID = "system-dpia-health-adtech-template";
export const HEALTH_ADTECH_TEMPLATE_VERSION = "1.0";
/** scoringLogic.method that marks this template (kept by clones). */
export const HEALTH_ADTECH_SCORING_METHOD = "health_adtech_v1";

export interface BiText {
  en: string;
  es: string;
}

export type BiQuestionType = "text" | "textarea" | "select" | "multiselect" | "boolean";

export interface BiQuestion {
  id: string;
  type: BiQuestionType;
  required: boolean;
  text: BiText;
  help?: BiText;
  options?: { en: string[]; es: string[] };
  showIf?: ShowIf;
}

export interface BiSection {
  id: string;
  title: BiText;
  description: BiText;
  questions: BiQuestion[];
  showIf?: ShowIf;
}

// ── Sources (quoted in help text) ────────────────────────────────────────

const src = (en: string, es: string): BiText => ({ en: `Source: ${en}.`, es: `Fuente: ${es}.` });
const join = (...parts: BiText[]): BiText => ({
  en: parts.map((p) => p.en).join(" "),
  es: parts.map((p) => p.es).join(" "),
});

// Primary texts checked on 16 September 2026.
const CHECKED = { en: "checked 16 September 2026", es: "comprobado el 16 de septiembre de 2026" };
const SRC_CA_TRIGGERS = src(`11 CCR 7150(b) (${CHECKED.en})`, `11 CCR 7150(b) (${CHECKED.es})`);
const SRC_PROCESSING = src(
  `11 CCR 7152(a)(1) to (3); GDPR Art. 35(7)(a) (${CHECKED.en})`,
  `11 CCR 7152(a)(1) a (3); art. 35(7)(a) del RGPD (${CHECKED.es})`
);
const SRC_NECESSITY = src(`GDPR Art. 35(7)(b) (${CHECKED.en})`, `art. 35(7)(b) del RGPD (${CHECKED.es})`);
const SRC_CA_BENEFITS = src(`11 CCR 7152(a)(4) (${CHECKED.en})`, `11 CCR 7152(a)(4) (${CHECKED.es})`);
const SRC_IMPACTS = src(
  `11 CCR 7152(a)(5); GDPR Art. 35(7)(c) (${CHECKED.en})`,
  `11 CCR 7152(a)(5); art. 35(7)(c) del RGPD (${CHECKED.es})`
);
const SRC_SAFEGUARDS = src(
  `11 CCR 7152(a)(6); GDPR Art. 35(7)(d) (${CHECKED.en})`,
  `11 CCR 7152(a)(6); art. 35(7)(d) del RGPD (${CHECKED.es})`
);
const SRC_CA_DECISION = src(
  `11 CCR 7152(a)(7) to (9) (${CHECKED.en})`,
  `11 CCR 7152(a)(7) a (9) (${CHECKED.es})`
);
const SRC_CA_TIMETABLE = src(
  `11 CCR 7155(a),(b) and 7157(a),(e) (${CHECKED.en})`,
  `11 CCR 7155(a),(b) y 7157(a),(e) (${CHECKED.es})`
);
const SRC_CA_ATTESTATION = src(
  `11 CCR 7157(b)(5),(c) (${CHECKED.en})`,
  `11 CCR 7157(b)(5),(c) (${CHECKED.es})`
);
const SRC_WA_NV_CONSENT = src(
  `Washington RCW 19.373.030; Nevada NRS 603A.500 (${CHECKED.en})`,
  `Washington, RCW 19.373.030; Nevada, NRS 603A.500 (${CHECKED.es})`
);
const SRC_WA_NV_SALE = src(
  `Washington RCW 19.373.070; Nevada NRS 603A.535 (${CHECKED.en})`,
  `Washington, RCW 19.373.070; Nevada, NRS 603A.535 (${CHECKED.es})`
);
const SRC_WA_NV_GEOFENCE = src(
  `RCW 19.373.080; NRS 603A.540 (${CHECKED.en})`,
  `RCW 19.373.080; NRS 603A.540 (${CHECKED.es})`
);
const SRC_MD_SALE = src(
  `Md. Com. Law 14-4607(a)(1),(2) (2024 ch. 454; ${CHECKED.en})`,
  `Md. Com. Law 14-4607(a)(1),(2) (ley de 2024, cap. 454; ${CHECKED.es})`
);
const SRC_CATALOGUE = (entry: string) =>
  src(
    `DPO Central jurisdiction catalogue, ${entry} entry`,
    `catálogo de jurisdicciones de DPO Central, ficha ${entry}`
  );
const SRC_DPIA_TEMPLATE = src(
  "DPO Central DPIA template (GDPR Art. 35 and Art. 36 questions)",
  "plantilla de DPIA de DPO Central (preguntas sobre los arts. 35 y 36 del RGPD)"
);
const SRC_ART35_3 = src(
  "GDPR Art. 35(3)(a) to (c), as used in the DPO Central risk mappings and DPIA template",
  "art. 35(3)(a) a (c) del RGPD, según las tablas de riesgo y la plantilla de DPIA de DPO Central"
);

// ── Jurisdictions (question hd1_1) ───────────────────────────────────────

export const JURISDICTIONS = [
  { code: "EU", en: "EU/EEA (GDPR)", es: "UE/EEE (RGPD)" },
  { code: "UK", en: "United Kingdom (UK GDPR)", es: "Reino Unido (RGPD del Reino Unido)" },
  { code: "CA", en: "California (CCPA/CPRA)", es: "California (CCPA/CPRA)" },
  { code: "WA", en: "Washington (My Health My Data Act)", es: "Washington (My Health My Data Act)" },
  { code: "NV", en: "Nevada (consumer health data law)", es: "Nevada (ley sobre datos de salud del consumidor)" },
  { code: "MD", en: "Maryland (MODPA)", es: "Maryland (MODPA)" },
  { code: "CT", en: "Connecticut (CTDPA)", es: "Connecticut (CTDPA)" },
  { code: "CO", en: "Colorado (CPA)", es: "Colorado (CPA)" },
  { code: "VA", en: "Virginia (VCDPA)", es: "Virginia (VCDPA)" },
  { code: "TX", en: "Texas (TDPSA)", es: "Texas (TDPSA)" },
  { code: "OR", en: "Oregon (OCPA)", es: "Oregón (OCPA)" },
  {
    code: "US_OTHER",
    en: "Another US state with a comprehensive privacy law",
    es: "Otro estado de EE. UU. con una ley general de privacidad",
  },
] as const;

export type JurisdictionCode = (typeof JURISDICTIONS)[number]["code"];

export const JURISDICTION_QUESTION_ID = "hd1_1";

const US_STATE_LAW_CODES: JurisdictionCode[] = ["MD", "CT", "CO", "VA", "TX", "OR", "US_OTHER"];

/** showIf: shown when any of these jurisdictions is selected. */
export function whenJurisdiction(...codes: JurisdictionCode[]): ShowIf {
  return {
    questionId: JURISDICTION_QUESTION_ID,
    anyOf: JURISDICTIONS.filter((j) => codes.includes(j.code)).map((j) => j.en),
  };
}

// ── Five-factor health-data classification (section hd6) ─────────────────

/** Question ids of the five factors, each option scored 0 to 3 by position. */
export const FIVE_FACTOR_QUESTION_IDS = ["hd6_1", "hd6_2", "hd6_3", "hd6_4", "hd6_5"] as const;

// ── Mitigation choice (question hd7_1) ───────────────────────────────────

export const MITIGATION_OPTIONS = {
  en: [
    "Obtain opt-in consent nationwide",
    "Suppress health-related data for consumers in opt-in states",
    "Rely on partner due diligence and contract controls",
    "Avoid high-risk campaigns (no targeting on health conditions)",
    "De-identify the data before any disclosure",
  ],
  es: [
    "Obtener consentimiento expreso (opt-in) en todo el país",
    "Suprimir los datos relacionados con la salud de los consumidores de estados con consentimiento expreso",
    "Confiar en la diligencia debida y en los controles contractuales con los socios",
    "Evitar campañas de alto riesgo (sin segmentación por condiciones de salud)",
    "Desidentificar los datos antes de cualquier comunicación",
  ],
};

const RISK_OPTIONS = {
  en: ["Low", "Medium", "High", "Very high"],
  es: ["Bajo", "Medio", "Alto", "Muy alto"],
};

export const RESIDUAL_RISK_QUESTION_ID = "hd9_1";
export const DETERMINATION_QUESTION_ID = "hd9_2";
export const PRIOR_CONSULTATION_QUESTION_ID = "hd9_3";
export const MITIGATION_QUESTION_ID = "hd7_1";
export const SIGNATURE_QUESTION_IDS = { signer: "hd10_1", date: "hd10_2", review: "hd10_3" } as const;

const YES_NO_NOTE: BiText = {
  en: "Answer Yes or No; add the detail in the notes.",
  es: "Responde Sí o No; añade el detalle en las notas.",
};

// ── Sections ─────────────────────────────────────────────────────────────

export const HEALTH_ADTECH_SECTIONS: BiSection[] = [
  {
    id: "hd1",
    title: { en: "Scope and threshold analysis", es: "Alcance y análisis de umbral" },
    description: {
      en: "Select the jurisdictions first: the answer adds the questions and obligations each one requires.",
      es: "Selecciona primero las jurisdicciones: la respuesta añade las preguntas y obligaciones que exige cada una.",
    },
    questions: [
      {
        id: JURISDICTION_QUESTION_ID,
        type: "multiselect",
        required: true,
        text: {
          en: "Which jurisdictions apply to this processing?",
          es: "¿Qué jurisdicciones se aplican a este tratamiento?",
        },
        help: join(
          {
            en: "Select every jurisdiction whose residents' data is collected or used. Changing the selection changes the questions below and the report.",
            es: "Selecciona todas las jurisdicciones cuyos residentes aportan datos que se recogen o usan. Si cambias la selección, cambian las preguntas siguientes y el informe.",
          },
          src(
            "DPO Central jurisdiction catalogue (GDPR, UK GDPR, CCPA/CPRA, MODPA, CTDPA, CPA, VCDPA, TDPSA, OCPA); Washington and Nevada are not in the catalogue",
            "catálogo de jurisdicciones de DPO Central (RGPD, RGPD del Reino Unido, CCPA/CPRA, MODPA, CTDPA, CPA, VCDPA, TDPSA, OCPA); Washington y Nevada no figuran en el catálogo"
          )
        ),
        options: {
          en: JURISDICTIONS.map((j) => j.en),
          es: JURISDICTIONS.map((j) => j.es),
        },
      },
      {
        id: "hd1_2",
        type: "multiselect",
        required: true,
        showIf: whenJurisdiction("CA"),
        text: {
          en: "Which CCPA risk-assessment triggers does the processing meet?",
          es: "¿Qué supuestos de evaluación de riesgos de la CCPA cumple el tratamiento?",
        },
        help: join(
          {
            en: "Any trigger means a risk assessment is required.",
            es: "Cualquier supuesto obliga a realizar la evaluación de riesgos.",
          },
          SRC_CA_TRIGGERS
        ),
        options: {
          en: [
            "Selling or sharing personal information",
            "Processing sensitive personal information",
            "Automated decision-making technology (ADMT) for a significant decision",
            "Automated observation of employees, contractors, job applicants or students",
            "Inferring sensitive traits from presence at a sensitive location",
            "Processing to train ADMT, biometric or profiling technology",
            "None of these",
          ],
          es: [
            "Venta o intercambio (sharing) de información personal",
            "Tratamiento de información personal sensible",
            "Tecnología de decisiones automatizadas (ADMT) para una decisión significativa",
            "Observación automatizada de empleados, contratistas, candidatos o estudiantes",
            "Inferencia de rasgos sensibles a partir de la presencia en un lugar sensible",
            "Tratamiento para entrenar tecnología ADMT, biométrica o de elaboración de perfiles",
            "Ninguno de ellos",
          ],
        },
      },
      {
        id: "hd1_3",
        type: "multiselect",
        required: true,
        showIf: whenJurisdiction("EU", "UK"),
        text: {
          en: "Which GDPR Article 35(3) cases apply?",
          es: "¿Qué supuestos del artículo 35(3) del RGPD se aplican?",
        },
        help: join(
          {
            en: "Any case means a DPIA is required before the processing starts.",
            es: "Cualquier supuesto obliga a realizar la EIPD (DPIA) antes de iniciar el tratamiento.",
          },
          SRC_ART35_3
        ),
        options: {
          en: [
            "Systematic and extensive evaluation, including profiling, with legal or similarly significant effects (Art. 35(3)(a))",
            "Large-scale processing of special category data, such as health data (Art. 35(3)(b))",
            "Systematic monitoring of a publicly accessible area on a large scale (Art. 35(3)(c))",
            "None of these, but the processing is still likely to be high risk",
            "None of these",
          ],
          es: [
            "Evaluación sistemática y exhaustiva, incluida la elaboración de perfiles, con efectos jurídicos o similarmente significativos (art. 35(3)(a))",
            "Tratamiento a gran escala de categorías especiales de datos, como los datos de salud (art. 35(3)(b))",
            "Observación sistemática a gran escala de una zona de acceso público (art. 35(3)(c))",
            "Ninguno, pero el tratamiento sigue siendo probablemente de alto riesgo",
            "Ninguno de ellos",
          ],
        },
      },
      {
        id: "hd1_4",
        type: "multiselect",
        required: true,
        showIf: whenJurisdiction(...US_STATE_LAW_CODES),
        text: {
          en: "Which US state data protection assessment triggers apply?",
          es: "¿Qué supuestos de evaluación de protección de datos de los estados de EE. UU. se aplican?",
        },
        help: join(
          {
            en: "Any trigger means a data protection assessment is required in the states selected.",
            es: "Cualquier supuesto obliga a realizar una evaluación de protección de datos en los estados seleccionados.",
          },
          SRC_CATALOGUE("VCDPA and CTDPA"),
          {
            en: "The trigger list varies by state [to verify for each state].",
            es: "La lista de supuestos varía según el estado [por verificar en cada estado].",
          }
        ),
        options: {
          en: [
            "Targeted advertising",
            "Sale of personal data",
            "Processing sensitive data (including health data)",
            "Profiling with a foreseeable risk of harm",
            "None of these",
          ],
          es: [
            "Publicidad segmentada",
            "Venta de datos personales",
            "Tratamiento de datos sensibles (incluidos los de salud)",
            "Elaboración de perfiles con riesgo previsible de daño",
            "Ninguno de ellos",
          ],
        },
      },
      {
        id: "hd1_5",
        type: "select",
        required: true,
        text: {
          en: "Result of the threshold analysis",
          es: "Resultado del análisis de umbral",
        },
        options: {
          en: [
            "A full assessment is required",
            "No assessment is required (reasons recorded in the notes)",
            "Not yet determined",
          ],
          es: [
            "Es necesaria una evaluación completa",
            "No es necesaria ninguna evaluación (motivos en las notas)",
            "Aún sin determinar",
          ],
        },
      },
    ],
  },
  {
    id: "hd2",
    title: {
      en: "Purpose, necessity and data minimisation",
      es: "Finalidad, necesidad y minimización de datos",
    },
    description: {
      en: "Why the processing takes place and why each data item is needed.",
      es: "Por qué se realiza el tratamiento y por qué es necesario cada dato.",
    },
    questions: [
      {
        id: "hd2_1",
        type: "textarea",
        required: true,
        text: {
          en: "What is the specific business purpose of the processing?",
          es: "¿Cuál es la finalidad empresarial concreta del tratamiento?",
        },
        help: join(
          {
            en: "Name the campaign, measurement or audience use; avoid general wording such as \"marketing\".",
            es: "Indica la campaña, la medición o el uso de audiencias; evita fórmulas generales como «marketing».",
          },
          SRC_PROCESSING
        ),
      },
      {
        id: "hd2_2",
        type: "textarea",
        required: true,
        text: {
          en: "Why is each category of data necessary for that purpose, and what less intrusive alternatives did you consider?",
          es: "¿Por qué es necesaria cada categoría de datos para esa finalidad y qué alternativas menos intrusivas has valorado?",
        },
        help: SRC_NECESSITY,
      },
      {
        id: "hd2_3",
        type: "textarea",
        required: true,
        text: {
          en: "Which data minimisation measures apply (fields excluded, parameters removed, aggregation)?",
          es: "¿Qué medidas de minimización de datos se aplican (campos excluidos, parámetros eliminados, agregación)?",
        },
        help: join(
          {
            en: "Maryland limits collection to what is reasonably necessary.",
            es: "Maryland limita la recogida a lo razonablemente necesario.",
          },
          SRC_CATALOGUE("MODPA")
        ),
      },
      {
        id: "hd2_4",
        type: "select",
        required: true,
        showIf: whenJurisdiction("EU", "UK"),
        text: {
          en: "Which GDPR legal basis and, for health data, which Article 9(2) condition do you rely on?",
          es: "¿En qué base jurídica del RGPD y, para los datos de salud, en qué condición del artículo 9(2) te basas?",
        },
        help: join(
          {
            en: "An Article 9(2) condition must be identified for each special category. For health data used in advertising, explicit consent is usually the only available condition [to verify]. Legitimate interest can only support data that is not special category data.",
            es: "Debe identificarse una condición del artículo 9(2) para cada categoría especial. Para los datos de salud usados en publicidad, el consentimiento explícito suele ser la única condición disponible [por verificar]. El interés legítimo solo puede amparar datos que no sean de categoría especial.",
          },
          src(
            "DPO Central DPIA auto-fill rules (Art. 9(2)) and DPIA template (Art. 6 bases)",
            "reglas de autocompletado y plantilla de DPIA de DPO Central (condiciones del art. 9(2) y bases del art. 6)"
          )
        ),
        options: {
          en: [
            "Consent (Art. 6(1)(a)) and explicit consent (Art. 9(2)(a))",
            "Legitimate interests (Art. 6(1)(f)), with no special category data",
            "Another basis (explain in the notes)",
          ],
          es: [
            "Consentimiento (art. 6(1)(a)) y consentimiento explícito (art. 9(2)(a))",
            "Interés legítimo (art. 6(1)(f)), sin datos de categoría especial",
            "Otra base (explícala en las notas)",
          ],
        },
      },
      {
        id: "hd2_5",
        type: "textarea",
        required: false,
        showIf: whenJurisdiction("EU", "UK"),
        text: {
          en: "If you rely on legitimate interest, summarise the balancing test.",
          es: "Si te basas en el interés legítimo, resume la ponderación.",
        },
        help: join(
          {
            en: "Record the interest, the necessity and the balance against the individuals' rights; a full LIA can be attached.",
            es: "Deja constancia del interés, de la necesidad y de la ponderación frente a los derechos de las personas; puedes adjuntar una LIA completa.",
          },
          src(
            "GDPR Art. 6(1)(f), DPO Central LIA template",
            "art. 6(1)(f) del RGPD, plantilla de LIA de DPO Central"
          )
        ),
      },
    ],
  },
  {
    id: "hd3",
    title: { en: "Description of the processing", es: "Descripción del tratamiento" },
    description: {
      en: "The operational facts: sources, collection, data, retention, people affected and recipients.",
      es: "Los hechos operativos: fuentes, recogida, datos, conservación, personas afectadas y destinatarios.",
    },
    questions: [
      {
        id: "hd3_1",
        type: "textarea",
        required: true,
        text: {
          en: "What are the sources of the data (websites, apps, pages, partners)?",
          es: "¿De qué fuentes proceden los datos (sitios web, aplicaciones, páginas, socios)?",
        },
        help: SRC_PROCESSING,
      },
      {
        id: "hd3_2",
        type: "multiselect",
        required: true,
        text: {
          en: "How is the data collected?",
          es: "¿Cómo se recogen los datos?",
        },
        options: {
          en: [
            "Pixel or tag on web pages",
            "SDK in a mobile app",
            "Server-side events (conversion API)",
            "URL, search or event parameters",
            "Data received from partners or data brokers",
            "Other (explain in the notes)",
          ],
          es: [
            "Píxel o etiqueta en páginas web",
            "SDK en una aplicación móvil",
            "Eventos desde el servidor (API de conversiones)",
            "Parámetros de URL, de búsqueda o de eventos",
            "Datos recibidos de socios o de intermediarios de datos",
            "Otro (explícalo en las notas)",
          ],
        },
      },
      {
        id: "hd3_3",
        type: "textarea",
        required: true,
        text: {
          en: "Which categories of data are processed, field by field?",
          es: "¿Qué categorías de datos se tratan, campo por campo?",
        },
        help: {
          en: "List each field and event: event names, page URLs and paths, search terms, product categories, device identifiers, IP address, location. Mark any field that can reveal a health condition.",
          es: "Enumera cada campo y evento: nombres de eventos, URL y rutas de páginas, términos de búsqueda, categorías de producto, identificadores de dispositivo, dirección IP, ubicación. Marca cualquier campo que pueda revelar una condición de salud.",
        },
      },
      {
        id: "hd3_4",
        type: "textarea",
        required: true,
        text: {
          en: "How long is each category kept, by you and by each recipient?",
          es: "¿Durante cuánto tiempo se conserva cada categoría, por tu parte y por cada destinatario?",
        },
      },
      {
        id: "hd3_5",
        type: "textarea",
        required: true,
        text: {
          en: "Which consumers are affected, and how many?",
          es: "¿Qué consumidores se ven afectados y cuántos son?",
        },
        help: {
          en: "Include minors and other vulnerable groups where relevant.",
          es: "Incluye a los menores y a otros colectivos vulnerables cuando proceda.",
        },
      },
      {
        id: "hd3_6",
        type: "textarea",
        required: true,
        text: {
          en: "Who receives the data, and in what role?",
          es: "¿Quién recibe los datos y en qué calidad?",
        },
        help: join(
          {
            en: "For each recipient give the role: service provider, contractor or third party (CCPA); processor or controller (GDPR).",
            es: "Para cada destinatario indica su calidad: proveedor de servicios, contratista o tercero (CCPA); encargado o responsable del tratamiento (RGPD).",
          },
          SRC_CATALOGUE("CCPA/CPRA and GDPR")
        ),
      },
      {
        id: "hd3_7",
        type: "textarea",
        required: true,
        text: {
          en: "Which disclosures to third parties take place, and is any of them a sale or sharing?",
          es: "¿Qué comunicaciones a terceros se producen y alguna de ellas constituye una venta o un intercambio (sharing)?",
        },
      },
    ],
  },
  {
    id: "hd4",
    title: { en: "Benefits", es: "Beneficios" },
    description: {
      en: "The benefits to weigh against the risks.",
      es: "Los beneficios que se ponderan frente a los riesgos.",
    },
    questions: [
      {
        id: "hd4_1",
        type: "textarea",
        required: true,
        text: { en: "What are the benefits to the business?", es: "¿Qué beneficios obtiene la empresa?" },
        help: SRC_CA_BENEFITS,
      },
      {
        id: "hd4_2",
        type: "textarea",
        required: true,
        text: { en: "What are the benefits to consumers?", es: "¿Qué beneficios obtienen los consumidores?" },
      },
      {
        id: "hd4_3",
        type: "textarea",
        required: false,
        text: { en: "What are the benefits to the public, if any?", es: "¿Qué beneficios obtiene la sociedad, si los hay?" },
      },
    ],
  },
  {
    id: "hd5",
    title: { en: "Negative impacts", es: "Impactos negativos" },
    description: {
      en: "The harms the processing could cause to consumers.",
      es: "Los daños que el tratamiento podría causar a los consumidores.",
    },
    questions: [
      {
        id: "hd5_1",
        type: "multiselect",
        required: true,
        text: {
          en: "Which negative impacts could the processing cause?",
          es: "¿Qué impactos negativos podría causar el tratamiento?",
        },
        help: SRC_IMPACTS,
        options: {
          en: [
            "Unauthorised access or disclosure",
            "Discrimination",
            "Loss of consumer control over their data",
            "Coercive or manipulative practices",
            "Economic harm",
            "Physical harm",
            "Reputational harm",
            "Psychological harm",
          ],
          es: [
            "Acceso o comunicación no autorizados",
            "Discriminación",
            "Pérdida de control del consumidor sobre sus datos",
            "Prácticas coercitivas o manipuladoras",
            "Daño económico",
            "Daño físico",
            "Daño reputacional",
            "Daño psicológico",
          ],
        },
      },
      {
        id: "hd5_2",
        type: "textarea",
        required: true,
        text: {
          en: "For each impact selected, describe how it could occur, its likelihood and its severity.",
          es: "Para cada impacto seleccionado, describe cómo podría producirse, su probabilidad y su gravedad.",
        },
        help: SRC_IMPACTS,
      },
    ],
  },
  {
    id: "hd6",
    title: {
      en: "Is it health data? Five-factor classification",
      es: "¿Son datos de salud? Clasificación por cinco factores",
    },
    description: {
      en: "Score each factor; the report adds the scores (0 to 15) and gives a band.",
      es: "Puntúa cada factor; el informe suma las puntuaciones (de 0 a 15) y asigna una banda.",
    },
    questions: [
      {
        id: "hd6_1",
        type: "select",
        required: true,
        text: { en: "Factor 1, source: where does the data come from?", es: "Factor 1, fuente: ¿de dónde proceden los datos?" },
        help: {
          en: "Options are in rising order of risk (0 to 3). Method of this template, not a legal test: the five factors follow the NAI Factor Analysis (2026), and the scoring and the bands are the template's own.",
          es: "Las opciones van en orden creciente de riesgo (0 a 3). Método de esta plantilla, no un criterio legal: los cinco factores siguen el NAI Factor Analysis (2026), y la puntuación y las bandas son propias de la plantilla.",
        },
        options: {
          en: [
            "General-audience context with no link to health",
            "Wellness or lifestyle context",
            "Health-related page, app or search",
            "Healthcare provider, pharmacy or health app",
          ],
          es: [
            "Contexto de público general sin relación con la salud",
            "Contexto de bienestar o estilo de vida",
            "Página, aplicación o búsqueda relacionada con la salud",
            "Prestador sanitario, farmacia o aplicación de salud",
          ],
        },
      },
      {
        id: "hd6_2",
        type: "select",
        required: true,
        text: { en: "Factor 2, content: what does the data say?", es: "Factor 2, contenido: ¿qué revelan los datos?" },
        options: {
          en: [
            "No health information",
            "An indirect indicator, such as a product category",
            "A health interest or an inferred condition",
            "A specific condition or treatment, or reproductive or sexual health",
          ],
          es: [
            "Ninguna información de salud",
            "Un indicio indirecto, como una categoría de producto",
            "Un interés por la salud o una condición inferida",
            "Una condición o un tratamiento concretos, o salud reproductiva o sexual",
          ],
        },
      },
      {
        id: "hd6_3",
        type: "select",
        required: true,
        text: { en: "Factor 3, use: how is the data used?", es: "Factor 3, uso: ¿cómo se usan los datos?" },
        options: {
          en: [
            "Measurement only, no targeting",
            "Broad contextual advertising",
            "Audience segment based on a health interest",
            "Targeting or excluding individuals by health condition",
          ],
          es: [
            "Solo medición, sin segmentación",
            "Publicidad contextual amplia",
            "Segmento de audiencia basado en un interés por la salud",
            "Segmentación o exclusión de personas por su condición de salud",
          ],
        },
      },
      {
        id: "hd6_4",
        type: "select",
        required: true,
        text: {
          en: "Factor 4, expectations: would consumers expect this use?",
          es: "Factor 4, expectativas: ¿esperarían los consumidores este uso?",
        },
        options: {
          en: [
            "Consumers expect it",
            "Consumers probably expect it",
            "Consumers probably do not expect it",
            "Consumers would not expect it",
          ],
          es: [
            "Los consumidores lo esperan",
            "Los consumidores probablemente lo esperan",
            "Los consumidores probablemente no lo esperan",
            "Los consumidores no lo esperarían",
          ],
        },
      },
      {
        id: "hd6_5",
        type: "select",
        required: true,
        text: {
          en: "Factor 5, harm: how serious would the harm be if the data were misused or disclosed?",
          es: "Factor 5, daño: ¿qué gravedad tendría el daño si los datos se usaran indebidamente o se revelaran?",
        },
        options: {
          en: [
            "Negligible",
            "Limited",
            "Significant",
            "Severe (for example discrimination or disclosure of a condition)",
          ],
          es: [
            "Insignificante",
            "Limitado",
            "Significativo",
            "Grave (por ejemplo, discriminación o revelación de una condición)",
          ],
        },
      },
      {
        id: "hd6_6",
        type: "textarea",
        required: false,
        text: { en: "Reasons for the scores", es: "Motivos de las puntuaciones" },
      },
    ],
  },
  {
    id: "hd7",
    title: {
      en: "Safeguards and mitigation",
      es: "Garantías y mitigación",
    },
    description: {
      en: "The measures that address the risks and the main mitigation route chosen.",
      es: "Las medidas que abordan los riesgos y la vía principal de mitigación elegida.",
    },
    questions: [
      {
        id: MITIGATION_QUESTION_ID,
        type: "select",
        required: true,
        text: { en: "Which main mitigation route do you choose?", es: "¿Qué vía principal de mitigación eliges?" },
        help: SRC_SAFEGUARDS,
        options: MITIGATION_OPTIONS,
      },
      {
        id: "hd7_2",
        type: "multiselect",
        required: true,
        text: { en: "Which other safeguards apply?", es: "¿Qué otras garantías se aplican?" },
        help: join(
          {
            en: "Colorado, Connecticut and Texas recognise universal opt-out mechanisms.",
            es: "Colorado, Connecticut y Texas reconocen los mecanismos universales de exclusión voluntaria.",
          },
          SRC_CATALOGUE("CPA, CTDPA and TDPSA")
        ),
        options: {
          en: [
            "Remove URL paths, search terms and parameters from pixel and SDK events",
            "Honour opt-out preference signals",
            "Contract terms prohibiting re-identification and onward use",
            "Partner due diligence before any disclosure",
            "Shorter retention for health-related events",
            "Access controls and audit logging",
            "Other (explain in the notes)",
          ],
          es: [
            "Eliminar rutas de URL, términos de búsqueda y parámetros de los eventos del píxel y del SDK",
            "Respetar las señales de preferencia de exclusión voluntaria",
            "Cláusulas contractuales que prohíben la reidentificación y el uso posterior",
            "Diligencia debida sobre el socio antes de cualquier comunicación",
            "Plazo de conservación más breve para los eventos relacionados con la salud",
            "Controles de acceso y registro de auditoría",
            "Otra (explícala en las notas)",
          ],
        },
      },
      {
        id: "hd7_3",
        type: "textarea",
        required: false,
        text: {
          en: "Describe the partner due diligence and the contract terms in place.",
          es: "Describe la diligencia debida sobre los socios y las cláusulas contractuales vigentes.",
        },
      },
    ],
  },
  {
    id: "hd8",
    title: {
      en: "Requirements of the selected jurisdictions",
      es: "Requisitos de las jurisdicciones seleccionadas",
    },
    description: {
      en: "Questions added by the jurisdictions selected under \"Scope and threshold analysis\".",
      es: "Preguntas que añaden las jurisdicciones seleccionadas en «Alcance y análisis de umbral».",
    },
    questions: [
      {
        id: "hd8_1",
        type: "boolean",
        required: true,
        showIf: whenJurisdiction("WA", "NV"),
        text: {
          en: "Washington or Nevada: do you obtain the consumer's consent before collecting consumer health data, and separate consent before sharing it?",
          es: "Washington o Nevada: ¿obtienes el consentimiento del consumidor antes de recoger sus datos de salud y un consentimiento distinto antes de compartirlos?",
        },
        help: join(YES_NO_NOTE, SRC_WA_NV_CONSENT),
      },
      {
        id: "hd8_2",
        type: "boolean",
        required: true,
        showIf: whenJurisdiction("WA", "NV"),
        text: {
          en: "Washington or Nevada: is any consumer health data sold, and if so, do you hold a valid signed authorisation from each consumer?",
          es: "Washington o Nevada: ¿se vende algún dato de salud del consumidor y, en tal caso, cuentas con una autorización firmada y válida de cada consumidor?",
        },
        help: join(
          {
            en: "Answer Yes only if there is no sale, or every sale is covered by a signed authorisation naming the data, the seller and each purchaser.",
            es: "Responde Sí solo si no hay venta o si cada venta está cubierta por una autorización firmada que identifique los datos, al vendedor y a cada comprador.",
          },
          SRC_WA_NV_SALE
        ),
      },
      {
        id: "hd8_3",
        type: "boolean",
        required: true,
        showIf: whenJurisdiction("WA", "NV"),
        text: {
          en: "Washington or Nevada: do you use a geofence around places where health care is provided to identify, track or send messages to consumers?",
          es: "Washington o Nevada: ¿utilizas una geovalla alrededor de lugares donde se prestan servicios sanitarios para identificar o seguir a los consumidores, o para enviarles mensajes?",
        },
        help: join(
          {
            en: "This geofencing is prohibited: within 2,000 feet of in-person health care in Washington, within 1,750 feet of a medical facility in Nevada. A Yes is reported as a breach to resolve.",
            es: "Esta geovalla está prohibida: a menos de 2.000 pies de asistencia sanitaria presencial en Washington y a menos de 1.750 pies de un centro médico en Nevada. Un Sí aparece en el informe como un incumplimiento que debe resolverse.",
          },
          SRC_WA_NV_GEOFENCE
        ),
      },
      {
        id: "hd8_4",
        type: "boolean",
        required: true,
        showIf: whenJurisdiction("MD"),
        text: {
          en: "Maryland: does any disclosure amount to a sale of sensitive data, including health data?",
          es: "Maryland: ¿alguna comunicación constituye una venta de datos sensibles, incluidos los de salud?",
        },
        help: join(
          {
            en: "Maryland prohibits the sale of sensitive data; it is not only an opt-out, and consent does not make such a sale lawful. Sensitive data may be processed only where strictly necessary for a product or service the consumer requested.",
            es: "Maryland prohíbe vender datos sensibles; no es solo un derecho de oposición, y el consentimiento no hace lícita esa venta. Los datos sensibles solo pueden tratarse cuando sea estrictamente necesario para un producto o servicio solicitado por el consumidor.",
          },
          SRC_MD_SALE
        ),
      },
      {
        id: "hd8_5",
        type: "boolean",
        required: true,
        showIf: whenJurisdiction("CA"),
        text: {
          en: "California: do you offer and honour the right to limit the use and disclosure of sensitive personal information?",
          es: "California: ¿ofreces y respetas el derecho a limitar el uso y la comunicación de la información personal sensible?",
        },
        help: SRC_CATALOGUE("CCPA/CPRA"),
      },
      {
        id: "hd8_6",
        type: "text",
        required: true,
        showIf: whenJurisdiction("CA"),
        text: {
          en: "California: on what date was this risk assessment documented, and when is the abridged filing due?",
          es: "California: ¿en qué fecha se documentó esta evaluación de riesgos y cuándo vence la presentación abreviada?",
        },
        help: join(
          {
            en: "Timetable: assess before the processing starts; processing begun before 2026 must be assessed by 31 December 2027; summary information and an executive attestation are submitted to CalPrivacy by 1 April 2028; the full report is produced within 30 days of a request. Use the format YYYY-MM-DD.",
            es: "Calendario: evaluar antes de iniciar el tratamiento; el tratamiento iniciado antes de 2026 debe evaluarse a más tardar el 31 de diciembre de 2027; la información resumida y la declaración de un directivo se presentan a CalPrivacy a más tardar el 1 de abril de 2028; el informe completo se entrega en 30 días desde el requerimiento. Usa el formato AAAA-MM-DD.",
          },
          SRC_CA_TIMETABLE
        ),
      },
      {
        id: "hd8_7",
        type: "text",
        required: true,
        showIf: whenJurisdiction("CA"),
        text: {
          en: "California: which executive will sign the attestation that accompanies the filing (name and title)?",
          es: "California: ¿qué directivo firmará la declaración que acompaña a la presentación (nombre y cargo)?",
        },
        help: join(
          {
            en: "The attestation is made under penalty of perjury by a member of executive management who is directly responsible for risk-assessment compliance.",
            es: "La declaración se hace bajo pena de perjurio y la firma un miembro de la alta dirección directamente responsable del cumplimiento en evaluaciones de riesgos.",
          },
          SRC_CA_ATTESTATION
        ),
      },
      {
        id: "hd8_8",
        type: "boolean",
        required: true,
        showIf: whenJurisdiction(...US_STATE_LAW_CODES),
        text: {
          en: "US states: do you obtain opt-in consent before processing sensitive data, including health data?",
          es: "Estados de EE. UU.: ¿obtienes consentimiento expreso (opt-in) antes de tratar datos sensibles, incluidos los de salud?",
        },
        help: join(
          SRC_CATALOGUE("CTDPA, CPA, VCDPA, TDPSA and OCPA"),
          {
            en: "For other states, check each law [to verify]. In Maryland, consent does not permit a sale.",
            es: "En otros estados, revisa cada ley [por verificar]. En Maryland, el consentimiento no permite una venta.",
          }
        ),
      },
      {
        id: "hd8_9",
        type: "boolean",
        required: true,
        showIf: whenJurisdiction(...US_STATE_LAW_CODES),
        text: {
          en: "US states: can consumers opt out of targeted advertising and the sale of their data?",
          es: "Estados de EE. UU.: ¿pueden los consumidores excluirse de la publicidad segmentada y de la venta de sus datos?",
        },
        help: join(
          SRC_CATALOGUE("CTDPA, CPA, VCDPA, TDPSA and OCPA (right to opt out)"),
          {
            en: "The exact scope of the opt-out in each state [to verify].",
            es: "El alcance exacto del derecho en cada estado [por verificar].",
          }
        ),
      },
      {
        id: "hd8_10",
        type: "boolean",
        required: true,
        showIf: whenJurisdiction("EU", "UK"),
        text: {
          en: "EU/EEA or UK: did you seek the advice of the data protection officer on this DPIA?",
          es: "UE/EEE o Reino Unido: ¿has recabado el asesoramiento del delegado de protección de datos sobre esta EIPD?",
        },
        help: src(
          "DPO Central DPIA template (consultation section)",
          "plantilla de DPIA de DPO Central (sección de consulta)"
        ),
      },
    ],
  },
  {
    id: "hd9",
    title: {
      en: "Residual risk and determination",
      es: "Riesgo residual y decisión final",
    },
    description: {
      en: "The risk that remains after the safeguards, and the decision.",
      es: "El riesgo que subsiste tras las garantías y la decisión adoptada.",
    },
    questions: [
      {
        id: RESIDUAL_RISK_QUESTION_ID,
        type: "select",
        required: true,
        text: {
          en: "What is the residual risk after the safeguards?",
          es: "¿Cuál es el riesgo residual tras las garantías?",
        },
        help: SRC_DPIA_TEMPLATE,
        options: RISK_OPTIONS,
      },
      {
        id: DETERMINATION_QUESTION_ID,
        type: "select",
        required: true,
        text: { en: "Final determination", es: "Decisión final" },
        help: SRC_CA_DECISION,
        options: {
          en: [
            "Proceed as planned",
            "Proceed with the safeguards listed",
            "Proceed only after prior consultation with the supervisory authority",
            "Do not proceed",
          ],
          es: [
            "Seguir adelante según lo previsto",
            "Seguir adelante con las garantías indicadas",
            "Seguir adelante solo tras la consulta previa a la autoridad de control",
            "No seguir adelante",
          ],
        },
      },
      {
        id: PRIOR_CONSULTATION_QUESTION_ID,
        type: "boolean",
        required: true,
        showIf: whenJurisdiction("EU", "UK"),
        text: {
          en: "EU/EEA or UK: is prior consultation with the supervisory authority required (Art. 36)?",
          es: "UE/EEE o Reino Unido: ¿es necesaria la consulta previa a la autoridad de control (art. 36)?",
        },
        help: join(
          {
            en: "Required where the DPIA shows a high risk that the measures do not reduce. The report flags it when the residual risk is High or Very high.",
            es: "Es necesaria cuando la EIPD muestra un riesgo alto que las medidas no reducen. El informe lo señala cuando el riesgo residual es Alto o Muy alto.",
          },
          SRC_DPIA_TEMPLATE
        ),
      },
      {
        id: "hd9_4",
        type: "textarea",
        required: true,
        text: { en: "Reasons for the determination", es: "Motivos de la decisión" },
      },
    ],
  },
  {
    id: "hd10",
    title: { en: "Approval", es: "Aprobación" },
    description: {
      en: "Who signs, when, and when the assessment will be reviewed.",
      es: "Quién firma, cuándo y cuándo se revisará la evaluación.",
    },
    questions: [
      {
        id: SIGNATURE_QUESTION_IDS.signer,
        type: "text",
        required: true,
        text: {
          en: "Executive who approves and signs (name and title)",
          es: "Directivo que aprueba y firma (nombre y cargo)",
        },
        help: join(
          {
            en: "Record also who contributed to the assessment.",
            es: "Indica también quién ha participado en la evaluación.",
          },
          SRC_CA_DECISION
        ),
      },
      {
        id: SIGNATURE_QUESTION_IDS.date,
        type: "text",
        required: true,
        text: { en: "Date of approval (YYYY-MM-DD)", es: "Fecha de aprobación (AAAA-MM-DD)" },
      },
      {
        id: SIGNATURE_QUESTION_IDS.review,
        type: "text",
        required: true,
        text: { en: "Review date (YYYY-MM-DD)", es: "Fecha de revisión (AAAA-MM-DD)" },
        help: {
          en: "Review at least when the processing, the partners or the law change.",
          es: "Revisa la evaluación al menos cuando cambien el tratamiento, los socios o la ley.",
        },
      },
    ],
  },
];

export const HEALTH_ADTECH_NAME: BiText = {
  en: "Health data in advertising: CCPA risk assessment and GDPR DPIA",
  es: "Datos de salud en publicidad: evaluación de riesgos de la CCPA y EIPD del RGPD",
};

export const HEALTH_ADTECH_DESCRIPTION: BiText = {
  en: "One global assessment for pixels, SDKs and audiences that may involve health data: the nine elements of a CCPA risk assessment (11 CCR 7152(a)) and the GDPR Article 35(7) content, with questions and obligations that follow the jurisdictions selected. Draft for review by counsel; statements marked [to verify] are not yet confirmed. This template is informational, not legal advice.",
  es: "Una evaluación global para píxeles, SDK y audiencias que pueden implicar datos de salud: los nueve elementos de una evaluación de riesgos de la CCPA (11 CCR 7152(a)) y el contenido del artículo 35(7) del RGPD, con preguntas y obligaciones que siguen a las jurisdicciones seleccionadas. Borrador para revisión por un abogado; las afirmaciones marcadas [por verificar] aún no están confirmadas. Esta plantilla es informativa y no constituye asesoramiento jurídico.",
};

// ── Stored (English) template ─────────────────────────────────────────────

function toStoredQuestion(q: BiQuestion) {
  return {
    id: q.id,
    text: q.text.en,
    type: q.type,
    required: q.required,
    ...(q.help ? { helpText: q.help.en } : {}),
    ...(q.options ? { options: q.options.en } : {}),
    ...(q.showIf ? { showIf: q.showIf } : {}),
  };
}

export const healthAdtechTemplateData = {
  type: "DPIA" as const,
  name: HEALTH_ADTECH_NAME.en,
  description: HEALTH_ADTECH_DESCRIPTION.en,
  version: HEALTH_ADTECH_TEMPLATE_VERSION,
  isSystem: true,
  isActive: true,
  sections: HEALTH_ADTECH_SECTIONS.map((s) => ({
    id: s.id,
    title: s.title.en,
    description: s.description.en,
    ...(s.showIf ? { showIf: s.showIf } : {}),
    questions: s.questions.map(toStoredQuestion),
  })),
  scoringLogic: {
    method: HEALTH_ADTECH_SCORING_METHOD,
    riskLevels: {
      LOW: { min: 0, max: 25 },
      MEDIUM: { min: 26, max: 50 },
      HIGH: { min: 51, max: 75 },
      CRITICAL: { min: 76, max: 100 },
    },
  },
};

// ── Message bundle entries (templates.dpia.*) ─────────────────────────────

type MessageTree = {
  template: Record<string, { name: string; description: string }>;
  section: Record<string, { title: string; description: string }>;
  question: Record<string, { text: string; helpText?: string; options?: string[] }>;
};

/** The entries this template adds under templates.dpia in a locale bundle. */
export function healthAdtechMessages(locale: "en" | "es"): MessageTree {
  const tree: MessageTree = {
    template: {
      [HEALTH_ADTECH_TEMPLATE_ID]: {
        name: HEALTH_ADTECH_NAME[locale],
        description: HEALTH_ADTECH_DESCRIPTION[locale],
      },
    },
    section: {},
    question: {},
  };
  for (const s of HEALTH_ADTECH_SECTIONS) {
    tree.section[s.id] = { title: s.title[locale], description: s.description[locale] };
    for (const q of s.questions) {
      tree.question[q.id] = {
        text: q.text[locale],
        ...(q.help ? { helpText: q.help[locale] } : {}),
        ...(q.options ? { options: q.options[locale] } : {}),
      };
    }
  }
  return tree;
}
