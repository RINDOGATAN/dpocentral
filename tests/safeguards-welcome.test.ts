// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The first-visit welcome card and its safeguards question (owner's
 * decisions O1 to O3, 9 October 2026):
 *
 *  - who sees it: the organisation's creator on the hosted service, once,
 *    while unanswered; never a colleague, never on the kit;
 *  - "decide later" closes it and is recorded as "later" (counts as a);
 *  - answers b and c store a request and mail it to the sales inbox only
 *    (SALES_INBOX_EMAIL, else the operator's inbox), with a calm result even
 *    when the mail service fails;
 *  - requests closed more than six months ago are purged daily, behind
 *    CRON_SECRET; open ones are never touched.
 *
 * Prisma and the mail client are module-mocked.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SafeguardsChoice } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    organization: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    organizationMember: { findUnique: vi.fn(), count: vi.fn() },
    safeguardsRequest: {
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    customer: { findUnique: vi.fn(), create: vi.fn() },
    customerOrganization: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
  send: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/server/services/dsar/defaultIntakeForm", () => ({ ensureDefaultIntakeForm: vi.fn() }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mocks.send };
  },
}));

import { safeguardsRouter } from "@/server/routers/privacy/safeguards";
import { organizationRouter } from "@/server/routers/privacy/organization";
import {
  purgeClosedSafeguardsRequests,
  purgeCutoff,
  salesInboxAddresses,
  shouldShowWelcome,
} from "@/server/services/safeguards";
import { GET as purgeCron } from "@/app/api/cron/safeguards-requests-purge/route";
import { callerFor, sessionFor } from "./helpers";

const ENV_KEYS = [
  "VERCEL_ENV",
  "AUTH_COOKIE_DOMAIN",
  "SALES_INBOX_EMAIL",
  "CONTACT_EMAIL",
  "ADMIN_EMAILS",
  "RESEND_API_KEY",
  "CRON_SECRET",
] as const;
const saved: Record<string, string | undefined> = {};

function hosted(on: boolean) {
  if (on) process.env.VERCEL_ENV = "production";
  else delete process.env.VERCEL_ENV;
  delete process.env.AUTH_COOKIE_DOMAIN;
}

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  pilotStartedAt: Date | null;
  welcomeUserId: string | null;
  safeguardsChoice: SafeguardsChoice | null;
  safeguardsChoiceAt: Date | null;
};

function org(over: Partial<OrgRow> = {}): OrgRow {
  return {
    id: "org-a",
    name: "Org A",
    slug: "org-a",
    pilotStartedAt: new Date(),
    welcomeUserId: "creator",
    safeguardsChoice: null,
    safeguardsChoiceAt: null,
    ...over,
  };
}

function as(userId: string, role: string, row: OrgRow = org(), cookies: Record<string, string> = {}) {
  mocks.prisma.organizationMember.findUnique.mockResolvedValue({
    id: `m-${userId}`,
    userId,
    organizationId: row.id,
    role,
    organization: row,
    user: { locale: null },
  });
  return callerFor(safeguardsRouter, sessionFor(userId, `${userId}@firm.example`), cookies) as ReturnType<
    typeof safeguardsRouter.createCaller
  >;
}

