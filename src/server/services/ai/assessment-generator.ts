// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * DPIA/PIA/TIA risk-narrative prompt builder.
 *
 * Builds the prompts for the AI risk assessment narrative from an
 * AutoFillContext (the same context the deterministic rule engine in
 * `src/config/dpia-auto-fill-rules.ts` consumes) and sends them through the
 * one LLM Door (`services/ai/llm-door.ts`).
 *
 * Prompts are ALWAYS built server-side from Prisma-derived context — never
 * from client-supplied text. Callers must pass the posture gate
 * (`services/ai/posture.ts` requireAi) BEFORE calling generateRiskNarrative;
 * this module performs no network I/O of its own.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import type { AutoFillContext } from "@/config/dpia-auto-fill-rules";
import { chatComplete, type AiLane, type ChatResult } from "./llm-door";

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const LOCALE_INSTRUCTIONS: Record<string, string> = {
  en: "Write the narrative in English.",
  es: "Redacta la narrativa en español de España (castellano peninsular), con terminología jurídica propia del RGPD y de la AEPD.",
};

export function buildDpiaSystemPrompt(locale: string = "en"): string {
  const languageLine = LOCALE_INSTRUCTIONS[locale] ?? LOCALE_INSTRUCTIONS.en;

  return `You are a senior data protection consultant specializing in GDPR compliance and Data Protection Impact Assessments (DPIAs). Your role is to evaluate the data processing context provided and produce a clear, structured risk assessment narrative.

Guidelines:
- ${languageLine}
- Write in formal, professional language suitable for a regulatory submission.
- Reference specific GDPR articles and EDPB guidelines where relevant.
- Identify concrete risks to data subjects' rights and freedoms.
- Assess likelihood (Remote, Possible, Likely) and severity (Minimal, Significant, Severe, Critical) for each risk.
- Recommend specific mitigation measures for each identified risk.
- If special category data or international transfers are involved, emphasize the heightened obligations.
- Keep the narrative concise but thorough — aim for 400-600 words.
- Do not invent facts; only assess what is provided in the context.`;
}

export function buildDpiaUserPrompt(context: AutoFillContext): string {
  const parts: string[] = [];

  parts.push(`## Processing Activity: ${context.activity.name}`);
  parts.push(`**Purpose:** ${context.activity.purpose}`);
  parts.push(`**Legal Basis:** ${context.activity.legalBasis}`);
  parts.push(
    `**Data Subjects:** ${context.activity.dataSubjects.join(", ") || "Not specified"}`
  );
  parts.push(
    `**Data Categories:** ${context.activity.categories.join(", ") || "Not specified"}`
  );
  parts.push(
    `**Recipients:** ${context.activity.recipients.join(", ") || "Not specified"}`
  );
  parts.push(`**Retention:** ${context.activity.retentionPeriod}`);

  if (context.activity.automatedDecisionMaking) {
    parts.push(
      `**Automated Decision-Making:** Yes${context.activity.automatedDecisionDetails ? ` — ${context.activity.automatedDecisionDetails}` : ""}`
    );
  }

  if (context.elements.length > 0) {
    parts.push("\n## Data Elements");
    for (const el of context.elements) {
      const special = el.isSpecialCategory ? " [SPECIAL CATEGORY]" : "";
      parts.push(`- ${el.name} (${el.category}, ${el.sensitivity})${special}`);
    }
  }

  if (context.assets.length > 0) {
    parts.push("\n## Systems / Assets");
    for (const asset of context.assets) {
      const vendor = asset.vendor ? ` (vendor: ${asset.vendor})` : "";
      const hosting = asset.hostingType ? ` [${asset.hostingType}]` : "";
      parts.push(`- ${asset.name} (${asset.type})${hosting}${vendor}`);
    }
  }

  if (context.transfers.length > 0) {
    parts.push("\n## International Transfers");
    for (const t of context.transfers) {
      const safeguards = t.safeguards ? ` | Safeguards: ${t.safeguards}` : "";
      parts.push(`- To ${t.destinationCountry} via ${t.mechanism}${safeguards}`);
    }
  }

  if (context.vendor) {
    parts.push("\n## Primary Vendor");
    parts.push(`- Name: ${context.vendor.name}`);
    parts.push(
      `- Certifications: ${context.vendor.certifications.join(", ") || "None"}`
    );
    parts.push(
      `- Operating in: ${context.vendor.countries.join(", ") || "Not specified"}`
    );
  }

  parts.push(
    "\n---\nPlease provide a risk assessment narrative covering: identified risks, likelihood and severity for each, and recommended mitigation measures."
  );

  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a risk assessment narrative through the LLM Door.
 *
 * Returns null if no engine is configured or the call fails — callers
 * always treat this as optional and keep the deterministic rule-based
 * suggestions from `dpia-auto-fill-rules.ts` as the baseline.
 */
export async function generateRiskNarrative(
  context: AutoFillContext,
  locale: string = "en",
  /** The organization's acknowledged posture — routes to that lane's engine. */
  lane?: AiLane
): Promise<ChatResult | null> {
  return chatComplete({
    system: buildDpiaSystemPrompt(locale),
    user: buildDpiaUserPrompt(context),
    maxTokens: 1500,
    temperature: 0.3,
    lane,
  });
}
