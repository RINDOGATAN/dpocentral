// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The organisation's audit trail (owner's decision, 9 October 2026, as AI
 * Sentinel has it): owners, admins and privacy officers read it, newest first,
 * filtered and paged; the CSV follows the same filters and rules; entries
 * about rights requests show the reference and the action only; without the
 * rights-request module those entries are left out.
 *
 * Prisma is module-mocked: we assert on the queries issued and on what is
 * returned.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    organizationMember: { findUnique: vi.fn(), findFirst: vi.fn() },
    auditLog: { findMany: vi.fn(), groupBy: vi.fn(), count: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    dSARRequest: { findMany: vi.fn() },
    user: { update: vi.fn() },
    organization: { update: vi.fn(), updateMany: vi.fn() },
  },
  token: { email: "user-a@test.example" } as { email?: string } | null,
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Headers(),
}));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/session-cookie", () => ({ getSessionToken: async () => mocks.token }));
vi.mock("@/lib/api-export", () => ({
  checkExportRateLimit: () => null,
  pdfErrorResponse: (err: unknown) => new Response(String(err), { status: 500 }),
}));

import { auditRouter } from "@/server/routers/privacy/audit";
import { GET as exportTrail } from "@/app/api/export/audit-trail/route";
import { auditWhere } from "@/server/services/audit/trail";
import { auditTrailCsv, csvCell } from "@/server/services/audit/csv";
import {
  AUDIT_READER_ROLES,
  auditEntryView,
  canReadAuditTrail,
  isRightsRequestEntry,
} from "@/lib/audit-access";
import { DPO_CENTRAL_PATH } from "@/components/guided/path-config";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { readFileSync } from "node:fs";
import path from "node:path";
import { callerFor, sessionFor } from "./helpers";

const read = (p: string) => readFileSync(path.resolve(__dirname, "..", p), "utf8");
const READERS = ["OWNER", "ADMIN", "PRIVACY_OFFICER"];
const OTHERS = ["MEMBER", "VIEWER"];

const FORM = { requesterName: "Data Subject", requesterEmail: "subject@test.example", description: "All my data" };

const ROWS = [
  {
    id: "a3",
    action: "CREATE",
    entityType: "DSARRequest",
    entityId: "dsar-internal-1",
    changes: FORM,
    metadata: { ip: "x" },
    createdAt: new Date("2026-10-03T10:00:00Z"),
    userId: "user-a",
    user: { name: "Officer", email: "officer@test.example" },
  },
  {
    id: "a2",
    action: "DELETE",
    entityType: "DSARRequest",
    entityId: "DSAR-2026-0002",
    changes: { type: "ACCESS", status: "COMPLETED" },
    metadata: null,
    createdAt: new Date("2026-10-02T10:00:00Z"),
    userId: null,
    user: null,
  },
  {
    id: "a1",
    action: "UPDATE",
    entityType: "Vendor",
    entityId: "vendor-1",
    changes: { name: "=SUM(A1)" },
    metadata: null,
    createdAt: new Date("2026-10-01T10:00:00Z"),
    userId: "user-a",
    user: { name: "Officer", email: "officer@test.example" },
  },
];

function as(role: string) {
  const member = {
    id: "member-a",
    userId: "user-a",
    organizationId: "org-a",
    role,
    organization: { id: "org-a", name: "Org A", slug: "org-a", pilotStartedAt: null },
    user: { locale: null },
  };
  mocks.prisma.organizationMember.findUnique.mockResolvedValue(member);
  mocks.prisma.organizationMember.findFirst.mockResolvedValue(member);
  return callerFor(auditRouter, sessionFor("user-a")) as ReturnType<typeof auditRouter.createCaller>;
}

const ENV = process.env.NEXT_PUBLIC_DSAR_ENABLED;

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.NEXT_PUBLIC_DSAR_ENABLED;
  mocks.token = { email: "user-a@test.example" };
  mocks.prisma.auditLog.findMany.mockResolvedValue(ROWS);
  mocks.prisma.auditLog.groupBy.mockResolvedValue([]);
  mocks.prisma.auditLog.count.mockResolvedValue(3);
  mocks.prisma.auditLog.findFirst.mockResolvedValue({ createdAt: ROWS[2].createdAt });
  mocks.prisma.auditLog.create.mockResolvedValue({});
  mocks.prisma.dSARRequest.findMany.mockResolvedValue([{ id: "dsar-internal-1", publicId: "DSAR-2026-0001" }]);
});

afterEach(() => {
  if (ENV === undefined) delete process.env.NEXT_PUBLIC_DSAR_ENABLED;
  else process.env.NEXT_PUBLIC_DSAR_ENABLED = ENV;
});

