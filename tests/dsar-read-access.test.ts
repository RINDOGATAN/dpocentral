// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Who reads the contents of rights requests (src/lib/dsar-access.ts).
 *
 *   OWNER, ADMIN, PRIVACY_OFFICER  every request of the organisation
 *   MEMBER, VIEWER                 only a request with a task assigned to them
 *
 * Every member keeps the aggregate figures (getStats). Each opening of a
 * request writes a "VIEWED" entry in DSARAuditLog (who, when), at most one per
 * person and request every five minutes. The organisation's JSON export
 * follows the same rule.
 *
 * Prisma is module-mocked: we assert on the filters the router issues and on
 * what it writes. The mocked findFirst/findMany honour the assignee filter so
 * the outcome, not only the query, is checked.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    organizationMember: { findUnique: vi.fn(), findFirst: vi.fn() },
    organizationJurisdiction: { findMany: vi.fn() },
    dSARRequest: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
    dSARAuditLog: { findFirst: vi.fn(), create: vi.fn() },
    dSARIntakeForm: { findMany: vi.fn() },
    auditLog: { create: vi.fn() },
    user: { update: vi.fn() },
  },
  token: { email: "user-a@test.example" } as { email?: string } | null,
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/server/services/dsar/sendConfirmationEmail", () => ({ sendDSARConfirmationEmail: vi.fn() }));
vi.mock("@/server/services/dsar/sendCommunicationEmail", () => ({ sendDSARCommunicationEmail: vi.fn() }));
vi.mock("@/lib/session-cookie", () => ({ getSessionToken: async () => mocks.token }));
vi.mock("@/lib/api-export", () => ({
  checkExportRateLimit: () => null,
  pdfErrorResponse: () => new Response("error", { status: 500 }),
}));

import { dsarRouter } from "@/server/routers/privacy/dsar";
import { canHandleDsars, DSAR_HANDLER_ROLES } from "@/lib/dsar-access";
import { dsarReadFilter, DSAR_VIEW_DEDUPE_MS } from "@/server/services/dsar/access";
import { callerFor, sessionFor } from "./helpers";

const ALL_ROLES = ["OWNER", "ADMIN", "PRIVACY_OFFICER", "MEMBER", "VIEWER"] as const;
const HANDLERS = ["OWNER", "ADMIN", "PRIVACY_OFFICER"];
const OTHERS = ["MEMBER", "VIEWER"];

/** Two requests: user-a holds a task on dsar-assigned only. */
const STORE = [
  {
    id: "dsar-assigned",
    organizationId: "org-a",
    publicId: "P-1",
    status: "IN_PROGRESS",
    requesterName: "Requester One",
    requesterEmail: "one@test.example",
    receivedAt: new Date("2026-09-01"),
    dueDate: new Date("2026-10-01"),
    extendedDueDate: null,
    tasks: [{ id: "t1", assigneeId: "user-a" }],
    communications: [],
    auditLog: [],
  },
  {
    id: "dsar-other",
    organizationId: "org-a",
    publicId: "P-2",
    status: "IN_PROGRESS",
    requesterName: "Requester Two",
    requesterEmail: "two@test.example",
    receivedAt: new Date("2026-09-01"),
    dueDate: new Date("2026-10-01"),
    extendedDueDate: null,
    tasks: [{ id: "t2", assigneeId: "user-b" }],
    communications: [],
    auditLog: [],
  },
];

type Where = { id?: string; tasks?: { some?: { assigneeId?: string } } };
function matches(row: (typeof STORE)[number], where: Where): boolean {
  if (where.id && row.id !== where.id) return false;
  const assignee = where.tasks?.some?.assigneeId;
  if (assignee && !row.tasks.some((t) => t.assigneeId === assignee)) return false;
  return true;
}

