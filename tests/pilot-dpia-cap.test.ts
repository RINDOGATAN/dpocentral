// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The hosted trial includes three impact assessments per organisation.
 *
 * The third is created like any other; the fourth is refused with a message
 * that says what the trial includes, that deleting one does not free a place,
 * and where to ask for a deployment of their own. The count is of impact
 * assessments created, so it is read from the audit log as well as from the
 * assessments the organisation still holds. Nothing already created is
 * blocked, and the self-hosted kit is not capped at all.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    organizationMember: {
      findUnique: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    auditLog: { create: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    assessment: { create: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    assessmentTemplate: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    dataAsset: { count: vi.fn().mockResolvedValue(0) },
    dataElement: { count: vi.fn().mockResolvedValue(0) },
    processingActivity: { count: vi.fn().mockResolvedValue(0) },
    dataFlow: { count: vi.fn().mockResolvedValue(0) },
    dataTransfer: { count: vi.fn().mockResolvedValue(0) },
    vendor: { count: vi.fn().mockResolvedValue(0) },
    vendorContract: { count: vi.fn().mockResolvedValue(0) },
    dSARRequest: { count: vi.fn().mockResolvedValue(0) },
    incident: { count: vi.fn().mockResolvedValue(0) },
    aISystem: { count: vi.fn().mockResolvedValue(0) },
    organization: { updateMany: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { assessmentRouter } from "@/server/routers/privacy/assessment";
import {
  countDpiaCreated,
  dpiaCapMessage,
  hostedDpiaQuota,
  HOSTED_DPIA_LIMIT,
} from "@/server/services/pilot/caps";
import { CONTACT_URL } from "@/lib/hosted";
import { callerFor, sessionFor } from "./helpers";

const ORG = { id: "org-1", name: "Org", slug: "org", pilotStartedAt: null };
const DPIA_TEMPLATE = { id: "system-dpia-template", type: "DPIA", organizationId: null };
const LIA_TEMPLATE = { id: "system-lia-template", type: "LIA", organizationId: null };

const hosted = () => vi.stubEnv("VERCEL_ENV", "production");
const kit = () => {
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("AUTH_COOKIE_DOMAIN", "");
};

/** The number of impact assessments already created, from the audit log. */
const created = (n: number) => mocks.prisma.auditLog.count.mockResolvedValue(n);
/** The number the organisation still holds. */
const held = (n: number) =>
  mocks.prisma.assessment.count.mockImplementation(async (args: { where?: { template?: unknown } }) =>
    args?.where?.template ? n : 0
  );

const caller = () => callerFor(assessmentRouter, sessionFor("user-1"));

const createDpia = () =>
  caller().create({
    organizationId: ORG.id,
    templateId: DPIA_TEMPLATE.id,
    name: "Loyalty programme",
  });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.organizationMember.findUnique.mockResolvedValue({
    id: "m-1",
    userId: "user-1",
    organizationId: ORG.id,
    role: "OWNER",
    organization: ORG,
  });
  mocks.prisma.assessmentTemplate.findFirst.mockResolvedValue(DPIA_TEMPLATE);
  mocks.prisma.assessment.create.mockResolvedValue({ id: "asm-1", template: DPIA_TEMPLATE });
  mocks.prisma.auditLog.create.mockResolvedValue({});
  created(0);
  held(0);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("impact assessments on the hosted trial", () => {
  it("creates the third", async () => {
    hosted();
    created(HOSTED_DPIA_LIMIT - 1);
    await expect(createDpia()).resolves.toMatchObject({ id: "asm-1" });
    expect(mocks.prisma.assessment.create).toHaveBeenCalled();
  });

  it("refuses the fourth", async () => {
    hosted();
    created(HOSTED_DPIA_LIMIT);
    await expect(createDpia()).rejects.toThrow(/impact assessments/);
    expect(mocks.prisma.assessment.create).not.toHaveBeenCalled();
  });

  it("carries the link to ask for a deployment, in both languages", () => {
    for (const locale of ["en", "es"] as const) {
      const message = dpiaCapMessage(locale);
      expect(message).toContain(CONTACT_URL);
      expect(message).toContain(String(HOSTED_DPIA_LIMIT));
      // No price and no sales language.
      expect(message).not.toMatch(/[€$]|EUR|USD|upgrade|mejora|oferta/i);
    }
  });

  it("says that deleting does not free a place", () => {
    expect(dpiaCapMessage("en")).toMatch(/deleting one does not free a place/i);
    expect(dpiaCapMessage("es")).toMatch(/borrar una no libera plaza/i);
  });

  it("does not let a deletion free a place", async () => {
    hosted();
    // Three created, none still held: the audit log still counts them.
    created(HOSTED_DPIA_LIMIT);
    held(0);
    expect(await countDpiaCreated(mocks.prisma as never, ORG.id)).toBe(HOSTED_DPIA_LIMIT);
    await expect(createDpia()).rejects.toThrow();
  });

  it("counts an assessment the audit log never recorded a type for", async () => {
    created(0);
    held(HOSTED_DPIA_LIMIT);
    expect(await countDpiaCreated(mocks.prisma as never, ORG.id)).toBe(HOSTED_DPIA_LIMIT);
  });

  it("counts only impact assessments: another type is not capped", async () => {
    hosted();
    created(HOSTED_DPIA_LIMIT);
    mocks.prisma.assessmentTemplate.findFirst.mockResolvedValue(LIA_TEMPLATE);
    mocks.prisma.assessment.create.mockResolvedValue({ id: "asm-2", template: LIA_TEMPLATE });
    await expect(
      caller().create({ organizationId: ORG.id, templateId: LIA_TEMPLATE.id, name: "LIA" })
    ).resolves.toMatchObject({ id: "asm-2" });
  });

  it("records the template type, so the count survives a deletion", async () => {
    hosted();
    await createDpia();
    expect(mocks.prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "CREATE",
          changes: expect.objectContaining({ templateType: "DPIA" }),
        }),
      })
    );
  });

  it("does not apply off the hosted service", async () => {
    kit();
    created(HOSTED_DPIA_LIMIT + 5);
    await expect(createDpia()).resolves.toMatchObject({ id: "asm-1" });
    expect(await hostedDpiaQuota(mocks.prisma as never, ORG.id)).toEqual({ capped: false });
  });

  it("reports what is left, for the screen to show", async () => {
    hosted();
    created(1);
    expect(await hostedDpiaQuota(mocks.prisma as never, ORG.id)).toEqual({
      capped: true,
      limit: HOSTED_DPIA_LIMIT,
      used: 1,
      remaining: HOSTED_DPIA_LIMIT - 1,
    });
  });

  it("never reports a negative number left", async () => {
    hosted();
    created(HOSTED_DPIA_LIMIT + 2);
    expect(await hostedDpiaQuota(mocks.prisma as never, ORG.id)).toMatchObject({ remaining: 0 });
  });
});
