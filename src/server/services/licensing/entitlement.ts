import { AssessmentType, EntitlementStatus, LicenseType } from "@prisma/client";
import prisma from "@/lib/prisma";

// Premium assessment types that require entitlements
export const PREMIUM_ASSESSMENT_TYPES: AssessmentType[] = [
  "DPIA",
  "PIA",
  "TIA",
  "VENDOR",
];

// Free assessment types available to all users
export const FREE_ASSESSMENT_TYPES: AssessmentType[] = ["LIA", "CUSTOM"];

export interface EntitlementCheckResult {
  entitled: boolean;
  reason?: string;
  entitlement?: {
    id: string;
    licenseType: LicenseType;
    expiresAt: Date | null;
  };
}

/**
 * Check if an organization has entitlement to a specific assessment type
 */
export async function checkAssessmentEntitlement(
  organizationId: string,
  assessmentType: AssessmentType
): Promise<EntitlementCheckResult> {
  // Free assessment types don't require entitlement
  if (FREE_ASSESSMENT_TYPES.includes(assessmentType)) {
    return { entitled: true, reason: "Free assessment type" };
  }

  // Find the skill package for this assessment type
  const skillPackage = await prisma.skillPackage.findFirst({
    where: {
      assessmentType,
      isActive: true,
    },
  });

  if (!skillPackage) {
    return {
      entitled: false,
      reason: `No skill package found for ${assessmentType}`,
    };
  }

  // Find any customer linked to this organization with an active entitlement
  const customerOrg = await prisma.customerOrganization.findFirst({
    where: { organizationId },
    include: {
      customer: {
        include: {
          entitlements: {
            where: {
              skillPackageId: skillPackage.id,
              status: EntitlementStatus.ACTIVE,
            },
          },
        },
      },
    },
  });

  if (!customerOrg) {
    return {
      entitled: false,
      reason: "Organization is not linked to any customer account",
    };
  }

  const activeEntitlement = customerOrg.customer.entitlements.find((e) => {
    if (e.status !== EntitlementStatus.ACTIVE) return false;
    if (e.expiresAt && e.expiresAt < new Date()) return false;
    return true;
  });

  if (!activeEntitlement) {
    return {
      entitled: false,
      reason: `No active ${assessmentType} license found`,
    };
  }

  return {
    entitled: true,
    entitlement: {
      id: activeEntitlement.id,
      licenseType: activeEntitlement.licenseType,
      expiresAt: activeEntitlement.expiresAt,
    },
  };
}

/**
 * Get all entitlements for an organization
 */
export async function getOrganizationEntitlements(organizationId: string) {
  const customerOrg = await prisma.customerOrganization.findFirst({
    where: { organizationId },
    include: {
      customer: {
        include: {
          entitlements: {
            include: {
              skillPackage: true,
            },
          },
        },
      },
    },
  });

  if (!customerOrg) {
    return [];
  }

  return customerOrg.customer.entitlements;
}

/**
 * Check which assessment types an organization is entitled to
 */
export async function getEntitledAssessmentTypes(
  organizationId: string
): Promise<AssessmentType[]> {
  // Start with free types
  const entitledTypes: AssessmentType[] = [...FREE_ASSESSMENT_TYPES];

  // Check each premium type
  for (const assessmentType of PREMIUM_ASSESSMENT_TYPES) {
    const result = await checkAssessmentEntitlement(organizationId, assessmentType);
    if (result.entitled) {
      entitledTypes.push(assessmentType);
    }
  }

  return entitledTypes;
}

// ============================================================
// Admin Operations
// ============================================================

export interface CreateEntitlementParams {
  customerId: string;
  skillPackageId: string;
  licenseType: LicenseType;
  expiresAt?: Date;
}

/**
 * Create a new entitlement for a customer
 */
export async function createEntitlement(params: CreateEntitlementParams) {
  const { customerId, skillPackageId, licenseType, expiresAt } = params;

  return prisma.skillEntitlement.upsert({
    where: {
      customerId_skillPackageId: {
        customerId,
        skillPackageId,
      },
    },
    update: {
      licenseType,
      status: EntitlementStatus.ACTIVE,
      expiresAt,
    },
    create: {
      customerId,
      skillPackageId,
      licenseType,
      status: EntitlementStatus.ACTIVE,
      expiresAt,
    },
    include: {
      skillPackage: true,
      customer: true,
    },
  });
}

/**
 * Suspend an entitlement
 */
export async function suspendEntitlement(entitlementId: string) {
  return prisma.skillEntitlement.update({
    where: { id: entitlementId },
    data: { status: EntitlementStatus.SUSPENDED },
    include: {
      skillPackage: true,
      customer: true,
    },
  });
}

/**
 * Reactivate a suspended entitlement
 */
export async function reactivateEntitlement(entitlementId: string) {
  return prisma.skillEntitlement.update({
    where: { id: entitlementId },
    data: { status: EntitlementStatus.ACTIVE },
    include: {
      skillPackage: true,
      customer: true,
    },
  });
}

/**
 * Check if an assessment type is premium
 */
export function isPremiumAssessmentType(assessmentType: AssessmentType): boolean {
  return PREMIUM_ASSESSMENT_TYPES.includes(assessmentType);
}
