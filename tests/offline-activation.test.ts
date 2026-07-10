/**
 * Offline licence activation tests.
 *
 * Locks the Ed25519 licence-file path end to end: canonical signing/verify
 * (byte-compatible with Dealroom and the TODO.LAW storefront), the
 * activateOffline flow (email binding, expiry, activation limits,
 * idempotency), and the OWNER/ADMIN role gate on skills.activateOffline.
 *
 * A fresh keypair is generated per run and injected via
 * SKILL_SIGNING_PUBLIC_KEY (read lazily by src/lib/license-crypto.ts);
 * licences are signed with the same canonical payload the storefront uses.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import type { OrganizationRole } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  prisma: {
    organizationMember: { findUnique: vi.fn() },
    skillPackage: { findUnique: vi.fn(), findMany: vi.fn() },
    customer: { findUnique: vi.fn(), create: vi.fn() },
    customerOrganization: { findFirst: vi.fn(), create: vi.fn() },
    skillEntitlement: { findUnique: vi.fn(), upsert: vi.fn() },
    skillActivation: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import {
  generateEd25519KeyPair,
  signEd25519,
  canonicalLicensePayload,
  verifyLicenseFile,
  isLicenseExpired,
  type LicenseFile,
} from "@/lib/license-crypto";
import { skillsRouter } from "@/server/routers/skills";
import { callerFor, sessionFor } from "./helpers";

const ORG = { id: "org-1", name: "Org", slug: "org" };
const BUYER_EMAIL = "buyer@test.example";
const PACKAGE = {
  id: "pkg-dpia",
  skillId: "com.nel.dpocentral.dpia",
  name: "DPIA",
  displayName: "Data Protection Impact Assessment",
  isActive: true,
};

let keys: { publicKey: string; privateKey: string };

/** Sign a licence the way the storefront does (canonical field order). */
function issueLicense(overrides: Partial<Omit<LicenseFile, "signature">> = {}): LicenseFile {
  const fields: Omit<LicenseFile, "signature"> = {
    licenseKey: "LIC-AB12-CD34-EF56-0789",
    customerId: BUYER_EMAIL,
    customerName: "Buyer LLC",
    skillId: PACKAGE.skillId,
    jurisdictions: [],
    licenseType: "PERPETUAL",
    maxActivations: 3,
    issuedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
  const signature = signEd25519(canonicalLicensePayload(fields), keys.privateKey).toString("base64");
  return { ...fields, signature };
}

function callerWithRole(role: OrganizationRole, email = BUYER_EMAIL) {
  mocks.prisma.organizationMember.findUnique.mockResolvedValue({
    id: "member-1",
    userId: "user-1",
    organizationId: ORG.id,
    role,
    organization: ORG,
  });
  return callerFor(skillsRouter, sessionFor("user-1", email)) as ReturnType<
    typeof skillsRouter.createCaller
  >;
}

beforeAll(() => {
  keys = generateEd25519KeyPair();
  process.env.SKILL_SIGNING_PUBLIC_KEY = keys.publicKey;
  process.env.DPO_INSTANCE_ID = "inst_test";
});

beforeEach(() => {
  vi.clearAllMocks();
  // Default happy path: package installed, no customer yet, no prior
  // entitlement or activation.
  mocks.prisma.skillPackage.findUnique.mockResolvedValue(PACKAGE);
  mocks.prisma.customerOrganization.findFirst.mockResolvedValue(null);
  mocks.prisma.customer.findUnique.mockResolvedValue(null);
  mocks.prisma.customer.create.mockResolvedValue({
    id: "cust-1",
    email: BUYER_EMAIL,
    name: "Buyer LLC",
    type: "SELF_HOSTED",
  });
  mocks.prisma.skillEntitlement.findUnique.mockResolvedValue(null);
  mocks.prisma.skillEntitlement.upsert.mockResolvedValue({
    id: "ent-1",
    customerId: "cust-1",
    skillPackageId: PACKAGE.id,
    status: "ACTIVE",
    maxActivations: 3,
    expiresAt: null,
    activations: [],
  });
  mocks.prisma.skillActivation.create.mockResolvedValue({ id: "act-1" });
});

describe("licence file crypto (storefront contract)", () => {
  it("verifies a licence signed with the canonical payload", () => {
    expect(verifyLicenseFile(issueLicense())).toBe(true);
  });

  it("verifies a perpetual licence (expiresAt absent from the signed bytes)", () => {
    const license = issueLicense();
    expect("expiresAt" in license).toBe(false);
    expect(verifyLicenseFile(license)).toBe(true);
    expect(isLicenseExpired(license)).toBe(false);
  });

  it("rejects a tampered licence (any signed field)", () => {
    const license = issueLicense();
    expect(verifyLicenseFile({ ...license, maxActivations: 999 })).toBe(false);
    expect(verifyLicenseFile({ ...license, customerId: "thief@test.example" })).toBe(false);
    expect(verifyLicenseFile({ ...license, expiresAt: "2099-01-01T00:00:00.000Z" })).toBe(false);
  });

  it("rejects a licence signed with a different key", () => {
    const other = generateEd25519KeyPair();
    const fields = issueLicense();
    const forged = {
      ...fields,
      signature: signEd25519(canonicalLicensePayload(fields), other.privateKey).toString("base64"),
    };
    expect(verifyLicenseFile(forged)).toBe(false);
  });

  it("flags an expired licence", () => {
    const license = issueLicense({ expiresAt: "2020-01-01T00:00:00.000Z" });
    expect(verifyLicenseFile(license)).toBe(true); // signature still valid
    expect(isLicenseExpired(license)).toBe(true);
  });
});

describe("skills.activateOffline role gate", () => {
  it("denies a VIEWER", async () => {
    const caller = callerWithRole("VIEWER");
    await expect(
      caller.activateOffline({ organizationId: ORG.id, licenseFile: issueLicense() })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.prisma.skillEntitlement.upsert).not.toHaveBeenCalled();
  });

  it("denies a MEMBER and a PRIVACY_OFFICER", async () => {
    for (const role of ["MEMBER", "PRIVACY_OFFICER"] as const) {
      await expect(
        callerWithRole(role).activateOffline({
          organizationId: ORG.id,
          licenseFile: issueLicense(),
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(mocks.prisma.skillEntitlement.upsert).not.toHaveBeenCalled();
  });
});

describe("skills.activateOffline flow", () => {
  it("activates a valid licence: creates customer + org link, entitlement, activation", async () => {
    const caller = callerWithRole("OWNER");
    const result = await caller.activateOffline({
      organizationId: ORG.id,
      licenseFile: issueLicense(),
    });

    expect(result.success).toBe(true);
    expect(result.skillId).toBe(PACKAGE.skillId);
    expect(result.activationId).toBe("act-1");

    // Customer created with the buyer's email and linked to the org
    expect(mocks.prisma.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: BUYER_EMAIL,
          organizations: { create: { organizationId: ORG.id } },
        }),
      })
    );

    // Entitlement upserted with the licence terms
    const upsertArgs = mocks.prisma.skillEntitlement.upsert.mock.calls[0][0];
    expect(upsertArgs.where).toEqual({
      customerId_skillPackageId: { customerId: "cust-1", skillPackageId: PACKAGE.id },
    });
    expect(upsertArgs.create).toMatchObject({
      licenseKey: "LIC-AB12-CD34-EF56-0789",
      licenseType: "PERPETUAL",
      maxActivations: 3,
      status: "ACTIVE",
    });

    // Activation bound to this installation
    expect(mocks.prisma.skillActivation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entitlementId: "ent-1",
          customerId: "cust-1",
          instanceId: "inst_test",
        }),
      })
    );
  });

  it("ADMIN can activate too", async () => {
    const caller = callerWithRole("ADMIN");
    await expect(
      caller.activateOffline({ organizationId: ORG.id, licenseFile: issueLicense() })
    ).resolves.toMatchObject({ success: true });
  });

  it("rejects a licence bound to a different email", async () => {
    const caller = callerWithRole("OWNER", "someone-else@test.example");
    await expect(
      caller.activateOffline({ organizationId: ORG.id, licenseFile: issueLicense() })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("does not belong"),
    });
    expect(mocks.prisma.skillEntitlement.upsert).not.toHaveBeenCalled();
  });

  it("email matching is case- and whitespace-insensitive", async () => {
    const caller = callerWithRole("OWNER");
    await expect(
      caller.activateOffline({
        organizationId: ORG.id,
        licenseFile: issueLicense({ customerId: `  ${BUYER_EMAIL.toUpperCase()}  ` }),
      })
    ).resolves.toMatchObject({ success: true });
  });

  it("rejects an expired licence", async () => {
    const caller = callerWithRole("OWNER");
    await expect(
      caller.activateOffline({
        organizationId: ORG.id,
        licenseFile: issueLicense({ expiresAt: "2020-01-01T00:00:00.000Z" }),
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("expired"),
    });
  });

  it("rejects a tampered licence", async () => {
    const caller = callerWithRole("OWNER");
    const license = { ...issueLicense(), maxActivations: 999 };
    await expect(
      caller.activateOffline({ organizationId: ORG.id, licenseFile: license })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("signature"),
    });
  });

  it("rejects a licence for a skill package that is not seeded here", async () => {
    mocks.prisma.skillPackage.findUnique.mockResolvedValue(null);
    const caller = callerWithRole("OWNER");
    await expect(
      caller.activateOffline({ organizationId: ORG.id, licenseFile: issueLicense() })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("not installed"),
    });
  });

  it("rejects a licence key already registered to another customer", async () => {
    mocks.prisma.skillEntitlement.findUnique.mockResolvedValue({
      id: "ent-other",
      customerId: "cust-OTHER",
    });
    const caller = callerWithRole("OWNER");
    await expect(
      caller.activateOffline({ organizationId: ORG.id, licenseFile: issueLicense() })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("does not belong"),
    });
    expect(mocks.prisma.skillEntitlement.upsert).not.toHaveBeenCalled();
  });

  it("re-activation on the same installation is idempotent (bumps lastSeenAt)", async () => {
    mocks.prisma.skillEntitlement.upsert.mockResolvedValue({
      id: "ent-1",
      customerId: "cust-1",
      skillPackageId: PACKAGE.id,
      status: "ACTIVE",
      maxActivations: 1,
      expiresAt: null,
      activations: [{ id: "act-existing", instanceId: "inst_test" }],
    });
    const caller = callerWithRole("OWNER");
    const result = await caller.activateOffline({
      organizationId: ORG.id,
      licenseFile: issueLicense({ maxActivations: 1 }),
    });

    expect(result).toMatchObject({ success: true, activationId: "act-existing" });
    expect(mocks.prisma.skillActivation.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "act-existing" } })
    );
    expect(mocks.prisma.skillActivation.create).not.toHaveBeenCalled();
  });

  it("enforces the activation limit across installations", async () => {
    mocks.prisma.skillEntitlement.upsert.mockResolvedValue({
      id: "ent-1",
      customerId: "cust-1",
      skillPackageId: PACKAGE.id,
      status: "ACTIVE",
      maxActivations: 1,
      expiresAt: null,
      activations: [{ id: "act-elsewhere", instanceId: "inst_some_other_box" }],
    });
    const caller = callerWithRole("OWNER");
    await expect(
      caller.activateOffline({
        organizationId: ORG.id,
        licenseFile: issueLicense({ maxActivations: 1 }),
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("Activation limit reached (1)"),
    });
    expect(mocks.prisma.skillActivation.create).not.toHaveBeenCalled();
  });

  it("links an existing customer (found by email) to the activating org", async () => {
    mocks.prisma.customer.findUnique.mockResolvedValue({
      id: "cust-existing",
      email: BUYER_EMAIL,
    });
    mocks.prisma.skillEntitlement.upsert.mockResolvedValue({
      id: "ent-1",
      customerId: "cust-existing",
      skillPackageId: PACKAGE.id,
      status: "ACTIVE",
      maxActivations: 3,
      expiresAt: null,
      activations: [],
    });
    const caller = callerWithRole("OWNER");
    await expect(
      caller.activateOffline({ organizationId: ORG.id, licenseFile: issueLicense() })
    ).resolves.toMatchObject({ success: true });

    expect(mocks.prisma.customerOrganization.create).toHaveBeenCalledWith({
      data: { customerId: "cust-existing", organizationId: ORG.id },
    });
    expect(mocks.prisma.customer.create).not.toHaveBeenCalled();
  });
});