function as(role: string) {
  mocks.prisma.organizationMember.findUnique.mockResolvedValue({
    id: "member-a",
    userId: "user-a",
    organizationId: "org-a",
    role,
    organization: { id: "org-a", name: "Org A", slug: "org-a", pilotStartedAt: null },
    user: { locale: null },
  });
  return callerFor(dsarRouter, sessionFor("user-a")) as ReturnType<typeof dsarRouter.createCaller>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.dSARRequest.findFirst.mockImplementation(async ({ where }: { where: Where }) =>
    STORE.find((r) => matches(r, where)) ?? null
  );
  mocks.prisma.dSARRequest.findMany.mockImplementation(async ({ where }: { where: Where }) =>
    STORE.filter((r) => matches(r, where))
  );
  mocks.prisma.dSARRequest.count.mockResolvedValue(2);
  mocks.prisma.dSARRequest.groupBy.mockResolvedValue([]);
  mocks.prisma.organizationJurisdiction.findMany.mockResolvedValue([]);
  mocks.prisma.dSARAuditLog.findFirst.mockResolvedValue(null);
  mocks.prisma.dSARAuditLog.create.mockResolvedValue({});
});

describe("the role matrix", () => {
  it("officers, admins and owners handle requests; members and read-only members do not", () => {
    expect([...DSAR_HANDLER_ROLES].sort()).toEqual([...HANDLERS].sort());
    for (const role of ALL_ROLES) expect(canHandleDsars(role)).toBe(HANDLERS.includes(role));
    expect(canHandleDsars(undefined)).toBe(false);
    expect(canHandleDsars("SOMETHING_ELSE")).toBe(false);
  });

  it("the read filter is empty for handlers and 'assigned to me' for everyone else", () => {
    for (const role of HANDLERS) expect(dsarReadFilter(role, "user-a")).toEqual({});
    for (const role of OTHERS) {
      expect(dsarReadFilter(role, "user-a")).toEqual({ tasks: { some: { assigneeId: "user-a" } } });
    }
  });
});

describe("list", () => {
  it.each(HANDLERS)("%s sees every request", async (role) => {
    const r = await as(role).list({ organizationId: "org-a" });
    expect(r.requests.map((x) => x.id)).toEqual(["dsar-assigned", "dsar-other"]);
    const where = mocks.prisma.dSARRequest.findMany.mock.calls[0][0].where;
    expect(where.organizationId).toBe("org-a");
    expect(where.tasks).toBeUndefined();
  });

  it.each(OTHERS)("%s sees only the request with a task assigned to them", async (role) => {
    const r = await as(role).list({ organizationId: "org-a" });
    expect(r.requests.map((x) => x.id)).toEqual(["dsar-assigned"]);
    const where = mocks.prisma.dSARRequest.findMany.mock.calls[0][0].where;
    expect(where.organizationId).toBe("org-a");
    expect(where.tasks).toEqual({ some: { assigneeId: "user-a" } });
  });

  it("a search by name cannot reach past the filter", async () => {
    await as("VIEWER").list({ organizationId: "org-a", search: "Two" });
    const where = mocks.prisma.dSARRequest.findMany.mock.calls[0][0].where;
    expect(where.tasks).toEqual({ some: { assigneeId: "user-a" } });
    expect(where.OR).toBeDefined();
  });
});

