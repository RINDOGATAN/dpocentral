// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The rights-request module per organisation on the hosted service
 * (src/server/services/dsar/module.ts):
 *
 *  - the kit is never limited;
 *  - every hosted organisation, pilot or paid: open, with a ceiling of 100
 *    public-form requests per calendar month, Europe/Madrid;
 *  - with the volume upgrade (dsarModuleStatus ACTIVE): 1,000;
 *  - the owners are told at 50, 75 and 90 per cent and at the ceiling, once
 *    each per month (src/server/services/dsar/volume-notices.ts);
 *  - the hidden field: answered as if received, nothing stored or counted;
 *  - staff-entered requests never count;
 *  - retention 30 days after closing on the hosted service.
 *
 * Prisma is module-mocked.
 */

import { formatPriceIn } from "@/lib/currency";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    organization: { findUnique: vi.fn(), updateMany: vi.fn() },
    organizationMember: { findUnique: vi.fn(), findMany: vi.fn() },
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
    auditLog: { create: vi.fn(), count: vi.fn(), findMany: vi.fn() },
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
  DSAR_PUBLIC_SUBMISSION,
  DSAR_VOLUME_UPGRADE_MONTHLY_PRICE,
  dsarModuleGate,
  effectiveRetentionDays,
  getDsarModuleAccess,
  madridMonthWindow,
  STANDARD_PUBLIC_REQUESTS_PER_MONTH,
  UPGRADED_PUBLIC_REQUESTS_PER_MONTH,
  warningPercentOf,
  warningThresholds,
} from "@/server/services/dsar/module";
import { volumeUpgradeLinks } from "@/lib/dsar-addon";
import { DSAR_VOLUME_APP_CODE, volumeUpgradeCheckoutUrl } from "@/server/services/dsar/volume-sync";
import { parseOrgReference } from "@/lib/plan-upgrade";
import { renderVolumeNotice } from "@/server/services/dsar/volume-notices";
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
const PAID = { plan: "EU_CLOUD", dsarModuleStatus: null };
const UPGRADED = { plan: "EU_CLOUD", dsarModuleStatus: "ACTIVE" };

const anon = () => callerFor(dsarRouter, null) as ReturnType<typeof dsarRouter.createCaller>;
const submission = () => ({
  orgSlug: "acme",
  type: "ACCESS" as const,
  requesterName: "Jane Public",
  requesterEmail: "jane@example.com",
  formToken: issueFormToken("acme", new Date(Date.now() - 10_000)),
});

function staff(orgRow: Record<string, unknown>, role: string = "OWNER") {
  mocks.prisma.organizationMember.findUnique.mockResolvedValue({
    id: "m-1",
    userId: "user-a",
    organizationId: "org-a",
    role,
    organization: orgRow,
    user: { locale: null },
  });
  return callerFor(dsarRouter, sessionFor("user-a")) as ReturnType<typeof dsarRouter.createCaller>;
}

