// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The three short guides a newcomer needs before the product makes sense:
 * "Controller or processor?", "Do I need a DPO?" and "When is a DPIA required?".
 *
 * They are docs pages under /privacy/docs/guides, linked from every help panel
 * and from the first-run card. The content is typed data here (bilingual), like
 * the rest of the help feature, so a page stays a thin renderer and a sister
 * app can reuse the same shape.
 *
 * Legal references are named in the text, not hidden, and each guide carries
 * the official links it rests on. Content is plain, not advice: it explains the
 * law, it does not decide a reader's position for them.
 */

import type { Localized } from "@/config/help/localized";
import { OFFICIAL_LINKS, type OfficialLink } from "@/config/help/official-links";

const L = (en: string, es: string): Localized => ({ en, es });

export interface GuideItem {
  /** A short bold lead, e.g. a role name or a trigger. */
  term: Localized;
  /** The plain explanation. */
  body: Localized;
  /** An example, shown as "For example: ...". Optional. */
  example?: Localized;
}

export interface GuideSection {
  heading: Localized;
  /** Free paragraphs before the items. */
  intro?: Localized;
  items?: GuideItem[];
}

export type GuideSlug = "controller-or-processor" | "do-i-need-a-dpo" | "when-is-a-dpia-required";

export interface Guide {
  slug: GuideSlug;
  title: Localized;
  lead: Localized;
  sections: GuideSection[];
  official: OfficialLink[];
  /** Where the reader most likely goes next, inside the product. */
  next?: { href: string; label: Localized };
}

