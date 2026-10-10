// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Spanish (Castilian) text for the industry quick-start templates in
 * industry-templates.ts, keyed by the English string. Every user-visible
 * string of every template has an entry here (tests/industry-templates-es.test.ts
 * fails otherwise). Asset names are translated through the same table, so the
 * cross-references between assets, activities and flows stay intact.
 */

export const INDUSTRY_TEMPLATES_ES: Record<string, string> = {
  // ── Shared values ────────────────────────────────
  "Cloud": "Nube",
  "Engineering": "Ingeniería",
  "Operations": "Operaciones",
  "Marketing": "Marketing",
  "Finance": "Finanzas",
  "Product": "Producto",
  "Compliance": "Cumplimiento",
  "Human Resources": "Recursos humanos",
  "Real-time": "En tiempo real",
  "Daily": "Diaria",
  "Webhook / Real-time": "Webhook / en tiempo real",
  "Webhook / Daily": "Webhook / diaria",
  "Full Name": "Nombre completo",
  "Email Address": "Dirección de correo electrónico",
  "Billing Address": "Dirección de facturación",
  "Password Hash": "Hash de la contraseña",
  "Date of Birth": "Fecha de nacimiento",
  "IP Address": "Dirección IP",
  "Transaction Records": "Registros de transacciones",
  "Payment Method": "Método de pago",
  "Subscription Plan": "Plan de suscripción",
  "Email & Phone": "Correo electrónico y teléfono",
  "Customers": "Clientes",
  "Subscribers": "Suscriptores",
  "End users": "Usuarios finales",
  "Employees": "Empleados",
  "Internal teams": "Equipos internos",
  "Payment processor": "Proveedor de pagos",
  "Analytics provider": "Proveedor de analítica",
  "Tax authorities": "Autoridades tributarias",
  "Website visitors": "Visitantes del sitio web",
  "26 months": "26 meses",
  "7 years (tax/accounting)": "7 años (obligaciones fiscales y contables)",

  // ── E-commerce ───────────────────────────────────
  "E-commerce": "Comercio electrónico",
  "Online retail with customer accounts, orders, payments, and marketing":
    "Venta en línea con cuentas de clientes, pedidos, pagos y marketing",
  "Customer Database": "Base de datos de clientes",
  "Primary database storing customer accounts, profiles, and order history":
    "Base de datos principal con las cuentas, los perfiles y el historial de pedidos de los clientes",
  "Phone Number": "Número de teléfono",
  "Shipping Address": "Dirección de envío",
  "Order Management System": "Sistema de gestión de pedidos",
  "Handles order processing, fulfillment, and returns": "Gestiona la tramitación, la preparación y las devoluciones de los pedidos",
  "Order Details": "Detalles del pedido",
  "Payment Token": "Token de pago",
  "Delivery Address": "Dirección de entrega",
  "Return/Refund Records": "Registros de devoluciones y reembolsos",
  "Marketing Platform": "Plataforma de marketing",
  "Email marketing, campaigns, and customer segmentation":
    "Marketing por correo electrónico, campañas y segmentación de clientes",
  "Purchase History Segments": "Segmentos por historial de compras",
  "Marketing Preferences": "Preferencias de marketing",
  "Campaign Interactions": "Interacciones con campañas",
  "Web Analytics": "Analítica web",
  "Website traffic analysis and conversion tracking": "Análisis del tráfico del sitio web y seguimiento de conversiones",
  "Browsing Behavior": "Comportamiento de navegación",
  "Device Information": "Información del dispositivo",
  "Conversion Events": "Eventos de conversión",
  "Payment Gateway": "Pasarela de pago",
  "Payment processing through a payment provider": "Tramitación de pagos a través de un proveedor de pagos",
  "Cardholder Name": "Nombre del titular de la tarjeta",
  "Card Last 4 Digits": "Últimos 4 dígitos de la tarjeta",
  "Customer Account Management": "Gestión de cuentas de clientes",
  "Registration, authentication, and profile management for customer accounts":
    "Registro, autenticación y gestión de perfiles de las cuentas de clientes",
  "Enable customers to create accounts, manage their profiles, and track their orders":
    "Permitir que los clientes creen cuentas, gestionen sus perfiles y sigan sus pedidos",
  "Duration of account + 3 years": "Vigencia de la cuenta + 3 años",
  "Order Processing & Fulfillment": "Tramitación y preparación de pedidos",
  "Processing purchases, managing inventory, and coordinating delivery":
    "Tramitación de compras, gestión del inventario y coordinación de entregas",
  "Process and fulfill customer orders including payment, shipping, and returns":
    "Tramitar y servir los pedidos de los clientes, incluidos el pago, el envío y las devoluciones",
  "Shipping providers": "Empresas de transporte",
  "Warehouse": "Almacén",
  "Marketing & Promotions": "Marketing y promociones",
  "Email campaigns, personalized recommendations, and loyalty programs":
    "Campañas por correo electrónico, recomendaciones personalizadas y programas de fidelización",
  "Send marketing communications and personalized product recommendations to opted-in customers":
    "Enviar comunicaciones comerciales y recomendaciones personalizadas de productos a los clientes que lo han aceptado",
  "Until consent withdrawn": "Hasta la retirada del consentimiento",
  "Email marketing provider": "Proveedor de marketing por correo electrónico",
  "Website Analytics & Optimization": "Analítica y optimización del sitio web",
  "Tracking website usage patterns to improve user experience and conversion rates":
    "Seguimiento de los patrones de uso del sitio web para mejorar la experiencia de usuario y la tasa de conversión",
  "Analyze website traffic and user behavior to optimize the shopping experience":
    "Analizar el tráfico del sitio web y el comportamiento de los usuarios para optimizar la experiencia de compra",
  "Customer to Orders": "De clientes a pedidos",
  "Customer profile data flows to order system during checkout":
    "Los datos del perfil del cliente pasan al sistema de pedidos durante la compra",
  "Order references and lifetime value updates posted back to customer profile":
    "Referencias de pedidos y valor acumulado del cliente que se devuelven a su perfil",
  "Orders to Payment": "De pedidos a pagos",
  "Order payment details sent to payment processor": "Datos de pago del pedido enviados al proveedor de pagos",
  "Payment confirmations, settlement reports, refunds, and chargebacks posted back to orders":
    "Confirmaciones de pago, informes de liquidación, reembolsos y retrocesos que se devuelven a los pedidos",
  "Customer to Marketing": "De clientes a marketing",
  "Customer segments synced to marketing platform for campaigns":
    "Segmentos de clientes sincronizados con la plataforma de marketing para las campañas",
  "Campaign engagement: opens, clicks, unsubscribes, conversions per customer":
    "Interacción con las campañas: aperturas, clics, bajas y conversiones por cliente",

  // ── SaaS / Technology ────────────────────────────
  "SaaS / Technology": "SaaS / tecnología",
  "Software-as-a-service platform with user accounts, usage tracking, and support":
    "Plataforma de software como servicio con cuentas de usuario, seguimiento del uso y soporte",
  "User Database": "Base de datos de usuarios",
  "Production database storing user accounts, workspace data, and application state":
    "Base de datos de producción con las cuentas de usuario, los datos de los espacios de trabajo y el estado de la aplicación",
  "Profile Avatar": "Imagen de perfil",
  "Organization/Workspace Data": "Datos de la organización o del espacio de trabajo",
  "Application Logs": "Registros de la aplicación",
  "Centralized logging and error monitoring system": "Sistema centralizado de registros y de supervisión de errores",
  "User Actions": "Acciones del usuario",
  "Error Traces": "Trazas de errores",
  "Session Identifiers": "Identificadores de sesión",
  "Support Ticketing System": "Sistema de incidencias de soporte",
  "Customer support platform for handling tickets and live chat":
    "Plataforma de atención al cliente para gestionar incidencias y chat en directo",
  "Customer Success": "Éxito del cliente",
  "Contact Name & Email": "Nombre y correo electrónico de contacto",
  "Ticket Content": "Contenido de la incidencia",
  "Screenshots/Attachments": "Capturas de pantalla y archivos adjuntos",
  "Billing System": "Sistema de facturación",
  "Subscription billing and invoicing through a payment provider":
    "Cobro de suscripciones y facturación a través de un proveedor de pagos",
  "Billing Contact": "Contacto de facturación",
  "Invoice History": "Historial de facturas",
  "Product Analytics": "Analítica de producto",
  "Product usage analytics for feature adoption and retention":
    "Analítica del uso del producto para medir la adopción de funciones y la retención",
  "User ID": "ID de usuario",
  "Feature Usage Events": "Eventos de uso de funciones",
  "Session Data": "Datos de sesión",
  "User Account Provisioning": "Alta y gestión de cuentas de usuario",
  "User registration, workspace creation, and SSO integration":
    "Registro de usuarios, creación de espacios de trabajo e integración del inicio de sesión único (SSO)",
  "Create and manage user accounts, handle authentication, and provision workspace resources":
    "Crear y gestionar cuentas de usuario, gestionar la autenticación y asignar los recursos del espacio de trabajo",
  "Duration of subscription + 90 days": "Vigencia de la suscripción + 90 días",
  "Service Delivery & Processing": "Prestación del servicio y tratamiento",
  "Core application processing of user data as part of the SaaS service":
    "Tratamiento de los datos de los usuarios por la aplicación como parte del servicio SaaS",
  "Deliver the contracted SaaS service by processing user data within the application":
    "Prestar el servicio SaaS contratado tratando los datos de los usuarios dentro de la aplicación",
  "Duration of subscription + 30 days for deletion": "Vigencia de la suscripción + 30 días para la supresión",
  "Sub-processors (cloud infrastructure)": "Subencargados (infraestructura en la nube)",
  "Subscription Billing": "Cobro de suscripciones",
  "Recurring billing, invoicing, and payment processing": "Cobros periódicos, facturación y tramitación de pagos",
  "Process subscription payments, generate invoices, and manage billing lifecycle":
    "Tramitar los pagos de las suscripciones, emitir facturas y gestionar el ciclo de facturación",
  "Billing contacts": "Contactos de facturación",
  "Account administrators": "Administradores de cuentas",
  "Customer Support": "Atención al cliente",
  "Handling support tickets, live chat, and escalations": "Gestión de incidencias de soporte, chat en directo y escalados",
  "Provide customer support, troubleshoot issues, and maintain service quality":
    "Prestar atención al cliente, resolver problemas y mantener la calidad del servicio",
  "3 years after ticket closure": "3 años tras el cierre de la incidencia",
  "Support platform provider": "Proveedor de la plataforma de soporte",
  "Product Analytics & Improvement": "Analítica y mejora del producto",
  "Tracking feature usage, measuring adoption, and A/B testing":
    "Seguimiento del uso de las funciones, medición de la adopción y pruebas A/B",
  "Analyze product usage patterns to improve features, fix usability issues, and guide product roadmap":
    "Analizar los patrones de uso del producto para mejorar las funciones, corregir problemas de usabilidad y orientar la hoja de ruta",
  "User Actions to Logs": "De acciones de usuario a registros",
  "Application events and errors sent to centralized logging":
    "Eventos y errores de la aplicación enviados al sistema centralizado de registros",
  "User to Billing": "De usuarios a facturación",
  "Account data synced to billing system for subscription management":
    "Datos de la cuenta sincronizados con el sistema de facturación para gestionar la suscripción",
  "Subscription state, invoice status, dunning events, and renewal updates pushed back to user records":
    "Estado de la suscripción, estado de las facturas, avisos de impago y renovaciones que se devuelven a los registros de usuario",
  "User to Analytics": "De usuarios a analítica",
  "Product usage events streamed to analytics platform": "Eventos de uso del producto enviados de forma continua a la plataforma de analítica",

  // ── Healthcare ───────────────────────────────────
  "Healthcare": "Sanidad",
  "Healthcare provider or health-tech with patient data, EHR, and regulatory compliance":
    "Prestador sanitario o empresa de tecnología sanitaria con datos de pacientes, historia clínica electrónica y cumplimiento normativo",
  "Electronic Health Records (EHR)": "Historia clínica electrónica (HCE)",
  "Primary clinical system storing patient medical records":
    "Sistema clínico principal con la historia clínica de los pacientes",
  "Clinical IT": "Sistemas clínicos",
  "Patient Name": "Nombre del paciente",
  "National ID / Insurance Number": "DNI / número de la tarjeta sanitaria o de la póliza",
  "Medical Diagnoses": "Diagnósticos médicos",
  "Treatment Records": "Registros de tratamientos",
  "Prescription Data": "Datos de prescripción",
  "Lab Results": "Resultados de laboratorio",
  "Patient Portal": "Portal del paciente",
  "Online portal for patients to access records and book appointments":
    "Portal en línea para que los pacientes consulten su información y pidan cita",
  "Digital Health": "Salud digital",
  "Login Credentials": "Credenciales de acceso",
  "Contact Information": "Datos de contacto",
  "Appointment History": "Historial de citas",
  "Messages to Providers": "Mensajes a los profesionales sanitarios",
  "Billing & Insurance System": "Sistema de facturación y aseguradoras",
  "Medical billing, insurance claims, and patient financial records":
    "Facturación médica, reclamaciones a aseguradoras y registros económicos de los pacientes",
  "Insurance Policy Number": "Número de póliza",
  "Billing Codes (ICD/CPT)": "Códigos de facturación (CIE/CPT)",
  "Payment Records": "Registros de pagos",
  "Patient Address": "Dirección del paciente",
  "Staff HR System": "Sistema de recursos humanos del personal",
  "HR system for clinical and administrative staff": "Sistema de recursos humanos para el personal sanitario y administrativo",
  "Employee Name & Contact": "Nombre y contacto del empleado",
  "Professional Licenses": "Colegiaciones y habilitaciones profesionales",
  "Payroll Data": "Datos de nómina",
  "Background Check Results": "Resultados de la comprobación de antecedentes",
  "Patient Care & Treatment": "Atención y tratamiento de pacientes",
  "Recording and managing patient clinical data for treatment purposes":
    "Registro y gestión de los datos clínicos de los pacientes con fines asistenciales",
  "Provide healthcare services, record diagnoses and treatments, and maintain continuity of care":
    "Prestar servicios sanitarios, registrar diagnósticos y tratamientos y mantener la continuidad asistencial",
  "10 years after last treatment (or as per law)": "10 años desde el último tratamiento (o lo que fije la ley)",
  "Patients": "Pacientes",
  "Healthcare providers": "Profesionales sanitarios",
  "Referring specialists": "Especialistas que derivan",
  "Medical Billing & Insurance": "Facturación médica y aseguradoras",
  "Processing insurance claims, generating invoices, and managing payments":
    "Tramitación de reclamaciones a aseguradoras, emisión de facturas y gestión de pagos",
  "Process insurance claims and patient billing for healthcare services rendered":
    "Tramitar las reclamaciones a aseguradoras y la facturación a pacientes por los servicios sanitarios prestados",
  "7 years (financial records)": "7 años (registros económicos)",
  "Insurance holders": "Asegurados",
  "Insurance companies": "Aseguradoras",
  "Billing clearinghouse": "Intermediario de facturación",
  "Staff Employment Management": "Gestión laboral del personal",
  "Managing employee records, credentials, and compliance":
    "Gestión de los expedientes del personal, sus titulaciones y el cumplimiento",
  "Manage healthcare staff employment, verify professional credentials, and ensure regulatory compliance":
    "Gestionar la relación laboral del personal sanitario, verificar sus titulaciones profesionales y asegurar el cumplimiento normativo",
  "Duration of employment + 6 years": "Duración de la relación laboral + 6 años",
  "Clinical staff": "Personal sanitario",
  "HR platform provider": "Proveedor de la plataforma de recursos humanos",
  "Regulatory bodies": "Organismos reguladores",
  "EHR to Patient Portal": "De la historia clínica al portal del paciente",
  "Patient records made available through the patient-facing portal":
    "Información clínica puesta a disposición del paciente a través del portal",
  "Patient-submitted data: appointment requests, secure messages, intake forms, self-reported symptoms":
    "Datos enviados por el paciente: solicitudes de cita, mensajes seguros, formularios de admisión y síntomas que comunica",
  "EHR to Billing": "De la historia clínica a facturación",
  "Clinical encounter data sent to billing system for claims processing":
    "Datos de la asistencia enviados al sistema de facturación para tramitar las reclamaciones",
  "Claim status, denials, payment posting, and patient balance updates returned to EHR":
    "Estado de las reclamaciones, denegaciones, pagos registrados y saldo del paciente que se devuelven a la historia clínica",

  // ── Fintech ──────────────────────────────────────
  "Fintech": "Fintech",
  "Financial technology with KYC, transaction processing, and regulatory reporting":
    "Tecnología financiera con identificación de clientes (KYC), tramitación de operaciones e información a los reguladores",
  "KYC/Identity Verification System": "Sistema de KYC y verificación de identidad",
  "Know Your Customer platform for identity verification and AML screening":
    "Plataforma de diligencia debida (KYC) para verificar la identidad y aplicar los controles de prevención del blanqueo",
  "Full Legal Name": "Nombre y apellidos legales",
  "Government ID (Passport/Driver License)": "Documento oficial de identidad (pasaporte o permiso de conducir)",
  "Selfie/Facial Scan": "Selfi o escaneo facial",
  "Address Proof": "Justificante de domicilio",
  "PEP/Sanctions Screening Results": "Resultados del cribado de PRP y sanciones",
  "Transaction Ledger": "Libro de operaciones",
  "Core transaction processing database with financial records":
    "Base de datos principal de tramitación de operaciones con los registros financieros",
  "Account Holder Name": "Nombre del titular de la cuenta",
  "Account Number/IBAN": "Número de cuenta / IBAN",
  "Balance Information": "Información de saldos",
  "Beneficiary Details": "Datos de los beneficiarios",
  "Customer Account System": "Sistema de cuentas de clientes",
  "User-facing account management and dashboard": "Gestión de la cuenta y panel para el usuario",
  "Login & MFA Data": "Datos de acceso y de autenticación multifactor",
  "Notification Preferences": "Preferencias de notificación",
  "Linked Bank Accounts": "Cuentas bancarias vinculadas",
  "Regulatory Reporting System": "Sistema de información a los reguladores",
  "Automated reporting to financial regulators (SAR, CTR)":
    "Comunicación automatizada a los reguladores financieros (operaciones sospechosas y declaraciones de efectivo)",
  "Suspicious Activity Reports": "Comunicaciones de operaciones sospechosas",
  "Currency Transaction Reports": "Declaraciones de operaciones en efectivo",
  "Customer Risk Profiles": "Perfiles de riesgo de clientes",
  "Customer Onboarding & KYC": "Alta de clientes y KYC",
  "Identity verification, document collection, and AML screening during sign-up":
    "Verificación de identidad, recogida de documentos y controles de prevención del blanqueo durante el alta",
  "Verify customer identity, comply with KYC/AML regulations, and prevent financial fraud":
    "Verificar la identidad del cliente, cumplir la normativa de diligencia debida y prevención del blanqueo y evitar el fraude financiero",
  "5 years after account closure (AML requirement)": "5 años tras el cierre de la cuenta (obligación de prevención del blanqueo)",
  "Applicants": "Solicitantes",
  "Identity verification provider": "Proveedor de verificación de identidad",
  "Regulators": "Reguladores",
  "Transaction Processing": "Tramitación de operaciones",
  "Processing financial transactions, transfers, and settlements":
    "Tramitación de operaciones financieras, transferencias y liquidaciones",
  "Execute financial transactions on behalf of customers as part of the contracted service":
    "Ejecutar operaciones financieras por cuenta de los clientes como parte del servicio contratado",
  "7 years (financial regulation)": "7 años (normativa financiera)",
  "Beneficiaries": "Beneficiarios",
  "Banking partners": "Entidades bancarias colaboradoras",
  "Payment networks": "Redes de pago",
  "Clearing houses": "Cámaras de compensación",
  "AML Monitoring & Regulatory Reporting": "Seguimiento de prevención del blanqueo e información a los reguladores",
  "Ongoing transaction monitoring and filing required regulatory reports":
    "Seguimiento continuo de las operaciones y presentación de las comunicaciones obligatorias",
  "Monitor transactions for suspicious activity and file mandatory reports with financial regulators":
    "Vigilar las operaciones para detectar actividad sospechosa y presentar las comunicaciones obligatorias a los reguladores financieros",
  "5 years after filing": "5 años desde la comunicación",
  "Financial regulators": "Reguladores financieros",
  "Law enforcement (on request)": "Fuerzas y cuerpos de seguridad (a petición)",
  "KYC to Account": "De KYC a la cuenta",
  "Verified identity data provisioned to customer account":
    "Datos de identidad verificados que se incorporan a la cuenta del cliente",
  "Transactions to Monitoring": "De operaciones a seguimiento",
  "Transaction data fed to regulatory monitoring system":
    "Datos de las operaciones que alimentan el sistema de seguimiento regulatorio",

  // ── Media / Publishing ───────────────────────────
  "Media / Publishing": "Medios / editorial",
  "Digital media, news, or content platform with subscriptions and advertising":
    "Medio digital, de noticias o plataforma de contenidos con suscripciones y publicidad",
  "Subscriber Database": "Base de datos de suscriptores",
  "Database of registered users and paying subscribers": "Base de datos de usuarios registrados y suscriptores de pago",
  "Reading Preferences": "Preferencias de lectura",
  "Content Management System": "Gestor de contenidos",
  "Editorial CMS for publishing articles, videos, and podcasts":
    "Gestor de contenidos editorial para publicar artículos, vídeos y pódcasts",
  "Editorial": "Redacción",
  "Author Profiles": "Perfiles de autores",
  "User Comments": "Comentarios de usuarios",
  "User-Generated Content": "Contenido generado por usuarios",
  "Ad Tech Platform": "Plataforma de tecnología publicitaria",
  "Programmatic advertising and audience targeting system":
    "Sistema de publicidad programática y segmentación de audiencias",
  "Revenue": "Ingresos",
  "Cookie/Device IDs": "Identificadores de cookies y dispositivos",
  "Content Consumption Patterns": "Patrones de consumo de contenidos",
  "Interest Segments": "Segmentos de intereses",
  "Ad Interaction Data": "Datos de interacción con anuncios",
  "Newsletter Platform": "Plataforma de boletines",
  "Email newsletter distribution and subscriber management":
    "Envío de boletines por correo electrónico y gestión de suscriptores",
  "Growth": "Crecimiento",
  "Open/Click Rates": "Tasas de apertura y de clics",
  "Topic Preferences": "Preferencias de temas",
  "Subscription Management": "Gestión de suscripciones",
  "Managing paid subscriptions, billing, and access control":
    "Gestión de suscripciones de pago, facturación y control de acceso",
  "Manage subscriber accounts, process payments, and control access to premium content":
    "Gestionar las cuentas de los suscriptores, tramitar los pagos y controlar el acceso al contenido de pago",
  "Duration of subscription + 3 years": "Vigencia de la suscripción + 3 años",
  "Programmatic Advertising": "Publicidad programática",
  "Serving targeted ads based on reading behavior and audience segments":
    "Publicación de anuncios segmentados según el comportamiento de lectura y los segmentos de audiencia",
  "Display relevant advertisements to fund content production, using audience segmentation based on reading behavior":
    "Mostrar anuncios pertinentes para financiar la producción de contenidos, con segmentación de audiencias según el comportamiento de lectura",
  "13 months": "13 meses",
  "Readers": "Lectores",
  "Ad networks": "Redes publicitarias",
  "Demand-side platforms": "Plataformas de compra de publicidad (DSP)",
  "Advertisers": "Anunciantes",
  "Newsletter Distribution": "Envío de boletines",
  "Sending editorial newsletters and managing subscriber preferences":
    "Envío de boletines editoriales y gestión de las preferencias de los suscriptores",
  "Distribute newsletter content to opted-in subscribers and track engagement for editorial optimization":
    "Enviar los boletines a los suscriptores que lo han aceptado y medir la interacción para mejorar la línea editorial",
  "Until unsubscribe + 30 days": "Hasta la baja + 30 días",
  "Newsletter signups": "Altas en boletines",
  "Email service provider": "Proveedor de envío de correo electrónico",
  "Content Personalization": "Personalización de contenidos",
  "Recommending articles and content based on reading history":
    "Recomendación de artículos y contenidos según el historial de lectura",
  "Provide personalized content recommendations to improve reader engagement and satisfaction":
    "Ofrecer recomendaciones de contenidos personalizadas para mejorar la interacción y la satisfacción de los lectores",
  "Subscribers to Ad Platform": "De suscriptores a la plataforma publicitaria",
  "Audience segments shared with ad tech for targeting":
    "Segmentos de audiencia compartidos con la plataforma publicitaria para la segmentación",
  "Subscribers to Newsletter": "De suscriptores a boletines",
  "Subscriber data synced to newsletter platform": "Datos de suscriptores sincronizados con la plataforma de boletines",
  "Newsletter engagement: opens, clicks, bounces, and unsubscribe events per recipient":
    "Interacción con los boletines: aperturas, clics, rebotes y bajas por destinatario",

  // ── Professional services ────────────────────────
  "Professional Services": "Servicios profesionales",
  "Consulting, legal, accounting, or agency with client data and project management":
    "Consultoría, despacho jurídico, asesoría contable o agencia con datos de clientes y gestión de proyectos",
  "Client Database": "Base de datos de clientes (CRM)",
  "CRM and client relationship management system": "Sistema de gestión de la relación con los clientes (CRM)",
  "Business Development": "Desarrollo de negocio",
  "Client Contact Name": "Nombre de la persona de contacto del cliente",
  "Company & Role": "Empresa y cargo",
  "Engagement History": "Historial de encargos",
  "Project Management System": "Sistema de gestión de proyectos",
  "Project tracking, document sharing, and collaboration platform":
    "Plataforma de seguimiento de proyectos, intercambio de documentos y colaboración",
  "Project Documents": "Documentos del proyecto",
  "Client Communications": "Comunicaciones con clientes",
  "Time Tracking": "Registro de horas",
  "Deliverable Files": "Archivos de entregables",
  "HR & Payroll System": "Sistema de recursos humanos y nóminas",
  "Employee management, payroll, and benefits administration":
    "Gestión del personal, nóminas y beneficios sociales",
  "Employee Personal Details": "Datos personales del empleado",
  "Salary & Compensation": "Salario y retribución",
  "Bank Account Details": "Datos de la cuenta bancaria",
  "Tax Information": "Información fiscal",
  "Emergency Contacts": "Contactos de emergencia",
  "Document Management": "Gestión documental",
  "Secure document storage for contracts, proposals, and client files":
    "Almacenamiento seguro de contratos, propuestas y expedientes de clientes",
  "Client Contracts": "Contratos con clientes",
  "NDAs & Legal Docs": "Acuerdos de confidencialidad y documentos jurídicos",
  "Financial Reports": "Informes financieros",
  "Client Relationship Management": "Gestión de la relación con los clientes",
  "Managing client contacts, engagements, and business development pipeline":
    "Gestión de los contactos de clientes, los encargos y la cartera de oportunidades",
  "Manage client relationships, track engagements, and support business development efforts":
    "Gestionar la relación con los clientes, seguir los encargos y apoyar el desarrollo de negocio",
  "Duration of relationship + 5 years": "Duración de la relación + 5 años",
  "Clients": "Clientes",
  "Prospects": "Clientes potenciales",
  "Business contacts": "Contactos profesionales",
  "CRM provider": "Proveedor del CRM",
  "Service Delivery & Project Work": "Prestación del servicio y trabajo en proyectos",
  "Executing client engagements, managing deliverables, and collaborating on projects":
    "Ejecución de los encargos de clientes, gestión de entregables y colaboración en proyectos",
  "Deliver contracted professional services, manage project workflows, and maintain engagement records":
    "Prestar los servicios profesionales contratados, gestionar el flujo de trabajo de los proyectos y conservar el registro de los encargos",
  "Duration of engagement + 7 years": "Duración del encargo + 7 años",
  "Client employees": "Empleados del cliente",
  "Project management platform": "Plataforma de gestión de proyectos",
  "Subcontractors (where applicable)": "Subcontratistas (cuando proceda)",
  "Employee HR & Payroll": "Recursos humanos y nóminas",
  "Managing employee records, payroll processing, and benefits administration":
    "Gestión de los expedientes del personal, cálculo de nóminas y gestión de beneficios sociales",
  "Manage employment lifecycle, process payroll, and fulfill employment obligations":
    "Gestionar la relación laboral de principio a fin, calcular las nóminas y cumplir las obligaciones laborales",
  "Duration of employment + 7 years": "Duración de la relación laboral + 7 años",
  "Contractors": "Profesionales externos",
  "Payroll provider": "Proveedor de nóminas",
  "Benefits providers": "Proveedores de beneficios sociales",
  "Client to Projects": "De clientes a proyectos",
  "Client data referenced in project management for engagement delivery":
    "Datos de clientes a los que se hace referencia en la gestión de proyectos para prestar el encargo",
  "Project status, time spent, engagement notes, and billable hours posted back to client record":
    "Estado del proyecto, tiempo dedicado, notas del encargo y horas facturables que se devuelven a la ficha del cliente",
  "Projects to Documents": "De proyectos a gestión documental",
  "Project deliverables and files stored in document management":
    "Entregables y archivos del proyecto guardados en la gestión documental",
};
