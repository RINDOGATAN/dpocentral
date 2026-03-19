/**
 * EU AI Act Risk Classifications (Feature 7)
 * Maps AI use cases to risk levels per the EU AI Act.
 *
 * Based on Regulation (EU) 2024/1689 of the European Parliament and of the
 * Council of 13 June 2024 laying down harmonised rules on artificial intelligence.
 */

// ============================================================
// TYPES
// ============================================================

export interface AIUseCase {
  id: string;
  name: string;
  description: string;
  riskLevel: "UNACCEPTABLE" | "HIGH_RISK" | "LIMITED" | "MINIMAL";
  category: string;
  annexReference?: string;
  obligations: string[];
  examples: string[];
}

export interface AIActCategory {
  id: string;
  name: string;
  description: string;
  useCases: AIUseCase[];
}

// ============================================================
// AI ACT CATEGORIES
// ============================================================

export const AI_ACT_CATEGORIES: AIActCategory[] = [
  // ----------------------------------------------------------
  // UNACCEPTABLE RISK (Article 5 — Prohibited AI Practices)
  // ----------------------------------------------------------
  {
    id: "unacceptable_risk",
    name: "Unacceptable Risk — Prohibited AI Practices",
    description:
      "AI practices that are prohibited under Article 5 of the EU AI Act because they pose an unacceptable risk to fundamental rights, safety, and democratic values. These systems may not be placed on the market, put into service, or used in the EU.",
    useCases: [
      {
        id: "social_scoring",
        name: "Social Scoring by Public Authorities",
        description:
          "AI systems used by public authorities or on their behalf to evaluate or classify individuals based on social behavior or personal characteristics, leading to detrimental or unfavorable treatment disproportionate to the context.",
        riskLevel: "UNACCEPTABLE",
        category: "unacceptable_risk",
        annexReference: "Article 5(1)(c)",
        obligations: [
          "Absolute prohibition — system may not be developed, placed on the market, or used in the EU",
          "Existing systems must be withdrawn from the EU market",
          "No exceptions or derogations available",
        ],
        examples: [
          "Government-run citizen trust score systems that restrict access to services based on aggregated behavioral data",
          "Municipal systems that rank residents based on social media activity to determine access to public housing",
          "Cross-agency profiling systems that combine tax, welfare, and criminal data to assign risk scores affecting benefits eligibility",
        ],
      },
      {
        id: "realtime_biometric_public",
        name: "Real-Time Remote Biometric Identification in Public Spaces",
        description:
          "Real-time remote biometric identification systems used in publicly accessible spaces for law enforcement purposes, with strictly limited exceptions for specific serious crimes, missing persons, and imminent threats.",
        riskLevel: "UNACCEPTABLE",
        category: "unacceptable_risk",
        annexReference: "Article 5(1)(h)",
        obligations: [
          "Prohibited except for three narrowly defined exceptions (missing children, imminent terrorist threat, specific serious crimes)",
          "Exceptions require prior judicial or independent administrative authorization",
          "Member States must notify the Commission and the European AI Board of intended use under exceptions",
        ],
        examples: [
          "Live facial recognition cameras in city centers to scan crowds against general criminal watchlists",
          "AI-powered CCTV networks performing continuous identity matching in shopping districts",
          "Stadium entry systems using real-time facial recognition against broad databases",
        ],
      },
      {
        id: "emotion_recognition_workplace_education",
        name: "Emotion Recognition in Workplace and Education",
        description:
          "AI systems that infer emotions of individuals in the workplace or educational institutions, except for medical or safety reasons.",
        riskLevel: "UNACCEPTABLE",
        category: "unacceptable_risk",
        annexReference: "Article 5(1)(f)",
        obligations: [
          "Prohibited in workplace and educational settings",
          "Exception only for systems placed on the market strictly for medical or safety reasons",
          "Existing deployments in these contexts must be discontinued",
        ],
        examples: [
          "Employee engagement monitoring tools using webcam-based emotion analysis during work",
          "Classroom attention-tracking systems that score student emotions and engagement via facial analysis",
          "Call center AI that evaluates employee emotional states to determine performance reviews",
        ],
      },
      {
        id: "predictive_policing_profiling",
        name: "Predictive Policing Based Solely on Profiling",
        description:
          "AI systems that make risk assessments of individuals for predicting criminal offenses based solely on profiling or personality traits, without objective and verifiable facts linked to criminal activity.",
        riskLevel: "UNACCEPTABLE",
        category: "unacceptable_risk",
        annexReference: "Article 5(1)(d)",
        obligations: [
          "Prohibited when based solely on profiling without objective verifiable facts",
          "Systems must not assess risk of offending based on traits, characteristics, or demographic data alone",
          "Law enforcement tools must be redesigned to rely on factual evidence rather than profiling",
        ],
        examples: [
          "AI systems predicting likelihood of criminal behavior based on neighborhood, age, and socioeconomic data",
          "Tools ranking individuals' probability of committing future crimes using personality assessments",
          "Systems using facial features or gait analysis to predict criminal propensity",
        ],
      },
      {
        id: "subliminal_manipulation",
        name: "Subliminal or Manipulative AI Techniques",
        description:
          "AI systems deploying subliminal techniques or purposefully manipulative or deceptive methods to materially distort behavior, causing or likely to cause significant harm.",
        riskLevel: "UNACCEPTABLE",
        category: "unacceptable_risk",
        annexReference: "Article 5(1)(a)",
        obligations: [
          "Absolute prohibition on deployment of manipulative or deceptive AI techniques",
          "Systems must not exploit vulnerabilities of specific groups (age, disability, social situation)",
          "No exceptions — development and distribution for EU use is prohibited",
        ],
        examples: [
          "AI systems using imperceptible audio or visual cues to influence purchasing decisions",
          "Dark pattern AI that exploits cognitive biases of elderly users to extract financial information",
          "Targeted persuasion systems exploiting mental health vulnerabilities to encourage harmful behavior",
        ],
      },
      {
        id: "biometric_scraping",
        name: "Untargeted Scraping of Facial Images",
        description:
          "AI systems that create or expand facial recognition databases through untargeted scraping of facial images from the internet or CCTV footage.",
        riskLevel: "UNACCEPTABLE",
        category: "unacceptable_risk",
        annexReference: "Article 5(1)(e)",
        obligations: [
          "Prohibited to create or expand facial recognition databases via untargeted scraping",
          "Applies to scraping from the internet and CCTV footage",
          "Existing databases built this way must not be used for AI systems in the EU",
        ],
        examples: [
          "Facial recognition services that scrape billions of social media photos without consent",
          "Law enforcement tools trained on images harvested from public CCTV feeds without targeted authorization",
          "Commercial identity verification services built on mass-scraped internet photos",
        ],
      },
    ],
  },

  // ----------------------------------------------------------
  // HIGH-RISK (Annex III)
  // ----------------------------------------------------------
  {
    id: "high_risk",
    name: "High-Risk AI Systems",
    description:
      "AI systems listed in Annex III of the EU AI Act that pose significant risks to health, safety, or fundamental rights. Providers and deployers must comply with extensive requirements including risk management, data governance, transparency, human oversight, and conformity assessments.",
    useCases: [
      {
        id: "biometric_remote",
        name: "Remote Biometric Identification (Non-Real-Time)",
        description:
          "AI systems intended for remote biometric identification of individuals (post-event or non-real-time), excluding verification/authentication systems that confirm a claimed identity.",
        riskLevel: "HIGH_RISK",
        category: "high_risk",
        annexReference: "Annex III, 1(a)",
        obligations: [
          "Conformity assessment by notified body (third-party audit) before placing on market",
          "Risk management system covering the full lifecycle",
          "High-quality training data with bias mitigation measures",
        ],
        examples: [
          "Post-event facial recognition used by law enforcement to identify suspects from recorded footage",
          "Biometric identification systems matching individuals against databases using body measurements",
          "Forensic video analysis tools using AI to identify persons of interest from archived CCTV",
        ],
      },
      {
        id: "biometric_categorization",
        name: "Biometric Categorization",
        description:
          "AI systems intended for biometric categorization of individuals based on sensitive or protected attributes (race, political opinions, religious beliefs, sexual orientation).",
        riskLevel: "HIGH_RISK",
        category: "high_risk",
        annexReference: "Annex III, 1(b)",
        obligations: [
          "Conformity assessment by notified body required",
          "Data governance ensuring non-discrimination",
          "Transparency and logging requirements for auditing categorization decisions",
        ],
        examples: [
          "Systems categorizing individuals by ethnicity or race from biometric data for demographic analysis",
          "AI tools inferring religious affiliation from physical appearance or behavioral patterns",
          "Gender classification systems used in targeted advertising based on biometric features",
        ],
      },
      {
        id: "critical_infrastructure",
        name: "Critical Infrastructure Management",
        description:
          "AI systems intended as safety components in the management and operation of critical digital and physical infrastructure (energy, transport, water, gas, heating, internet).",
        riskLevel: "HIGH_RISK",
        category: "high_risk",
        annexReference: "Annex III, 2(a)",
        obligations: [
          "Risk management system with continuous monitoring",
          "Human oversight mechanisms to override autonomous decisions",
          "Robustness and cybersecurity measures against adversarial attacks",
        ],
        examples: [
          "AI controlling traffic management systems in smart cities",
          "Power grid load balancing systems using AI for autonomous switching decisions",
          "Water treatment plant AI systems autonomously adjusting chemical dosing levels",
        ],
      },
      {
        id: "education_access",
        name: "Education — Access and Admission",
        description:
          "AI systems used to determine access to or admission into educational and vocational training institutions.",
        riskLevel: "HIGH_RISK",
        category: "high_risk",
        annexReference: "Annex III, 3(a)",
        obligations: [
          "Transparency: students and parents must be informed AI is used in admission decisions",
          "Data quality requirements: training data must be representative and free of discriminatory bias",
          "Human oversight: meaningful human review of AI-assisted admission decisions",
        ],
        examples: [
          "University admission systems that rank or filter applicants using AI algorithms",
          "AI tools screening vocational training applications to determine eligibility",
          "Student placement systems using AI to assign students to programs or tracks",
        ],
      },
      {
        id: "education_assessment",
        name: "Education — Assessment and Monitoring",
        description:
          "AI systems used to evaluate learning outcomes, including AI directing the learning process and monitoring student behavior during tests.",
        riskLevel: "HIGH_RISK",
        category: "high_risk",
        annexReference: "Annex III, 3(b)",
        obligations: [
          "Accuracy and reliability validation for assessment AI",
          "Protection of student data and privacy",
          "Meaningful human oversight of AI-driven evaluations with ability to override",
        ],
        examples: [
          "AI-powered exam proctoring systems that monitor student behavior and flag suspected cheating",
          "Automated essay grading systems that determine final marks",
          "Adaptive learning platforms that autonomously control curriculum progression based on AI assessment",
        ],
      },
      {
        id: "employment_recruitment",
        name: "Employment — Recruitment and Selection",
        description:
          "AI systems used for recruitment, screening, filtering, or evaluating candidates in the hiring process.",
        riskLevel: "HIGH_RISK",
        category: "high_risk",
        annexReference: "Annex III, 4(a)",
        obligations: [
          "Non-discrimination auditing: regular bias testing across protected characteristics",
          "Transparency to candidates: clear disclosure that AI is used in the hiring process",
          "Data governance: training data must be representative and regularly reviewed",
        ],
        examples: [
          "AI resume screening tools that rank or filter job applicants",
          "Video interview analysis systems assessing candidate suitability using facial expressions or speech patterns",
          "Automated candidate sourcing tools that score and rank potential candidates from job boards",
        ],
      },
      {
        id: "employment_performance",
        name: "Employment — Performance Evaluation and Task Allocation",
        description:
          "AI systems used to make or materially influence decisions on promotion, termination, task allocation, or monitoring/evaluating employee performance and behavior.",
        riskLevel: "HIGH_RISK",
        category: "high_risk",
        annexReference: "Annex III, 4(b)",
        obligations: [
          "Human oversight: HR decisions must involve meaningful human review",
          "Transparency to employees: clear information about AI monitoring and evaluation",
          "Impact assessments considering employee rights and working conditions",
        ],
        examples: [
          "AI systems scoring employee performance to determine promotions or terminations",
          "Algorithmic task allocation in warehouses or gig platforms that determines worker assignments",
          "Employee productivity monitoring tools using AI to flag underperformance for disciplinary action",
        ],
      },
      {
        id: "essential_services_credit",
        name: "Access to Essential Services — Credit Scoring",
        description:
          "AI systems used to evaluate the creditworthiness of individuals or establish their credit score, with the exception of fraud detection.",
        riskLevel: "HIGH_RISK",
        category: "high_risk",
        annexReference: "Annex III, 5(a)",
        obligations: [
          "Explainability: individuals must be able to understand the factors influencing their credit score",
          "Non-discrimination: regular audits for bias across protected characteristics",
          "Right to human review of automated credit decisions",
        ],
        examples: [
          "AI-based credit scoring models that determine loan eligibility for consumers",
          "Alternative credit scoring systems using social data or behavioral signals",
          "Automated mortgage pre-approval systems using AI risk assessment",
        ],
      },
      {
        id: "essential_services_insurance",
        name: "Access to Essential Services — Insurance and Benefits",
        description:
          "AI systems used for risk assessment and pricing in life and health insurance, and for evaluating eligibility for social benefits and services.",
        riskLevel: "HIGH_RISK",
        category: "high_risk",
        annexReference: "Annex III, 5(b)",
        obligations: [
          "Transparency: individuals must be informed of AI use in insurance decisions",
          "Non-discrimination: bias auditing for health and socioeconomic factors",
          "Proportionality: AI decisions must be proportionate and explainable",
        ],
        examples: [
          "Health insurance underwriting AI that determines premiums based on lifestyle and health data analysis",
          "Social benefit eligibility systems that automatically assess welfare applications",
          "Life insurance risk models using AI to predict mortality based on personal data",
        ],
      },
      {
        id: "law_enforcement_evidence",
        name: "Law Enforcement — Evidence Assessment",
        description:
          "AI systems intended for use by law enforcement to assess the reliability of evidence in criminal investigations or prosecutions.",
        riskLevel: "HIGH_RISK",
        category: "high_risk",
        annexReference: "Annex III, 6(a)",
        obligations: [
          "Accuracy validation: systems must be tested for reliability and error rates",
          "Human oversight: AI evidence assessment must be reviewed by qualified personnel",
          "Logging: all AI-assisted evidence assessments must be recorded for audit",
        ],
        examples: [
          "AI tools analyzing digital forensic evidence to assess authenticity and relevance",
          "Natural language processing systems reviewing large document sets for evidentiary value",
          "AI-assisted polygraph or statement analysis tools used during investigations",
        ],
      },
      {
        id: "law_enforcement_risk",
        name: "Law Enforcement — Individual Risk Assessment",
        description:
          "AI systems used by law enforcement for assessing the risk of individuals offending or re-offending, or the risk of becoming a victim.",
        riskLevel: "HIGH_RISK",
        category: "high_risk",
        annexReference: "Annex III, 6(b)",
        obligations: [
          "Non-discrimination: must not rely solely on profiling or protected characteristics",
          "Human oversight: risk assessments must be reviewed by qualified law enforcement personnel",
          "Regular accuracy and bias audits",
        ],
        examples: [
          "Recidivism prediction tools used in parole and sentencing decisions",
          "AI systems assessing the risk of domestic violence for protective order decisions",
          "Victim risk assessment tools used to prioritize case resource allocation",
        ],
      },
      {
        id: "migration_document",
        name: "Migration and Border — Document Verification",
        description:
          "AI systems used to assist in the examination of applications for asylum, visa, and residence permits, and for document authenticity verification.",
        riskLevel: "HIGH_RISK",
        category: "high_risk",
        annexReference: "Annex III, 7(a)",
        obligations: [
          "Accuracy: high reliability standards for document verification to prevent false rejections",
          "Non-discrimination: must not discriminate based on nationality, ethnicity, or country of origin",
          "Human review: decisions affecting asylum and visa applications must involve human decision-makers",
        ],
        examples: [
          "AI document verification systems at border control checking passport and visa authenticity",
          "Automated asylum application screening systems that assess initial eligibility",
          "AI-powered identity document analysis for immigration processing",
        ],
      },
      {
        id: "migration_risk",
        name: "Migration and Border — Risk Assessment",
        description:
          "AI systems used for assessing security, irregular migration, or health risks posed by individuals intending to enter or having entered the territory of a Member State.",
        riskLevel: "HIGH_RISK",
        category: "high_risk",
        annexReference: "Annex III, 7(b)",
        obligations: [
          "Fundamental rights impact assessment before deployment",
          "Transparency to individuals about the use of AI in risk assessment",
          "Regular monitoring for discriminatory outcomes",
        ],
        examples: [
          "AI risk profiling systems at borders that flag travelers based on travel pattern analysis",
          "Health screening AI at ports of entry that assess risk of communicable disease",
          "Security risk assessment AI used for visa applicant background screening",
        ],
      },
      {
        id: "justice_legal",
        name: "Administration of Justice — Legal Interpretation",
        description:
          "AI systems intended to assist judicial authorities in researching and interpreting facts and law and in applying the law to concrete facts, or in alternative dispute resolution.",
        riskLevel: "HIGH_RISK",
        category: "high_risk",
        annexReference: "Annex III, 8(a)",
        obligations: [
          "Transparency: parties must be informed when AI is used in judicial processes",
          "Human oversight: judges must retain full decision-making authority",
          "Accuracy and reliability validation with regular testing",
        ],
        examples: [
          "AI legal research tools used by courts to identify relevant case law and precedent",
          "Sentencing recommendation systems that suggest penalty ranges based on case factors",
          "AI-assisted alternative dispute resolution platforms that propose settlement terms",
        ],
      },
    ],
  },

  // ----------------------------------------------------------
  // LIMITED RISK (Transparency Obligations — Article 50)
  // ----------------------------------------------------------
  {
    id: "limited_risk",
    name: "Limited Risk — Transparency Obligations",
    description:
      "AI systems that require specific transparency measures under Article 50. Users must be informed they are interacting with AI, and AI-generated content must be labeled as such.",
    useCases: [
      {
        id: "chatbots_conversational",
        name: "Chatbots and Conversational AI",
        description:
          "AI systems designed to interact with individuals through natural language, including customer service chatbots, virtual assistants, and conversational agents.",
        riskLevel: "LIMITED",
        category: "limited_risk",
        annexReference: "Article 50(1)",
        obligations: [
          "Clear disclosure to users that they are interacting with an AI system (not a human)",
          "Provide option to request transfer to a human operator when applicable",
          "Maintain records of AI interactions for transparency and accountability",
        ],
        examples: [
          "Customer service chatbots on e-commerce websites",
          "AI-powered virtual assistants for internal employee support",
          "Conversational AI for healthcare appointment scheduling and triage",
        ],
      },
      {
        id: "emotion_recognition_permitted",
        name: "Emotion Recognition Systems (Non-Prohibited Contexts)",
        description:
          "AI systems that detect or infer emotions or intentions of individuals in contexts not covered by the prohibition (i.e., outside workplace and education, or for medical/safety reasons).",
        riskLevel: "LIMITED",
        category: "limited_risk",
        annexReference: "Article 50(3)",
        obligations: [
          "Inform individuals that an emotion recognition system is in operation",
          "Obtain consent where required under applicable data protection law",
          "Provide clear information about the purpose and scope of emotion detection",
        ],
        examples: [
          "Emotion-aware automotive safety systems detecting driver drowsiness or distraction",
          "Medical diagnostic tools using facial expression analysis for pain assessment",
          "Accessibility tools detecting user frustration to offer additional help",
        ],
      },
      {
        id: "deepfakes",
        name: "Deep Fake Generation",
        description:
          "AI systems that generate or manipulate image, audio, or video content that appreciably resembles existing persons, objects, places, or events and would falsely appear authentic (deep fakes).",
        riskLevel: "LIMITED",
        category: "limited_risk",
        annexReference: "Article 50(4)",
        obligations: [
          "Label all AI-generated or manipulated content as artificially generated or manipulated in a machine-readable format",
          "Disclosure must be clearly visible and understandable to the recipient",
          "Exception for legitimate artistic, satirical, or fictional purposes where the context makes the synthetic nature evident",
        ],
        examples: [
          "AI face-swapping tools used in entertainment and media production",
          "Voice cloning software generating speech in someone else's voice",
          "AI-generated video content depicting realistic scenarios with synthetic persons",
        ],
      },
      {
        id: "ai_generated_content",
        name: "AI-Generated Text and Media Content",
        description:
          "AI systems that generate text, images, audio, or video content published to inform the public on matters of public interest, which must be labeled as AI-generated.",
        riskLevel: "LIMITED",
        category: "limited_risk",
        annexReference: "Article 50(2)",
        obligations: [
          "Mark output as AI-generated in a machine-readable format",
          "Labeling must be clear and distinguishable for content on matters of public interest",
          "Technical solutions for provenance detection must be effective, interoperable, and robust",
        ],
        examples: [
          "AI-generated news summaries or articles published on media platforms",
          "AI-created marketing images and product descriptions",
          "Automated financial or sports reporting generated by AI systems",
        ],
      },
    ],
  },

  // ----------------------------------------------------------
  // MINIMAL RISK
  // ----------------------------------------------------------
  {
    id: "minimal_risk",
    name: "Minimal Risk — No Specific Obligations",
    description:
      "AI systems that pose minimal risk to fundamental rights or safety. The vast majority of AI systems in use today fall into this category. No specific regulatory obligations, though voluntary codes of conduct are encouraged.",
    useCases: [
      {
        id: "spam_filters",
        name: "Spam Filters and Content Moderation",
        description:
          "AI systems used to detect and filter spam, unwanted communications, or low-risk content categorization.",
        riskLevel: "MINIMAL",
        category: "minimal_risk",
        obligations: [
          "No mandatory obligations under the AI Act",
          "Encouraged to adopt voluntary codes of conduct",
          "General product safety and consumer protection laws still apply",
        ],
        examples: [
          "Email spam detection and filtering systems",
          "AI-powered comment moderation on social media platforms",
          "Automated categorization of support tickets by topic",
        ],
      },
      {
        id: "ai_gaming",
        name: "AI-Enabled Video Games",
        description:
          "AI systems used in video games for NPC behavior, procedural content generation, difficulty adaptation, and game testing.",
        riskLevel: "MINIMAL",
        category: "minimal_risk",
        obligations: [
          "No mandatory obligations under the AI Act",
          "Standard consumer protection laws apply",
          "Encouraged to adopt voluntary codes of conduct for responsible AI use",
        ],
        examples: [
          "NPC behavior and decision-making AI in role-playing games",
          "Procedural level and content generation for game environments",
          "Adaptive difficulty systems that adjust game challenge based on player performance",
        ],
      },
      {
        id: "inventory_management",
        name: "Inventory Management and Supply Chain Optimization",
        description:
          "AI systems used for demand forecasting, inventory optimization, warehouse management, and supply chain logistics.",
        riskLevel: "MINIMAL",
        category: "minimal_risk",
        obligations: [
          "No mandatory obligations under the AI Act",
          "Standard business regulations and sector-specific rules continue to apply",
          "Encouraged to follow voluntary AI ethics guidelines",
        ],
        examples: [
          "AI demand forecasting systems predicting product sales volumes",
          "Automated warehouse robot coordination and path optimization",
          "Supply chain AI optimizing logistics routes and delivery schedules",
        ],
      },
      {
        id: "recommendation_engines",
        name: "Product and Content Recommendation Engines",
        description:
          "AI systems that suggest products, content, or services to users based on preferences and behavior patterns.",
        riskLevel: "MINIMAL",
        category: "minimal_risk",
        obligations: [
          "No mandatory obligations under the AI Act (unless combined with profiling that triggers other regulations)",
          "Data protection obligations under GDPR still apply to personal data processing",
          "Voluntary transparency about AI-driven recommendations is encouraged",
        ],
        examples: [
          "E-commerce product recommendation systems suggesting related items",
          "Music and video streaming content suggestions based on listening/viewing history",
          "News article recommendation algorithms on media platforms",
        ],
      },
      {
        id: "search_optimization",
        name: "Search and Optimization Algorithms",
        description:
          "AI systems used for search relevance ranking, query understanding, and general-purpose optimization that do not impact fundamental rights.",
        riskLevel: "MINIMAL",
        category: "minimal_risk",
        obligations: [
          "No mandatory obligations under the AI Act",
          "Competition law and Digital Services Act obligations may apply separately",
          "Encouraged to maintain transparency about ranking criteria",
        ],
        examples: [
          "Internal enterprise search engines using AI for relevance ranking",
          "Route optimization algorithms for navigation applications",
          "AI-powered code autocompletion and developer productivity tools",
        ],
      },
    ],
  },
];

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/** Keywords mapped to risk levels and specific use case IDs for matching. */
const RISK_KEYWORDS: Record<
  string,
  { riskLevel: AIUseCase["riskLevel"]; useCaseId: string; weight: number }[]
