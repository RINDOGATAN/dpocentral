/**
 * Prompt builders — pure unit tests (no network, no DB).
 *
 * Locks that prompts are locale-aware (en default, es Castilian), grounded
 * in the provided server-built context, and structured for the right legal
 * instrument (Art. 33 to the DPA vs Art. 34 to data subjects).
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  buildDpiaSystemPrompt,
  buildDpiaUserPrompt,
} from "@/server/services/ai/assessment-generator";
import {
  buildBreachNotificationSystemPrompt,
  buildBreachNotificationUserPrompt,
} from "@/server/services/ai/prompts/breach-notification";
import type { AutoFillContext } from "@/config/dpia-auto-fill-rules";

const context: AutoFillContext = {
  activity: {
    name: "Customer Onboarding",
    purpose: "KYC verification",
    legalBasis: "LEGAL_OBLIGATION",
    dataSubjects: ["customers"],
    categories: ["IDENTITY", "FINANCIAL"],
    recipients: ["Compliance team"],
    retentionPeriod: "5 years",
    retentionDays: 1825,
    automatedDecisionMaking: true,
    automatedDecisionDetails: "Automated identity scoring",
  },
  assets: [
    { name: "CRM", type: "SAAS", hostingType: "CLOUD", vendor: "Salesforce" },
  ],
  elements: [
    { name: "Passport number", category: "IDENTITY", sensitivity: "HIGH", isSpecialCategory: false },
    { name: "Health note", category: "HEALTH", sensitivity: "HIGH", isSpecialCategory: true },
  ],
  transfers: [
    { destinationCountry: "US", mechanism: "SCC", safeguards: "Encryption" },
  ],
  vendor: {
    name: "Salesforce",
    certifications: ["ISO 27001"],
    countries: ["US", "IE"],
  },
};

describe("DPIA prompt builders", () => {
  it("system prompt is English by default and for unknown locales", () => {
    expect(buildDpiaSystemPrompt()).toContain("Write the narrative in English.");
    expect(buildDpiaSystemPrompt("fr")).toContain("Write the narrative in English.");
  });

  it("system prompt is Castilian Spanish for es", () => {
    const prompt = buildDpiaSystemPrompt("es");
    expect(prompt).toContain("castellano peninsular");
    expect(prompt).not.toContain("Write the narrative in English.");
  });

  it("user prompt is grounded in the context (activity, elements, transfers, vendor)", () => {
    const prompt = buildDpiaUserPrompt(context);
    expect(prompt).toContain("Customer Onboarding");
    expect(prompt).toContain("KYC verification");
    expect(prompt).toContain("[SPECIAL CATEGORY]");
    expect(prompt).toContain("To US via SCC");
    expect(prompt).toContain("Salesforce");
    expect(prompt).toContain("Automated Decision-Making:** Yes");
  });
});

describe("breach notification prompt builders", () => {
  const input = {
    incident: {
      title: "Phishing compromise",
      description: "Mailbox accessed by a third party",
      type: "PHISHING",
      severity: "HIGH",
      discoveredAt: new Date("2026-07-01T10:00:00Z"),
      discoveredBy: "SOC",
      discoveryMethod: "Alert",
      affectedRecords: 1200,
      affectedSubjects: ["customers"],
      dataCategories: ["CONTACT", "IDENTITY"],
      containedAt: new Date("2026-07-01T14:00:00Z"),
      containmentActions: "Password reset",
      rootCause: "Credential phishing",
    },
    notification: {
      recipientType: "DPA",
      deadline: new Date("2026-07-04T10:00:00Z"),
    },
    jurisdiction: { name: "Spain (AEPD)", breachNotificationHours: 72 },
    organizationName: "Acme Corporation",
  };

  it("DPA recipient gets an Art. 33 structured system prompt", () => {
    const prompt = buildBreachNotificationSystemPrompt("DPA", "en");
    expect(prompt).toContain("Article 33");
    expect(prompt).toContain("supervisory authority");
    expect(prompt).toContain("Write the draft in English.");
  });

  it("data-subject recipient gets an Art. 34 plain-language system prompt", () => {
    const prompt = buildBreachNotificationSystemPrompt("DATA_SUBJECT", "en");
    expect(prompt).toContain("Article 34");
    expect(prompt).toContain("clear and plain language");
  });

  it("es locale produces a Castilian instruction", () => {
    const prompt = buildBreachNotificationSystemPrompt("DPA", "es");
    expect(prompt).toContain("castellano peninsular");
  });

  it("user prompt is grounded in the incident and jurisdiction", () => {
    const prompt = buildBreachNotificationUserPrompt(input);
    expect(prompt).toContain("Acme Corporation");
    expect(prompt).toContain("Phishing compromise");
    expect(prompt).toContain("1200");
    expect(prompt).toContain("Spain (AEPD)");
    expect(prompt).toContain("72 hours");
    expect(prompt).toContain("Password reset");
  });
});
