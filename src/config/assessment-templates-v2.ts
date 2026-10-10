// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Version 2 of the four free-text system assessment templates: the Legitimate
 * Interest Assessment (LIA), the Transfer Impact Assessment (TIA), the Privacy
 * Impact Assessment (PIA) and the Custom assessment. The DPIA is left alone: it
 * is already structured (src/config/dpia-template-v2.ts, v3.0).
 *
 * The consultant's point applies here too: a regulator reading a registration
 * looks for keywords, and free text hides them. v2 turns every question a
 * regulator reads into a structured one, in the vocabulary of the law:
 *   - single choice   -> `select`      (one option string)
 *   - multiple choice -> `multiselect` (a JSON array of option strings)
 *   - yes/no          -> `boolean`     (the literal "Yes"/"No")
 *   - a yes/no with a follow-up is the boolean plus a follow-up question gated by
 *     `showIf` on that boolean (src/lib/assessment-conditions.ts)
 *   - a graded judgement is a `select` with graded, labelled options
 *   - a date is a short `text` question with an ISO example in its help
 * Narrative prompts ("describe the system") stay as `text`/`textarea`, because a
 * description cannot be enumerated. Each question carries help (what it means, an
 * example, the article).
 *
 * These are exactly the input types the assessment fill screen, the read-only
 * view and the PDF export already render (they show options as labelled values
 * and Yes/No localised), so v2 needs no new renderer and shows as labelled
 * values everywhere.
 *
 * DPO Central stores template text as English inside AssessmentTemplate.sections
 * and resolves Spanish from the message bundles (templates.<type>.…), matching
 * options across languages by position. So this file is the bilingual source:
 *   - serializeSections() emits the English JSON stored in the DB (and inserted
 *     by the migration), and
 *   - templateV2Messages() emits the per-locale bundle entries
 *     (scripts/sync-template-v2-messages.ts writes them into en.json / es.json).
 * The two are generated from the one source, so they never drift apart.
 *
 * v2 uses fresh section and question ids (liav2_*, tiav2_*, piav2_*, customv2_*)
 * so its bundle entries never collide with the v1 entries that running
 * assessments still resolve against.
 *
 * Legal statements name their primary source. This is a draft for review by
 * counsel, not legal advice.
 */

import type { AssessmentType, Prisma } from "@prisma/client";
import type { ShowIf } from "@/lib/assessment-conditions";

export type ContentLocale = "en" | "es";

export interface BiText {
  en: string;
  es: string;
}

/** The input types the assessment renderer understands. */
export type V2QuestionType = "select" | "multiselect" | "boolean" | "text" | "textarea";

/** The set the renderer handles, for the validity test. */
export const RENDERER_QUESTION_TYPES: readonly V2QuestionType[] = [
  "select",
  "multiselect",
  "boolean",
  "text",
  "textarea",
];

export interface V2Question {
  id: string;
  type: V2QuestionType;
  /** Defaults to true. */
  required?: boolean;
  text: BiText;
  /** What it means, an example, the article. Carried into the JSON as helpText. */
  help?: BiText;
  /** select / multiselect. The stored answer is the English label. */
  options?: BiText[];
  /** A follow-up question gates itself on an earlier answer (usually a boolean). */
  showIf?: ShowIf;
}

export interface V2Section {
  id: string;
  title: BiText;
  description: BiText;
  questions: V2Question[];
  showIf?: ShowIf;
}

export interface V2Template {
  /** New row id, e.g. "system-lia-template-v2". */
  id: string;
  /** The v1 row this supersedes, or null where there is no v1 (PIA). */
  supersedes: string | null;
  type: AssessmentType;
  name: BiText;
  description: BiText;
  version: string;
  sections: V2Section[];
}

// --- tiny constructors, to keep the content readable ------------------------

const L = (en: string, es: string): BiText => ({ en, es });

/** A yes/no follow-up condition: shown when the boolean is answered "Yes"/"No". */
const whenYes = (questionId: string): ShowIf => ({ questionId, anyOf: ["Yes"] });

/** A condition on a select/multiselect answer (matched by the English label). */
const whenAnyOf = (questionId: string, anyOf: string[]): ShowIf => ({ questionId, anyOf });

const SCORING = {
  method: "weighted_average",
  riskLevels: {
    LOW: { min: 0, max: 25 },
    MEDIUM: { min: 26, max: 50 },
    HIGH: { min: 51, max: 75 },
    CRITICAL: { min: 76, max: 100 },
  },
};

// ============================================================================
// LIA v2 — Legitimate Interest Assessment (GDPR Art. 6(1)(f))
// ============================================================================

