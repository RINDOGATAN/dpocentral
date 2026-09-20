// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

// src/config/dpia-template-v2.ts
//
// The standard DPIA template. Reusable by seed scripts and the premium package.
//
// v3.0 adds the framework choice. The first question records whether the
// assessment has to satisfy the European rules, the Californian rules or both;
// `showIf` (src/lib/assessment-conditions.ts) then decides which questions are
// asked, and src/config/assessment-frameworks.ts turns the same answers into
// the conformance table the app and the export show.
//
// The text below is what the database stores (English). The Spanish of the
// sections and questions added in v3.0 lives beside it here and is written
// into the message bundles by scripts/sync-dpia-messages.ts;
// tests/assessment-frameworks.test.ts fails if the two drift apart. The v2
// sections keep their existing bundle entries untouched.
//
// Every legal statement names its primary source. This is a draft for review
// by counsel, not legal advice.

import {
  CA_OPTION,
  CCPA_TRIGGERS,
  CCPA_TRIGGER_QUESTION_ID,
  EU_OPTION,
  FRAMEWORK_OPTIONS,
  FRAMEWORK_QUESTION_ID,
  type BiText,
} from "./assessment-frameworks";
import type { ShowIf } from "@/lib/assessment-conditions";

export const DPIA_TEMPLATE_ID = "system-dpia-template";
export const DPIA_TEMPLATE_VERSION = "3.0";

// ── Conditions ───────────────────────────────────────────────────────────

/**
 * European content. `alsoWhenUnanswered` keeps these questions visible on an
 * assessment started before the framework question existed, so no answer is
 * ever hidden by an upgrade.
 */
const WHEN_EU: ShowIf = {
  questionId: FRAMEWORK_QUESTION_ID,
  anyOf: [EU_OPTION],
  alsoWhenUnanswered: true,
};

/** Californian content, all of it new in v3.0, so it appears only on request. */
const WHEN_CA: ShowIf = { questionId: FRAMEWORK_QUESTION_ID, anyOf: [CA_OPTION] };

// ── Bilingual source of the v3.0 additions ───────────────────────────────

type BiQuestionType = "text" | "textarea" | "select" | "multiselect" | "boolean";

interface BiQuestion {
  id: string;
  type: BiQuestionType;
  required: boolean;
  text: BiText;
  help?: BiText;
  options?: { en: string[]; es: string[] };
  showIf?: ShowIf;
}

interface BiSection {
  id: string;
  title: BiText;
  description: BiText;
  questions: BiQuestion[];
  showIf?: ShowIf;
}

const SCOPE_SECTION: BiSection = {
  id: "s0",
  title: { en: "Scope of this assessment", es: "Alcance de esta evaluación" },
  description: {
    en: "Choose the frameworks this assessment has to satisfy. The choice decides which questions are asked below and which requirements the report reports on.",
    es: "Elige los marcos que debe satisfacer esta evaluación. La elección determina qué preguntas se plantean a continuación y sobre qué requisitos informa el informe.",
  },
  questions: [
    {
      id: FRAMEWORK_QUESTION_ID,
      type: "multiselect",
      required: true,
      text: {
        en: "Which frameworks does this assessment have to satisfy?",
        es: "¿Qué marcos debe satisfacer esta evaluación?",
      },
      help: {
        en: "Select one or both. The report lists every requirement of the frameworks selected and marks each one covered or outstanding. Sources: Regulation (EU) 2016/679, Articles 35 and 36; California Code of Regulations, title 11, division 6, chapter 1, article 10.",
        es: "Selecciona uno o ambos. El informe enumera todos los requisitos de los marcos seleccionados y marca cada uno como cubierto o pendiente. Fuentes: Reglamento (UE) 2016/679, artículos 35 y 36; Código de Reglamentos de California, título 11, división 6, capítulo 1, artículo 10.",
      },
      options: FRAMEWORK_OPTIONS,
    },
  ],
};

