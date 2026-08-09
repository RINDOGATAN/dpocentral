// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * vendor.prepareDpa / vendor.generateDpa over the real middleware chain and
 * a mocked Prisma: the officer role gate, org scoping of the vendor lookup,
 * the §7 confirmation requirement, and the stored contract snapshot the
 * download route re-renders from.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { OrganizationRole } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  prisma: {
    organizationMember: { findUnique: vi.fn() },
    vendor: { findFirst: vi.fn(), update: vi.fn() },
    processingActivity: { findMany: vi.fn() },
    organizationJurisdiction: { findMany: vi.fn() },
    vendorContract: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/server/services/licensing/entitlement", () => ({
  hasVendorCatalogAccess: vi.fn().mockResolvedValue(true),
}));

import { vendorRouter } from "@/server/routers/privacy/vendor";
import { callerFor, sessionFor } from "./helpers";

const ORG = { id: "org-1", name: "Acme Corporation SL", slug: "acme" };

const VENDOR = {
  id: "vendor-1",
  organizationId: "org-1",
  name: "CloudCo Inc.",
  address: "100 Main St, San Francisco, USA",
  dataProcessed: ["IDENTIFIERS", "BEHAVIORAL"],
  countries: ["US"],
  certifications: ["SOC 2 Type II"],
  metadata: null,
  questionnaireResponses: [],
};

function callerWithRole(role: OrganizationRole) {
  mocks.prisma.organizationMember.findUnique.mockResolvedValue({
    id: "member-1",
    userId: "user-1",
    organizationId: "org-1",
    role,
    organization: ORG,
  });
  return callerFor(vendorRouter, sessionFor("user-1")) as ReturnType<
    typeof vendorRouter.createCaller
  >;
}

const GENERATE_INPUT = {
  organizationId: "org-1",
  vendorId: "vendor-1",
  language: "en" as const,
  effectiveDate: new Date("2026-08-09"),
  governingLaw: "SPAIN" as const,
  facts: {
    "processing-purpose": "Analytics service.",
    "data-categories": "contact-details,usage-technical",
    "processor-establishment": "US",
  },
  selections: {
    "scope-processing": "scope-standard",
    "processing-instructions": "instructions-standard",
    "subprocessor-approval": "subproc-general-30d",
    "data-transfer": "transfer-sccs",
    "security-measures": "security-soc2",
    "breach-notification": "breach-72h",
    "data-subject-rights": "rights-standard",
    "audit-rights": "audit-reports",
    "data-deletion": "deletion-return-or-delete-60d",
    confidentiality: "confidentiality-standard",
    "liability-indemnification": "liability-2x",
    "breach-liability-cap": "breachcap-supercap-2x",
    "term-termination": "term-30d-cure",
    "governing-law-jurisdiction": "glj-es-madrid",
    "government-access-requests": "gov-access-full",
  },
  controller: { name: "Acme Corporation SL" },
  processor: { name: "CloudCo Inc." },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.auditLog.create.mockResolvedValue({});
  mocks.prisma.vendor.findFirst.mockResolvedValue(VENDOR);
  mocks.prisma.processingActivity.findMany.mockResolvedValue([]);
  mocks.prisma.organizationJurisdiction.findMany.mockResolvedValue([]);
  mocks.prisma.vendorContract.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({ id: "contract-1", ...data })
  );
  mocks.prisma.vendorContract.update.mockResolvedValue({});
  mocks.prisma.vendorContract.findFirst.mockResolvedValue(null);
  mocks.prisma.vendor.update.mockResolvedValue({});
});

