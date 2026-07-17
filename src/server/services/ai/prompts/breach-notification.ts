// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Art. 33 / Art. 34 breach-notification prompt builder.
 *
 * Builds the prompts for an AI-drafted breach notification from
 * Prisma-derived incident data (never from client-supplied text). Pure
 * functions — no network, no DB. Callers pass the posture gate first and
 * send the result through the one LLM Door.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

// ---------------------------------------------------------------------------
// Types (plain data so the builder stays pure and unit-testable)
// ---------------------------------------------------------------------------

export interface BreachNotificationInput {
  incident: {
    title: string;
    description: string;
    type: string;
    severity: string;
    discoveredAt: Date;
    discoveredBy?: string | null;
    discoveryMethod?: string | null;
    affectedRecords?: number | null;
    affectedSubjects: string[];
    dataCategories: string[];
    containedAt?: Date | null;
    containmentActions?: string | null;
    rootCause?: string | null;
  };
  notification: {
    /** "DPA" (Art. 33) or "DATA_SUBJECT" / other (Art. 34). */
    recipientType: string;
    deadline: Date;
  };
  jurisdiction?: {
    name: string;
    breachNotificationHours: number;
  } | null;
  organizationName: string;
}

const LOCALE_INSTRUCTIONS: Record<string, string> = {
  en: "Write the draft in English.",
  es: "Redacta el borrador en español de España (castellano peninsular), con la terminología del RGPD y de la AEPD.",
};

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

export function buildBreachNotificationSystemPrompt(
  recipientType: string,
  locale: string = "en"
): string {
  const languageLine = LOCALE_INSTRUCTIONS[locale] ?? LOCALE_INSTRUCTIONS.en;
  const isDpa = recipientType.toUpperCase() === "DPA";

  const audience = isDpa
    ? `You are drafting a personal data breach notification to a supervisory authority under Article 33 GDPR. Structure the draft around the Art. 33(3) required content:
- (a) the nature of the breach including, where possible, the categories and approximate number of data subjects and records concerned;
- (b) the name and contact details of the data protection officer or other contact point;
- (c) the likely consequences of the breach;
- (d) the measures taken or proposed to address the breach and mitigate its possible adverse effects.
Use placeholders in square brackets (e.g. [DPO contact details]) for facts not present in the context.`
    : `You are drafting a communication of a personal data breach to the affected data subjects under Article 34 GDPR. Use clear and plain language: describe the nature of the breach, the likely consequences, the measures taken or proposed, and the contact point for more information (Art. 34(2) referring to Art. 33(3)(b), (c) and (d)). Use placeholders in square brackets for facts not present in the context.`;

  return `You are a senior data protection lawyer drafting breach notifications for a controller. ${audience}

Guidelines:
- ${languageLine}
- Formal, precise, factual tone; no speculation beyond what the context supports.
- Do not invent facts; only use what is provided, with bracketed placeholders for gaps.
- This is a DRAFT for review by the organization's privacy team — do not claim it has been sent or approved.
- Keep it under 600 words.`;
}

export function buildBreachNotificationUserPrompt(
  input: BreachNotificationInput
): string {
  const { incident, notification, jurisdiction, organizationName } = input;
  const parts: string[] = [];

  parts.push(`## Controller\n${organizationName}`);
  parts.push(`\n## Incident: ${incident.title}`);
  parts.push(`**Type:** ${incident.type}`);
  parts.push(`**Severity:** ${incident.severity}`);
  parts.push(`**Description:** ${incident.description}`);
  parts.push(`**Discovered at:** ${incident.discoveredAt.toISOString()}`);
  if (incident.discoveredBy) parts.push(`**Discovered by:** ${incident.discoveredBy}`);
  if (incident.discoveryMethod)
    parts.push(`**Discovery method:** ${incident.discoveryMethod}`);
  if (incident.affectedRecords != null)
    parts.push(`**Approximate records affected:** ${incident.affectedRecords}`);
  if (incident.affectedSubjects.length > 0)
    parts.push(`**Data subjects affected:** ${incident.affectedSubjects.join(", ")}`);
  if (incident.dataCategories.length > 0)
    parts.push(`**Data categories affected:** ${incident.dataCategories.join(", ")}`);
  if (incident.containedAt)
    parts.push(`**Contained at:** ${incident.containedAt.toISOString()}`);
  if (incident.containmentActions)
    parts.push(`**Containment actions:** ${incident.containmentActions}`);
  if (incident.rootCause) parts.push(`**Root cause:** ${incident.rootCause}`);

  parts.push(`\n## Notification`);
  parts.push(`**Recipient:** ${notification.recipientType}`);
  parts.push(`**Deadline:** ${notification.deadline.toISOString()}`);
  if (jurisdiction) {
    parts.push(
      `**Jurisdiction:** ${jurisdiction.name} (notification window: ${jurisdiction.breachNotificationHours} hours)`
    );
  }

  parts.push(
    "\n---\nPlease draft the notification described above, ready for the privacy team to review, complete the bracketed placeholders, and send."
  );

  return parts.join("\n");
}