const liaV2: V2Template = {
  id: "system-lia-template-v2",
  supersedes: "system-lia-template",
  type: "LIA" as AssessmentType,
  version: "2.0",
  name: L("Legitimate Interest Assessment", "Evaluación del interés legítimo"),
  description: L(
    "The three-part legitimate interest test of GDPR Article 6(1)(f) (purpose, necessity and balancing), with structured answers a regulator can read. This template is informational, not legal advice; verify with qualified counsel.",
    "La prueba en tres partes del interés legítimo del artículo 6.1.f) del RGPD (finalidad, necesidad y ponderación), con respuestas estructuradas que una autoridad de control puede leer. Esta plantilla es informativa y no constituye asesoramiento jurídico; verifícala con un profesional cualificado.",
  ),
  sections: [
    {
      id: "liav2_s1",
      title: L("Purpose test", "Prueba de finalidad"),
      description: L("Identify the legitimate interest being pursued.", "Identifica el interés legítimo que se persigue."),
      questions: [
        {
          id: "liav2_1_1",
          type: "select",
          text: L("Whose legitimate interest is being pursued?", "¿De quién es el interés legítimo que se persigue?"),
          options: [
            L("Our own interest", "Nuestro propio interés"),
            L("A third party's interest", "El interés de un tercero"),
            L("Both ours and a third party's", "Tanto el nuestro como el de un tercero"),
          ],
          help: L(
            "The interest may be the controller's or a third party's. Say whose it is, because the balancing test weighs it against the individual's rights. Example: \"Our own interest in preventing fraud.\" Source: GDPR Art. 6(1)(f).",
            "El interés puede ser del responsable del tratamiento o de un tercero. Indica de quién es, porque la ponderación lo contrapone a los derechos del interesado. Ejemplo: «Nuestro propio interés en prevenir el fraude». Fuente: RGPD, art. 6.1.f).",
          ),
        },
        {
          id: "liav2_1_2",
          type: "textarea",
          text: L("Describe the legitimate interest precisely.", "Describe con precisión el interés legítimo."),
          help: L(
            "Name a specific interest, not just \"business purposes\". A clearly articulated, real and present interest is the first thing the test requires. Example: \"Detecting fraudulent transactions to protect customers and the business.\" Source: GDPR Art. 6(1)(f) and Recital 47.",
            "Nombra un interés concreto, no solo «fines empresariales». Un interés claramente definido, real y presente es lo primero que exige la prueba. Ejemplo: «Detectar transacciones fraudulentas para proteger a los clientes y a la empresa». Fuente: RGPD, art. 6.1.f) y considerando 47.",
          ),
        },
        {
          id: "liav2_1_3",
          type: "select",
          text: L("Is the interest lawful, clearly articulated and real (not speculative)?", "¿Es el interés lícito, está claramente definido y es real (no especulativo)?"),
          options: [
            L("Yes, on all three", "Sí, en las tres condiciones"),
            L("Partly", "En parte"),
            L("No", "No"),
          ],
          help: L(
            "An interest can only be relied on if it is lawful, precise enough to weigh, and a real interest rather than a hypothetical one. Example: \"Yes: fraud prevention is lawful, specific and ongoing.\" Source: GDPR Art. 6(1)(f); EDPB guidance on legitimate interest.",
            "Solo puede invocarse un interés si es lícito, lo bastante preciso para poder ponderarlo y real, no hipotético. Ejemplo: «Sí: la prevención del fraude es lícita, específica y continua». Fuente: RGPD, art. 6.1.f); directrices del CEPD sobre el interés legítimo.",
          ),
        },
      ],
    },
    {
      id: "liav2_s2",
      title: L("Necessity test", "Prueba de necesidad"),
      description: L("Assess whether the processing is necessary for that interest.", "Evalúa si el tratamiento es necesario para ese interés."),
      questions: [
        {
          id: "liav2_2_1",
          type: "select",
          text: L("Is the processing necessary to achieve the interest?", "¿Es el tratamiento necesario para alcanzar el interés?"),
          options: [
            L("Essential", "Esencial"),
            L("Reasonably necessary", "Razonablemente necesario"),
            L("Convenient but not necessary", "Conveniente pero no necesario"),
            L("Not necessary", "No necesario"),
          ],
          help: L(
            "\"Necessary\" means the processing is a targeted and proportionate way to meet the interest, not merely useful. If it is only convenient, legitimate interest is not the right basis. Example: \"Reasonably necessary: fraud scoring needs the transaction data.\" Source: GDPR Art. 6(1)(f).",
            "«Necesario» significa que el tratamiento es una forma específica y proporcionada de satisfacer el interés, no solo útil. Si es meramente conveniente, el interés legítimo no es la base jurídica adecuada. Ejemplo: «Razonablemente necesario: la puntuación de fraude requiere los datos de la transacción». Fuente: RGPD, art. 6.1.f).",
          ),
        },
        {
          id: "liav2_2_2",
          type: "select",
          text: L("Could a less intrusive means achieve the same result?", "¿Podría lograrse el mismo resultado con un medio menos intrusivo?"),
          options: [
            L("No, this is the least intrusive means", "No, este es el medio menos intrusivo"),
            L("A less intrusive means exists but is far less effective", "Existe un medio menos intrusivo pero mucho menos eficaz"),
            L("A less intrusive means is available", "Hay disponible un medio menos intrusivo"),
          ],
          help: L(
            "If a less intrusive way exists that is reasonably effective, you should use it instead. Example: \"No: aggregated data would miss the individual fraud patterns.\" Source: GDPR Art. 6(1)(f); principle of data minimisation, Art. 5(1)(c).",
            "Si existe una forma menos intrusiva y razonablemente eficaz, debes usarla en su lugar. Ejemplo: «No: los datos agregados no detectarían los patrones de fraude individuales». Fuente: RGPD, art. 6.1.f); principio de minimización de datos, art. 5.1.c).",
          ),
        },
        {
          id: "liav2_2_3",
          type: "boolean",
          text: L("Is the data limited to what the interest requires (data minimisation)?", "¿Se limitan los datos a lo que exige el interés (minimización de datos)?"),
          help: L(
            "Only the data genuinely needed for the interest should be processed. Example: \"Yes: we use the transaction and device data, not the full customer profile.\" Source: GDPR Art. 5(1)(c).",
            "Solo deben tratarse los datos realmente necesarios para el interés. Ejemplo: «Sí: usamos los datos de la transacción y del dispositivo, no el perfil completo del cliente». Fuente: RGPD, art. 5.1.c).",
          ),
        },
      ],
    },
    {
      id: "liav2_s3",
      title: L("Balancing test", "Prueba de ponderación"),
      description: L("Weigh the interest against the individual's rights and freedoms.", "Pondera el interés frente a los derechos y libertades del interesado."),
      questions: [
        {
          id: "liav2_3_1",
          type: "select",
          text: L("What is the nature of the data?", "¿Cuál es la naturaleza de los datos?"),
          options: [
            L("No special category or criminal-offence data", "Sin datos de categorías especiales ni penales"),
            L("Sensitive but not special category", "Sensibles, pero no de categorías especiales"),
            L("Includes special category or criminal-offence data", "Incluye datos de categorías especiales o penales"),
          ],
          help: L(
            "The more sensitive the data, the heavier it weighs against the interest. Special category and criminal-offence data need a separate condition and rarely sit under legitimate interest alone. Example: \"No special category data.\" Source: GDPR Arts. 9 and 10.",
            "Cuanto más sensibles sean los datos, más pesan frente al interés. Los datos de categorías especiales y los relativos a condenas e infracciones penales requieren una condición aparte y rara vez se amparan solo en el interés legítimo. Ejemplo: «Sin datos de categorías especiales». Fuente: RGPD, arts. 9 y 10.",
          ),
        },
        {
          id: "liav2_3_2",
          type: "select",
          text: L("Would data subjects reasonably expect this processing?", "¿Esperaría razonablemente el interesado este tratamiento?"),
          options: [
            L("Clearly expected", "Claramente esperado"),
            L("Probably expected", "Probablemente esperado"),
            L("Possibly unexpected", "Posiblemente inesperado"),
            L("Would not expect it", "No lo esperaría"),
          ],
          help: L(
            "Reasonable expectations turn on the relationship and how the data was collected. The less expected, the harder the interest is to justify. Example: \"Clearly expected: customers expect fraud checks on payments.\" Source: GDPR Recital 47.",
            "Las expectativas razonables dependen de la relación y de cómo se recabaron los datos. Cuanto menos esperado, más difícil de justificar el interés. Ejemplo: «Claramente esperado: los clientes esperan controles de fraude en los pagos». Fuente: RGPD, considerando 47.",
          ),
        },
        {
          id: "liav2_3_3",
          type: "select",
          text: L("What is the likely impact on the individual?", "¿Cuál es el impacto probable sobre el interesado?"),
          options: [
            L("Positive or neutral", "Positivo o neutro"),
            L("Minor negative", "Negativo leve"),
            L("Moderate negative", "Negativo moderado"),
            L("Significant negative", "Negativo significativo"),
          ],
          help: L(
            "Consider the effect on the person, including any decision made about them. A significant negative impact usually tips the balance towards their rights. Example: \"Minor: a flagged payment may be delayed briefly.\" Source: GDPR Art. 6(1)(f).",
            "Considera el efecto sobre la persona, incluida cualquier decisión que se tome sobre ella. Un impacto negativo significativo suele inclinar la balanza hacia sus derechos. Ejemplo: «Leve: un pago marcado puede retrasarse un momento». Fuente: RGPD, art. 6.1.f).",
          ),
        },
        {
          id: "liav2_3_4",
          type: "boolean",
          text: L("Are children or other vulnerable people affected?", "¿Se ven afectados menores u otras personas vulnerables?"),
          help: L(
            "Children and vulnerable people warrant extra weight on their side of the balance. Example: \"No: the service is for account holders aged 18 and over.\" Source: GDPR Recital 38; Art. 6(1)(f).",
            "Los menores y las personas vulnerables merecen un peso adicional en su lado de la balanza. Ejemplo: «No: el servicio es para titulares de cuentas mayores de 18 años». Fuente: RGPD, considerando 38; art. 6.1.f).",
          ),
        },
        {
          id: "liav2_3_5",
          type: "select",
          text: L("What is the overall balance?", "¿Cuál es la ponderación general?"),
          options: [
            L("The interest prevails", "Prevalece el interés"),
            L("Balanced; safeguards are decisive", "Equilibrado; las salvaguardas son decisivas"),
            L("The individual's rights prevail (do not rely on legitimate interest)", "Prevalecen los derechos del interesado (no invocar el interés legítimo)"),
          ],
          help: L(
            "State the conclusion of the balance, taking the safeguards below into account. Where rights prevail, choose another lawful basis. Example: \"Balanced; the right to object and data minimisation are decisive.\" Source: GDPR Art. 6(1)(f).",
            "Indica la conclusión de la ponderación, teniendo en cuenta las salvaguardas siguientes. Si prevalecen los derechos, elige otra base jurídica. Ejemplo: «Equilibrado; el derecho de oposición y la minimización de datos son decisivos». Fuente: RGPD, art. 6.1.f).",
          ),
        },
      ],
    },
    {
      id: "liav2_s4",
      title: L("Safeguards and outcome", "Salvaguardas y resultado"),
      description: L("Record the safeguards that protect data subjects and the conclusion.", "Registra las salvaguardas que protegen a los interesados y la conclusión."),
      questions: [
        {
          id: "liav2_4_1",
          type: "multiselect",
          text: L("Which safeguards protect data subjects?", "¿Qué salvaguardas protegen a los interesados?"),
          options: [
            L("The right to object is honoured", "Se atiende el derecho de oposición"),
            L("Data minimisation", "Minimización de datos"),
            L("Retention limits", "Límites de conservación"),
            L("Access controls", "Controles de acceso"),
            L("Pseudonymisation", "Seudonimización"),
            L("Transparency in the privacy notice", "Transparencia en la información sobre privacidad"),
            L("Regular review", "Revisión periódica"),
          ],
          help: L(
            "Safeguards can tip a finely balanced case in favour of the interest. List the ones actually in place. Example: \"Right to object honoured, retention limits, pseudonymisation.\" Source: GDPR Arts. 21 and 5(1); Recital 47.",
            "Las salvaguardas pueden inclinar un caso ajustado a favor del interés. Enumera las que realmente existen. Ejemplo: «Se atiende el derecho de oposición, límites de conservación, seudonimización». Fuente: RGPD, arts. 21 y 5.1; considerando 47.",
          ),
        },
        {
          id: "liav2_4_2",
          type: "boolean",
          text: L("Have you told individuals about this processing and their right to object?", "¿Has informado a los interesados de este tratamiento y de su derecho de oposición?"),
          help: L(
            "Individuals must be told, in the privacy notice, that you rely on legitimate interest and that they can object. Example: \"Yes: the privacy notice names the interest and explains how to object.\" Source: GDPR Arts. 13(1)(d), 14(2)(b) and 21.",
            "Debe informarse a los interesados, en la información sobre privacidad, de que te basas en el interés legítimo y de que pueden oponerse. Ejemplo: «Sí: la información sobre privacidad nombra el interés y explica cómo oponerse». Fuente: RGPD, arts. 13.1.d), 14.2.b) y 21.",
          ),
        },
        {
          id: "liav2_4_3",
          type: "textarea",
          required: false,
          text: L("Conclusion and any conditions.", "Conclusión y condiciones, si las hay."),
          help: L(
            "Summarise the outcome and any conditions that must hold for the processing to remain justified. Example: \"May proceed while the right to object is honoured and retention stays at 12 months.\" Source: GDPR Art. 6(1)(f).",
            "Resume el resultado y las condiciones que deben cumplirse para que el tratamiento siga justificado. Ejemplo: «Puede continuar mientras se atienda el derecho de oposición y la conservación se mantenga en 12 meses». Fuente: RGPD, art. 6.1.f).",
          ),
        },
      ],
    },
  ],
};