const volumeNotices = () =>
  mocks.prisma.auditLog.create.mock.calls.map((c) => c[0].data).filter((d) => d.action === "DSAR_VOLUME_NOTICE");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.dSARRequest.create.mockImplementation(async ({ data }) => ({ id: "dsar-1", publicId: "PUB-1", ...data }));
  mocks.prisma.dSARRequest.count.mockResolvedValue(0);
  mocks.prisma.auditLog.count.mockResolvedValue(0);
  mocks.prisma.auditLog.create.mockResolvedValue({});
  mocks.prisma.auditLog.findMany.mockResolvedValue([]);
  mocks.prisma.organizationMember.findMany.mockResolvedValue([]);
  mocks.prisma.dSARAuditLog.create.mockResolvedValue({});
  mocks.prisma.organizationJurisdiction.findMany.mockResolvedValue([]);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("the gate", () => {
  it("is open on the kit, whatever the upgrade", () => {
    expect(dsarModuleGate({ dsarModuleStatus: null }, false)).toBe("open");
    expect(dsarModuleGate({ dsarModuleStatus: "ACTIVE" }, false)).toBe("open");
  });

  it("on the hosted service: standard for everyone, upgraded with the volume upgrade", () => {
    for (const s of [null, undefined, "NONE", "CANCELLED"]) {
      expect(dsarModuleGate({ dsarModuleStatus: s }, true)).toBe("standard");
    }
    expect(dsarModuleGate({ dsarModuleStatus: "ACTIVE" }, true)).toBe("upgraded");
  });

  it("has ceilings of 100 and 1,000 and warns at 50, 75 and 90 per cent", () => {
    expect(STANDARD_PUBLIC_REQUESTS_PER_MONTH).toBe(100);
    expect(UPGRADED_PUBLIC_REQUESTS_PER_MONTH).toBe(1000);
    expect(warningThresholds(100)).toEqual([50, 75, 90]);
    expect(warningThresholds(1000)).toEqual([500, 750, 900]);
    expect(warningPercentOf(49, 100)).toBe(0);
    expect(warningPercentOf(50, 100)).toBe(50);
    expect(warningPercentOf(80, 100)).toBe(75);
    expect(warningPercentOf(99, 100)).toBe(90);
    expect(warningPercentOf(100, 100)).toBe(100);
    expect(warningPercentOf(750, 1000)).toBe(75);
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
  });

  it("a pilot organisation: 100 in the Madrid month containing now", async () => {
    mocks.prisma.auditLog.count.mockResolvedValue(4);
    const access = await getDsarModuleAccess(mocks.prisma, org(), new Date("2026-10-15T12:00:00Z"), true);
    expect(access).toMatchObject({ gate: "standard", limit: 100, used: 4, remaining: 96, warningPercent: 0 });
    if (access.gate === "open") throw new Error("expected a limit");
    expect(access.resetsAt.toISOString()).toBe("2026-10-31T23:00:00.000Z");
  });

  it("with the upgrade: 1,000", async () => {
    mocks.prisma.auditLog.count.mockResolvedValue(600);
    const access = await getDsarModuleAccess(mocks.prisma, org(UPGRADED), new Date(), true);
    expect(access).toMatchObject({ gate: "upgraded", limit: 1000, used: 600, remaining: 400, warningPercent: 50 });
  });
});

