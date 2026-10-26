// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Closed lists the AI-assisted register import may classify free text into
 * (src/server/services/portability/ai-import.ts). The records keep data
 * subjects and recipients as words: an accepted suggestion writes the
 * label of its code in the reader's language. Purposes are kept as the
 * text written; the category goes into the record's metadata.
 *
 * Data categories, special categories and legal bases use the platform's
 * own enumerations (DataCategory, LegalBasis); countries use ISO 3166-1
 * alpha-2 codes (src/lib/country-code.ts).
 */

export type TaxonomyLabels = Record<string, { en: string; es: string }>;

export const DATA_SUBJECT_CATEGORIES: TaxonomyLabels = {
  CUSTOMERS: { en: "Customers", es: "Clientes" },
  PROSPECTS: { en: "Prospective customers", es: "Clientes potenciales" },
  EMPLOYEES: { en: "Employees", es: "Empleados" },
  JOB_APPLICANTS: { en: "Job applicants", es: "Candidatos a un empleo" },
  CONTRACTORS: { en: "Contractors and freelancers", es: "Contratistas y autónomos" },
  FORMER_EMPLOYEES: { en: "Former employees", es: "Antiguos empleados" },
  SUPPLIER_CONTACTS: { en: "Supplier contacts", es: "Contactos de proveedores" },
  BUSINESS_CONTACTS: { en: "Business contacts", es: "Contactos profesionales" },
  WEBSITE_VISITORS: { en: "Website visitors", es: "Visitantes del sitio web" },
  APP_USERS: { en: "App and service users", es: "Usuarios de la aplicación o del servicio" },
  SUBSCRIBERS: { en: "Subscribers", es: "Suscriptores" },
  PATIENTS: { en: "Patients", es: "Pacientes" },
  STUDENTS: { en: "Students", es: "Alumnos" },
  MINORS: { en: "Minors", es: "Menores" },
  SHAREHOLDERS: { en: "Shareholders and investors", es: "Accionistas e inversores" },
  MEMBERS: { en: "Members and associates", es: "Socios y asociados" },
  VISITORS: { en: "Visitors to the premises", es: "Visitantes de las instalaciones" },
  COMPLAINANTS: { en: "Complainants and whistleblowers", es: "Reclamantes e informantes" },
  PUBLIC: { en: "Members of the public", es: "Ciudadanos" },
};

export const RECIPIENT_CATEGORIES: TaxonomyLabels = {
  INTERNAL_TEAMS: { en: "Internal teams", es: "Equipos internos" },
  GROUP_COMPANIES: { en: "Group companies", es: "Empresas del grupo" },
  SERVICE_PROVIDERS: { en: "Service providers (processors)", es: "Proveedores de servicios (encargados)" },
  IT_PROVIDERS: { en: "IT and hosting providers", es: "Proveedores de tecnología y alojamiento" },
  PAYMENT_PROVIDERS: { en: "Banks and payment providers", es: "Bancos y proveedores de pago" },
  INSURERS: { en: "Insurers", es: "Aseguradoras" },
  PROFESSIONAL_ADVISERS: { en: "Professional advisers (lawyers, auditors)", es: "Asesores profesionales (abogados, auditores)" },
  TAX_AUTHORITIES: { en: "Tax authorities", es: "Administración tributaria" },
  SOCIAL_SECURITY: { en: "Social security bodies", es: "Seguridad Social" },
  PUBLIC_AUTHORITIES: { en: "Other public authorities", es: "Otras administraciones públicas" },
  COURTS_AND_POLICE: { en: "Courts and law enforcement", es: "Juzgados y fuerzas de seguridad" },
  BUSINESS_PARTNERS: { en: "Business partners", es: "Socios comerciales" },
  MARKETING_PARTNERS: { en: "Marketing and advertising partners", es: "Socios de marketing y publicidad" },
  HEALTH_PROVIDERS: { en: "Health and occupational-risk providers", es: "Servicios de salud y de prevención de riesgos laborales" },
  TRAINING_PROVIDERS: { en: "Training providers", es: "Proveedores de formación" },
};

export const PURPOSE_CATEGORIES: TaxonomyLabels = {
  HR_MANAGEMENT: { en: "Human resources management", es: "Gestión de recursos humanos" },
  PAYROLL: { en: "Payroll", es: "Nóminas" },
  RECRUITMENT: { en: "Recruitment", es: "Selección de personal" },
  CUSTOMER_MANAGEMENT: { en: "Customer management", es: "Gestión de clientes" },
  SALES: { en: "Sales and contracts", es: "Ventas y contratos" },
  BILLING: { en: "Billing and accounting", es: "Facturación y contabilidad" },
  MARKETING: { en: "Marketing and communications", es: "Marketing y comunicaciones" },
  ANALYTICS: { en: "Analytics", es: "Analítica" },
  CUSTOMER_SUPPORT: { en: "Customer support", es: "Atención al cliente" },
  SUPPLIER_MANAGEMENT: { en: "Supplier management", es: "Gestión de proveedores" },
  SECURITY: { en: "Security and access control", es: "Seguridad y control de acceso" },
  VIDEO_SURVEILLANCE: { en: "Video surveillance", es: "Videovigilancia" },
  IT_OPERATIONS: { en: "IT operations", es: "Operaciones de sistemas" },
  LEGAL_COMPLIANCE: { en: "Legal and regulatory compliance", es: "Cumplimiento legal y normativo" },
  WHISTLEBLOWING: { en: "Whistleblowing channel", es: "Canal de denuncias" },
  HEALTH_CARE: { en: "Health care", es: "Asistencia sanitaria" },
  EDUCATION: { en: "Education and training", es: "Educación y formación" },
  RESEARCH: { en: "Research and development", es: "Investigación y desarrollo" },
  PRODUCT_DELIVERY: { en: "Providing the product or service", es: "Prestación del producto o servicio" },
};

/** Data categories the GDPR treats as special (Art. 9) or criminal (Art. 10). */
export const SPECIAL_DATA_CATEGORIES = [
  "HEALTH",
  "BIOMETRIC",
  "GENETIC",
  "POLITICAL",
  "RELIGIOUS",
  "SEXUAL_ORIENTATION",
  "CRIMINAL",
] as const;

/** The label of a code in the reader's language, or the code itself. */
export function taxonomyLabel(list: TaxonomyLabels, code: string, locale: "en" | "es"): string {
  return list[code]?.[locale] ?? code;
}