// ============================================================================
// TIA v2 — Transfer Impact Assessment (Schrems II; EDPB Rec. 01/2020)
// ============================================================================

const tiaV2: V2Template = {
  id: "system-tia-template-v2",
  supersedes: "system-tia-template",
  type: "TIA" as AssessmentType,
  version: "2.0",
  name: L("Transfer Impact Assessment", "Evaluación de impacto de las transferencias (EIT)"),
  description: L(
    "Assess a transfer of personal data to a third country and whether supplementary measures are needed for an essentially equivalent level of protection (EDPB Recommendations 01/2020, Schrems II), with structured answers. Informational, not legal advice; verify with qualified counsel.",
    "Evalúa una transferencia de datos personales a un tercer país y si se necesitan medidas complementarias para un nivel de protección esencialmente equivalente (Recomendaciones 01/2020 del CEPD, Schrems II), con respuestas estructuradas. Informativo, no asesoramiento jurídico; verifícalo con un profesional cualificado.",
  ),
  sections: [
    {
      id: "tiav2_s1",
      title: L("The transfer", "La transferencia"),
      description: L("Describe the transfer, its tool, the data and the parties.", "Describe la transferencia, su instrumento, los datos y las partes."),
      questions: [
        {
          id: "tiav2_1_1",
          type: "select",
          text: L("Which transfer tool are you relying on?", "¿En qué instrumento de transferencia te basas?"),
          options: [
            L("Adequacy decision (Art. 45)", "Decisión de adecuación (art. 45)"),
            L("Standard Contractual Clauses (Art. 46)", "Cláusulas contractuales tipo (art. 46)"),
            L("Binding Corporate Rules (Art. 47)", "Normas corporativas vinculantes (art. 47)"),
            L("Derogation for a specific situation (Art. 49)", "Excepción para una situación específica (art. 49)"),
            L("Other Article 46 safeguard", "Otra garantía del artículo 46"),
          ],
          help: L(
            "The transfer tool is the legal basis for sending the data abroad. Where an adequacy decision covers the destination, no supplementary measures are needed. Example: \"Standard Contractual Clauses.\" Source: GDPR Arts. 45 to 49.",
            "El instrumento de transferencia es la base jurídica para enviar los datos al extranjero. Si una decisión de adecuación cubre el destino, no se necesitan medidas complementarias. Ejemplo: «Cláusulas contractuales tipo». Fuente: RGPD, arts. 45 a 49.",
          ),
        },
        {
          id: "tiav2_1_2",
          type: "select",
          showIf: whenAnyOf("tiav2_1_1", ["Standard Contractual Clauses (Art. 46)"]),
          text: L("Which SCC module applies?", "¿Qué módulo de las CCT se aplica?"),
          options: [
            L("Module 1: controller to controller", "Módulo 1: de responsable a responsable"),
            L("Module 2: controller to processor", "Módulo 2: de responsable a encargado"),
            L("Module 3: processor to processor", "Módulo 3: de encargado a encargado"),
            L("Module 4: processor to controller", "Módulo 4: de encargado a responsable"),
          ],
          help: L(
            "The 2021 Standard Contractual Clauses have four modules for the roles of the exporter and importer. Pick the one that matches. Example: \"Module 2: we are the controller, the importer is our processor.\" Source: Commission Implementing Decision (EU) 2021/914.",
            "Las cláusulas contractuales tipo de 2021 tienen cuatro módulos según los papeles del exportador y del importador. Elige el que corresponda. Ejemplo: «Módulo 2: somos el responsable y el importador es nuestro encargado». Fuente: Decisión de Ejecución (UE) 2021/914 de la Comisión.",
          ),
        },
        {
          id: "tiav2_1_3",
          type: "multiselect",
          text: L("What categories of personal data are transferred?", "¿Qué categorías de datos personales se transfieren?"),
          options: [
            L("Contact details", "Datos de contacto"),
            L("Identifiers", "Identificadores"),
            L("Financial data", "Datos financieros"),
            L("Behavioural or usage data", "Datos de comportamiento o de uso"),
            L("Location data", "Datos de localización"),
            L("Special category data", "Categorías especiales de datos"),
            L("Criminal-offence data", "Datos penales"),
          ],
          help: L(
            "The sensitivity and volume of the data drive the risk of the transfer. Name every category, because special category and criminal-offence data raise the bar. Example: \"Contact details, identifiers, behavioural data.\" Source: EDPB Recommendations 01/2020, step 1.",
            "La sensibilidad y el volumen de los datos determinan el riesgo de la transferencia. Nombra cada categoría, porque los datos de categoría especial y penales elevan el listón. Ejemplo: «Datos de contacto, identificadores, datos de comportamiento». Fuente: Recomendaciones 01/2020 del CEPD, paso 1.",
          ),
        },
        {
          id: "tiav2_1_4",
          type: "textarea",
          text: L("Who is the exporter and who is the importer, and in which countries?", "¿Quién es el exportador y quién el importador, y en qué países?"),
          help: L(
            "Name the organisations, their roles (controller or processor) and the countries of establishment, so the transfer is fully mapped. Example: \"We (controller, Spain) to our hosting provider (processor, United States).\" Source: EDPB Recommendations 01/2020, step 1.",
            "Nombra las organizaciones, sus papeles (responsable o encargado) y los países de establecimiento, para mapear la transferencia por completo. Ejemplo: «Nosotros (responsable, España) a nuestro proveedor de alojamiento (encargado, Estados Unidos)». Fuente: Recomendaciones 01/2020 del CEPD, paso 1.",
          ),
        },
        {
          id: "tiav2_1_5",
          type: "boolean",
          text: L("Is the data onward-transferred to a further third country?", "¿Se transfieren los datos ulteriormente a otro tercer país?"),
          help: L(
            "An onward transfer to a further country extends the chain of risk and must itself be covered. Example: \"Yes: the importer uses a sub-processor in a third country.\" Source: EDPB Recommendations 01/2020.",
            "Una transferencia ulterior a otro país amplía la cadena de riesgo y debe estar cubierta a su vez. Ejemplo: «Sí: el importador usa un subencargado en un tercer país». Fuente: Recomendaciones 01/2020 del CEPD.",
          ),
        },
      ],
    },
    {
      id: "tiav2_s2",
      title: L("Destination laws and practices", "Leyes y prácticas del destino"),
      description: L("Assess whether the destination gives essentially equivalent protection.", "Evalúa si el destino ofrece una protección esencialmente equivalente."),
      questions: [
        {
          id: "tiav2_2_1",
          type: "select",
          text: L("Does the destination country have an EU adequacy decision?", "¿Tiene el país de destino una decisión de adecuación de la UE?"),
          options: [
            L("Yes, full adequacy", "Sí, adecuación plena"),
            L("Yes, partial adequacy", "Sí, adecuación parcial"),
            L("No adequacy decision", "Sin decisión de adecuación"),
            L("Adequacy under review or challenged", "Adecuación en revisión o impugnada"),
          ],
          help: L(
            "Adequacy means the Commission has found the country's protection essentially equivalent. Without it, you must assess the laws and practices yourself. Example: \"No adequacy decision.\" Source: GDPR Art. 45.",
            "La adecuación significa que la Comisión ha considerado que la protección del país es esencialmente equivalente. Sin ella, debes evaluar tú las leyes y prácticas. Ejemplo: «Sin decisión de adecuación». Fuente: RGPD, art. 45.",
          ),
        },
        {
          id: "tiav2_2_2",
          type: "select",
          text: L("Does the destination's law allow disproportionate government access to data?", "¿Permite la legislación del destino un acceso gubernamental desproporcionado a los datos?"),
          options: [
            L("No known access legislation", "Sin legislación de acceso conocida"),
            L("Access exists but with effective oversight and safeguards", "Existe acceso, pero con supervisión y garantías efectivas"),
            L("Broad surveillance powers with limited oversight", "Amplios poderes de vigilancia con escasa supervisión"),
            L("Mass surveillance or no independent judicial oversight", "Vigilancia masiva o sin supervisión judicial independiente"),
          ],
          help: L(
            "The core Schrems II question: can public authorities reach the data in ways that would not be acceptable in the EU? Name the laws. Example: \"Broad surveillance powers: FISA Section 702 and EO 12333.\" Source: EDPB Recommendations 01/2020, step 3.",
            "La cuestión central de Schrems II: ¿pueden las autoridades públicas acceder a los datos de formas que no serían aceptables en la UE? Nombra las leyes. Ejemplo: «Amplios poderes de vigilancia: la sección 702 de la FISA y la Orden Ejecutiva 12333». Fuente: Recomendaciones 01/2020 del CEPD, paso 3.",
          ),
        },
        {
          id: "tiav2_2_3",
          type: "select",
          text: L("Is the importer subject to government access requests in practice?", "¿Está el importador sujeto en la práctica a solicitudes de acceso gubernamental?"),
          options: [
            L("No: never received such a request", "No: nunca ha recibido tal solicitud"),
            L("Possible: operates in a sector that may be targeted", "Posible: opera en un sector que puede ser objetivo"),
            L("Yes: transparency reports confirm requests", "Sí: los informes de transparencia confirman solicitudes"),
            L("Unknown", "Se desconoce"),
          ],
          help: L(
            "Law on the books matters less if it is not applied to this importer; but a real risk in the sector counts against the transfer. Example: \"Possible: cloud providers are within scope of the access law.\" Source: EDPB Recommendations 01/2020, step 3.",
            "La ley sobre el papel importa menos si no se aplica a este importador; pero un riesgo real en el sector cuenta en contra de la transferencia. Ejemplo: «Posible: los proveedores de nube entran en el ámbito de la ley de acceso». Fuente: Recomendaciones 01/2020 del CEPD, paso 3.",
          ),
        },
        {
          id: "tiav2_2_4",
          type: "select",
          text: L("Are effective legal remedies available to EU data subjects there?", "¿Disponen los interesados de la UE de vías de recurso efectivas allí?"),
          options: [
            L("Yes: independent judicial review", "Sí: revisión judicial independiente"),
            L("Partial: administrative remedies only", "Parcial: solo vías administrativas"),
            L("No effective remedies", "Sin vías de recurso efectivas"),
            L("Unknown", "Se desconoce"),
          ],
          help: L(
            "Essentially equivalent protection includes a real way for individuals to challenge access to their data. Example: \"Partial: an ombudsperson mechanism but no court review.\" Source: EDPB Recommendations 01/2020, step 3; GDPR Art. 47 of the Charter.",
            "La protección esencialmente equivalente incluye una vía real para que los interesados impugnen el acceso a sus datos. Ejemplo: «Parcial: un mecanismo de defensor pero sin revisión judicial». Fuente: Recomendaciones 01/2020 del CEPD, paso 3; art. 47 de la Carta.",
          ),
        },
        {
          id: "tiav2_2_5",
          type: "textarea",
          text: L("Describe the relevant laws and government access practices.", "Describe las leyes pertinentes y las prácticas de acceso gubernamental."),
          help: L(
            "Cite specific legislation and any public government-access or transparency reports. Example: \"FISA Section 702 permits access to data held by electronic communication service providers; the importer's transparency report shows N requests.\" Source: EDPB Recommendations 01/2020, step 3.",
            "Cita la legislación concreta y cualquier informe público de acceso gubernamental o de transparencia. Ejemplo: «La sección 702 de la FISA permite el acceso a datos en poder de proveedores de servicios de comunicaciones electrónicas; el informe de transparencia del importador muestra N solicitudes». Fuente: Recomendaciones 01/2020 del CEPD, paso 3.",
          ),
        },
      ],
    },
    {
      id: "tiav2_s3",
      title: L("Supplementary measures", "Medidas complementarias"),
      description: L("Identify measures that supplement the transfer tool.", "Identifica las medidas que complementan el instrumento de transferencia."),
      questions: [
        {
          id: "tiav2_3_1",
          type: "multiselect",
          text: L("Which technical measures are in place?", "¿Qué medidas técnicas existen?"),
          options: [
            L("Encryption at rest, importer cannot access the keys", "Cifrado en reposo, el importador no puede acceder a las claves"),
            L("Encryption in transit (TLS 1.2 or higher)", "Cifrado en tránsito (TLS 1.2 o superior)"),
            L("End-to-end encryption, exporter-held keys only", "Cifrado de extremo a extremo, claves solo en poder del exportador"),
            L("Pseudonymisation before transfer", "Seudonimización antes de la transferencia"),
            L("Anonymisation or aggregation before transfer", "Anonimización o agregación antes de la transferencia"),
            L("Split processing across parties", "Tratamiento dividido entre las partes"),
            L("None", "Ninguna"),
          ],
          help: L(
            "Effective encryption with keys held outside the destination is the strongest technical safeguard against government access. Example: \"Encryption at rest with EU-held keys and pseudonymisation.\" Source: EDPB Recommendations 01/2020, Annex 2.",
            "El cifrado efectivo con claves custodiadas fuera del destino es la garantía técnica más sólida frente al acceso gubernamental. Ejemplo: «Cifrado en reposo con claves custodiadas en la UE y seudonimización». Fuente: Recomendaciones 01/2020 del CEPD, anexo 2.",
          ),
        },
        {
          id: "tiav2_3_2",
          type: "multiselect",
          text: L("Which contractual measures supplement the transfer tool?", "¿Qué medidas contractuales complementan el instrumento de transferencia?"),
          options: [
            L("Duty to challenge government access requests", "Obligación de impugnar las solicitudes de acceso gubernamental"),
            L("Duty to notify the exporter of access (where lawful)", "Obligación de notificar al exportador el acceso (cuando sea lícito)"),
            L("Transparency reporting obligation", "Obligación de publicar informes de transparencia"),
            L("No onward transfer without prior authorisation", "Prohibición de transferencias ulteriores sin autorización previa"),
            L("Audit rights for the exporter", "Derechos de auditoría del exportador"),
            L("Data localisation obligation", "Obligación de localización de datos"),
            L("Suspension or termination if the law changes", "Suspensión o resolución si cambia la ley"),
            L("None", "Ninguna"),
          ],
          help: L(
            "Contract terms bind the importer to resist and report access and to let the exporter act. Example: \"Duty to challenge and to notify, plus a suspension clause.\" Source: EDPB Recommendations 01/2020, Annex 2; SCC clause 15.",
            "Las cláusulas contractuales obligan al importador a resistir e informar del acceso y a permitir que el exportador actúe. Ejemplo: «Obligación de impugnar y de notificar, más una cláusula de suspensión». Fuente: Recomendaciones 01/2020 del CEPD, anexo 2; cláusula 15 de las CCT.",
          ),
        },
        {
          id: "tiav2_3_3",
          type: "multiselect",
          text: L("Which organisational measures are in place?", "¿Qué medidas organizativas existen?"),
          options: [
            L("Internal policy for responding to access requests", "Política interna de respuesta a solicitudes de acceso"),
            L("Staff training on data protection", "Formación del personal en protección de datos"),
            L("A designated privacy or compliance team at the importer", "Un equipo de privacidad o cumplimiento designado en el importador"),
            L("Recognised certifications (ISO 27001, SOC 2)", "Certificaciones reconocidas (ISO 27001, SOC 2)"),
            L("Incident response plan covering access scenarios", "Plan de respuesta a incidentes que cubre escenarios de acceso"),
            L("None", "Ninguna"),
          ],
          help: L(
            "Organisational measures back up the technical and contractual ones with people and procedures. Example: \"A documented access-request policy and annual ISO 27001 certification.\" Source: EDPB Recommendations 01/2020, Annex 2.",
            "Las medidas organizativas respaldan las técnicas y contractuales con personas y procedimientos. Ejemplo: «Una política documentada de solicitudes de acceso y certificación anual ISO 27001». Fuente: Recomendaciones 01/2020 del CEPD, anexo 2.",
          ),
        },
        {
          id: "tiav2_3_4",
          type: "textarea",
          text: L("Are the measures effective against the identified risks? Explain.", "¿Son las medidas eficaces frente a los riesgos identificados? Explícalo."),
          help: L(
            "Explain why the measures together do, or do not, bring the protection up to an essentially equivalent level. If the importer must access the data in the clear, encryption may not help against an access order. Example: \"Effective: data is pseudonymised and keys stay in the EU.\" Source: EDPB Recommendations 01/2020, step 4.",
            "Explica por qué las medidas, en conjunto, llevan o no la protección a un nivel esencialmente equivalente. Si el importador debe acceder a los datos en claro, el cifrado puede no servir frente a una orden de acceso. Ejemplo: «Eficaces: los datos están seudonimizados y las claves permanecen en la UE». Fuente: Recomendaciones 01/2020 del CEPD, paso 4.",
          ),
        },
      ],
    },
    {
      id: "tiav2_s4",
      title: L("Risk and conclusion", "Riesgo y conclusión"),
      description: L("Weigh the residual risk and decide whether the transfer can proceed.", "Pondera el riesgo residual y decide si la transferencia puede continuar."),
      questions: [
        {
          id: "tiav2_4_1",
          type: "select",
          text: L("How likely is government access to the transferred data?", "¿Qué probabilidad hay de acceso gubernamental a los datos transferidos?"),
          options: [
            L("Negligible", "Insignificante"),
            L("Low", "Baja"),
            L("Medium", "Media"),
            L("High", "Alta"),
          ],
          help: L(
            "Combine the destination's laws and practices with the data type and the safeguards. Example: \"Low: pseudonymised data, keys in the EU, sector not routinely targeted.\" Source: EDPB Recommendations 01/2020, step 3.",
            "Combina las leyes y prácticas del destino con el tipo de datos y las garantías. Ejemplo: «Baja: datos seudonimizados, claves en la UE, sector no habitualmente objetivo». Fuente: Recomendaciones 01/2020 del CEPD, paso 3.",
          ),
        },
        {
          id: "tiav2_4_2",
          type: "select",
          text: L("How severe would the impact on data subjects be if accessed?", "¿Qué gravedad tendría el impacto sobre los interesados en caso de acceso?"),
          options: [
            L("Negligible", "Insignificante"),
            L("Low", "Baja"),
            L("Medium", "Media"),
            L("High", "Alta"),
          ],
          help: L(
            "Weigh the harm to individuals if their data were accessed, given its sensitivity. Example: \"Medium: identifiable contact and usage data.\" Source: EDPB Recommendations 01/2020, step 3.",
            "Pondera el perjuicio para los interesados si se accediera a sus datos, según su sensibilidad. Ejemplo: «Media: datos de contacto y de uso identificables». Fuente: Recomendaciones 01/2020 del CEPD, paso 3.",
          ),
        },
        {
          id: "tiav2_4_3",
          type: "select",
          text: L("Can the transfer proceed?", "¿Puede continuar la transferencia?"),
          options: [
            L("Yes: essentially equivalent protection", "Sí: protección esencialmente equivalente"),
            L("Yes, with conditions", "Sí, con condiciones"),
            L("No: residual risk too high, suspend or find another route", "No: riesgo residual demasiado alto, suspender o buscar otra vía"),
          ],
          help: L(
            "The overall conclusion of the assessment. Where the risk cannot be brought down, the transfer should not proceed on this tool. Example: \"Yes, with conditions: implement EU-held keys first.\" Source: EDPB Recommendations 01/2020, step 6.",
            "La conclusión general de la evaluación. Cuando el riesgo no pueda reducirse, la transferencia no debe continuar con este instrumento. Ejemplo: «Sí, con condiciones: implantar primero claves en la UE». Fuente: Recomendaciones 01/2020 del CEPD, paso 6.",
          ),
        },
        {
          id: "tiav2_4_4",
          type: "textarea",
          required: false,
          text: L("If conditions are required, describe them.", "Si se requieren condiciones, descríbelas."),
          help: L(
            "List the specific actions that must be completed before or during the transfer. Example: \"Move key management to the EU; add a suspension clause to the contract.\" Source: EDPB Recommendations 01/2020, step 6.",
            "Enumera las acciones concretas que deben completarse antes o durante la transferencia. Ejemplo: «Trasladar la gestión de claves a la UE; añadir una cláusula de suspensión al contrato». Fuente: Recomendaciones 01/2020 del CEPD, paso 6.",
          ),
        },
      ],
    },
    {
      id: "tiav2_s5",
      title: L("Re-evaluation", "Reevaluación"),
      description: L("Define how the transfer is monitored and when it is reviewed.", "Define cómo se vigila la transferencia y cuándo se revisa."),
      questions: [
        {
          id: "tiav2_5_1",
          type: "multiselect",
          text: L("Which events should trigger a re-assessment?", "¿Qué acontecimientos deben desencadenar una reevaluación?"),
          options: [
            L("New legislation or executive order in the destination", "Nueva legislación u orden ejecutiva en el destino"),
            L("Adequacy decision revoked or challenged", "Decisión de adecuación revocada o impugnada"),
            L("The importer receives a government access request", "El importador recibe una solicitud de acceso gubernamental"),
            L("Change in data categories or volume", "Cambio en las categorías o el volumen de datos"),
            L("Change of sub-processor or onward transfer", "Cambio de subencargado o transferencia ulterior"),
            L("Periodic review (at least every 12 months)", "Revisión periódica (al menos cada 12 meses)"),
            L("Supervisory authority guidance or enforcement", "Directrices o medidas de una autoridad de control"),
          ],
          help: L(
            "A transfer assessment is not one-off: name the events that reopen it. Example: \"New access legislation; any access request; a 12-month review.\" Source: EDPB Recommendations 01/2020, step 6.",
            "La evaluación de una transferencia no es puntual: nombra los acontecimientos que la reabren. Ejemplo: «Nueva legislación de acceso; cualquier solicitud de acceso; una revisión a los 12 meses». Fuente: Recomendaciones 01/2020 del CEPD, paso 6.",
          ),
        },
        {
          id: "tiav2_5_2",
          type: "text",
          text: L("When is the next scheduled review?", "¿Cuándo está prevista la próxima revisión?"),
          help: L(
            "Give a specific date, in the form YYYY-MM-DD. Example: \"2027-04-01.\" Source: EDPB Recommendations 01/2020, step 6.",
            "Indica una fecha concreta, con el formato DD/MM/AAAA. Ejemplo: «01/04/2027». Fuente: Recomendaciones 01/2020 del CEPD, paso 6.",
          ),
        },
      ],
    },
  ],
};

