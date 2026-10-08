// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Castilian Spanish text of the jurisdiction catalog and of the
 * applicability wizard (src/config/jurisdiction-catalog.ts), keyed by
 * jurisdiction code and by question id. Read through localizeJurisdiction()
 * and localizeQuestion(); codes, numbers and matching logic stay in the
 * English catalog, which remains the source of truth.
 *
 * Law names: the official Spanish name where one exists (RGPD, Reglamento
 * de IA, the Mexican and Argentine laws); every other law keeps its official
 * name, with the description in Spanish. tests/jurisdiction-catalog-es.test.ts
 * checks that every code and question has an entry of the same shape.
 */

export interface JurisdictionTextEs {
  name?: string;
  shortName?: string;
  regionLabel: string;
  description: string;
  keyRequirements: string[];
  applicabilityCriteria: string[];
  penalties: string;
  dpaName?: string;
}

const US_RIGHTS = "Derechos de los consumidores: acceso, rectificación, supresión, portabilidad y exclusión voluntaria (opt-out)";
const US_AG = "Hasta 7500 USD por infracción; la aplicación corresponde al fiscal general del estado (Attorney General)";
const US_SENSITIVE_CONSENT = "Consentimiento para tratar datos sensibles";
const US_UOOM = "Reconocimiento de los mecanismos universales de exclusión voluntaria";
const US_HIGH_RISK_DPA = "Evaluaciones de protección de datos para los tratamientos de alto riesgo";
const US_TA_PROFILING_DPA = "Evaluaciones de protección de datos para la publicidad dirigida y la elaboración de perfiles";
const us = (state: string) => `EE. UU. (${state})`;
const doBusiness = (state: string) => `Operar en ${state} o dirigirse a residentes de ${state}`;
const consumers = (n: string, state: string) => `Controlar o tratar datos personales de más de ${n} consumidores de ${state}`;
const sales = (n: string, pct: string) =>
  `Tratar datos de más de ${n} consumidores y obtener más del ${pct} de los ingresos de la venta de datos`;