describe("who reads the trail", () => {
  it("owners, admins and privacy officers; nobody else", () => {
    expect([...AUDIT_READER_ROLES].sort()).toEqual([...READERS].sort());
    for (const role of READERS) expect(canReadAuditTrail(role)).toBe(true);
    for (const role of OTHERS) expect(canReadAuditTrail(role)).toBe(false);
    expect(canReadAuditTrail(undefined)).toBe(false);
  });

  it("the router refuses members and read-only members, before any read", async () => {
    for (const role of OTHERS) {
      await expect(as(role).list({ organizationId: "org-a" })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(as(role).facets({ organizationId: "org-a" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(mocks.prisma.auditLog.findMany).not.toHaveBeenCalled();
  });

  it("the router reads for each reader role, scoped to the caller's organisation", async () => {
    for (const role of READERS) {
      await as(role).list({ organizationId: "org-a" });
      const args = mocks.prisma.auditLog.findMany.mock.calls.at(-1)![0];
      expect(args.where.organizationId).toBe("org-a");
    }
  });

  it("the CSV refuses the signed out, members and read-only members", async () => {
    const url = "http://x/api/export/audit-trail?organizationId=org-a";
    mocks.token = null;
    expect((await exportTrail(new Request(url))).status).toBe(401);
    mocks.token = { email: "user-a@test.example" };
    for (const role of OTHERS) {
      as(role);
      expect((await exportTrail(new Request(url))).status).toBe(403);
    }
    mocks.prisma.organizationMember.findFirst.mockResolvedValue(null);
    expect((await exportTrail(new Request(url))).status).toBe(403);
    expect(mocks.prisma.auditLog.findMany).not.toHaveBeenCalled();
  });
});

describe("the list", () => {
  it("newest first, paged with a cursor, filters passed through", async () => {
    mocks.prisma.auditLog.findMany.mockResolvedValue(ROWS);
    const from = new Date("2026-10-01T00:00:00Z");
    const to = new Date("2026-10-31T23:59:59Z");
    const out = await as("ADMIN").list({
      organizationId: "org-a",
      limit: 2,
      cursor: "a9",
      entityType: "Vendor",
      action: "UPDATE",
      userId: "user-a",
      from,
      to,
    });
    const args = mocks.prisma.auditLog.findMany.mock.calls[0][0];
    expect(args.orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
    expect(args.take).toBe(3);
    expect(args.cursor).toEqual({ id: "a9" });
    expect(args.skip).toBe(1);
    expect(args.where).toMatchObject({
      organizationId: "org-a",
      entityType: "Vendor",
      action: "UPDATE",
      userId: "user-a",
      createdAt: { gte: from, lte: to },
    });
    expect(out.entries).toHaveLength(2);
    expect(out.nextCursor).toBe("a2");
  });

  it("no next page when the last page is short", async () => {
    const out = await as("OWNER").list({ organizationId: "org-a" });
    expect(out.nextCursor).toBeUndefined();
  });
});

describe("entries about rights requests", () => {
  it("show the reference and the action only, for every reader role", async () => {
    for (const role of READERS) {
      const { entries } = await as(role).list({ organizationId: "org-a" });
      const created = entries.find((e) => e.id === "a3")!;
      expect(created).toMatchObject({ restricted: true, reference: "DSAR-2026-0001", action: "CREATE", changes: null, metadata: null });
      expect(JSON.stringify(entries)).not.toContain("Data Subject");
      expect(JSON.stringify(entries)).not.toContain("subject@test.example");
      const deleted = entries.find((e) => e.id === "a2")!;
      expect(deleted).toMatchObject({ restricted: true, reference: "DSAR-2026-0002", changes: null });
      // Other entries keep their recorded detail.
      expect(entries.find((e) => e.id === "a1")!.changes).toEqual({ name: "=SUM(A1)" });
    }
  });

  it("the reference is looked up in the caller's organisation only", async () => {
    await as("ADMIN").list({ organizationId: "org-a" });
    const args = mocks.prisma.dSARRequest.findMany.mock.calls[0][0];
    expect(args.where.organizationId).toBe("org-a");
    expect(args.select).toEqual({ id: true, publicId: true });
  });

  it("the CSV withholds them too", async () => {
    as("PRIVACY_OFFICER");
    const res = await exportTrail(new Request("http://x/api/export/audit-trail?organizationId=org-a&locale=en"));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain("Data Subject");
    expect(text).not.toContain("subject@test.example");
    expect(text).toContain("DSAR-2026-0001");
    expect(text).toContain("withheld: rights request");
  });

  it("any record type named DSAR... counts as one", () => {
    expect(isRightsRequestEntry("DSARRequest")).toBe(true);
    expect(isRightsRequestEntry("DSARTask")).toBe(true);
    expect(isRightsRequestEntry("Vendor")).toBe(false);
    const view = auditEntryView({ ...ROWS[0], entityType: "DSARCommunication" });
    expect(view.changes).toBeNull();
  });
});

describe("the rights-request switch", () => {
  it("on: no filter on the record type", () => {
    expect(auditWhere("org-a", {}, true)).toEqual({ organizationId: "org-a" });
  });

  it("off: entries about rights requests are left out, and asking for that area finds nothing", () => {
    const where = auditWhere("org-a", {}, false);
    expect(JSON.stringify(where)).toContain("DSARRequest");
    expect(where).toHaveProperty("AND");
    expect(auditWhere("org-a", { entityType: "DSARRequest" }, false)).toMatchObject({ entityType: { in: [] } });
    expect(auditWhere("org-a", { entityType: "Vendor" }, false)).toMatchObject({ entityType: "Vendor" });
  });

  it("off: the router and the CSV use the filter, and the facets leave the area out", async () => {
    process.env.NEXT_PUBLIC_DSAR_ENABLED = "false";
    mocks.prisma.auditLog.groupBy.mockImplementation(async ({ by }: { by: string[] }) =>
      by[0] === "entityType"
        ? [
            { entityType: "DSARRequest", _count: { entityType: 2 } },
            { entityType: "Vendor", _count: { entityType: 1 } },
          ]
        : [],
    );
    const facets = await as("OWNER").facets({ organizationId: "org-a" });
    expect(facets.entityTypes.map((e) => e.value)).toEqual(["Vendor"]);
    await as("OWNER").list({ organizationId: "org-a" });
    expect(mocks.prisma.auditLog.findMany.mock.calls.at(-1)![0].where).toHaveProperty("AND");
    await exportTrail(new Request("http://x/api/export/audit-trail?organizationId=org-a"));
    expect(mocks.prisma.auditLog.findMany.mock.calls.at(-1)![0].where).toHaveProperty("AND");
  });
});

describe("the CSV", () => {
  it("follows the filters, records the export, and refuses a bad date", async () => {
    as("ADMIN");
    const bad = await exportTrail(new Request("http://x/api/export/audit-trail?organizationId=org-a&from=nonsense"));
    expect(bad.status).toBe(400);
    const res = await exportTrail(
      new Request("http://x/api/export/audit-trail?organizationId=org-a&action=UPDATE&entityType=Vendor&locale=es"),
    );
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Content-Disposition")).toMatch(/Audit-Trail-Org-A-\d{4}-\d{2}-\d{2}\.csv/);
    const args = mocks.prisma.auditLog.findMany.mock.calls.at(-1)![0];
    expect(args.where).toMatchObject({ organizationId: "org-a", action: "UPDATE", entityType: "Vendor" });
    expect(mocks.prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "EXPORT_AUDIT_TRAIL", organizationId: "org-a", userId: "user-a" }),
      }),
    );
    const text = await res.text();
    expect(text).toContain("Fecha y hora (UTC)");
    expect(text).toContain("# Organización: Org A");
  });

  it("neutralises a cell a spreadsheet would run as a formula", () => {
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell('a "b", c')).toBe('"a ""b"", c"');
    const csv = auditTrailCsv({
      entries: [auditEntryView(ROWS[2])],
      stamp: { generatedAt: "2026-10-09T00:00:00.000Z", appVersion: "1.0.0", commit: null },
      orgName: "Org A",
      filters: {},
      locale: "en",
    });
    expect(csv.startsWith("﻿# Generated at")).toBe(true);
    expect(csv).toContain("# Filters: none");
    expect(csv).not.toMatch(/,=SUM/);
  });
});

describe("the menu and the page", () => {
  it("the library lists the audit trail for readers only", () => {
    const ids = (auditTrail: boolean) =>
      DPO_CENTRAL_PATH.library({ stripeEnabled: false, auditTrail }).map((i) => i.id);
    expect(ids(true)).toContain("auditTrail");
    expect(ids(false)).not.toContain("auditTrail");
    const item = DPO_CENTRAL_PATH.library({ stripeEnabled: false }).find((i) => i.id === "auditTrail");
    expect(item?.href).toBe("/privacy/audit-trail");
  });

  it("the layout passes the reader rule to the menu", () => {
    const layout = read("src/components/guided/guided-layout.tsx");
    expect(layout).toContain("auditTrail: canReadAudit === true");
    expect(read("src/components/guided/path-menu.tsx")).toContain(
      "config.library({ stripeEnabled, clientMode, auditTrail })",
    );
  });

  it("the page is in both languages, with the same keys", () => {
    const keys = (o: unknown, p = ""): string[] =>
      o && typeof o === "object"
        ? Object.entries(o).flatMap(([k, v]) => keys(v, p ? `${p}.${k}` : k))
        : [p];
    expect(keys(es.auditTrail).sort()).toEqual(keys(en.auditTrail).sort());
    expect(en.auditTrail.title).toBe("Audit trail");
    expect(es.auditTrail.title).toBe("Registro de auditoría");
    expect(en.guided.library.auditTrail).toBe("Audit trail");
    expect(es.guided.library.auditTrail).toBe("Registro de auditoría");
    expect(JSON.stringify([en.auditTrail, es.auditTrail])).not.toMatch(/[–—]/);
    expect(JSON.stringify(es.auditTrail)).not.toMatch(/\busted\b/i);
  });

  it("the page reads through the restricted procedures and the CSV route", () => {
    const page = read("src/app/(dashboard)/privacy/audit-trail/page.tsx");
    expect(page).toContain("trpc.audit.list.useInfiniteQuery");
    expect(page).toContain("trpc.audit.facets.useQuery");
    expect(page).toContain("/api/export/audit-trail?");
    expect(page).toContain("useAuditAccess()");
    expect(page).toContain('t("rightsRequestWithheld")');
  });
});