/** Questions added to sections the template already had. */
const EXTRA_QUESTIONS: Record<string, BiQuestion[]> = {
  s4: [
    {
      id: "q4_3",
      type: "textarea",
      required: true,
      showIf: WHEN_EU,
      text: {
        en: "The views of data subjects or their representatives, or the reason for not seeking them",
        es: "La opinión de los interesados o de sus representantes, o el motivo por el que no se ha recabado",
      },
      help: {
        en: "Record what was asked, who answered and what came of it. Where seeking those views is not appropriate, record why. Source: Regulation (EU) 2016/679, Article 35(9).",
        es: "Anota qué se preguntó, quién respondió y qué resultó de ello. Si no procede recabar esa opinión, anota por qué. Fuente: Reglamento (UE) 2016/679, artículo 35(9).",
      },
    },
  ],
  s7: [
    {
      id: "q7_4",
      type: "textarea",
      required: true,
      showIf: WHEN_EU,
      text: {
        en: "When this assessment will be reviewed, and the change in risk that brings the review forward",
        es: "Cuándo se revisará esta evaluación y qué cambio del riesgo adelanta la revisión",
      },
      help: {
        en: "Give a review date and name the changes that require an earlier review, such as a new purpose, a new recipient or a new technology. Source: Regulation (EU) 2016/679, Article 35(11).",
        es: "Indica una fecha de revisión y nombra los cambios que obligan a revisarla antes, como una nueva finalidad, un nuevo destinatario o una tecnología nueva. Fuente: Reglamento (UE) 2016/679, artículo 35(11).",
      },
    },
  ],
};

const CALIFORNIA_CONTENT_SECTION: BiSection = {
  id: "s8",
  title: {
    en: "California: contents of the risk assessment",
    es: "California: contenido de la evaluación de riesgos",
  },
  description: {
    en: "The activities that make a risk assessment necessary, and the content items it must contain.",
    es: "Las actividades que hacen necesaria una evaluación de riesgos y los contenidos que debe incluir.",
  },
  showIf: WHEN_CA,
  questions: [
    {
      id: CCPA_TRIGGER_QUESTION_ID,
      type: "multiselect",
      required: true,
      text: {
        en: "Which California risk assessment triggers does the processing meet?",
        es: "¿Qué supuestos de evaluación de riesgos de California cumple el tratamiento?",
      },
      help: {
        en: "Any one of them means a risk assessment is required. If none apply, the report says so plainly and claims no Californian requirement. Source: 11 CCR 7150(b).",
        es: "Cualquiera de ellos obliga a realizar la evaluación de riesgos. Si no se cumple ninguno, el informe lo dice con claridad y no afirma ningún requisito de California. Fuente: 11 CCR 7150(b).",
      },
      options: CCPA_TRIGGERS,
    },
    {
      id: "q8_2",
      type: "textarea",
      required: true,
      text: {
        en: "Operational elements of the processing",
        es: "Elementos operativos del tratamiento",
      },
      help: {
        en: "How the personal information is collected, from which sources, how long it is kept, how many consumers it concerns, who it is disclosed to, and the technology used. Source: 11 CCR 7152(a)(3).",
        es: "Cómo se recoge la información personal, de qué fuentes, cuánto tiempo se conserva, a cuántos consumidores afecta, a quién se comunica y qué tecnología se emplea. Fuente: 11 CCR 7152(a)(3).",
      },
    },
    {
      id: "q8_3",
      type: "textarea",
      required: true,
      text: {
        en: "Benefits of the processing to the business, the consumer, other stakeholders and the public",
        es: "Beneficios del tratamiento para la empresa, el consumidor, otras partes interesadas y el público",
      },
      help: {
        en: "Source: 11 CCR 7152(a)(4).",
        es: "Fuente: 11 CCR 7152(a)(4).",
      },
    },
    {
      id: "q8_4",
      type: "textarea",
      required: true,
      text: {
        en: "Negative impacts on consumers' privacy",
        es: "Efectos negativos sobre la privacidad de los consumidores",
      },
      help: {
        en: "Describe each impact, who it falls on and how serious it is. Source: 11 CCR 7152(a)(5).",
        es: "Describe cada efecto, sobre quién recae y su gravedad. Fuente: 11 CCR 7152(a)(5).",
      },
    },
    {
      id: "q8_5",
      type: "textarea",
      required: true,
      text: {
        en: "Safeguards planned to address the negative impacts",
        es: "Salvaguardas previstas para afrontar los efectos negativos",
      },
      help: {
        en: "Source: 11 CCR 7152(a)(6).",
        es: "Fuente: 11 CCR 7152(a)(6).",
      },
    },
    {
      id: "q8_6",
      type: "select",
      required: true,
      text: {
        en: "Will the business start or continue the processing?",
        es: "¿Iniciará o continuará la empresa el tratamiento?",
      },
      help: {
        en: "Weigh the negative impacts, as mitigated by the safeguards, against the benefits. Source: 11 CCR 7152(a)(7).",
        es: "Pondera los efectos negativos, ya mitigados por las salvaguardas, frente a los beneficios. Fuente: 11 CCR 7152(a)(7).",
      },
      options: {
        en: [
          "Yes: the benefits outweigh the negative impacts once the safeguards are in place",
          "No: the negative impacts outweigh the benefits",
          "Not decided yet",
        ],
        es: [
          "Sí: los beneficios superan a los efectos negativos una vez aplicadas las salvaguardas",
          "No: los efectos negativos superan a los beneficios",
          "Aún sin decidir",
        ],
      },
    },
    {
      id: "q8_7",
      type: "textarea",
      required: true,
      text: {
        en: "Names and positions of the people who prepared, reviewed and approved this assessment",
        es: "Nombres y cargos de quienes prepararon, revisaron y aprobaron esta evaluación",
      },
      help: {
        en: "Source: 11 CCR 7152(a)(8).",
        es: "Fuente: 11 CCR 7152(a)(8).",
      },
    },
    {
      id: "q8_8",
      type: "text",
      required: true,
      text: {
        en: "Dates on which this assessment was reviewed and approved",
        es: "Fechas en que esta evaluación fue revisada y aprobada",
      },
      help: {
        en: "Source: 11 CCR 7152(a)(9).",
        es: "Fuente: 11 CCR 7152(a)(9).",
      },
    },
  ],
};

