// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Spanish (Castilian) text for the built-in vendor questionnaire, both
 * versions in vendor-questionnaires.ts, keyed by the English string. Applied
 * when the questionnaire is shown (the stored row keeps its English text, so
 * installs that already hold it read it in Spanish too).
 * tests/vendor-questionnaires-es.test.ts fails when a string has no entry.
 */

import type { SystemQuestionnaireSection } from "./vendor-questionnaires";

export const VENDOR_QUESTIONNAIRES_ES: Record<string, string> = {
  // ── Names and descriptions ───────────────────────
  "Standard Vendor Security Questionnaire": "Cuestionario estándar de seguridad para proveedores",
  "A comprehensive questionnaire for vendor due diligence.":
    "Un cuestionario completo para la diligencia debida de proveedores.",
  "Vendor Security & Privacy Assessment": "Evaluación de seguridad y privacidad de proveedores",
  "Comprehensive due diligence questionnaire based on SIG, CAIQ, and GDPR Article 28 requirements. Covers governance, data protection, access control, incident response, subprocessors, international transfers, business continuity, and compliance.":
    "Cuestionario completo de diligencia debida basado en SIG, CAIQ y los requisitos del artículo 28 del RGPD. Abarca gobierno, protección de datos, control de acceso, respuesta a incidentes, subencargados, transferencias internacionales, continuidad del negocio y cumplimiento.",

  // ── Section titles and descriptions ──────────────
  "Organization & Governance": "Organización y gobierno",
  "Assess the vendor's security governance structure, certifications, and training programs.":
    "Evalúa la estructura de gobierno de la seguridad del proveedor, sus certificaciones y sus programas de formación.",
  "Data Protection": "Protección de datos",
  "Data Protection & Privacy": "Protección de datos y privacidad",
  "Evaluate how personal data is processed, protected, and managed throughout its lifecycle.":
    "Evalúa cómo se tratan, protegen y gestionan los datos personales durante todo su ciclo de vida.",
  "Access Control": "Control de acceso",
  "Access Control & Authentication": "Control de acceso y autenticación",
  "Review access management practices, authentication requirements, and audit trail capabilities.":
    "Revisa las prácticas de gestión de accesos, los requisitos de autenticación y la capacidad de registro de auditoría.",
  "Incident Response": "Respuesta a incidentes",
  "Incident Response & Breach Notification": "Respuesta a incidentes y notificación de brechas",
  "Assess preparedness for security incidents and compliance with GDPR breach notification obligations (Articles 33-34).":
    "Evalúa la preparación ante incidentes de seguridad y el cumplimiento de las obligaciones de notificación de brechas del RGPD (artículos 33 y 34).",
  "Subprocessors": "Subencargados",
  "Subprocessors & Third-Party Management": "Subencargados y gestión de terceros",
  "Evaluate how the vendor manages subprocessors in compliance with GDPR Article 28(2) and (4).":
    "Evalúa cómo gestiona el proveedor a sus subencargados conforme al artículo 28, apartados 2 y 4, del RGPD.",
  "International Data Transfers": "Transferencias internacionales de datos",
  "Assess cross-border data transfer mechanisms and compliance with GDPR Chapter V (Articles 44-49).":
    "Evalúa los mecanismos de transferencia internacional de datos y el cumplimiento del capítulo V del RGPD (artículos 44 a 49).",
  "Business Continuity & Infrastructure": "Continuidad del negocio e infraestructura",
  "Review disaster recovery, backup practices, vulnerability management, and physical security.":
    "Revisa la recuperación ante desastres, las copias de seguridad, la gestión de vulnerabilidades y la seguridad física.",
  "Compliance, Audit Rights & Accountability": "Cumplimiento, derechos de auditoría y responsabilidad proactiva",
  "Verify regulatory compliance, audit provisions under GDPR Article 28(3)(h), and accountability documentation.":
    "Verifica el cumplimiento normativo, las auditorías previstas en el artículo 28, apartado 3, letra h), del RGPD y la documentación de responsabilidad proactiva.",

  // ── Questions, version 1.0 ───────────────────────
  "Do you have a dedicated information security team?": "¿Tienes un equipo dedicado a la seguridad de la información?",
  "Do you have documented security policies?": "¿Tienes políticas de seguridad documentadas?",
  "How often are security policies reviewed?": "¿Con qué frecuencia se revisan las políticas de seguridad?",
  "Do you have a Data Protection Officer (DPO)?": "¿Tienes un delegado de protección de datos (DPD)?",
  "Do you encrypt personal data at rest?": "¿Cifras los datos personales en reposo?",
  "Do you encrypt personal data in transit?": "¿Cifras los datos personales en tránsito?",
  "What encryption standards do you use?": "¿Qué estándares de cifrado utilizas?",
  "Do you have data retention and deletion policies?": "¿Tienes políticas de conservación y supresión de datos?",
  "Can you support DSAR (data subject access request) fulfillment?":
    "¿Puedes ayudar a atender las solicitudes de acceso de los interesados?",
  "Do you implement role-based access control?": "¿Aplicas un control de acceso basado en roles?",
  "Do you require multi-factor authentication?": "¿Exiges autenticación multifactor?",
  "How often are access rights reviewed?": "¿Con qué frecuencia se revisan los derechos de acceso?",
  "Do you maintain access logs?": "¿Conservas registros de acceso?",
  "Do you have a documented incident response plan?": "¿Tienes un plan de respuesta a incidentes documentado?",
  "Within what timeframe would you notify us of a data breach?":
    "¿En qué plazo nos notificarías una brecha de datos?",
  "Have you experienced any data breaches in the past 3 years?":
    "¿Has sufrido alguna brecha de datos en los últimos 3 años?",
  "Do you conduct incident response drills?": "¿Realizas simulacros de respuesta a incidentes?",
  "Do you use subprocessors to process personal data?": "¿Recurres a subencargados para tratar datos personales?",
  "Can you provide a list of current subprocessors?": "¿Puedes facilitar una lista de los subencargados actuales?",
  "Do you have data processing agreements with all subprocessors?":
    "¿Tienes contratos de encargo del tratamiento con todos los subencargados?",
  "Will you notify us before engaging new subprocessors?":
    "¿Nos avisarás antes de recurrir a nuevos subencargados?",

  // ── Questions, version 2.0 ───────────────────────
  "Do you have a dedicated information security team or function?":
    "¿Tienes un equipo o una función dedicados a la seguridad de la información?",
  "Do you have a designated Data Protection Officer (DPO) or privacy lead? If yes, provide their name and contact details.":
    "¿Has designado un delegado de protección de datos (DPD) o un responsable de privacidad? En caso afirmativo, indica su nombre y sus datos de contacto.",
  "Which security and privacy certifications or attestations does your organization currently hold?":
    "¿Qué certificaciones o informes de seguridad y privacidad tiene actualmente tu organización?",
  "How often are your information security and privacy policies formally reviewed and updated?":
    "¿Con qué frecuencia se revisan y actualizan formalmente tus políticas de seguridad de la información y de privacidad?",
  "Do all employees receive data protection and security awareness training at onboarding and at least annually thereafter?":
    "¿Reciben todos los empleados formación en protección de datos y concienciación en seguridad al incorporarse y, después, al menos una vez al año?",
  "What categories of personal data will you process on our behalf?":
    "¿Qué categorías de datos personales tratarás por nuestra cuenta?",
  "What is the legal basis you rely on for processing personal data in this engagement?":
    "¿En qué base jurídica te apoyas para tratar datos personales en este encargo?",
  "Do you encrypt personal data at rest and in transit? Describe the standards and algorithms used.":
    "¿Cifras los datos personales en reposo y en tránsito? Describe los estándares y algoritmos que utilizas.",
  "Do you have a documented data retention schedule, and can you delete or return all personal data upon contract termination?":
    "¿Tienes un calendario de conservación de datos documentado y puedes suprimir o devolver todos los datos personales al terminar el contrato?",
  "Can you fulfill data subject rights requests (access, erasure, portability, rectification) within the GDPR-required timeframes?":
    "¿Puedes atender las solicitudes de ejercicio de derechos de los interesados (acceso, supresión, portabilidad, rectificación) en los plazos que exige el RGPD?",
  "Do you implement data minimization principles, processing only personal data strictly necessary for the stated purpose?":
    "¿Aplicas el principio de minimización de datos, tratando solo los datos personales estrictamente necesarios para la finalidad indicada?",
  "Do you enforce the principle of least privilege and role-based access control (RBAC) for all systems that process personal data?":
    "¿Aplicas el principio de mínimo privilegio y el control de acceso basado en roles en todos los sistemas que tratan datos personales?",
  "Is multi-factor authentication (MFA) required for all users accessing systems that contain personal data?":
    "¿Se exige autenticación multifactor a todos los usuarios que acceden a sistemas con datos personales?",
  "How frequently are user access rights reviewed and recertified?":
    "¿Con qué frecuencia se revisan y se vuelven a certificar los derechos de acceso de los usuarios?",
  "Do you maintain audit logs of access to personal data, and how long are these logs retained?":
    "¿Conservas registros de auditoría de los accesos a datos personales y durante cuánto tiempo?",
  "How are access rights revoked when an employee leaves the organization or changes roles?":
    "¿Cómo se retiran los derechos de acceso cuando un empleado deja la organización o cambia de puesto?",
  "Do you have a documented and tested incident response plan that covers personal data breaches?":
    "¿Tienes un plan de respuesta a incidentes documentado y probado que cubra las brechas de datos personales?",
  "Within what timeframe would you notify us (the data controller) of a confirmed personal data breach?":
    "¿En qué plazo nos notificarías (como responsables del tratamiento) una brecha de datos personales confirmada?",
  "Does your breach notification include all GDPR Article 33(3) required details (nature of breach, categories of data, likely consequences, mitigation measures)?":
    "¿Incluye tu notificación de brechas todos los datos que exige el artículo 33, apartado 3, del RGPD (naturaleza de la brecha, categorías de datos, posibles consecuencias, medidas para mitigarla)?",
  "Have you experienced any personal data breaches or significant security incidents in the past 24 months? If yes, please describe.":
    "¿Has sufrido alguna brecha de datos personales o algún incidente de seguridad importante en los últimos 24 meses? En caso afirmativo, descríbelo.",
  "How often do you conduct incident response exercises or tabletop drills?":
    "¿Con qué frecuencia realizas ejercicios o simulacros de respuesta a incidentes?",
  "Do you engage subprocessors (sub-contractors) who will process personal data as part of this service?":
    "¿Recurres a subencargados (subcontratistas) que vayan a tratar datos personales como parte de este servicio?",
  "Can you provide a complete and current list of subprocessors, including their names, processing purposes, and geographic locations?":
    "¿Puedes facilitar una lista completa y actualizada de subencargados, con sus nombres, las finalidades del tratamiento y su ubicación geográfica?",
  "Do you have written data processing agreements with all subprocessors that include GDPR-equivalent obligations?":
    "¿Tienes contratos de encargo del tratamiento por escrito con todos los subencargados, con obligaciones equivalentes a las del RGPD?",
  "Will you provide prior written notice before adding or replacing subprocessors, giving us an opportunity to object?":
    "¿Nos avisarás por escrito antes de añadir o sustituir subencargados, para que podamos oponernos?",
  "How do you assess and monitor the security and privacy posture of your subprocessors on an ongoing basis?":
    "¿Cómo evalúas y supervisas de forma continua la seguridad y la privacidad de tus subencargados?",
  "Will personal data be transferred to, stored in, or accessed from countries outside the European Economic Area (EEA)?":
    "¿Se transferirán datos personales a países de fuera del Espacio Económico Europeo (EEE), se almacenarán en ellos o se accederá a ellos desde allí?",
  "If yes, which countries or regions will data be transferred to or accessed from?":
    "En caso afirmativo, ¿a qué países o regiones se transferirán los datos o desde cuáles se accederá a ellos?",
  "What transfer mechanisms do you rely on for international data transfers?":
    "¿En qué mecanismos te apoyas para las transferencias internacionales de datos?",
  "Have you conducted a Transfer Impact Assessment (TIA) to evaluate the legal framework and surveillance risks in the recipient country?":
    "¿Has realizado una Evaluación de impacto de la transferencia (EIT) para valorar el marco jurídico y los riesgos de vigilancia en el país de destino?",
  "Do you have a documented and tested business continuity and disaster recovery plan covering the systems that process our data?":
    "¿Tienes un plan de continuidad del negocio y recuperación ante desastres documentado y probado que cubra los sistemas que tratan nuestros datos?",
  "What are your Recovery Time Objective (RTO) and Recovery Point Objective (RPO) for the services provided to us?":
    "¿Cuáles son tu tiempo objetivo de recuperación (RTO) y tu punto objetivo de recuperación (RPO) para los servicios que nos prestas?",
  "How often do you perform backups of personal data, and are backups encrypted?":
    "¿Con qué frecuencia haces copias de seguridad de los datos personales y están cifradas?",
  "How often do you conduct vulnerability assessments and penetration tests on systems that process personal data?":
    "¿Con qué frecuencia realizas análisis de vulnerabilidades y pruebas de penetración en los sistemas que tratan datos personales?",
  "Where are the primary and backup data centers located (country/region), and do they meet appropriate physical security standards?":
    "¿Dónde están los centros de datos principal y de respaldo (país o región) y cumplen estándares adecuados de seguridad física?",
  "Do you maintain a Record of Processing Activities (ROPA) as required by GDPR Article 30?":
    "¿Llevas un registro de las actividades de tratamiento, como exige el artículo 30 del RGPD?",
  "Will you permit audits or inspections (by us or an independent third party) to verify compliance with data processing obligations?":
    "¿Permitirás auditorías o inspecciones (nuestras o de un tercero independiente) para verificar el cumplimiento de las obligaciones del encargo del tratamiento?",
  "Can you provide copies of recent independent audit reports (e.g., SOC 2 Type II, ISO 27001 certificate, penetration test summary)?":
    "¿Puedes facilitar copias de informes de auditoría independientes recientes (por ejemplo, SOC 2 Tipo II, certificado ISO 27001, resumen de pruebas de penetración)?",
  "Have you conducted a Data Protection Impact Assessment (DPIA) for the processing activities relevant to our engagement?":
    "¿Has realizado una evaluación de impacto relativa a la protección de datos (EIPD) de las actividades de tratamiento relacionadas con nuestro encargo?",
  "Which data protection regulations and frameworks does your organization currently comply with?":
    "¿Qué normas y marcos de protección de datos cumple actualmente tu organización?",
  "Describe any additional security or privacy measures, certifications, or controls not covered above that you believe are relevant.":
    "Describe cualquier otra medida, certificación o control de seguridad o privacidad no recogido arriba que consideres relevante.",

  // ── Options ──────────────────────────────────────
  "ISO 27001": "ISO 27001",
  "ISO 27701": "ISO 27701",
  "SOC 2 Type I": "SOC 2 Tipo I",
  "SOC 2 Type II": "SOC 2 Tipo II",
  "CSA STAR": "CSA STAR",
  "ISAE 3402": "ISAE 3402",
  "PCI DSS": "PCI DSS",
  "HITRUST": "HITRUST",
  "Other": "Otra",
  "None": "Ninguna",
  "Annually": "Anualmente",
  "Semi-annually": "Semestralmente",
  "Quarterly": "Trimestralmente",
  "Monthly": "Mensualmente",
  "Ad-hoc": "Según las necesidades",
  "Never": "Nunca",
  "Upon role change": "Al cambiar de puesto",
  "Upon role change only": "Solo al cambiar de puesto",
  "24 hours": "24 horas",
  "48 hours": "48 horas",
  "72 hours": "72 horas",
  "1 week": "1 semana",
  "No commitment": "Sin compromiso",
  "Names / contact details": "Nombres y datos de contacto",
  "Financial data": "Datos financieros",
  "Health data": "Datos de salud",
  "Biometric data": "Datos biométricos",
  "Location data": "Datos de localización",
  "Online identifiers (IP / cookies)": "Identificadores en línea (IP y cookies)",
  "Employee / HR data": "Datos de empleados y de recursos humanos",
  "Children's data": "Datos de menores",
  "Criminal records": "Antecedentes penales",
  "Controller instructions only (processor)": "Solo instrucciones del responsable (encargado del tratamiento)",
  "Legitimate interest": "Interés legítimo",
  "Consent": "Consentimiento",
  "Contractual necessity": "Ejecución de un contrato",
  "Legal obligation": "Obligación legal",
  "Not applicable": "No aplicable",
  "30 days": "30 días",
  "90 days": "90 días",
  "6 months": "6 meses",
  "1 year": "1 año",
  "2+ years": "2 años o más",
  "Not maintained": "No se conservan",
  "Immediately (automated)": "De inmediato (automatizado)",
  "Within 24 hours": "En 24 horas",
  "Within 1 week": "En 1 semana",
  "Ad-hoc / manual process": "Según las necesidades / proceso manual",
  "Without undue delay (under 24 hours)": "Sin dilación indebida (menos de 24 horas)",
  "Within 48 hours": "En 48 horas",
  "Within 72 hours": "En 72 horas",
  "No specific commitment": "Sin compromiso concreto",
  "Less than annually": "Menos de una vez al año",
  "EU adequacy decision": "Decisión de adecuación de la UE",
  "Standard Contractual Clauses (SCCs)": "Cláusulas contractuales tipo (CCT)",
  "Binding Corporate Rules": "Normas corporativas vinculantes",
  "EU-US Data Privacy Framework": "Marco de privacidad de datos UE-EE. UU.",
  "Explicit consent": "Consentimiento explícito",
  "Derogations (Art. 49)": "Excepciones (art. 49)",
  "Daily (encrypted)": "Diaria (cifrada)",
  "Daily (unencrypted)": "Diaria (sin cifrar)",
  "Weekly (encrypted)": "Semanal (cifrada)",
  "Weekly (unencrypted)": "Semanal (sin cifrar)",
  "Less frequently": "Con menos frecuencia",
  "No regular backups": "Sin copias de seguridad periódicas",
  "Continuously (automated)": "De forma continua (automatizada)",
  "Yes — completed": "Sí, completada",
  "Yes — in progress": "Sí, en curso",
  "No — not required": "No, no es necesaria",
  "No — not yet started": "No, aún no se ha empezado",
  "GDPR": "RGPD",
  "UK GDPR": "RGPD del Reino Unido",
  "CCPA / CPRA": "CCPA / CPRA",
  "HIPAA": "HIPAA",
  "LGPD (Brazil)": "LGPD (Brasil)",
  "POPIA (South Africa)": "POPIA (Sudáfrica)",
  "PIPL (China)": "PIPL (China)",
  "PDPA (Singapore / Thailand)": "PDPA (Singapur / Tailandia)",
};

