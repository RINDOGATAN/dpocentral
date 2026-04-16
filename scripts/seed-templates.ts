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

  // TIA Template (Free / built-in) — EDPB Recommendations 01/2020
  const tiaTemplate = {
    type: "TIA" as const,
    name: "Transfer Impact Assessment (TIA)",
    description:
      "Assess the risks of transferring personal data to a third country and determine whether supplementary measures are needed to ensure an essentially equivalent level of protection (EDPB Recommendations 01/2020, Schrems II).",
    version: "1.0",
    isSystem: true,
    isActive: true,
    sections: [
      {
        id: "tia1",
        title: "Transfer Description",
        description:
          "Describe the data transfer, including the parties involved, the data categories, and the transfer mechanism",
        questions: [
          {
            id: "tia1_1",
            text: "What personal data is being transferred?",
            type: "textarea",
            required: true,
            helpText:
              "Describe the categories of personal data (e.g., contact details, behavioural data, special categories) and estimated volume",
          },
          {
            id: "tia1_2",
            text: "Who is the data exporter and who is the data importer?",
            type: "textarea",
            required: true,
            helpText:
              "Name the organisations, their roles (controller/processor), and the countries they are established in",
          },
          {
            id: "tia1_3",
            text: "What is the transfer mechanism (Article 46 GDPR)?",
            type: "select",
            required: true,
            options: [
              "Standard Contractual Clauses (SCCs)",
              "Binding Corporate Rules (BCRs)",
              "Approved Code of Conduct",
              "Approved Certification Mechanism",
              "Derogation (Art. 49)",
              "Other",
            ],
          },
          {
            id: "tia1_4",
            text: "What is the purpose of the transfer?",
            type: "textarea",
            required: true,
          },
          {
            id: "tia1_5",
            text: "Is the transfer onward-transferred to a further third country?",
            type: "boolean",
            required: true,
            riskWeight: 1.5,
          },
        ],
      },
      {
        id: "tia2",
        title: "Destination Country Legal Framework",
        description:
          "Assess whether the laws and practices of the destination country provide an essentially equivalent level of protection to the EU/EEA",
        questions: [
          {
            id: "tia2_1",
            text: "Does the destination country have an EU adequacy decision?",
            type: "select",
            required: true,
            options: [
              "Yes — full adequacy decision",
              "Yes — partial adequacy decision",
              "No adequacy decision",
              "Adequacy decision under review / challenged",
            ],
          },
          {
            id: "tia2_2",
            text: "Does the destination country have legislation permitting government access to personal data (e.g., surveillance, national security)?",
            type: "select",
            required: true,
            riskWeight: 2,
            options: [
              "No known legislation",
              "Legislation exists but with effective oversight and safeguards",
              "Broad surveillance powers with limited oversight",
              "Mass surveillance or no independent judicial oversight",
            ],
          },
          {
            id: "tia2_3",
            text: "Describe the relevant laws and government access practices in the destination country",
            type: "textarea",
            required: true,
            helpText:
              "Reference specific legislation (e.g., FISA Section 702, UK IPA 2016, CLOUD Act). Include publicly available government access reports and transparency data where possible.",
          },
          {
            id: "tia2_4",
            text: "Is the data importer subject to government access requests in practice?",
            type: "select",
            required: true,
            riskWeight: 2,
            options: [
              "No — data importer has never received a government access request",
              "Possible — data importer operates in a sector that may be targeted",
              "Yes — data importer publishes transparency reports confirming access requests",
              "Unknown",
            ],
          },
          {
            id: "tia2_5",
            text: "Are effective legal remedies available to EU data subjects in the destination country?",
            type: "select",
            required: true,
            riskWeight: 1.5,
            options: [
              "Yes — independent judicial review available",
              "Partial — administrative remedies but no judicial review",
              "No effective remedies available",
              "Unknown",
            ],
          },
        ],
      },
      {
        id: "tia3",
        title: "Supplementary Measures",
        description:
          "Identify technical, contractual, and organisational measures that supplement the transfer mechanism to ensure an equivalent level of protection",
        questions: [
          {
            id: "tia3_1",
            text: "What technical measures are in place?",
            type: "multiselect",
            required: true,
            helpText:
              "Select all technical measures that apply. Effective encryption with EU-held keys is the strongest technical safeguard.",
            options: [
              "Encryption at rest (importer cannot access keys)",
              "Encryption at rest (importer holds keys)",
              "Encryption in transit (TLS 1.2+)",
              "End-to-end encryption (exporter-held keys only)",
              "Pseudonymisation before transfer",
              "Anonymisation / aggregation before transfer",
              "Split processing (no single party sees full dataset)",
              "None",
            ],
          },
          {
            id: "tia3_2",
            text: "What contractual measures supplement the SCCs or transfer agreement?",
            type: "multiselect",
            required: true,
            options: [
              "Obligation to challenge government access requests",
              "Obligation to notify exporter of government access (where legally permitted)",
              "Transparency reporting obligation",
              "Prohibition on onward transfers without prior authorisation",
              "Audit rights for the data exporter",
              "Data localisation obligation (processing only in specified countries)",
              "Suspension / termination clause if legal framework changes",
              "None",
            ],
          },
          {
            id: "tia3_3",
            text: "What organisational measures are in place?",
            type: "multiselect",
            required: true,
            options: [
              "Internal policies restricting government access response procedures",
              "Staff training on data protection obligations",
              "Designated privacy / compliance team at the importer",
              "Regular compliance audits or certifications (e.g., ISO 27001, SOC 2)",
              "Incident response plan covering government access scenarios",
              "None",
            ],
          },
          {
            id: "tia3_4",
            text: "Are the supplementary measures effective at preventing or mitigating the identified risks?",
            type: "textarea",
            required: true,
            riskWeight: 2,
            helpText:
              "Explain why the combination of measures above is sufficient — or insufficient — to ensure essentially equivalent protection. If the data must be available in the clear to the importer (e.g., for processing), encryption alone may not be effective against government access orders.",
          },
        ],
      },
      {
        id: "tia4",
        title: "Risk Assessment & Conclusion",
        description:
          "Weigh the residual risk after supplementary measures and determine whether the transfer can proceed",
        questions: [
          {
            id: "tia4_1",
            text: "What is the likelihood that public authorities in the destination country will access the transferred data?",
            type: "select",
            required: true,
            riskWeight: 2,
            options: [
              "Negligible — sector/data type not targeted, strong safeguards",
              "Low — possible but unlikely given safeguards and data type",
              "Medium — sector is known to be targeted; safeguards may not fully prevent access",
              "High — evidence of routine access to this type of data/sector",
            ],
          },
          {
            id: "tia4_2",
            text: "What would be the severity of impact on data subjects if their data were accessed?",
            type: "select",
            required: true,
            riskWeight: 2,
            options: [
              "Negligible — pseudonymised or non-sensitive data, minimal harm",
              "Low — limited personal data, low sensitivity",
              "Medium — identifiable personal data, moderate sensitivity",
              "High — special category data, vulnerable individuals, or potential for significant harm",
            ],
          },
          {
            id: "tia4_3",
            text: "Overall conclusion: can the transfer proceed?",
            type: "select",
            required: true,
            options: [
              "Yes — supplementary measures provide essentially equivalent protection",
              "Yes, with conditions — additional measures required before transfer can proceed",
              "No — residual risk is too high; transfer should be suspended or alternative mechanism sought",
            ],
          },
          {
            id: "tia4_4",
            text: "If additional conditions are required, describe them",
            type: "textarea",
            required: false,
            helpText:
              "List specific actions that must be completed before the transfer can proceed (e.g., implement EU-held encryption keys, switch to a different processor).",
          },
        ],
      },
      {
        id: "tia5",
        title: "Ongoing Monitoring",
        description:
          "Define how the transfer will be monitored and when this assessment should be reviewed",
        questions: [
          {
            id: "tia5_1",
            text: "How will changes in the destination country's legal framework be monitored?",
            type: "textarea",
            required: true,
            helpText:
              "Describe how you will track legislative changes, court rulings, and enforcement actions (e.g., subscribe to EDPB/SA updates, legal counsel monitoring, vendor transparency reports).",
          },
          {
            id: "tia5_2",
            text: "What events should trigger a reassessment?",
            type: "multiselect",
            required: true,
            options: [
              "New legislation or executive order in the destination country",
              "Adequacy decision revoked or challenged",
              "Data importer receives a government access request",
              "Change in data categories or volume transferred",
              "Change of sub-processor or onward transfer",
              "12-month periodic review cycle",
              "Supervisory authority guidance or enforcement action",
            ],
          },
          {
            id: "tia5_3",
            text: "When is the next scheduled review?",
            type: "textarea",
            required: true,
            helpText: "Provide a specific date or timeframe (e.g., 'within 12 months' or '2027-04-01').",
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
    where: { id: "system-tia-template" },
    update: tiaTemplate,
    create: { id: "system-tia-template", ...tiaTemplate },
  });
  console.log("  Upserted TIA template (system-tia-template)");

  // Load premium templates from @dpocentral/premium-skills (if installed)
  try {
    const pkg = "@dpocentral/premium-skills";
    const mod = await import(/* webpackIgnore: true */ pkg);
    const skills: Array<{ assessmentType?: string; templates?: Array<{ id: string; name: string; description?: string; version: string; sections: unknown; scoringLogic?: unknown }> }> = mod.skills;
    for (const skill of skills) {
      if (skill.templates && skill.assessmentType) {
        for (const template of skill.templates) {
          const templateId = `system-${skill.assessmentType.toLowerCase()}-template`;
          const data = {
            type: skill.assessmentType as "DPIA" | "PIA" | "TIA" | "VENDOR",
            name: template.name,
            description: template.description ?? "",
            version: template.version,
            isSystem: true,
            isActive: true,
            sections: template.sections as any,
            scoringLogic: template.scoringLogic as any,
          };
          await prisma.assessmentTemplate.upsert({
            where: { id: templateId },
            update: data,
            create: { id: templateId, ...data },
          });
          console.log(`  Upserted ${skill.assessmentType} template (${templateId})`);
        }
      }
    }
  } catch {
    console.log("  Premium skills not installed. Skipping premium templates.");
  }

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