export const GUIDES: Guide[] = [
  {
    slug: "controller-or-processor",
    title: L("Controller or processor?", "¿Responsable o encargado?"),
    lead: L(
      "The GDPR gives you duties according to the role you play around a set of personal data. Deciding why and how data is processed makes you a controller; processing it for someone else on their instructions makes you a processor. The same organisation can be a controller for some data and a processor for other data.",
      "El RGPD te asigna obligaciones según el papel que desempeñes respecto a un conjunto de datos personales. Decidir por qué y cómo se tratan los datos te convierte en responsable; tratarlos para otra parte y siguiendo sus instrucciones te convierte en encargado. Una misma organización puede ser responsable de unos datos y encargada de otros.",
    ),
    sections: [
      {
        heading: L("The roles", "Los papeles"),
        items: [
          {
            term: L("Controller", "Responsable del tratamiento"),
            body: L(
              "Decides the purposes and the means of the processing, that is, why the data is used and, broadly, how (GDPR Art. 4). The controller carries the main duties: a lawful basis, transparency to people, and answering their rights requests.",
              "Decide los fines y los medios del tratamiento, es decir, por qué se usan los datos y, en lo esencial, cómo (RGPD art. 4). El responsable asume las obligaciones principales: una base jurídica, la transparencia hacia las personas y la respuesta a sus solicitudes de derechos.",
            ),
            example: L(
              "A shop that decides to email its own customers about their orders.",
              "Una tienda que decide enviar correos a sus propios clientes sobre sus pedidos.",
            ),
          },
          {
            term: L("Processor", "Encargado del tratamiento"),
            body: L(
              "Processes personal data only on a controller's documented instructions, never for its own purposes, and must be bound by a written contract that the GDPR spells out (Art. 28).",
              "Trata datos personales únicamente siguiendo las instrucciones documentadas de un responsable, nunca para fines propios, y debe estar vinculado por un contrato escrito que el RGPD detalla (art. 28).",
            ),
            example: L(
              "An email platform the shop uses to send those messages, acting on the shop's instructions.",
              "Una plataforma de correo que la tienda utiliza para enviar esos mensajes, actuando según las instrucciones de la tienda.",
            ),
          },
          {
            term: L("Joint controller", "Corresponsable del tratamiento"),
            body: L(
              "Where two or more parties together decide the purposes and means of the same processing, they are joint controllers and must agree, in a transparent way, who meets which duty (GDPR Art. 26).",
              "Cuando dos o más partes deciden conjuntamente los fines y los medios de un mismo tratamiento, son corresponsables y deben acordar, de forma transparente, quién cumple cada obligación (RGPD art. 26).",
            ),
            example: L(
              "Two companies that run a joint campaign and decide together how the shared sign-up data is used.",
              "Dos empresas que realizan una campaña conjunta y deciden juntas cómo se usan los datos de registro compartidos.",
            ),
          },
        ],
      },
      {
        heading: L("Why it matters here", "Por qué importa aquí"),
        intro: L(
          "Your role decides which records DPO Central expects of you. A controller keeps the record of processing, answers rights requests, and reports breaches. A processor keeps a lighter record and supports its controller. If you act as both, keep the two apart: record the processing you control, and note where you are only a processor for a client.",
          "Tu papel decide qué registros espera de ti DPO Central. Un responsable mantiene el registro de actividades de tratamiento, responde a las solicitudes de derechos y notifica las violaciones de seguridad. Un encargado mantiene un registro más ligero y da apoyo a su responsable. Si actúas como ambos, mantén los dos separados: registra el tratamiento que controlas e indica dónde eres solo un encargado para un cliente.",
        ),
      },
    ],
    official: [OFFICIAL_LINKS.gdpr, OFFICIAL_LINKS.gdprArt28],
    next: {
      href: "/privacy/data-inventory",
      label: L("Go to the data inventory", "Ir al inventario de datos"),
    },
  },
  {
    slug: "do-i-need-a-dpo",
    title: L("Do I need a DPO?", "¿Necesito un DPD?"),
    lead: L(
      "A data protection officer (DPO) is an independent person who advises on data protection and is a point of contact for the supervisory authority. The GDPR makes one compulsory in three cases; many organisations appoint one anyway, and some other laws set their own rule.",
      "Un delegado de protección de datos (DPD) es una persona independiente que asesora sobre protección de datos y actúa como punto de contacto con la autoridad de control. El RGPD lo hace obligatorio en tres supuestos; muchas organizaciones designan uno de todos modos, y algunas otras leyes fijan su propia regla.",
    ),
    sections: [
      {
        heading: L("When the GDPR requires one (Art. 37)", "Cuándo lo exige el RGPD (art. 37)"),
        intro: L(
          "You must appoint a DPO in any of these cases:",
          "Debes designar un DPD en cualquiera de estos supuestos:",
        ),
        items: [
          {
            term: L("A public authority", "Una autoridad pública"),
            body: L(
              "The processing is carried out by a public authority or body, except courts acting in their judicial capacity.",
              "El tratamiento lo lleva a cabo una autoridad u organismo público, salvo los tribunales que actúan en ejercicio de su función judicial.",
            ),
          },
          {
            term: L("Large-scale regular monitoring", "Observación habitual a gran escala"),
            body: L(
              "Your core activities require regular and systematic monitoring of people on a large scale, such as tracking online behaviour to build profiles.",
              "Tus actividades principales requieren una observación habitual y sistemática de personas a gran escala, como el seguimiento del comportamiento en línea para elaborar perfiles.",
            ),
          },
          {
            term: L("Large-scale special category data", "Categorías especiales a gran escala"),
            body: L(
              "Your core activities consist of processing special category data (such as health data) or data on criminal convictions on a large scale.",
              "Tus actividades principales consisten en tratar a gran escala categorías especiales de datos (como datos de salud) o datos sobre condenas penales.",
            ),
          },
        ],
      },
      {
        heading: L("Beyond the GDPR", "Más allá del RGPD"),
        intro: L(
          "Other regimes set their own trigger. Brazil's LGPD and several laws in Asia and Africa require a data protection officer or equivalent for most controllers. Under the UK GDPR the test mirrors the EU one. US state privacy laws do not require a named DPO, but they do expect someone to be accountable for the programme. Even where no law compels it, a named lead is the person the rest of the programme answers to.",
          "Otros regímenes fijan su propio desencadenante. La LGPD de Brasil y varias leyes de Asia y África exigen un delegado de protección de datos o figura equivalente para la mayoría de los responsables. En el RGPD del Reino Unido el criterio refleja el de la UE. Las leyes estatales de privacidad de EE. UU. no exigen un DPD designado, pero sí esperan que alguien rinda cuentas del programa. Incluso donde ninguna ley lo obliga, una persona responsable designada es la figura ante la que responde el resto del programa.",
        ),
      },
      {
        heading: L("What follows if you appoint one", "Qué se deriva de designarlo"),
        intro: L(
          "A DPO must be able to act independently, report to the highest level of management, and not be penalised for the advice they give (GDPR Arts. 38 and 39). The role can be an employee or an external adviser, and one DPO can serve a group of companies. Record the appointment and publish the contact details.",
          "Un DPD debe poder actuar de forma independiente, rendir cuentas al más alto nivel directivo y no ser sancionado por el asesoramiento que preste (RGPD arts. 38 y 39). El puesto puede ocuparlo un empleado o un asesor externo, y un mismo DPD puede dar servicio a un grupo de empresas. Registra la designación y publica los datos de contacto.",
        ),
      },
    ],
    official: [OFFICIAL_LINKS.gdprArt37_39, OFFICIAL_LINKS.gdpr],
    next: {
      href: "/privacy/settings",
      label: L("Record your roles in Settings", "Registra tus funciones en Configuración"),
    },
  },
  {
    slug: "when-is-a-dpia-required",
    title: L("When is a DPIA required?", "¿Cuándo se exige una EIPD?"),
    lead: L(
      "A data protection impact assessment (DPIA) is a written analysis you carry out before processing that is likely to result in a high risk to people's rights. It is required by GDPR Art. 35, and a supervisory authority may add processing of its own to the list.",
      "Una evaluación de impacto relativa a la protección de datos (EIPD) es un análisis escrito que realizas antes de un tratamiento que probablemente entrañe un alto riesgo para los derechos de las personas. La exige el art. 35 del RGPD, y una autoridad de control puede añadir a la lista tratamientos propios.",
    ),
    sections: [
      {
        heading: L("The three cases named in Art. 35(3)", "Los tres supuestos del art. 35.3"),
        intro: L(
          "The GDPR names three kinds of processing that always call for a DPIA:",
          "El RGPD nombra tres tipos de tratamiento que siempre exigen una EIPD:",
        ),
        items: [
          {
            term: L("Systematic and extensive profiling", "Elaboración de perfiles sistemática y extensa"),
            body: L(
              "A systematic and extensive evaluation of people based on automated processing, including profiling, on which decisions are based that significantly affect them.",
              "Una evaluación sistemática y exhaustiva de personas basada en un tratamiento automatizado, incluida la elaboración de perfiles, sobre cuya base se toman decisiones que les afectan significativamente.",
            ),
          },
          {
            term: L("Large-scale special category data", "Categorías especiales a gran escala"),
            body: L(
              "Processing on a large scale of special category data (such as health, race or religion) or of data on criminal convictions and offences.",
              "Tratamiento a gran escala de categorías especiales de datos (como salud, origen o religión) o de datos sobre condenas e infracciones penales.",
            ),
          },
          {
            term: L("Large-scale monitoring of a public area", "Observación a gran escala de una zona pública"),
            body: L(
              "A systematic monitoring of a publicly accessible area on a large scale, such as widespread video surveillance.",
              "Una observación sistemática a gran escala de una zona de acceso público, como la videovigilancia generalizada.",
            ),
          },
        ],
      },
      {
        heading: L("The authorities' lists", "Las listas de las autoridades"),
        intro: L(
          "Each supervisory authority publishes a list of processing operations that always need a DPIA, and may publish a list of those that do not. Common additions are: combining datasets from different sources, processing on a large scale, using new technologies, tracking location or behaviour, and processing data about vulnerable people such as children or employees. Check the list of the authority that supervises you.",
          "Cada autoridad de control publica una lista de tratamientos que siempre necesitan una EIPD y puede publicar una lista de los que no. Adiciones habituales son: combinar conjuntos de datos de distintas fuentes, tratar a gran escala, usar nuevas tecnologías, rastrear la ubicación o el comportamiento y tratar datos de personas vulnerables como menores o empleados. Consulta la lista de la autoridad que te supervisa.",
        ),
      },
      {
        heading: L("The triggers, in plain words", "Los desencadenantes, en palabras llanas"),
        intro: L(
          "As a rule of thumb, screen for a DPIA whenever a processing operation meets two or more of these signals: it evaluates or scores people, it makes automated decisions with a real effect, it handles special category data, it works on a large scale, it matches or combines datasets, it involves vulnerable people, it uses a new technology, or it prevents people from exercising a right or using a service. DPO Central screens each processing activity and prompts a DPIA where the risk is high.",
          "Como regla práctica, analiza si procede una EIPD siempre que un tratamiento reúna dos o más de estas señales: evalúa o puntúa a personas, toma decisiones automatizadas con un efecto real, maneja categorías especiales de datos, opera a gran escala, cruza o combina conjuntos de datos, afecta a personas vulnerables, usa una tecnología nueva o impide a las personas ejercer un derecho o usar un servicio. DPO Central analiza cada actividad de tratamiento y propone una EIPD cuando el riesgo es alto.",
        ),
      },
    ],
    official: [OFFICIAL_LINKS.gdprArt35, OFFICIAL_LINKS.gdprArt36],
    next: {
      href: "/privacy/assessments",
      label: L("Go to assessments", "Ir a las evaluaciones"),
    },
  },
];

const BY_SLUG: Record<string, Guide> = Object.fromEntries(GUIDES.map((g) => [g.slug, g]));

export function guideBySlug(slug: string): Guide | undefined {
  return BY_SLUG[slug];
}
