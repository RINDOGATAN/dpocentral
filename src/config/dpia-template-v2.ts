// src/config/dpia-template-v2.ts
// Enriched DPIA template v2.0 — aligned with ICO 7-step framework + Dutch/EDPB best practice
// Reusable by seed scripts and premium package

export const DPIA_TEMPLATE_ID = "system-dpia-template";

export const dpiaTemplateSections = [
  {
    id: "s1",
    title: "Processing Description",
    description:
      "Describe the nature, scope, and purpose of the processing",
    questions: [
      {
        id: "q1_1",
        text: "What categories of personal data will be processed?",
        type: "textarea",
        required: true,
        helpText:
          "List all data categories (e.g. identifiers, financial, behavioral, special category). Be specific about each category.",
      },
      {
        id: "q1_2",
        text: "What is the purpose of the processing?",
        type: "textarea",
        required: true,
        helpText:
          "Describe the primary and any secondary purposes. Reference specific business objectives.",
      },
      {
        id: "q1_3",
        text: "What is the legal basis for processing?",
        type: "select",
        required: true,
        options: [
          "Consent (Art. 6(1)(a))",
          "Contract (Art. 6(1)(b))",
          "Legal obligation (Art. 6(1)(c))",
          "Vital interests (Art. 6(1)(d))",
          "Public task (Art. 6(1)(e))",
          "Legitimate interests (Art. 6(1)(f))",
        ],
      },
      {
        id: "q1_4",
        text: "Who are the data subjects?",
        type: "multiselect",
        required: true,
        options: [
          "Customers",
          "Employees",
          "Job applicants",
          "Website visitors",
          "Minors / children",
          "Patients",
          "Students",
          "Members of the public",
          "Business contacts",
          "Other",
        ],
      },
      {
        id: "q1_5",
        text: "Estimated number of data subjects affected",
        type: "select",
        required: true,
        options: [
          "< 1,000",
          "1,000 – 10,000",
          "10,000 – 100,000",
          "100,000 – 1,000,000",
          "> 1,000,000",
        ],
      },
      {
        id: "q1_6",
        text: "Describe the data flows and recipients",
        type: "textarea",
        required: true,
        helpText:
          "Map how data moves through your systems — from collection to storage, processing, sharing, and deletion. Identify all recipients and processors.",
      },
    ],
  },
  {
    id: "s2",
    title: "Scope & Context",
    description:
      "Assess the scope of processing and the context in which data subjects interact with you",
    questions: [
      {
        id: "q2_1",
        text: "What is the sensitivity level of the data?",
        type: "select",
        required: true,
        options: [
          "Non-sensitive personal data only",
          "Mix of non-sensitive and sensitive indicators",
          "Includes special category data (Art. 9) or criminal offence data (Art. 10)",
        ],
        riskWeight: 2,
      },
      {
        id: "q2_2",
        text: "Retention period and justification",
        type: "textarea",
        required: true,
        helpText:
          "State retention periods for each data category and justify why that duration is necessary.",
      },
      {
        id: "q2_3",
        text: "Geographic scope and international transfers",
        type: "textarea",
        required: true,
        helpText:
          "Identify all countries where data is processed or stored, and the transfer mechanisms used (e.g. adequacy decision, SCCs, BCRs).",
      },
      {
        id: "q2_4",
        text: "Would data subjects reasonably expect this processing?",
        type: "select",
        required: true,
        options: [
          "Fully expected — directly related to the service they signed up for",
          "Probably expected — a reasonable extension of the service",
          "Possibly unexpected — not directly related to the primary service",
          "Unexpected — data subjects would likely be surprised",
        ],
        riskWeight: 1.5,
      },
    ],
  },
  {
    id: "s3",
    title: "Necessity & Proportionality",
    description:
      "Demonstrate that the processing is necessary and proportionate to the purpose",
    questions: [
      {
        id: "q3_1",
        text: "Is the processing necessary to achieve the stated purpose?",
        type: "select",
        required: true,
        options: [
          "Essential — cannot achieve the purpose without it",
          "Highly beneficial — significantly more effective than alternatives",
          "Somewhat beneficial — marginal improvement over alternatives",
          "Not clearly necessary — alternatives could achieve the same result",
        ],
        riskWeight: 1.5,
      },
      {
        id: "q3_2",
        text: "What alternatives were considered and why were they rejected?",
        type: "textarea",
        required: true,
        helpText:
          "Describe less intrusive alternatives you evaluated and explain why the chosen approach is necessary.",
      },
      {
        id: "q3_3",
        text: "What data minimization measures are in place?",
        type: "textarea",
        required: true,
        helpText:
          "Describe measures to ensure only necessary data is collected and processed (e.g. pseudonymization, aggregation, field-level restrictions).",
      },
    ],
  },
  {
    id: "s4",
    title: "Consultation",
    description:
      "Document consultation with stakeholders, the DPO, and (where appropriate) data subjects",
    questions: [
      {
        id: "q4_1",
        text: "Who was consulted during this assessment?",
        type: "multiselect",
        required: true,
        options: [
          "Data Protection Officer",
          "Data subjects or their representatives",
          "IT / Information Security",
          "Legal counsel",
          "Works council / staff representatives",
          "External privacy experts",
          "Processor / vendor",
        ],
      },
      {
        id: "q4_2",
        text: "Summary of consultation outcomes and actions taken",
        type: "textarea",
        required: true,
        helpText:
          "Summarize feedback received, objections raised, and any changes made to the processing as a result.",
      },
    ],
  },
  {
    id: "s5",
    title: "Risk Identification",
    description:
      "Identify risks to the rights and freedoms of data subjects",
    questions: [
      {
        id: "q5_1",
        text: "Does the processing involve automated decision-making or profiling?",
        type: "boolean",
        required: true,
        riskWeight: 2,
      },
      {
        id: "q5_2",
        text: "Does the processing involve special category data or criminal offence data?",
        type: "boolean",
        required: true,
        riskWeight: 2,
      },
      {
        id: "q5_3",
        text: "Does the processing involve systematic monitoring of a publicly accessible area?",
        type: "boolean",
        required: true,
        riskWeight: 1.5,
      },
      {
        id: "q5_4",
        text: "Is the processing carried out on a large scale?",
        type: "boolean",
        required: true,
        riskWeight: 1.5,
      },
      {
        id: "q5_5",
        text: "Does the processing involve innovative use of technology (e.g. AI, biometrics, IoT)?",
        type: "boolean",
        required: true,
        riskWeight: 1.5,
      },
      {
        id: "q5_6",
        text: "Describe the identified risks to data subjects, including likelihood and severity for each",
        type: "textarea",
        required: true,
        helpText:
          "For each risk: describe the source, affected rights, likelihood (Remote / Possible / Likely), and severity (Minimal / Significant / Severe / Critical). Use the format: Risk N — Title: Description. Likelihood: X. Severity: Y.",
      },
    ],
  },
  {
    id: "s6",
    title: "Mitigation Measures",
    description:
      "Document technical and organizational measures to mitigate identified risks",
    questions: [
      {
        id: "q6_1",
        text: "Technical measures in place or planned",
        type: "multiselect",
        required: true,
        options: [
          "Encryption at rest",
          "Encryption in transit",
          "Pseudonymization",
          "Access controls / RBAC",
          "Data loss prevention (DLP)",
          "Audit logging",
          "Backup & recovery",
          "Network segmentation",
          "Automated retention enforcement",
          "Anonymization / aggregation",
        ],
      },
      {
        id: "q6_2",
        text: "Organizational measures in place or planned",
        type: "multiselect",
        required: true,
        options: [
          "Staff training / awareness",
          "Data processing agreements (DPAs)",
          "Privacy policies & procedures",
          "Regular audits / reviews",
          "Breach response plan",
          "Vendor management program",
          "Data classification scheme",
          "Privacy by design process",
        ],
      },
      {
        id: "q6_3",
        text: "Safeguards for individual rights (transparency, consent mechanisms, portability, opt-out)",
        type: "textarea",
        required: true,
        helpText:
          "Describe how data subject rights are facilitated — e.g. privacy notices, consent preference centers, data portability tools, opt-out mechanisms.",
      },
    ],
  },
  {
    id: "s7",
    title: "Residual Risk & Conclusion",
    description:
      "Assess residual risk after mitigations and determine whether supervisory authority consultation is required",
    questions: [
      {
        id: "q7_1",
        text: "Overall residual risk level after mitigations",
        type: "select",
        required: true,
        options: ["Low", "Medium", "High", "Critical"],
        riskWeight: 2,
      },
      {
        id: "q7_2",
        text: "Is prior consultation with the supervisory authority required? (Art. 36)",
        type: "select",
        required: true,
        options: [
          "No — residual risk has been sufficiently mitigated",
          "Under consideration — further analysis needed",
          "Yes — high residual risk that cannot be sufficiently mitigated",
        ],
        riskWeight: 2,
      },
      {
        id: "q7_3",
        text: "DPO advice and recommendation",
        type: "textarea",
        required: true,
        helpText:
          "Record the DPO's formal advice: whether the processing may proceed, any conditions, and the recommended review date.",
      },
    ],
  },
];

export const dpiaScoringLogic = {
  method: "weighted_average",
  riskLevels: {
    LOW: { min: 0, max: 25 },
    MEDIUM: { min: 26, max: 50 },
    HIGH: { min: 51, max: 75 },
    CRITICAL: { min: 76, max: 100 },
  },
};

export const dpiaTemplateData = {
  id: DPIA_TEMPLATE_ID,
  type: "DPIA" as const,
  name: "Data Protection Impact Assessment (DPIA)",
  description:
    "Comprehensive DPIA aligned with the ICO 7-step framework and EDPB guidelines. Covers processing description, scope & context, necessity & proportionality, consultation, risk identification, mitigation measures, and residual risk assessment.",
  version: "2.0",
  isSystem: true,
  isActive: true,
  sections: dpiaTemplateSections,
  scoringLogic: dpiaScoringLogic,
};