const CALIFORNIA_TIMETABLE_SECTION: BiSection = {
  id: "s9",
  title: {
    en: "California: timetable, submission and attestation",
    es: "California: plazos, presentación y certificación",
  },
  description: {
    en: "When the assessment is conducted, reviewed and kept, and what has to reach the agency.",
    es: "Cuándo se realiza, se revisa y se conserva la evaluación, y qué debe llegar a la agencia.",
  },
  showIf: WHEN_CA,
  questions: [
    {
      id: "q9_1",
      type: "select",
      required: true,
      text: {
        en: "When is this assessment being conducted, in relation to the processing?",
        es: "¿Cuándo se realiza esta evaluación en relación con el tratamiento?",
      },
      help: {
        en: "Source: 11 CCR 7155(a).",
        es: "Fuente: 11 CCR 7155(a).",
      },
      options: {
        en: [
          "Before the processing begins",
          "The processing is already under way",
          "The processing has ended",
        ],
        es: [
          "Antes de que comience el tratamiento",
          "El tratamiento ya está en marcha",
          "El tratamiento ya ha terminado",
        ],
      },
    },
    {
      id: "q9_2",
      type: "textarea",
      required: true,
      text: {
        en: "Review and update schedule, the change that brings a review forward, and how long this assessment is kept",
        es: "Calendario de revisión y actualización, el cambio que adelanta una revisión y durante cuánto tiempo se conserva esta evaluación",
      },
      help: {
        en: "Source: 11 CCR 7155(b) and (c).",
        es: "Fuente: 11 CCR 7155(b) y (c).",
      },
    },
    {
      id: "q9_3",
      type: "select",
      required: true,
      text: {
        en: "Submission to the California Privacy Protection Agency by 1 April 2028",
        es: "Presentación a la Agencia de Protección de la Privacidad de California antes del 1 de abril de 2028",
      },
      help: {
        en: "Source: 11 CCR 7157(a).",
        es: "Fuente: 11 CCR 7157(a).",
      },
      options: {
        en: ["Planned", "Already submitted", "Not applicable: no trigger is met"],
        es: ["Prevista", "Ya presentada", "No procede: no se cumple ningún supuesto"],
      },
    },
    {
      id: "q9_4",
      type: "text",
      required: true,
      text: {
        en: "Executive who will attest to this assessment (name and position)",
        es: "Directivo que certificará esta evaluación (nombre y cargo)",
      },
      help: {
        en: "Source: 11 CCR 7157(b)(5) and (c).",
        es: "Fuente: 11 CCR 7157(b)(5) y (c).",
      },
    },
    {
      id: "q9_5",
      type: "select",
      required: true,
      text: {
        en: "Can the full assessment be provided within 30 days of a request from the agency or the Attorney General?",
        es: "¿Puede facilitarse la evaluación completa en un plazo de 30 días desde la solicitud de la agencia o del fiscal general?",
      },
      help: {
        en: "Source: 11 CCR 7157(e).",
        es: "Fuente: 11 CCR 7157(e).",
      },
      options: {
        en: ["Yes", "No", "Not yet"],
        es: ["Sí", "No", "Todavía no"],
      },
    },
  ],
};