> = {
  // Unacceptable
  "social scoring": [{ riskLevel: "UNACCEPTABLE", useCaseId: "social_scoring", weight: 10 }],
  "social credit": [{ riskLevel: "UNACCEPTABLE", useCaseId: "social_scoring", weight: 10 }],
  "citizen score": [{ riskLevel: "UNACCEPTABLE", useCaseId: "social_scoring", weight: 10 }],
  "real-time biometric": [{ riskLevel: "UNACCEPTABLE", useCaseId: "realtime_biometric_public", weight: 10 }],
  "live facial recognition": [{ riskLevel: "UNACCEPTABLE", useCaseId: "realtime_biometric_public", weight: 10 }],
  "emotion recognition workplace": [{ riskLevel: "UNACCEPTABLE", useCaseId: "emotion_recognition_workplace_education", weight: 10 }],
  "emotion detection employee": [{ riskLevel: "UNACCEPTABLE", useCaseId: "emotion_recognition_workplace_education", weight: 10 }],
  "emotion recognition school": [{ riskLevel: "UNACCEPTABLE", useCaseId: "emotion_recognition_workplace_education", weight: 10 }],
  "predictive policing": [{ riskLevel: "UNACCEPTABLE", useCaseId: "predictive_policing_profiling", weight: 10 }],
  subliminal: [{ riskLevel: "UNACCEPTABLE", useCaseId: "subliminal_manipulation", weight: 10 }],
  manipulative: [{ riskLevel: "UNACCEPTABLE", useCaseId: "subliminal_manipulation", weight: 8 }],
  "facial scraping": [{ riskLevel: "UNACCEPTABLE", useCaseId: "biometric_scraping", weight: 10 }],
  "face scraping": [{ riskLevel: "UNACCEPTABLE", useCaseId: "biometric_scraping", weight: 10 }],

  // High risk
  "biometric identification": [{ riskLevel: "HIGH_RISK", useCaseId: "biometric_remote", weight: 8 }],
  "facial recognition": [{ riskLevel: "HIGH_RISK", useCaseId: "biometric_remote", weight: 7 }],
  "biometric categorization": [{ riskLevel: "HIGH_RISK", useCaseId: "biometric_categorization", weight: 9 }],
  "critical infrastructure": [{ riskLevel: "HIGH_RISK", useCaseId: "critical_infrastructure", weight: 9 }],
  "power grid": [{ riskLevel: "HIGH_RISK", useCaseId: "critical_infrastructure", weight: 8 }],
  "traffic management": [{ riskLevel: "HIGH_RISK", useCaseId: "critical_infrastructure", weight: 8 }],
  "water treatment": [{ riskLevel: "HIGH_RISK", useCaseId: "critical_infrastructure", weight: 8 }],
  admission: [{ riskLevel: "HIGH_RISK", useCaseId: "education_access", weight: 7 }],
  enrollment: [{ riskLevel: "HIGH_RISK", useCaseId: "education_access", weight: 7 }],
  "student assessment": [{ riskLevel: "HIGH_RISK", useCaseId: "education_assessment", weight: 8 }],
  "exam proctoring": [{ riskLevel: "HIGH_RISK", useCaseId: "education_assessment", weight: 9 }],
  grading: [{ riskLevel: "HIGH_RISK", useCaseId: "education_assessment", weight: 7 }],
  recruitment: [{ riskLevel: "HIGH_RISK", useCaseId: "employment_recruitment", weight: 8 }],
  hiring: [{ riskLevel: "HIGH_RISK", useCaseId: "employment_recruitment", weight: 8 }],
  "resume screening": [{ riskLevel: "HIGH_RISK", useCaseId: "employment_recruitment", weight: 9 }],
  "cv screening": [{ riskLevel: "HIGH_RISK", useCaseId: "employment_recruitment", weight: 9 }],
  "employee performance": [{ riskLevel: "HIGH_RISK", useCaseId: "employment_performance", weight: 8 }],
  "task allocation": [{ riskLevel: "HIGH_RISK", useCaseId: "employment_performance", weight: 8 }],
  "worker monitoring": [{ riskLevel: "HIGH_RISK", useCaseId: "employment_performance", weight: 8 }],
  "credit scoring": [{ riskLevel: "HIGH_RISK", useCaseId: "essential_services_credit", weight: 9 }],
  creditworthiness: [{ riskLevel: "HIGH_RISK", useCaseId: "essential_services_credit", weight: 9 }],
  "loan approval": [{ riskLevel: "HIGH_RISK", useCaseId: "essential_services_credit", weight: 8 }],
  "insurance underwriting": [{ riskLevel: "HIGH_RISK", useCaseId: "essential_services_insurance", weight: 9 }],
  "insurance risk": [{ riskLevel: "HIGH_RISK", useCaseId: "essential_services_insurance", weight: 8 }],
  "social benefits": [{ riskLevel: "HIGH_RISK", useCaseId: "essential_services_insurance", weight: 8 }],
  "welfare eligibility": [{ riskLevel: "HIGH_RISK", useCaseId: "essential_services_insurance", weight: 8 }],
  "evidence assessment": [{ riskLevel: "HIGH_RISK", useCaseId: "law_enforcement_evidence", weight: 8 }],
  "digital forensics": [{ riskLevel: "HIGH_RISK", useCaseId: "law_enforcement_evidence", weight: 8 }],
  recidivism: [{ riskLevel: "HIGH_RISK", useCaseId: "law_enforcement_risk", weight: 9 }],
  sentencing: [{ riskLevel: "HIGH_RISK", useCaseId: "law_enforcement_risk", weight: 8 }],
  "border control": [{ riskLevel: "HIGH_RISK", useCaseId: "migration_document", weight: 8 }],
  "visa processing": [{ riskLevel: "HIGH_RISK", useCaseId: "migration_document", weight: 8 }],
  asylum: [{ riskLevel: "HIGH_RISK", useCaseId: "migration_document", weight: 8 }],
  "immigration screening": [{ riskLevel: "HIGH_RISK", useCaseId: "migration_risk", weight: 8 }],
  "legal research": [{ riskLevel: "HIGH_RISK", useCaseId: "justice_legal", weight: 7 }],
  "judicial decision": [{ riskLevel: "HIGH_RISK", useCaseId: "justice_legal", weight: 8 }],
  "dispute resolution": [{ riskLevel: "HIGH_RISK", useCaseId: "justice_legal", weight: 7 }],

  // Limited risk
  chatbot: [{ riskLevel: "LIMITED", useCaseId: "chatbots_conversational", weight: 7 }],
  "virtual assistant": [{ riskLevel: "LIMITED", useCaseId: "chatbots_conversational", weight: 7 }],
  "conversational ai": [{ riskLevel: "LIMITED", useCaseId: "chatbots_conversational", weight: 8 }],
  "customer service ai": [{ riskLevel: "LIMITED", useCaseId: "chatbots_conversational", weight: 7 }],
  "emotion detection": [{ riskLevel: "LIMITED", useCaseId: "emotion_recognition_permitted", weight: 6 }],
  "emotion recognition": [{ riskLevel: "LIMITED", useCaseId: "emotion_recognition_permitted", weight: 6 }],
  deepfake: [{ riskLevel: "LIMITED", useCaseId: "deepfakes", weight: 9 }],
  "deep fake": [{ riskLevel: "LIMITED", useCaseId: "deepfakes", weight: 9 }],
  "face swap": [{ riskLevel: "LIMITED", useCaseId: "deepfakes", weight: 8 }],
  "voice cloning": [{ riskLevel: "LIMITED", useCaseId: "deepfakes", weight: 8 }],
  "ai generated content": [{ riskLevel: "LIMITED", useCaseId: "ai_generated_content", weight: 7 }],
  "synthetic media": [{ riskLevel: "LIMITED", useCaseId: "ai_generated_content", weight: 7 }],
  "ai writing": [{ riskLevel: "LIMITED", useCaseId: "ai_generated_content", weight: 6 }],

  // Minimal risk
  "spam filter": [{ riskLevel: "MINIMAL", useCaseId: "spam_filters", weight: 8 }],
  "content moderation": [{ riskLevel: "MINIMAL", useCaseId: "spam_filters", weight: 6 }],
  gaming: [{ riskLevel: "MINIMAL", useCaseId: "ai_gaming", weight: 6 }],
  "video game": [{ riskLevel: "MINIMAL", useCaseId: "ai_gaming", weight: 7 }],
  npc: [{ riskLevel: "MINIMAL", useCaseId: "ai_gaming", weight: 7 }],
  "inventory management": [{ riskLevel: "MINIMAL", useCaseId: "inventory_management", weight: 8 }],
  "supply chain": [{ riskLevel: "MINIMAL", useCaseId: "inventory_management", weight: 7 }],
  "demand forecasting": [{ riskLevel: "MINIMAL", useCaseId: "inventory_management", weight: 7 }],
  recommendation: [{ riskLevel: "MINIMAL", useCaseId: "recommendation_engines", weight: 6 }],
  "product suggestion": [{ riskLevel: "MINIMAL", useCaseId: "recommendation_engines", weight: 7 }],
  search: [{ riskLevel: "MINIMAL", useCaseId: "search_optimization", weight: 4 }],
  optimization: [{ riskLevel: "MINIMAL", useCaseId: "search_optimization", weight: 4 }],
};

