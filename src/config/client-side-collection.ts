// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Tools that collect their data in the visitor's browser or app, on the
 * organisation's public digital properties (websites and mobile apps), rather
 * than receiving it from the organisation's internal systems: web and product
 * analytics, session replay and heatmaps, tag managers, consent banners, ad
 * pixels, personalisation and A/B testing, content and experience platforms,
 * chat widgets, visitor identification and bot detection.
 *
 * For these the quick start draws the flow from the "Public website and apps"
 * record to the tool, and draws nothing from the tool onwards: an onward flow
 * (for example analytics signals sent to a CRM) is the customer's to declare.
 * Server-side tools (CRM, ERP, cloud, HR, payroll, finance) keep the flow
 * from the internal systems.
 *
 * Matched on the catalogue's subcategory first, then its category, case
 * insensitive.
 */

const CLIENT_SIDE_SUBCATEGORIES = new Set(
  [
    "Web Analytics",
    "Session Replay & Heatmaps",
    "Product Analytics",
    "Marketing Analytics & Attribution",
    "Tag Management",
    "Consent Management",
    "CMS",
    "Live Chat",
    "Chatbot",
    "Visitor Identification",
    "Bot Detection",
    "A/B Testing",
    "Conversion Optimization",
    "Digital Adoption",
    "Social Ads",
    "Programmatic",
    "Retargeting",
  ].map((s) => s.toLowerCase())
);

/** Categories whose every tool collects on the public properties. */
const CLIENT_SIDE_CATEGORIES = new Set(["Advertising", "Personalization & Engagement"].map((s) => s.toLowerCase()));

/** Whether a catalogue tool collects its data on the public website and apps. */
export function isClientSideCollection(category: string | null | undefined, subcategory?: string | null): boolean {
  const sub = (subcategory ?? "").trim().toLowerCase();
  if (sub && CLIENT_SIDE_SUBCATEGORIES.has(sub)) return true;
  const cat = (category ?? "").trim().toLowerCase();
  return CLIENT_SIDE_CATEGORIES.has(cat);
}

/** Marker on the one "Public website and apps" record of an organisation. */
export const PUBLIC_PROPERTIES_KIND = "public-properties";
