import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding vendor questionnaire template...");

  const questionnaire = {
    name: "Vendor Security & Privacy Assessment",
    description:
      "Comprehensive due diligence questionnaire based on SIG, CAIQ, and GDPR Article 28 requirements. Covers governance, data protection, access control, incident response, subprocessors, international transfers, business continuity, and compliance.",
    version: "2.0",
    isSystem: true,
    isActive: true,
    sections: [
      {
        id: "sec1",
        title: "Organization & Governance",
        description:
          "Assess the vendor's security governance structure, certifications, and training programs.",
        questions: [
          {
            id: "gov1",
            text: "Do you have a dedicated information security team or function?",
            type: "boolean",
            required: true,
          },
          {
            id: "gov2",
            text: "Do you have a designated Data Protection Officer (DPO) or privacy lead? If yes, provide their name and contact details.",
            type: "text",
            required: true,
          },
          {
            id: "gov3",
            text: "Which security and privacy certifications or attestations does your organization currently hold?",
            type: "multiselect",
            required: true,
            options: [
              "ISO 27001",
              "ISO 27701",
              "SOC 2 Type I",
              "SOC 2 Type II",
              "CSA STAR",
              "ISAE 3402",
              "PCI DSS",
              "HITRUST",
              "Other",
              "None",
            ],
          },
          {
            id: "gov4",
            text: "How often are your information security and privacy policies formally reviewed and updated?",
            type: "select",
            required: true,
            options: [
              "Annually",
              "Semi-annually",
              "Quarterly",
              "Ad-hoc",
              "Never",
            ],
          },
          {
            id: "gov5",
            text: "Do all employees receive data protection and security awareness training at onboarding and at least annually thereafter?",
            type: "boolean",
            required: true,
          },
        ],
      },
      {
        id: "sec2",
        title: "Data Protection & Privacy",
        description:
          "Evaluate how personal data is processed, protected, and managed throughout its lifecycle.",
        questions: [
          {
            id: "dp1",
            text: "What categories of personal data will you process on our behalf?",
            type: "multiselect",
            required: true,
            options: [
              "Names / contact details",
              "Financial data",
              "Health data",
              "Biometric data",
              "Location data",
              "Online identifiers (IP / cookies)",
              "Employee / HR data",
              "Children's data",
              "Criminal records",
              "None",
            ],
          },
          {
            id: "dp2",
            text: "What is the legal basis you rely on for processing personal data in this engagement?",
            type: "select",
            required: true,
            options: [
              "Controller instructions only (processor)",
              "Legitimate interest",
              "Consent",
              "Contractual necessity",
              "Legal obligation",
              "Not applicable",
            ],
          },
          {
            id: "dp3",
            text: "Do you encrypt personal data at rest and in transit? Describe the standards and algorithms used.",
            type: "textarea",
            required: true,
          },
          {
            id: "dp4",
            text: "Do you have a documented data retention schedule, and can you delete or return all personal data upon contract termination?",
            type: "boolean",
            required: true,
          },
          {
            id: "dp5",
            text: "Can you fulfill data subject rights requests (access, erasure, portability, rectification) within the GDPR-required timeframes?",
            type: "boolean",
            required: true,
          },
          {
            id: "dp6",
            text: "Do you implement data minimization principles, processing only personal data strictly necessary for the stated purpose?",
            type: "boolean",
            required: true,
          },
        ],
      },
      {
        id: "sec3",
        title: "Access Control & Authentication",
        description:
          "Review access management practices, authentication requirements, and audit trail capabilities.",
        questions: [
          {
            id: "ac1",
            text: "Do you enforce the principle of least privilege and role-based access control (RBAC) for all systems that process personal data?",
            type: "boolean",
            required: true,
          },
          {
            id: "ac2",
            text: "Is multi-factor authentication (MFA) required for all users accessing systems that contain personal data?",
            type: "boolean",
            required: true,
          },
          {
            id: "ac3",
            text: "How frequently are user access rights reviewed and recertified?",
            type: "select",
            required: true,
            options: [
              "Monthly",
              "Quarterly",
              "Semi-annually",
              "Annually",
              "Upon role change only",
              "Never",
            ],
          },
          {
            id: "ac4",
            text: "Do you maintain audit logs of access to personal data, and how long are these logs retained?",
            type: "select",
            required: true,
            options: [
              "30 days",
              "90 days",
              "6 months",
              "1 year",
              "2+ years",
              "Not maintained",
            ],
          },
          {
            id: "ac5",
            text: "How are access rights revoked when an employee leaves the organization or changes roles?",
            type: "select",
            required: true,
            options: [
              "Immediately (automated)",
              "Within 24 hours",
              "Within 1 week",
              "Ad-hoc / manual process",
            ],
          },
        ],
      },
      {
        id: "sec4",
        title: "Incident Response & Breach Notification",
        description:
          "Assess preparedness for security incidents and compliance with GDPR breach notification obligations (Articles 33-34).",
        questions: [
          {
            id: "ir1",
            text: "Do you have a documented and tested incident response plan that covers personal data breaches?",
            type: "boolean",
            required: true,
          },
          {
            id: "ir2",
            text: "Within what timeframe would you notify us (the data controller) of a confirmed personal data breach?",
            type: "select",
            required: true,
            options: [
              "Without undue delay (under 24 hours)",
              "Within 24 hours",
              "Within 48 hours",
              "Within 72 hours",
              "No specific commitment",
            ],
          },
          {
            id: "ir3",
            text: "Does your breach notification include all GDPR Article 33(3) required details (nature of breach, categories of data, likely consequences, mitigation measures)?",
            type: "boolean",
            required: true,
          },
          {
            id: "ir4",
            text: "Have you experienced any personal data breaches or significant security incidents in the past 24 months? If yes, please describe.",
            type: "textarea",
            required: false,
          },
          {
            id: "ir5",
            text: "How often do you conduct incident response exercises or tabletop drills?",
            type: "select",
            required: true,
            options: [
              "Quarterly",
              "Semi-annually",
              "Annually",
              "Less than annually",
              "Never",
            ],
          },
        ],
      },
      {
        id: "sec5",
        title: "Subprocessors & Third-Party Management",
        description:
          "Evaluate how the vendor manages subprocessors in compliance with GDPR Article 28(2) and (4).",
        questions: [
          {
            id: "sp1",
            text: "Do you engage subprocessors (sub-contractors) who will process personal data as part of this service?",
            type: "boolean",
            required: true,
          },
          {
            id: "sp2",
            text: "Can you provide a complete and current list of subprocessors, including their names, processing purposes, and geographic locations?",
            type: "boolean",
            required: true,
          },
          {
            id: "sp3",
            text: "Do you have written data processing agreements with all subprocessors that include GDPR-equivalent obligations?",
            type: "boolean",
            required: true,
          },
          {
            id: "sp4",
            text: "Will you provide prior written notice before adding or replacing subprocessors, giving us an opportunity to object?",
            type: "boolean",
            required: true,
          },
          {
            id: "sp5",
            text: "How do you assess and monitor the security and privacy posture of your subprocessors on an ongoing basis?",
            type: "textarea",
            required: true,
          },
        ],
      },
      {
        id: "sec6",
        title: "International Data Transfers",
        description:
          "Assess cross-border data transfer mechanisms and compliance with GDPR Chapter V (Articles 44-49).",
        questions: [
          {
            id: "dt1",
            text: "Will personal data be transferred to, stored in, or accessed from countries outside the European Economic Area (EEA)?",
            type: "boolean",
            required: true,
          },
          {
            id: "dt2",
            text: "If yes, which countries or regions will data be transferred to or accessed from?",
            type: "text",
            required: false,
          },
          {
            id: "dt3",
            text: "What transfer mechanisms do you rely on for international data transfers?",
            type: "multiselect",
            required: false,
            options: [
              "EU adequacy decision",
              "Standard Contractual Clauses (SCCs)",
              "Binding Corporate Rules",
              "EU-US Data Privacy Framework",
              "Explicit consent",
              "Derogations (Art. 49)",
              "Not applicable",
            ],
          },
          {
            id: "dt4",
            text: "Have you conducted a Transfer Impact Assessment (TIA) to evaluate the legal framework and surveillance risks in the recipient country?",
            type: "boolean",
            required: false,
          },
        ],
      },
      {
        id: "sec7",
        title: "Business Continuity & Infrastructure",
        description:
          "Review disaster recovery, backup practices, vulnerability management, and physical security.",
        questions: [
          {
            id: "bc1",
            text: "Do you have a documented and tested business continuity and disaster recovery plan covering the systems that process our data?",
            type: "boolean",
            required: true,
          },
          {
            id: "bc2",
            text: "What are your Recovery Time Objective (RTO) and Recovery Point Objective (RPO) for the services provided to us?",
            type: "text",
            required: true,
          },
          {
            id: "bc3",
            text: "How often do you perform backups of personal data, and are backups encrypted?",
            type: "select",
            required: true,
            options: [
              "Daily (encrypted)",
              "Daily (unencrypted)",
              "Weekly (encrypted)",
              "Weekly (unencrypted)",
              "Less frequently",
              "No regular backups",
            ],
          },
          {
            id: "bc4",
            text: "How often do you conduct vulnerability assessments and penetration tests on systems that process personal data?",
            type: "select",
            required: true,
            options: [
              "Continuously (automated)",
              "Monthly",
              "Quarterly",
              "Annually",
              "Less than annually",
              "Never",
            ],
          },
          {
            id: "bc5",
            text: "Where are the primary and backup data centers located (country/region), and do they meet appropriate physical security standards?",
            type: "textarea",
            required: true,
          },
        ],
      },
      {
        id: "sec8",
        title: "Compliance, Audit Rights & Accountability",
        description:
          "Verify regulatory compliance, audit provisions under GDPR Article 28(3)(h), and accountability documentation.",
        questions: [
          {
            id: "co1",
            text: "Do you maintain a Record of Processing Activities (ROPA) as required by GDPR Article 30?",
            type: "boolean",
            required: true,
          },
          {
            id: "co2",
            text: "Will you permit audits or inspections (by us or an independent third party) to verify compliance with data processing obligations?",
            type: "boolean",
            required: true,
          },
          {
            id: "co3",
            text: "Can you provide copies of recent independent audit reports (e.g., SOC 2 Type II, ISO 27001 certificate, penetration test summary)?",
            type: "boolean",
            required: true,
          },
          {
            id: "co4",
            text: "Have you conducted a Data Protection Impact Assessment (DPIA) for the processing activities relevant to our engagement?",
            type: "select",
            required: true,
            options: [
              "Yes — completed",
              "Yes — in progress",
              "No — not required",
              "No — not yet started",
            ],
          },
          {
            id: "co5",
            text: "Which data protection regulations and frameworks does your organization currently comply with?",
            type: "multiselect",
            required: true,
            options: [
              "GDPR",
              "UK GDPR",
              "CCPA / CPRA",
              "HIPAA",
              "PCI DSS",
              "LGPD (Brazil)",
              "POPIA (South Africa)",
              "PIPL (China)",
              "PDPA (Singapore / Thailand)",
              "Other",
              "None",
            ],
          },
          {
            id: "co6",
            text: "Describe any additional security or privacy measures, certifications, or controls not covered above that you believe are relevant.",
            type: "textarea",
            required: false,
          },
        ],
      },
    ],
  };

  await prisma.vendorQuestionnaire.upsert({
    where: { id: "system-vendor-questionnaire" },
    update: questionnaire,
    create: { id: "system-vendor-questionnaire", ...questionnaire },
  });

  console.log(
    "  Upserted vendor questionnaire template (system-vendor-questionnaire)"
  );
  console.log(
    "  8 sections, 38 questions — based on SIG, CAIQ, and GDPR Article 28"
  );
  console.log("Done!");
}

main()
  .catch((e) => {
    console.error("Error seeding vendor questionnaire:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