// ============================================================================
// PIA v2 — Privacy Impact Assessment (GDPR core obligations)
// ============================================================================

const piaV2: V2Template = {
  id: "system-pia-template-v2",
  // There is no v1 PIA in the open-source repo, so on this build nothing is
  // superseded. Where a premium PIA skill has installed `system-pia-template`,
  // the guarded supersede retires it in favour of the structured v2, so the
  // picker never offers both. Running PIA assessments keep their template by id.
  supersedes: "system-pia-template",
  type: "PIA" as AssessmentType,
  version: "2.0",
  name: L("Privacy Impact Assessment", "Evaluación de impacto en la privacidad"),
  description: L(
    "A broad privacy review of a processing activity: the data, the purposes, the lawful basis, retention, recipients, the rights of individuals and security, with structured answers. Informational, not legal advice; verify with qualified counsel.",
    "Una revisión amplia de la privacidad de una actividad de tratamiento: los datos, las finalidades, la base jurídica, la conservación, los destinatarios, los derechos de las personas y la seguridad, con respuestas estructuradas. Informativo, no asesoramiento jurídico; verifícalo con un profesional cualificado.",
  ),
  sections: [
    {
      id: "piav2_s1",
      title: L("The processing", "El tratamiento"),
      description: L("Describe what is processed, why and about whom.", "Describe qué se trata, por qué y sobre quién."),
      questions: [
        {
          id: "piav2_1_1",
          type: "textarea",
          text: L("What is the purpose of the processing?", "¿Cuál es la finalidad del tratamiento?"),
          help: L(
            "State the specific, explicit purpose, which every later question is measured against. Example: \"Managing customer orders and after-sales support.\" Source: GDPR Art. 5(1)(b).",
            "Indica la finalidad específica y explícita, con la que se contrasta cada pregunta posterior. Ejemplo: «Gestionar los pedidos de los clientes y la atención posventa». Fuente: RGPD, art. 5.1.b).",
          ),
        },
        {
          id: "piav2_1_2",
          type: "multiselect",
          text: L("What categories of personal data are processed?", "¿Qué categorías de datos personales se tratan?"),
          options: [
            L("Contact details", "Datos de contacto"),
            L("Identifiers", "Identificadores"),
            L("Financial data", "Datos financieros"),
            L("Behavioural or usage data", "Datos de comportamiento o de uso"),
            L("Location data", "Datos de localización"),
            L("Special category data", "Categorías especiales de datos"),
            L("Criminal-offence data", "Datos penales"),
          ],
          help: L(
            "List every category, because the categories drive the risk and the obligations. Example: \"Contact details, identifiers, financial data.\" Source: GDPR Art. 30(1)(c).",
            "Enumera cada categoría, porque las categorías determinan el riesgo y las obligaciones. Ejemplo: «Datos de contacto, identificadores, datos financieros». Fuente: RGPD, art. 30.1.c).",
          ),
        },
        {
          id: "piav2_1_3",
          type: "boolean",
          text: L("Does the processing involve special category or criminal-offence data?", "¿Implica el tratamiento categorías especiales de datos o datos penales?"),
          help: L(
            "Special category data (Art. 9) and criminal-offence data (Art. 10) need a specific condition beyond the lawful basis. Example: \"No.\" Source: GDPR Arts. 9 and 10.",
            "Las categorías especiales de datos (art. 9) y los datos penales (art. 10) requieren una condición específica más allá de la base jurídica. Ejemplo: «No». Fuente: RGPD, arts. 9 y 10.",
          ),
        },
        {
          id: "piav2_1_4",
          type: "textarea",
          required: false,
          showIf: whenYes("piav2_1_3"),
          text: L("Which Article 9(2) or Article 10 condition applies?", "¿Qué condición del artículo 9.2 o del artículo 10 se aplica?"),
          help: L(
            "Name the specific condition that permits the special category or criminal-offence data. Example: \"Explicit consent (Art. 9(2)(a)).\" Source: GDPR Arts. 9(2) and 10.",
            "Nombra la condición específica que permite tratar las categorías especiales de datos o los datos penales. Ejemplo: «Consentimiento explícito (art. 9.2.a))». Fuente: RGPD, arts. 9.2 y 10.",
          ),
        },
        {
          id: "piav2_1_5",
          type: "multiselect",
          text: L("Who are the data subjects?", "¿Quiénes son los interesados?"),
          options: [
            L("Customers", "Clientes"),
            L("Employees", "Empleados"),
            L("Job applicants", "Candidatos a un empleo"),
            L("Suppliers or contacts", "Proveedores o contactos"),
            L("Website or app users", "Usuarios de la web o de la aplicación"),
            L("Children", "Menores"),
            L("Other vulnerable people", "Otras personas vulnerables"),
          ],
          help: L(
            "Name the groups whose data is processed. Children and vulnerable people call for extra care. Example: \"Customers and website users.\" Source: GDPR Art. 30(1)(c); Recital 38.",
            "Nombra los grupos cuyos datos se tratan. Los menores y las personas vulnerables exigen un cuidado adicional. Ejemplo: «Clientes y usuarios de la web». Fuente: RGPD, art. 30.1.c); considerando 38.",
          ),
        },
      ],
    },
    {
      id: "piav2_s2",
      title: L("Lawful basis and retention", "Base jurídica y conservación"),
      description: L("Record the lawful basis and how long the data is kept.", "Registra la base jurídica y durante cuánto tiempo se conservan los datos."),
      questions: [
        {
          id: "piav2_2_1",
          type: "select",
          text: L("What is the lawful basis for the processing?", "¿Cuál es la base jurídica del tratamiento?"),
          options: [
            L("Consent (Art. 6(1)(a))", "Consentimiento (art. 6.1.a))"),
            L("Contract (Art. 6(1)(b))", "Contrato (art. 6.1.b))"),
            L("Legal obligation (Art. 6(1)(c))", "Obligación legal (art. 6.1.c))"),
            L("Vital interests (Art. 6(1)(d))", "Intereses vitales (art. 6.1.d))"),
            L("Public task (Art. 6(1)(e))", "Misión de interés público (art. 6.1.e))"),
            L("Legitimate interests (Art. 6(1)(f))", "Interés legítimo (art. 6.1.f))"),
          ],
          help: L(
            "Every processing needs one of the six lawful bases, chosen before processing begins. Legitimate interest also needs a balancing test (the LIA template). Example: \"Contract.\" Source: GDPR Art. 6(1).",
            "Todo tratamiento necesita una de las seis bases jurídicas, elegida antes de empezar. El interés legítimo requiere además una ponderación (la plantilla LIA). Ejemplo: «Contrato». Fuente: RGPD, art. 6.1.",
          ),
        },
        {
          id: "piav2_2_2",
          type: "text",
          text: L("How long is the data kept, and from when?", "¿Cuánto tiempo se conservan los datos y desde cuándo?"),
          help: L(
            "State a retention period and its starting point, not \"as long as necessary\". Example: \"6 years from the end of the contract, for tax law.\" Source: GDPR Art. 5(1)(e).",
            "Indica un plazo de conservación y su punto de partida, no «el tiempo necesario». Ejemplo: «6 años desde el fin del contrato, por la normativa fiscal». Fuente: RGPD, art. 5.1.e).",
          ),
        },
        {
          id: "piav2_2_3",
          type: "boolean",
          text: L("Is the retention period justified and enforced?", "¿Está justificado y se aplica el plazo de conservación?"),
          help: L(
            "The period must be justified by the purpose or a legal duty, and the data actually deleted or anonymised at the end. Example: \"Yes: annual deletion job removes expired records.\" Source: GDPR Art. 5(1)(e).",
            "El plazo debe estar justificado por la finalidad o un deber legal, y los datos deben eliminarse o anonimizarse de verdad al final. Ejemplo: «Sí: una tarea anual de borrado elimina los registros caducados». Fuente: RGPD, art. 5.1.e).",
          ),
        },
      ],
    },
    {
      id: "piav2_s3",
      title: L("Recipients and transfers", "Destinatarios y transferencias"),
      description: L("Record who receives the data and any transfer abroad.", "Registra quién recibe los datos y cualquier transferencia al extranjero."),
      questions: [
        {
          id: "piav2_3_1",
          type: "multiselect",
          text: L("Who receives the data?", "¿Quién recibe los datos?"),
          options: [
            L("Internal teams only", "Solo equipos internos"),
            L("Processors acting on our behalf", "Encargados que actúan por cuenta nuestra"),
            L("Joint controllers", "Corresponsables"),
            L("Other controllers", "Otros responsables"),
            L("Public authorities", "Autoridades públicas"),
          ],
          help: L(
            "Name every category of recipient, because each adds obligations and risk. Example: \"Internal teams and a hosting processor.\" Source: GDPR Art. 30(1)(d).",
            "Nombra cada categoría de destinatario, porque cada una añade obligaciones y riesgo. Ejemplo: «Equipos internos y un encargado de alojamiento». Fuente: RGPD, art. 30.1.d).",
          ),
        },
        {
          id: "piav2_3_2",
          type: "boolean",
          text: L("Is every processor bound by a written data processing agreement (Art. 28)?", "¿Está cada encargado vinculado por un contrato de tratamiento por escrito (art. 28)?"),
          help: L(
            "A processor may only act under a contract with the terms Article 28 requires. Example: \"Yes: a signed DPA is in place with each processor.\" Source: GDPR Art. 28(3).",
            "Un encargado solo puede actuar bajo un contrato con las cláusulas que exige el artículo 28. Ejemplo: «Sí: hay un contrato de encargo firmado con cada encargado». Fuente: RGPD, art. 28.3.",
          ),
        },
        {
          id: "piav2_3_3",
          type: "boolean",
          text: L("Is any data transferred outside the EU or EEA?", "¿Se transfieren datos fuera de la UE o del EEE?"),
          help: L(
            "A transfer to a third country needs a transfer tool and, outside adequacy, a Transfer Impact Assessment (the TIA template). Example: \"Yes: our hosting provider is in the United States.\" Source: GDPR Arts. 44 to 49.",
            "Una transferencia a un tercer país necesita un instrumento de transferencia y, fuera de la adecuación, una evaluación de impacto de las transferencias (la plantilla EIT). Ejemplo: «Sí: nuestro proveedor de alojamiento está en Estados Unidos». Fuente: RGPD, arts. 44 a 49.",
          ),
        },
        {
          id: "piav2_3_4",
          type: "text",
          required: false,
          showIf: whenYes("piav2_3_3"),
          text: L("Which transfer tool covers it, and is a TIA in place?", "¿Qué instrumento de transferencia lo cubre y se ha hecho una EIT?"),
          help: L(
            "Name the transfer tool and whether a Transfer Impact Assessment has been done. Example: \"Standard Contractual Clauses; TIA completed 2026-05.\" Source: GDPR Arts. 46 and 44.",
            "Nombra el instrumento de transferencia e indica si se ha hecho una evaluación de impacto de las transferencias. Ejemplo: «Cláusulas contractuales tipo; EIT completada en mayo de 2026». Fuente: RGPD, arts. 46 y 44.",
          ),
        },
      ],
    },
    {
      id: "piav2_s4",
      title: L("Rights and transparency", "Derechos y transparencia"),
      description: L("Record how individuals are informed and how their rights are met.", "Registra cómo se informa a las personas y cómo se atienden sus derechos."),
      questions: [
        {
          id: "piav2_4_1",
          type: "boolean",
          text: L("Have individuals been given the privacy information required by Articles 13-14?", "¿Se ha facilitado a las personas la información sobre privacidad que exigen los artículos 13 y 14?"),
          help: L(
            "People must be told who processes their data, why, on what basis, for how long and what rights they have. Example: \"Yes: a layered privacy notice at the point of collection.\" Source: GDPR Arts. 13 and 14.",
            "Debe informarse a las personas de quién trata sus datos, por qué, con qué base, durante cuánto tiempo y qué derechos tienen. Ejemplo: «Sí: una información sobre privacidad por capas en el momento de la recogida». Fuente: RGPD, arts. 13 y 14.",
          ),
        },
        {
          id: "piav2_4_2",
          type: "multiselect",
          text: L("Which data subject rights are supported?", "¿Qué derechos de los interesados se atienden?"),
          options: [
            L("Access (Art. 15)", "Acceso (art. 15)"),
            L("Rectification (Art. 16)", "Rectificación (art. 16)"),
            L("Erasure (Art. 17)", "Supresión (art. 17)"),
            L("Restriction (Art. 18)", "Limitación (art. 18)"),
            L("Portability (Art. 20)", "Portabilidad (art. 20)"),
            L("Objection (Art. 21)", "Oposición (art. 21)"),
          ],
          help: L(
            "You must be able to honour the rights that apply to your basis and processing. Example: \"Access, rectification, erasure and objection.\" Source: GDPR Arts. 15 to 22.",
            "Debes poder atender los derechos que correspondan a tu base y a tu tratamiento. Ejemplo: «Acceso, rectificación, supresión y oposición». Fuente: RGPD, arts. 15 a 22.",
          ),
        },
        {
          id: "piav2_4_3",
          type: "boolean",
          text: L("Is there solely automated decision-making with legal or similarly significant effects?", "¿Existen decisiones basadas únicamente en el tratamiento automatizado con efectos jurídicos o efectos significativos similares?"),
          help: L(
            "Decisions made solely by automated means with a legal or similarly significant effect are restricted and need specific safeguards. Example: \"No: a person reviews every decision.\" Source: GDPR Art. 22.",
            "Las decisiones tomadas únicamente por medios automatizados con un efecto jurídico o un efecto significativo similar están restringidas y necesitan garantías específicas. Ejemplo: «No: una persona revisa cada decisión». Fuente: RGPD, art. 22.",
          ),
        },
        {
          id: "piav2_4_4",
          type: "textarea",
          required: false,
          showIf: whenYes("piav2_4_3"),
          text: L("What safeguards apply to the automated decision-making?", "¿Qué garantías se aplican a esas decisiones automatizadas?"),
          help: L(
            "Describe the lawful ground and the safeguards: the right to human intervention, to express a view and to contest the decision. Example: \"Explicit consent; the person can request a human review.\" Source: GDPR Art. 22(3).",
            "Describe la base jurídica y las garantías: el derecho a la intervención humana, a expresar su punto de vista y a impugnar la decisión. Ejemplo: «Consentimiento explícito; la persona puede solicitar una revisión humana». Fuente: RGPD, art. 22.3.",
          ),
        },
      ],
    },
    {
      id: "piav2_s5",
      title: L("Security and outcome", "Seguridad y resultado"),
      description: L("Record the security measures and the overall privacy risk.", "Registra las medidas de seguridad y el riesgo global para la privacidad."),
      questions: [
        {
          id: "piav2_5_1",
          type: "multiselect",
          text: L("Which security measures protect the data (Art. 32)?", "¿Qué medidas de seguridad protegen los datos (art. 32)?"),
          options: [
            L("Encryption", "Cifrado"),
            L("Pseudonymisation", "Seudonimización"),
            L("Access controls", "Controles de acceso"),
            L("Logging and monitoring", "Registro y vigilancia"),
            L("Backups and recovery", "Copias de seguridad y recuperación"),
            L("Staff training", "Formación del personal"),
            L("Regular testing of measures", "Pruebas periódicas de las medidas"),
          ],
          help: L(
            "Measures must be appropriate to the risk, covering confidentiality, integrity, availability and resilience. Example: \"Encryption, access controls, backups and logging.\" Source: GDPR Art. 32.",
            "Las medidas deben ser adecuadas al riesgo y cubrir la confidencialidad, integridad, disponibilidad y resiliencia. Ejemplo: «Cifrado, controles de acceso, copias de seguridad y registro». Fuente: RGPD, art. 32.",
          ),
        },
        {
          id: "piav2_5_2",
          type: "select",
          text: L("What is the overall privacy risk after these measures?", "¿Cuál es el riesgo global para la privacidad tras estas medidas?"),
          options: [
            L("Low", "Bajo"),
            L("Medium", "Medio"),
            L("High", "Alto"),
          ],
          help: L(
            "Give the residual risk once the measures are in place. A high residual risk points to a full DPIA and possibly prior consultation. Example: \"Low.\" Source: GDPR Arts. 35 and 36.",
            "Indica el riesgo residual una vez aplicadas las medidas. Un riesgo residual alto apunta a una EIPD completa y posiblemente a una consulta previa. Ejemplo: «Bajo». Fuente: RGPD, arts. 35 y 36.",
          ),
        },
        {
          id: "piav2_5_3",
          type: "textarea",
          required: false,
          text: L("What residual actions or recommendations remain?", "¿Qué acciones residuales o recomendaciones quedan?"),
          help: L(
            "Note any follow-up needed to reduce the risk further or to keep the assessment current. Example: \"Schedule a DPIA if profiling is added.\" Source: GDPR Art. 35(1).",
            "Anota cualquier seguimiento necesario para reducir más el riesgo o mantener la evaluación al día. Ejemplo: «Programar una EIPD si se añade la elaboración de perfiles». Fuente: RGPD, art. 35.1.",
          ),
        },
      ],
    },
  ],
};

