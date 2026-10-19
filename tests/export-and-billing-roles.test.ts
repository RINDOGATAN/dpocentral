// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Who may take the organisation's data out, and who may act on its billing.
 *
 *   GET /api/export/organization-data  every register plus member e-mails:
 *     OWNER and ADMIN only, and only one who sees the whole organisation (a
 *     member limited to departments is refused). Each download writes an
 *     EXPORT_ORGANIZATION_DATA audit entry (who, when, what) before the file
 *     is sent; only allow-listed settings leave (no pending invitations, no
 *     webhook URL); the response is not cached.
 *   GET /api/export/rights-requests    writes EXPORT_RIGHTS_REQUESTS.
 *   POST /api/billing/portal, POST /api/checkout: OWNER and ADMIN only.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    organizationMember: { findFirst: vi.fn(), findMany: vi.fn() },
    businessUnitMember: { findMany: vi.fn() },
    auditLog: { create: vi.fn(), findMany: vi.fn() },
    customerOrganization: { findFirst: vi.fn() },
    skillPackage: { findMany: vi.fn() },
  } as Record<string, Record<string, ReturnType<typeof vi.fn>>>,
  token: { email: "user-a@test.example" } as { email?: string } | null,
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/session-cookie", () => ({ getSessionToken: async () => mocks.token }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/api-export", () => ({
  checkExportRateLimit: () => null,
  pdfErrorResponse: (err: unknown) => {
    throw err;
  },
}));
vi.mock("@/config/features", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config/features")>();
  return {
    ...actual,
    isDsarModuleEnabled: () => true,
    features: { ...actual.features, stripeEnabled: true, selfServiceUpgrade: true },
  };
});
vi.mock("@/lib/stripe", () => ({
  createPortalSession: vi.fn(async () => ({ url: "https://billing.example/portal" })),
  createCheckoutSession: vi.fn(async () => ({ url: "https://billing.example/checkout", id: "cs_1" })),
  createCustomer: vi.fn(async () => ({ id: "cus_1" })),
  getCustomer: vi.fn(async () => null),
}));

vi.mock("@/server/services/export/documents/privacy-program", () => ({
  buildPrivacyProgramExport: vi.fn(async () => ({ body: "pdf", filename: "p.pdf", contentType: "application/pdf" })),
}));
vi.mock("@/server/services/export/documents/context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/services/export/documents/context")>()),
  fileResponse: () => new Response("pdf", { status: 200 }),
}));

import { GET as exportPrivacyProgram } from "@/app/api/export/privacy-program/route";
import { GET as exportOrganizationData } from "@/app/api/export/organization-data/route";
import { GET as exportRightsRequests } from "@/app/api/export/rights-requests/route";
import { POST as billingPortal } from "@/app/api/billing/portal/route";
import { POST as checkout } from "@/app/api/checkout/route";
import { exportableOrganizationSettings } from "@/server/services/export/organization-settings";

const ROLES = ["OWNER", "ADMIN", "PRIVACY_OFFICER", "MEMBER", "VIEWER"] as const;
const ADMINS = ["OWNER", "ADMIN"] as const;
const OTHERS = ["PRIVACY_OFFICER", "MEMBER", "VIEWER"] as const;

const SETTINGS = {
  applicability: { a: 1 },
  quickstart: { completedAt: "2026-10-01" },
  pendingInvites: [{ email: "invitee@test.example", role: "ADMIN" }],
  pendingInviteEmails: ["invitee@test.example"],
  slackWebhookUrl: "https://hooks.slack.example/secret",
  signupRegion: "EU",
};

