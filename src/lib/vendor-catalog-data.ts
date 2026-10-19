// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The personal data a catalogue vendor typically processes, suggested from its
 * catalogue category when a vendor is added from the catalogue. The catalogue
 * holds no per-vendor data categories, so this is a starting point the person
 * sees preselected on the form and adjusts; it is never saved without them.
 *
 * Pure, so the suggestion is tested (tests/navigation-progress.test.ts).
 */

const BY_CATEGORY: Record<string, readonly string[]> = {
  "Cloud Infrastructure": ["IDENTIFIERS"],
  "Data Warehouse & Integration": ["IDENTIFIERS", "BEHAVIORAL"],
  "Analytics & BI": ["IDENTIFIERS", "BEHAVIORAL"],
  "Customer Data Platform": ["IDENTIFIERS", "BEHAVIORAL", "DEMOGRAPHICS"],
  "CRM & Sales": ["IDENTIFIERS"],
  "Marketing Automation": ["IDENTIFIERS", "BEHAVIORAL"],
  Advertising: ["IDENTIFIERS", "BEHAVIORAL", "LOCATION"],
  "Content Management": ["IDENTIFIERS"],
  "E-commerce": ["IDENTIFIERS", "FINANCIAL"],
  "Payment Processing": ["IDENTIFIERS", "FINANCIAL"],
  Communication: ["IDENTIFIERS"],
  "Customer Support": ["IDENTIFIERS"],
  "Personalization & Engagement": ["IDENTIFIERS", "BEHAVIORAL"],
  "HR & People": ["IDENTIFIERS", "EMPLOYMENT"],
  "Productivity & Collaboration": ["IDENTIFIERS"],
  "Developer Tools": ["IDENTIFIERS"],
  "Security & Identity": ["IDENTIFIERS"],
  "Privacy & Consent": ["IDENTIFIERS"],
  "AI & Machine Learning": ["IDENTIFIERS"],
  "Legal & Compliance": ["IDENTIFIERS"],
  "Design & Creative": ["IDENTIFIERS"],
  "Surveys & Research": ["IDENTIFIERS", "DEMOGRAPHICS"],
};

/** Suggested data categories for a catalogue category (contact data at the least). */
export function suggestedDataCategories(catalogCategory: string | null | undefined): string[] {
  return [...(BY_CATEGORY[catalogCategory ?? ""] ?? ["IDENTIFIERS"])];
}
