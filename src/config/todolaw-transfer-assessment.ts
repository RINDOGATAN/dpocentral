// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The ready-made transfer impact assessment (TIA, in Spanish EIT) for the
 * TODO.LAW transfer that every hosted organisation holds
 * (src/server/services/todolaw-processor.ts): RINDOGATAN LLC, the processor,
 * is a United States company and no adequacy decision covers the transfer;
 * the data stays in Frankfurt and its staff may reach it from the United
 * States, under the EU standard contractual clauses, Module Two, incorporated
 * into the processing agreement (clause 9), and the supplementary measures.
 *
 * The answers follow the system TIA template (src/config/assessment-templates-v2.ts,
 * six steps of EDPB Recommendations 01/2020) and describe only the measures
 * the code and the processing agreement actually provide. Select answers are
 * the template's English option labels; the writer stores them in the
 * organisation's language through the template's own option lists.
 *
 * The organisation is the controller: the assessment is written as a draft
 * for its approval, never approved on its behalf.
 */

import type { PilotDpaLocale } from "@/config/pilot-dpa";

/** Changes whenever the text below changes, so an old draft can be told apart. */
export const TODOLAW_TIA_VERSION = "2026-10-24";

/** Select and multiselect answers, as the template's English option labels. */
export const TODOLAW_TIA_CHOICES: Record<string, string | string[] | boolean> = {
  tiav2_1_1: "Standard Contractual Clauses (Art. 46)",
  tiav2_1_2: "Module 2: controller to processor",
  tiav2_1_3: ["Contact details", "Identifiers"],
  tiav2_1_5: false,
  tiav2_2_1: "No adequacy decision",
  tiav2_2_2: "Access exists but with effective oversight and safeguards",
  tiav2_2_3: "No: never received such a request",
  tiav2_2_4: "Yes: independent judicial review",
  tiav2_3_1: ["Encryption in transit (TLS 1.2 or higher)"],
  tiav2_3_2: [
    "Duty to challenge government access requests",
    "Duty to notify the exporter of access (where lawful)",
    "Audit rights for the exporter",
    "Data localisation obligation",
    "Suspension or termination if the law changes",
  ],
  tiav2_3_3: ["Internal policy for responding to access requests"],
  tiav2_4_1: "Low",
  tiav2_4_2: "Medium",
  tiav2_4_3: "Yes: essentially equivalent protection",
  tiav2_5_1: [
    "New legislation or executive order in the destination",
    "The importer receives a government access request",
    "Change in data categories or volume",
    "Change of sub-processor or onward transfer",
    "Periodic review (at least every 12 months)",
    "Supervisory authority guidance or enforcement",
  ],
};