/**
 * Suggests a risk level for an AI system based on its stated purpose and category.
 * Uses keyword matching against the EU AI Act classification framework.
 */
export function suggestRiskLevel(
  purpose: string,
  category: string,
): {
  riskLevel: string;
  confidence: "high" | "medium" | "low";
  matchedUseCase?: string;
} {
  const input = `${purpose} ${category}`.toLowerCase();

  let bestMatch: {
    riskLevel: AIUseCase["riskLevel"];
    useCaseId: string;
    weight: number;
  } | null = null;

  for (const [keyword, matches] of Object.entries(RISK_KEYWORDS)) {
    if (input.includes(keyword)) {
      for (const match of matches) {
        if (!bestMatch || match.weight > bestMatch.weight) {
          bestMatch = match;
        }
      }
    }
  }

  if (bestMatch) {
    // Find the matched use case name for display
    let matchedUseCaseName: string | undefined;
    for (const cat of AI_ACT_CATEGORIES) {
      const uc = cat.useCases.find((u) => u.id === bestMatch!.useCaseId);
      if (uc) {
        matchedUseCaseName = uc.name;
        break;
      }
    }

    return {
      riskLevel: bestMatch.riskLevel,
      confidence: bestMatch.weight >= 9 ? "high" : bestMatch.weight >= 7 ? "medium" : "low",
      matchedUseCase: matchedUseCaseName,
    };
  }

  // Default: if no keywords match, return MINIMAL with low confidence
  return {
    riskLevel: "MINIMAL",
    confidence: "low",
  };
}

