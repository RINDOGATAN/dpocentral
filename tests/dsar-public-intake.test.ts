/**
 * Public DSAR intake regression tests (dsar.submitPublic).
 *
 * The anonymous public request path must: accept a valid submission and file
 * it under exactly the organization named by orgSlug; reject malformed input
 * (bad email) before touching the database; and never create a request for an
 * organization that has no active intake form or does not exist (no
 * cross-tenant leakage — a request only ever lands under the resolved org's
 * id).
 *
 * Prisma and the confirmation-email side effect are mocked.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    organization: { findUnique: vi.fn() },
    dSARRequest: { create: vi.fn() },
    dSARAuditLog: { create: vi.fn() },
  },
  sendConfirmation: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/server/services/dsar/sendConfirmationEmail", () => ({
  sendDSARConfirmationEmail: mocks.sendConfirmation,
}));
vi.mock("@/server/services/dsar/sendCommunicationEmail", () => ({
  sendDSARCommunicationEmail: vi.fn(),
}));

import { dsarRouter } from "@/server/routers/privacy/dsar";
import { callerFor } from "./helpers";

const anon = () => callerFor(dsarRouter, null) as ReturnType<typeof dsarRouter.createCaller>;

const validSubmission = {
  orgSlug: "acme",
  type: "ACCESS" as const,
  requesterName: "Jane Public",
  requesterEmail: "jane@example.com",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.dSARAuditLog.create.mockResolvedValue({});
  mocks.sendConfirmation.mockResolvedValue(undefined);
});

it("accepts a valid public submission and files it under the named org", async () => {
  mocks.prisma.organization.findUnique.mockResolvedValue({
    id: "org-acme",
    name: "Acme",
    slug: "acme",
    dsarIntakeForms: [{ id: "form-1", isActive: true }],
    jurisdictions: [{ isPrimary: true, jurisdiction: { dsarDeadlineDays: 30 } }],
  });
  mocks.prisma.dSARRequest.create.mockResolvedValue({
    id: "req-1",
    publicId: "DSAR-PUBLIC-1",
  });

  const result = await anon().submitPublic(validSubmission);

  expect(result).toEqual({ publicId: "DSAR-PUBLIC-1" });
  // Filed under the resolved org, submitted status — no cross-tenant target.
  expect(mocks.prisma.dSARRequest.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        organizationId: "org-acme",
        status: "SUBMITTED",
        requesterEmail: "jane@example.com",
      }),
    })
  );
  expect(mocks.sendConfirmation).toHaveBeenCalledOnce();
});

it("rejects a malformed submission (invalid email) before any DB write", async () => {
  await expect(
    anon().submitPublic({ ...validSubmission, requesterEmail: "not-an-email" })
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });

  expect(mocks.prisma.organization.findUnique).not.toHaveBeenCalled();
  expect(mocks.prisma.dSARRequest.create).not.toHaveBeenCalled();
});

it("rejects an empty requester name", async () => {
  await expect(
    anon().submitPublic({ ...validSubmission, requesterName: "" })
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  expect(mocks.prisma.dSARRequest.create).not.toHaveBeenCalled();
});

it("does not create a request for an unknown org", async () => {
  mocks.prisma.organization.findUnique.mockResolvedValue(null);

  await expect(
    anon().submitPublic({ ...validSubmission, orgSlug: "does-not-exist" })
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(mocks.prisma.dSARRequest.create).not.toHaveBeenCalled();
});

it("does not create a request for an org with no active intake form", async () => {
  mocks.prisma.organization.findUnique.mockResolvedValue({
    id: "org-acme",
    name: "Acme",
    slug: "acme",
    dsarIntakeForms: [], // intake not enabled
    jurisdictions: [],
  });

  await expect(anon().submitPublic(validSubmission)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  expect(mocks.prisma.dSARRequest.create).not.toHaveBeenCalled();
});
