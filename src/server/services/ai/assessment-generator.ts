/**
 * AI Assessment Generator Service (Feature 3 - Optional AI Enhancement)
 *
 * Generates risk assessment narratives for DPIAs using an LLM (OpenAI or
 * Anthropic). This is entirely optional — if neither API key is configured,
 * all exports are safe no-ops that return null.
 *
 * No additional packages are required; this uses native fetch.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import type { AutoFillContext } from "@/config/dpia-auto-fill-rules";
import { logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

type Provider = "openai" | "anthropic" | null;

function getProvider(): Provider {
  if (OPENAI_API_KEY) return "openai";
  if (ANTHROPIC_API_KEY) return "anthropic";
  return null;
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

function buildSystemPrompt(): string {
  return `You are a senior data protection consultant specializing in GDPR compliance and Data Protection Impact Assessments (DPIAs). Your role is to evaluate the data processing context provided and produce a clear, structured risk assessment narrative.

Guidelines:
- Write in formal, professional language suitable for a regulatory submission.
- Reference specific GDPR articles and EDPB guidelines where relevant.
- Identify concrete risks to data subjects' rights and freedoms.
- Assess likelihood (Remote, Possible, Likely) and severity (Minimal, Significant, Severe, Critical) for each risk.
- Recommend specific mitigation measures for each identified risk.
- If special category data or international transfers are involved, emphasize the heightened obligations.
- Keep the narrative concise but thorough — aim for 400-600 words.
- Do not invent facts; only assess what is provided in the context.`;
}

function buildUserPrompt(context: AutoFillContext): string {
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
      const hosting = asset.hostingType
        ? ` [${asset.hostingType}]`
        : "";
      parts.push(`- ${asset.name} (${asset.type})${hosting}${vendor}`);
    }
  }

  if (context.transfers.length > 0) {
    parts.push("\n## International Transfers");
    for (const t of context.transfers) {
      const safeguards = t.safeguards ? ` | Safeguards: ${t.safeguards}` : "";
      parts.push(
        `- To ${t.destinationCountry} via ${t.mechanism}${safeguards}`
      );
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
// API Calls
// ---------------------------------------------------------------------------

async function callOpenAI(
  systemPrompt: string,
  userPrompt: string
): Promise<string | null> {
  try {
    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: 1500,
          temperature: 0.3,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      logger.error("OpenAI API call failed", undefined, {
        status: response.status,
        error: errorText,
      });
      return null;
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };

    return data.choices?.[0]?.message?.content ?? null;
  } catch (error) {
    logger.error("OpenAI API call threw", undefined, {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function callAnthropic(
  systemPrompt: string,
  userPrompt: string
): Promise<string | null> {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      logger.error("Anthropic API call failed", undefined, {
        status: response.status,
        error: errorText,
      });
      return null;
    }

    const data = (await response.json()) as {
      content?: { type: string; text?: string }[];
    };

    const textBlock = data.content?.find((b) => b.type === "text");
    return textBlock?.text ?? null;
  } catch (error) {
    logger.error("Anthropic API call threw", undefined, {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a risk assessment narrative using an AI provider.
 *
 * Returns null if:
 * - No AI API key is configured (graceful no-op)
 * - The API call fails for any reason
 *
 * Callers should always treat this as optional and fall back to the
 * rule-based auto-fill responses from `dpia-auto-fill-rules.ts`.
 */
export async function generateRiskNarrative(
  context: AutoFillContext
): Promise<string | null> {
  const provider = getProvider();

  if (!provider) {
    return null;
  }

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(context);

  switch (provider) {
    case "openai":
      return callOpenAI(systemPrompt, userPrompt);
    case "anthropic":
      return callAnthropic(systemPrompt, userPrompt);
    default:
      return null;
  }
}

/**
 * Check whether an AI provider is available for narrative generation.
 */
export function isAIAvailable(): boolean {
  return getProvider() !== null;
}

/**
 * Get the name of the configured AI provider (for display in UI).
 */
export function getAIProviderName(): string | null {
  const provider = getProvider();
  if (provider === "openai") return "OpenAI";
  if (provider === "anthropic") return "Anthropic";
  return null;
}
