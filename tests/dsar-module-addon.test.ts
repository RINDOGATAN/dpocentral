// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The rights-request module per organisation on the hosted service (owner's
 * decisions of 11 October 2026; src/server/services/dsar/module.ts):
 *
 *  - the kit is never limited;
 *  - a pilot organisation: 3 public-form requests in total;
 *  - a paid organisation with the add-on ACTIVE: 10 public-form requests per
 *    calendar month, Europe/Madrid;
 *  - a paid organisation without it: no new request, a neutral "not
 *    available" answer on the public pages, staff still read what is held;
 *  - staff-entered requests never count;
 *  - retention 30 days after closing on the hosted service.
 *
 * Prisma is module-mocked.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    organization: { findUnique: vi.fn(), updateMany: vi.fn() },
    organizationMember: { findUnique: vi.fn() },
    organizationJurisdiction: { findMany: vi.fn() },
    dSARRequest: {
      create: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    dSARAuditLog: { create: vi.fn(), findFirst: vi.fn() },
    auditLog: { create: vi.fn(), count: vi.fn() },
    $queryRaw: vi.fn(async () => [{ count: 1 }]),
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/server/services/dsar/sendConfirmationEmail", () => ({ sendDSARConfirmationEmail: vi.fn() }));
vi.mock("@/server/services/dsar/sendCommunicationEmail", () => ({ sendDSARCommunicationEmail: vi.fn() }));

import { dsarRouter } from "@/server/routers/privacy/dsar";
import { issueFormToken } from "@/server/services/dsar/public-intake-guard";
import {
  countPublicFormRequests,
  DSAR_ADDON_PRICE_LINE,
  DSAR_PUBLIC_SUBMISSION,
  dsarModuleGate,
  effectiveRetentionDays,
  getDsarModuleAccess,
  madridMonthWindow,
  PAID_PUBLIC_REQUESTS_PER_MONTH,
  PILOT_PUBLIC_REQUEST_CAP,
} from "@/server/services/dsar/module";
import { callerFor, sessionFor } from "./helpers";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

const hosted = () => vi.stubEnv("VERCEL_ENV", "production");
const kit = () => {
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("AUTH_COOKIE_DOMAIN", "");
};

const FORM = { id: "form-1", isActive: true, retentionDays: 90, privacyContactEmail: "privacy@acme.example", enabledTypes: [] };
const org = (over: Record<string, unknown> = {}) => ({
  id: "org-a",
  name: "Acme",
  slug: "acme",
  plan: "PILOT",
  dsarModuleStatus: null,
  pilotStartedAt: new Date(),
  dsarIntakeForms: [FORM],
  jurisdictions: [],
  ...over,
});
const PAID_ACTIVE = { plan: "EU_CLOUD", dsarModuleStatus: "ACTIVE" };
const PAID_INACTIVE = { plan: "EU_CLOUD", dsarModuleStatus: null };

const anon = () => callerFor(dsarRouter, null) as ReturnType<typeof dsarRouter.createCaller>;
const submission = () => ({
  orgSlug: "acme",
  type: "ACCESS" as const,
  requesterName: "Jane Public",
  requesterEmail: "jane@example.com",
  formToken: issueFormToken("acme", new Date(Date.now() - 10_000)),
});

function staff(orgRow: Record<string, unknown>) {
  mocks.prisma.organizationMember.findUnique.mockResolvedValue({
    id: "m-1",
    userId: "user-a",
    organizationId: "org-a",
    role: "OWNER",
    organization: orgRow,
    user: { locale: null },
  });
  return callerFor(dsarRouter, sessionFor("user-a")) as ReturnType<typeof dsarRouter.createCaller>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.dSARRequest.create.mockImplementation(async ({ data }) => ({ id: "dsar-1", publicId: "PUB-1", ...data }));
  mocks.prisma.dSARRequest.count.mockResolvedValue(0);
  mocks.prisma.auditLog.count.mockResolvedValue(0);
  mocks.prisma.auditLog.create.mockResolvedValue({});
  mocks.prisma.dSARAuditLog.create.mockResolvedValue({});
  mocks.prisma.organizationJurisdiction.findMany.mockResolvedValue([]);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("the gate", () => {
  it("is open on the kit, whatever the plan", () => {
    expect(dsarModuleGate({ plan: "EU_CLOUD", dsarModuleStatus: null }, false)).toBe("open");
    expect(dsarModuleGate({ plan: "PILOT" }, false)).toBe("open");
  });

  it("on the hosted service: pilot, active with the add-on, inactive without it", () => {
    expect(dsarModuleGate({ plan: "PILOT", dsarModuleStatus: null }, true)).toBe("pilot");
    expect(dsarModuleGate({ plan: "PILOT", dsarModuleStatus: "ACTIVE" }, true)).toBe("pilot");
    expect(dsarModuleGate({ plan: "EU_CLOUD", dsarModuleStatus: "ACTIVE" }, true)).toBe("active");
    for (const s of [null, undefined, "NONE", "CANCELLED"]) {
      expect(dsarModuleGate({ plan: "EU_CLOUD", dsarModuleStatus: s }, true)).toBe("inactive");
    }
  });
});

describe("the calendar month in Madrid", () => {
  it("starts and ends at Madrid midnight, across the October clock change", () => {
    const w = madridMonthWindow(new Date("2026-10-15T12:00:00Z"));
    expect(w.start.toISOString()).toBe("2026-09-30T22:00:00.000Z"); // CEST, UTC+2
    expect(w.end.toISOString()).toBe("2026-10-31T23:00:00.000Z"); // CET, UTC+1
  });

  it("puts the last hour of 31 October UTC in November when it is already November in Madrid", () => {
    expect(madridMonthWindow(new Date("2026-10-31T22:59:59Z")).start.toISOString()).toBe("2026-09-30T22:00:00.000Z");
    expect(madridMonthWindow(new Date("2026-10-31T23:00:00Z")).start.toISOString()).toBe("2026-10-31T23:00:00.000Z");
  });

  it("rolls over the year", () => {
    const w = madridMonthWindow(new Date("2026-12-31T23:30:00Z"));
    expect(w.start.toISOString()).toBe("2026-12-31T23:00:00.000Z");
    expect(w.end.toISOString()).toBe("2027-01-31T23:00:00.000Z");
  });
});

describe("counting public-form requests", () => {
  it("counts the organisation entries and the requests' own trail, and takes the larger", async () => {
    mocks.prisma.auditLog.count.mockResolvedValue(2);
    mocks.prisma.dSARRequest.count.mockResolvedValue(5);
    const window = { start: new Date("2026-09-30T22:00:00Z"), end: new Date("2026-10-31T23:00:00Z") };
    await expect(countPublicFormRequests(mocks.prisma, "org-a", window)).resolves.toBe(5);
    expect(mocks.prisma.auditLog.count).toHaveBeenCalledWith({
      where: { organizationId: "org-a", action: DSAR_PUBLIC_SUBMISSION, createdAt: { gte: window.start, lt: window.end } },
    });
    expect(mocks.prisma.dSARRequest.count).toHaveBeenCalledWith({
      where: {
        organizationId: "org-a",
        auditLog: { some: { action: "REQUEST_SUBMITTED_PUBLIC" } },
        receivedAt: { gte: window.start, lt: window.end },
      },
    });
  });

  it("pilot: 3 in total, no window", async () => {
    mocks.prisma.auditLog.count.mockResolvedValue(3);
    const access = await getDsarModuleAccess(mocks.prisma, org(), new Date(), true);
    expect(access).toMatchObject({ gate: "pilot", limit: PILOT_PUBLIC_REQUEST_CAP, used: 3, remaining: 0, period: "total" });
    expect(mocks.prisma.auditLog.count.mock.calls[0][0].where.createdAt).toBeUndefined();
  });

  it("with the add-on: 10 in the Madrid month containing now", async () => {
    mocks.prisma.auditLog.count.mockResolvedValue(4);
    const access = await getDsarModuleAccess(mocks.prisma, org(PAID_ACTIVE), new Date("2026-10-15T12:00:00Z"), true);
    expect(access).toMatchObject({ gate: "active", limit: PAID_PUBLIC_REQUESTS_PER_MONTH, used: 4, remaining: 6, period: "month" });
    if (access.gate !== "active") throw new Error("expected active");
    expect(access.resetsAt?.toISOString()).toBe("2026-10-31T23:00:00.000Z");
  });
});

describe("the public form on the hosted service", () => {
  beforeEach(hosted);

  it("pilot: takes the third request and refuses the fourth", async () => {
    mocks.prisma.organization.findUnique.mockResolvedValue(org());
    mocks.prisma.auditLog.count.mockResolvedValue(2);
    await expect(anon().submitPublic(submission())).resolves.toMatchObject({ publicId: "PUB-1" });
    mocks.prisma.auditLog.count.mockResolvedValue(3);
    mocks.prisma.dSARRequest.create.mockClear();
    await expect(anon().submitPublic(submission())).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringContaining("not taking requests"),
    });
    expect(mocks.prisma.dSARRequest.create).not.toHaveBeenCalled();
  });

  it("at the limit, the form shows the privacy contact e-mail instead of accepting", async () => {
    mocks.prisma.organization.findUnique.mockResolvedValue(org());
    mocks.prisma.auditLog.count.mockResolvedValue(3);
    await expect(anon().getPublicForm({ orgSlug: "acme" })).resolves.toMatchObject({
      accepting: false,
      contactEmail: "privacy@acme.example",
    });
    mocks.prisma.auditLog.count.mockResolvedValue(1);
    await expect(anon().getPublicForm({ orgSlug: "acme" })).resolves.toMatchObject({
      accepting: true,
      contactEmail: null,
    });
  });

  it("at the limit with no contact e-mail, the form has none to show (the page says to contact the organisation)", async () => {
    mocks.prisma.organization.findUnique.mockResolvedValue(
      org({ dsarIntakeForms: [{ ...FORM, privacyContactEmail: null }] })
    );
    mocks.prisma.auditLog.count.mockResolvedValue(3);
    await expect(anon().getPublicForm({ orgSlug: "acme" })).resolves.toMatchObject({ accepting: false, contactEmail: null });
  });

  it("with the add-on: the tenth request of the month is taken, the eleventh refused", async () => {
    mocks.prisma.organization.findUnique.mockResolvedValue(org(PAID_ACTIVE));
    mocks.prisma.auditLog.count.mockResolvedValue(9);
    await expect(anon().submitPublic(submission())).resolves.toMatchObject({ publicId: "PUB-1" });
    mocks.prisma.auditLog.count.mockResolvedValue(10);
    await expect(anon().submitPublic(submission())).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("with the add-on: the count starts again on the first of the month, Madrid time", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-31T23:30:00Z")); // 1 November, 00:30 in Madrid
    mocks.prisma.organization.findUnique.mockResolvedValue(org(PAID_ACTIVE));
    await anon().getPublicForm({ orgSlug: "acme" });
    const { where } = mocks.prisma.auditLog.count.mock.calls[0][0];
    expect(where.createdAt.gte.toISOString()).toBe("2026-10-31T23:00:00.000Z");
    expect(where.createdAt.lt.toISOString()).toBe("2026-11-30T23:00:00.000Z");
  });

  it("records each public-form request in the organisation's log, with no personal data", async () => {
    mocks.prisma.organization.findUnique.mockResolvedValue(org());
    await anon().submitPublic({ ...submission(), description: "my health records", locale: "es" });
    expect(mocks.prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        organizationId: "org-a",
        entityType: "DSARRequest",
        entityId: "dsar-1",
        action: DSAR_PUBLIC_SUBMISSION,
        metadata: { type: "ACCESS" },
      },
    });
    expect(JSON.stringify(mocks.prisma.auditLog.create.mock.calls)).not.toMatch(/Jane|jane@|health/);
    // The requester's language is kept for the e-mails that follow.
    expect(mocks.prisma.dSARRequest.create.mock.calls[0][0].data.metadata).toEqual({ locale: "es" });
  });

  it("tells the requester 30 days of retention on the hosted service", async () => {
    mocks.prisma.organization.findUnique.mockResolvedValue(org());
    await expect(anon().getPublicForm({ orgSlug: "acme" })).resolves.toMatchObject({ retentionDays: 30 });
  });

  describe("paid plan without the add-on", () => {
    beforeEach(() => mocks.prisma.organization.findUnique.mockResolvedValue(org(PAID_INACTIVE)));

    it("answers the form exactly as for an organisation with no form", async () => {
      const inactive = await anon().getPublicForm({ orgSlug: "acme" }).catch((e) => e);
      mocks.prisma.organization.findUnique.mockResolvedValue(null);
      const unknown = await anon().getPublicForm({ orgSlug: "acme" }).catch((e) => e);
      expect(inactive.code).toBe("NOT_FOUND");
      expect(inactive.code).toBe(unknown.code);
      expect(inactive.message).toBe(unknown.message);
    });

    it("refuses a submission without creating anything", async () => {
      await expect(anon().submitPublic(submission())).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(mocks.prisma.dSARRequest.create).not.toHaveBeenCalled();
    });

    it("the status page gets a neutral answer that names nothing", async () => {
      mocks.prisma.dSARRequest.findUnique.mockResolvedValue({
        publicId: "PUB-1",
        type: "ACCESS",
        status: "SUBMITTED",
        organization: { name: "Acme", slug: "acme", ...PAID_INACTIVE },
      });
      await expect(anon().checkStatus({ publicId: "PUB-1" })).resolves.toEqual({ available: false });
    });

    it("refuses a withdrawal from the status page", async () => {
      mocks.prisma.dSARRequest.findUnique.mockResolvedValue({ id: "dsar-1", status: "SUBMITTED", organization: PAID_INACTIVE });
      await expect(anon().withdrawPublic({ publicId: "PUB-1" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("refuses a request entered by staff, and keeps the ones held readable", async () => {
      const c = staff(org(PAID_INACTIVE));
      await expect(
        c.create({ organizationId: "org-a", type: "ACCESS", requesterName: "R", requesterEmail: "r@test.example" })
      ).rejects.toMatchObject({ code: "FORBIDDEN", message: expect.stringContaining("add-on") });
      mocks.prisma.dSARRequest.findMany.mockResolvedValue([
        { id: "dsar-1", dueDate: new Date(), _count: { tasks: 0, communications: 0 } },
      ]);
      await expect(c.list({ organizationId: "org-a" })).resolves.toMatchObject({ requests: [{ id: "dsar-1" }] });
      await expect(c.moduleAccess({ organizationId: "org-a" })).resolves.toEqual({ gate: "inactive" });
    });
  });

  it("requests entered by staff never count and write no public-form entry", async () => {
    const c = staff(org());
    await c.create({ organizationId: "org-a", type: "ACCESS", requesterName: "R", requesterEmail: "r@test.example" });
    const actions = mocks.prisma.auditLog.create.mock.calls.map((call) => call[0].data.action);
    expect(actions).not.toContain(DSAR_PUBLIC_SUBMISSION);
    // A staff request is created even when the public form is at its limit.
    mocks.prisma.auditLog.count.mockResolvedValue(3);
    await expect(
      c.create({ organizationId: "org-a", type: "ACCESS", requesterName: "R", requesterEmail: "r@test.example" })
    ).resolves.toMatchObject({ id: "dsar-1" });
  });
});

describe("the kit", () => {
  beforeEach(kit);

  it("never limits the public form and keeps the form's retention", async () => {
    mocks.prisma.organization.findUnique.mockResolvedValue(org(PAID_INACTIVE));
    mocks.prisma.auditLog.count.mockResolvedValue(1000);
    await expect(anon().getPublicForm({ orgSlug: "acme" })).resolves.toMatchObject({ accepting: true, retentionDays: 90 });
    await expect(anon().submitPublic(submission())).resolves.toMatchObject({ publicId: "PUB-1" });
  });
});

describe("retention", () => {
  it("is fixed at 30 days on the hosted service; the form's setting on the kit", () => {
    expect(effectiveRetentionDays(365, true)).toBe(30);
    expect(effectiveRetentionDays(null, true)).toBe(30);
    expect(effectiveRetentionDays(365, false)).toBe(365);
    expect(effectiveRetentionDays(null, false)).toBe(90);
  });

  it("counts from closing, whichever way a request is closed", async () => {
    hosted();
    const c = staff(org());
    mocks.prisma.dSARRequest.findFirst.mockResolvedValue({ id: "dsar-1", status: "IN_PROGRESS" });
    mocks.prisma.dSARRequest.update.mockResolvedValue({});
    for (const status of ["REJECTED", "CANCELLED", "COMPLETED"] as const) {
      mocks.prisma.dSARRequest.update.mockClear();
      await c.updateStatus({ organizationId: "org-a", id: "dsar-1", status });
      expect(mocks.prisma.dSARRequest.update.mock.calls[0][0].data.completedAt).toBeInstanceOf(Date);
    }
  });
});

describe("the add-on's words", () => {
  it("states the price in US dollars in English and in euros in Spanish", () => {
    expect(en.dsarModule.addOnLine).toBe(DSAR_ADDON_PRICE_LINE.en);
    expect(es.dsarModule.addOnLine).toBe(DSAR_ADDON_PRICE_LINE.es);
    expect(en.dsarModule.addOnLine).toBe("Available as an add-on: $49 a month");
    expect(es.dsarModule.addOnLine).toBe("Disponible como complemento: 49 € al mes");
  });

  it("no longer claims an ID upload the form never asks for", () => {
    const all = JSON.stringify(en) + JSON.stringify(es);
    expect(all).not.toContain("Require ID upload");
    expect(all).not.toContain("Exige subir un documento de identidad");
  });
});