function as(role: string) {
  mocks.prisma.organizationMember.findFirst.mockResolvedValue({
    id: "member-a",
    userId: "user-a",
    organizationId: "org-a",
    role,
    organization: { id: "org-a", name: "Org A", slug: "org-a", domain: null, settings: SETTINGS, createdAt: new Date() },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.token = { email: "user-a@test.example" };
  const models = [
    "organizationMember", "organizationJurisdiction", "dataAsset", "processingActivity",
    "dataFlow", "dataTransfer", "dSARIntakeForm", "dSARRequest", "assessmentTemplate", "assessment",
    "incident", "vendor", "aISystem",
  ];
  for (const m of models) {
    mocks.prisma[m] = { ...(mocks.prisma[m] ?? {}), findMany: vi.fn().mockResolvedValue([{ id: `${m}-1` }]) };
  }
  mocks.prisma.businessUnitMember.findMany.mockResolvedValue([]);
  mocks.prisma.auditLog.create.mockResolvedValue({});
  mocks.prisma.auditLog.findMany.mockResolvedValue([]);
  mocks.prisma.customerOrganization.findFirst.mockResolvedValue({ customer: { stripeCustomerId: "cus_1" } });
  mocks.prisma.skillPackage.findMany.mockResolvedValue([]);
});

const orgExport = () =>
  exportOrganizationData(new Request("http://localhost/api/export/organization-data?organizationId=org-a"));

describe("the full organisation export", () => {
  it.each(ADMINS)("%s downloads it, and the download is audited", async (role) => {
    as(role);
    const res = await orgExport();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const create = mocks.prisma.auditLog.create.mock.calls[0][0];
    expect(create.data).toMatchObject({
      organizationId: "org-a",
      userId: "user-a",
      action: "EXPORT_ORGANIZATION_DATA",
      entityType: "Organization",
      entityId: "org-a",
    });
    expect(create.data.changes.sections).toMatchObject({ members: 1, incidents: 1, vendors: 1 });
  });

  it.each(OTHERS)("%s is refused and nothing is read or logged", async (role) => {
    as(role);
    const res = await orgExport();
    expect(res.status).toBe(403);
    expect(mocks.prisma.incident.findMany).not.toHaveBeenCalled();
    expect(mocks.prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("an admin limited to departments is refused (the file is not split by department)", async () => {
    as("ADMIN");
    mocks.prisma.businessUnitMember.findMany.mockResolvedValue([{ businessUnitId: "dept-a" }]);
    const res = await orgExport();
    expect(res.status).toBe(403);
    expect(mocks.prisma.dataAsset.findMany).not.toHaveBeenCalled();
  });

  it("a non-member is refused", async () => {
    mocks.prisma.organizationMember.findFirst.mockResolvedValue(null);
    expect((await orgExport()).status).toBe(403);
  });

  it("carries only the allow-listed settings: no invitations, no webhook URL", async () => {
    as("OWNER");
    const body = await (await orgExport()).json();
    expect(body.organization.settings).toEqual({
      applicability: { a: 1 },
      quickstart: { completedAt: "2026-10-01" },
    });
    const text = JSON.stringify(body);
    expect(text).not.toContain("invitee@test.example");
    expect(text).not.toContain("hooks.slack.example");
  });

  it("exportableOrganizationSettings handles empty and odd values", () => {
    expect(exportableOrganizationSettings(null)).toBeNull();
    expect(exportableOrganizationSettings([1, 2])).toBeNull();
    expect(exportableOrganizationSettings({ slackWebhookUrl: "x" })).toEqual({});
  });
});

describe("the rights-request export is audited", () => {
  it("writes EXPORT_RIGHTS_REQUESTS with the counts", async () => {
    as("OWNER");
    const res = await exportRightsRequests(
      new Request("http://localhost/api/export/rights-requests?organizationId=org-a&locale=en"),
    );
    expect(res.status).toBe(200);
    const create = mocks.prisma.auditLog.create.mock.calls[0][0];
    expect(create.data).toMatchObject({ action: "EXPORT_RIGHTS_REQUESTS", userId: "user-a", organizationId: "org-a" });
    expect(create.data.changes).toMatchObject({ dsarRequests: 1, dsarIntakeForms: 1 });
  });

  it.each(OTHERS)("%s is refused and nothing is logged", async (role) => {
    as(role);
    const res = await exportRightsRequests(
      new Request("http://localhost/api/export/rights-requests?organizationId=org-a"),
    );
    expect(res.status).toBe(403);
    expect(mocks.prisma.auditLog.create).not.toHaveBeenCalled();
  });
});

function post(body: unknown) {
  return new Request("http://localhost/api", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

describe("billing is for owners and admins", () => {
  it.each(ROLES)("billing portal: %s", async (role) => {
    as(role);
    const res = await billingPortal(post({ organizationId: "org-a" }));
    if ((ADMINS as readonly string[]).includes(role)) {
      expect(res.status).toBe(200);
    } else {
      expect(res.status).toBe(403);
      expect(mocks.prisma.customerOrganization.findFirst).not.toHaveBeenCalled();
    }
  });

  it.each(OTHERS)("add-on checkout: %s is refused", async (role) => {
    as(role);
    const res = await checkout(post({ organizationId: "org-a", skillPackageId: "pkg-1" }));
    expect(res.status).toBe(403);
    expect(mocks.prisma.skillPackage.findMany).not.toHaveBeenCalled();
  });

  it.each(ADMINS)("add-on checkout: %s passes the role gate", async (role) => {
    as(role);
    await checkout(post({ organizationId: "org-a", skillPackageId: "pkg-1" }));
    expect(mocks.prisma.skillPackage.findMany).toHaveBeenCalled();
  });
});

describe("organisation-wide reports are not for a member limited to departments", () => {
  const program = () =>
    exportPrivacyProgram(new Request("http://localhost/api/export/privacy-program?organizationId=org-a&locale=en"));

  it("the privacy program report is refused to a limited member", async () => {
    as("MEMBER");
    mocks.prisma.businessUnitMember.findMany.mockResolvedValue([{ businessUnitId: "dept-a" }]);
    expect((await program()).status).toBe(403);
  });

  it("an unlimited member still gets it", async () => {
    as("MEMBER");
    expect((await program()).status).toBe(200);
  });
});
