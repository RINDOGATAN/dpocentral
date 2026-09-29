// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The pilot tier includes two DPIAs per organisation, free for a limited time
 * (the owner's decision of 29 September 2026; it was three).
 *
 * The second is created like any other; the third is refused on the server
 * with a message that says so plainly, that deleting one does not free a
 * place, and points to the plans page (no price). The count is of DPIAs
 * created, so it is read from the audit log as well as from the assessments
 * the organisation still holds. Nothing already created is blocked, and the
 * self-hosted kit is not capped at all. The Stripe-on pilot tier is tested in
 * tests/hosted-open-gates.test.ts ("creating a premium assessment").
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
  pilotDpiaQuota,
  PILOT_DPIA_LIMIT,
  PILOT_LIMIT_REACHED,
  recordPilotLimitReached,
} from "@/server/services/pilot/caps";
import { isHostedDeployment, PLANS_URL, plansUrl } from "@/lib/hosted";
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

describe("DPIAs on the hosted pilot tier", () => {
  it("the limit is two", () => {
    expect(PILOT_DPIA_LIMIT).toBe(2);
  });

  it("creates the first and the second", async () => {
    hosted();
    created(0);
    await expect(createDpia()).resolves.toMatchObject({ id: "asm-1" });
    created(1);
    await expect(createDpia()).resolves.toMatchObject({ id: "asm-1" });
    expect(mocks.prisma.assessment.create).toHaveBeenCalledTimes(2);
  });

  it("refuses the third attempt on the server, plainly, pointing to the plans page", async () => {
    hosted();
    created(2);
    await expect(createDpia()).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringContaining("See the plans: https://www.todo.law/pricing"),
    });
    await expect(createDpia()).rejects.toThrow(/already created the 2 DPIAs/);
    expect(mocks.prisma.assessment.create).not.toHaveBeenCalled();
  });

  it("carries one link, to the plans page, in both languages, and no price", () => {
    expect(dpiaCapMessage("en")).toContain("See the plans: https://www.todo.law/pricing");
    expect(dpiaCapMessage("es")).toContain("Consulta los planes: https://www.todo.law/es/precios");
    for (const locale of ["en", "es"] as const) {
      const message = dpiaCapMessage(locale);
      expect(message.match(/https?:\/\//g)).toHaveLength(1);
      expect(message).toContain(String(PILOT_DPIA_LIMIT));
      // No price and no sales language.
      expect(message).not.toMatch(/[€$]|EUR|USD|upgrade|mejora|oferta/i);
    }
  });

  it("the screens say the owner's sentence, in both languages, and link to the plans page", () => {
    expect(en.pages.trialAssessments.freeNote).toMatch(/^Free for a limited time: /);
    expect(es.pages.trialAssessments.freeNote).toMatch(/^Gratis por tiempo limitado: /);
    expect(en.pages.trialAssessments.seePlans).toBe("See the plans");
    expect(es.pages.trialAssessments.seePlans).toBe("Consulta los planes");
    expect(plansUrl("en")).toBe(PLANS_URL.en);
    expect(plansUrl("es-ES")).toBe("https://www.todo.law/es/precios");
    expect(plansUrl(undefined)).toBe("https://www.todo.law/pricing");
    const read = (p: string) => readFileSync(path.resolve(__dirname, "..", p), "utf8");
    const note = read("src/components/pilot/dpia-free-note.tsx");
    expect(note).toContain("href={plansUrl(locale)}");
    // The type card, the form, and the quick action all carry the note.
    const form = read("src/app/(dashboard)/privacy/assessments/new/page.tsx");
    expect(form.match(/<DpiaFreeNote/g)?.length).toBe(2);
    expect(read("src/app/(dashboard)/privacy/page.tsx")).toContain("<DpiaFreeNote");
  });

  it("the refusal comes through the tRPC error with the link, in Spanish too", async () => {
    hosted();
    created(PILOT_DPIA_LIMIT);
    const spanish = callerFor(assessmentRouter, sessionFor("user-1"), { locale: "es" });
    await expect(
      spanish.create({ organizationId: ORG.id, templateId: DPIA_TEMPLATE.id, name: "Fidelización" })
    ).rejects.toThrow("Consulta los planes: https://www.todo.law/es/precios");
  });

  it("says that deleting does not free a place", () => {
    expect(dpiaCapMessage("en")).toMatch(/deleting one does not free a place/i);
    expect(dpiaCapMessage("es")).toMatch(/borrar una no libera plaza/i);
  });

  it("does not let a deletion free a place", async () => {
    hosted();
    // Two created, none still held: the audit log still counts them.
    created(PILOT_DPIA_LIMIT);
    held(0);
    expect(await countDpiaCreated(mocks.prisma as never, ORG.id)).toBe(PILOT_DPIA_LIMIT);
    await expect(createDpia()).rejects.toThrow();
  });

  it("counts an assessment the audit log never recorded a type for", async () => {
    created(0);
    held(PILOT_DPIA_LIMIT);
    expect(await countDpiaCreated(mocks.prisma as never, ORG.id)).toBe(PILOT_DPIA_LIMIT);
  });

  it("counts only impact assessments: another type is not capped", async () => {
    hosted();
    created(PILOT_DPIA_LIMIT);
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
    created(PILOT_DPIA_LIMIT + 5);
    await expect(createDpia()).resolves.toMatchObject({ id: "asm-1" });
    expect(await pilotDpiaQuota(mocks.prisma as never, ORG.id, isHostedDeployment())).toEqual({ capped: false });
  });

  it("reports what is left, for the screen to show", async () => {
    hosted();
    created(1);
    expect(await pilotDpiaQuota(mocks.prisma as never, ORG.id, isHostedDeployment())).toEqual({
      capped: true,
      limit: PILOT_DPIA_LIMIT,
      used: 1,
      remaining: PILOT_DPIA_LIMIT - 1,
    });
  });

  it("never reports a negative number left", async () => {
    hosted();
    created(PILOT_DPIA_LIMIT + 2);
    expect(await pilotDpiaQuota(mocks.prisma as never, ORG.id, isHostedDeployment())).toMatchObject({ remaining: 0 });
  });
});

describe("a firm at the limit can still read and export everything", () => {
  it("lists and opens its assessments", async () => {
    hosted();
    created(PILOT_DPIA_LIMIT);
    held(PILOT_DPIA_LIMIT);
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
    created(PILOT_DPIA_LIMIT);
    await expect(createDpia()).rejects.toThrow(/DPIAs/);

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
    created(PILOT_DPIA_LIMIT);
    for (let i = 0; i < 4; i++) await expect(createDpia()).rejects.toThrow();
    expect(limitRows()).toHaveLength(1);
  });

  it("a failure to write the row does not block the refusal", async () => {
    hosted();
    created(PILOT_DPIA_LIMIT);
    mocks.prisma.auditLog.create.mockRejectedValue(new Error("database unavailable"));
    await expect(createDpia()).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringContaining("See the plans"),
    });
    expect(mocks.prisma.assessment.create).not.toHaveBeenCalled();
  });

  it("writes nothing below the limit, and nothing on the kit", async () => {
    const limitRows = auditTable();
    hosted();
    created(PILOT_DPIA_LIMIT - 1);
    await createDpia();
    kit();
    created(PILOT_DPIA_LIMIT + 5);
    await createDpia();
    expect(limitRows()).toHaveLength(0);
  });
});
