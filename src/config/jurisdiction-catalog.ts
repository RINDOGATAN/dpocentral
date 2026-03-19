/**
 * Jurisdiction Catalog (Feature 6)
 * 40+ privacy jurisdictions with requirements, thresholds, and applicability criteria.
 *
 * Used by the Regulatory Tracker to determine which regulations apply to an
 * organization based on where they operate and whose data they process.
 */

// ============================================================
// TYPES
// ============================================================

export interface JurisdictionEntry {
  code: string;
  name: string;
  shortName: string;
  region: string;
  country: string;
  effectiveDate: string;
  dsarDeadlineDays: number;
  breachNotificationHours: number;
  description: string;
  keyRequirements: string[];
  applicabilityCriteria: string[];
  penalties: string;
  dpaName?: string;
  dpaUrl?: string;
  category: "comprehensive" | "sectoral" | "ai_governance" | "emerging";
}

export interface ApplicabilityQuestion {
  id: string;
  question: string;
  helpText: string;
  relevantJurisdictions: string[];
}

// ============================================================
// JURISDICTION CATALOG
// ============================================================

export const JURISDICTION_CATALOG: JurisdictionEntry[] = [
  // ----------------------------------------------------------
  // EU / EEA
  // ----------------------------------------------------------
  {
    code: "GDPR",
    name: "General Data Protection Regulation",
    shortName: "GDPR",
    region: "EU",
    country: "EU",
    effectiveDate: "2018-05-25",
    dsarDeadlineDays: 30,
    breachNotificationHours: 72,
    description:
      "The EU's comprehensive data protection regulation governing the processing of personal data of individuals within the European Economic Area.",
    keyRequirements: [
      "Lawful basis required for all processing activities",
      "Data Protection Impact Assessments for high-risk processing",
      "Mandatory appointment of a DPO for certain controllers/processors",
      "Data subject rights: access, rectification, erasure, portability, objection",
      "Records of processing activities (Article 30)",
    ],
    applicabilityCriteria: [
      "Process personal data of EU/EEA residents",
      "Established in the EU/EEA",
      "Offer goods or services to EU/EEA residents",
      "Monitor behavior of EU/EEA residents",
    ],
    penalties:
      "Up to EUR 20 million or 4% of global annual turnover, whichever is higher",
    dpaName: "European Data Protection Board (EDPB)",
    dpaUrl: "https://edpb.europa.eu",
    category: "comprehensive",
  },
  {
    code: "UK_GDPR",
    name: "UK General Data Protection Regulation",
    shortName: "UK GDPR",
    region: "UK",
    country: "GB",
    effectiveDate: "2021-01-01",
    dsarDeadlineDays: 30,
    breachNotificationHours: 72,
    description:
      "The UK's retained version of the GDPR, applicable after Brexit, governing personal data processing in the United Kingdom.",
    keyRequirements: [
      "Lawful basis required for processing (mirrors EU GDPR)",
      "Data Protection Impact Assessments for high-risk processing",
      "Mandatory DPO appointment for public authorities and large-scale processing",
      "International transfer mechanisms (UK adequacy decisions, UK SCCs)",
      "Records of processing activities",
    ],
    applicabilityCriteria: [
      "Process personal data of UK residents",
      "Established in the United Kingdom",
      "Offer goods or services to UK residents",
      "Monitor behavior of UK residents",
    ],
    penalties:
      "Up to GBP 17.5 million or 4% of global annual turnover, whichever is higher",
    dpaName: "Information Commissioner's Office (ICO)",
    dpaUrl: "https://ico.org.uk",
    category: "comprehensive",
  },
  {
    code: "FADP",
    name: "Federal Act on Data Protection (nDSG)",
    shortName: "FADP",
    region: "CH",
    country: "CH",
    effectiveDate: "2023-09-01",
    dsarDeadlineDays: 30,
    breachNotificationHours: 72,
    description:
      "Switzerland's revised Federal Act on Data Protection, modernized to align with the GDPR and maintain the EU adequacy decision.",
    keyRequirements: [
      "Privacy by design and by default obligations",
      "Data Protection Impact Assessments for high-risk processing",
      "Duty to inform data subjects about data collection",
      "Data breach notification to FDPIC without undue delay",
      "Data processing register for controllers with 250+ employees",
    ],
    applicabilityCriteria: [
      "Process personal data of persons in Switzerland",
      "Established in Switzerland",
      "Processing has effects in Switzerland",
    ],
    penalties:
      "Up to CHF 250,000 for individuals (criminal sanctions); no direct corporate fines",
    dpaName: "Federal Data Protection and Information Commissioner (FDPIC)",
    dpaUrl: "https://www.edoeb.admin.ch",
    category: "comprehensive",
  },

  // ----------------------------------------------------------
  // US STATES
  // ----------------------------------------------------------
  {
    code: "CPRA",
    name: "California Privacy Rights Act",
    shortName: "CPRA",
    region: "US-CA",
    country: "US",
    effectiveDate: "2023-01-01",
    dsarDeadlineDays: 45,
    breachNotificationHours: 0, // Separate breach notification statute
    description:
      "Amends and expands the CCPA, creating the California Privacy Protection Agency and adding rights like correction and limiting use of sensitive personal information.",
    keyRequirements: [
      "Right to know, delete, correct, and opt-out of sale/sharing",
      "Right to limit use of sensitive personal information",
      "Risk assessments for processing that presents significant risk",
      "Data minimization and purpose limitation principles",
      "Contractual requirements for service providers and contractors",
    ],
    applicabilityCriteria: [
      "Annual gross revenue over $25 million",
      "Buy, sell, or share personal information of 100,000+ California consumers/households",
      "Derive 50% or more of annual revenue from selling/sharing personal information",
    ],
    penalties:
      "Up to $2,500 per unintentional violation; $7,500 per intentional violation or violations involving minors",
    dpaName: "California Privacy Protection Agency (CPPA)",
    dpaUrl: "https://cppa.ca.gov",
    category: "comprehensive",
  },
  {
    code: "VCDPA",
    name: "Virginia Consumer Data Protection Act",
    shortName: "VCDPA",
    region: "US-VA",
    country: "US",
    effectiveDate: "2023-01-01",
    dsarDeadlineDays: 45,
    breachNotificationHours: 0,
    description:
      "Virginia's comprehensive consumer data privacy law granting residents rights over their personal data and imposing obligations on controllers.",
    keyRequirements: [
      "Consumer rights: access, correction, deletion, portability, opt-out",
      "Data protection assessments for targeted advertising, profiling, and sensitive data",
      "Purpose limitation and data minimization",
      "Opt-in consent for processing sensitive data",
      "Transparent privacy notices",
    ],
    applicabilityCriteria: [
      "Conduct business in Virginia or target Virginia residents",
      "Control or process personal data of 100,000+ Virginia consumers",
      "Control or process data of 25,000+ consumers and derive 50%+ revenue from sale",
    ],
    penalties:
      "Up to $7,500 per violation; enforced exclusively by the Attorney General",
    dpaName: "Virginia Attorney General",
    dpaUrl: "https://www.oag.state.va.us",
    category: "comprehensive",
  },
  {
    code: "CPA",
    name: "Colorado Privacy Act",
    shortName: "CPA",
    region: "US-CO",
    country: "US",
    effectiveDate: "2023-07-01",
    dsarDeadlineDays: 45,
    breachNotificationHours: 0,
    description:
      "Colorado's consumer privacy law with universal opt-out mechanism support and data protection assessment requirements.",
    keyRequirements: [
      "Consumer rights: access, correction, deletion, portability, opt-out",
      "Data protection assessments required",
      "Universal opt-out mechanism recognition",
      "Purpose specification and data minimization",
      "Consent for processing sensitive data",
    ],
    applicabilityCriteria: [
      "Conduct business in Colorado or target Colorado residents",
      "Control or process personal data of 100,000+ Colorado consumers",
      "Process data of 25,000+ consumers and derive revenue from sale of personal data",
    ],
    penalties:
      "Up to $20,000 per violation under the Colorado Consumer Protection Act",
    dpaName: "Colorado Attorney General",
    dpaUrl: "https://coag.gov",
    category: "comprehensive",
  },
  {
    code: "CTDPA",
    name: "Connecticut Data Privacy Act",
    shortName: "CTDPA",
    region: "US-CT",
    country: "US",
    effectiveDate: "2023-07-01",
    dsarDeadlineDays: 45,
    breachNotificationHours: 0,
    description:
      "Connecticut's consumer data privacy law requiring data protection assessments and recognition of universal opt-out mechanisms.",
    keyRequirements: [
      "Consumer rights: access, correction, deletion, portability, opt-out",
      "Data protection assessments for targeted advertising and profiling",
      "Universal opt-out signal recognition",
      "Consent for sensitive data processing",
      "Privacy notice with clear disclosures",
    ],
    applicabilityCriteria: [
      "Conduct business in Connecticut or target Connecticut residents",
      "Control or process personal data of 100,000+ Connecticut consumers",
      "Process data of 25,000+ consumers and derive 25%+ revenue from data sales",
    ],
    penalties:
      "Up to $5,000 per violation; enforced by the Attorney General under CUTPA",
    dpaName: "Connecticut Attorney General",
    dpaUrl: "https://portal.ct.gov/ag",
    category: "comprehensive",
  },
  {
    code: "UCPA",
    name: "Utah Consumer Privacy Act",
    shortName: "UCPA",
    region: "US-UT",
    country: "US",
    effectiveDate: "2023-12-31",
    dsarDeadlineDays: 45,
    breachNotificationHours: 0,
    description:
      "Utah's business-friendly consumer privacy law with narrower scope and no data protection assessment requirement.",
    keyRequirements: [
      "Consumer rights: access, deletion, portability, opt-out of sale and targeted advertising",
      "Transparent privacy notice required",
      "Consent for processing sensitive data",
      "No data protection assessment mandate",
      "30-day cure period for violations",
    ],
    applicabilityCriteria: [
      "Conduct business in Utah or target Utah residents",
      "Annual revenue of $25 million or more",
      "Control or process personal data of 100,000+ Utah consumers, or process data of 25,000+ consumers and derive 50%+ revenue from data sales",
    ],
    penalties:
      "Up to $7,500 per violation; enforced by the Attorney General",
    dpaName: "Utah Attorney General",
    dpaUrl: "https://attorneygeneral.utah.gov",
    category: "comprehensive",
  },
  {
    code: "ICDPA",
    name: "Iowa Consumer Data Protection Act",
    shortName: "ICDPA",
    region: "US-IA",
    country: "US",
    effectiveDate: "2025-01-01",
    dsarDeadlineDays: 90,
    breachNotificationHours: 0,
    description:
      "Iowa's consumer data protection law with a 90-day cure period and narrower consumer rights compared to other state laws.",
    keyRequirements: [
      "Consumer rights: access, deletion, portability, opt-out of sale and targeted advertising",
      "Consent for sensitive data processing",
      "90-day cure period for alleged violations",
      "Privacy notice disclosures",
      "No private right of action",
    ],
    applicabilityCriteria: [
      "Conduct business in Iowa or target Iowa residents",
      "Control or process personal data of 100,000+ Iowa consumers",
      "Process data of 25,000+ consumers and derive 50%+ revenue from data sales",
    ],
    penalties:
      "Up to $7,500 per violation; enforced by the Attorney General",
    dpaName: "Iowa Attorney General",
    dpaUrl: "https://www.iowaattorneygeneral.gov",
    category: "comprehensive",
  },
  {
    code: "TDPSA",
    name: "Texas Data Privacy and Security Act",
    shortName: "TDPSA",
    region: "US-TX",
    country: "US",
    effectiveDate: "2024-07-01",
    dsarDeadlineDays: 45,
    breachNotificationHours: 0,
    description:
      "Texas's comprehensive consumer privacy law with broad applicability (no revenue threshold) and data protection assessment requirements.",
    keyRequirements: [
      "Consumer rights: access, correction, deletion, portability, opt-out",
      "Data protection assessments for high-risk processing",
      "Universal opt-out mechanism recognition",
      "Consent for sensitive data processing",
      "Small business exemption for certain sale-of-data provisions",
    ],
    applicabilityCriteria: [
      "Conduct business in Texas or target Texas residents",
      "Process personal data of Texas residents",
      "Not classified as a small business under the SBA",
    ],
    penalties:
      "Up to $25,000 per violation; enforced by the Attorney General",
    dpaName: "Texas Attorney General",
    dpaUrl: "https://www.texasattorneygeneral.gov",
    category: "comprehensive",
  },
  {
    code: "FDBR",
    name: "Florida Digital Bill of Rights",
    shortName: "FDBR",
    region: "US-FL",
    country: "US",
    effectiveDate: "2024-07-01",
    dsarDeadlineDays: 45,
    breachNotificationHours: 0,
    description:
      "Florida's consumer privacy law targeting large businesses and including special provisions for children's data and technology companies.",
    keyRequirements: [
      "Consumer rights: access, correction, deletion, portability, opt-out",
      "Children's online safety provisions",
      "Restrictions on surveillance by large tech platforms",
      "Data protection assessments for high-risk processing",
      "45-day cure period",
    ],
    applicabilityCriteria: [
      "Conduct business in Florida",
      "Annual global gross revenue exceeding $1 billion",
      "Meet specific technology company or data-driven criteria",
    ],
    penalties:
      "Up to $50,000 per violation; triple damages for violations involving minors",
    dpaName: "Florida Department of Legal Affairs",
    dpaUrl: "https://www.myfloridalegal.com",
    category: "comprehensive",
  },
  {
    code: "MCDPA",
    name: "Montana Consumer Data Privacy Act",
    shortName: "MCDPA",
    region: "US-MT",
    country: "US",
    effectiveDate: "2024-10-01",
    dsarDeadlineDays: 45,
    breachNotificationHours: 0,
    description:
      "Montana's consumer data privacy law with the lowest population threshold among US state privacy laws (50,000 consumers).",
    keyRequirements: [
      "Consumer rights: access, correction, deletion, portability, opt-out",
      "Data protection assessments for targeted advertising and profiling",
      "Universal opt-out signal recognition",
      "Consent for sensitive data processing",
      "60-day cure period (sunsets July 2025)",
    ],
    applicabilityCriteria: [
      "Conduct business in Montana or target Montana residents",
      "Control or process personal data of 50,000+ Montana consumers",
      "Process data of 25,000+ consumers and derive 25%+ revenue from data sales",
    ],
    penalties:
      "Up to $7,500 per violation; enforced by the Attorney General",
    dpaName: "Montana Attorney General",
    dpaUrl: "https://dojmt.gov",
    category: "comprehensive",
  },
  {
    code: "OCPA",
    name: "Oregon Consumer Privacy Act",
    shortName: "OCPA",
    region: "US-OR",
    country: "US",
    effectiveDate: "2024-07-01",
    dsarDeadlineDays: 45,
    breachNotificationHours: 0,
    description:
      "Oregon's consumer privacy law with broad applicability including nonprofit organizations and strong consumer rights.",
    keyRequirements: [
      "Consumer rights: access, correction, deletion, portability, opt-out, list of third parties",
      "Data protection assessments required",
      "Applies to nonprofit organizations",
      "Consent for sensitive data processing including precise geolocation",
      "Right to obtain list of specific third parties receiving data",
    ],
    applicabilityCriteria: [
      "Conduct business in Oregon or target Oregon residents",
      "Control or process personal data of 100,000+ Oregon consumers",
      "Process data of 25,000+ consumers and derive 25%+ revenue from data sales",
    ],
    penalties:
      "Up to $7,500 per violation; enforced by the Attorney General",
    dpaName: "Oregon Attorney General",
    dpaUrl: "https://www.doj.state.or.us",
    category: "comprehensive",
  },
  {
    code: "TIPA",
    name: "Tennessee Information Protection Act",
    shortName: "TIPA",
    region: "US-TN",
    country: "US",
    effectiveDate: "2025-07-01",
    dsarDeadlineDays: 45,
    breachNotificationHours: 0,
    description:
      "Tennessee's consumer data protection law with an affirmative defense for organizations following NIST Privacy Framework.",
    keyRequirements: [
      "Consumer rights: access, correction, deletion, portability, opt-out",
      "Data protection assessments for high-risk processing",
      "Affirmative defense for NIST Privacy Framework compliance",
      "Consent for sensitive data processing",
      "60-day cure period",
    ],
    applicabilityCriteria: [
      "Conduct business in Tennessee or target Tennessee residents",
      "Annual revenue exceeding $25 million",
      "Control or process personal data of 175,000+ Tennessee consumers, or process data of 25,000+ consumers and derive 50%+ revenue from data sales",
    ],
    penalties:
      "Up to $7,500 per violation; enforced by the Attorney General",
    dpaName: "Tennessee Attorney General",
    dpaUrl: "https://www.tn.gov/attorneygeneral",
    category: "comprehensive",
  },
  {
    code: "INDPA",
    name: "Indiana Consumer Data Protection Act",
    shortName: "INDPA",
    region: "US-IN",
    country: "US",
    effectiveDate: "2026-01-01",
    dsarDeadlineDays: 45,
    breachNotificationHours: 0,
    description:
      "Indiana's consumer data protection law with standard consumer rights and a 30-day cure period.",
    keyRequirements: [
      "Consumer rights: access, correction, deletion, portability, opt-out",
      "Consent for sensitive data processing",
      "Data protection assessments for high-risk processing",
      "Privacy notice obligations",
      "30-day cure period for violations",
    ],
    applicabilityCriteria: [
      "Conduct business in Indiana or target Indiana residents",
      "Control or process personal data of 100,000+ Indiana consumers",
      "Process data of 25,000+ consumers and derive 50%+ revenue from data sales",
    ],
    penalties:
      "Up to $7,500 per violation; enforced by the Attorney General",
    dpaName: "Indiana Attorney General",
    dpaUrl: "https://www.in.gov/attorneygeneral",
    category: "comprehensive",
  },
  {
    code: "KCDPA",
    name: "Kentucky Consumer Data Protection Act",
    shortName: "KCDPA",
    region: "US-KY",
    country: "US",
    effectiveDate: "2026-01-01",
    dsarDeadlineDays: 45,
    breachNotificationHours: 0,
    description:
      "Kentucky's consumer data protection law modeled closely on the Virginia VCDPA with standard consumer rights.",
    keyRequirements: [
      "Consumer rights: access, correction, deletion, portability, opt-out",
      "Data protection assessments for targeted advertising, profiling, and sensitive data",
      "Consent for sensitive data processing",
      "Privacy notice requirements",
      "30-day cure period for violations",
    ],
    applicabilityCriteria: [
      "Conduct business in Kentucky or target Kentucky residents",
      "Control or process personal data of 100,000+ Kentucky consumers",
      "Process data of 25,000+ consumers and derive 50%+ revenue from data sales",
    ],
    penalties:
      "Up to $7,500 per violation; enforced by the Attorney General",
    dpaName: "Kentucky Attorney General",
    dpaUrl: "https://www.ag.ky.gov",
    category: "comprehensive",
  },
  {
    code: "NJDPA",
    name: "New Jersey Data Privacy Act",
    shortName: "NJDPA",
    region: "US-NJ",
    country: "US",
    effectiveDate: "2025-01-15",
    dsarDeadlineDays: 45,
    breachNotificationHours: 0,
    description:
      "New Jersey's comprehensive data privacy law with broad sensitive data definitions including financial and union membership data.",
    keyRequirements: [
      "Consumer rights: access, correction, deletion, portability, opt-out",
      "Data protection assessments for high-risk processing",
      "Broad definition of sensitive data (includes financial data)",
      "Universal opt-out mechanism recognition",
      "Consent for sensitive data processing",
    ],
    applicabilityCriteria: [
      "Conduct business in New Jersey or target New Jersey residents",
      "Control or process personal data of 100,000+ New Jersey consumers",
      "Process data of 25,000+ consumers and derive revenue from data sales",
    ],
    penalties:
      "Up to $10,000 per first violation; $20,000 for subsequent violations",
    dpaName: "New Jersey Division of Consumer Affairs",
    dpaUrl: "https://www.njconsumeraffairs.gov",
    category: "comprehensive",
  },
  {
    code: "NHDPA",
    name: "New Hampshire Data Privacy Act",
    shortName: "NHDPA",
    region: "US-NH",
    country: "US",
    effectiveDate: "2025-01-01",
    dsarDeadlineDays: 45,
    breachNotificationHours: 0,
    description:
      "New Hampshire's consumer data privacy law with standard consumer rights and protections modeled on Connecticut's CTDPA.",
    keyRequirements: [
      "Consumer rights: access, correction, deletion, portability, opt-out",
      "Data protection assessments for targeted advertising and profiling",
      "Universal opt-out signal recognition",
      "Consent for sensitive data processing",
      "60-day cure period",
    ],
    applicabilityCriteria: [
      "Conduct business in New Hampshire or target New Hampshire residents",
      "Control or process personal data of 35,000+ New Hampshire consumers",
      "Process data of 10,000+ consumers and derive 25%+ revenue from data sales",
    ],
    penalties:
      "Up to $10,000 per violation; enforced by the Attorney General",
    dpaName: "New Hampshire Attorney General",
    dpaUrl: "https://www.doj.nh.gov",
    category: "comprehensive",
  },
  {
    code: "DPDPA",
    name: "Delaware Personal Data Privacy Act",
    shortName: "DPDPA",
    region: "US-DE",
    country: "US",
    effectiveDate: "2025-01-01",
    dsarDeadlineDays: 45,
    breachNotificationHours: 0,
    description:
      "Delaware's comprehensive consumer privacy law with strong consumer rights and applicability to nonprofits.",
    keyRequirements: [
      "Consumer rights: access, correction, deletion, portability, opt-out",
      "Data protection assessments for high-risk processing",
      "Applies to nonprofit organizations",
      "Universal opt-out mechanism recognition",
      "Consent for sensitive data processing",
    ],
    applicabilityCriteria: [
      "Conduct business in Delaware or target Delaware residents",
      "Control or process personal data of 35,000+ Delaware consumers",
      "Process data of 10,000+ consumers and derive 20%+ revenue from data sales",
    ],
    penalties:
      "Up to $10,000 per violation; enforced by the Attorney General",
    dpaName: "Delaware Department of Justice",
    dpaUrl: "https://attorneygeneral.delaware.gov",
    category: "comprehensive",
  },
  {
    code: "MNDPA",
    name: "Minnesota Consumer Data Privacy Act",
    shortName: "MNDPA",
    region: "US-MN",
    country: "US",
    effectiveDate: "2025-07-31",
    dsarDeadlineDays: 45,
    breachNotificationHours: 0,
    description:
      "Minnesota's comprehensive privacy law with strong consumer rights including profiling protections and a private right of action for certain violations.",
    keyRequirements: [
      "Consumer rights: access, correction, deletion, portability, opt-out",
      "Right to question and challenge profiling decisions",
      "Data protection assessments required",
      "Data minimization and purpose limitation",
      "Processor-level obligations",
    ],
    applicabilityCriteria: [
      "Conduct business in Minnesota or target Minnesota residents",
      "Control or process personal data of 100,000+ Minnesota consumers",
      "Process data of 25,000+ consumers and derive 25%+ revenue from data sales",
    ],
    penalties:
      "Up to $7,500 per violation; limited private right of action for certain violations",
    dpaName: "Minnesota Attorney General",
    dpaUrl: "https://www.ag.state.mn.us",
    category: "comprehensive",
  },
  {
    code: "MODPA",
    name: "Maryland Online Data Privacy Act",
    shortName: "MODPA",
    region: "US-MD",
    country: "US",
    effectiveDate: "2025-10-01",
    dsarDeadlineDays: 45,
    breachNotificationHours: 0,
    description:
      "Maryland's strong consumer privacy law prohibiting sale of sensitive data, with robust data minimization requirements and children's protections.",
    keyRequirements: [
      "Prohibition on sale of sensitive data (not just opt-out)",
      "Strong data minimization: collection limited to what is reasonably necessary",
      "Consumer rights: access, correction, deletion, portability, opt-out",
      "Data protection assessments for high-risk processing",
      "Children's data protections",
    ],
    applicabilityCriteria: [
      "Conduct business in Maryland or target Maryland residents",
      "Control or process personal data of 35,000+ Maryland consumers",
      "Process data of 10,000+ consumers and derive 20%+ revenue from data sales",
    ],
    penalties:
      "Up to $10,000 per violation; $25,000 for subsequent violations; enforced by the Attorney General",
    dpaName: "Maryland Attorney General",
    dpaUrl: "https://www.marylandattorneygeneral.gov",
    category: "comprehensive",
  },
  {
    code: "NEDPA",
    name: "Nebraska Data Privacy Act",
    shortName: "NEDPA",
    region: "US-NE",
    country: "US",
    effectiveDate: "2025-01-01",
    dsarDeadlineDays: 45,
    breachNotificationHours: 0,
    description:
      "Nebraska's consumer data protection law with broad applicability (no revenue or volume threshold) modeled on the Texas TDPSA.",
    keyRequirements: [
      "Consumer rights: access, correction, deletion, portability, opt-out",
      "Data protection assessments for high-risk processing",
      "Universal opt-out mechanism recognition",
      "Consent for sensitive data processing",
      "30-day cure period for violations",
    ],
    applicabilityCriteria: [
      "Conduct business in Nebraska or target Nebraska residents",
      "Not classified as a small business under the SBA",
      "Process personal data of Nebraska residents",
    ],
    penalties:
      "Up to $7,500 per violation; enforced by the Attorney General",
    dpaName: "Nebraska Attorney General",
    dpaUrl: "https://ago.nebraska.gov",
    category: "comprehensive",
  },

  // ----------------------------------------------------------
  // AMERICAS (NON-US)
  // ----------------------------------------------------------
  {
    code: "LGPD",
    name: "Lei Geral de Protecao de Dados",
    shortName: "LGPD",
    region: "BR",
    country: "BR",
    effectiveDate: "2020-09-18",
    dsarDeadlineDays: 15,
    breachNotificationHours: 48,
    description:
      "Brazil's comprehensive data protection law modeled on the GDPR, establishing rights for data subjects and obligations for controllers and processors.",
    keyRequirements: [
      "Legal basis required for processing (10 legal bases defined)",
      "Data Protection Officer appointment mandatory",
      "Data subject rights: confirmation, access, correction, anonymization, portability, deletion",
      "Data breach notification to ANPD and data subjects within reasonable time",
      "Records of processing activities",
    ],
    applicabilityCriteria: [
      "Process personal data collected in Brazil",
      "Process data of individuals located in Brazil",
      "Offer goods or services to individuals in Brazil",
    ],
    penalties:
      "Up to 2% of revenue in Brazil, capped at BRL 50 million per infraction",
    dpaName: "Autoridade Nacional de Protecao de Dados (ANPD)",
    dpaUrl: "https://www.gov.br/anpd",
    category: "comprehensive",
  },
  {
    code: "PIPEDA",
    name: "Personal Information Protection and Electronic Documents Act",
    shortName: "PIPEDA",
    region: "CA",
    country: "CA",
    effectiveDate: "2000-01-01",
    dsarDeadlineDays: 30,
    breachNotificationHours: 0, // "As soon as feasible"
    description:
      "Canada's federal private-sector privacy law based on fair information principles, governing the collection, use, and disclosure of personal information.",
    keyRequirements: [
      "Consent required for collection, use, and disclosure of personal information",
      "10 fair information principles (accountability, purpose, consent, limiting collection, etc.)",
      "Mandatory breach reporting for breaches posing real risk of significant harm",
      "Right to access and challenge accuracy of personal information",
      "Accountability: designated privacy officer required",
    ],
    applicabilityCriteria: [
      "Collect, use, or disclose personal information in the course of commercial activities in Canada",
      "Federal works, undertakings, or businesses",
      "Interprovincial or international transfers of personal information",
    ],
    penalties:
      "Up to CAD 100,000 for certain offenses; Privacy Commissioner can refer to Federal Court",
    dpaName: "Office of the Privacy Commissioner of Canada (OPC)",
    dpaUrl: "https://www.priv.gc.ca",
    category: "comprehensive",
  },
  {
    code: "LFPDPPP",
    name: "Ley Federal de Proteccion de Datos Personales en Posesion de los Particulares",
    shortName: "LFPDPPP",
    region: "MX",
    country: "MX",
    effectiveDate: "2010-07-06",
    dsarDeadlineDays: 20,
    breachNotificationHours: 0, // "Immediately" upon awareness
    description:
      "Mexico's federal data protection law for the private sector, establishing ARCO rights (Access, Rectification, Cancellation, Opposition).",
    keyRequirements: [
      "ARCO rights: Access, Rectification, Cancellation, Opposition",
      "Privacy notice (aviso de privacidad) required before or at data collection",
      "Consent required (express consent for sensitive data, financial data)",
      "Data breach notification to data subjects without delay",
      "Cross-border transfer restrictions with accountability",
    ],
    applicabilityCriteria: [
      "Private-sector entities processing personal data in Mexico",
      "Process personal data of individuals in Mexico",
    ],
    penalties:
      "Fines from 100 to 320,000 times the daily minimum wage in Mexico City; imprisonment for certain violations",
    dpaName: "Instituto Nacional de Transparencia (INAI)",
    dpaUrl: "https://www.inai.org.mx",
    category: "comprehensive",
  },

  // ----------------------------------------------------------
  // ASIA-PACIFIC
  // ----------------------------------------------------------
  {
    code: "PIPL",
    name: "Personal Information Protection Law",
    shortName: "PIPL",
    region: "CN",
    country: "CN",
    effectiveDate: "2021-11-01",
    dsarDeadlineDays: 30,
    breachNotificationHours: 0, // "Immediately" to authorities
    description:
      "China's comprehensive personal information protection law with strict consent requirements, data localization, and cross-border transfer restrictions.",
    keyRequirements: [
      "Lawful basis with consent as primary basis; separate consent for sensitive data",
      "Personal Information Impact Assessments for high-risk processing",
      "Data localization for Critical Information Infrastructure Operators",
      "Cross-border transfers require security assessment, standard contract, or certification",
      "Designated representative required for foreign processors",
    ],
    applicabilityCriteria: [
      "Process personal information of individuals within China",
      "Analyze or evaluate behavior of individuals within China",
      "Offer products or services to individuals within China",
    ],
    penalties:
      "Up to RMB 50 million or 5% of annual revenue; personal liability for responsible individuals; app suspension or business license revocation",
    dpaName: "Cyberspace Administration of China (CAC)",
    dpaUrl: "http://www.cac.gov.cn",
    category: "comprehensive",
  },
  {
    code: "APPI",
    name: "Act on the Protection of Personal Information",
    shortName: "APPI",
    region: "JP",
    country: "JP",
    effectiveDate: "2022-04-01",
    dsarDeadlineDays: 30,
    breachNotificationHours: 72,
    description:
      "Japan's personal information protection law (as amended in 2022) with enhanced individual rights and stricter cross-border transfer rules.",
    keyRequirements: [
      "Purpose specification and use limitation",
      "Individual rights: disclosure, correction, cessation of use, deletion",
      "Mandatory breach notification to PPC and affected individuals",
      "Cross-border transfer with informed consent or equivalent protection",
      "Pseudonymized and anonymized data frameworks",
    ],
    applicabilityCriteria: [
      "Business operators handling personal information in Japan",
      "Process personal information of individuals in Japan",
    ],
    penalties:
      "Up to JPY 100 million for corporations; imprisonment up to 1 year or fines up to JPY 1 million for individuals",
    dpaName: "Personal Information Protection Commission (PPC)",
    dpaUrl: "https://www.ppc.go.jp",
    category: "comprehensive",
  },
  {
    code: "PDPA_SG",
    name: "Personal Data Protection Act (Singapore)",
    shortName: "PDPA (SG)",
    region: "SG",
    country: "SG",
    effectiveDate: "2014-07-02",
    dsarDeadlineDays: 30,
    breachNotificationHours: 72,
    description:
      "Singapore's data protection law governing the collection, use, disclosure, and care of personal data by private organizations.",
    keyRequirements: [
      "Consent obligation with exceptions for legitimate interests",
      "Purpose limitation and notification obligations",
      "Mandatory data breach notification for significant breaches",
      "Data portability obligation (effective 2024)",
      "Do Not Call Registry compliance",
    ],
    applicabilityCriteria: [
      "Organizations collecting, using, or disclosing personal data in Singapore",
      "Process personal data of individuals in Singapore",
    ],
    penalties:
      "Up to SGD 1 million or 10% of annual turnover (whichever is higher) for organizations",
    dpaName: "Personal Data Protection Commission (PDPC)",
    dpaUrl: "https://www.pdpc.gov.sg",
    category: "comprehensive",
  },
  {
    code: "PDPA_TH",
    name: "Personal Data Protection Act (Thailand)",
    shortName: "PDPA (TH)",
    region: "TH",
    country: "TH",
    effectiveDate: "2022-06-01",
    dsarDeadlineDays: 30,
    breachNotificationHours: 72,
    description:
      "Thailand's comprehensive data protection law modeled on the GDPR, establishing individual rights and controller/processor obligations.",
    keyRequirements: [
      "Lawful basis required (consent, contract, legitimate interest, etc.)",
      "Data subject rights: access, portability, objection, erasure, restriction",
      "Mandatory breach notification within 72 hours to authorities",
      "Cross-border transfer restrictions",
      "DPO appointment for certain controllers/processors",
    ],
    applicabilityCriteria: [
      "Collect, use, or disclose personal data in Thailand",
      "Offer goods or services to individuals in Thailand",
      "Monitor behavior of individuals in Thailand",
    ],
    penalties:
      "Administrative fines up to THB 5 million; criminal penalties up to THB 1 million and/or imprisonment up to 1 year; punitive damages up to double actual damages",
    dpaName: "Personal Data Protection Committee (PDPC Thailand)",
    dpaUrl: "https://www.pdpc.or.th",
    category: "comprehensive",
  },
  {
    code: "DPDPA_IN",
    name: "Digital Personal Data Protection Act",
    shortName: "DPDPA (India)",
    region: "IN",
    country: "IN",
    effectiveDate: "2024-08-11",
    dsarDeadlineDays: 30,
    breachNotificationHours: 72,
    description:
      "India's digital personal data protection law establishing consent-based processing, data fiduciary obligations, and a Data Protection Board.",
    keyRequirements: [
      "Consent-based processing with clear notice",
      "Data fiduciary obligations (purpose limitation, accuracy, storage limitation)",
      "Significant Data Fiduciary designation with additional obligations (DPO, audits)",
      "Data subject rights: access, correction, erasure, grievance redressal",
      "Cross-border transfers allowed except to government-restricted jurisdictions",
    ],
    applicabilityCriteria: [
      "Process digital personal data of individuals in India",
      "Offer goods or services to individuals in India",
      "Process personal data collected within India",
    ],
    penalties:
      "Up to INR 250 crore (approximately USD 30 million) per violation",
    dpaName: "Data Protection Board of India",
    dpaUrl: "https://www.meity.gov.in",
    category: "comprehensive",
  },
  {
    code: "PRIVACY_ACT_AU",
    name: "Privacy Act 1988 (Australia)",
    shortName: "Privacy Act (AU)",
    region: "AU",
    country: "AU",
    effectiveDate: "2014-03-12",
    dsarDeadlineDays: 30,
    breachNotificationHours: 720, // 30 days assessment + notification
    description:
      "Australia's federal privacy law establishing the Australian Privacy Principles (APPs) governing the handling of personal information by government agencies and large organizations.",
    keyRequirements: [
      "13 Australian Privacy Principles (APPs)",
      "Mandatory Notifiable Data Breaches scheme",
      "APP entity requirements: collection, use, disclosure, quality, security",
      "Cross-border disclosure restrictions (APP 8)",
      "Right to access and correction of personal information",
    ],
    applicabilityCriteria: [
      "Annual turnover of AUD 3 million or more",
      "Australian Government agencies",
      "Trade in personal information",
      "Health service providers, credit reporting bodies",
    ],
    penalties:
      "Up to AUD 50 million, or three times the benefit obtained, or 30% of adjusted turnover (whichever is greatest)",
    dpaName: "Office of the Australian Information Commissioner (OAIC)",
    dpaUrl: "https://www.oaic.gov.au",
    category: "comprehensive",
  },
  {
    code: "PRIVACY_ACT_NZ",
    name: "Privacy Act 2020 (New Zealand)",
    shortName: "Privacy Act (NZ)",
    region: "NZ",
    country: "NZ",
    effectiveDate: "2020-12-01",
    dsarDeadlineDays: 20,
    breachNotificationHours: 0, // "As soon as practicable"
    description:
      "New Zealand's privacy law establishing 13 Information Privacy Principles and mandatory breach notification, replacing the 1993 Act.",
    keyRequirements: [
      "13 Information Privacy Principles (IPPs)",
      "Mandatory notification of notifiable privacy breaches",
      "Cross-border disclosure restrictions",
      "Right to access and request correction of personal information",
      "Compliance notices and binding decisions by Privacy Commissioner",
    ],
    applicabilityCriteria: [
      "Agencies (organizations) collecting or holding personal information in New Zealand",
      "New Zealand-based organizations",
      "Organizations carrying on business in New Zealand",
    ],
    penalties:
      "Up to NZD 10,000 for failure to notify breaches; Human Rights Review Tribunal can award damages",
    dpaName: "Office of the Privacy Commissioner (OPC NZ)",
    dpaUrl: "https://www.privacy.org.nz",
    category: "comprehensive",
  },
  {
    code: "PDPA_MY",
    name: "Personal Data Protection Act 2010 (Malaysia)",
    shortName: "PDPA (MY)",
    region: "MY",
    country: "MY",
    effectiveDate: "2013-11-15",
    dsarDeadlineDays: 21,
    breachNotificationHours: 0, // Not currently mandatory (amendment pending)
    description:
      "Malaysia's personal data protection law governing the processing of personal data in commercial transactions by the private sector.",
    keyRequirements: [
      "7 Data Protection Principles (general, notice, disclosure, security, retention, data integrity, access)",
      "Consent required with clear notice",
      "Registration of data processors with Commissioner",
      "Cross-border transfer restrictions",
      "Right to access and correction of personal data",
    ],
    applicabilityCriteria: [
      "Process personal data in Malaysia for commercial transactions",
      "Use equipment in Malaysia for processing personal data",
    ],
    penalties:
      "Fines up to MYR 500,000 and/or imprisonment up to 3 years",
    dpaName: "Department of Personal Data Protection (JPDP)",
    dpaUrl: "https://www.pdp.gov.my",
    category: "comprehensive",
  },
  {
    code: "PIPA_KR",
    name: "Personal Information Protection Act (South Korea)",
    shortName: "PIPA",
    region: "KR",
    country: "KR",
    effectiveDate: "2023-09-15",
    dsarDeadlineDays: 10,
    breachNotificationHours: 72,
    description:
      "South Korea's comprehensive personal information protection law (as amended 2023) with strict requirements for consent, data transfers, and automated decision-making.",
    keyRequirements: [
      "Separate consent for each purpose; opt-in for marketing",
      "Data Protection Impact Assessments for public institutions",
      "Mandatory breach notification within 72 hours",
      "Cross-border transfer with consent or adequacy/safeguards",
      "Rights regarding automated decision-making (2023 amendment)",
    ],
    applicabilityCriteria: [
      "Process personal information of individuals in South Korea",
      "Operate business targeting South Korean residents",
    ],
    penalties:
      "Up to 3% of relevant revenue or KRW 2 billion for serious violations; criminal penalties including imprisonment",
    dpaName: "Personal Information Protection Commission (PIPC)",
    dpaUrl: "https://www.pipc.go.kr",
    category: "comprehensive",
  },

  // ----------------------------------------------------------
  // AFRICA / MIDDLE EAST
  // ----------------------------------------------------------
  {
    code: "POPIA",
    name: "Protection of Personal Information Act",
    shortName: "POPIA",
    region: "ZA",
    country: "ZA",
    effectiveDate: "2021-07-01",
    dsarDeadlineDays: 30,
    breachNotificationHours: 0, // "As soon as reasonably possible"
    description:
      "South Africa's comprehensive data protection law modeled on the GDPR, establishing conditions for lawful processing and an Information Regulator.",
    keyRequirements: [
      "8 conditions for lawful processing (accountability, purpose limitation, etc.)",
      "Mandatory Information Officer registration with the Regulator",
      "Data breach notification to Regulator and data subjects",
      "Cross-border transfer restrictions (adequate protection required)",
      "Data subject rights: access, correction, deletion, objection",
    ],
    applicabilityCriteria: [
      "Process personal information of individuals in South Africa",
      "Responsible parties domiciled in South Africa",
      "Use automated or non-automated means in South Africa to process data",
    ],
    penalties:
      "Fines up to ZAR 10 million and/or imprisonment up to 10 years",
    dpaName: "Information Regulator",
    dpaUrl: "https://inforegulator.org.za",
    category: "comprehensive",
  },
  {
    code: "PDPL_SA",
    name: "Personal Data Protection Law (Saudi Arabia)",
    shortName: "PDPL (SA)",
    region: "SA",
    country: "SA",
    effectiveDate: "2023-09-14",
    dsarDeadlineDays: 30,
    breachNotificationHours: 72,
    description:
      "Saudi Arabia's comprehensive personal data protection law establishing consent requirements, individual rights, and cross-border transfer rules.",
    keyRequirements: [
      "Consent required as primary legal basis",
      "Data subject rights: access, correction, destruction, portability",
      "Mandatory Data Protection Impact Assessments",
      "Data breach notification to SDAIA within 72 hours",
      "Data localization requirements (transfers need approval or adequacy)",
    ],
    applicabilityCriteria: [
      "Process personal data of individuals in Saudi Arabia",
      "Entities established in Saudi Arabia",
      "Offer goods or services to individuals in Saudi Arabia",
    ],
    penalties:
      "Fines up to SAR 5 million; imprisonment up to 2 years for certain violations; public disclosure of violations",
    dpaName: "Saudi Data and Artificial Intelligence Authority (SDAIA)",
    dpaUrl: "https://sdaia.gov.sa",
    category: "comprehensive",
  },
  {
    code: "NDPR",
    name: "Nigeria Data Protection Regulation",
    shortName: "NDPR",
    region: "NG",
    country: "NG",
    effectiveDate: "2023-06-12",
    dsarDeadlineDays: 30,
    breachNotificationHours: 72,
    description:
      "Nigeria's data protection framework (upgraded to Act in 2023) establishing the Nigeria Data Protection Commission and comprehensive data protection requirements.",
    keyRequirements: [
      "Lawful basis for processing (consent, contract, legal obligation, etc.)",
      "Data Protection Impact Assessments for high-risk processing",
      "Mandatory filing of annual data audit reports",
      "Breach notification within 72 hours to the Commission",
      "Registration of Data Protection Officers",
    ],
    applicabilityCriteria: [
      "Process personal data of individuals in Nigeria",
      "Offer goods or services to individuals in Nigeria",
      "Monitor behavior of individuals in Nigeria",
    ],
    penalties:
      "Up to 2% of annual gross revenue or NGN 10 million (whichever is greater) for data controllers processing 10,000+ data subjects",
    dpaName: "Nigeria Data Protection Commission (NDPC)",
    dpaUrl: "https://ndpc.gov.ng",
    category: "comprehensive",
  },

  // ----------------------------------------------------------
  // ADDITIONAL JURISDICTIONS
  // ----------------------------------------------------------
  {
    code: "PDPA_AR",
    name: "Personal Data Protection Act (Argentina)",
    shortName: "PDPA (AR)",
    region: "AR",
    country: "AR",
    effectiveDate: "2000-11-30",
    dsarDeadlineDays: 10,
    breachNotificationHours: 0,
    description:
      "Argentina's Personal Data Protection Act (Ley 25.326), one of the earliest comprehensive data protection laws in Latin America. Argentina holds an EU adequacy decision.",
    keyRequirements: [
      "Consent required for data processing with limited exceptions",
      "Data subject rights: access, rectification, suppression, confidentiality",
      "Registration of databases with the supervisory authority",
      "Cross-border transfer restrictions (adequacy or consent)",
      "Sensitive data processing requires additional safeguards",
    ],
    applicabilityCriteria: [
      "Process personal data of individuals in Argentina",
      "Databases or processing operations located in Argentina",
      "Transfer personal data from Argentina",
    ],
    penalties:
      "Administrative sanctions including warnings, fines, suspension, or closure of databases; criminal penalties for certain violations",
    dpaName: "Agencia de Acceso a la Informacion Publica (AAIP)",
    dpaUrl: "https://www.argentina.gob.ar/aaip",
    category: "comprehensive",
  },
  {
    code: "DPA_PH",
    name: "Data Privacy Act of 2012 (Philippines)",
    shortName: "DPA (PH)",
    region: "PH",
    country: "PH",
    effectiveDate: "2016-09-09",
    dsarDeadlineDays: 30,
    breachNotificationHours: 72,
    description:
      "The Philippines' comprehensive data privacy law establishing the National Privacy Commission and governing the processing of personal data in both government and private sectors.",
    keyRequirements: [
      "Adherence to principles of transparency, legitimate purpose, and proportionality",
      "Data subject rights: access, correction, erasure, portability, objection",
      "Mandatory registration of data processing systems with the NPC",
      "Breach notification to NPC and affected data subjects within 72 hours",
      "Data Protection Officer appointment for certain organizations",
    ],
    applicabilityCriteria: [
      "Process personal data of Philippine citizens or residents",
      "Offices, branches, or entities in the Philippines",
      "Use equipment located in the Philippines or maintain an office in the Philippines",
    ],
    penalties:
      "Imprisonment from 1 to 6 years and fines from PHP 500,000 to PHP 5 million depending on the offense",
    dpaName: "National Privacy Commission (NPC)",
    dpaUrl: "https://www.privacy.gov.ph",
    category: "comprehensive",
  },
  {
    code: "DPA_KE",
    name: "Data Protection Act 2019 (Kenya)",
    shortName: "DPA (KE)",
    region: "KE",
    country: "KE",
    effectiveDate: "2019-11-25",
    dsarDeadlineDays: 30,
    breachNotificationHours: 72,
    description:
      "Kenya's Data Protection Act establishing the Office of the Data Protection Commissioner and comprehensive data protection requirements for both public and private sector.",
    keyRequirements: [
      "Lawful basis for processing (consent, contract, legal obligation, vital interests, public interest, legitimate interest)",
      "Data subject rights: access, rectification, deletion, portability, objection",
      "Data Protection Impact Assessments for high-risk processing",
      "Mandatory breach notification within 72 hours to the Commissioner",
      "Registration of data controllers and processors with the Commissioner",
    ],
    applicabilityCriteria: [
      "Process personal data of individuals in Kenya",
      "Data controllers or processors established in Kenya",
      "Process personal data while using means located in Kenya",
    ],
    penalties:
      "Fines up to KES 5 million or imprisonment up to 10 years, or both; for body corporates, up to KES 5 million or 1% of annual turnover",
    dpaName: "Office of the Data Protection Commissioner (ODPC)",
    dpaUrl: "https://www.odpc.go.ke",
    category: "comprehensive",
  },

  // ----------------------------------------------------------
  // AI GOVERNANCE
  // ----------------------------------------------------------
  {
    code: "EU_AI_ACT",
    name: "EU Artificial Intelligence Act",
    shortName: "EU AI Act",
    region: "EU",
    country: "EU",
    effectiveDate: "2024-08-01",
    dsarDeadlineDays: 0,
    breachNotificationHours: 72,
    description:
      "The EU's comprehensive AI regulation establishing a risk-based framework for AI systems, with prohibitions on certain practices, strict requirements for high-risk systems, and transparency obligations.",
    keyRequirements: [
      "Risk classification of all AI systems (unacceptable, high, limited, minimal)",
      "Prohibited AI practices: social scoring, real-time biometric ID, manipulative techniques",
      "High-risk AI: conformity assessments, risk management, data governance, transparency",
      "Transparency obligations for AI-generated content and chatbots",
      "AI literacy requirements for deployers and providers",
    ],
    applicabilityCriteria: [
      "Deploy or provide AI systems in the EU market",
      "Output of AI system is used in the EU",
      "Provider or deployer established in the EU",
      "Provider in a third country where EU law applies by international law",
    ],
    penalties:
      "Up to EUR 35 million or 7% of global annual turnover for prohibited practices; EUR 15 million or 3% for other violations",
    dpaName: "EU AI Office + National Market Surveillance Authorities",
    dpaUrl: "https://digital-strategy.ec.europa.eu/en/policies/european-approach-artificial-intelligence",
    category: "ai_governance",
  },
];

