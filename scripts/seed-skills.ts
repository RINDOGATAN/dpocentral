import { PrismaClient, AssessmentType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding skill packages...");

  const STRIPE_PRICE_DPIA = process.env.STRIPE_PRICE_DPIA || null;
  const STRIPE_PRICE_COMPLETE = process.env.STRIPE_PRICE_COMPLETE || null;
  const STRIPE_PRICE_VENDOR_CATALOG = process.env.STRIPE_PRICE_VENDOR_CATALOG || null;

  const skillPackages = [
    {
      id: "skill-vendor-catalog",
      skillId: "com.nel.dpocentral.vendor-catalog",
      name: "VENDOR_CATALOG",
      displayName: "Vendor Catalog",
      assessmentType: null,
      description: "Access to pre-audited vendor database with 400+ MarTech, AI, and SaaS vendors. Search, autofill, and track vendor compliance information.",
      isPremium: true,
      isActive: true,
      stripePriceId: STRIPE_PRICE_VENDOR_CATALOG,
      priceAmount: 2900,
      priceCurrency: "usd",
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
      priceAmount: 4900,
      priceCurrency: "usd",
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
      stripePriceId: null,
      priceAmount: null,
      priceCurrency: null,
    },
    {
      id: "skill-tia",
      skillId: "com.nel.dpocentral.tia",
      name: "TIA",
      displayName: "Transfer Impact Assessment",
      assessmentType: AssessmentType.TIA,
      description: "Assess the risks of international data transfers and document appropriate safeguards.",
      isPremium: true,
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
      stripePriceId: null,
      priceAmount: null,
      priceCurrency: null,
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
      id: "skill-complete",
      skillId: "com.nel.dpocentral.complete",
      name: "COMPLETE",
      displayName: "Complete Assessment Suite",
      assessmentType: null,
      description: "Full access to all premium assessment types: DPIA, PIA, TIA, and Vendor Risk Assessments. Includes Vendor Catalog access.",
      isPremium: true,
      isActive: true,
      stripePriceId: STRIPE_PRICE_COMPLETE,
      priceAmount: 14900,
      priceCurrency: "usd",
    },
  ];

  for (const pkg of skillPackages) {
    await prisma.skillPackage.upsert({
      where: { id: pkg.id },
      update: pkg,
      create: pkg,
    });
  }

  console.log(`Seeded ${skillPackages.length} skill packages.`);
}

main()
  .catch((e) => {
    console.error("Error seeding skill packages:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
