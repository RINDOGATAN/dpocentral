// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Framework conformance for assessments, expressed as data.
 *
 * An assessment states which legal requirements it covers and which are still
 * outstanding. Each requirement is one row here: the framework it belongs to,
 * the primary citation, a plain label in both languages, and the template
 * questions whose answers cover it. Nothing is prose, so the app, the export
 * and the tests all read the same table.
 *
 * Only primary sources are cited: the article or the section number. No
 * secondary summaries.
 *
 * Sources, checked on 19 September 2026:
 *  - Regulation (EU) 2016/679, Articles 35 and 36.
 *  - California Code of Regulations, title 11, division 6, chapter 1,
 *    article 10, sections 7150, 7152, 7155 and 7157.
 *
 * This is a draft for review by counsel, not legal advice.
 */

import { answerValues, canonicalValues, type AnswerMap } from "@/lib/assessment-conditions";

export interface BiText {
  en: string;
  es: string;
}

export type FrameworkId = "EU_GDPR" | "US_CCPA";

export const FRAMEWORK_IDS: FrameworkId[] = ["EU_GDPR", "US_CCPA"];

export const FRAMEWORK_LABELS: Record<FrameworkId, BiText> = {
  EU_GDPR: { en: "European Union", es: "Unión Europea" },
  US_CCPA: { en: "California", es: "California" },
};

export const FRAMEWORK_CITATIONS: Record<FrameworkId, BiText> = {
  EU_GDPR: {
    en: "Regulation (EU) 2016/679, Articles 35 and 36",
    es: "Reglamento (UE) 2016/679, artículos 35 y 36",
  },
  US_CCPA: {
    en: "11 CCR sections 7150, 7152, 7155 and 7157",
    es: "11 CCR, secciones 7150, 7152, 7155 y 7157",
  },
};

// ── The question that records the choice ─────────────────────────────────

/** Id of the multiselect that records the frameworks, in the DPIA template. */
export const FRAMEWORK_QUESTION_ID = "q0_1";

/**
 * The options of that question, in the language the template stores (en) and
 * in Spanish. `showIf.anyOf` matches the English strings exactly.
 */
export const FRAMEWORK_OPTIONS: { en: string[]; es: string[] } = {
  en: [
    "European Union: Regulation (EU) 2016/679, Article 35",
    "California: CCPA risk assessment regulations, 11 CCR article 10",
  ],
  es: [
    "Unión Europea: Reglamento (UE) 2016/679, artículo 35",
    "California: reglamento de evaluación de riesgos de la CCPA, 11 CCR artículo 10",
  ],
};

export const EU_OPTION = FRAMEWORK_OPTIONS.en[0];
export const CA_OPTION = FRAMEWORK_OPTIONS.en[1];

const OPTION_TO_FRAMEWORK: Record<string, FrameworkId> = {
  [EU_OPTION]: "EU_GDPR",
  [CA_OPTION]: "US_CCPA",
};

// ── California: the six activities that trigger a risk assessment ────────

/**
 * 11 CCR 7150(b). The same six activities the health-data advertising
 * template offers, so the product states the law once.
 * tests/assessment-frameworks.test.ts fails if the two lists drift apart.
 */
export const CCPA_TRIGGERS: { en: string[]; es: string[] } = {
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
};

/** The id of the question that records those triggers, in the DPIA template. */
export const CCPA_TRIGGER_QUESTION_ID = "q8_1";
/** The option that means no trigger is met. */
export const CCPA_NO_TRIGGER_OPTION = CCPA_TRIGGERS.en[CCPA_TRIGGERS.en.length - 1];

// ── The requirement table ────────────────────────────────────────────────

export interface FrameworkElement {
  /** Stable id, used by the tests and as a React key. */
  id: string;
  framework: FrameworkId;
  citation: BiText;
  label: BiText;
  /** Template questions whose answers cover this requirement. */
  questionIds: string[];
}

/** Template this table describes (src/config/dpia-template-v2.ts). */
export const CONFORMANCE_TEMPLATE_ID = "system-dpia-template";

