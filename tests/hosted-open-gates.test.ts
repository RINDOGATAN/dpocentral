/**
 * Every assessment type, template, auto-fill and export is open on the hosted
 * pilot, even with NEXT_PUBLIC_STRIPE_ENABLED=true (as production still has
 * it). The self-hosted kit keeps its licence gate: a premium type is offered
 * only once its template is installed.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

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
  isAssessmentTypeOffered,
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
import { DPIA_TEMPLATE_ID, DPIA_TEMPLATE_VERSION } from "@/config/dpia-template-v2";
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

  it("does not offer a type announced as coming soon, on any deployment", () => {
    for (const type of ["PIA", "VENDOR"]) {
      expect(isAssessmentTypeOffered({ type, entitledTypes: [], comingSoon: true })).toBe(false);
    }
  });

  it("offers it again once a template for it exists", () => {
    expect(
      isAssessmentTypeOffered({ type: "PIA", entitledTypes: ["PIA"], comingSoon: true })
    ).toBe(true);
  });

  it("offers every other type, locked or not", () => {
    for (const type of ["DPIA", "LIA", "TIA", "CUSTOM"]) {
      expect(isAssessmentTypeOffered({ type, entitledTypes: [] })).toBe(true);
    }
  });

  it("is the rule the type grid applies", () => {
    const page = readFileSync(
      path.resolve(__dirname, "..", "src/app/(dashboard)/privacy/assessments/new/page.tsx"),
      "utf8"
    );
    expect(page).toContain("isAssessmentTypeOffered");
    expect(page).toContain("offeredTypes.map");
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

  it("refreshes an older system DPIA so a new template version reaches the pilot", async () => {
    hosted();
    mocks.prisma.assessmentTemplate.findUnique.mockImplementation(async ({ where }) =>
      where.id === DPIA_TEMPLATE_ID
        ? { id: DPIA_TEMPLATE_ID, version: "2.0", isSystem: true, organizationId: null }
        : null
    );
    await ensureHostedTemplates();
    expect(mocks.prisma.assessmentTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: DPIA_TEMPLATE_ID },
        data: expect.objectContaining({ version: DPIA_TEMPLATE_VERSION }),
      })
    );
  });

  it("keeps a DPIA whose installed version is newer, and runs once", async () => {
    hosted();
    mocks.prisma.assessmentTemplate.findUnique.mockImplementation(async ({ where }) =>
      where.id === DPIA_TEMPLATE_ID
        ? { id: DPIA_TEMPLATE_ID, version: "9.0", isSystem: true, organizationId: null }
        : null
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

  it("never touches a DPIA row that belongs to an organization", async () => {
    hosted();
    mocks.prisma.assessmentTemplate.findUnique.mockImplementation(async ({ where }) =>
      where.id === DPIA_TEMPLATE_ID
        ? { id: DPIA_TEMPLATE_ID, version: "1.0", isSystem: false, organizationId: "org-1" }
        : null
    );
    await ensureHostedTemplates();
    expect(mocks.prisma.assessmentTemplate.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: DPIA_TEMPLATE_ID } })
    );
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

describe("the export carries no gate of its own", () => {
  const source = (rel: string) => readFileSync(path.resolve(__dirname, "..", rel), "utf8");

  it("never asks about entitlement, a licence or a premium type", () => {
    const route = source("src/app/api/export/assessment/[id]/route.ts");
    for (const gate of [
      "checkAssessmentEntitlement",
      "isPremiumAssessmentType",
      "getEntitledAssessmentTypes",
      "hasRopaExportAccess",
      "skillPackage",
    ]) {
      expect(route.includes(gate), gate).toBe(false);
    }
  });

  it("exports the portfolio without a gate either", () => {
    const route = source("src/app/api/export/assessment-portfolio/route.ts");
    for (const gate of ["checkAssessmentEntitlement", "isPremiumAssessmentType"]) {
      expect(route.includes(gate), gate).toBe(false);
    }
  });
});

describe("reaching a new DPIA", () => {
  it("takes two clicks from the dashboard: the quick action, then Create", () => {
    const dashboard = readFileSync(
      path.resolve(__dirname, "..", "src/app/(dashboard)/privacy/page.tsx"),
      "utf8"
    );
    expect(dashboard).toContain('href="/privacy/assessments/new?type=DPIA"');

    // The form opens on the details because the type comes from the query.
    const form = readFileSync(
      path.resolve(__dirname, "..", "src/app/(dashboard)/privacy/assessments/new/page.tsx"),
      "utf8"
    );
    expect(form).toContain('searchParams.get("type")');
  });

  it("offers the label in both languages", () => {
    expect(en.pages.dashboard.quickActions.newDpia).toBeTruthy();
    expect(es.pages.dashboard.quickActions.newDpia).toBeTruthy();
    expect(es.pages.dashboard.quickActions.newDpia).not.toBe(
      en.pages.dashboard.quickActions.newDpia
    );
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
      name: "Health data DPIA",
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
