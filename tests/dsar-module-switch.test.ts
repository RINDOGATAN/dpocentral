// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The rights-request (DSAR) module switch, NEXT_PUBLIC_DSAR_ENABLED
 * (src/config/features.ts). On by default on every build; "false" leaves the
 * module out of the plan:
 *
 *  - the menu entry, the guided step, the help and the docs entries go, and
 *    the dashboard pages show a short neutral note (owners and admins also get
 *    the download of the records the organisation already holds);
 *  - the public form and status pages, and the module's PDF report, answer 404;
 *  - every procedure of the module's API refuses with NOT_FOUND before it
 *    reads anything, the public ones included;
 *  - a new organisation gets no default public form;
 *  - the deadline-reminder cron does nothing; the redaction cron is not
 *    changed (it sends nothing and still clears old records);
 *  - the organisation-data export leaves the module out, while the dedicated
 *    rights-request export keeps working, for owners and admins only.
 *
 * Prisma and next-intl's middleware factory are mocked; the real routers,
 * middleware chain and route handlers run.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

const mocks = vi.hoisted(() => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    organization: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    organizationMember: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    organizationJurisdiction: { findMany: vi.fn() },
    customer: { findUnique: vi.fn(), create: vi.fn() },
    customerOrganization: { create: vi.fn() },
    auditLog: { create: vi.fn(), findMany: vi.fn() },
    dSARRequest: { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), count: vi.fn(), create: vi.fn() },
    dSARIntakeForm: { findMany: vi.fn(), findFirst: vi.fn() },
    dSARAuditLog: { create: vi.fn() },
    dataAsset: { findMany: vi.fn() },
    processingActivity: { findMany: vi.fn() },
    dataFlow: { findMany: vi.fn() },
    dataTransfer: { findMany: vi.fn() },
    assessmentTemplate: { findMany: vi.fn() },
    assessment: { findMany: vi.fn() },
    incident: { findMany: vi.fn() },
    vendor: { findMany: vi.fn() },
    aISystem: { findMany: vi.fn() },
  },
  ensureDefaultIntakeForm: vi.fn(),
  runReminders: vi.fn(),
  session: { email: "owner@test.example" } as { email: string } | null,
  org: { organization: null as { id: string } | null, organizations: [] as { id: string; role: string }[] },
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@auth/prisma-adapter", () => ({ PrismaAdapter: () => ({}) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/server/services/dsar/defaultIntakeForm", () => ({
  ensureDefaultIntakeForm: mocks.ensureDefaultIntakeForm,
  isIntakeConfigured: () => false,
}));
vi.mock("@/server/services/dsar/sendConfirmationEmail", () => ({ sendDSARConfirmationEmail: vi.fn() }));
vi.mock("@/server/services/dsar/sendCommunicationEmail", () => ({ sendDSARCommunicationEmail: vi.fn() }));
vi.mock("@/server/services/dsar/deadlineReminders", () => ({
  runDsarDeadlineReminders: mocks.runReminders,
  reminderMailerFromEnv: () => null,
}));
vi.mock("@/lib/session-cookie", () => ({ getSessionToken: async () => mocks.session }));
vi.mock("next-intl/middleware", () => ({ default: () => () => NextResponse.next() }));
vi.mock("@/lib/organization-context", () => ({ useOrganization: () => mocks.org }));

import { isDsarModuleEnabled, getFeatureFlags, DSAR_MODULE_OFF_MESSAGE } from "@/config/features";
import { dsarRouter } from "@/server/routers/privacy/dsar";
import { organizationRouter } from "@/server/routers/privacy/organization";
import middleware from "@/middleware";
import { isDsarModulePath } from "@/lib/dsar-module";
import { helpForPath } from "@/config/help/pages";
import { GET as remindersCron } from "@/app/api/cron/dsar-reminders/route";
import { GET as exportOrganizationData } from "@/app/api/export/organization-data/route";
import { GET as exportRightsRequests } from "@/app/api/export/rights-requests/route";
import { GET as exportDsarPerformance } from "@/app/api/export/dsar-performance/route";
import DsarModuleLayout from "@/app/(dashboard)/privacy/dsar/layout";
import PublicDsarLayout from "@/app/dsar/layout";
import { _resetRateLimitsForTests } from "@/lib/rate-limit";
import { callerFor, sessionFor } from "./helpers";

const off = () => vi.stubEnv("NEXT_PUBLIC_DSAR_ENABLED", "false");