export const DPIA_FRAMEWORK_ELEMENTS: FrameworkElement[] = [
  // ── Regulation (EU) 2016/679 ──
  {
    id: "gdpr_35_7_a",
    framework: "EU_GDPR",
    citation: { en: "Art. 35(7)(a)", es: "art. 35(7)(a)" },
    label: {
      en: "A systematic description of the envisaged processing operations and the purposes, including where applicable the legitimate interest pursued",
      es: "Una descripción sistemática de las operaciones de tratamiento previstas y de los fines, incluido, en su caso, el interés legítimo perseguido",
    },
    questionIds: ["q1_1", "q1_2", "q1_3", "q1_6"],
  },
  {
    id: "gdpr_35_7_b",
    framework: "EU_GDPR",
    citation: { en: "Art. 35(7)(b)", es: "art. 35(7)(b)" },
    label: {
      en: "An assessment of the necessity and proportionality of the processing in relation to the purposes",
      es: "Una evaluación de la necesidad y la proporcionalidad del tratamiento en relación con los fines",
    },
    questionIds: ["q3_1", "q3_2", "q3_3"],
  },
  {
    id: "gdpr_35_7_c",
    framework: "EU_GDPR",
    citation: { en: "Art. 35(7)(c)", es: "art. 35(7)(c)" },
    label: {
      en: "An assessment of the risks to the rights and freedoms of data subjects",
      es: "Una evaluación de los riesgos para los derechos y libertades de los interesados",
    },
    questionIds: ["q5_6"],
  },
  {
    id: "gdpr_35_7_d",
    framework: "EU_GDPR",
    citation: { en: "Art. 35(7)(d)", es: "art. 35(7)(d)" },
    label: {
      en: "The measures envisaged to address the risks, including safeguards, security measures and mechanisms to ensure the protection of personal data and to demonstrate compliance",
      es: "Las medidas previstas para afrontar los riesgos, incluidas garantías, medidas de seguridad y mecanismos que garanticen la protección de datos personales y demuestren la conformidad",
    },
    questionIds: ["q6_1", "q6_2", "q6_3"],
  },
  {
    id: "gdpr_35_2",
    framework: "EU_GDPR",
    citation: { en: "Art. 35(2)", es: "art. 35(2)" },
    label: {
      en: "The advice of the data protection officer, where one is designated",
      es: "El asesoramiento del delegado de protección de datos, cuando haya sido designado",
    },
    questionIds: ["q7_3"],
  },
  {
    id: "gdpr_35_9",
    framework: "EU_GDPR",
    citation: { en: "Art. 35(9)", es: "art. 35(9)" },
    label: {
      en: "The views of data subjects or their representatives, where appropriate",
      es: "La opinión de los interesados o de sus representantes, cuando proceda",
    },
    questionIds: ["q4_3"],
  },
  {
    id: "gdpr_36_1",
    framework: "EU_GDPR",
    citation: { en: "Art. 36(1)", es: "art. 36(1)" },
    label: {
      en: "Prior consultation with the supervisory authority where the residual risk remains high",
      es: "Consulta previa a la autoridad de control cuando el riesgo residual siga siendo alto",
    },
    questionIds: ["q7_2"],
  },
  {
    id: "gdpr_35_11",
    framework: "EU_GDPR",
    citation: { en: "Art. 35(11)", es: "art. 35(11)" },
    label: {
      en: "Review when the risk changes",
      es: "Revisión cuando cambie el riesgo",
    },
    questionIds: ["q7_4"],
  },

  // ── California Code of Regulations, title 11, article 10 ──
  {
    id: "ccpa_7150_b",
    framework: "US_CCPA",
    citation: { en: "11 CCR 7150(b)", es: "11 CCR 7150(b)" },
    label: {
      en: "Whether the processing is one of the six activities that require a risk assessment",
      es: "Si el tratamiento es una de las seis actividades que obligan a realizar una evaluación de riesgos",
    },
    questionIds: [CCPA_TRIGGER_QUESTION_ID],
  },
  {
    id: "ccpa_7152_a_1",
    framework: "US_CCPA",
    citation: { en: "11 CCR 7152(a)(1)", es: "11 CCR 7152(a)(1)" },
    label: {
      en: "The purpose of the processing activity",
      es: "La finalidad de la actividad de tratamiento",
    },
    questionIds: ["q1_2"],
  },
  {
    id: "ccpa_7152_a_2",
    framework: "US_CCPA",
    citation: { en: "11 CCR 7152(a)(2)", es: "11 CCR 7152(a)(2)" },
    label: {
      en: "The categories of personal information processed, and whether they include sensitive personal information",
      es: "Las categorías de información personal tratadas y si incluyen información personal sensible",
    },
    questionIds: ["q1_1", "q2_1"],
  },
  {
    id: "ccpa_7152_a_3",
    framework: "US_CCPA",
    citation: { en: "11 CCR 7152(a)(3)", es: "11 CCR 7152(a)(3)" },
    label: {
      en: "The operational elements of the processing",
      es: "Los elementos operativos del tratamiento",
    },
    questionIds: ["q8_2"],
  },
  {
    id: "ccpa_7152_a_4",
    framework: "US_CCPA",
    citation: { en: "11 CCR 7152(a)(4)", es: "11 CCR 7152(a)(4)" },
    label: {
      en: "The benefits of the processing to the business, the consumer, other stakeholders and the public",
      es: "Los beneficios del tratamiento para la empresa, el consumidor, otras partes interesadas y el público",
    },
    questionIds: ["q8_3"],
  },
  {
    id: "ccpa_7152_a_5",
    framework: "US_CCPA",
    citation: { en: "11 CCR 7152(a)(5)", es: "11 CCR 7152(a)(5)" },
    label: {
      en: "The negative impacts on consumers' privacy",
      es: "Los efectos negativos sobre la privacidad de los consumidores",
    },
    questionIds: ["q8_4"],
  },
  {
    id: "ccpa_7152_a_6",
    framework: "US_CCPA",
    citation: { en: "11 CCR 7152(a)(6)", es: "11 CCR 7152(a)(6)" },
    label: {
      en: "The safeguards planned to address the negative impacts",
      es: "Las salvaguardas previstas para afrontar los efectos negativos",
    },
    questionIds: ["q8_5"],
  },
  {
    id: "ccpa_7152_a_7",
    framework: "US_CCPA",
    citation: { en: "11 CCR 7152(a)(7)", es: "11 CCR 7152(a)(7)" },
    label: {
      en: "Whether the business will start or continue the processing, weighing the negative impacts as mitigated against the benefits",
      es: "Si la empresa iniciará o continuará el tratamiento, ponderando los efectos negativos ya mitigados frente a los beneficios",
    },
    questionIds: ["q8_6"],
  },
  {
    id: "ccpa_7152_a_8",
    framework: "US_CCPA",
    citation: { en: "11 CCR 7152(a)(8)", es: "11 CCR 7152(a)(8)" },
    label: {
      en: "The names and positions of the people who prepared, reviewed and approved the assessment",
      es: "Los nombres y cargos de quienes prepararon, revisaron y aprobaron la evaluación",
    },
    questionIds: ["q8_7"],
  },
  {
    id: "ccpa_7152_a_9",
    framework: "US_CCPA",
    citation: { en: "11 CCR 7152(a)(9)", es: "11 CCR 7152(a)(9)" },
    label: {
      en: "The dates on which the assessment was reviewed and approved",
      es: "Las fechas en que la evaluación fue revisada y aprobada",
    },
    questionIds: ["q8_8"],
  },
  {
    id: "ccpa_7155",
    framework: "US_CCPA",
    citation: { en: "11 CCR 7155", es: "11 CCR 7155" },
    label: {
      en: "When the assessment must be conducted, when it must be reviewed and updated, and how long it is kept",
      es: "Cuándo debe realizarse la evaluación, cuándo debe revisarse y actualizarse, y durante cuánto tiempo se conserva",
    },
    questionIds: ["q9_1", "q9_2"],
  },
  {
    id: "ccpa_7157",
    framework: "US_CCPA",
    citation: { en: "11 CCR 7157", es: "11 CCR 7157" },
    label: {
      en: "Submission to the agency by 1 April 2028, the executive attestation, and the duty to provide the full assessment within 30 days of a request",
      es: "Presentación a la agencia antes del 1 de abril de 2028, la certificación de un directivo y el deber de facilitar la evaluación completa en un plazo de 30 días desde la solicitud",
    },
    questionIds: ["q9_3", "q9_4", "q9_5"],
  },
];