describe("the public form on the hosted service", () => {
  beforeEach(hosted);

  it("is open on a paid plan with no add-on (the old add-on gate is gone)", async () => {
    mocks.prisma.organization.findUnique.mockResolvedValue(org(PAID));
    await expect(anon().getPublicForm({ orgSlug: "acme" })).resolves.toMatchObject({ accepting: true, contactEmail: null });
    await expect(anon().submitPublic(submission())).resolves.toMatchObject({ publicId: "PUB-1" });
  });

  it("a pilot takes far more than the old 3 requests", async () => {
    mocks.prisma.organization.findUnique.mockResolvedValue(org());
    mocks.prisma.auditLog.count.mockResolvedValue(3);
    await expect(anon().submitPublic(submission())).resolves.toMatchObject({ publicId: "PUB-1" });
  });

  it("takes the hundredth request of the month and refuses the next", async () => {
    mocks.prisma.organization.findUnique.mockResolvedValue(org(PAID));
    mocks.prisma.auditLog.count.mockResolvedValue(99);
    await expect(anon().submitPublic(submission())).resolves.toMatchObject({ publicId: "PUB-1" });
    mocks.prisma.auditLog.count.mockResolvedValue(100);
    mocks.prisma.dSARRequest.create.mockClear();
    await expect(anon().submitPublic(submission())).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringContaining("not taking requests"),
    });
    expect(mocks.prisma.dSARRequest.create).not.toHaveBeenCalled();
  });

  it("with the upgrade, takes the thousandth and refuses the next", async () => {
    mocks.prisma.organization.findUnique.mockResolvedValue(org(UPGRADED));
    mocks.prisma.auditLog.count.mockResolvedValue(999);
    await expect(anon().submitPublic(submission())).resolves.toMatchObject({ publicId: "PUB-1" });
    mocks.prisma.auditLog.count.mockResolvedValue(1000);
    await expect(anon().submitPublic(submission())).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("at the limit, the form shows the privacy contact e-mail instead of accepting", async () => {
    mocks.prisma.organization.findUnique.mockResolvedValue(org());
    mocks.prisma.auditLog.count.mockResolvedValue(100);
    await expect(anon().getPublicForm({ orgSlug: "acme" })).resolves.toMatchObject({
      accepting: false,
      contactEmail: "privacy@acme.example",
    });
  });

  it("the count starts again on the first of the month, Madrid time", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-31T23:30:00Z")); // 1 November, 00:30 in Madrid
    mocks.prisma.organization.findUnique.mockResolvedValue(org());
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
    expect(mocks.prisma.dSARRequest.create.mock.calls[0][0].data.metadata).toEqual({ locale: "es" });
  });

  it("the status page and withdrawal work on a paid plan with no add-on", async () => {
    mocks.prisma.dSARRequest.findUnique.mockResolvedValue({
      publicId: "PUB-1",
      type: "ACCESS",
      status: "SUBMITTED",
      organization: { name: "Acme", slug: "acme" },
    });
    await expect(anon().checkStatus({ publicId: "PUB-1" })).resolves.toMatchObject({ available: true, status: "SUBMITTED" });
  });

  it("tells the requester 30 days of retention on the hosted service", async () => {
    mocks.prisma.organization.findUnique.mockResolvedValue(org());
    await expect(anon().getPublicForm({ orgSlug: "acme" })).resolves.toMatchObject({ retentionDays: 30 });
  });

  describe("the hidden field", () => {
    it("answers as if received, and stores and counts nothing", async () => {
      mocks.prisma.organization.findUnique.mockResolvedValue(org());
      const result = await anon().submitPublic({ ...submission(), website: "https://spam.example" });
      expect(result.acknowledgementSent).toBe(false);
      expect(result.publicId).toMatch(/^c[a-z0-9]{24}$/);
      expect(mocks.prisma.organization.findUnique).not.toHaveBeenCalled();
      expect(mocks.prisma.dSARRequest.create).not.toHaveBeenCalled();
      expect(mocks.prisma.auditLog.create).not.toHaveBeenCalled();
    });
  });

  describe("the volume notices", () => {
    beforeEach(() => {
      mocks.prisma.organization.findUnique.mockResolvedValue(org(PAID));
      mocks.prisma.organizationMember.findMany.mockResolvedValue([
        { user: { email: "owner@acme.example", locale: "es" } },
      ]);
    });

    it("nothing below half the ceiling", async () => {
      mocks.prisma.auditLog.count.mockResolvedValue(49);
      await anon().submitPublic(submission());
      expect(volumeNotices()).toEqual([]);
    });

    it("records the 50 per cent step once, with no personal data", async () => {
      mocks.prisma.auditLog.count.mockResolvedValue(50);
      await anon().submitPublic(submission());
      expect(volumeNotices()).toEqual([
        expect.objectContaining({ organizationId: "org-a", metadata: expect.objectContaining({ step: 50, used: 50, limit: 100 }) }),
      ]);
      expect(JSON.stringify(volumeNotices())).not.toMatch(/owner@|privacy@|Jane/);
    });

    it("does not repeat a step already told this month", async () => {
      mocks.prisma.auditLog.count.mockResolvedValue(60);
      mocks.prisma.auditLog.findMany.mockResolvedValue([{ metadata: { step: 50 } }]);
      await anon().submitPublic(submission());
      expect(volumeNotices()).toEqual([]);
    });

    it("tells the next step (75) after the 50 one", async () => {
      mocks.prisma.auditLog.count.mockResolvedValue(75);
      mocks.prisma.auditLog.findMany.mockResolvedValue([{ metadata: { step: 50 } }]);
      await anon().submitPublic(submission());
      expect(volumeNotices().map((d) => d.metadata.step)).toEqual([75]);
    });

    it("tells the ceiling (100) after 90", async () => {
      mocks.prisma.auditLog.count.mockResolvedValue(100);
      mocks.prisma.auditLog.findMany.mockResolvedValue([{ metadata: { step: 50 } }, { metadata: { step: 90 } }]);
      await anon().submitPublic(submission()).catch(() => undefined);
      // At 100 before the request, the form refuses it: no new step from a refused request.
      expect(volumeNotices()).toEqual([]);
      mocks.prisma.auditLog.count.mockResolvedValueOnce(99).mockResolvedValue(100);
      await anon().submitPublic(submission());
      expect(volumeNotices().map((d) => d.metadata.step)).toEqual([100]);
    });
  });

  it("requests entered by staff never count and write no public-form entry", async () => {
    const c = staff(org(PAID));
    await c.create({ organizationId: "org-a", type: "ACCESS", requesterName: "R", requesterEmail: "r@test.example" });
    const actions = mocks.prisma.auditLog.create.mock.calls.map((call) => call[0].data.action);
    expect(actions).not.toContain(DSAR_PUBLIC_SUBMISSION);
    // A staff request is created even when the public form is at its limit.
    mocks.prisma.auditLog.count.mockResolvedValue(100);
    await expect(
      c.create({ organizationId: "org-a", type: "ACCESS", requesterName: "R", requesterEmail: "r@test.example" })
    ).resolves.toMatchObject({ id: "dsar-1" });
  });

  it("the organisation audit entry for a staff-entered request records only its type and reference", async () => {
    const c = staff(org(PAID));
    await c.create({
      organizationId: "org-a",
      type: "ACCESS",
      requesterName: "R",
      requesterEmail: "r@test.example",
      requesterPhone: "+34 600 000 000",
      requesterAddress: "Calle 1",
      description: "Quiero mis datos",
    });
    const entry = mocks.prisma.auditLog.create.mock.calls
      .map((call) => call[0].data)
      .find((d) => d.entityType === "DSARRequest" && d.action === "CREATE");
    expect(Object.keys(entry.changes).sort()).toEqual(["requestId", "type"]);
    expect(JSON.stringify(entry.changes)).not.toMatch(/r@test\.example|600 000|Calle|Quiero/);
  });

  it("module access: no upgrade link offered while none is set; with one, it carries the signed organisation reference", async () => {
    const c = staff(org({ ...PAID, id: "orgA1" }));
    mocks.prisma.auditLog.count.mockResolvedValue(60);
    vi.stubEnv("AUTO_UPGRADE_ENABLED", "true");
    vi.stubEnv("PLAN_SYNC_SECRET", "test-secret");
    await expect(c.moduleAccess({ organizationId: "org-a" })).resolves.toMatchObject({
      gate: "standard",
      warningPercent: 50,
      canBuy: true,
      upgrade: { EUR: null, USD: null },
    });
    vi.stubEnv("DSAR_VOLUME_EUR_LINK", "https://buy.stripe.com/test_eur");
    const access = await c.moduleAccess({ organizationId: "org-a" });
    if (access.gate === "open" || !access.upgrade?.EUR) throw new Error("expected a link");
    const ref = new URL(access.upgrade.EUR).searchParams.get("client_reference_id");
    expect(parseOrgReference(ref, "test-secret", DSAR_VOLUME_APP_CODE)).toEqual({ kind: "valid", orgId: "orgA1" });
    // Never a reference the plan would accept.
    expect(parseOrgReference(ref, "test-secret")).toEqual({ kind: "other-app", app: DSAR_VOLUME_APP_CODE });
    expect(access.upgrade.USD).toBeNull();
  });

  it("module access: no link while the automatic upgrade is switched off or has no secret", async () => {
    const c = staff(org({ ...PAID, id: "orgA1" }));
    vi.stubEnv("DSAR_VOLUME_EUR_LINK", "https://buy.stripe.com/test_eur");
    vi.stubEnv("PLAN_SYNC_SECRET", "test-secret");
    await expect(c.moduleAccess({ organizationId: "org-a" })).resolves.toMatchObject({ upgrade: { EUR: null } });
    vi.stubEnv("AUTO_UPGRADE_ENABLED", "true");
    vi.stubEnv("PLAN_SYNC_SECRET", "");
    await expect(c.moduleAccess({ organizationId: "org-a" })).resolves.toMatchObject({ upgrade: { EUR: null } });
  });

  it("module access: only owners and administrators are offered the purchase", async () => {
    vi.stubEnv("AUTO_UPGRADE_ENABLED", "true");
    vi.stubEnv("PLAN_SYNC_SECRET", "test-secret");
    vi.stubEnv("DSAR_VOLUME_EUR_LINK", "https://buy.stripe.com/test_eur");
    const admin = await staff(org({ ...PAID, id: "orgA1" }), "ADMIN").moduleAccess({ organizationId: "org-a" });
    expect(admin).toMatchObject({ canBuy: true });
    if (admin.gate === "open") throw new Error("expected a limited gate");
    expect(admin.upgrade?.EUR).toBeTruthy();
    const officer = await staff(org({ ...PAID, id: "orgA1" }), "PRIVACY_OFFICER").moduleAccess({ organizationId: "org-a" });
    expect(officer).toMatchObject({ canBuy: false, upgrade: null });
  });

  it("module access with the upgrade offers no further upgrade", async () => {
    const c = staff(org(UPGRADED));
    await expect(c.moduleAccess({ organizationId: "org-a" })).resolves.toMatchObject({ gate: "upgraded", upgrade: null });
  });
});

