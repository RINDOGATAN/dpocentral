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
    assessment: {
      create: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
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
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import {
  countDpiaCreated,
  dpiaCapMessage,
  hostedDpiaQuota,
  HOSTED_DPIA_LIMIT,
  PILOT_LIMIT_REACHED,
  recordPilotLimitReached,
} from "@/server/services/pilot/caps";
import { MANAGED_URL, managedUrl } from "@/lib/hosted";
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

  it("carries one link, to keep going on the managed service, in both languages", () => {
    expect(dpiaCapMessage("en")).toContain(
      "Keep going on your own instance: https://www.todo.law/contact/managed"
    );
    expect(dpiaCapMessage("es")).toContain(
      "Sigue en tu propia instancia: https://www.todo.law/es/contact/managed"
    );
    for (const locale of ["en", "es"] as const) {
      const message = dpiaCapMessage(locale);
      expect(message.match(/https?:\/\//g)).toHaveLength(1);
      expect(message).toContain(String(HOSTED_DPIA_LIMIT));
      // No price and no sales language.
      expect(message).not.toMatch(/[€$]|EUR|USD|upgrade|mejora|oferta/i);
    }
  });

  it("the new-assessment screen links to the managed service, with its Spanish twin", () => {
    expect(en.pages.trialAssessments.keepGoing).toBe("Keep going on your own instance");
    expect(es.pages.trialAssessments.keepGoing).toBe("Sigue en tu propia instancia");
    expect(managedUrl("en")).toBe(MANAGED_URL.en);
    expect(managedUrl("es")).toBe("https://www.todo.law/es/contact/managed");
    expect(managedUrl("es-ES")).toBe(MANAGED_URL.es);
    expect(managedUrl(undefined)).toBe("https://www.todo.law/contact/managed");
    const page = readFileSync(
      path.resolve(__dirname, "../src/app/(dashboard)/privacy/assessments/new/page.tsx"),
      "utf8"
    );
    expect(page).toContain("href={managedUrl(locale)}");
    expect(page).toContain('tTrial("keepGoing")');
  });

  it("the refusal comes through the tRPC error with the link, in Spanish too", async () => {
    hosted();
    created(HOSTED_DPIA_LIMIT);
    const spanish = callerFor(assessmentRouter, sessionFor("user-1"), { locale: "es" });
    await expect(
      spanish.create({ organizationId: ORG.id, templateId: DPIA_TEMPLATE.id, name: "Fidelización" })
    ).rejects.toThrow(
      "Sigue en tu propia instancia: https://www.todo.law/es/contact/managed"
    );
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

describe("a firm at the limit can still read and export everything", () => {
  it("lists and opens its assessments", async () => {
    hosted();
    created(HOSTED_DPIA_LIMIT);
    held(HOSTED_DPIA_LIMIT);
    mocks.prisma.assessment.findMany.mockResolvedValue([{ id: "asm-1" }]);
    mocks.prisma.assessment.findFirst.mockResolvedValue({
      id: "asm-1",
      template: { ...DPIA_TEMPLATE, sections: [] },
      responses: [],
    });

    await expect(caller().list({ organizationId: ORG.id })).resolves.toMatchObject({
      assessments: [{ id: "asm-1" }],
    });
    await expect(caller().getById({ organizationId: ORG.id, id: "asm-1" })).resolves.toMatchObject({
      id: "asm-1",
    });
    await expect(caller().dpiaQuota({ organizationId: ORG.id })).resolves.toMatchObject({
      remaining: 0,
    });
    // Reading writes no limit row: only a refusal does.
    expect(mocks.prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("every export is a GET route that the pilot limits do not touch", () => {
    const root = path.resolve(__dirname, "../src/app/api/export");
    const routes: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (name === "route.ts") routes.push(full);
      }
    };
    walk(root);
    expect(routes.length).toBeGreaterThanOrEqual(8);
    for (const route of routes) {
      const source = readFileSync(route, "utf8");
      expect(source).toMatch(/export (async function|const) GET/);
      expect(source).not.toMatch(/export (async function|const) (POST|PUT|PATCH|DELETE)/);
      expect(source).not.toContain("pilot/caps");
    }
  });
});

describe("reaching the limit is recorded, as a count", () => {
  /** An audit table that, like the real one, refuses a second row with the same id. */
  function auditTable() {
    const rows = new Map<string, Record<string, unknown>>();
    mocks.prisma.auditLog.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => {
        const id = String(data.id ?? `row-${rows.size}`);
        if (rows.has(id)) {
          throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
        }
        rows.set(id, data);
        return data;
      }
    );
    return () => [...rows.values()].filter((r) => r.action === PILOT_LIMIT_REACHED);
  }

  it("writes the agreed row when the limit refuses an action", async () => {
    hosted();
    const limitRows = auditTable();
    created(HOSTED_DPIA_LIMIT);
    await expect(createDpia()).rejects.toThrow(/impact assessments/);

    expect(limitRows()).toHaveLength(1);
    const row = limitRows()[0];
    expect(row).toEqual({
      id: expect.any(String),
      organizationId: ORG.id,
      entityType: "Organization",
      entityId: ORG.id,
      action: "PILOT_LIMIT_REACHED",
      metadata: { limit: "impact_assessments" },
    });
    // No user and no free text.
    expect(row).not.toHaveProperty("userId");
    expect(row).not.toHaveProperty("changes");
  });

  it("writes once and only once per organisation, per limit, per day", async () => {
    const limitRows = auditTable();
    const db = mocks.prisma as never;
    const morning = new Date("2026-10-05T08:00:00Z");
    const evening = new Date("2026-10-05T23:59:00Z");
    const nextDay = new Date("2026-10-06T00:01:00Z");

    await recordPilotLimitReached(db, "org-1", "impact_assessments", morning);
    await recordPilotLimitReached(db, "org-1", "impact_assessments", evening);
    await Promise.all([
      recordPilotLimitReached(db, "org-1", "impact_assessments", evening),
      recordPilotLimitReached(db, "org-1", "impact_assessments", evening),
    ]);
    expect(limitRows()).toHaveLength(1);

    await recordPilotLimitReached(db, "org-2", "impact_assessments", evening);
    expect(limitRows()).toHaveLength(2);

    await recordPilotLimitReached(db, "org-1", "impact_assessments", nextDay);
    expect(limitRows()).toHaveLength(3);
  });

  it("four refused attempts the same day leave one row", async () => {
    hosted();
    const limitRows = auditTable();
    created(HOSTED_DPIA_LIMIT);
    for (let i = 0; i < 4; i++) await expect(createDpia()).rejects.toThrow();
    expect(limitRows()).toHaveLength(1);
  });

  it("a failure to write the row does not block the refusal", async () => {
    hosted();
    created(HOSTED_DPIA_LIMIT);
    mocks.prisma.auditLog.create.mockRejectedValue(new Error("database unavailable"));
    await expect(createDpia()).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringContaining("Keep going on your own instance"),
    });
    expect(mocks.prisma.assessment.create).not.toHaveBeenCalled();
  });

  it("writes nothing below the limit, and nothing on the kit", async () => {
    const limitRows = auditTable();
    hosted();
    created(HOSTED_DPIA_LIMIT - 1);
    await createDpia();
    kit();
    created(HOSTED_DPIA_LIMIT + 5);
    await createDpia();
    expect(limitRows()).toHaveLength(0);
  });
});