/** The requirement table for a template, or null where none is defined. */
export function conformanceElementsFor(
  templateId: string | null | undefined
): FrameworkElement[] | null {
  return templateId === CONFORMANCE_TEMPLATE_ID ? DPIA_FRAMEWORK_ELEMENTS : null;
}

// ── Reading the answers ──────────────────────────────────────────────────

/**
 * The frameworks the assessment was created for. An answer saved in Spanish
 * is matched by position. While the question is unanswered the European
 * framework is assumed, which is what an assessment started before the
 * question existed was measured against.
 */
export function selectedFrameworks(answers: AnswerMap): FrameworkId[] {
  const raw = answerValues(answers[FRAMEWORK_QUESTION_ID]);
  const canonical = canonicalValues(raw, FRAMEWORK_OPTIONS.en, [FRAMEWORK_OPTIONS.es]);
  const chosen = canonical
    .map((v) => OPTION_TO_FRAMEWORK[v])
    .filter((f): f is FrameworkId => !!f);
  if (chosen.length === 0) return ["EU_GDPR"];
  return FRAMEWORK_IDS.filter((f) => chosen.includes(f));
}

/** True while the framework question has no answer at all. */
export function frameworkUnanswered(answers: AnswerMap): boolean {
  return answerValues(answers[FRAMEWORK_QUESTION_ID]).length === 0;
}