// ============================================================================
// CUSTOM v2 — flexible review
// ============================================================================

const customV2: V2Template = {
  id: "system-custom-template-v2",
  supersedes: "system-custom-template",
  type: "CUSTOM" as AssessmentType,
  version: "2.0",
  name: L("Custom Assessment", "Evaluación personalizada"),
  description: L(
    "A flexible assessment for custom privacy reviews, with a structured risk answer and room for a written rationale. Informational, not legal advice; verify with qualified counsel.",
    "Una evaluación flexible para revisiones de privacidad personalizadas, con una respuesta de riesgo estructurada y espacio para una justificación escrita. Informativo, no asesoramiento jurídico; verifícalo con un profesional cualificado.",
  ),
  sections: [
    {
      id: "customv2_s1",
      title: L("Overview", "Descripción"),
      description: L("Describe the scope and purpose of this assessment.", "Describe el alcance y la finalidad de esta evaluación."),
      questions: [
        {
          id: "customv2_1_1",
          type: "textarea",
          text: L("What is the purpose of this assessment?", "¿Cuál es la finalidad de esta evaluación?"),
          help: L(
            "Say what you are evaluating and why, so the reader knows the scope. Example: \"Reviewing a new marketing analytics tool before launch.\" Source: GDPR Art. 24 (accountability).",
            "Di qué estás evaluando y por qué, para que el lector conozca el alcance. Ejemplo: «Revisar una nueva herramienta de analítica de marketing antes de su lanzamiento». Fuente: RGPD, art. 24 (responsabilidad proactiva).",
          ),
        },
        {
          id: "customv2_1_2",
          type: "textarea",
          text: L("What is the scope of this assessment?", "¿Cuál es el alcance de esta evaluación?"),
          help: L(
            "Define the systems, processes or data flows in scope, and anything left out. Example: \"The web analytics pipeline; excludes the CRM.\" Source: GDPR Art. 24.",
            "Define los sistemas, procesos o flujos de datos incluidos, y lo que queda fuera. Ejemplo: «La cadena de analítica web; excluye el CRM». Fuente: RGPD, art. 24.",
          ),
        },
      ],
    },
    {
      id: "customv2_s2",
      title: L("Risk evaluation", "Evaluación del riesgo"),
      description: L("Identify the key risks and rate them.", "Identifica los riesgos principales y valóralos."),
      questions: [
        {
          id: "customv2_2_1",
          type: "textarea",
          text: L("What are the key risks identified?", "¿Cuáles son los principales riesgos identificados?"),
          help: L(
            "Name the concrete risks to individuals or to compliance, not generic ones. Example: \"Tracking without consent; over-collection of behavioural data.\" Source: GDPR Art. 24.",
            "Nombra los riesgos concretos para las personas o para el cumplimiento, no genéricos. Ejemplo: «Seguimiento sin consentimiento; recogida excesiva de datos de comportamiento». Fuente: RGPD, art. 24.",
          ),
        },
        {
          id: "customv2_2_2",
          type: "select",
          text: L("What is the overall risk level?", "¿Cuál es el nivel de riesgo global?"),
          options: [
            L("Low", "Bajo"),
            L("Medium", "Medio"),
            L("High", "Alto"),
            L("Critical", "Crítico"),
          ],
          help: L(
            "Give a single overall rating for the risks above, before mitigation. Example: \"Medium.\" Source: GDPR Art. 24.",
            "Da una única valoración global de los riesgos anteriores, antes de la mitigación. Ejemplo: «Medio». Fuente: RGPD, art. 24.",
          ),
        },
      ],
    },
    {
      id: "customv2_s3",
      title: L("Mitigations and recommendations", "Mitigaciones y recomendaciones"),
      description: L("Record the mitigations and the residual position.", "Registra las mitigaciones y la posición residual."),
      questions: [
        {
          id: "customv2_3_1",
          type: "textarea",
          text: L("What mitigations are in place or recommended?", "¿Qué mitigaciones existen o se recomiendan?"),
          help: L(
            "List the measures that reduce the risks and who owns them. Example: \"Consent banner before any tracking; retention capped at 14 months.\" Source: GDPR Art. 24.",
            "Enumera las medidas que reducen los riesgos y quién es responsable. Ejemplo: «Aviso de consentimiento antes de cualquier seguimiento; conservación limitada a 14 meses». Fuente: RGPD, art. 24.",
          ),
        },
        {
          id: "customv2_3_2",
          type: "select",
          text: L("Is the residual risk acceptable?", "¿Es aceptable el riesgo residual?"),
          options: [
            L("Yes, fully acceptable", "Sí, plenamente aceptable"),
            L("Acceptable with conditions", "Aceptable con condiciones"),
            L("Needs further review", "Requiere revisión adicional"),
            L("Not acceptable", "No aceptable"),
          ],
          help: L(
            "State whether the risk that remains after mitigation is acceptable, and under what conditions. Example: \"Acceptable with conditions: launch after the consent banner is live.\" Source: GDPR Art. 24.",
            "Indica si el riesgo que queda tras la mitigación es aceptable y en qué condiciones. Ejemplo: «Aceptable con condiciones: lanzar tras activar el aviso de consentimiento». Fuente: RGPD, art. 24.",
          ),
        },
      ],
    },
  ],
};