/** Question types as the library preview labels them. */
export const QUESTION_TYPE_LABELS: Record<"en" | "es", Record<string, string>> = {
  en: {
    boolean: "Yes / no",
    text: "Text",
    textarea: "Long text",
    select: "One choice",
    multiselect: "Several choices",
  },
  es: {
    boolean: "Sí / no",
    text: "Texto",
    textarea: "Texto largo",
    select: "Una opción",
    multiselect: "Varias opciones",
  },
};

interface ShownQuestionnaire {
  name: string;
  description: string | null;
  sections: unknown;
}

/**
 * The questionnaire as a Spanish reader sees it: every string with an entry
 * is shown in Spanish, anything else (a questionnaire an organisation wrote)
 * as written. English returns the row unchanged.
 */
/**
 * Descriptions an earlier version stored in installs' rows, mapped to today's
 * English text, so a stored row reads the current wording in both languages.
 */
export const VENDOR_QUESTIONNAIRE_EARLIER_DESCRIPTIONS: Record<string, string> = {
  "A comprehensive questionnaire for vendor due diligence. This template is informational, not legal advice. Verify outputs with qualified counsel.":
    "A comprehensive questionnaire for vendor due diligence.",
  "Comprehensive due diligence questionnaire based on SIG, CAIQ, and GDPR Article 28 requirements. Covers governance, data protection, access control, incident response, subprocessors, international transfers, business continuity, and compliance. This template is informational, not legal advice. Verify outputs with qualified counsel.":
    "Comprehensive due diligence questionnaire based on SIG, CAIQ, and GDPR Article 28 requirements. Covers governance, data protection, access control, incident response, subprocessors, international transfers, business continuity, and compliance.",
};

