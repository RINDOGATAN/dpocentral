// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The help content for every dashboard page, as typed data.
 *
 * One entry per page (keyed by its base path). The "?" panel reads these, so
 * the content lives here and the component stays product-neutral: a sister app
 * reuses the component by supplying its own registry of the same shape.
 *
 * Each entry says, in plain words, what the page is for, what to do first, the
 * terms it uses (resolved to their meanings from the glossary), a way into the
 * fuller docs, and, where the page enforces a law, a link to the words of the
 * law. Everything is bilingual.
 *
 * A detail or "new" page (`/privacy/vendors/123`) has no entry of its own;
 * `helpForPath` falls back to the nearest parent, so the section's help still
 * opens there.
 */

import type { Localized, PageHelp } from "@/config/help/types";
import { OFFICIAL_LINKS } from "@/config/help/official-links";
import { isDsarModuleEnabled } from "@/config/features";

const L = (en: string, es: string): Localized => ({ en, es });

const DOC = (href: string, en: string, es: string) => ({ href, label: L(en, es) });

export const PAGE_HELP: PageHelp[] = [
  {
    route: "/privacy",
    title: L("Dashboard", "Panel"),
    purpose: L(
      "The one screen that shows where your privacy programme stands: what is recorded, what still needs doing, and the next thing to attend to across your data, vendors, assessments and requests.",
      "La pantalla que muestra dónde está tu programa de privacidad: qué está registrado, qué queda por hacer y lo próximo que atender en tus datos, proveedores, evaluaciones y solicitudes.",
    ),
    firstStep: L(
      "If you are just starting, open Quick start; otherwise use the next-step card to go to whatever is still open.",
      "Si empiezas ahora, abre el inicio rápido; si no, usa la tarjeta de siguiente paso para ir a lo que quede pendiente.",
    ),
    terms: ["controller", "processor", "rights-request"],
    docs: [DOC("/privacy/docs", "How DPO Central works", "Cómo funciona DPO Central")],
    official: [OFFICIAL_LINKS.gdpr],
  },
  {
    route: "/privacy/quickstart",
    title: L("Quick start", "Inicio rápido"),
    purpose: L(
      "A short guided path that sets up a working programme in minutes: it works out which laws apply, adds an industry template, and brings in the vendors you use from the catalogue.",
      "Un recorrido guiado breve que pone en marcha un programa en minutos: determina qué leyes aplican, añade una plantilla sectorial e incorpora desde el catálogo los proveedores que utilizas.",
    ),
    firstStep: L(
      "Answer the applicability questions first, so the rest of the programme is scoped to the laws that reach you.",
      "Responde primero las preguntas de aplicabilidad, para que el resto del programa se ajuste a las leyes que te alcanzan.",
    ),
    terms: ["controller", "processor", "lawful-basis"],
    docs: [
      DOC("/privacy/docs/quickstart", "The quick start", "El inicio rápido"),
      DOC("/privacy/docs/guides/controller-or-processor", "Controller or processor?", "¿Responsable o encargado?"),
    ],
    official: [OFFICIAL_LINKS.gdpr],
  },
  {
    route: "/privacy/regulations",
    title: L("What applies", "Qué aplica"),
    purpose: L(
      "The laws that reach your organisation, decided by where you operate and whose data you process. Declaring your jurisdictions here is the switch the rest of the product reads to scope everything to you.",
      "Las leyes que alcanzan a tu organización, decididas por dónde operas y de quién tratas datos. Declarar aquí tus jurisdicciones es el interruptor que lee el resto del producto para ajustarlo todo a ti.",
    ),
    firstStep: L(
      "Run the applicability wizard, or add each jurisdiction where you operate or have people whose data you process.",
      "Ejecuta el asistente de aplicabilidad o añade cada jurisdicción donde operas o donde hay personas de las que tratas datos.",
    ),
    terms: ["controller", "adequacy"],
    docs: [
      DOC("/privacy/docs/regulations", "Regulations and jurisdictions", "Normativa y jurisdicciones"),
      DOC("/privacy/docs/guides/do-i-need-a-dpo", "Do I need a DPO?", "¿Necesito un DPD?"),
    ],
    official: [OFFICIAL_LINKS.gdpr, OFFICIAL_LINKS.ukGdpr, OFFICIAL_LINKS.usStateLaws],
  },
  {
    route: "/privacy/data-inventory",
    title: L("Data inventory and records of processing", "Inventario de datos y registro de actividades"),
    purpose: L(
      "The record of what personal data you hold, where it lives, and how you process it. A complete inventory and an Art. 30 record of processing are the starting point for every other duty.",
      "El registro de qué datos personales tienes, dónde residen y cómo los tratas. Un inventario completo y un registro de actividades de tratamiento del art. 30 son el punto de partida de cualquier otra obligación.",
    ),
    firstStep: L(
      "Record your data assets first (the systems that hold personal data), then a processing activity for each purpose.",
      "Registra primero tus activos de datos (los sistemas que contienen datos personales) y luego una actividad de tratamiento por cada finalidad.",
    ),
    terms: ["controller", "processor", "lawful-basis", "special-category-data"],
    docs: [DOC("/privacy/docs/data-inventory", "The data inventory", "El inventario de datos")],
    official: [OFFICIAL_LINKS.gdprArt30, OFFICIAL_LINKS.gdprArt5],
  },
  {
    route: "/privacy/vendors",
    title: L("Vendors and processors", "Proveedores y encargados"),
    purpose: L(
      "Your register of the outside suppliers that process personal data for you, and the due-diligence review of each. When a processor fails, the controller answers for it, so the contract and the review matter.",
      "Tu registro de los proveedores externos que tratan datos personales para ti y la revisión de diligencia debida de cada uno. Cuando un encargado falla, responde el responsable, así que el contrato y la revisión importan.",
    ),
    firstStep: L(
      "Add a vendor from the catalogue, then record its data processing agreement and complete its due-diligence review.",
      "Añade un proveedor desde el catálogo, registra su contrato de encargo del tratamiento y completa su revisión de diligencia debida.",
    ),
    terms: ["processor", "sccs"],
    docs: [DOC("/privacy/docs/vendors", "Vendors", "Proveedores")],
    official: [OFFICIAL_LINKS.gdprArt28],
  },
  {
    route: "/privacy/ai-systems",
    title: L("AI systems", "Sistemas de IA"),
    purpose: L(
      "The AI systems that use personal data, shown here so your privacy records are complete. AI governance itself (risk classification, oversight, conformity) is done in AI Sentinel, not here.",
      "Los sistemas de IA que usan datos personales, mostrados aquí para que tus registros de privacidad estén completos. La gobernanza de la IA en sí (clasificación de riesgo, supervisión, conformidad) se hace en AI Sentinel, no aquí.",
    ),
    firstStep: L(
      "Review each AI system that uses personal data; to govern one, open it in AI Sentinel.",
      "Revisa cada sistema de IA que usa datos personales; para gobernarlo, ábrelo en AI Sentinel.",
    ),
    terms: ["controller", "special-category-data"],
    docs: [DOC("/privacy/docs/ai-governance", "AI and privacy", "IA y privacidad")],
    official: [OFFICIAL_LINKS.gdprArt35],
  },
  {
    route: "/privacy/assessments",
    title: L("Assessments", "Evaluaciones"),
    purpose: L(
      "Where you screen processing for risk and carry out the assessments a law expects: a DPIA for high-risk processing, a legitimate interests assessment, a transfer impact assessment. Each finished assessment is evidence you can show a regulator.",
      "Donde analizas el riesgo del tratamiento y realizas las evaluaciones que espera la ley: una EIPD para el tratamiento de alto riesgo, un juicio de ponderación del interés legítimo, una evaluación de impacto de la transferencia. Cada evaluación terminada es una prueba que puedes mostrar a una autoridad de control.",
    ),
    firstStep: L(
      "Screen a processing activity first; where the risk is high, start a DPIA from the screening.",
      "Analiza primero una actividad de tratamiento; cuando el riesgo sea alto, inicia una EIPD desde el análisis.",
    ),
    terms: ["dpia", "lia", "tia", "special-category-data"],
    docs: [
      DOC("/privacy/docs/assessments", "Assessments", "Evaluaciones"),
      DOC("/privacy/docs/guides/when-is-a-dpia-required", "When is a DPIA required?", "¿Cuándo se exige una EIPD?"),
    ],
    official: [OFFICIAL_LINKS.gdprArt35, OFFICIAL_LINKS.gdprArt36, OFFICIAL_LINKS.gdprArt6f],
  },
  {
    route: "/privacy/transfers",
    title: L("Transfers", "Transferencias"),
    purpose: L(
      "The record of personal data you send across borders, and the safeguard each transfer relies on. A transfer to a country without an adequacy decision needs its own mechanism, such as the standard contractual clauses.",
      "El registro de los datos personales que envías fuera de tus fronteras y la garantía en la que se apoya cada transferencia. Una transferencia a un país sin decisión de adecuación necesita su propio mecanismo, como las cláusulas contractuales tipo.",
    ),
    firstStep: L(
      "Record each cross-border transfer and the mechanism it relies on (adequacy, SCCs, or a derogation).",
      "Registra cada transferencia internacional y el mecanismo en el que se apoya (adecuación, cláusulas tipo o una excepción).",
    ),
    terms: ["tia", "sccs", "adequacy"],
    docs: [DOC("/privacy/docs/transfer-compliance", "Transfers and safeguards", "Transferencias y garantías")],
    official: [OFFICIAL_LINKS.gdprArt44_49],
  },
  {
    route: "/privacy/dsar",
    title: L("Rights requests", "Solicitudes de derechos"),
    purpose: L(
      "The requests people make to use their data protection rights, with the clock each law puts on answering them. Under the GDPR you have one month; a public intake form lets people reach you directly.",
      "Las solicitudes que hacen las personas para ejercer sus derechos de protección de datos, con el plazo que cada ley marca para responderlas. En el RGPD dispones de un mes; un formulario público de recepción permite que las personas te contacten directamente.",
    ),
    firstStep: L(
      "Set up your intake form in Settings, then record and answer each request within the deadline.",
      "Configura tu formulario de recepción en Configuración y luego registra y responde cada solicitud dentro del plazo.",
    ),
    terms: ["rights-request", "controller"],
    docs: [DOC("/privacy/docs/dsar", "Rights requests", "Solicitudes de derechos")],
    official: [OFFICIAL_LINKS.gdprArt15_22, OFFICIAL_LINKS.gdprArt12_14],
  },
  {
    route: "/privacy/incidents",
    title: L("Breach register", "Registro de brechas"),
    purpose: L(
      "The log of personal data breaches, with the 72-hour clock the GDPR puts on notifying the supervisory authority. A breach that poses a risk to people must be notified without undue delay.",
      "El registro de las brechas de seguridad de los datos personales, con el plazo de 72 horas que el RGPD marca para notificar a la autoridad de control. Una brecha que suponga un riesgo para las personas debe notificarse sin dilación indebida.",
    ),
    firstStep: L(
      "Record a breach as soon as it is known; the timeline and the 72-hour clock start from that moment.",
      "Registra una brecha en cuanto se conozca; la cronología y el plazo de 72 horas arrancan desde ese momento.",
    ),
    terms: ["breach", "seventy-two-hours"],
    docs: [DOC("/privacy/docs/incidents", "The breach register", "El registro de brechas")],
    official: [OFFICIAL_LINKS.gdprArt33_34],
  },
  {
    route: "/privacy/reports",
    title: L("Reports", "Informes"),
    purpose: L(
      "The documents you can produce from your records: the record of processing, the vendor register, the breach register, DSAR performance and more, each as a PDF you can keep or share.",
      "Los documentos que puedes generar a partir de tus registros: el registro de actividades, el registro de proveedores, el registro de brechas, el rendimiento de las solicitudes de derechos y más, cada uno en PDF para conservar o compartir.",
    ),
    firstStep: L(
      "Pick the report you need; it is built from the records you already keep.",
      "Elige el informe que necesitas; se genera a partir de los registros que ya mantienes.",
    ),
    terms: ["controller"],
    docs: [DOC("/privacy/docs/reports", "Reports", "Informes")],
    official: [OFFICIAL_LINKS.gdprArt5],
  },
  {
    route: "/privacy/board-report",
    title: L("Board report", "Informe para la dirección"),
    purpose: L(
      "A short report for the board or management on where the privacy programme stands in a period: the programme figure, documents, incidents, rights requests, vendors, assessments, the main gaps and the next actions. It is built from the records you already keep; it states facts and gives no legal advice.",
      "Un informe breve para el consejo o la dirección sobre en qué punto está el programa de privacidad en un periodo: la cifra del programa, los documentos, los incidentes, las solicitudes de derechos, los proveedores, las evaluaciones, las principales carencias y las próximas acciones. Se genera con los registros que ya mantienes; recoge hechos y no es asesoramiento jurídico.",
    ),
    firstStep: L(
      "Choose the period, add your comment and save it, then download the PDF.",
      "Elige el periodo, añade tu comentario y guárdalo, y descarga el PDF.",
    ),
    terms: [],
    docs: [DOC("/privacy/docs/reports", "Reports", "Informes")],
    official: [],
  },
  {
    route: "/privacy/experts",
    title: L("Find an expert", "Buscar un experto"),
    purpose: L(
      "A directory of privacy professionals you can reach for help, filtered by what they do. Contacting one sends your request to them; DPO Central does not act as the adviser.",
      "Un directorio de profesionales de la privacidad a los que puedes recurrir, filtrado por lo que hacen. Contactar con uno le envía tu solicitud; DPO Central no actúa como asesor.",
    ),
    firstStep: L(
      "Filter by the help you need, then send a request to an expert.",
      "Filtra por la ayuda que necesitas y envía una solicitud a un experto.",
    ),
    terms: [],
    docs: [DOC("/privacy/docs/experts", "Finding an expert", "Buscar un experto")],
    official: [],
  },
  {
    route: "/privacy/clients",
    title: L("All clients", "Todos los clientes"),
    purpose: L(
      "For accounts that work for several client organisations: one view showing where each client stands, so you can see at a glance which needs attention. Each client keeps its own separate records.",
      "Para las cuentas que trabajan para varias organizaciones cliente: una vista que muestra dónde está cada cliente, para ver de un vistazo cuál necesita atención. Cada cliente conserva sus propios registros separados.",
    ),
    firstStep: L(
      "Pick a client to open its programme, or add a new client organisation.",
      "Elige un cliente para abrir su programa o añade una nueva organización cliente.",
    ),
    terms: [],
    docs: [DOC("/privacy/docs", "How DPO Central works", "Cómo funciona DPO Central")],
    official: [],
  },
  {
    route: "/privacy/skills",
    title: L("Skills", "Complementos"),
    purpose: L(
      "Where you upload and activate a licence for a premium package bought from the storefront. A licence unlocks a feature; it never installs code, and it is tied to the buyer's email.",
      "Donde subes y activas una licencia de un paquete premium comprado en la tienda. Una licencia desbloquea una función; nunca instala código y está vinculada al correo del comprador.",
    ),
    firstStep: L(
      "Upload your licence file to activate it; only an owner or admin can do this.",
      "Sube tu archivo de licencia para activarla; solo un propietario o administrador puede hacerlo.",
    ),
    terms: [],
    docs: [DOC("/privacy/docs", "How DPO Central works", "Cómo funciona DPO Central")],
    official: [],
  },
  {
    route: "/privacy/settings",
    title: L("Settings", "Configuración"),
    purpose: L(
      "Your organisation's own details: its operating jurisdictions, the team and their roles, the DSAR intake form. The jurisdictions you set here decide which laws the rest of the product applies.",
      "Los datos de tu organización: sus jurisdicciones de actividad, el equipo y sus funciones, el formulario de recepción de solicitudes. Las jurisdicciones que fijes aquí deciden qué leyes aplica el resto del producto.",
    ),
    firstStep: L(
      "Set your operating jurisdictions and appoint a privacy lead; both drive what applies to you.",
      "Fija tus jurisdicciones de actividad y designa un responsable de privacidad; ambos determinan lo que te aplica.",
    ),
    terms: ["controller", "processor"],
    docs: [DOC("/privacy/docs/guides/do-i-need-a-dpo", "Do I need a DPO?", "¿Necesito un DPD?")],
    official: [OFFICIAL_LINKS.gdprArt37_39],
  },
  {
    route: "/privacy/billing",
    title: L("Billing", "Facturación"),
    purpose: L(
      "Your subscription and payment details. On the hosted pilot and the self-hosted kit the in-app features are free, so this is only shown where paid billing is turned on.",
      "Tu suscripción y datos de pago. En el piloto alojado y en el kit autoalojado las funciones de la aplicación son gratuitas, así que esto solo aparece donde la facturación de pago está activada.",
    ),
    firstStep: L("Review your plan and payment method.", "Revisa tu plan y tu método de pago."),
    terms: [],
    docs: [DOC("/privacy/docs", "How DPO Central works", "Cómo funciona DPO Central")],
    official: [],
  },
  {
    route: "/privacy/docs",
    title: L("Help and docs", "Ayuda y documentación"),
    purpose: L(
      "The reference for the whole product: how each part works, the three short guides, and the words of the laws behind them. It is where to read more when the in-page help is not enough.",
      "La referencia de todo el producto: cómo funciona cada parte, las tres guías breves y el texto de las leyes que las sustentan. Es donde leer más cuando la ayuda de la página no basta.",
    ),
    firstStep: L(
      "Start with the guides, or pick the section you are working in.",
      "Empieza por las guías o elige la sección en la que estás trabajando.",
    ),
    terms: [],
    docs: [DOC("/privacy/docs", "How DPO Central works", "Cómo funciona DPO Central")],
    official: [OFFICIAL_LINKS.gdpr],
  },
];

