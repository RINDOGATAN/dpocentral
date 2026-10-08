// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The glossary: one short, plain meaning for each privacy term the product uses
 * that a newcomer may not know. One file, English and Castilian Spanish, so the
 * Term component and the help panel read the same words everywhere, and so a
 * sister app can reuse the component by copying this data.
 *
 * A meaning is one sentence. Where the term comes from a law, the reference is
 * named in the sentence itself, not hidden in a link, because a reader who
 * stops at the tooltip should still leave with the citation.
 *
 * The terms are the ones the product leans on and a consultant asked to see
 * explained: controller, processor, joint controller, lawful basis, legitimate
 * interest, special category data, DPIA, LIA, TIA, SCCs, adequacy, rights
 * request, breach, the 72-hour clock, and sale/share under the CCPA.
 */

import type { ContentLocale, Localized } from "@/config/help/localized";

export type { ContentLocale, Localized };

export interface GlossaryTerm {
  /** Stable id, used by the term component and the page help registry. */
  id: string;
  /** The word as it is shown, so a term can carry an acronym or capitalisation. */
  label: Localized;
  /** One sentence, plain words. Names the law where the term is a legal one. */
  meaning: Localized;
  /** Optional deeper reading inside the product docs. */
  docHref?: string;
}

const L = (en: string, es: string): Localized => ({ en, es });

const ROLE_GUIDE = "/privacy/docs/guides/controller-or-processor";
const DPIA_GUIDE = "/privacy/docs/guides/when-is-a-dpia-required";

