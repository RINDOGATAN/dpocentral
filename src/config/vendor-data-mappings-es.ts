// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Spanish (Castilian) text for the vendor-catalogue quick start: the category
 * mappings in vendor-data-mappings.ts (labels, asset descriptions, data
 * elements, processing activities, return flows) and the records the quick
 * start writes around them, keyed by the English string.
 * tests/vendor-data-mappings-es.test.ts fails when a visible string has no
 * entry. Frequencies the app stores in English and labels at display
 * ("Daily", "Continuous", "On request") are not translated here.
 */

export const VENDOR_DATA_MAPPINGS_ES: Record<string, string> = {
  // ── Shared values ────────────────────────────────
  "Cloud": "Nube",
  "Webhook / Daily": "Webhook / diaria",
  "Webhook / Continuous": "Webhook / continua",
  "Employees": "Empleados",
  "Customers": "Clientes",
  "Users": "Usuarios",
  "Email Address": "Dirección de correo electrónico",
  "Full Name": "Nombre completo",
  "Phone Number": "Número de teléfono",
  "Billing Address": "Dirección de facturación",
  "IP Address": "Dirección IP",
  "User Identifiers": "Identificadores de usuario",
  "External collaborators": "Colaboradores externos",

  // ── Analytics & BI ───────────────────────────────
  "Analytics & BI": "Analítica e inteligencia de negocio",
  "Web/app analytics platform tracking user behavior and engagement metrics":
    "Plataforma de analítica web y de aplicaciones que mide el comportamiento de los usuarios y su interacción",
  "Device Fingerprint": "Huella digital del dispositivo",
  "Page Views": "Páginas vistas",
  "Session Duration": "Duración de la sesión",
  "Click Events": "Clics",
  "Referral Source": "Origen de la visita",
  "Browser & OS": "Navegador y sistema operativo",
  "Geolocation (City-level)": "Geolocalización (a nivel de ciudad)",
  "Website/App Analytics": "Analítica del sitio web y de la aplicación",
  "Collect and analyze user behavior data to improve product experience, measure feature adoption, and optimize conversion funnels":
    "Recoger y analizar datos sobre el comportamiento de los usuarios para mejorar la experiencia del producto, medir el uso de las funciones y optimizar los embudos de conversión",
  "Website visitors": "Visitantes del sitio web",
  "App users": "Usuarios de la aplicación",
  "Analytics provider": "Proveedor de analítica",
  "26 months": "26 meses",
  "Aggregated reports, user segments, and exported behavioral data":
    "Informes agregados, segmentos de usuarios y datos de comportamiento exportados",

  // ── Marketing & Advertising ──────────────────────
  "Marketing & Advertising": "Marketing y publicidad",
  "Marketing automation and campaign management platform":
    "Plataforma de automatización del marketing y gestión de campañas",
  "Company Name": "Nombre de la empresa",
  "Marketing Preferences": "Preferencias de marketing",
  "Campaign Interactions": "Interacciones con campañas",
  "Cookie Identifiers": "Identificadores de cookies",
  "Marketing Communications": "Comunicaciones de marketing",
  "Send targeted marketing communications, track campaign effectiveness, and manage subscriber preferences":
    "Enviar comunicaciones de marketing segmentadas, medir la eficacia de las campañas y gestionar las preferencias de los suscriptores",
  "Subscribers": "Suscriptores",
  "Leads": "Contactos comerciales potenciales",
  "Marketing platform provider": "Proveedor de la plataforma de marketing",
  "Email service provider": "Proveedor del servicio de correo electrónico",
  "Until consent withdrawn + 30 days": "Hasta la retirada del consentimiento + 30 días",
  "Campaign metrics, opens, clicks, bounces, unsubscribes per recipient":
    "Métricas de campaña, aperturas, clics, rebotes y bajas por destinatario",

  // ── CRM & Sales ──────────────────────────────────
  "CRM & Sales": "CRM y ventas",
  "Customer relationship management system storing prospect and customer data":
    "Sistema de gestión de la relación con los clientes que almacena datos de clientes y clientes potenciales",
  "Company & Job Title": "Empresa y cargo",
  "Deal/Opportunity Data": "Datos de operaciones y oportunidades",
  "Communication History": "Historial de comunicaciones",
  "Postal Address": "Dirección postal",
  "Customer Relationship Management": "Gestión de la relación con los clientes",
  "Manage customer relationships, track sales pipeline, and support customer communications throughout the customer lifecycle":
    "Gestionar la relación con los clientes, seguir el embudo de ventas y atender las comunicaciones con los clientes durante todo su ciclo de vida",
  "Prospects": "Clientes potenciales",
  "Business contacts": "Contactos profesionales",
  "CRM provider": "Proveedor del CRM",
  "Sales team": "Equipo de ventas",
  "Duration of business relationship + 3 years": "Duración de la relación comercial + 3 años",
  "Contact lookups, enriched profiles, deal/pipeline data, exports":
    "Consultas de contactos, perfiles enriquecidos, datos de operaciones y del embudo, exportaciones",

  // ── Customer Data Platform ───────────────────────
  "Customer Data Platform": "Plataforma de datos de clientes",
  "Unified customer data platform aggregating profiles across touchpoints":
    "Plataforma unificada de datos de clientes que reúne los perfiles de todos los puntos de contacto",
  "Unified Customer Profile": "Perfil unificado del cliente",
  "Cross-device Identifiers": "Identificadores entre dispositivos",
  "Behavioral Segments": "Segmentos de comportamiento",
  "Transaction History": "Historial de transacciones",
  "Consent Records": "Registros de consentimiento",
  "Customer Data Unification": "Unificación de datos de clientes",
  "Create unified customer profiles by combining data from multiple sources for personalization and analytics":
    "Crear perfiles unificados de clientes combinando datos de varias fuentes para la personalización y la analítica",
  "CDP provider": "Proveedor de la plataforma de datos de clientes",
  "Connected marketing tools": "Herramientas de marketing conectadas",
  "Duration of customer relationship + 1 year": "Duración de la relación con el cliente + 1 año",
  "Unified profiles, audience segments, identity resolution back to source systems":
    "Perfiles unificados, segmentos de audiencia y resolución de identidades devueltos a los sistemas de origen",

  // ── Cloud Infrastructure ─────────────────────────
  "Cloud Infrastructure": "Infraestructura en la nube",
  "Cloud infrastructure and hosting services for application and data storage":
    "Servicios de infraestructura en la nube y alojamiento para aplicaciones y almacenamiento de datos",
  "Application Data": "Datos de la aplicación",
  "Server Logs": "Registros del servidor",
  "Stored Customer Records": "Registros de clientes almacenados",
  "Backup Data": "Copias de seguridad",
  "Cloud Data Hosting": "Alojamiento de datos en la nube",
  "Host and store application data including personal data in cloud infrastructure with appropriate security controls":
    "Alojar y almacenar datos de la aplicación, incluidos datos personales, en infraestructura en la nube con los controles de seguridad adecuados",
  "All data subjects": "Todos los interesados",
  "Cloud infrastructure provider": "Proveedor de infraestructura en la nube",
  "As defined by data controller policies": "Según las políticas del responsable del tratamiento",

  // ── Content & E-commerce ─────────────────────────
  "Content & E-commerce": "Contenidos y comercio electrónico",
  "Content management or ecommerce platform powering web presence":
    "Plataforma de gestión de contenidos o de comercio electrónico que sostiene la presencia web",
  "User Accounts": "Cuentas de usuario",
  "Order/Purchase Data": "Datos de pedidos y compras",
  "Shipping Address": "Dirección de envío",
  "Content Interactions": "Interacciones con contenidos",
  "Content & Commerce Management": "Gestión de contenidos y comercio",
  "Manage web content, user accounts, and ecommerce transactions":
    "Gestionar el contenido web, las cuentas de usuario y las transacciones de comercio electrónico",
  "Registered users": "Usuarios registrados",
  "Platform provider": "Proveedor de la plataforma",
  "Payment processor": "Procesador de pagos",
  "Duration of account + 5 years for transactions": "Duración de la cuenta + 5 años para las transacciones",

  // ── Customer Support ─────────────────────────────
  "Customer Support": "Atención al cliente",
  "Customer support and communications platform for handling inquiries":
    "Plataforma de atención al cliente y comunicaciones para gestionar consultas",
  "Support Ticket Content": "Contenido de las incidencias de soporte",
  "Call Recordings": "Grabaciones de llamadas",
  "Customer Support Operations": "Operaciones de atención al cliente",
  "Handle customer inquiries, track support tickets, and maintain communication records for service quality":
    "Atender las consultas de los clientes, seguir las incidencias de soporte y conservar registros de las comunicaciones para la calidad del servicio",
  "Support requesters": "Solicitantes de soporte",
  "Support platform provider": "Proveedor de la plataforma de soporte",
  "3 years after ticket closure": "3 años tras el cierre de la incidencia",
  "Inbound customer messages, ticket replies, transcripts, satisfaction scores":
    "Mensajes entrantes de clientes, respuestas a incidencias, transcripciones y puntuaciones de satisfacción",

  // ── AI & Machine Learning ────────────────────────
  "AI & Machine Learning": "IA y aprendizaje automático",
  "AI-powered tool processing user data for automated interactions or insights":
    "Herramienta basada en IA que trata datos de usuarios para interacciones automatizadas o análisis",
  "User Prompts/Inputs": "Instrucciones y entradas de los usuarios",
  "Chat Transcripts": "Transcripciones de chat",
  "AI Model Outputs": "Resultados del modelo de IA",
  "AI-Powered Processing": "Tratamiento basado en IA",
  "Provide AI-driven features including chatbots, content generation, and automated insights using user data":
    "Ofrecer funciones basadas en IA, como asistentes conversacionales, generación de contenidos y análisis automatizados, a partir de datos de usuarios",
  "AI service provider": "Proveedor del servicio de IA",
  "90 days for training data, 1 year for transcripts": "90 días para los datos de entrenamiento, 1 año para las transcripciones",
  "Model completions and AI-generated outputs that may contain personal data":
    "Respuestas del modelo y resultados generados por IA que pueden contener datos personales",

  // ── Surveys & Feedback ───────────────────────────
  "Surveys & Feedback": "Encuestas y opiniones",
  "Survey and feedback collection platform": "Plataforma de recogida de encuestas y opiniones",
  "Respondent Email": "Correo electrónico del encuestado",
  "Survey Responses": "Respuestas a encuestas",
  "NPS/Satisfaction Scores": "Puntuaciones NPS y de satisfacción",
  "Free-text Comments": "Comentarios de texto libre",
  "Survey & Feedback Collection": "Recogida de encuestas y opiniones",
  "Collect user feedback through surveys to measure satisfaction and improve products/services":
    "Recoger la opinión de los usuarios mediante encuestas para medir su satisfacción y mejorar los productos y servicios",
  "Survey platform provider": "Proveedor de la plataforma de encuestas",
  "2 years": "2 años",
  "Survey responses, NPS scores, and free-text feedback returned for analysis":
    "Respuestas a encuestas, puntuaciones NPS y comentarios de texto libre devueltos para su análisis",

  // ── Events & Webinars ────────────────────────────
  "Events & Webinars": "Eventos y seminarios web",
  "Event management and registration platform": "Plataforma de gestión de eventos e inscripciones",
  "Attendee Name": "Nombre del asistente",
  "Dietary Requirements": "Requisitos alimentarios",
  "Registration Details": "Datos de inscripción",
  "Event Registration & Management": "Inscripción y gestión de eventos",
  "Manage event registrations, attendee data, and post-event communications":
    "Gestionar las inscripciones a eventos, los datos de los asistentes y las comunicaciones posteriores",
  "Event attendees": "Asistentes a eventos",
  "Registrants": "Inscritos",
  "Event platform provider": "Proveedor de la plataforma de eventos",
  "Venue": "Lugar del evento",
  "1 year after event": "1 año después del evento",
  "Attendee registrations, check-ins, and engagement data returned to source systems":
    "Inscripciones, registros de entrada y datos de participación de los asistentes devueltos a los sistemas de origen",

  // ── Tag Management ───────────────────────────────
  "Tag Management": "Gestión de etiquetas",
  "Tag management system controlling third-party scripts and data collection":
    "Sistema de gestión de etiquetas que controla los scripts de terceros y la recogida de datos",
  "Page URLs": "URL de las páginas",
  "Event Data": "Datos de eventos",
  "Cookie Data": "Datos de cookies",
  "User Agent": "Agente de usuario",
  "Tag & Script Management": "Gestión de etiquetas y scripts",
  "Manage website tags and third-party scripts, controlling data collection and distribution to analytics/marketing tools":
    "Gestionar las etiquetas del sitio web y los scripts de terceros, controlando la recogida de datos y su envío a herramientas de analítica y marketing",
  "Tag management provider": "Proveedor de gestión de etiquetas",
  "Connected third-party tools": "Herramientas de terceros conectadas",
  "As per connected tool policies": "Según las políticas de las herramientas conectadas",

  // ── Communication & Messaging ────────────────────
  "Communication & Messaging": "Comunicación y mensajería",
  "Business-to-consumer messaging and video communication platform":
    "Plataforma de mensajería y comunicación por vídeo con los consumidores",
  "Recipient Contact Info": "Datos de contacto del destinatario",
  "Message Content": "Contenido de los mensajes",
  "Video Recordings": "Grabaciones de vídeo",
  "Delivery/Read Receipts": "Confirmaciones de entrega y lectura",
  "Customer Messaging": "Mensajería con clientes",
  "Send personalized video and text messages to customers for engagement and support":
    "Enviar a los clientes mensajes de vídeo y de texto personalizados para fomentar su participación y darles soporte",
  "Messaging platform provider": "Proveedor de la plataforma de mensajería",
  "1 year": "1 año",
  "Inbound messages, replies, and delivery/read receipts":
    "Mensajes entrantes, respuestas y confirmaciones de entrega y lectura",

  // ── Payment Processing ───────────────────────────
  "Payment Processing": "Procesamiento de pagos",
  "Payment processing gateway handling financial transactions":
    "Pasarela de pago que gestiona las transacciones financieras",
  "Cardholder Name": "Nombre del titular de la tarjeta",
  "Payment Card Data (tokenized)": "Datos de la tarjeta de pago (tokenizados)",
  "Transaction Records": "Registros de transacciones",
  "Fraud Signals": "Indicios de fraude",
  "Process financial transactions, verify payment methods, and detect fraudulent activity":
    "Procesar transacciones financieras, verificar los medios de pago y detectar actividades fraudulentas",
  "Buyers": "Compradores",
  "Card networks": "Redes de tarjetas",
  "Fraud detection provider": "Proveedor de detección del fraude",
  "7 years (legal/tax requirement)": "7 años (obligación legal y fiscal)",
  "Transaction confirmations, settlement reports, refund/chargeback notifications, fraud alerts":
    "Confirmaciones de transacciones, informes de liquidación, avisos de reembolsos y retrocesos, alertas de fraude",

  // ── HR & People ──────────────────────────────────
  "HR & People": "Recursos humanos y personas",
  "Human resources management system processing employee and candidate data":
    "Sistema de gestión de recursos humanos que trata datos de empleados y candidatos",
  "Employee Name & Contact": "Nombre y contacto del empleado",
  "National ID / Tax Number": "Documento de identidad / número de identificación fiscal",
  "Salary & Compensation": "Salario y retribución",
  "Employment History": "Historial laboral",
  "Performance Records": "Registros de desempeño",
  "HR & Employee Management": "Gestión de recursos humanos y empleados",
  "Manage employee lifecycle including recruitment, onboarding, payroll, and performance tracking":
    "Gestionar el ciclo de vida de los empleados, incluidos la selección, la incorporación, la nómina y el seguimiento del desempeño",
  "Job candidates": "Candidatos",
  "Contractors": "Contratistas",
  "HR platform provider": "Proveedor de la plataforma de recursos humanos",
  "Payroll provider": "Proveedor de nóminas",
  "Duration of employment + 7 years": "Duración de la relación laboral + 7 años",
  "Employee records, payroll exports, compliance reports synced back to source systems":
    "Registros de empleados, exportaciones de nómina e informes de cumplimiento sincronizados con los sistemas de origen",

  // ── Developer Tools ──────────────────────────────
  "Developer Tools": "Herramientas para desarrolladores",
  "Developer tooling for application monitoring, deployment, and quality assurance":
    "Herramientas para desarrolladores de supervisión de aplicaciones, despliegue y control de calidad",
  "Error Stack Traces": "Trazas de errores",
  "User Session Context": "Contexto de la sesión del usuario",
  "IP Addresses": "Direcciones IP",
  "Application Monitoring & DevOps": "Supervisión de aplicaciones y DevOps",
  "Monitor application health, track errors, manage deployments, and control feature rollouts":
    "Supervisar el estado de las aplicaciones, seguir los errores, gestionar los despliegues y controlar la activación de funciones",
  "Developers": "Desarrolladores",
  "DevOps tool provider": "Proveedor de herramientas DevOps",
  "90 days for logs, 1 year for metrics": "90 días para los registros, 1 año para las métricas",

  // ── Security & Identity ──────────────────────────
  "Security & Identity": "Seguridad e identidad",
  "Security and identity management platform protecting systems and user access":
    "Plataforma de seguridad y gestión de identidades que protege los sistemas y el acceso de los usuarios",
  "User Credentials (hashed)": "Credenciales de usuario (con hash)",
  "Access Logs": "Registros de acceso",
  "Device Identifiers": "Identificadores de dispositivo",
  "Security Events": "Eventos de seguridad",
  "Security & Access Management": "Gestión de la seguridad y los accesos",
  "Authenticate users, manage access control, detect security threats, and maintain audit trails":
    "Autenticar a los usuarios, gestionar el control de acceso, detectar amenazas de seguridad y conservar registros de auditoría",
  "System administrators": "Administradores de sistemas",
  "Security platform provider": "Proveedor de la plataforma de seguridad",
  "1 year for access logs, 2 years for security events": "1 año para los registros de acceso, 2 años para los eventos de seguridad",

  // ── Privacy & Consent ────────────────────────────
  "Privacy & Consent": "Privacidad y consentimiento",
  "Privacy management and consent collection platform":
    "Plataforma de gestión de la privacidad y recogida del consentimiento",
  "Cookie Preferences": "Preferencias de cookies",
  "Data Subject Requests": "Solicitudes de los interesados",
  "Privacy & Consent Management": "Gestión de la privacidad y el consentimiento",
  "Collect and manage user consent preferences, handle cookie compliance, and support data governance processes":
    "Recoger y gestionar las preferencias de consentimiento de los usuarios, cumplir la normativa de cookies y apoyar los procesos de gobierno del dato",
  "Data subjects": "Interesados",
  "Consent management provider": "Proveedor de gestión del consentimiento",
  "5 years (proof of consent)": "5 años (prueba del consentimiento)",

  // ── Productivity & Collaboration ─────────────────
  "Productivity & Collaboration": "Productividad y colaboración",
  "Collaboration and productivity tools for team communication and project management":
    "Herramientas de colaboración y productividad para la comunicación de los equipos y la gestión de proyectos",
  "User Profiles": "Perfiles de usuario",
  "Messages & Comments": "Mensajes y comentarios",
  "Shared Files": "Archivos compartidos",
  "Activity Logs": "Registros de actividad",
  "Team Collaboration": "Colaboración en equipo",
  "Enable team communication, project tracking, and file sharing across the organization":
    "Permitir la comunicación entre equipos, el seguimiento de proyectos y el intercambio de archivos en toda la organización",
  "Collaboration tool provider": "Proveedor de la herramienta de colaboración",
  "Duration of account + 1 year": "Duración de la cuenta + 1 año",

  // ── Legal & Compliance ───────────────────────────
  "Legal & Compliance": "Jurídico y cumplimiento",
  "Legal and compliance technology platform": "Plataforma tecnológica jurídica y de cumplimiento",
  "Signatory Name & Email": "Nombre y correo electrónico del firmante",
  "Contract/Document Content": "Contenido de contratos y documentos",
  "Digital Signatures": "Firmas electrónicas",
  "Audit Trail": "Registro de auditoría",
  "Legal Document Management": "Gestión de documentos jurídicos",
  "Manage contracts, collect digital signatures, and ensure regulatory compliance":
    "Gestionar contratos, recoger firmas electrónicas y garantizar el cumplimiento normativo",
  "Business partners": "Socios comerciales",
  "Legal tech provider": "Proveedor de tecnología jurídica",
  "10 years (legal retention)": "10 años (conservación legal)",

  // ── Design & Creative ────────────────────────────
  "Design & Creative": "Diseño y creatividad",
  "Design and creative tools for brand assets and visual content":
    "Herramientas de diseño y creatividad para recursos de marca y contenido visual",
  "Creative Assets": "Recursos creativos",
  "Collaboration Data": "Datos de colaboración",
  "Design Asset Management": "Gestión de recursos de diseño",
  "Create, manage, and collaborate on visual content and brand assets":
    "Crear y gestionar contenido visual y recursos de marca, y colaborar en ellos",
  "Designers": "Diseñadores",
  "Design platform provider": "Proveedor de la plataforma de diseño",
  "Duration of account": "Duración de la cuenta",

  // ── Generic third-party service ──────────────────
  "Third-Party Service": "Servicio de terceros",
  "Third-party SaaS service processing data on behalf of the organization":
    "Servicio SaaS de terceros que trata datos por cuenta de la organización",
  "Usage Data": "Datos de uso",
  "Third-Party Data Processing": "Tratamiento de datos por terceros",
  "Process personal data through a third-party service provider":
    "Tratar datos personales a través de un proveedor de servicios externo",
  "Service provider": "Proveedor de servicios",
  "As per contract terms": "Según los términos del contrato",
};