beforeEach(() => {
  vi.clearAllMocks();
  _resetRateLimitsForTests();
  mocks.session = { email: "owner@test.example" };
  mocks.org = { organization: null, organizations: [] };
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const read = (rel: string) => readFileSync(path.resolve(__dirname, "..", rel), "utf8");

// ---------------------------------------------------------------------------

describe("the flag", () => {
  it("is on by default, and with any value other than \"false\"", () => {
    expect(isDsarModuleEnabled()).toBe(true);
    expect(getFeatureFlags().dsarEnabled).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_DSAR_ENABLED", "true");
    expect(isDsarModuleEnabled()).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_DSAR_ENABLED", "");
    expect(isDsarModuleEnabled()).toBe(true);
  });

  it("is off only with \"false\"", () => {
    off();
    expect(isDsarModuleEnabled()).toBe(false);
    expect(getFeatureFlags().dsarEnabled).toBe(false);
  });

  it("is not switched off in any committed configuration (self-host kit, CI, hosted)", () => {
    for (const rel of [
      ".env.example",
      "deploy/sovereign/.env.example",
      "deploy/sovereign/docker-compose.yml",
      ".github/workflows/ci.yml",
      ".github/workflows/publish-image.yml",
      "vercel.json",
      "docker-compose.yml",
    ]) {
      let text = "";
      try {
        text = read(rel);
      } catch {
        continue;
      }
      const live = text
        .split("\n")
        .filter((l) => !l.trim().startsWith("#"))
        .join("\n");
      expect(live, rel).not.toMatch(/NEXT_PUBLIC_DSAR_ENABLED\s*[:=]\s*["']?false/);
    }
  });
});

// ---------------------------------------------------------------------------

describe("menus, guided step, help and docs", () => {
  it("the menu entry is gated on the flag", () => {
    // The one menu is the Guided path (Classic's top bar was retired,
    // decision d11): its rights-request step goes when the module is off,
    // and for a member who may not read requests.
    expect(read("src/components/guided/path-config.ts")).toMatch(
      /isDsarModuleEnabled\(\)\s*\?\s*FULL_PATH\s*:\s*withoutSteps\(FULL_PATH, \["dsar"\]\)/
    );
    expect(read("src/components/guided/guided-layout.tsx")).toContain(
      "if (canHandleDsars === false) menuProps.config = withoutSteps(menuProps.config, DSAR_STEP_IDS);"
    );
  });

  it("the guided path keeps the rights-request step when on and drops it when off", async () => {
    vi.resetModules();
    const onPath = (await import("@/components/guided/path-config")).DPO_CENTRAL_PATH;
    const ids = (p: typeof onPath) => p.stages.flatMap((s) => s.steps.map((st) => st.id));
    expect(ids(onPath)).toContain("dsar");

    off();
    vi.resetModules();
    const offPath = (await import("@/components/guided/path-config")).DPO_CENTRAL_PATH;
    expect(ids(offPath)).not.toContain("dsar");
    // Only that step goes: the rest of the path is unchanged.
    expect(ids(offPath)).toEqual(ids(onPath).filter((id) => id !== "dsar"));
  });

  it("the page help for rights requests is not offered when off", () => {
    expect(helpForPath("/privacy/dsar")?.route).toBe("/privacy/dsar");
    off();
    expect(helpForPath("/privacy/dsar")).toBeNull();
    expect(helpForPath("/privacy/dsar/abc")).toBeNull();
    expect(helpForPath("/privacy/incidents")?.route).toBe("/privacy/incidents");
  });

  it("the docs navigation, sitemap and overview filter the module out", () => {
    for (const rel of [
      "src/app/(public)/docs/components/DocsNav.tsx",
      "src/components/docs/toc-sidebar.tsx",
      "src/app/sitemap.ts",
      "src/app/(public)/docs/page.tsx",
      "src/app/(dashboard)/privacy/docs/page.tsx",
      "src/components/guided/guided-layout.tsx",
      "src/app/(dashboard)/privacy/reports/page.tsx",
      "src/components/pilot/pilot-status-card.tsx",
    ]) {
      expect(read(rel), rel).toContain("isDsarModuleEnabled()");
    }
  });

  it("the sitemap lists the rights-request guide only when on", async () => {
    vi.resetModules();
    const onMap = (await import("@/app/sitemap")).default();
    expect(onMap.some((e) => e.url.endsWith("/docs/dsar"))).toBe(true);
    off();
    const offMap = (await import("@/app/sitemap")).default();
    expect(offMap.some((e) => e.url.endsWith("/docs/dsar"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe("the dashboard pages and the note", () => {
  const render = (node: Parameters<typeof renderToStaticMarkup>[0], messages: object) =>
    renderToStaticMarkup(
      createElement(
        NextIntlClientProvider,
        { locale: "en", timeZone: "UTC", messages } as unknown as ComponentProps<typeof NextIntlClientProvider>,
        node
      )
    );

  it("on: the layout passes the page through", () => {
    const page = createElement("p", null, "the page");
    expect(render(DsarModuleLayout({ children: page }), en)).toBe("<p>the page</p>");
  });

  it("off: the pages are replaced by the note, in English and in Spanish, with no price", () => {
    off();
    const page = createElement("p", null, "the page");
    const html = render(DsarModuleLayout({ children: page }), en);
    expect(html).not.toContain("the page");
    expect(html).toContain("Rights requests are not included in this plan.");
    expect(html).not.toMatch(/[$€]|\d+\s*\/\s*mo|price|precio/i);

    const htmlEs = render(DsarModuleLayout({ children: page }), es);
    expect(htmlEs).toContain("Las solicitudes de derechos no están incluidas en este plan.");
    expect(DSAR_MODULE_OFF_MESSAGE).toBe(en.dsarModule.off);
  });

  it("off: owners and admins are given the download of earlier records; other members are not", () => {
    off();
    mocks.org = { organization: { id: "org-1" }, organizations: [{ id: "org-1", role: "ADMIN" }] };
    expect(render(DsarModuleLayout({ children: null }), en)).toContain(
      "/api/export/rights-requests?organizationId=org-1"
    );
    mocks.org = { organization: { id: "org-1" }, organizations: [{ id: "org-1", role: "PRIVACY_OFFICER" }] };
    expect(render(DsarModuleLayout({ children: null }), en)).not.toContain("/api/export/rights-requests");
  });

  it("off: the public form and status layout is not found", () => {
    expect(() => PublicDsarLayout({ children: null })).not.toThrow();
    off();
    expect(() => PublicDsarLayout({ children: null })).toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
  });
});

// ---------------------------------------------------------------------------

describe("public addresses answer 404 when off (middleware)", () => {
  const hit = (p: string) =>
    middleware(new NextRequest(`http://localhost:3001${p}`, { headers: { "x-forwarded-for": "203.0.113.9" } })) as NextResponse;

  const paths = ["/dsar/acme", "/dsar/acme?lang=es", "/dsar/status/tok-123", "/api/export/dsar-performance?organizationId=o"];

  it("on: they pass through", async () => {
    for (const p of paths) expect((await hit(p)).status, p).not.toBe(404);
  });

  it("off: every one is 404, and nothing else is", async () => {
    off();
    for (const p of paths) expect((await hit(p)).status, p).toBe(404);
    for (const p of ["/privacy", "/privacy/dsar", "/docs", "/api/health", "/api/export/rights-requests", "/dsarx"]) {
      expect((await hit(p)).status, p).not.toBe(404);
    }
  });

  it("the module path list is exact", () => {
    expect(isDsarModulePath("/dsar")).toBe(true);
    expect(isDsarModulePath("/dsar/x")).toBe(true);
    expect(isDsarModulePath("/dsarx")).toBe(false);
    expect(isDsarModulePath("/privacy/dsar")).toBe(false);
    expect(isDsarModulePath("/api/export/rights-requests")).toBe(false);
  });

  it("off: the PDF report route refuses by itself too", async () => {
    off();
    const res = await exportDsarPerformance(
      new NextRequest("http://localhost/api/export/dsar-performance?organizationId=o")
    );
    expect(res.status).toBe(404);
    expect(mocks.prisma.organizationMember.findFirst).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------

describe("the module's API refuses when off", () => {
  const anon = () => callerFor(dsarRouter, null) as ReturnType<typeof dsarRouter.createCaller>;
  const member = () =>
    callerFor(dsarRouter, sessionFor("user-1")) as ReturnType<typeof dsarRouter.createCaller>;

  const touched = () =>
    [
      mocks.prisma.organization.findUnique,
      mocks.prisma.dSARRequest.findMany,
      mocks.prisma.dSARRequest.findUnique,
      mocks.prisma.dSARRequest.findFirst,
      mocks.prisma.dSARRequest.create,
      mocks.prisma.dSARRequest.count,
      mocks.prisma.dSARIntakeForm.findFirst,
    ].some((fn) => fn.mock.calls.length > 0);

  it("on: the public form is looked up as before", async () => {
    mocks.prisma.organization.findUnique.mockResolvedValue(null);
    await expect(anon().getPublicForm({ orgSlug: "acme" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.prisma.organization.findUnique).toHaveBeenCalled();
  });

  it("off: getPublicForm, submitPublic, checkStatus and withdrawPublic refuse before any read", async () => {
    off();
    const calls: [string, () => Promise<unknown>][] = [
      ["getPublicForm", () => anon().getPublicForm({ orgSlug: "acme" })],
      [
        "submitPublic",
        () =>
          anon().submitPublic({
            orgSlug: "acme",
            type: "ACCESS",
            requesterName: "A Person",
            requesterEmail: "a@example.com",
          } as never),
      ],
      ["checkStatus", () => anon().checkStatus({ token: "x".repeat(40) } as never)],
      ["withdrawPublic", () => anon().withdrawPublic({ token: "x".repeat(40) } as never)],
    ];
    for (const [name, call] of calls) {
      await expect(call(), name).rejects.toMatchObject({ code: "NOT_FOUND", message: DSAR_MODULE_OFF_MESSAGE });
    }
    expect(touched()).toBe(false);
  });

  it("off: member procedures refuse too, after the membership check", async () => {
    off();
    mocks.prisma.organizationMember.findUnique.mockResolvedValue({
      id: "m-1",
      role: "OWNER",
      userId: "user-1",
      organizationId: "org-1",
      organization: { id: "org-1", slug: "acme", name: "Acme", settings: {} },
      user: { locale: null },
    });
    await expect(member().list({ organizationId: "org-1" } as never)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(member().getStats({ organizationId: "org-1" } as never)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      member().create({
        organizationId: "org-1",
        type: "ACCESS",
        requesterName: "A Person",
        requesterEmail: "a@example.com",
      } as never)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(touched()).toBe(false);
  });

  it("every procedure of the router goes through the guard", () => {
    const src = read("src/server/routers/privacy/dsar.ts");
    const body = src.slice(src.indexOf("export const dsarRouter"));
    expect(body).not.toMatch(/:\s*(publicProcedure|organizationProcedure|officerProcedure|adminOrgProcedure)\b/);
    const procedures = body.match(/^\s{2}\w+: dsar\w+Procedure/gm) ?? [];
    expect(procedures.length).toBeGreaterThanOrEqual(20);
  });
});

// ---------------------------------------------------------------------------

describe("a new organisation's default public form", () => {
  beforeEach(() => {
    mocks.prisma.user.findUnique.mockResolvedValue({
      email: "founder@test.example",
      emailVerified: new Date(),
      accounts: [],
      userType: "ORGANIZATION",
      name: "Founder",
    });
    mocks.prisma.organization.findUnique.mockResolvedValue(null);
    mocks.prisma.organization.findFirst.mockResolvedValue(null);
    mocks.prisma.organization.create.mockImplementation(async ({ data }: { data: object }) => ({
      id: "org-new",
      ...data,
      members: [],
    }));
    mocks.prisma.organizationMember.count.mockResolvedValue(0);
    mocks.prisma.auditLog.create.mockResolvedValue({});
  });

  const create = () =>
    (callerFor(organizationRouter, sessionFor("founder")) as ReturnType<typeof organizationRouter.createCaller>).create({
      name: "New Org",
      slug: "new-org",
    });

  it("on: is created", async () => {
    await create();
    expect(mocks.ensureDefaultIntakeForm).toHaveBeenCalledWith(expect.anything(), "org-new");
  });

  it("off: is not created", async () => {
    off();
    const org = await create();
    expect(org.id).toBe("org-new");
    expect(mocks.ensureDefaultIntakeForm).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------

describe("the crons", () => {
  const cronReq = () =>
    new Request("http://localhost/api/cron/dsar-reminders", { headers: { authorization: "Bearer s3cret" } });

  it("on: the reminder cron runs", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    mocks.runReminders.mockResolvedValue({ sent: 0 });
    const res = await remindersCron(cronReq());
    expect(res.status).toBe(200);
    expect(mocks.runReminders).toHaveBeenCalledTimes(1);
  });

  it("off: the reminder cron succeeds without reading or sending anything", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    off();
    const res = await remindersCron(cronReq());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, skipped: "dsar-module-off" });
    expect(mocks.runReminders).not.toHaveBeenCalled();
  });

  it("off: the reminder cron still refuses a caller without the secret", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    off();
    const res = await remindersCron(new Request("http://localhost/api/cron/dsar-reminders"));
    expect(res.status).toBe(401);
  });

  it("the redaction cron is not tied to the flag (it sends nothing)", () => {
    const src = read("src/app/api/cron/dsar-redaction/route.ts");
    expect(src).not.toContain("isDsarModuleEnabled");
    // No mail service is imported: nothing it does reaches a person.
    const imports = src.split("\n").filter((l) => l.startsWith("import "));
    expect(imports.join("\n")).not.toMatch(/send|mail|resend|deadlineReminders/i);
  });
});

// ---------------------------------------------------------------------------

describe("exports", () => {
  beforeEach(() => {
    for (const model of [
      "organizationJurisdiction",
      "dataAsset",
      "processingActivity",
      "dataFlow",
      "dataTransfer",
      "assessmentTemplate",
      "assessment",
      "incident",
      "vendor",
      "aISystem",
    ] as const) {
      mocks.prisma[model].findMany.mockResolvedValue([]);
    }
    mocks.prisma.organizationMember.findMany.mockResolvedValue([]);
    mocks.prisma.dSARIntakeForm.findMany.mockResolvedValue([{ id: "form-1" }]);
    mocks.prisma.dSARRequest.findMany.mockResolvedValue([{ id: "req-1" }]);
    mocks.prisma.auditLog.findMany.mockResolvedValue([{ id: "log-1" }]);
  });

  const membership = (role: string) => ({
    organizationId: "org-1",
    userId: "user-1",
    role,
    organization: { id: "org-1", name: "Acme", slug: "acme", domain: null, settings: {}, createdAt: new Date() },
  });

  const orgData = () =>
    exportOrganizationData(new Request("http://localhost/api/export/organization-data?organizationId=org-1"));
  const rightsRequests = () =>
    exportRightsRequests(new Request("http://localhost/api/export/rights-requests?organizationId=org-1"));

  it("on: the organisation-data export carries the rights requests", async () => {
    mocks.prisma.organizationMember.findFirst.mockResolvedValue(membership("OWNER"));
    const body = await (await orgData()).json();
    expect(body.dsarRequests).toHaveLength(1);
    expect(body.dsarIntakeForms).toHaveLength(1);
  });

  it("off: the organisation-data export leaves them out and does not read them", async () => {
    off();
    mocks.prisma.organizationMember.findFirst.mockResolvedValue(membership("OWNER"));
    const body = await (await orgData()).json();
    expect(body).not.toHaveProperty("dsarRequests");
    expect(body).not.toHaveProperty("dsarIntakeForms");
    expect(mocks.prisma.dSARRequest.findMany).not.toHaveBeenCalled();
    expect(body).toHaveProperty("vendors");
  });

  it("off: owners and admins still download every rights-request record", async () => {
    off();
    for (const role of ["OWNER", "ADMIN"]) {
      vi.clearAllMocks();
      _resetRateLimitsForTests();
      mocks.prisma.organizationMember.findFirst.mockResolvedValue(membership(role));
      mocks.prisma.dSARIntakeForm.findMany.mockResolvedValue([{ id: "form-1" }]);
      mocks.prisma.dSARRequest.findMany.mockResolvedValue([{ id: "req-1" }]);
      mocks.prisma.auditLog.findMany.mockResolvedValue([{ id: "log-1" }]);
      const res = await rightsRequests();
      expect(res.status, role).toBe(200);
      const body = await res.json();
      expect(body.counts).toEqual({ dsarRequests: 1, dsarIntakeForms: 1, auditEntries: 1 });
      // Every child record of a request travels with it.
      expect(mocks.prisma.dSARRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: "org-1" },
          include: { tasks: true, communications: true, auditLog: true, reminders: true },
        })
      );
      expect(mocks.prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: "org-1", entityType: "DSARRequest" } })
      );
      expect(res.headers.get("Content-Disposition")).toContain("rights-requests");
    }
  });

  it("the rights-request export refuses other roles, strangers and the signed out", async () => {
    for (const role of ["PRIVACY_OFFICER", "MEMBER", "VIEWER"]) {
      mocks.prisma.organizationMember.findFirst.mockResolvedValue(membership(role));
      expect((await rightsRequests()).status, role).toBe(403);
    }
    mocks.prisma.organizationMember.findFirst.mockResolvedValue(null);
    expect((await rightsRequests()).status).toBe(403);
    mocks.session = null;
    expect((await rightsRequests()).status).toBe(401);
    expect(mocks.prisma.dSARRequest.findMany).not.toHaveBeenCalled();
  });
});