const BY_ROUTE: Record<string, PageHelp> = Object.fromEntries(
  PAGE_HELP.map((entry) => [entry.route, entry]),
);

/** Every route that has its own help entry, longest first (for prefix matching). */
const ROUTES_BY_LENGTH = PAGE_HELP.map((entry) => entry.route).sort(
  (a, b) => b.length - a.length,
);

/**
 * The help for a path. An exact match wins; otherwise the nearest parent that
 * has an entry, so a detail or "new" page shows its section's help. `null` when
 * nothing matches (a page outside the privacy area).
 */
export function helpForPath(pathname: string): PageHelp | null {
  const clean = pathname.split("?")[0].replace(/\/+$/, "") || "/privacy";
  // No help about rights requests when the module is not part of this plan:
  // the page shows a short note instead (src/config/features.ts).
  if (!isDsarModuleEnabled() && (clean === "/privacy/dsar" || clean.startsWith("/privacy/dsar/"))) {
    return null;
  }
  if (BY_ROUTE[clean]) return BY_ROUTE[clean];
  for (const route of ROUTES_BY_LENGTH) {
    if (route === "/privacy") continue; // never let the root swallow a child
    if (clean === route || clean.startsWith(route + "/")) return BY_ROUTE[route];
  }
  if (clean === "/privacy" || clean.startsWith("/privacy/")) {
    return BY_ROUTE["/privacy"];
  }
  return null;
}

/** The base routes that must each carry help, for the coverage test. */
export const HELP_ROUTES: string[] = PAGE_HELP.map((entry) => entry.route);
