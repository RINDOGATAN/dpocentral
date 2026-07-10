// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Offline licence activation for premium skills.
 *
 * Ingests Ed25519-signed licence files issued by the TODO.LAW storefront
 * (same keypair as Dealroom — see src/lib/license-crypto.ts) and materializes
 * them as SkillEntitlement rows, so every existing entitlement gate
 * (checkAssessmentEntitlement, hasVendorCatalogAccess, ...) works unchanged.
 * This is the Stripe-less purchase path — the primary one for sovereign
 * self-host installs.
 *
 * Licences are bound to the BUYER'S EMAIL (carried in the licence's
 * customerId field): the signed-in user activating the licence must be the
 * buyer. Entitlements live on the Customer, which is linked to the activating
 * organization — linked orgs inherit them.
 */

import { Customer, EntitlementStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  LicenseFile,
  isLicenseExpired,
  verifyLicenseFile,
} from "@/lib/license-crypto";
import { getMachineInfo } from "./fingerprint";

export interface ActivationResult {
  success: boolean;
  error?: string;
  activationId?: string;
  skillId?: string;
  skillName?: string;
  expiresAt?: Date;
}

/**
 * Resolve the Customer for an organization, creating and linking one keyed by
 * the user's email when none exists. Same resolution order as the Stripe
 * checkout route (src/app/api/checkout/route.ts): org link first, then by
 * email, then create.
 */
export async function getOrCreateCustomerForOrg(params: {
  organizationId: string;
  email: string;
  name?: string | null;
}): Promise<Customer> {
  const { organizationId, email, name } = params;

  const customerOrg = await prisma.customerOrganization.findFirst({
    where: { organizationId },
    include: { customer: true },
  });
  if (customerOrg) {
    return customerOrg.customer;
  }

  const existingByEmail = await prisma.customer.findUnique({
    where: { email },
  });
  if (existingByEmail) {
    await prisma.customerOrganization.create({
      data: { customerId: existingByEmail.id, organizationId },
    });
    return existingByEmail;
  }

  return prisma.customer.create({
    data: {
      name: name || email,
      email,
      type: "SELF_HOSTED",
      organizations: { create: { organizationId } },
    },
  });
}

/**
 * Activate a premium skill from an offline licence file.
 */
export async function activateOffline(
  licenseFile: LicenseFile,
  user: { email: string; name?: string | null },
  organizationId: string
): Promise<ActivationResult> {
  if (!verifyLicenseFile(licenseFile)) {
    return { success: false, error: "Invalid license file signature" };
  }

  if (isLicenseExpired(licenseFile)) {
    return { success: false, error: "License file has expired" };
  }

  // Licences are bound to the buyer's email — the only identifier shared with
  // the storefront. The signed-in user must be the buyer.
  if (
    licenseFile.customerId.trim().toLowerCase() !==
    user.email.trim().toLowerCase()
  ) {
    return {
      success: false,
      error: "License file does not belong to this account",
    };
  }

  const skillPackage = await prisma.skillPackage.findUnique({
    where: { skillId: licenseFile.skillId },
  });
  if (!skillPackage || !skillPackage.isActive) {
    return { success: false, error: "Skill package not installed" };
  }

  const customer = await getOrCreateCustomerForOrg({
    organizationId,
    email: user.email,
    name: licenseFile.customerName || user.name,
  });

  // A licence key already registered under a different customer means the
  // file is being replayed against another account — refuse.
  const byLicenseKey = await prisma.skillEntitlement.findUnique({
    where: { licenseKey: licenseFile.licenseKey },
  });
  if (byLicenseKey && byLicenseKey.customerId !== customer.id) {
    return {
      success: false,
      error: "License file does not belong to this account",
    };
  }

  // Upsert (not create): an admin- or Stripe-created entitlement for the same
  // skill may already exist — the licence file refreshes its terms.
  const entitlement = await prisma.skillEntitlement.upsert({
    where: {
      customerId_skillPackageId: {
        customerId: customer.id,
        skillPackageId: skillPackage.id,
      },
    },
    update: {
      licenseKey: licenseFile.licenseKey,
      licenseType: licenseFile.licenseType,
      maxActivations: licenseFile.maxActivations,
      expiresAt: licenseFile.expiresAt ? new Date(licenseFile.expiresAt) : null,
      status: EntitlementStatus.ACTIVE,
    },
    create: {
      customerId: customer.id,
      skillPackageId: skillPackage.id,
      licenseKey: licenseFile.licenseKey,
      licenseType: licenseFile.licenseType,
      maxActivations: licenseFile.maxActivations,
      expiresAt: licenseFile.expiresAt ? new Date(licenseFile.expiresAt) : null,
      status: EntitlementStatus.ACTIVE,
    },
    include: { activations: true },
  });

  const machineInfo = getMachineInfo();

  // Re-activation on the same installation is idempotent.
  const existingActivation = entitlement.activations.find(
    (a) => a.instanceId === machineInfo.instanceId
  );
  if (existingActivation) {
    await prisma.skillActivation.update({
      where: { id: existingActivation.id },
      data: { lastSeenAt: new Date() },
    });
    return {
      success: true,
      activationId: existingActivation.id,
      skillId: skillPackage.skillId,
      skillName: skillPackage.displayName,
      expiresAt: entitlement.expiresAt || undefined,
    };
  }

  if (entitlement.activations.length >= entitlement.maxActivations) {
    return {
      success: false,
      error: `Activation limit reached (${entitlement.maxActivations})`,
    };
  }

  const activation = await prisma.skillActivation.create({
    data: {
      entitlementId: entitlement.id,
      customerId: customer.id,
      instanceId: machineInfo.instanceId,
      machineHash: machineInfo.fingerprint,
    },
  });

  return {
    success: true,
    activationId: activation.id,
    skillId: skillPackage.skillId,
    skillName: skillPackage.displayName,
    expiresAt: entitlement.expiresAt || undefined,
  };
}

/**
 * Remove an activation (frees a slot on the licence). The activation must
 * belong to a customer linked to the calling organization.
 */
export async function deactivateForOrg(
  activationId: string,
  organizationId: string
): Promise<{ success: boolean; error?: string }> {
  const activation = await prisma.skillActivation.findUnique({
    where: { id: activationId },
    include: {
      customer: {
        include: { organizations: { where: { organizationId } } },
      },
    },
  });

  if (!activation || activation.customer.organizations.length === 0) {
    return { success: false, error: "Activation not found" };
  }

  await prisma.skillActivation.delete({ where: { id: activationId } });
  return { success: true };
}