export const ASSESSMENT_TEMPLATES_V2: readonly V2Template[] = [liaV2, tiaV2, piaV2, customV2];

// --- serialisation to the DB `sections` JSON (English) ----------------------

/** The English JSON stored for one question in AssessmentTemplate.sections. */
function serializeQuestion(q: V2Question): Record<string, unknown> {
  return {
    id: q.id,
    text: q.text.en,
    type: q.type,
    required: q.required !== false,
    ...(q.help ? { helpText: q.help.en } : {}),
    ...(q.options ? { options: q.options.map((o) => o.en) } : {}),
    ...(q.showIf ? { showIf: q.showIf } : {}),
  };
}

/** The English JSON stored in AssessmentTemplate.sections for a v2 template. */
export function serializeSections(template: V2Template): Record<string, unknown>[] {
  return template.sections.map((s) => ({
    id: s.id,
    title: s.title.en,
    description: s.description.en,
    ...(s.showIf ? { showIf: s.showIf } : {}),
    questions: s.questions.map(serializeQuestion),
  }));
}

/** The full data object for upsertSystemTemplate / a migration INSERT. */
export function templateSeedData(template: V2Template) {
  return {
    type: template.type,
    name: template.name.en,
    description: template.description.en,
    version: template.version,
    isSystem: true,
    isActive: true,
    sections: serializeSections(template) as unknown as Prisma.InputJsonValue,
    scoringLogic: SCORING as unknown as Prisma.InputJsonValue,
  };
}

