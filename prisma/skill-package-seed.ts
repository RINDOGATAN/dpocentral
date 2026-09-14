// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The skill_packages rows every install carries.
 *
 * These skillIds are the contract with the TODO.LAW storefront: an offline
 * licence file (src/server/services/licensing/activation.ts) only activates
 * when its skillId matches a row seeded here. A new sellable skill = a new
 * entry in this list (+ an entitlement gate at its router). The list lives in
 * its own module so tests can assert the storefront's ids are present without
 * running the seed (tests/offline-activation.test.ts).
 *
 * Two namespaces appear on purpose. DPO Central's own modules are
 * `com.nel.dpocentral.*`. Two privacy skills that the storefront catalogues in
 * the shared legal-skills namespace (`com.nel.skills.*`) are DPO Central
 * content by nature (assessment type DPIA and VENDOR); the storefront issues
 * licences under those ids, so the rows carry them verbatim. They are sold on
 * the storefront only (no Stripe price, no in-app price), which also keeps
 * them out of the flip-day grace plan.
 */

import { AssessmentType, BillingInterval } from "@prisma/client";
import { SKILL_PRICE_CENTS, SKILL_PRICE_CURRENCY } from "../src/config/skill-packages";
import {
  DPIA_COMPANION_SKILL_ID,
  VENDOR_RISK_SKILL_ID,
} from "../src/server/services/licensing/skill-ids";

export interface SkillPackageSeedRow {
  id: string;
  skillId: string;
  name: string;
  displayName: string;
  assessmentType: AssessmentType | null;
  description: string;
  isPremium: boolean;
  isActive: boolean;
  stripePriceId: string | null;
  priceAmount: number | null;
  priceCurrency: string | null;
  billingInterval?: BillingInterval;
}

/**
 * Build the rows. Stripe price ids come from the environment (hosted only);
 * a skill-specific STRIPE_PRICE_* falls back to the shared STRIPE_PRICE_ID.
 */