/** Text of the records the vendor quick start writes around each mapping. */
export const VENDOR_QUICKSTART_TEXT = {
  en: {
    internalSystemsName: (org: string) => `${org} Internal Systems`,
    internalSystemsDescription:
      "Primary internal systems that process and share data with third-party services",
    internalSystemsHosting: "On-premise / Cloud",
    publicPropertiesName: "Public website and apps",
    publicPropertiesDescription:
      "The organisation's public digital properties (websites and mobile apps). Visitors' browsers and apps send data directly to the tools that run on them. Add the domains and app names when you know them.",
    publicPropertiesHosting: "Public internet",
    flowFromProperties: (vendor: string) => `Data collected for ${vendor} on the public website and apps`,
    flowFromPropertiesDescription: (vendor: string) =>
      `Visitors' browsers and apps send this data directly to ${vendor}; it does not come from internal systems.`,
    flowTo: (vendor: string) => `Data flow to ${vendor}`,
    flowFrom: (vendor: string) => `Data flow from ${vendor}`,
    flowToDescription: (vendor: string) => `Automated data sharing with ${vendor}`,
    activityDescription: (vendor: string) => `Auto-generated from ${vendor} vendor import`,
    transferName: (vendor: string, country: string) => `Transfer to ${vendor} (${country})`,
    transferDescription: (vendor: string, country: string) =>
      `Data transfer to ${vendor} servers in ${country}`,
    transferSafeguards: "Standard Contractual Clauses (SCCs) with supplementary measures",
    transferSafeguardsDpf:
      "The provider declares certification under the EU-US Data Privacy Framework (DPF). Check its entry on the DPF list (dataprivacyframework.gov) and record it on this transfer; until then the adequacy decision does not cover it.",
  },
  es: {
    internalSystemsName: (org: string) => `Sistemas internos de ${org}`,
    internalSystemsDescription:
      "Sistemas internos principales que tratan datos y los comparten con servicios de terceros",
    internalSystemsHosting: "Local / nube",
    publicPropertiesName: "Sitio web y aplicaciones públicas",
    publicPropertiesDescription:
      "Las propiedades digitales públicas de la organización (sitios web y aplicaciones móviles). Los navegadores y las aplicaciones de los visitantes envían los datos directamente a las herramientas que funcionan en ellas. Añade los dominios y los nombres de las aplicaciones cuando los conozcas.",
    publicPropertiesHosting: "Internet pública",
    flowFromProperties: (vendor: string) => `Datos recogidos para ${vendor} en el sitio web y las aplicaciones públicas`,
    flowFromPropertiesDescription: (vendor: string) =>
      `Los navegadores y las aplicaciones de los visitantes envían estos datos directamente a ${vendor}; no salen de los sistemas internos.`,
    flowTo: (vendor: string) => `Flujo de datos hacia ${vendor}`,
    flowFrom: (vendor: string) => `Flujo de datos desde ${vendor}`,
    flowToDescription: (vendor: string) => `Intercambio automatizado de datos con ${vendor}`,
    activityDescription: (vendor: string) =>
      `Creada automáticamente al importar el proveedor ${vendor}`,
    transferName: (vendor: string, country: string) => `Transferencia a ${vendor} (${country})`,
    transferDescription: (vendor: string, country: string) =>
      `Transferencia de datos a los servidores de ${vendor} en ${country}`,
    transferSafeguards: "Cláusulas contractuales tipo (SCC) con medidas complementarias",
    transferSafeguardsDpf:
      "El proveedor declara estar certificado en el Marco de Privacidad de Datos UE-EE. UU. (DPF). Comprueba su inscripción en la lista del DPF (dataprivacyframework.gov) y regístrala en esta transferencia; hasta entonces, la decisión de adecuación no la cubre.",
  },
} as const;