export const JURISDICTION_CATALOG_ES: Record<string, JurisdictionTextEs> = {
  // ---------------------------------------------------------- EU / EEA
  GDPR: {
    name: "Reglamento General de Protección de Datos (RGPD)",
    shortName: "RGPD",
    regionLabel: "UE",
    description:
      "El reglamento general de la UE sobre protección de datos, que regula el tratamiento de los datos personales de las personas que se encuentran en el Espacio Económico Europeo.",
    keyRequirements: [
      "Base jurídica para todas las actividades de tratamiento",
      "Evaluaciones de impacto relativas a la protección de datos para los tratamientos de alto riesgo",
      "Designación obligatoria de un delegado de protección de datos para determinados responsables y encargados",
      "Derechos de los interesados: acceso, rectificación, supresión, portabilidad y oposición",
      "Registro de las actividades de tratamiento (art. 30)",
    ],
    applicabilityCriteria: [
      "Tratar datos personales de residentes en la UE o el EEE",
      "Estar establecido en la UE o el EEE",
      "Ofrecer bienes o servicios a residentes en la UE o el EEE",
      "Controlar el comportamiento de residentes en la UE o el EEE",
    ],
    penalties: "Hasta 20 millones de euros o el 4 % del volumen de negocio total anual mundial, si esta cuantía es superior",
    dpaName: "Comité Europeo de Protección de Datos (CEPD)",
  },
  "UK-GDPR": {
    regionLabel: "Reino Unido",
    description:
      "La versión del RGPD que el Reino Unido conservó tras el Brexit, que regula el tratamiento de datos personales en el Reino Unido.",
    keyRequirements: [
      "Base jurídica para el tratamiento (como en el RGPD de la UE)",
      "Evaluaciones de impacto relativas a la protección de datos para los tratamientos de alto riesgo",
      "Designación obligatoria de un delegado de protección de datos para autoridades públicas y tratamientos a gran escala",
      "Mecanismos de transferencia internacional (decisiones de adecuación del Reino Unido y cláusulas tipo del Reino Unido)",
      "Registro de las actividades de tratamiento",
    ],
    applicabilityCriteria: [
      "Tratar datos personales de residentes en el Reino Unido",
      "Estar establecido en el Reino Unido",
      "Ofrecer bienes o servicios a residentes en el Reino Unido",
      "Controlar el comportamiento de residentes en el Reino Unido",
    ],
    penalties: "Hasta 17,5 millones de libras o el 4 % del volumen de negocio total anual mundial, si esta cuantía es superior",
  },
  FADP: {
    regionLabel: "Suiza",
    description:
      "La Ley federal suiza de protección de datos revisada, modernizada para alinearse con el RGPD y mantener la decisión de adecuación de la UE.",
    keyRequirements: [
      "Protección de datos desde el diseño y por defecto",
      "Evaluaciones de impacto relativas a la protección de datos para los tratamientos de alto riesgo",
      "Deber de informar a los interesados de la recogida de sus datos",
      "Notificación de las violaciones de seguridad al FDPIC sin dilación indebida",
      "Registro de las actividades de tratamiento para responsables con 250 o más empleados",
    ],
    applicabilityCriteria: [
      "Tratar datos personales de personas que se encuentran en Suiza",
      "Estar establecido en Suiza",
      "Tratamientos que producen efectos en Suiza",
    ],
    penalties: "Hasta 250.000 CHF para las personas físicas (sanciones penales); no hay multas directas a las empresas",
  },

  // ---------------------------------------------------------- US STATES
  CCPA: {
    regionLabel: us("California"),
    description:
      "La ley general de privacidad de los consumidores de California. Las modificaciones de la CPRA (en vigor desde enero de 2023) ampliaron la CCPA y crearon la Agencia de Protección de la Privacidad de California (CPPA), con derechos como la rectificación y la limitación del uso de la información personal sensible.",
    keyRequirements: [
      "Derecho a saber, suprimir, rectificar y oponerse a la venta o la cesión (opt-out)",
      "Derecho a limitar el uso de la información personal sensible",
      "Evaluaciones de riesgos para los tratamientos que presentan un riesgo significativo",
      "Principios de minimización de datos y limitación de la finalidad",
      "Requisitos contractuales para proveedores de servicios y contratistas",
    ],
    applicabilityCriteria: [
      "Ingresos brutos anuales superiores a 25 millones de USD",
      "Comprar, vender o ceder información personal de más de 100.000 consumidores u hogares de California",
      "Obtener el 50 % o más de los ingresos anuales de la venta o cesión de información personal",
    ],
    penalties:
      "Hasta 2500 USD por infracción no intencionada; 7500 USD por infracción intencionada o que afecte a menores",
  },
  VCDPA: {
    regionLabel: us("Virginia"),
    description:
      "La ley general de privacidad de los consumidores de Virginia, que otorga a los residentes derechos sobre sus datos personales e impone obligaciones a los responsables del tratamiento.",
    keyRequirements: [
      US_RIGHTS,
      "Evaluaciones de protección de datos para la publicidad dirigida, la elaboración de perfiles y los datos sensibles",
      "Limitación de la finalidad y minimización de datos",
      "Consentimiento previo (opt-in) para tratar datos sensibles",
      "Avisos de privacidad transparentes",
    ],
    applicabilityCriteria: [
      doBusiness("Virginia"),
      consumers("100.000", "Virginia"),
      "Controlar o tratar datos de más de 25.000 consumidores y obtener más del 50 % de los ingresos de su venta",
    ],
    penalties: "Hasta 7500 USD por infracción; la aplicación corresponde en exclusiva al fiscal general del estado (Attorney General)",
  },
  CPA: {
    regionLabel: us("Colorado"),
    description:
      "La ley de privacidad de los consumidores de Colorado, que reconoce los mecanismos universales de exclusión voluntaria y exige evaluaciones de protección de datos.",
    keyRequirements: [
      US_RIGHTS,
      "Evaluaciones de protección de datos obligatorias",
      US_UOOM,
      "Especificación de la finalidad y minimización de datos",
      US_SENSITIVE_CONSENT,
    ],
    applicabilityCriteria: [
      doBusiness("Colorado"),
      consumers("100.000", "Colorado"),
      "Tratar datos de más de 25.000 consumidores y obtener ingresos de la venta de datos personales",
    ],
    penalties: "Hasta 20.000 USD por infracción, conforme a la Colorado Consumer Protection Act",
  },
  CTDPA: {
    regionLabel: us("Connecticut"),
    description:
      "La ley de privacidad de los datos de los consumidores de Connecticut, que exige evaluaciones de protección de datos y el reconocimiento de los mecanismos universales de exclusión voluntaria.",
    keyRequirements: [
      US_RIGHTS,
      US_TA_PROFILING_DPA,
      "Reconocimiento de las señales universales de exclusión voluntaria",
      US_SENSITIVE_CONSENT,
      "Aviso de privacidad con información clara",
    ],
    applicabilityCriteria: [doBusiness("Connecticut"), consumers("100.000", "Connecticut"), sales("25.000", "25 %")],
    penalties: "Hasta 5000 USD por infracción; la aplicación corresponde al fiscal general del estado (Attorney General) conforme a la CUTPA",
  },
  UCPA: {
    regionLabel: us("Utah"),
    description:
      "La ley de privacidad de los consumidores de Utah, favorable a las empresas, con un ámbito más reducido y sin obligación de realizar evaluaciones de protección de datos.",
    keyRequirements: [
      "Derechos de los consumidores: acceso, supresión, portabilidad y exclusión voluntaria de la venta y de la publicidad dirigida",
      "Aviso de privacidad transparente obligatorio",
      US_SENSITIVE_CONSENT,
      "Sin obligación de realizar evaluaciones de protección de datos",
      "Plazo de subsanación de 30 días para las infracciones",
    ],
    applicabilityCriteria: [
      doBusiness("Utah"),
      "Ingresos anuales de 25 millones de USD o más",
      "Controlar o tratar datos personales de más de 100.000 consumidores de Utah, o tratar datos de más de 25.000 consumidores y obtener más del 50 % de los ingresos de la venta de datos",
    ],
    penalties: US_AG,
  },
  ICDPA: {
    regionLabel: us("Iowa"),
    description:
      "La ley de protección de datos de los consumidores de Iowa, con un plazo de subsanación de 90 días y derechos de los consumidores más limitados que en otras leyes estatales.",
    keyRequirements: [
      "Derechos de los consumidores: acceso, supresión, portabilidad y exclusión voluntaria de la venta y de la publicidad dirigida",
      US_SENSITIVE_CONSENT,
      "Plazo de subsanación de 90 días para las presuntas infracciones",
      "Información en el aviso de privacidad",
      "Sin acción privada de los particulares",
    ],
    applicabilityCriteria: [doBusiness("Iowa"), consumers("100.000", "Iowa"), sales("25.000", "50 %")],
    penalties: US_AG,
  },
  TDPSA: {
    regionLabel: us("Texas"),
    description:
      "La ley general de privacidad de los consumidores de Texas, de aplicación amplia (sin umbral de ingresos), que exige evaluaciones de protección de datos.",
    keyRequirements: [
      US_RIGHTS,
      US_HIGH_RISK_DPA,
      US_UOOM,
      US_SENSITIVE_CONSENT,
      "Exención para pequeñas empresas en determinadas disposiciones sobre la venta de datos",
    ],
    applicabilityCriteria: [
      doBusiness("Texas"),
      "Tratar datos personales de residentes en Texas",
      "No tener la condición de pequeña empresa según la SBA",
    ],
    penalties: "Hasta 25.000 USD por infracción; la aplicación corresponde al fiscal general del estado (Attorney General)",
  },
  FDBR: {
    regionLabel: us("Florida"),
    description:
      "La ley de privacidad de los consumidores de Florida, dirigida a las grandes empresas, con disposiciones especiales sobre los datos de menores y las empresas tecnológicas.",
    keyRequirements: [
      US_RIGHTS,
      "Disposiciones sobre la seguridad de los menores en internet",
      "Restricciones a la vigilancia por parte de las grandes plataformas tecnológicas",
      US_HIGH_RISK_DPA,
      "Plazo de subsanación de 45 días",
    ],
    applicabilityCriteria: [
      "Operar en Florida",
      "Ingresos brutos anuales mundiales superiores a 1000 millones de USD",
      "Cumplir criterios específicos de empresa tecnológica o basada en datos",
    ],
    penalties: "Hasta 50.000 USD por infracción; el triple de la indemnización por las infracciones que afecten a menores",
  },
  MCDPA: {
    regionLabel: us("Montana"),
    description:
      "La ley de privacidad de los datos de los consumidores de Montana, con el umbral de población más bajo entre las leyes estatales de privacidad de EE. UU. (50.000 consumidores).",
    keyRequirements: [
      US_RIGHTS,
      US_TA_PROFILING_DPA,
      "Reconocimiento de las señales universales de exclusión voluntaria",
      US_SENSITIVE_CONSENT,
      "Plazo de subsanación de 60 días (desaparece en julio de 2025)",
    ],
    applicabilityCriteria: [doBusiness("Montana"), consumers("50.000", "Montana"), sales("25.000", "25 %")],
    penalties: US_AG,
  },
  OCPA: {
    regionLabel: us("Oregón"),
    description:
      "La ley de privacidad de los consumidores de Oregón, de aplicación amplia, que incluye a las entidades sin ánimo de lucro y reconoce derechos sólidos a los consumidores.",
    keyRequirements: [
      "Derechos de los consumidores: acceso, rectificación, supresión, portabilidad, exclusión voluntaria y lista de terceros",
      "Evaluaciones de protección de datos obligatorias",
      "Se aplica a las entidades sin ánimo de lucro",
      "Consentimiento para tratar datos sensibles, incluida la geolocalización precisa",
      "Derecho a obtener la lista de los terceros concretos que reciben los datos",
    ],
    applicabilityCriteria: [doBusiness("Oregón"), consumers("100.000", "Oregón"), sales("25.000", "25 %")],
    penalties: US_AG,
  },
  TIPA: {
    regionLabel: us("Tennessee"),
    description:
      "La ley de protección de datos de los consumidores de Tennessee, con una defensa afirmativa para las organizaciones que siguen el NIST Privacy Framework.",
    keyRequirements: [
      US_RIGHTS,
      US_HIGH_RISK_DPA,
      "Defensa afirmativa por el cumplimiento del NIST Privacy Framework",
      US_SENSITIVE_CONSENT,
      "Plazo de subsanación de 60 días",
    ],
    applicabilityCriteria: [
      doBusiness("Tennessee"),
      "Ingresos anuales superiores a 25 millones de USD",
      "Controlar o tratar datos personales de más de 175.000 consumidores de Tennessee, o tratar datos de más de 25.000 consumidores y obtener más del 50 % de los ingresos de la venta de datos",
    ],
    penalties: US_AG,
  },
  INDPA: {
    regionLabel: us("Indiana"),
    description:
      "La ley de protección de datos de los consumidores de Indiana, con los derechos habituales de los consumidores y un plazo de subsanación de 30 días.",
    keyRequirements: [
      US_RIGHTS,
      US_SENSITIVE_CONSENT,
      US_HIGH_RISK_DPA,
      "Obligaciones sobre el aviso de privacidad",
      "Plazo de subsanación de 30 días para las infracciones",
    ],
    applicabilityCriteria: [doBusiness("Indiana"), consumers("100.000", "Indiana"), sales("25.000", "50 %")],
    penalties: US_AG,
  },
  KCDPA: {
    regionLabel: us("Kentucky"),
    description:
      "La ley de protección de datos de los consumidores de Kentucky, muy próxima a la VCDPA de Virginia, con los derechos habituales de los consumidores.",
    keyRequirements: [
      US_RIGHTS,
      "Evaluaciones de protección de datos para la publicidad dirigida, la elaboración de perfiles y los datos sensibles",
      US_SENSITIVE_CONSENT,
      "Requisitos del aviso de privacidad",
      "Plazo de subsanación de 30 días para las infracciones",
    ],
    applicabilityCriteria: [doBusiness("Kentucky"), consumers("100.000", "Kentucky"), sales("25.000", "50 %")],
    penalties: US_AG,
  },
  NJDPA: {
    regionLabel: us("Nueva Jersey"),
    description:
      "La ley general de privacidad de los datos de Nueva Jersey, con una definición amplia de los datos sensibles que incluye los datos financieros y la afiliación sindical.",
    keyRequirements: [
      US_RIGHTS,
      US_HIGH_RISK_DPA,
      "Definición amplia de los datos sensibles (incluye los datos financieros)",
      US_UOOM,
      US_SENSITIVE_CONSENT,
    ],
    applicabilityCriteria: [
      doBusiness("Nueva Jersey"),
      consumers("100.000", "Nueva Jersey"),
      "Tratar datos de más de 25.000 consumidores y obtener ingresos de la venta de datos",
    ],
    penalties: "Hasta 10.000 USD por la primera infracción; 20.000 USD por las siguientes",
  },
  NHDPA: {
    regionLabel: us("Nuevo Hampshire"),
    description:
      "La ley de privacidad de los datos de los consumidores de Nuevo Hampshire, con los derechos y protecciones habituales, inspirada en la CTDPA de Connecticut.",
    keyRequirements: [
      US_RIGHTS,
      US_TA_PROFILING_DPA,
      "Reconocimiento de las señales universales de exclusión voluntaria",
      US_SENSITIVE_CONSENT,
      "Plazo de subsanación de 60 días",
    ],
    applicabilityCriteria: [doBusiness("Nuevo Hampshire"), consumers("35.000", "Nuevo Hampshire"), sales("10.000", "25 %")],
    penalties: "Hasta 10.000 USD por infracción; la aplicación corresponde al fiscal general del estado (Attorney General)",
  },
  DPDPA: {
    regionLabel: us("Delaware"),
    description:
      "La ley general de privacidad de los consumidores de Delaware, con derechos sólidos de los consumidores y aplicable a las entidades sin ánimo de lucro.",
    keyRequirements: [
      US_RIGHTS,
      US_HIGH_RISK_DPA,
      "Se aplica a las entidades sin ánimo de lucro",
      US_UOOM,
      US_SENSITIVE_CONSENT,
    ],
    applicabilityCriteria: [doBusiness("Delaware"), consumers("35.000", "Delaware"), sales("10.000", "20 %")],
    penalties: "Hasta 10.000 USD por infracción; la aplicación corresponde al fiscal general del estado (Attorney General)",
  },
  MNDPA: {
    regionLabel: us("Minnesota"),
    description:
      "La ley general de privacidad de Minnesota, con derechos sólidos de los consumidores, incluidas protecciones frente a la elaboración de perfiles y una acción privada para determinadas infracciones.",
    keyRequirements: [
      US_RIGHTS,
      "Derecho a cuestionar e impugnar las decisiones basadas en perfiles",
      "Evaluaciones de protección de datos obligatorias",
      "Minimización de datos y limitación de la finalidad",
      "Obligaciones propias de los encargados del tratamiento",
    ],
    applicabilityCriteria: [doBusiness("Minnesota"), consumers("100.000", "Minnesota"), sales("25.000", "25 %")],
    penalties: "Hasta 7500 USD por infracción; acción privada limitada para determinadas infracciones",
  },
  MODPA: {
    regionLabel: us("Maryland"),
    description:
      "La ley de privacidad de los consumidores de Maryland, exigente, que prohíbe la venta de datos sensibles, con requisitos estrictos de minimización de datos y protecciones para los menores.",
    keyRequirements: [
      "Prohibición de vender datos sensibles (no solo derecho de exclusión voluntaria)",
      "Minimización estricta: la recogida se limita a lo razonablemente necesario",
      US_RIGHTS,
      US_HIGH_RISK_DPA,
      "Protección de los datos de los menores",
    ],
    applicabilityCriteria: [doBusiness("Maryland"), consumers("35.000", "Maryland"), sales("10.000", "20 %")],
    penalties:
      "Hasta 10.000 USD por infracción y 25.000 USD por las siguientes; la aplicación corresponde al fiscal general del estado (Attorney General)",
  },
  NEDPA: {
    regionLabel: us("Nebraska"),
    description:
      "La ley de protección de datos de los consumidores de Nebraska, de aplicación amplia (sin umbral de ingresos ni de volumen), inspirada en la TDPSA de Texas.",
    keyRequirements: [
      US_RIGHTS,
      US_HIGH_RISK_DPA,
      US_UOOM,
      US_SENSITIVE_CONSENT,
      "Plazo de subsanación de 30 días para las infracciones",
    ],
    applicabilityCriteria: [
      doBusiness("Nebraska"),
      "No tener la condición de pequeña empresa según la SBA",
      "Tratar datos personales de residentes en Nebraska",
    ],
    penalties: US_AG,
  },

  // ---------------------------------------------------------- AMERICAS (NON-US)
  LGPD: {
    regionLabel: "Brasil",
    description:
      "La ley general de protección de datos de Brasil, inspirada en el RGPD, que reconoce derechos a los interesados e impone obligaciones a los responsables y encargados del tratamiento.",
    keyRequirements: [
      "Base jurídica para el tratamiento (se definen 10 bases jurídicas)",
      "Designación obligatoria de un encargado de la protección de datos",
      "Derechos de los interesados: confirmación, acceso, rectificación, anonimización, portabilidad y supresión",
      "Notificación de las violaciones de seguridad a la ANPD y a los interesados afectados en un plazo de 3 días hábiles (Resolución CD/ANPD n.º 15/2024)",
      "Registro de las actividades de tratamiento",
    ],
    applicabilityCriteria: [
      "Tratar datos personales recogidos en Brasil",
      "Tratar datos de personas que se encuentran en Brasil",
      "Ofrecer bienes o servicios a personas que se encuentran en Brasil",
    ],
    penalties: "Hasta el 2 % de la facturación en Brasil, con un máximo de 50 millones de BRL por infracción",
  },
  PIPEDA: {
    regionLabel: "Canadá",
    description:
      "La ley federal canadiense de privacidad del sector privado, basada en los principios de tratamiento leal de la información, que regula la recogida, el uso y la comunicación de información personal.",
    keyRequirements: [
      "Consentimiento para recoger, usar y comunicar información personal",
      "10 principios de tratamiento leal de la información (responsabilidad, finalidad, consentimiento, limitación de la recogida, etc.)",
      "Comunicación obligatoria de las violaciones que suponen un riesgo real de daño significativo",
      "Derecho de acceso y de impugnar la exactitud de la información personal",
      "Responsabilidad: designación obligatoria de un responsable de privacidad",
    ],
    applicabilityCriteria: [
      "Recoger, usar o comunicar información personal en el marco de actividades comerciales en Canadá",
      "Obras, actividades o empresas de competencia federal",
      "Transferencias de información personal entre provincias o internacionales",
    ],
    penalties:
      "Hasta 100.000 CAD por determinados delitos; el Comisionado de Privacidad puede remitir el asunto al Tribunal Federal",
  },
  LFPDPPP: {
    name: "Ley Federal de Protección de Datos Personales en Posesión de los Particulares (2025)",
    regionLabel: "México",
    description:
      "La ley federal mexicana de protección de datos para el sector privado, publicada el 20 de marzo de 2025, que sustituye a la ley de 2010 del mismo nombre. Mantiene los derechos ARCO (acceso, rectificación, cancelación y oposición). Tras la reforma constitucional de principios de 2025 que suprimió el INAI, su aplicación corresponde ahora a la Secretaría Anticorrupción y Buen Gobierno (SABG).",
    keyRequirements: [
      "Derechos ARCO: acceso, rectificación, cancelación y oposición",
      "Aviso de privacidad antes de la recogida de los datos o en el momento de recogerlos",
      "Consentimiento (expreso para los datos sensibles y los financieros)",
      "Notificación sin demora de las violaciones de seguridad a los titulares",
      "Restricciones a las transferencias internacionales, con responsabilidad proactiva",
    ],
    applicabilityCriteria: [
      "Entidades del sector privado que tratan datos personales en México",
      "Tratar datos personales de personas que se encuentran en México",
    ],
    penalties:
      "Multas de 100 a 320.000 veces el salario mínimo diario de Ciudad de México; pena de prisión para determinadas infracciones",
    dpaName: "Secretaría Anticorrupción y Buen Gobierno (SABG)",
  },

  // ---------------------------------------------------------- ASIA-PACIFIC
  PIPL: {
    regionLabel: "China",
    description:
      "La ley general china de protección de la información personal, con requisitos estrictos de consentimiento, localización de datos y restricciones a las transferencias internacionales.",
    keyRequirements: [
      "Base jurídica, con el consentimiento como base principal; consentimiento específico para los datos sensibles",
      "Evaluaciones de impacto sobre la información personal para los tratamientos de alto riesgo",
      "Localización de datos para los operadores de infraestructuras de información críticas",
      "Las transferencias internacionales exigen una evaluación de seguridad, un contrato tipo o una certificación",
      "Representante designado obligatorio para los responsables extranjeros",
    ],
    applicabilityCriteria: [
      "Tratar información personal de personas que se encuentran en China",
      "Analizar o evaluar el comportamiento de personas que se encuentran en China",
      "Ofrecer productos o servicios a personas que se encuentran en China",
    ],
    penalties:
      "Hasta 50 millones de RMB o el 5 % de los ingresos anuales; responsabilidad personal de los responsables directos; suspensión de aplicaciones o revocación de la licencia de actividad",
  },
  APPI: {
    regionLabel: "Japón",
    description:
      "La ley japonesa de protección de la información personal (modificada en 2022), con más derechos para las personas y normas más estrictas sobre las transferencias internacionales.",
    keyRequirements: [
      "Especificación de la finalidad y limitación del uso",
      "Derechos de las personas: comunicación, rectificación, cese del uso y supresión",
      "Notificación obligatoria de las violaciones de seguridad a la PPC y a las personas afectadas",
      "Transferencias internacionales con consentimiento informado o protección equivalente",
      "Regímenes para los datos seudonimizados y anonimizados",
    ],
    applicabilityCriteria: [
      "Operadores que tratan información personal en Japón",
      "Tratar información personal de personas que se encuentran en Japón",
    ],
    penalties:
      "Hasta 100 millones de JPY para las empresas; hasta 1 año de prisión o multas de hasta 1 millón de JPY para las personas físicas",
  },
  "PDPA-SG": {
    regionLabel: "Singapur",
    description:
      "La ley de protección de datos de Singapur, que regula la recogida, el uso, la comunicación y la custodia de los datos personales por las organizaciones privadas.",
    keyRequirements: [
      "Obligación de consentimiento, con excepciones por interés legítimo",
      "Obligaciones de limitación de la finalidad y de información",
      "Notificación obligatoria de las violaciones de seguridad significativas",
      "Obligación de portabilidad de los datos (desde 2024)",
      "Cumplimiento del registro Do Not Call",
    ],
    applicabilityCriteria: [
      "Organizaciones que recogen, usan o comunican datos personales en Singapur",
      "Tratar datos personales de personas que se encuentran en Singapur",
    ],
    penalties: "Hasta 1 millón de SGD o el 10 % del volumen de negocio anual (si esta cuantía es superior) para las organizaciones",
  },
  PDPA_TH: {
    regionLabel: "Tailandia",
    description:
      "La ley general de protección de datos de Tailandia, inspirada en el RGPD, que reconoce derechos a las personas e impone obligaciones a los responsables y encargados.",
    keyRequirements: [
      "Base jurídica obligatoria (consentimiento, contrato, interés legítimo, etc.)",
      "Derechos de los interesados: acceso, portabilidad, oposición, supresión y limitación",
      "Notificación obligatoria de las violaciones de seguridad a las autoridades en 72 horas",
      "Restricciones a las transferencias internacionales",
      "Designación de un delegado de protección de datos para determinados responsables y encargados",
    ],
    applicabilityCriteria: [
      "Recoger, usar o comunicar datos personales en Tailandia",
      "Ofrecer bienes o servicios a personas que se encuentran en Tailandia",
      "Controlar el comportamiento de personas que se encuentran en Tailandia",
    ],
    penalties:
      "Multas administrativas de hasta 5 millones de THB; sanciones penales de hasta 1 millón de THB o hasta 1 año de prisión, o ambas; indemnización punitiva de hasta el doble del daño efectivo",
  },
  DPDPA_IN: {
    regionLabel: "India",
    description:
      "La ley india de protección de los datos personales digitales, que establece un tratamiento basado en el consentimiento, obligaciones para los fiduciarios de datos y una Junta de Protección de Datos.",
    keyRequirements: [
      "Tratamiento basado en el consentimiento, con un aviso claro",
      "Obligaciones de los fiduciarios de datos (limitación de la finalidad, exactitud, limitación del plazo de conservación)",
      "Designación de fiduciarios de datos significativos, con obligaciones adicionales (delegado de protección de datos, auditorías)",
      "Derechos de los interesados: acceso, rectificación, supresión y atención de reclamaciones",
      "Transferencias internacionales permitidas, salvo a los países que restrinja el Gobierno",
    ],
    applicabilityCriteria: [
      "Tratar datos personales digitales de personas que se encuentran en la India",
      "Ofrecer bienes o servicios a personas que se encuentran en la India",
      "Tratar datos personales recogidos en la India",
    ],
    penalties: "Hasta 2500 millones de INR (250 crore; unos 30 millones de USD) por infracción",
  },
  PRIVACY_ACT_AU: {
    regionLabel: "Australia",
    description:
      "La ley federal australiana de privacidad, que establece los Australian Privacy Principles (APP) sobre el tratamiento de la información personal por los organismos públicos y las grandes organizaciones.",
    keyRequirements: [
      "13 Australian Privacy Principles (APP)",
      "Régimen obligatorio de notificación de violaciones de datos (Notifiable Data Breaches)",
      "Requisitos para las entidades sujetas a los APP: recogida, uso, comunicación, calidad y seguridad",
      "Restricciones a la comunicación internacional (APP 8)",
      "Derecho de acceso a la información personal y de rectificación",
    ],
    applicabilityCriteria: [
      "Volumen de negocio anual de 3 millones de AUD o más",
      "Organismos del Gobierno de Australia",
      "Comercio con información personal",
      "Prestadores de servicios sanitarios y entidades de información crediticia",
    ],
    penalties:
      "Hasta 50 millones de AUD, el triple del beneficio obtenido o el 30 % del volumen de negocio ajustado (la cuantía mayor)",
  },
  PRIVACY_ACT_NZ: {
    regionLabel: "Nueva Zelanda",
    description:
      "La ley de privacidad de Nueva Zelanda, que establece 13 Information Privacy Principles y la notificación obligatoria de las violaciones, y sustituye a la ley de 1993.",
    keyRequirements: [
      "13 Information Privacy Principles (IPP)",
      "Notificación obligatoria de las violaciones de privacidad notificables",
      "Restricciones a la comunicación internacional",
      "Derecho de acceso a la información personal y a solicitar su rectificación",
      "Requerimientos de cumplimiento y decisiones vinculantes del Comisionado de Privacidad",
    ],
    applicabilityCriteria: [
      "Organismos y organizaciones que recogen o conservan información personal en Nueva Zelanda",
      "Organizaciones establecidas en Nueva Zelanda",
      "Organizaciones que realizan actividades comerciales en Nueva Zelanda",
    ],
    penalties:
      "Hasta 10.000 NZD por no notificar una violación; el Human Rights Review Tribunal puede conceder indemnizaciones",
  },
  PDPA_MY: {
    regionLabel: "Malasia",
    description:
      "La ley malasia de protección de datos personales, que regula el tratamiento de los datos personales en las transacciones comerciales del sector privado.",
    keyRequirements: [
      "7 principios de protección de datos (general, aviso, comunicación, seguridad, conservación, integridad de los datos y acceso)",
      "Consentimiento con un aviso claro",
      "Inscripción de los responsables del tratamiento ante el Comisionado",
      "Restricciones a las transferencias internacionales",
      "Derecho de acceso a los datos personales y de rectificación",
    ],
    applicabilityCriteria: [
      "Tratar datos personales en Malasia en el marco de transacciones comerciales",
      "Usar equipos situados en Malasia para tratar datos personales",
    ],
    penalties: "Multas de hasta 500.000 MYR o hasta 3 años de prisión, o ambas",
  },
  PIPA_KR: {
    regionLabel: "Corea del Sur",
    description:
      "La ley general surcoreana de protección de la información personal (modificada en 2023), con requisitos estrictos sobre el consentimiento, las transferencias de datos y las decisiones automatizadas.",
    keyRequirements: [
      "Consentimiento específico para cada finalidad; consentimiento previo (opt-in) para el marketing",
      "Evaluaciones de impacto relativas a la protección de datos para las instituciones públicas",
      "Notificación obligatoria de las violaciones de seguridad en 72 horas",
      "Transferencias internacionales con consentimiento o con adecuación o garantías",
      "Derechos frente a las decisiones automatizadas (reforma de 2023)",
    ],
    applicabilityCriteria: [
      "Tratar información personal de personas que se encuentran en Corea del Sur",
      "Operar actividades dirigidas a residentes en Corea del Sur",
    ],
    penalties:
      "Hasta el 3 % de los ingresos afectados o 2000 millones de KRW por las infracciones graves; sanciones penales, incluida la prisión",
  },

  // ---------------------------------------------------------- AFRICA / MIDDLE EAST
  POPIA: {
    regionLabel: "Sudáfrica",
    description:
      "La ley general de protección de datos de Sudáfrica, inspirada en el RGPD, que establece las condiciones del tratamiento lícito y crea el Information Regulator.",
    keyRequirements: [
      "8 condiciones del tratamiento lícito (responsabilidad, limitación de la finalidad, etc.)",
      "Inscripción obligatoria del Information Officer ante el Regulador",
      "Notificación de las violaciones de seguridad al Regulador y a los interesados",
      "Restricciones a las transferencias internacionales (se exige una protección adecuada)",
      "Derechos de los interesados: acceso, rectificación, supresión y oposición",
    ],
    applicabilityCriteria: [
      "Tratar información personal de personas que se encuentran en Sudáfrica",
      "Partes responsables domiciliadas en Sudáfrica",
      "Usar medios automatizados o no automatizados situados en Sudáfrica para tratar datos",
    ],
    penalties: "Multas de hasta 10 millones de ZAR o hasta 10 años de prisión, o ambas",
  },
  PDPL_SA: {
    regionLabel: "Arabia Saudí",
    description:
      "La ley general de protección de datos personales de Arabia Saudí, que establece requisitos de consentimiento, derechos de las personas y normas sobre las transferencias internacionales.",
    keyRequirements: [
      "El consentimiento como base jurídica principal",
      "Derechos de los interesados: acceso, rectificación, destrucción y portabilidad",
      "Evaluaciones de impacto relativas a la protección de datos obligatorias",
      "Notificación de las violaciones de seguridad a la SDAIA en 72 horas",
      "Requisitos de localización de datos (las transferencias necesitan aprobación o adecuación)",
    ],
    applicabilityCriteria: [
      "Tratar datos personales de personas que se encuentran en Arabia Saudí",
      "Entidades establecidas en Arabia Saudí",
      "Ofrecer bienes o servicios a personas que se encuentran en Arabia Saudí",
    ],
    penalties:
      "Multas de hasta 5 millones de SAR; hasta 2 años de prisión para determinadas infracciones; publicación de las infracciones",
  },
  NDPA: {
    regionLabel: "Nigeria",
    description:
      "La Nigeria Data Protection Act 2023, que derogó y sustituyó al NDPR de 2019, crea la Nigeria Data Protection Commission (NDPC) y establece requisitos generales de protección de datos.",
    keyRequirements: [
      "Base jurídica para el tratamiento (consentimiento, contrato, obligación legal, etc.)",
      "Evaluaciones de impacto relativas a la protección de datos para los tratamientos de alto riesgo",
      "Presentación obligatoria de informes anuales de auditoría de datos",
      "Notificación de las violaciones de seguridad a la Comisión en 72 horas",
      "Inscripción de los delegados de protección de datos",
    ],
    applicabilityCriteria: [
      "Tratar datos personales de personas que se encuentran en Nigeria",
      "Ofrecer bienes o servicios a personas que se encuentran en Nigeria",
      "Controlar el comportamiento de personas que se encuentran en Nigeria",
    ],
    penalties:
      "Hasta el 2 % de los ingresos brutos anuales o 10 millones de NGN (la cuantía mayor) para los responsables que tratan datos de más de 10.000 interesados",
  },

  // ---------------------------------------------------------- ADDITIONAL JURISDICTIONS
  PDPA_AR: {
    name: "Ley 25.326 de Protección de los Datos Personales (Argentina)",
    shortName: "Ley 25.326 (AR)",
    regionLabel: "Argentina",
    description:
      "La Ley 25.326 de Protección de los Datos Personales de Argentina, una de las primeras leyes generales de protección de datos de América Latina. Argentina cuenta con una decisión de adecuación de la UE.",
    keyRequirements: [
      "Consentimiento para el tratamiento, con excepciones limitadas",
      "Derechos de los interesados: acceso, rectificación, supresión y confidencialidad",
      "Inscripción de las bases de datos ante la autoridad de control",
      "Restricciones a las transferencias internacionales (adecuación o consentimiento)",
      "El tratamiento de datos sensibles exige garantías adicionales",
    ],
    applicabilityCriteria: [
      "Tratar datos personales de personas que se encuentran en Argentina",
      "Bases de datos u operaciones de tratamiento situadas en Argentina",
      "Transferir datos personales desde Argentina",
    ],
    penalties:
      "Sanciones administrativas como apercibimiento, multa, suspensión o clausura de las bases de datos; sanciones penales para determinadas infracciones",
    dpaName: "Agencia de Acceso a la Información Pública (AAIP)",
  },
  DPA_PH: {
    regionLabel: "Filipinas",
    description:
      "La ley general de privacidad de los datos de Filipinas, que crea la National Privacy Commission y regula el tratamiento de los datos personales en los sectores público y privado.",
    keyRequirements: [
      "Respeto de los principios de transparencia, finalidad legítima y proporcionalidad",
      "Derechos de los interesados: acceso, rectificación, supresión, portabilidad y oposición",
      "Inscripción obligatoria de los sistemas de tratamiento ante la NPC",
      "Notificación de las violaciones de seguridad a la NPC y a los interesados afectados en 72 horas",
      "Designación de un delegado de protección de datos en determinadas organizaciones",
    ],
    applicabilityCriteria: [
      "Tratar datos personales de ciudadanos o residentes filipinos",
      "Oficinas, sucursales o entidades en Filipinas",
      "Usar equipos situados en Filipinas o mantener una oficina en Filipinas",
    ],
    penalties:
      "Prisión de 1 a 6 años y multas de 500.000 a 5 millones de PHP, según la infracción",
  },
  DPA_KE: {
    regionLabel: "Kenia",
    description:
      "La ley de protección de datos de Kenia, que crea la Office of the Data Protection Commissioner y establece requisitos generales de protección de datos para los sectores público y privado.",
    keyRequirements: [
      "Base jurídica para el tratamiento (consentimiento, contrato, obligación legal, intereses vitales, interés público, interés legítimo)",
      "Derechos de los interesados: acceso, rectificación, supresión, portabilidad y oposición",
      "Evaluaciones de impacto relativas a la protección de datos para los tratamientos de alto riesgo",
      "Notificación obligatoria de las violaciones de seguridad al Comisionado en 72 horas",
      "Inscripción de los responsables y encargados del tratamiento ante el Comisionado",
    ],
    applicabilityCriteria: [
      "Tratar datos personales de personas que se encuentran en Kenia",
      "Responsables o encargados del tratamiento establecidos en Kenia",
      "Tratar datos personales con medios situados en Kenia",
    ],
    penalties:
      "Multas de hasta 5 millones de KES o hasta 10 años de prisión, o ambas; para las personas jurídicas, hasta 5 millones de KES o el 1 % del volumen de negocio anual",
  },

  // ---------------------------------------------------------- AI GOVERNANCE
  EU_AI_ACT: {
    name: "Reglamento (UE) 2024/1689 de Inteligencia Artificial",
    shortName: "Reglamento de IA",
    regionLabel: "UE",
    description:
      "El reglamento general de la UE sobre inteligencia artificial, que establece un marco basado en el riesgo para los sistemas de IA, con prácticas prohibidas, requisitos estrictos para los sistemas de alto riesgo y obligaciones de transparencia.",
    keyRequirements: [
      "Clasificación por riesgo de todos los sistemas de IA (inaceptable, alto, limitado y mínimo)",
      "Prácticas de IA prohibidas: puntuación social, identificación biométrica en tiempo real y técnicas manipuladoras",
      "IA de alto riesgo: evaluaciones de la conformidad, gestión de riesgos, gobernanza de datos y transparencia",
      "Obligaciones de transparencia para el contenido generado por IA y los asistentes conversacionales",
      "Requisitos de alfabetización en IA para responsables del despliegue y proveedores",
    ],
    applicabilityCriteria: [
      "Desplegar o suministrar sistemas de IA en el mercado de la UE",
      "La información de salida del sistema de IA se utiliza en la UE",
      "Proveedor o responsable del despliegue establecido en la UE",
      "Proveedor en un tercer país en el que el Derecho de la UE se aplica en virtud del Derecho internacional",
    ],
    penalties:
      "Hasta 35 millones de euros o el 7 % del volumen de negocio total anual mundial por las prácticas prohibidas; 15 millones de euros o el 3 % por las demás infracciones",
    dpaName: "Oficina Europea de IA y autoridades nacionales de vigilancia del mercado",
  },
};