describe("role gate (officerProcedure)", () => {
  it.each(["VIEWER", "MEMBER"] as const)("denies a %s", async (role) => {
    const caller = callerWithRole(role);
    await expect(
      caller.prepareDpa({ organizationId: "org-1", vendorId: "vendor-1" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.generateDpa(GENERATE_INPUT)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(mocks.prisma.vendorContract.create).not.toHaveBeenCalled();
  });

  it("allows a PRIVACY_OFFICER", async () => {
    const caller = callerWithRole("PRIVACY_OFFICER");
    const prepared = await caller.prepareDpa({
      organizationId: "org-1",
      vendorId: "vendor-1",
    });
    expect(prepared.facts["processor-establishment"]).toBe("US");
    expect(prepared.catalog.clauses).toHaveLength(15);
  });
});

describe("tenant isolation", () => {
  it("scopes the vendor lookup to the caller's organization", async () => {
    const caller = callerWithRole("ADMIN");
    mocks.prisma.vendor.findFirst.mockResolvedValue(null);
    await expect(
      caller.prepareDpa({ organizationId: "org-1", vendorId: "vendor-other-org" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.prisma.vendor.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: "org-1" }),
      })
    );
  });
});

describe("generateDpa", () => {
  it("stores a PENDING_SIGNATURE DPA contract with the fact snapshot", async () => {
    const caller = callerWithRole("PRIVACY_OFFICER");
    const result = await caller.generateDpa(GENERATE_INPUT);

    expect(result.tiaIncluded).toBe(true);
    expect(result.dpaUrl).toBe("/api/export/dpa/contract-1?doc=dpa");
    expect(result.tiaUrl).toBe("/api/export/dpa/contract-1?doc=tia");

    const created = mocks.prisma.vendorContract.create.mock.calls[0]![0].data;
    expect(created.type).toBe("DPA");
    expect(created.status).toBe("PENDING_SIGNATURE");
    const snapshot = created.metadata.dpaEngine;
    expect(snapshot.facts).toEqual(GENERATE_INPUT.facts);
    expect(snapshot.selections).toEqual(GENERATE_INPUT.selections);
    expect(snapshot.language).toBe("en");
    expect(snapshot.tiaIncluded).toBe(true);

    // §10: the TIA re-evaluation (12 months out) pulls the vendor's next
    // review forward.
    expect(snapshot.obligations.map((o: { code: string }) => o.code)).toContain(
      "tia-reevaluation"
    );
    expect(mocks.prisma.vendor.update).toHaveBeenCalledWith({
      where: { id: "vendor-1" },
      data: { nextReviewAt: new Date("2027-08-09") },
    });
  });

  it("reports no TIA for an EEA processor", async () => {
    const caller = callerWithRole("PRIVACY_OFFICER");
    const result = await caller.generateDpa({
      ...GENERATE_INPUT,
      facts: { ...GENERATE_INPUT.facts, "processor-establishment": "EEA" },
    });
    expect(result.tiaIncluded).toBe(false);
    expect(result.tiaUrl).toBeNull();
  });

  it("refuses to generate over unconfirmed §7 contradictions", async () => {
    const caller = callerWithRole("PRIVACY_OFFICER");
    const contradictory = {
      ...GENERATE_INPUT,
      facts: { ...GENERATE_INPUT.facts, "tia-safeguards": "tech-pseudonymization" },
    };
    await expect(caller.generateDpa(contradictory)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(mocks.prisma.vendorContract.create).not.toHaveBeenCalled();

    const confirmed = await caller.generateDpa({
      ...contradictory,
      confirmedIssues: ["pseudonymization-identifying-data"],
    });
    expect(confirmed.contractId).toBe("contract-1");
  });

  it("returns the existing contract on a requestId retry instead of duplicating", async () => {
    const caller = callerWithRole("PRIVACY_OFFICER");
    const requestId = "3b241101-e2bb-4255-8caf-4136c566a962";
    mocks.prisma.vendorContract.findFirst.mockResolvedValue({
      id: "contract-existing",
      metadata: {
        dpaEngine: { requestId, warnings: [], tiaIncluded: true },
      },
    });
    const result = await caller.generateDpa({ ...GENERATE_INPUT, requestId });
    expect(result.contractId).toBe("contract-existing");
    expect(result.tiaUrl).toBe("/api/export/dpa/contract-existing?doc=tia");
    expect(mocks.prisma.vendorContract.create).not.toHaveBeenCalled();
  });

  it("rejects a missing clause selection as BAD_REQUEST", async () => {
    const caller = callerWithRole("PRIVACY_OFFICER");
    const partial = Object.fromEntries(
      Object.entries(GENERATE_INPUT.selections).filter(
        ([id]) => id !== "liability-indemnification"
      )
    );
    await expect(
      caller.generateDpa({ ...GENERATE_INPUT, selections: partial })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.prisma.vendorContract.create).not.toHaveBeenCalled();
  });

  it("rejects missing required facts as BAD_REQUEST", async () => {
    const caller = callerWithRole("PRIVACY_OFFICER");
    await expect(
      caller.generateDpa({
        ...GENERATE_INPUT,
        facts: { "processor-establishment": "US" },
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