const REQUEST = {
  organizationId: "org-a",
  choice: "managed" as const,
  name: "Ana",
  email: "ana@firm.example",
  organizationName: "Org A",
  country: "España",
  userCount: "6-25" as const,
  message: "Necesitamos un SLA.",
};

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  for (const k of ENV_KEYS) delete process.env[k];
  hosted(true);
  process.env.RESEND_API_KEY = "re_test_key";
  mocks.send.mockResolvedValue({ data: { id: "mail-1" }, error: null });
  mocks.prisma.organization.update.mockResolvedValue({});
  mocks.prisma.organization.updateMany.mockResolvedValue({ count: 0 });
  mocks.prisma.auditLog.create.mockResolvedValue({});
  mocks.prisma.safeguardsRequest.count.mockResolvedValue(0);
  mocks.prisma.safeguardsRequest.create.mockImplementation(async ({ data }: { data: object }) => ({
    id: "req-1",
    createdAt: new Date("2026-10-09T10:00:00Z"),
    ...data,
  }));
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("who sees the welcome card", () => {
  it("the creator, on the hosted service, while unanswered", () => {
    const env = { VERCEL_ENV: "production" };
    expect(shouldShowWelcome(org(), "creator", env)).toBe(true);
    expect(shouldShowWelcome(org(), "colleague", env)).toBe(false);
    expect(shouldShowWelcome(org({ safeguardsChoice: "later" }), "creator", env)).toBe(false);
    expect(shouldShowWelcome(org({ welcomeUserId: null }), "creator", env)).toBe(false);
  });

  it("never on a self-hosted install", () => {
    expect(shouldShowWelcome(org(), "creator", {})).toBe(false);
    expect(shouldShowWelcome(org(), "creator", { AUTH_COOKIE_DOMAIN: ".todo.law" })).toBe(true);
  });

  it("getWelcome tells the creator to show it, with the form's pre-fill", async () => {
    const result = await as("creator", "OWNER").getWelcome({ organizationId: "org-a" });
    expect(result).toEqual({
      show: true,
      prefill: { name: "creator", email: "creator@firm.example", organizationName: "Org A" },
    });
  });

  it("getWelcome hides it from a colleague invited later, and on the kit", async () => {
    expect(await as("colleague", "ADMIN").getWelcome({ organizationId: "org-a" })).toEqual({ show: false });
    hosted(false);
    expect(await as("creator", "OWNER").getWelcome({ organizationId: "org-a" })).toEqual({ show: false });
  });

  it("a new organisation on the hosted service records its creator; on the kit, nobody", async () => {
    mocks.prisma.organization.findUnique.mockResolvedValue(null);
    mocks.prisma.user.findUnique.mockResolvedValue(null);
    mocks.prisma.organizationMember.count.mockResolvedValue(0);
    mocks.prisma.organization.create.mockImplementation(async ({ data }: { data: object }) => ({
      id: "org-new",
      ...data,
      members: [],
    }));
    const create = (userId: string) =>
      (callerFor(organizationRouter, sessionFor(userId)) as ReturnType<
        typeof organizationRouter.createCaller
      >).create({ name: "Nueva", slug: "nueva" });

    await create("creator");
    expect(mocks.prisma.organization.create.mock.calls[0][0].data.welcomeUserId).toBe("creator");

    hosted(false);
    await create("someone");
    expect(mocks.prisma.organization.create.mock.calls[1][0].data.welcomeUserId).toBeNull();
  });
});