describe("the kit", () => {
  beforeEach(kit);

  it("never limits the public form, sends no notice and keeps the form's retention", async () => {
    mocks.prisma.organization.findUnique.mockResolvedValue(org(PAID));
    mocks.prisma.auditLog.count.mockResolvedValue(5000);
    await expect(anon().getPublicForm({ orgSlug: "acme" })).resolves.toMatchObject({ accepting: true, retentionDays: 90 });
    await expect(anon().submitPublic(submission())).resolves.toMatchObject({ publicId: "PUB-1" });
    expect(volumeNotices()).toEqual([]);
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

describe("the notice e-mail", () => {
  it("says the count, the limit, what happens at the limit and the upgrade, in Spanish", () => {
    const mail = renderVolumeNotice({
      locale: "es",
      orgName: "Acme",
      step: 75,
      used: 75,
      limit: 100,
      resetsAt: new Date("2026-10-31T23:00:00Z"),
      canUpgrade: true,
      link: "https://dpocentral.todo.law/privacy/dsar",
    });
    expect(mail.subject).toBe("Acme: tu formulario de solicitudes de derechos ha recibido 75 de sus 100 solicitudes este mes");
    expect(mail.text).toContain("hasta el 1 de noviembre de 2026");
    expect(mail.text).toContain("1000 solicitudes al mes");
    expect(mail.text).not.toMatch(/—|usted/);
  });

  it("at the ceiling with the upgrade in place, offers no upgrade", () => {
    const mail = renderVolumeNotice({
      locale: "en",
      orgName: "Acme",
      step: 100,
      used: 1000,
      limit: 1000,
      resetsAt: new Date("2026-10-31T23:00:00Z"),
      canUpgrade: false,
      link: "https://dpocentral.todo.law/privacy/dsar",
    });
    expect(mail.subject).toBe("Acme: your rights-request form has reached its monthly limit");
    expect(mail.text).toContain("reply to this e-mail");
    expect(mail.text).not.toContain("volume upgrade");
  });
});

describe("the upgrade's words and links", () => {
  it("takes the price as a parameter, in the currency of the region rule", () => {
    expect(en.dsarModule.volumeUpgrade).toContain("{price} a month");
    expect(es.dsarModule.volumeUpgrade).toContain("{price} al mes");
    expect(DSAR_VOLUME_UPGRADE_MONTHLY_PRICE).toBe(45);
    expect(formatPriceIn(DSAR_VOLUME_UPGRADE_MONTHLY_PRICE, "en", "USD")).toBe("$45");
    expect(formatPriceIn(DSAR_VOLUME_UPGRADE_MONTHLY_PRICE, "es", "EUR")).toBe("45 €");
  });

  it("no add-on wording is left in the module's messages", () => {
    const words = JSON.stringify(en.dsarModule) + JSON.stringify(es.dsarModule);
    expect(words).not.toMatch(/add-on|complemento/i);
  });

  it("reads only https payment links, and adds the organisation and the e-mail", () => {
    expect(volumeUpgradeLinks({ DSAR_VOLUME_EUR_LINK: "http://x", DSAR_VOLUME_USD_LINK: " https://buy.stripe.com/u " })).toEqual({
      EUR: null,
      USD: "https://buy.stripe.com/u",
    });
    const url = new URL(volumeUpgradeCheckoutUrl("https://buy.stripe.com/u", "orgA1", "a@b.example", "s"));
    expect(parseOrgReference(url.searchParams.get("client_reference_id"), "s", DSAR_VOLUME_APP_CODE)).toEqual({
      kind: "valid",
      orgId: "orgA1",
    });
    expect(url.searchParams.get("prefilled_email")).toBe("a@b.example");
    expect(volumeUpgradeCheckoutUrl("https://buy.stripe.com/u", "orgA1", null, "s")).not.toContain("prefilled_email");
  });

  it("no longer claims an ID upload the form never asks for", () => {
    const all = JSON.stringify(en) + JSON.stringify(es);
    expect(all).not.toContain("Require ID upload");
    expect(all).not.toContain("Exige subir un documento de identidad");
  });
});
