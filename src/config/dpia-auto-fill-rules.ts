/**
 * DPIA Auto-Fill Rules (Feature 3)
 *
 * Maps processing activity data from the data inventory to DPIA template
 * question responses. Rules are evaluated against an AutoFillContext built
 * from ProcessingActivities, DataAssets, DataElements, and Transfers.
 *
 * Question IDs align with the DPIA template v2 in dpia-template-v2.ts.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AutoFillRule {
  questionId: string;
  sectionId: string;
  /** Condition that triggers this auto-fill */
  condition: (context: AutoFillContext) => boolean;
  /** Generate the suggested response */
  generateResponse: (context: AutoFillContext) => string;
  /** Confidence level of the auto-fill */
  confidence: "high" | "medium" | "low";
}

export interface AutoFillContext {
  activity: {
    name: string;
    purpose: string;
    legalBasis: string;
    dataSubjects: string[];
    categories: string[];
    recipients: string[];
    retentionPeriod: string;
    retentionDays?: number | null;
    automatedDecisionMaking?: boolean;
    automatedDecisionDetails?: string | null;
  };
  assets: {
    name: string;
    type: string;
    hostingType?: string | null;
    vendor?: string | null;
  }[];
  elements: {
    name: string;
    category: string;
    sensitivity: string;
    isSpecialCategory: boolean;
  }[];
  transfers: {
    destinationCountry: string;
    mechanism: string;
    safeguards?: string | null;
  }[];
  vendor?: {
    name: string;
    certifications: string[];
    countries: string[];
  } | null;
}