export const APPLICABILITY_QUESTIONS_ES: Record<string, { question: string; helpText: string }> = {
  eu_residents: {
    question: "¿Tratas datos personales de residentes en la UE o el EEE?",
    helpText:
      "Incluye a clientes, usuarios, empleados o cualquier persona que se encuentre en un Estado miembro de la UE o del EEE, aunque tu organización no esté establecida en la UE.",
  },
  uk_presence: {
    question: "¿Tienes clientes, empleados o usuarios en el Reino Unido?",
    helpText:
      "Desde el Brexit, el Reino Unido tiene su propio régimen de protección de datos. Se aplica si tratas datos de residentes en el Reino Unido o tienes un establecimiento allí.",
  },
  switzerland_presence: {
    question: "¿Tratas datos de personas que se encuentran en Suiza?",
    helpText:
      "Suiza tiene su propia ley de protección de datos (nDSG/FADP), distinta del RGPD de la UE, aunque muy próxima a él.",
  },
  california_consumers: {
    question: "¿Tienes clientes o usuarios en California, o recoges datos de residentes en California?",
    helpText:
      "La CCPA (modificada por la CPRA) se aplica a las empresas que superan determinados umbrales y recogen información personal de consumidores de California.",
  },
  us_multistate: {
    question: "¿Tienes clientes o usuarios en varios estados de EE. UU.?",
    helpText:
      "Muchos estados de EE. UU. han aprobado leyes generales de privacidad. Operar en varios estados puede activar varias obligaciones estatales de privacidad.",
  },
  brazil_residents: {
    question: "¿Tratas datos de residentes en Brasil?",
    helpText:
      "La LGPD se aplica al tratamiento de datos personales recogidos en Brasil o de personas que se encuentran en Brasil, con independencia de dónde esté el responsable.",
  },
  canada_commercial: {
    question: "¿Recoges o usas información personal en actividades comerciales en Canadá?",
    helpText:
      "La PIPEDA se aplica a las organizaciones del sector privado que recogen, usan o comunican información personal en actividades comerciales entre provincias o en ámbitos de competencia federal.",
  },
  china_data: {
    question: "¿Tratas información personal de personas que se encuentran en China u ofreces servicios al mercado chino?",
    helpText:
      "La PIPL china tiene alcance extraterritorial y se aplica a los tratamientos dirigidos a personas que se encuentran en China o que analizan su comportamiento.",
  },
  apac_presence: {
    question:
      "¿Operas o tienes clientes en Japón, Singapur, Tailandia, la India, Australia, Nueva Zelanda, Malasia o Corea del Sur?",
    helpText: "Cada una de estas jurisdicciones de Asia-Pacífico tiene su propia ley de protección de datos, con requisitos específicos.",
  },
  africa_middle_east: {
    question: "¿Operas o tienes clientes en Sudáfrica, Arabia Saudí, Nigeria o México?",
    helpText: "Estas jurisdicciones han aprobado leyes generales de protección de datos con requisitos de cumplimiento específicos.",
  },
  ai_systems_eu: {
    question: "¿Despliegas o suministras sistemas de IA en el mercado de la UE?",
    helpText:
      "El Reglamento de IA se aplica a los proveedores que introducen sistemas de IA en el mercado de la UE, a los responsables del despliegue que usan sistemas de IA en la UE y a los proveedores y responsables del despliegue de terceros países cuya información de salida se utiliza en la UE.",
  },
};