export function buildSkillPackageSeed(
  env: Record<string, string | undefined> = process.env
): SkillPackageSeedRow[] {
  const STRIPE_PRICE_DEFAULT = env.STRIPE_PRICE_ID || null;
  const STRIPE_PRICE_DPIA = env.STRIPE_PRICE_DPIA || STRIPE_PRICE_DEFAULT;
  const STRIPE_PRICE_PIA = env.STRIPE_PRICE_PIA || STRIPE_PRICE_DEFAULT;
  const STRIPE_PRICE_VENDOR = env.STRIPE_PRICE_VENDOR || STRIPE_PRICE_DEFAULT;
  const STRIPE_PRICE_VENDOR_CATALOG = env.STRIPE_PRICE_VENDOR_CATALOG || STRIPE_PRICE_DEFAULT;
  const STRIPE_PRICE_ROPA_EXPORT = env.STRIPE_PRICE_ROPA_EXPORT || STRIPE_PRICE_DEFAULT;

  return [
    {
      id: "skill-vendor-catalog",
      skillId: "com.nel.dpocentral.vendor-catalog",
      name: "VENDOR_CATALOG",
      displayName: "Vendor Catalog",
      assessmentType: null, // Not an assessment - it's a feature skill
      description: "Access to a starter catalog of common MarTech, AI, and SaaS processors. Search, autofill, and track vendor information — assess each vendor before relying on catalog data.",
      isPremium: true,
      isActive: true,
      stripePriceId: STRIPE_PRICE_VENDOR_CATALOG,
      priceAmount: SKILL_PRICE_CENTS,
      priceCurrency: SKILL_PRICE_CURRENCY,
      billingInterval: BillingInterval.YEAR,
    },
    {
      id: "skill-dpia",
      skillId: "com.nel.dpocentral.dpia",
      name: "DPIA",
      displayName: "Data Protection Impact Assessment",
      assessmentType: AssessmentType.DPIA,
      description: "Conduct GDPR Article 35 compliant Data Protection Impact Assessments for high-risk processing activities.",
      isPremium: true,
      isActive: true,
      stripePriceId: STRIPE_PRICE_DPIA,
      priceAmount: SKILL_PRICE_CENTS,
      priceCurrency: SKILL_PRICE_CURRENCY,
      billingInterval: BillingInterval.YEAR,
    },
    {
      id: "skill-pia",
      skillId: "com.nel.dpocentral.pia",
      name: "PIA",
      displayName: "Privacy Impact Assessment",
      assessmentType: AssessmentType.PIA,
      description: "Comprehensive privacy impact assessments for new projects, systems, and initiatives.",
      isPremium: true,
      isActive: true,
      stripePriceId: STRIPE_PRICE_PIA,
      priceAmount: SKILL_PRICE_CENTS,
      priceCurrency: SKILL_PRICE_CURRENCY,
      billingInterval: BillingInterval.YEAR,
    },
    {
      id: "skill-tia",
      skillId: "com.nel.dpocentral.tia",
      name: "TIA",
      displayName: "Transfer Impact Assessment",
      assessmentType: AssessmentType.TIA,
      description: "Assess the risks of international data transfers and document appropriate safeguards.",
      isPremium: false,
      isActive: true,
      stripePriceId: null,
      priceAmount: null,
      priceCurrency: null,
    },
    {
      id: "skill-vendor",
      skillId: "com.nel.dpocentral.vendor",
      name: "VENDOR",
      displayName: "Vendor Risk Assessment",
      assessmentType: AssessmentType.VENDOR,
      description: "Evaluate third-party vendor privacy and security risks with comprehensive questionnaires.",
      isPremium: true,
      isActive: true,
      stripePriceId: STRIPE_PRICE_VENDOR,
      priceAmount: SKILL_PRICE_CENTS,
      priceCurrency: SKILL_PRICE_CURRENCY,
      billingInterval: BillingInterval.YEAR,
    },
    {
      id: "skill-lia",
      skillId: "com.nel.dpocentral.lia",
      name: "LIA",
      displayName: "Legitimate Interest Assessment",
      assessmentType: AssessmentType.LIA,
      description: "Document and balance legitimate interests against data subject rights.",
      isPremium: false,
      isActive: true,
      stripePriceId: null,
      priceAmount: null,
      priceCurrency: null,
    },
    {
      id: "skill-custom",
      skillId: "com.nel.dpocentral.custom",
      name: "CUSTOM",
      displayName: "Custom Assessment",
      assessmentType: AssessmentType.CUSTOM,
      description: "Create and conduct custom assessments tailored to your organization's needs.",
      isPremium: false,
      isActive: true,
      stripePriceId: null,
      priceAmount: null,
      priceCurrency: null,
    },
    {
      id: "skill-ropa-export",
      skillId: "com.nel.dpocentral.ropa-export",
      name: "ROPA_EXPORT",
      displayName: "ROPA Export",
      assessmentType: null,
      description: "Export your Record of Processing Activities (ROPA) as CSV or JSON for GDPR Article 30 compliance.",
      isPremium: true,
      isActive: true,
      stripePriceId: STRIPE_PRICE_ROPA_EXPORT,
      priceAmount: SKILL_PRICE_CENTS,
      priceCurrency: SKILL_PRICE_CURRENCY,
      billingInterval: BillingInterval.YEAR,
    },
    {
      id: "skill-dsar-portal",
      skillId: "com.nel.dpocentral.dsar-portal",
      name: "DSAR_PORTAL",
      displayName: "DSAR Public Portal",
      assessmentType: null,
      description: "Public-facing portal for data subjects to submit access, erasure, and other GDPR requests.",
      isPremium: true,
      isActive: true,
      stripePriceId: null, // Coming soon — not purchasable yet
      priceAmount: null,
      priceCurrency: null,
    },
    // Complete Package - kept for existing entitlements, no longer sold individually
    {
      id: "skill-complete",
      skillId: "com.nel.dpocentral.complete",
      name: "COMPLETE",
      displayName: "Complete Assessment Suite",
      assessmentType: null, // Bundle - grants access to DPIA, PIA, TIA, VENDOR
      description: "Full access to all premium assessment types: DPIA, PIA, TIA, and Vendor Risk Assessments. Includes Vendor Catalog access.",
      isPremium: true,
      isActive: true,
      stripePriceId: null,
      priceAmount: null,
      priceCurrency: null,
    },
    // Storefront skills catalogued in the shared legal-skills namespace.
    // Display names and descriptions mirror the storefront catalogue
    // (todo.law/legalskills). Sold on the storefront only: an annual licence
    // file activated in-app, never a Stripe checkout here.
    {
      id: "skill-dpia-companion",
      skillId: DPIA_COMPANION_SKILL_ID,
      name: "DPIA_COMPANION",
      displayName: "DPIA Companion",
      assessmentType: AssessmentType.DPIA,
      description: "Screens whether a Data Protection Impact Assessment is legally required (Art. 35 GDPR, WP248 nine criteria, AEPD/ICO national lists), conducts and reviews full DPIAs on the AEPD/ICO methodology, runs the Art. 36 prior-consultation gate, and maps an existing DPIA to US state risk assessments (CCPA/CPRA, Colorado, Virginia).",
      isPremium: true,
      isActive: true,
      stripePriceId: null,
      priceAmount: null,
      priceCurrency: null,
      billingInterval: BillingInterval.YEAR,
    },
    {
      id: "skill-vendor-risk",
      skillId: VENDOR_RISK_SKILL_ID,
      name: "VENDOR_RISK",
      displayName: "Vendor Privacy Risk Assessment",
      assessmentType: AssessmentType.VENDOR,
      description: "Assesses the privacy and data-protection risk of engaging, retaining, or re-assessing a vendor, processor, or sub-processor: due diligence, Art. 28 DPA review posture, sub-processor chains, international transfers (SCCs/DPF), CCPA/CPRA service-provider terms, LGPD, and EU AI Act value-chain roles where the vendor supplies AI.",
      isPremium: true,
      isActive: true,
      stripePriceId: null,
      priceAmount: null,
      priceCurrency: null,
      billingInterval: BillingInterval.YEAR,
    },
  ];
}