describe("decide later", () => {
  it("records 'later', clears the card and sends nothing", async () => {
    await as("creator", "OWNER").setChoice({ organizationId: "org-a", choice: "later" });
    expect(mocks.prisma.organization.update).toHaveBeenCalledWith({
      where: { id: "org-a" },
      data: expect.objectContaining({
        safeguardsChoice: "later",
        safeguardsChoiceById: "creator",
        welcomeUserId: null,
      }),
    });
    expect(mocks.prisma.safeguardsRequest.create).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("is open after the pilot's editing window has ended", async () => {
    const expired = org({ pilotStartedAt: new Date("2026-01-01T00:00:00Z") });
    await expect(
      as("creator", "OWNER", expired).setChoice({ organizationId: "org-a", choice: "shared_eu" })
    ).resolves.toEqual({ choice: "shared_eu" });
  });

  it("only an owner or admin answers; the kit refuses", async () => {
    for (const role of ["PRIVACY_OFFICER", "MEMBER", "VIEWER"]) {
      await expect(as("u", role).setChoice({ organizationId: "org-a", choice: "later" })).rejects.toThrow();
    }
    hosted(false);
    await expect(
      as("creator", "OWNER").setChoice({ organizationId: "org-a", choice: "later" })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(mocks.prisma.organization.update).not.toHaveBeenCalled();
  });
});

describe("answers b and c", () => {
  it("store the request, record the answer and mail the sales inbox only", async () => {
    process.env.SALES_INBOX_EMAIL = "sales@company.example";
    process.env.CONTACT_EMAIL = "support@company.example";
    const result = await as("creator", "OWNER", org(), { locale: "es" }).submitRequest(REQUEST);

    expect(result).toEqual({ stored: true, delivered: true });
    expect(mocks.prisma.safeguardsRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org-a",
        choice: "managed",
        name: "Ana",
        email: "ana@firm.example",
        country: "España",
        userCount: "6-25",
        message: "Necesitamos un SLA.",
        locale: "es",
      }),
    });
    expect(mocks.prisma.organization.update).toHaveBeenCalledWith({
      where: { id: "org-a" },
      data: expect.objectContaining({ safeguardsChoice: "managed", welcomeUserId: null }),
    });

    expect(mocks.send).toHaveBeenCalledTimes(1);
    const mail = mocks.send.mock.calls[0][0];
    expect(mail.to).toEqual(["sales@company.example"]);
    expect(mail.replyTo).toBe("ana@firm.example");
    expect(mail.subject).not.toContain("Ana");
    expect(mail.html).toContain("Necesitamos un SLA.");
    expect(mail.html).toContain("España");
  });

  it("keeps no personal detail in the audit trail", async () => {
    await as("creator", "OWNER").submitRequest({ ...REQUEST, choice: "own_hardware" });
    const audit = mocks.prisma.auditLog.create.mock.calls[0][0].data;
    expect(audit.changes).toEqual({ safeguardsChoice: "own_hardware" });
    expect(JSON.stringify(audit)).not.toContain("ana@firm.example");
  });

  it("without SALES_INBOX_EMAIL, goes to the inbox the operator already reads", () => {
    process.env.CONTACT_EMAIL = "support@company.example";
    expect(salesInboxAddresses()).toEqual(["support@company.example"]);
    expect(salesInboxAddresses({ SALES_INBOX_EMAIL: "a@x.example, b@x.example" })).toEqual([
      "a@x.example",
      "b@x.example",
    ]);
  });

  it("escapes what the person typed", async () => {
    await as("creator", "OWNER").submitRequest({ ...REQUEST, message: "<script>x</script>" });
    expect(mocks.send.mock.calls[0][0].html).not.toContain("<script>");
  });

  it("stays stored and answers calmly when the mail service fails", async () => {
    mocks.send.mockResolvedValue({ data: null, error: { message: "down" } });
    const result = await as("creator", "OWNER").submitRequest(REQUEST);
    expect(result).toEqual({ stored: true, delivered: false });
    expect(mocks.prisma.safeguardsRequest.create).toHaveBeenCalled();
  });

  it("refuses a fourth open request, invalid details, a or later, and the kit", async () => {
    mocks.prisma.safeguardsRequest.count.mockResolvedValue(3);
    await expect(as("creator", "OWNER").submitRequest(REQUEST)).rejects.toMatchObject({ code: "CONFLICT" });
    mocks.prisma.safeguardsRequest.count.mockResolvedValue(0);

    await expect(
      as("creator", "OWNER").submitRequest({ ...REQUEST, email: "not-an-address" })
    ).rejects.toThrow();
    await expect(
      as("creator", "OWNER").submitRequest({ ...REQUEST, choice: "shared_eu" as never })
    ).rejects.toThrow();
    await expect(as("u", "MEMBER").submitRequest(REQUEST)).rejects.toThrow();

    hosted(false);
    await expect(as("creator", "OWNER").submitRequest(REQUEST)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(mocks.prisma.safeguardsRequest.create).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("Settings shows the answer and an open request, on the hosted service only", async () => {
    mocks.prisma.safeguardsRequest.findFirst.mockResolvedValue({
      choice: "managed",
      createdAt: new Date("2026-10-09T10:00:00Z"),
    });
    const row = org({ safeguardsChoice: "managed", welcomeUserId: null });
    const status = await as("colleague", "VIEWER", row).getStatus({ organizationId: "org-a" });
    expect(status).toMatchObject({ hosted: true, choice: "managed", openRequest: { choice: "managed" } });
    expect(mocks.prisma.safeguardsRequest.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: "org-a", status: "open" } })
    );

    hosted(false);
    expect(await as("colleague", "VIEWER", row).getStatus({ organizationId: "org-a" })).toEqual({
      hosted: false,
    });
  });
});

describe("the purge", () => {
  const now = new Date("2027-10-10T03:30:00Z");

  it("deletes only requests closed more than six months ago", async () => {
    mocks.prisma.safeguardsRequest.deleteMany.mockResolvedValue({ count: 2 });
    const result = await purgeClosedSafeguardsRequests(mocks.prisma, now);
    expect(result.deleted).toBe(2);
    expect(mocks.prisma.safeguardsRequest.deleteMany).toHaveBeenCalledWith({
      where: { status: "closed", closedAt: { lt: new Date("2027-04-10T03:30:00Z") } },
    });
    expect(purgeCutoff(now).toISOString()).toBe("2027-04-10T03:30:00.000Z");
  });

  it("the cron fails closed without CRON_SECRET and refuses a wrong secret", async () => {
    const call = (auth?: string) =>
      purgeCron(
        new Request("http://localhost/api/cron/safeguards-requests-purge", {
          headers: auth ? { authorization: auth } : {},
        })
      );
    expect((await call("Bearer x")).status).toBe(503);

    process.env.CRON_SECRET = "cron-secret";
    expect((await call("Bearer wrong")).status).toBe(401);
    expect(mocks.prisma.safeguardsRequest.deleteMany).not.toHaveBeenCalled();

    mocks.prisma.safeguardsRequest.deleteMany.mockResolvedValue({ count: 1 });
    const ok = await call("Bearer cron-secret");
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(body.summary.deleted).toBe(1);
    expect(mocks.prisma.safeguardsRequest.deleteMany).toHaveBeenCalledWith({
      where: { status: "closed", closedAt: { lt: expect.any(Date) } },
    });
  });
});