/** The free-text answers, per language. */
export const TODOLAW_TIA_TEXT: Record<PilotDpaLocale, Record<string, string>> = {
  en: {
    tiav2_1_4:
      "Exporter: the organisation, as controller, established in the European Economic Area. Importer: RINDOGATAN LLC (TODO.LAW), a Wyoming company in the United States, as processor under the processing agreement accepted when the organisation was opened. " +
      "The data (the accounts of the organisation's users and what its team records in the programme, including rights requests where the module is used) is stored in European Union data centres in Frankfurt, and the server functions run there too. " +
      "The transfer takes the form of remote access by a small number of the importer's staff from the United States, only to provide, maintain or protect the service or to help the organisation when it asks (processing agreement, clause 6). " +
      "Onward transfers go only to the sub-processors listed in Annex III of the agreement, several of them United States companies, each with the transfer safeguards stated in that annex. AI features are off by default; only if an administrator switches them on are the details of the record being drafted sent to the AI provider in Annex III.",
    tiav2_2_5:
      "No adequacy decision covers this transfer: it relies on the standard contractual clauses (Module Two) and the supplementary measures in step 3. " +
      "The laws considered are Section 702 of the Foreign Intelligence Surveillance Act (the importer hosts customer data and may qualify as a provider that can receive directives), Executive Order 12333 (collection outside the United States, including in transit) and the CLOUD Act (orders to providers subject to US jurisdiction, wherever the data is stored). " +
      "Executive Order 14086 limits signals intelligence to what is necessary and proportionate and created the Data Protection Review Court; those safeguards apply to data of people in the EU whatever transfer tool is used. " +
      "In practice, the importer has not received any government request for access to customer data to date, and the data (privacy programme records of businesses and the rights requests they receive) is of low interest for intelligence purposes.",
    tiav2_3_4:
      "Technical: all connections use HTTPS (TLS); data is encrypted at rest with AES-256 by the hosting and database providers. The keys are held by those providers, so this encryption protects against unauthorised access, not against compelled disclosure. The data and the server functions stay in Frankfurt, which keeps the data out of reach of collection in transit outside the EEA. Each organisation's data is logically separated. " +
      "Access: only a small number of the importer's staff, with personal accounts and two-factor authentication at the hosting, database and code providers, and access to production data only for support, security or at the organisation's request. " +
      "Rights requests: the importer's staff do not open them unless the organisation asks in writing; every opening, including a support read, is logged in the request's own trail, which the organisation can see; a support read shows the requester's identity and the content of the request masked unless the ticket needs them, and the trail records whether they were shown. The automatic e-mails do not include the description of the request, and the reminders to the team do not name the requester. No request is ever sent to an AI service. The personal data of each request is removed thirty days after it is closed. " +
      "Contractual: the processing agreement obliges the importer to challenge requests where there are reasonable grounds, to disclose only the minimum and to inform the organisation unless the law forbids it (clause 9), and gives the organisation audit rights (clause 14); the standard contractual clauses add Clauses 14 and 15 and allow suspension and termination. " +
      "Organisational: staff are bound by written confidentiality commitments (clause 6); the importer has a representative in the Union (clause 15). " +
      "Taken together, and given the low likelihood of access, the measures address the risks identified.",
    tiav2_4_4:
      "None beyond the measures described. Re-evaluate at least every twelve months, and at once if the importer receives a government access request, if Executive Order 14086 or the US laws considered in step 2 change, or if the sub-processors change.",
  },
  es: {
    tiav2_1_4:
      "Exportador: la organización, como responsable, establecida en el Espacio Económico Europeo. Importador: RINDOGATAN LLC (TODO.LAW), sociedad de Wyoming (Estados Unidos), como encargado con el contrato de encargo aceptado al abrir la organización. " +
      "Los datos (las cuentas de los usuarios de la organización y lo que su equipo registra en el programa, incluidas las solicitudes de derechos si se usa el módulo) se guardan en centros de datos de la Unión Europea, en Fráncfort, y las funciones de servidor también se ejecutan allí. " +
      "La transferencia consiste en el acceso remoto de un número reducido de personas del importador desde Estados Unidos, solo para prestar, mantener o proteger el servicio o para ayudar a la organización cuando lo pide (contrato de encargo, cláusula 6). " +
      "Las transferencias ulteriores van solo a los subencargados del anexo III del contrato, varios de ellos sociedades estadounidenses, cada uno con las garantías de transferencia que indica ese anexo. Las funciones de IA están desactivadas por defecto; solo si un administrador las activa se envían los datos del registro que se redacta al proveedor de IA del anexo III.",
    tiav2_2_5:
      "Ninguna decisión de adecuación cubre esta transferencia: se basa en las SCC (módulo 2) y en las medidas complementarias del paso 3. " +
      "Se han tenido en cuenta el artículo 702 de la Ley de Vigilancia de Inteligencia Extranjera (el importador aloja datos de clientes y puede considerarse un proveedor que recibe requerimientos), la Orden Ejecutiva 12333 (recogida fuera de Estados Unidos, también en tránsito) y la CLOUD Act (órdenes a proveedores sujetos a la jurisdicción estadounidense, estén donde estén los datos). " +
      "La Orden Ejecutiva 14086 limita la inteligencia de señales a lo necesario y proporcionado y crea el Tribunal de Revisión de la Protección de Datos; esas garantías se aplican a los datos de personas de la UE sea cual sea el instrumento de transferencia. " +
      "En la práctica, el importador no ha recibido hasta hoy ninguna solicitud de acceso de las autoridades a datos de clientes, y los datos (registros de programas de privacidad de empresas y las solicitudes de derechos que reciben) tienen poco interés para fines de inteligencia.",
    tiav2_3_4:
      "Técnicas: todas las conexiones usan HTTPS (TLS); los datos se cifran en reposo con AES-256 por los proveedores de alojamiento y de base de datos. Las claves las custodian esos proveedores, así que este cifrado protege frente a accesos no autorizados, no frente a una revelación obligada. Los datos y las funciones de servidor se quedan en Fráncfort, lo que evita la recogida en tránsito fuera del EEE. Los datos de cada organización están separados lógicamente. " +
      "Acceso: solo un número reducido de personas del importador, con cuentas personales y autenticación en dos pasos en los proveedores de alojamiento, base de datos y código, y acceso a los datos de producción solo para soporte, seguridad o a petición de la organización. " +
      "Solicitudes de derechos: el personal del importador no las abre salvo que la organización lo pida por escrito; cada apertura, también una lectura de soporte, queda registrada en el historial de la propia solicitud, que la organización puede ver; una lectura de soporte muestra enmascarados la identidad del solicitante y el contenido de la solicitud salvo que el caso los necesite, y el historial anota si se han mostrado. Los correos automáticos no incluyen la descripción de la solicitud y los recordatorios al equipo no nombran al solicitante. Ninguna solicitud se envía nunca a un servicio de IA. Los datos personales de cada solicitud se eliminan treinta días después de cerrarla. " +
      "Contractuales: el contrato de encargo obliga al importador a impugnar las solicitudes cuando haya motivos razonables, a revelar solo lo mínimo y a informar a la organización salvo que la ley lo prohíba (cláusula 9), y da a la organización derecho de auditoría (cláusula 14); las SCC añaden sus cláusulas 14 y 15 y permiten suspender y resolver. " +
      "Organizativas: el personal está obligado por compromisos de confidencialidad por escrito (cláusula 6); el importador tiene un representante en la Unión (cláusula 15). " +
      "En conjunto, y dada la baja probabilidad de acceso, las medidas cubren los riesgos identificados.",
    tiav2_4_4:
      "Ninguna además de las medidas descritas. Vuelve a evaluarla al menos cada doce meses, y en cuanto el importador reciba una solicitud de acceso de las autoridades, cambien la Orden Ejecutiva 14086 o las leyes estadounidenses del paso 2, o cambien los subencargados.",
  },
};

