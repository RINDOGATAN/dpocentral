import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding assessment templates...");

  // LIA Template (Free / built-in)
  const liaTemplate = {
    type: "LIA" as const,
    name: "Legitimate Interest Assessment",
    description:
      "Document and balance legitimate interests against data subject rights (GDPR Article 6(1)(f)).",
    version: "1.0",
    isSystem: true,
    isActive: true,
    sections: [
      {
        id: "lia1",
        title: "Purpose Test",
        description: "Identify the legitimate interest",
        questions: [
          {
            id: "lia1_1",
            text: "What is the legitimate interest being pursued?",
            type: "textarea",
            required: true,
            helpText:
              "Describe the specific interest, not just 'business purposes'",
          },
          {
            id: "lia1_2",
            text: "Is this interest recognized as legitimate under law?",
            type: "select",
            required: true,
            options: [
              "Yes, explicitly recognized",
              "Yes, generally accepted",
              "Possibly",
              "Uncertain",
            ],
          },
          {
            id: "lia1_3",
            text: "What benefit does pursuing this interest provide?",
            type: "textarea",
            required: true,
          },
        ],
      },
      {
        id: "lia2",
        title: "Necessity Test",
        description: "Assess whether processing is necessary",
        questions: [
          {
            id: "lia2_1",
            text: "Is the processing necessary to achieve the interest?",
            type: "select",
            required: true,
            options: [
              "Essential",
              "Highly beneficial",
              "Somewhat beneficial",
              "Not clearly necessary",
            ],
            riskWeight: 1.5,
          },
          {
            id: "lia2_2",
            text: "Are there less intrusive ways to achieve the same goal?",
            type: "select",
            required: true,
            options: [
              "No alternatives exist",
              "Alternatives less effective",
              "Alternatives available",
              "Better alternatives exist",
            ],
            riskWeight: 1.5,
          },
        ],
      },
      {
        id: "lia3",
        title: "Balancing Test",
        description: "Balance interests against data subject rights",
        questions: [
          {
            id: "lia3_1",
            text: "What is the nature of the data being processed?",
            type: "select",
            required: true,
            options: [
              "Non-sensitive only",
              "Mix of sensitivity levels",
              "Includes sensitive data",
            ],
            riskWeight: 2,
          },
          {
            id: "lia3_2",
            text: "Would data subjects reasonably expect this processing?",
            type: "select",
            required: true,
            options: [
              "Definitely expected",
              "Probably expected",
              "Possibly unexpected",
              "Likely unexpected",
            ],
            riskWeight: 2,
          },
          {
            id: "lia3_3",
            text: "What is the potential impact on data subjects?",
            type: "select",
            required: true,
            options: [
              "Positive/Neutral",
              "Minor negative",
              "Moderate negative",
              "Significant negative",
            ],
            riskWeight: 2,
          },
          {
            id: "lia3_4",
            text: "Are there vulnerable individuals affected?",
            type: "boolean",
            required: true,
            riskWeight: 2,
          },
        ],
      },
      {
        id: "lia4",
        title: "Safeguards",
        description: "Document safeguards to protect data subjects",
        questions: [
          {
            id: "lia4_1",
            text: "What safeguards are in place to protect data subjects?",
            type: "multiselect",
            required: true,
            options: [
              "Opt-out mechanism",
              "Data minimization",
              "Retention limits",
              "Access controls",
              "Transparency measures",
              "Other",
            ],
          },
          {
            id: "lia4_2",
            text: "Have you provided clear privacy information about this processing?",
            type: "boolean",
            required: true,
          },
        ],
      },
    ],
    scoringLogic: {
      method: "weighted_average",
      riskLevels: {
        LOW: { min: 0, max: 25 },
        MEDIUM: { min: 26, max: 50 },
        HIGH: { min: 51, max: 75 },
        CRITICAL: { min: 76, max: 100 },
      },
    },
  };

  await prisma.assessmentTemplate.upsert({
    where: { id: "system-lia-template" },
    update: liaTemplate,
    create: { id: "system-lia-template", ...liaTemplate },
  });
  console.log("  Upserted LIA template (system-lia-template)");

  // CUSTOM Template (Free / built-in)
  const customTemplate = {
    type: "CUSTOM" as const,
    name: "Custom Assessment",
    description:
      "A flexible assessment template for custom privacy reviews and evaluations.",
    version: "1.0",
    isSystem: true,
    isActive: true,
    sections: [
      {
        id: "custom1",
        title: "Overview",
        description: "Describe the scope and purpose of this assessment",
        questions: [
          {
            id: "custom1_1",
            text: "What is the purpose of this assessment?",
            type: "textarea",
            required: true,
            helpText: "Describe what you are evaluating and why",
          },
          {
            id: "custom1_2",
            text: "What is the scope of this assessment?",
            type: "textarea",
            required: true,
            helpText:
              "Define the systems, processes, or data flows being assessed",
          },
        ],
      },
      {
        id: "custom2",
        title: "Risk Evaluation",
        description: "Identify and evaluate potential risks",
        questions: [
          {
            id: "custom2_1",
            text: "What are the key risks identified?",
            type: "textarea",
            required: true,
          },
          {
            id: "custom2_2",
            text: "What is the overall risk level?",
            type: "select",
            required: true,
            options: ["Low", "Medium", "High", "Critical"],
            riskWeight: 2,
          },
          {
            id: "custom2_3",
            text: "Are there any legal or regulatory concerns?",
            type: "textarea",
            required: false,
          },
        ],
      },
      {
        id: "custom3",
        title: "Mitigations",
        description: "Document mitigations and recommendations",
        questions: [
          {
            id: "custom3_1",
            text: "What mitigations are in place or recommended?",
            type: "textarea",
            required: true,
          },
          {
            id: "custom3_2",
            text: "Is the residual risk acceptable?",
            type: "select",
            required: true,
            options: [
              "Yes, fully acceptable",
              "Acceptable with conditions",
              "Needs further review",
              "Not acceptable",
            ],
            riskWeight: 1.5,
          },
        ],
      },
    ],
    scoringLogic: {
      method: "weighted_average",
      riskLevels: {
        LOW: { min: 0, max: 25 },
        MEDIUM: { min: 26, max: 50 },
        HIGH: { min: 51, max: 75 },
        CRITICAL: { min: 76, max: 100 },
      },
    },
  };

  await prisma.assessmentTemplate.upsert({
    where: { id: "system-custom-template" },
    update: customTemplate,
    create: { id: "system-custom-template", ...customTemplate },
  });
  console.log("  Upserted CUSTOM template (system-custom-template)");

  // DPIA Template (Premium)
  const dpiaTemplate = {
    type: "DPIA" as const,
    name: "Data Protection Impact Assessment",
    description:
      "GDPR Article 35 compliant DPIA for high-risk processing activities.",
    version: "1.0",
    isSystem: true,
    isActive: true,
    sections: [
      {
        id: "s1",
        title: "Processing Description",
        description: "Describe the processing operation and its purpose",
        questions: [
          {
            id: "q1_1",
            text: "What personal data is being processed?",
            type: "textarea",
            required: true,
            helpText:
              "List all categories of personal data involved (e.g., identifiers, behavioral data, special categories)",
          },
          {
            id: "q1_2",
            text: "What is the purpose of the processing?",
            type: "textarea",
            required: true,
            helpText:
              "Describe the specific, explicit, and legitimate purpose(s)",
          },
          {
            id: "q1_3",
            text: "What is the legal basis for processing?",
            type: "select",
            required: true,
            options: [
              "Consent",
              "Contract",
              "Legal Obligation",
              "Vital Interests",
              "Public Task",
              "Legitimate Interests",
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
              "Website Visitors",
              "Minors",
              "Patients",
              "Other",
            ],
          },
          {
            id: "q1_5",
            text: "How many data subjects are affected (estimated)?",
            type: "number",
            required: true,
            helpText: "Approximate number of individuals",
          },
        ],
      },
      {
        id: "s2",
        title: "Necessity & Proportionality",
        description:
          "Assess whether the processing is necessary and proportionate",
        questions: [
          {
            id: "q2_1",
            text: "Is the processing necessary to achieve the stated purpose?",
            type: "select",
            required: true,
            options: [
              "Yes, essential",
              "Highly beneficial",
              "Somewhat beneficial",
              "Not clearly necessary",
            ],
            riskWeight: 1.5,
          },
          {
            id: "q2_2",
            text: "Have less intrusive alternatives been considered?",
            type: "textarea",
            required: false,
            helpText:
              "Describe any alternatives considered and why they were not chosen",
          },
        ],
      },
      {
        id: "s3",
        title: "Risk Assessment",
        description:
          "Identify and assess risks to the rights and freedoms of data subjects",
        questions: [
          {
            id: "q3_1",
            text: "Does the processing involve automated decision-making or profiling?",
            type: "boolean",
            required: true,
            riskWeight: 2,
          },
          {
            id: "q3_2",
            text: "Does the processing involve special category data or criminal offence data?",
            type: "boolean",
            required: true,
            riskWeight: 2,
          },
          {
            id: "q3_3",
            text: "Does the processing involve systematic monitoring of a publicly accessible area?",
            type: "boolean",
            required: false,
            riskWeight: 1.5,
          },
          {
            id: "q3_4",
            text: "What measures are in place to mitigate identified risks?",
            type: "textarea",
            required: true,
            helpText:
              "Describe technical and organisational measures (e.g., encryption, access controls, pseudonymisation)",
          },
        ],
      },
    ],
    scoringLogic: {
      method: "weighted_average",
      riskLevels: {
        LOW: { min: 0, max: 25 },
        MEDIUM: { min: 26, max: 50 },
        HIGH: { min: 51, max: 75 },
        CRITICAL: { min: 76, max: 100 },
      },
    },
  };

  await prisma.assessmentTemplate.upsert({
    where: { id: "system-dpia-template" },
    update: dpiaTemplate,
    create: { id: "system-dpia-template", ...dpiaTemplate },
  });
  console.log("  Upserted DPIA template (system-dpia-template)");

  console.log("Done! Assessment templates seeded successfully.");
}

main()
  .catch((e) => {
    console.error("Error seeding templates:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
