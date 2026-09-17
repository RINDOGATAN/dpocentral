/**
 * Every assessment type, template, auto-fill and export is open on the hosted
 * pilot, even with NEXT_PUBLIC_STRIPE_ENABLED=true (as production still has
 * it). The self-hosted kit keeps its licence gate: a premium type is offered
 * only once its template is installed.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    organizationMember: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    organization: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
    skillPackage: { findFirst: vi.fn() },
    customerOrganization: { findFirst: vi.fn() },
    assessment: { create: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    assessmentTemplate: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
// Production still builds with Stripe on: the hosted pilot must ignore it.
vi.mock("@/config/features", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/config/features")>();
  return { ...real, features: { ...real.features, stripeEnabled: true } };
});

import {
  isAssessmentTypeLocked,
  isPremiumTypeKey,
  sellingEnabled,
} from "@/lib/premium-gate";
import {
  checkAssessmentEntitlement,
  getEntitledAssessmentTypes,
  hasRopaExportAccess,
  hasVendorCatalogAccess,
} from "@/server/services/licensing/entitlement";
import {
  ensureHostedTemplates,
  resetHostedTemplatesForTests,
} from "@/server/services/pilot/hosted-templates";
import { DPIA_TEMPLATE_ID } from "@/config/dpia-template-v2";
import { HEALTH_ADTECH_TEMPLATE_ID } from "@/config/health-adtech-template";
import { assessmentRouter } from "@/server/routers/privacy/assessment";
import { callerFor, sessionFor } from "./helpers";

const hosted = () => vi.stubEnv("VERCEL_ENV", "production");
const kit = () => {
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("AUTH_COOKIE_DOMAIN", "");
};

const ORG = { id: "org-1", name: "Org", slug: "org", createdAt: new Date() };

beforeEach(() => {
  vi.clearAllMocks();
  resetHostedTemplatesForTests();
  mocks.prisma.organizationMember.findUnique.mockResolvedValue({
    id: "m-1",
    userId: "user-1",
    organizationId: "org-1",
    role: "OWNER",
    organization: ORG,
  });
  mocks.prisma.organizationMember.count.mockResolvedValue(0);
  mocks.prisma.assessment.count.mockResolvedValue(0);
  mocks.prisma.assessmentTemplate.count.mockResolvedValue(0);
  // No licence anywhere: no skill package, no customer link.
  mocks.prisma.skillPackage.findFirst.mockResolvedValue(null);
  mocks.prisma.customerOrganization.findFirst.mockResolvedValue(null);
  mocks.prisma.assessmentTemplate.findUnique.mockResolvedValue(null);
  mocks.prisma.assessmentTemplate.findMany.mockResolvedValue([]);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the lock rule shared by the pages", () => {
  it("never sells on the hosted pilot, even with Stripe on", () => {
    expect(sellingEnabled(true, true)).toBe(false);
    expect(sellingEnabled(true, false)).toBe(true);
    expect(sellingEnabled(false, false)).toBe(false);
  });

  it("never locks a type on the hosted pilot", () => {
    for (const type of ["DPIA", "PIA", "VENDOR", "LIA", "TIA", "CUSTOM"]) {
      expect(isAssessmentTypeLocked({ type, entitledTypes: [], hosted: true })).toBe(false);
    }
  });

  it("locks an unlicensed premium type on the kit, and only premium ones", () => {
    expect(isAssessmentTypeLocked({ type: "DPIA", entitledTypes: [], hosted: false })).toBe(true);
    expect(isAssessmentTypeLocked({ type: "DPIA", entitledTypes: ["DPIA"], hosted: false })).toBe(false);
    expect(isAssessmentTypeLocked({ type: "TIA", entitledTypes: [], hosted: false })).toBe(false);
    expect(
      isAssessmentTypeLocked({ type: "PIA", entitledTypes: [], hosted: false, comingSoon: true })
    ).toBe(false);
    expect(isPremiumTypeKey("VENDOR")).toBe(true);
    expect(isPremiumTypeKey("LIA")).toBe(false);
  });
});

describe("server entitlements with Stripe on", () => {
  it("opens every premium assessment type on the hosted pilot", async () => {
    hosted();
    for (const type of ["DPIA", "PIA", "VENDOR", "TIA"] as const) {
      expect((await checkAssessmentEntitlement("org-1", type)).entitled).toBe(true);
    }
    expect(mocks.prisma.skillPackage.findFirst).not.toHaveBeenCalled();
  });

  it("opens the vendor catalogue and the ROPA export on the hosted pilot", async () => {
    hosted();
    expect(await hasVendorCatalogAccess("org-1")).toBe(true);
    expect(await hasRopaExportAccess("org-1")).toBe(true);
  });

  it("keeps the gate where Stripe is on outside the pilot", async () => {
    kit();
    expect((await checkAssessmentEntitlement("org-1", "DPIA")).entitled).toBe(false);
    expect(await hasVendorCatalogAccess("org-1")).toBe(false);
    expect(await hasRopaExportAccess("org-1")).toBe(false);
  });

  it("offers every templated type, premium included, on the hosted pilot", async () => {
    hosted();
    mocks.prisma.assessmentTemplate.findMany.mockResolvedValue(
      ["LIA", "CUSTOM", "TIA", "DPIA", "PIA", "VENDOR"].map((type) => ({ type }))
    );
    const types = await getEntitledAssessmentTypes("org-1");
    expect(types).toEqual(expect.arrayContaining(["DPIA", "PIA", "VENDOR", "LIA", "CUSTOM"]));
  });
});

describe("hosted templates written at runtime", () => {
  it("does nothing on the kit (the licence gate stays)", async () => {
    kit();
    await ensureHostedTemplates();
    expect(mocks.prisma.assessmentTemplate.findUnique).not.toHaveBeenCalled();
    expect(mocks.prisma.assessmentTemplate.create).not.toHaveBeenCalled();
  });

  it("creates the standard DPIA on the hosted pilot when it is missing", async () => {
    hosted();
    await ensureHostedTemplates();
    expect(mocks.prisma.assessmentTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ id: DPIA_TEMPLATE_ID, type: "DPIA", isSystem: true }),
      })
    );
  });

  it("writes the global health-data advertising template on the hosted pilot", async () => {
    hosted();
    await ensureHostedTemplates();
    expect(mocks.prisma.assessmentTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: HEALTH_ADTECH_TEMPLATE_ID,
          type: "DPIA",
          isSystem: true,
          scoringLogic: expect.objectContaining({ method: "health_adtech_v1" }),
        }),
      })
    );
  });

  it("never overwrites a DPIA that already exists, and runs once", async () => {
    hosted();
    mocks.prisma.assessmentTemplate.findUnique.mockImplementation(async ({ where }) =>
      where.id === DPIA_TEMPLATE_ID ? { id: DPIA_TEMPLATE_ID } : null
    );
    await ensureHostedTemplates();
    await ensureHostedTemplates();
    const dpiaWrites = mocks.prisma.assessmentTemplate.create.mock.calls.filter(
      ([arg]) => arg.data.id === DPIA_TEMPLATE_ID
    );
    expect(dpiaWrites).toHaveLength(0);
    expect(mocks.prisma.assessmentTemplate.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: DPIA_TEMPLATE_ID } })
    );
    const dpiaLookups = mocks.prisma.assessmentTemplate.findUnique.mock.calls.filter(
      ([arg]) => arg.where.id === DPIA_TEMPLATE_ID
    );
    expect(dpiaLookups).toHaveLength(1);
  });

  it("writes them before the template list and the offered types are read", async () => {
    hosted();
    const caller = callerFor(assessmentRouter, sessionFor("user-1"));
    await caller.listTemplates({ organizationId: "org-1", type: "DPIA" });
    expect(mocks.prisma.assessmentTemplate.create).toHaveBeenCalled();
    const writeOrder = mocks.prisma.assessmentTemplate.create.mock.invocationCallOrder[0];
    const listOrder = mocks.prisma.assessmentTemplate.findMany.mock.invocationCallOrder.at(-1)!;
    expect(writeOrder).toBeLessThan(listOrder);
  });
});

describe("creating a premium assessment", () => {
  const template = { id: DPIA_TEMPLATE_ID, type: "DPIA", organizationId: null, isSystem: true };

  beforeEach(() => {
    mocks.prisma.assessmentTemplate.findFirst.mockResolvedValue(template);
    mocks.prisma.assessment.create.mockResolvedValue({ id: "a-1", template });
    mocks.prisma.auditLog.create.mockResolvedValue({});
  });

  const create = () =>
    callerFor(assessmentRouter, sessionFor("user-1")).create({
      organizationId: "org-1",
      templateId: DPIA_TEMPLATE_ID,
      name: "Workshop DPIA",
    });

  it("is allowed on the hosted pilot without any licence", async () => {
    hosted();
    await expect(create()).resolves.toMatchObject({ id: "a-1" });
  });

  it("is refused where Stripe is on outside the pilot and no licence exists", async () => {
    kit();
    await expect(create()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.prisma.assessment.create).not.toHaveBeenCalled();
  });
});