// --- serialisation to the message bundle (templates.<type>.…) ----------------

interface BundleType {
  template: Record<string, { name: string; description: string }>;
  section: Record<string, { title: string; description: string }>;
  question: Record<string, { text: string; helpText?: string; options?: string[] }>;
}

/**
 * The v2 message-bundle entries for one locale, keyed by lowercased template
 * type (lia, tia, pia, custom). Deep-merged into the existing `templates`
 * namespace by scripts/sync-template-v2-messages.ts, so v1 entries are kept.
 */
export function templateV2Messages(locale: ContentLocale): Record<string, BundleType> {
  const out: Record<string, BundleType> = {};
  for (const template of ASSESSMENT_TEMPLATES_V2) {
    const key = String(template.type).toLowerCase();
    const bundle: BundleType = out[key] ?? { template: {}, section: {}, question: {} };
    bundle.template[template.id] = {
      name: template.name[locale],
      description: template.description[locale],
    };
    for (const section of template.sections) {
      bundle.section[section.id] = {
        title: section.title[locale],
        description: section.description[locale],
      };
      for (const q of section.questions) {
        bundle.question[q.id] = {
          text: q.text[locale],
          ...(q.help ? { helpText: q.help[locale] } : {}),
          ...(q.options ? { options: q.options.map((o) => o[locale]) } : {}),
        };
      }
    }
    out[key] = bundle;
  }
  return out;
}