export interface AutoFillResult {
  sectionId: string;
  questionId: string;
  suggestedResponse: string;
  confidence: "high" | "medium" | "low";
  source: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LEGAL_BASIS_LABELS: Record<string, string> = {
  CONSENT: "Consent (Art. 6(1)(a))",
  CONTRACT: "Contract (Art. 6(1)(b))",
  LEGAL_OBLIGATION: "Legal obligation (Art. 6(1)(c))",
  VITAL_INTERESTS: "Vital interests (Art. 6(1)(d))",
  PUBLIC_TASK: "Public task (Art. 6(1)(e))",
  LEGITIMATE_INTERESTS: "Legitimate interests (Art. 6(1)(f))",
};

function legalBasisLabel(basis: string): string {
  return LEGAL_BASIS_LABELS[basis] ?? basis;
}

function uniqueList(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}

function formatList(items: string[]): string {
  const unique = uniqueList(items);
  if (unique.length === 0) return "None specified";
  if (unique.length <= 5) return unique.join(", ");
  return `${unique.slice(0, 5).join(", ")} and ${unique.length - 5} more`;
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

export const DPIA_AUTO_FILL_RULES: AutoFillRule[] = [
  // ---- Section 1: Processing Description ----
  {
    questionId: "s1_processing_description",
    sectionId: "s1",
    condition: (ctx) => Boolean(ctx.activity.purpose),
    generateResponse: (ctx) => {
      const assetNames = ctx.assets.map((a) => a.name);
      const assetLine =
        assetNames.length > 0
          ? `\n\nThe processing uses the following systems/assets: ${formatList(assetNames)}.`
          : "";
      return `This processing activity "${ctx.activity.name}" is carried out for the following purpose: ${ctx.activity.purpose}.${assetLine}`;
    },
    confidence: "high",
  },

  {
    questionId: "s1_legal_basis",
    sectionId: "s1",
    condition: (ctx) => Boolean(ctx.activity.legalBasis),
    generateResponse: (ctx) => {
      const label = legalBasisLabel(ctx.activity.legalBasis);
      const justifications: Record<string, string> = {
        CONSENT:
          "Data subjects have given clear, informed, and freely-given consent. Consent can be withdrawn at any time without detriment.",
        CONTRACT:
          "Processing is necessary for the performance of a contract with the data subject or to take steps at their request prior to entering into a contract.",
        LEGAL_OBLIGATION:
          "Processing is necessary to comply with a legal obligation to which the controller is subject.",
        VITAL_INTERESTS:
          "Processing is necessary to protect the vital interests of the data subject or another natural person.",
        PUBLIC_TASK:
          "Processing is necessary for the performance of a task carried out in the public interest or in the exercise of official authority.",
        LEGITIMATE_INTERESTS:
          "The controller has a legitimate interest that is not overridden by the interests, rights, or freedoms of data subjects. A balancing test has been performed.",
      };
      const justification =
        justifications[ctx.activity.legalBasis] ??
        "The legal basis has been determined in accordance with GDPR Art. 6.";
      return `Legal basis: ${label}.\n\n${justification}`;
    },
    confidence: "high",
  },

  // ---- Section 2: Necessity & Proportionality ----
  {
    questionId: "s2_necessity",
    sectionId: "s2",
    condition: (ctx) =>
      Boolean(ctx.activity.legalBasis) && ctx.activity.dataSubjects.length > 0,
    generateResponse: (ctx) => {
      const subjects = formatList(ctx.activity.dataSubjects);
      const categories = formatList(ctx.activity.categories);
      return `The processing is necessary to achieve the stated purpose for the following data subjects: ${subjects}. The data categories processed (${categories}) are limited to what is required. The processing scope is proportionate to the objective described.`;
    },
    confidence: "medium",
  },

  {
    questionId: "s2_proportionality",
    sectionId: "s2",
    condition: (ctx) => ctx.elements.length > 0,
    generateResponse: (ctx) => {
      const total = ctx.elements.length;
      const specialCount = ctx.elements.filter(
        (e) => e.isSpecialCategory
      ).length;
      const sensitivities = uniqueList(ctx.elements.map((e) => e.sensitivity));
      let response = `${total} data element(s) are processed. Sensitivity levels: ${formatList(sensitivities)}.`;
      if (specialCount > 0) {
        response += ` ${specialCount} element(s) are classified as special category data under Art. 9, which increases the proportionality burden.`;
      } else {
        response += ` No special category data is processed, which supports proportionality.`;
      }
      return response;
    },
    confidence: "medium",
  },

  // ---- Section 3: Data Categories & Subjects ----
  {
    questionId: "s3_data_categories",
    sectionId: "s3",
    condition: (ctx) => ctx.elements.length > 0,
    generateResponse: (ctx) => {
      const categoryGroups: Record<string, string[]> = {};
      for (const el of ctx.elements) {
        const cat = el.category || "Other";
        if (!categoryGroups[cat]) categoryGroups[cat] = [];
        categoryGroups[cat].push(el.name);
      }
      const lines = Object.entries(categoryGroups).map(
        ([cat, names]) => `- ${cat}: ${names.join(", ")}`
      );
      return `The following categories of personal data are processed:\n\n${lines.join("\n")}`;
    },
    confidence: "high",
  },

  {
    questionId: "s3_special_categories",
    sectionId: "s3",
    condition: (ctx) => ctx.elements.some((e) => e.isSpecialCategory),
    generateResponse: (ctx) => {
      const special = ctx.elements.filter((e) => e.isSpecialCategory);
      const names = special.map((e) => `${e.name} (${e.category})`);
      return `Special category data under GDPR Art. 9 is processed:\n\n${names.map((n) => `- ${n}`).join("\n")}\n\nAn Art. 9(2) condition must be identified and documented for each special category. Additional safeguards are required.`;
    },
    confidence: "high",
  },

  {
    questionId: "s3_data_subjects",
    sectionId: "s3",
    condition: (ctx) => ctx.activity.dataSubjects.length > 0,
    generateResponse: (ctx) => {
      const subjects = ctx.activity.dataSubjects;
      const hasVulnerable = subjects.some((s) =>
        /minor|child|patient|student/i.test(s)
      );
      let response = `Data subjects affected by this processing:\n\n${subjects.map((s) => `- ${s}`).join("\n")}`;
      if (hasVulnerable) {
        response +=
          "\n\nNote: The processing involves potentially vulnerable data subjects, which is a factor that increases risk and may trigger the DPIA requirement under EDPB guidelines.";
      }
      return response;
    },
    confidence: "high",
  },

  {
    questionId: "s3_recipients",
    sectionId: "s3",
    condition: (ctx) =>
      ctx.activity.recipients.length > 0 || ctx.transfers.length > 0,
    generateResponse: (ctx) => {
      const parts: string[] = [];
      if (ctx.activity.recipients.length > 0) {
        parts.push(
          `Data is shared with the following recipients: ${formatList(ctx.activity.recipients)}.`
        );
      }
      if (ctx.transfers.length > 0) {
        const destinations = uniqueList(
          ctx.transfers.map((t) => t.destinationCountry)
        );
        parts.push(
          `International transfers are made to: ${formatList(destinations)} (see Transfer section for mechanisms and safeguards).`
        );
      }
      if (ctx.vendor) {
        parts.push(
          `Primary vendor/processor: ${ctx.vendor.name} (operating in: ${formatList(ctx.vendor.countries)}).`
        );
      }
      return parts.join("\n\n");
    },
    confidence: "high",
  },

  // ---- Section 4: Retention ----
  {
    questionId: "s4_retention",
    sectionId: "s4",
    condition: (ctx) => Boolean(ctx.activity.retentionPeriod),
    generateResponse: (ctx) => {
      let response = `Retention period: ${ctx.activity.retentionPeriod}.`;
      if (ctx.activity.retentionDays != null) {
        response += ` (${ctx.activity.retentionDays} days)`;
      }
      response +=
        "\n\nData will be securely deleted or anonymized at the end of the retention period. The retention schedule is reviewed periodically to ensure it remains necessary and proportionate.";
      return response;
    },
    confidence: "high",
  },

  // ---- Section 4: Security Measures ----
  {
    questionId: "s4_security",
    sectionId: "s4",
    condition: (ctx) =>
      ctx.assets.length > 0 || (ctx.vendor?.certifications?.length ?? 0) > 0,
    generateResponse: (ctx) => {
      const parts: string[] = [];

      // Hosting types
      const hostingTypes = uniqueList(
        ctx.assets
          .map((a) => a.hostingType)
          .filter((h): h is string => h != null)
      );
      if (hostingTypes.length > 0) {
        parts.push(`Hosting: ${formatList(hostingTypes)}.`);
      }

      // Asset types
      const assetTypes = uniqueList(ctx.assets.map((a) => a.type));
      if (assetTypes.length > 0) {
        parts.push(`Asset types: ${formatList(assetTypes)}.`);
      }

      // Vendor certifications
      if (ctx.vendor && ctx.vendor.certifications.length > 0) {
        parts.push(
          `Vendor "${ctx.vendor.name}" holds the following certifications: ${formatList(ctx.vendor.certifications)}. These certifications provide assurance of technical and organizational security measures.`
        );
      }

      if (parts.length === 0) {
        return "Data security measures should be documented based on the systems and vendors involved in this processing.";
      }

      return `Data security context:\n\n${parts.join("\n\n")}\n\nEnsure that appropriate technical measures (encryption at rest and in transit, access controls, audit logging) and organizational measures (staff training, DPAs, incident response) are in place.`;
    },
    confidence: "medium",
  },

  // ---- Section 5: Transfers ----
  {
    questionId: "s5_transfers",
    sectionId: "s5",
    condition: (ctx) => ctx.transfers.length > 0,
    generateResponse: (ctx) => {
      const lines = ctx.transfers.map((t) => {
        let line = `- ${t.destinationCountry}: Transfer mechanism — ${t.mechanism}`;
        if (t.safeguards) {
          line += `. Safeguards: ${t.safeguards}`;
        }
        return line;
      });
      return `International transfers of personal data:\n\n${lines.join("\n")}\n\nEach transfer must be covered by an appropriate mechanism under GDPR Chapter V (adequacy decision, SCCs, BCRs, or derogation). A Transfer Impact Assessment (TIA) should be completed for transfers relying on SCCs to non-adequate countries.`;
    },
    confidence: "high",
  },

  // ---- Section 5: Automated Decision-Making ----
  {
    questionId: "s5_automated_decisions",
    sectionId: "s5",
    condition: (ctx) => ctx.activity.automatedDecisionMaking === true,
    generateResponse: (ctx) => {
      const details =
        ctx.activity.automatedDecisionDetails ??
        "Details of the automated decision-making have not yet been documented.";
      return `This processing involves automated decision-making or profiling.\n\n${details}\n\nUnder GDPR Art. 22, data subjects have the right not to be subject to a decision based solely on automated processing that produces legal effects or similarly significant effects. Safeguards must include the right to obtain human intervention, to express their point of view, and to contest the decision.`;
    },
    confidence: "high",
  },

  // ---- Section 6: Rights of Data Subjects ----
  {
    questionId: "s6_rights",
    sectionId: "s6",
    condition: (ctx) => Boolean(ctx.activity.legalBasis),
    generateResponse: (ctx) => {
      const basis = ctx.activity.legalBasis;
      const baseRights = [
        "Right of access (Art. 15)",
        "Right to rectification (Art. 16)",
        "Right to erasure (Art. 17)",
        "Right to restriction of processing (Art. 18)",
        "Right to data portability (Art. 20)",
        "Right to object (Art. 21)",
        "Right to lodge a complaint with a supervisory authority",
      ];

      const extraNotes: string[] = [];
      if (basis === "CONSENT") {
        extraNotes.push(
          "Data subjects can withdraw consent at any time without affecting the lawfulness of processing prior to withdrawal."
        );
      }
      if (basis === "LEGITIMATE_INTERESTS") {
        extraNotes.push(
          "The right to object is particularly relevant when processing is based on legitimate interests. The controller must stop processing unless compelling legitimate grounds are demonstrated."
        );
      }

      let response = `Data subjects have the following rights in relation to this processing:\n\n${baseRights.map((r) => `- ${r}`).join("\n")}`;
      if (extraNotes.length > 0) {
        response += `\n\n${extraNotes.join("\n")}`;
      }
      response +=
        "\n\nRights requests are handled through the organization's DSAR management process.";
      return response;
    },
    confidence: "medium",
  },

  // ---- Section 7: Risk Assessment ----
  {
    questionId: "s7_risk_assessment",
    sectionId: "s7",
    condition: (ctx) => ctx.elements.length > 0,
    generateResponse: (ctx) => {
      const riskFactors: string[] = [];

      const specialCount = ctx.elements.filter(
        (e) => e.isSpecialCategory
      ).length;
      if (specialCount > 0) {
        riskFactors.push(
          `Special category data is processed (${specialCount} element(s)) — this significantly increases risk to data subjects' fundamental rights.`
        );
      }

      if (ctx.transfers.length > 0) {
        const countries = uniqueList(
          ctx.transfers.map((t) => t.destinationCountry)
        );
        riskFactors.push(
          `International transfers to ${countries.length} country/countries (${formatList(countries)}) — transfer risk must be assessed per Schrems II requirements.`
        );
      }

      if (ctx.activity.automatedDecisionMaking) {
        riskFactors.push(
          "Automated decision-making is involved — risk of algorithmic bias and lack of transparency."
        );
      }

      const hasVulnerable = ctx.activity.dataSubjects.some((s) =>
        /minor|child|patient|student/i.test(s)
      );
      if (hasVulnerable) {
        riskFactors.push(
          "Vulnerable data subjects are affected — heightened duty of care applies."
        );
      }

      if (ctx.elements.length > 10) {
        riskFactors.push(
          `Large number of data elements (${ctx.elements.length}) — broader data scope increases exposure risk.`
        );
      }

      if (riskFactors.length === 0) {
        return "Based on the data inventory, no elevated risk factors were automatically identified. A manual risk review is still recommended to ensure all risks to data subjects are identified and mitigated.";
      }

      return `Automatically identified risk factors:\n\n${riskFactors.map((f) => `- ${f}`).join("\n")}\n\nEach risk factor should be assessed for likelihood and severity, and appropriate mitigation measures should be documented.`;
    },
    confidence: "low",
  },
];

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Run all auto-fill rules against the given context and return suggested
 * responses for each matching DPIA question.
 */
export function generateAutoFillResponses(
  context: AutoFillContext
): AutoFillResult[] {
  const results: AutoFillResult[] = [];

  for (const rule of DPIA_AUTO_FILL_RULES) {
    try {
      if (rule.condition(context)) {
        const response = rule.generateResponse(context);
        if (response) {
          results.push({
            sectionId: rule.sectionId,
            questionId: rule.questionId,
            suggestedResponse: response,
            confidence: rule.confidence,
            source: `auto-fill:${rule.questionId}`,
          });
        }
      }
    } catch {
      // Skip rules that fail — better to return partial results than nothing
      continue;
    }
  }

  return results;
}