/** Supplementary measures on the transfer page that the facts above support. */
export const TODOLAW_SUPPLEMENTARY_MEASURES = [
  "tech_encryption_transit",
  "tech_encryption_rest",
  "tech_access_controls",
  "cont_enhanced_clauses",
  "cont_warrant_canary",
  "cont_audit_rights",
] as const;

/** Schrems II checklist answers, with a short note each. */
export const TODOLAW_CHECKLIST: Record<string, { state: "DONE" | "NA"; note: Record<PilotDpaLocale, string> }> = {
  s2_1_map_transfers: {
    state: "DONE",
    note: {
      en: "Staff access from the United States and the sub-processors in Annex III of the processing agreement.",
      es: "Acceso del personal desde Estados Unidos y subencargados del anexo III del contrato de encargo.",
    },
  },
  s2_1_verify_necessity: {
    state: "DONE",
    note: {
      en: "Needed to support and maintain the service; the data itself stays in Frankfurt.",
      es: "Necesario para dar soporte y mantener el servicio; los datos se quedan en Fráncfort.",
    },
  },
  s2_2_identify_mechanism: {
    state: "DONE",
    note: { en: "SCC, Module Two (processing agreement, clause 9).", es: "SCC, módulo dos (contrato de encargo, cláusula 9)." },
  },
  s2_2_scc_version: {
    state: "DONE",
    note: { en: "Commission Implementing Decision (EU) 2021/914.", es: "Decisión de Ejecución (UE) 2021/914." },
  },
  s2_3_assess_laws: {
    state: "DONE",
    note: { en: "See the TIA, step 2.", es: "Consulta la EIT, paso 2." },
  },
  s2_3_access_requests: {
    state: "DONE",
    note: { en: "FISA 702, EO 12333, CLOUD Act and EO 14086: see the TIA.", es: "FISA 702, OE 12333, CLOUD Act y OE 14086: consulta la EIT." },
  },
  s2_3_practical_experience: {
    state: "DONE",
    note: { en: "No government access request received to date.", es: "Ninguna solicitud de acceso de las autoridades hasta hoy." },
  },
  s2_4_supplementary_needed: {
    state: "DONE",
    note: { en: "Measures recorded below and in the TIA, step 3.", es: "Medidas registradas abajo y en la EIT, paso 3." },
  },
  s2_4_measures_effective: {
    state: "DONE",
    note: { en: "Assessed in the TIA, steps 3 and 4.", es: "Evaluadas en la EIT, pasos 3 y 4." },
  },
  s2_5_formal_steps: {
    state: "NA",
    note: {
      en: "SCC need no authorisation from the supervisory authority.",
      es: "Las SCC no necesitan autorización de la autoridad de control.",
    },
  },
  s2_5_documentation: {
    state: "DONE",
    note: { en: "The TIA attached to this transfer.", es: "La EIT vinculada a esta transferencia." },
  },
  s2_6_monitor: {
    state: "DONE",
    note: {
      en: "Reviewed at least every twelve months and on the events listed in the TIA.",
      es: "Revisión al menos cada doce meses y ante los hechos que enumera la EIT.",
    },
  },
  s2_6_suspend_plan: {
    state: "DONE",
    note: {
      en: "SCC Clauses 14(f) and 16 allow suspension and termination.",
      es: "Las cláusulas 14.f y 16 de las SCC permiten suspender y resolver.",
    },
  },
};

/** The assessment's name and description, per language. */
export const TODOLAW_TIA_TITLE: Record<PilotDpaLocale, { name: string; description: string }> = {
  en: {
    name: "TIA: TODO.LAW (access from the United States)",
    description:
      "Prepared by TODO.LAW for its own transfer, with the facts it knows best. Review it, edit anything that differs for your organisation, and approve it.",
  },
  es: {
    name: "EIT: TODO.LAW (acceso desde Estados Unidos)",
    description:
      "Preparada por TODO.LAW para su propia transferencia, con los datos que mejor conoce. Revísala, cambia lo que sea distinto en tu organización y apruébala.",
  },
};