/** Obligation sets by risk level, representing the general requirements. */
const OBLIGATIONS_BY_RISK_LEVEL: Record<string, string[]> = {
  UNACCEPTABLE: [
    "System is PROHIBITED under the EU AI Act and may not be placed on the market, put into service, or used in the EU",
    "Existing deployments must be discontinued immediately",
    "Violations are subject to fines up to EUR 35 million or 7% of total worldwide annual turnover",
  ],
  HIGH_RISK: [
    "Establish and maintain a risk management system throughout the AI system lifecycle (Article 9)",
    "Implement data governance measures ensuring training data quality, relevance, and representativeness (Article 10)",
    "Prepare and maintain comprehensive technical documentation (Article 11)",
    "Design the system with automatic logging of events for traceability (Article 12)",
    "Ensure transparency: provide clear information to deployers on system capabilities and limitations (Article 13)",
    "Design for effective human oversight, enabling human operators to understand and override the system (Article 14)",
    "Achieve appropriate levels of accuracy, robustness, and cybersecurity (Article 15)",
    "Undergo conformity assessment before placing on the market (Article 43)",
    "Register the system in the EU database for high-risk AI systems (Article 49)",
    "Implement a post-market monitoring system (Article 72)",
    "Report serious incidents to market surveillance authorities (Article 73)",
  ],
  LIMITED: [
    "Clearly disclose to users that they are interacting with an AI system (Article 50(1))",
    "Label AI-generated or manipulated content (images, audio, video, text) as artificially generated or manipulated (Article 50(2)-(4))",
    "Ensure labeling is in a machine-readable format and is detectable by technical solutions",
    "Inform individuals exposed to emotion recognition or biometric categorization systems (Article 50(3))",
    "Comply with applicable data protection and transparency requirements under GDPR",
  ],
  MINIMAL: [
    "No mandatory obligations under the EU AI Act",
    "Encouraged to voluntarily adopt codes of conduct covering transparency, accountability, and non-discrimination (Article 95)",
    "General EU product safety, consumer protection, and data protection laws continue to apply",
    "Consider adopting AI ethics guidelines and responsible AI practices",
  ],
};

/**
 * Returns the general compliance obligations for a given risk level.
 */
export function getObligationsForRiskLevel(riskLevel: string): string[] {
  return OBLIGATIONS_BY_RISK_LEVEL[riskLevel] ?? OBLIGATIONS_BY_RISK_LEVEL.MINIMAL!;
}