describe("getById", () => {
  it.each(HANDLERS)("%s opens any request", async (role) => {
    const r = await as(role).getById({ organizationId: "org-a", id: "dsar-other" });
    expect(r.id).toBe("dsar-other");
  });

  it.each(OTHERS)("%s opens the request with a task assigned to them", async (role) => {
    const r = await as(role).getById({ organizationId: "org-a", id: "dsar-assigned" });
    expect(r.id).toBe("dsar-assigned");
    expect(r.requesterName).toBe("Requester One");
  });

  it.each(OTHERS)("%s is refused any other request, with a plain message", async (role) => {
    await expect(as(role).getById({ organizationId: "org-a", id: "dsar-other" })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringContaining("privacy officers, admins and owners"),
    });
    expect(mocks.prisma.dSARAuditLog.create).not.toHaveBeenCalled();
  });

  it("a member gets the same refusal for an id that does not exist (no probing)", async () => {
    await expect(as("MEMBER").getById({ organizationId: "org-a", id: "nope" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(as("ADMIN").getById({ organizationId: "org-a", id: "nope" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("the read is scoped to the caller's organisation", async () => {
    await as("OWNER").getById({ organizationId: "org-a", id: "dsar-other" });
    expect(mocks.prisma.dSARRequest.findFirst.mock.calls[0][0].where).toMatchObject({
      id: "dsar-other",
      organizationId: "org-a",
    });
  });
});

describe("each view is recorded in the request's audit log", () => {
  it("an officer's view: who, which request, action VIEWED", async () => {
    await as("PRIVACY_OFFICER").getById({ organizationId: "org-a", id: "dsar-other" });
    expect(mocks.prisma.dSARAuditLog.create).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.dSARAuditLog.create).toHaveBeenCalledWith({
      data: {
        dsarRequestId: "dsar-other",
        action: "VIEWED",
        performedBy: "user-a",
        details: { role: "PRIVACY_OFFICER", asAssignee: false },
      },
    });
  });

  it("an assignee's view is marked as such", async () => {
    await as("MEMBER").getById({ organizationId: "org-a", id: "dsar-assigned" });
    expect(mocks.prisma.dSARAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        dsarRequestId: "dsar-assigned",
        action: "VIEWED",
        performedBy: "user-a",
        details: { role: "MEMBER", asAssignee: true },
      }),
    });
  });

  it("a reload within five minutes by the same person writes no second entry", async () => {
    mocks.prisma.dSARAuditLog.findFirst.mockResolvedValue({ id: "recent" });
    await as("OWNER").getById({ organizationId: "org-a", id: "dsar-other" });
    expect(mocks.prisma.dSARAuditLog.create).not.toHaveBeenCalled();
    const where = mocks.prisma.dSARAuditLog.findFirst.mock.calls[0][0].where;
    expect(where).toMatchObject({ dsarRequestId: "dsar-other", action: "VIEWED", performedBy: "user-a" });
    const windowStart = where.createdAt.gte as Date;
    expect(Date.now() - windowStart.getTime()).toBeGreaterThanOrEqual(DSAR_VIEW_DEDUPE_MS - 1000);
    expect(Date.now() - windowStart.getTime()).toBeLessThanOrEqual(DSAR_VIEW_DEDUPE_MS + 1000);
  });

  it("listing requests records no view", async () => {
    await as("OWNER").list({ organizationId: "org-a" });
    expect(mocks.prisma.dSARAuditLog.create).not.toHaveBeenCalled();
  });
});

describe("aggregate figures stay open to every member", () => {
  it.each([...ALL_ROLES])("%s reads getStats", async (role) => {
    mocks.prisma.dSARRequest.findMany.mockResolvedValue([]);
    const r = await as(role).getStats({ organizationId: "org-a" });
    expect(r.total).toBe(2);
    // Counts only: no requester field is selected for the average.
    const select = mocks.prisma.dSARRequest.findMany.mock.calls[0][0].select;
    expect(Object.keys(select).sort()).toEqual(["completedAt", "receivedAt"]);
  });
});

describe("the organisation's JSON export follows the same rule", () => {
  async function exportAs(role: string) {
    mocks.prisma.organizationMember.findFirst.mockResolvedValue({
      id: "member-a",
      userId: "user-a",
      organizationId: "org-a",
      role,
      organization: { id: "org-a", name: "Org A", slug: "org-a", domain: null, settings: null, createdAt: new Date() },
    });
    const models = [
      "organizationMember", "organizationJurisdiction", "dataAsset", "processingActivity",
      "dataFlow", "dataTransfer", "dSARIntakeForm", "assessmentTemplate", "assessment",
      "incident", "vendor", "aISystem",
    ];
    for (const m of models) {
      const p = mocks.prisma as unknown as Record<string, Record<string, unknown>>;
      p[m] = { ...(p[m] ?? {}), findMany: vi.fn().mockResolvedValue([]) };
    }
    const { GET } = await import("@/app/api/export/organization-data/route");
    const res = await GET(new Request("http://localhost/api/export/organization-data?organizationId=org-a"));
    return (await res.json()) as { dsarRequests: { id: string }[] };
  }

  it.each(HANDLERS)("%s exports every request", async (role) => {
    const body = await exportAs(role);
    expect(body.dsarRequests.map((r) => r.id)).toEqual(["dsar-assigned", "dsar-other"]);
  });

  it.each(OTHERS)("%s exports only the request with a task assigned to them", async (role) => {
    const body = await exportAs(role);
    expect(body.dsarRequests.map((r) => r.id)).toEqual(["dsar-assigned"]);
  });
});