export function localizeQuestionnaire<T extends ShownQuestionnaire>(q: T, locale: "en" | "es"): T {
  if (q.description && VENDOR_QUESTIONNAIRE_EARLIER_DESCRIPTIONS[q.description]) {
    q = { ...q, description: VENDOR_QUESTIONNAIRE_EARLIER_DESCRIPTIONS[q.description] };
  }
  if (locale !== "es") return q;
  const tr = (s: string) => VENDOR_QUESTIONNAIRES_ES[s] ?? s;
  const sections = Array.isArray(q.sections)
    ? (q.sections as SystemQuestionnaireSection[]).map((s) => ({
        ...s,
        title: typeof s.title === "string" ? tr(s.title) : s.title,
        description: typeof s.description === "string" ? tr(s.description) : s.description,
        questions: Array.isArray(s.questions)
          ? s.questions.map((x) => ({
              ...x,
              text: typeof x.text === "string" ? tr(x.text) : x.text,
              // Labels only: an answer keeps the English value it was stored with.
              ...(Array.isArray(x.options) ? { optionLabels: x.options.map(tr) } : {}),
            }))
          : s.questions,
      }))
    : q.sections;
  return {
    ...q,
    name: tr(q.name),
    description: q.description ? tr(q.description) : q.description,
    sections,
  };
}