// ============================================================
// APPLICABILITY QUESTIONS
// ============================================================

export const APPLICABILITY_QUESTIONS: ApplicabilityQuestion[] = [
  {
    id: "eu_residents",
    question: "Do you process personal data of EU/EEA residents?",
    helpText:
      "This includes customers, users, employees, or any individuals located in EU/EEA member states, even if your organization is not based in the EU.",
    relevantJurisdictions: ["GDPR"],
  },
  {
    id: "uk_presence",
    question:
      "Do you have customers, employees, or users in the United Kingdom?",
    helpText:
      "Since Brexit, the UK has its own data protection regime. This applies if you process data of UK residents or have a UK establishment.",
    relevantJurisdictions: ["UK_GDPR"],
  },
  {
    id: "switzerland_presence",
    question: "Do you process data of individuals in Switzerland?",
    helpText:
      "Switzerland has its own data protection law (nDSG/FADP) separate from the EU GDPR, though closely aligned.",
    relevantJurisdictions: ["FADP"],
  },
  {
    id: "california_consumers",
    question:
      "Do you have customers or users in California, or collect data of California residents?",
    helpText:
      "The CPRA applies to businesses meeting certain thresholds that collect personal information of California consumers.",
    relevantJurisdictions: ["CPRA"],
  },
  {
    id: "us_multistate",
    question:
      "Do you have customers or users across multiple US states?",
    helpText:
      "Many US states have enacted comprehensive privacy laws. Operating across states may trigger multiple state privacy obligations.",
    relevantJurisdictions: [
      "VCDPA",
      "CPA",
      "CTDPA",
      "UCPA",
      "ICDPA",
      "TDPSA",
      "FDBR",
      "MCDPA",
      "OCPA",
      "TIPA",
      "INDPA",
      "KCDPA",
      "NJDPA",
      "NHDPA",
      "DPDPA",
      "MNDPA",
      "MODPA",
      "NEDPA",
    ],
  },
  {
    id: "brazil_residents",
    question: "Do you process data of Brazilian residents?",
    helpText:
      "The LGPD applies to processing of personal data collected in Brazil or of individuals located in Brazil, regardless of where the processor is located.",
    relevantJurisdictions: ["LGPD"],
  },
  {
    id: "canada_commercial",
    question:
      "Do you collect or use personal information in commercial activities in Canada?",
    helpText:
      "PIPEDA applies to private-sector organizations collecting, using, or disclosing personal information in the course of commercial activities across provincial borders or in federal jurisdictions.",
    relevantJurisdictions: ["PIPEDA"],
  },
  {
    id: "china_data",
    question:
      "Do you process personal information of individuals in China or offer services to the Chinese market?",
    helpText:
      "China's PIPL has extraterritorial scope and applies to processing activities targeting or analyzing behavior of individuals in China.",
    relevantJurisdictions: ["PIPL"],
  },
  {
    id: "apac_presence",
    question:
      "Do you operate in or serve customers in Japan, Singapore, Thailand, India, Australia, New Zealand, Malaysia, or South Korea?",
    helpText:
      "Each of these Asia-Pacific jurisdictions has its own data protection law with specific requirements.",
    relevantJurisdictions: [
      "APPI",
      "PDPA_SG",
      "PDPA_TH",
      "DPDPA_IN",
      "PRIVACY_ACT_AU",
      "PRIVACY_ACT_NZ",
      "PDPA_MY",
      "PIPA_KR",
    ],
  },
  {
    id: "africa_middle_east",
    question:
      "Do you operate in or serve customers in South Africa, Saudi Arabia, Nigeria, or Mexico?",
    helpText:
      "These jurisdictions have enacted comprehensive data protection laws with specific compliance requirements.",
    relevantJurisdictions: ["POPIA", "PDPL_SA", "NDPR", "LFPDPPP"],
  },
  {
    id: "ai_systems_eu",
    question: "Do you deploy or provide AI systems in the EU market?",
    helpText:
      "The EU AI Act applies to providers placing AI systems on the EU market, deployers using AI systems in the EU, and providers/deployers in third countries whose AI output is used in the EU.",
    relevantJurisdictions: ["EU_AI_ACT"],
  },
];

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Given a set of answers to applicability questions, returns the
 * jurisdiction entries that are applicable to the organization.
 */
export function getApplicableJurisdictions(
  answers: Record<string, boolean>,
): JurisdictionEntry[] {
  const applicableCodes = new Set<string>();

  for (const question of APPLICABILITY_QUESTIONS) {
    if (answers[question.id]) {
      for (const code of question.relevantJurisdictions) {
        applicableCodes.add(code);
      }
    }
  }

  return JURISDICTION_CATALOG.filter((j) => applicableCodes.has(j.code));
}