/**
 * The description is one sentence, because it is the card text. The frameworks
 * with their citations are the first question of the assessment, and the
 * "not legal advice" notice is on the report and in the public documentation
 * (docs.publicAssessments.conformance.disclaimer).
 */
const TEMPLATE_META: { name: BiText; description: BiText } = {
  name: {
    en: "Data Protection Impact Assessment (generic)",
    es: "Evaluación de impacto en la protección de datos (genérica)",
  },
  description: {
    en: "A DPIA that follows the framework you choose at the start: the European rules, the Californian risk assessment rules, or both.",
    es: "Una evaluación que sigue el marco que elijas al principio: las normas europeas, las normas californianas de evaluación de riesgos o ambas.",
  },
};

/** Every section added in v3.0, plus the sections that gained a question. */
const BILINGUAL_SECTIONS: BiSection[] = [
  SCOPE_SECTION,
  CALIFORNIA_CONTENT_SECTION,
  CALIFORNIA_TIMETABLE_SECTION,
];

function storedQuestion(q: BiQuestion) {
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

function storedSection(s: BiSection) {
  return {
    id: s.id,
    title: s.title.en,
    description: s.description.en,
    ...(s.showIf ? { showIf: s.showIf } : {}),
    questions: s.questions.map(storedQuestion),
  };
}

/**
 * The v3.0 text for a message bundle, in the shape the `templates.dpia`
 * namespace uses. Written by scripts/sync-dpia-messages.ts.
 */
export function dpiaFrameworkMessages(locale: "en" | "es") {
  const template: Record<string, { name: string; description: string }> = {
    [DPIA_TEMPLATE_ID]: {
      name: TEMPLATE_META.name[locale],
      description: TEMPLATE_META.description[locale],
    },
  };
  const section: Record<string, { title: string; description: string }> = {};
  const question: Record<string, { text: string; helpText?: string; options?: string[] }> = {};

  const addQuestion = (q: BiQuestion) => {
    question[q.id] = {
      text: q.text[locale],
      ...(q.help ? { helpText: q.help[locale] } : {}),
      ...(q.options ? { options: q.options[locale] } : {}),
    };
  };

  for (const s of BILINGUAL_SECTIONS) {
    section[s.id] = { title: s.title[locale], description: s.description[locale] };
    s.questions.forEach(addQuestion);
  }
  for (const questions of Object.values(EXTRA_QUESTIONS)) questions.forEach(addQuestion);

  return { template, section, question };
}

const baseSections = [
  {
    id: "s1",
    title: "Processing Description",
    description:
      "Describe the nature, scope, and purpose of the processing",
    questions: [
      {
        id: "q1_1",
        text: "What categories of personal data will be processed?",
        type: "textarea",
        required: true,
        helpText:
          "List all data categories (e.g. identifiers, financial, behavioral, special category). Be specific about each category.",
      },
      {
        id: "q1_2",
        text: "What is the purpose of the processing?",
        type: "textarea",
        required: true,
        helpText:
          "Describe the primary and any secondary purposes. Reference specific business objectives.",
      },
      {
        id: "q1_3",
        text: "What is the legal basis for processing?",
        type: "select",
        required: true,
        options: [
          "Consent (Art. 6(1)(a))",
          "Contract (Art. 6(1)(b))",
          "Legal obligation (Art. 6(1)(c))",
          "Vital interests (Art. 6(1)(d))",
          "Public task (Art. 6(1)(e))",
          "Legitimate interests (Art. 6(1)(f))",
        ],
      },
      {
        id: "q1_4",
        text: "Who are the data subjects?",
        type: "multiselect",
        required: true,
        options: [
          "Customers",
          "Employees",
          "Job applicants",
          "Website visitors",
          "Minors / children",
          "Patients",
          "Students",
          "Members of the public",
          "Business contacts",
          "Other",
        ],
      },
      {
        id: "q1_5",
        text: "Estimated number of data subjects affected",
        type: "select",
        required: true,
        options: [
          "< 1,000",
          "1,000 – 10,000",
          "10,000 – 100,000",
          "100,000 – 1,000,000",
          "> 1,000,000",
        ],
      },
      {
        id: "q1_6",
        text: "Describe the data flows and recipients",
        type: "textarea",
        required: true,
        helpText:
          "Map how data moves through your systems — from collection to storage, processing, sharing, and deletion. Identify all recipients and processors.",
      },
    ],
  },
  {
    id: "s2",
    title: "Scope & Context",
    description:
      "Assess the scope of processing and the context in which data subjects interact with you",
    questions: [
      {
        id: "q2_1",
        text: "What is the sensitivity level of the data?",
        type: "select",
        required: true,
        options: [
          "Non-sensitive personal data only",
          "Mix of non-sensitive and sensitive indicators",
          "Includes special category data (Art. 9) or criminal offence data (Art. 10)",
        ],
        riskWeight: 2,
      },
      {
        id: "q2_2",
        text: "Retention period and justification",
        type: "textarea",
        required: true,
        helpText:
          "State retention periods for each data category and justify why that duration is necessary.",
      },
      {
        id: "q2_3",
        text: "Geographic scope and international transfers",
        type: "textarea",
        required: true,
        helpText:
          "Identify all countries where data is processed or stored, and the transfer mechanisms used (e.g. adequacy decision, SCCs, BCRs).",
      },
      {
        id: "q2_4",
        text: "Would data subjects reasonably expect this processing?",
        type: "select",
        required: true,
        options: [
          "Fully expected — directly related to the service they signed up for",
          "Probably expected — a reasonable extension of the service",
          "Possibly unexpected — not directly related to the primary service",
          "Unexpected — data subjects would likely be surprised",
        ],
        riskWeight: 1.5,
      },
    ],
  },
  {
    id: "s3",
    title: "Necessity & Proportionality",
    description:
      "Demonstrate that the processing is necessary and proportionate to the purpose",
    questions: [
      {
        id: "q3_1",
        text: "Is the processing necessary to achieve the stated purpose?",
        type: "select",
        required: true,
        options: [
          "Essential — cannot achieve the purpose without it",
          "Highly beneficial — significantly more effective than alternatives",
          "Somewhat beneficial — marginal improvement over alternatives",
          "Not clearly necessary — alternatives could achieve the same result",
        ],
        riskWeight: 1.5,
      },
      {
        id: "q3_2",
        text: "What alternatives were considered and why were they rejected?",
        type: "textarea",
        required: true,
        helpText:
          "Describe less intrusive alternatives you evaluated and explain why the chosen approach is necessary.",
      },
      {
        id: "q3_3",
        text: "What data minimization measures are in place?",
        type: "textarea",
        required: true,
        helpText:
          "Describe measures to ensure only necessary data is collected and processed (e.g. pseudonymization, aggregation, field-level restrictions).",
      },
    ],
  },
  {
    id: "s4",
    title: "Consultation",
    description:
      "Document consultation with stakeholders, the DPO, and (where appropriate) data subjects",
    questions: [
      {
        id: "q4_1",
        text: "Who was consulted during this assessment?",
        type: "multiselect",
        required: true,
        options: [
          "Data Protection Officer",
          "Data subjects or their representatives",
          "IT / Information Security",
          "Legal counsel",
          "Works council / staff representatives",
          "External privacy experts",
          "Processor / vendor",
        ],
      },
      {
        id: "q4_2",
        text: "Summary of consultation outcomes and actions taken",
        type: "textarea",
        required: true,
        helpText:
          "Summarize feedback received, objections raised, and any changes made to the processing as a result.",
      },
    ],
  },
  {
    id: "s5",
    title: "Risk Identification",
    description:
      "Identify risks to the rights and freedoms of data subjects",
    questions: [
      {
        id: "q5_1",
        text: "Does the processing involve automated decision-making or profiling?",
        type: "boolean",
        required: true,
        riskWeight: 2,
      },
      {
        id: "q5_2",
        text: "Does the processing involve special category data or criminal offence data?",
        type: "boolean",
        required: true,
        riskWeight: 2,
      },
      {
        id: "q5_3",
        text: "Does the processing involve systematic monitoring of a publicly accessible area?",
        type: "boolean",
        required: true,
        riskWeight: 1.5,
      },
      {
        id: "q5_4",
        text: "Is the processing carried out on a large scale?",
        type: "boolean",
        required: true,
        riskWeight: 1.5,
      },
      {
        id: "q5_5",
        text: "Does the processing involve innovative use of technology (e.g. AI, biometrics, IoT)?",
        type: "boolean",
        required: true,
        riskWeight: 1.5,
      },
      {
        id: "q5_6",
        text: "Describe the identified risks to data subjects, including likelihood and severity for each",
        type: "textarea",
        required: true,
        helpText:
          "For each risk: describe the source, affected rights, likelihood (Remote / Possible / Likely), and severity (Minimal / Significant / Severe / Critical). Use the format: Risk N — Title: Description. Likelihood: X. Severity: Y.",
      },
    ],
  },
  {
    id: "s6",
    title: "Mitigation Measures",
    description:
      "Document technical and organizational measures to mitigate identified risks",
    questions: [
      {
        id: "q6_1",
        text: "Technical measures in place or planned",
        type: "multiselect",
        required: true,
        options: [
          "Encryption at rest",
          "Encryption in transit",
          "Pseudonymization",
          "Access controls / RBAC",
          "Data loss prevention (DLP)",
          "Audit logging",
          "Backup & recovery",
          "Network segmentation",
          "Automated retention enforcement",
          "Anonymization / aggregation",
        ],
      },
      {
        id: "q6_2",
        text: "Organizational measures in place or planned",
        type: "multiselect",
        required: true,
        options: [
          "Staff training / awareness",
          "Data processing agreements (DPAs)",
          "Privacy policies & procedures",
          "Regular audits / reviews",
          "Breach response plan",
          "Vendor management program",
          "Data classification scheme",
          "Privacy by design process",
        ],
      },
      {
        id: "q6_3",
        text: "Safeguards for individual rights (transparency, consent mechanisms, portability, opt-out)",
        type: "textarea",
        required: true,
        helpText:
          "Describe how data subject rights are facilitated — e.g. privacy notices, consent preference centers, data portability tools, opt-out mechanisms.",
      },
    ],
  },
  {
    id: "s7",
    title: "Residual Risk & Conclusion",
    description:
      "Assess residual risk after mitigations and determine whether supervisory authority consultation is required",
    questions: [
      {
        id: "q7_1",
        text: "Overall residual risk level after mitigations",
        type: "select",
        required: true,
        options: ["Low", "Medium", "High", "Critical"],
        riskWeight: 2,
      },
      {
        id: "q7_2",
        text: "Is prior consultation with the supervisory authority required? (Art. 36)",
        type: "select",
        required: true,
        showIf: WHEN_EU,
        options: [
          "No — residual risk has been sufficiently mitigated",
          "Under consideration — further analysis needed",
          "Yes — high residual risk that cannot be sufficiently mitigated",
        ],
        riskWeight: 2,
      },
      {
        id: "q7_3",
        text: "DPO advice and recommendation",
        type: "textarea",
        required: true,
        showIf: WHEN_EU,
        helpText:
          "Record the DPO's formal advice: whether the processing may proceed, any conditions, and the recommended review date.",
      },
    ],
  },
];

/**
 * The stored (English) sections: the scope question first, then the v2
 * sections with the questions v3.0 adds to them, then the Californian
 * sections. Order is the order the assessment is worked through.
 */
export const dpiaTemplateSections = [
  storedSection(SCOPE_SECTION),
  ...baseSections.map((section) => {
    const extra = EXTRA_QUESTIONS[section.id];
    return extra
      ? { ...section, questions: [...section.questions, ...extra.map(storedQuestion)] }
      : section;
  }),
  storedSection(CALIFORNIA_CONTENT_SECTION),
  storedSection(CALIFORNIA_TIMETABLE_SECTION),
];

export const dpiaScoringLogic = {
  method: "weighted_average",
  riskLevels: {
    LOW: { min: 0, max: 25 },
    MEDIUM: { min: 26, max: 50 },
    HIGH: { min: 51, max: 75 },
    CRITICAL: { min: 76, max: 100 },
  },
};

export const dpiaTemplateData = {
  id: DPIA_TEMPLATE_ID,
  type: "DPIA" as const,
  name: TEMPLATE_META.name.en,
  description: TEMPLATE_META.description.en,
  version: DPIA_TEMPLATE_VERSION,
  isSystem: true,
  isActive: true,
  sections: dpiaTemplateSections,
  scoringLogic: dpiaScoringLogic,
};