export type CaliforniaTriggerState = "required" | "not-required" | "unknown";

/**
 * Whether a California risk assessment is required at all (11 CCR 7150(b)).
 * "not-required" only when the answer is exactly "None of these".
 */
export function californiaTriggerState(answers: AnswerMap): CaliforniaTriggerState {
  const values = canonicalValues(
    answerValues(answers[CCPA_TRIGGER_QUESTION_ID]),
    CCPA_TRIGGERS.en,
    [CCPA_TRIGGERS.es]
  );
  if (values.length === 0) return "unknown";
  const triggers = values.filter((v) => v !== CCPA_NO_TRIGGER_OPTION);
  return triggers.length > 0 ? "required" : "not-required";
}

// ── Coverage ─────────────────────────────────────────────────────────────

export interface CoverageRow {
  element: FrameworkElement;
  covered: boolean;
  /** Questions of this element that are visible and still unanswered. */
  outstandingQuestionIds: string[];
  /** Where to jump to answer it: the first outstanding question, else the first. */
  sectionId: string | null;
  questionId: string | null;
}

export interface CoverageInput {
  /** Requirement table, usually from conformanceElementsFor(). */
  elements: FrameworkElement[];
  /** Frameworks the assessment was created for. */
  frameworks: FrameworkId[];
  /** Sections the answers make visible, in the order they are shown. */
  visibleSections: ReadonlyArray<{ id: string; questions?: ReadonlyArray<{ id: string }> }>;
  /** Ids of the questions that have an answer. */
  answeredQuestionIds: ReadonlySet<string>;
}

/**
 * One row per requirement of the frameworks selected. A requirement is
 * covered when every one of its questions that the assessment actually shows
 * has an answer, and at least one of them does. A requirement whose questions
 * are all hidden is still listed, and outstanding: the product never claims
 * conformance with a requirement nothing answers.
 */
export function frameworkCoverage(input: CoverageInput): CoverageRow[] {
  const sectionOf = new Map<string, string>();
  for (const section of input.visibleSections) {
    for (const q of section.questions ?? []) sectionOf.set(q.id, section.id);
  }

  return input.elements
    .filter((e) => input.frameworks.includes(e.framework))
    .map((element) => {
      const visible = element.questionIds.filter((id) => sectionOf.has(id));
      const outstanding = visible.filter((id) => !input.answeredQuestionIds.has(id));
      const covered = visible.length > 0 && outstanding.length === 0;
      const target = outstanding[0] ?? visible[0] ?? null;
      return {
        element,
        covered,
        outstandingQuestionIds: outstanding,
        sectionId: target ? (sectionOf.get(target) ?? null) : null,
        questionId: target,
      };
    });
}

export interface FrameworkSummary {
  framework: FrameworkId;
  covered: number;
  total: number;
  complete: boolean;
}

/** Covered and total per framework, in the order of FRAMEWORK_IDS. */
export function coverageSummary(rows: ReadonlyArray<CoverageRow>): FrameworkSummary[] {
  return FRAMEWORK_IDS.filter((f) => rows.some((r) => r.element.framework === f)).map((f) => {
    const own = rows.filter((r) => r.element.framework === f);
    const covered = own.filter((r) => r.covered).length;
    return { framework: f, covered, total: own.length, complete: covered === own.length };
  });
}

/** True when every requirement of every framework selected is covered. */
export function conformanceComplete(rows: ReadonlyArray<CoverageRow>): boolean {
  return rows.length > 0 && rows.every((r) => r.covered);
}