export const GLOSSARY: GlossaryTerm[] = [
  {
    id: "controller",
    label: L("controller", "responsable del tratamiento"),
    meaning: L(
      "The party that decides why and how personal data is processed, and so carries the main duties under the GDPR (Art. 4).",
      "La parte que decide por qué y cómo se tratan los datos personales y, por tanto, asume las obligaciones principales del RGPD (art. 4).",
    ),
    docHref: ROLE_GUIDE,
  },
  {
    id: "processor",
    label: L("processor", "encargado del tratamiento"),
    meaning: L(
      "The party that processes personal data on a controller's behalf and on its instructions, bound by a written contract (GDPR Arts. 4 and 28).",
      "La parte que trata datos personales por cuenta del responsable y siguiendo sus instrucciones, vinculada por un contrato escrito (RGPD arts. 4 y 28).",
    ),
    docHref: ROLE_GUIDE,
  },
  {
    id: "joint-controller",
    label: L("joint controller", "corresponsable del tratamiento"),
    meaning: L(
      "One of two or more controllers that together decide the purposes and means of the same processing, and must agree who does what (GDPR Art. 26).",
      "Uno de dos o más responsables que deciden conjuntamente los fines y los medios de un mismo tratamiento y deben acordar quién hace qué (RGPD art. 26).",
    ),
    docHref: ROLE_GUIDE,
  },
  {
    id: "lawful-basis",
    label: L("lawful basis", "base jurídica"),
    meaning: L(
      "The legal ground that makes a processing operation lawful; the GDPR allows six, one of which must apply before you process (Art. 6).",
      "El fundamento legal que hace lícita una operación de tratamiento; el RGPD admite seis, y uno de ellos debe darse antes de tratar (art. 6).",
    ),
  },
  {
    id: "legitimate-interest",
    label: L("legitimate interest", "interés legítimo"),
    meaning: L(
      "A lawful basis where your interest, or a third party's, justifies processing unless the person's rights override it; it must be weighed in a balancing test (GDPR Art. 6(1)(f)).",
      "Una base jurídica en la que tu interés, o el de un tercero, justifica el tratamiento salvo que prevalezcan los derechos de la persona; se pondera mediante un juicio de ponderación (RGPD art. 6.1.f).",
    ),
  },
  {
    id: "special-category-data",
    label: L("special category data", "categorías especiales de datos"),
    meaning: L(
      "Personal data the GDPR gives extra protection, such as health, race, religion, sexual orientation or biometric data; processing it needs a further condition (Art. 9).",
      "Datos personales a los que el RGPD da protección reforzada, como salud, origen, religión, orientación sexual o datos biométricos; tratarlos exige una condición adicional (art. 9).",
    ),
  },
  {
    id: "dpia",
    label: L("DPIA", "EIPD"),
    meaning: L(
      "A data protection impact assessment: a written analysis of a processing operation likely to be high risk, required before it begins (GDPR Art. 35).",
      "Una evaluación de impacto relativa a la protección de datos: un análisis escrito de un tratamiento que probablemente entrañe un alto riesgo, exigido antes de comenzarlo (RGPD art. 35).",
    ),
    docHref: DPIA_GUIDE,
  },
  {
    id: "lia",
    label: L("LIA", "juicio de ponderación"),
    meaning: L(
      "A legitimate interests assessment: the written balancing of your interest against the person's rights, kept as the record for relying on that basis (GDPR Art. 6(1)(f)).",
      "Un análisis del interés legítimo: la ponderación escrita de tu interés frente a los derechos de la persona, conservada como prueba para apoyarte en esa base (RGPD art. 6.1.f).",
    ),
  },
  {
    id: "tia",
    label: L("TIA", "evaluación de la transferencia"),
    meaning: L(
      "A transfer impact assessment: the check that data sent to a third country will still be protected, weighing that country's law and the safeguards in place (GDPR Arts. 44 to 49).",
      "Una evaluación de impacto de la transferencia: la comprobación de que los datos enviados a un tercer país seguirán protegidos, sopesando la legislación de ese país y las garantías adoptadas (RGPD arts. 44 a 49).",
    ),
  },
  {
    id: "sccs",
    label: L("SCCs", "cláusulas contractuales tipo"),
    meaning: L(
      "Standard contractual clauses: the model terms the European Commission approves so a transfer to a third country carries adequate safeguards (GDPR Art. 46).",
      "Cláusulas contractuales tipo: los términos modelo que aprueba la Comisión Europea para que una transferencia a un tercer país lleve garantías adecuadas (RGPD art. 46).",
    ),
  },
  {
    id: "adequacy",
    label: L("adequacy", "decisión de adecuación"),
    meaning: L(
      "A European Commission decision that a country protects personal data well enough for transfers to it to need no further safeguard (GDPR Art. 45).",
      "Una decisión de la Comisión Europea de que un país protege los datos personales lo suficiente para que las transferencias a él no necesiten garantías adicionales (RGPD art. 45).",
    ),
  },
  {
    id: "rights-request",
    label: L("rights request", "solicitud de derechos"),
    meaning: L(
      "A request from a person to use a data protection right, such as access, correction or erasure; the GDPR sets a one-month deadline to answer (Arts. 12 and 15 to 22). Also called a DSAR.",
      "Una solicitud de una persona para ejercer un derecho de protección de datos, como acceso, rectificación o supresión; el RGPD fija un plazo de un mes para responder (arts. 12 y 15 a 22). En inglés se conoce como DSAR.",
    ),
  },
  {
    id: "breach",
    label: L("personal data breach", "brecha de seguridad de los datos personales"),
    meaning: L(
      "A breach of security leading to the loss, unauthorised disclosure of, or access to personal data, whether by accident or an attack (GDPR Art. 4).",
      "Una violación de la seguridad que ocasiona la pérdida, la comunicación no autorizada o el acceso a datos personales, ya sea por accidente o por un ataque (RGPD art. 4).",
    ),
  },
  {
    id: "seventy-two-hours",
    label: L("72 hours", "72 horas"),
    meaning: L(
      "The deadline to notify the supervisory authority of a personal data breach: without undue delay and, where feasible, within 72 hours of becoming aware (GDPR Art. 33).",
      "El plazo para notificar a la autoridad de control una brecha de seguridad de los datos personales: sin dilación indebida y, de ser posible, en un plazo de 72 horas desde que se tiene constancia (RGPD art. 33).",
    ),
  },
  {
    id: "sale-share",
    label: L("sale or share", "venta o cesión"),
    meaning: L(
      "Under California's CCPA/CPRA, disclosing a consumer's personal information for money or other value, or for cross-context behavioural advertising; the consumer may opt out.",
      "Según la CCPA/CPRA de California, comunicar la información personal de un consumidor a cambio de dinero u otro valor, o para publicidad comportamental entre contextos; el consumidor puede oponerse.",
    ),
  },
];

const BY_ID: Record<string, GlossaryTerm> = Object.fromEntries(
  GLOSSARY.map((term) => [term.id, term]),
);

/** The term for an id, or undefined when the id is unknown. */
export function glossaryTerm(id: string): GlossaryTerm | undefined {
  return BY_ID[id];
}

/** Every term id, for tests and for building an index page. */
export const GLOSSARY_IDS: string[] = GLOSSARY.map((term) => term.id);
