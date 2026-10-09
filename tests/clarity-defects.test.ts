// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The small defects of the October clarity review (F1 to F8), each locked by
 * a test. F1's router side is in quickstart-created-records.test.ts.
 *
 * F1 the quick start records its completion
 * F2 "Every stage is done" only when every stage is
 * F3 legitimate-interest assessments are a step, not "Coming"
 * F4 the dashboard's request queue shows a reference, not the database id
 * F5 the vendors card counts every vendor it lists
 * F6 the DPIA quick action is never cut to "Start a ..."
 * F7 a blank client can be added from All clients (the Guided way in)
 * F8 a fresh breach with no decision on notifying is in Needs action, and
 *    its incident page shows the 72-hour clock
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

const mocks = vi.hoisted(() => ({
  prisma: {
    organizationMember: { findUnique: vi.fn() },
    businessUnitMember: { findMany: vi.fn() },
    dataAsset: { count: vi.fn() },
    processingActivity: { count: vi.fn() },
    dSARRequest: { count: vi.fn() },
    assessment: { count: vi.fn() },
    incident: { count: vi.fn() },
    vendor: { count: vi.fn() },
    auditLog: { findMany: vi.fn(), create: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { DPO_CENTRAL_PATH, EMPTY_PATH_COUNTS, type PathCounts } from "@/components/guided/path-config";
import {
  currentStepId,
  evaluatePath,
  isCounted,
  nextStep,
  overallProgress,
  stageAfterCelebration,
  stageProgress,
} from "@/components/guided/path";
import { quickstartSettingsAfterRun } from "@/server/services/program/quickstart-settings";
import { formatRequestRef } from "@/lib/request-ref";
import { organizationSlug } from "@/components/privacy/new-organization-dialog";
import { buildNeedsAction, NEEDS_ACTION_KINDS } from "@/lib/needs-action";
import {
  awaitsNotificationDecision,
  breachWindowEnd,
  breachWindowOpenSince,
} from "@/lib/breach-window";
import { collectNeedsAction } from "@/server/services/views/queries";
import { organizationRouter } from "@/server/routers/privacy/organization";
import { callerFor, sessionFor } from "./helpers";

const PATH = DPO_CENTRAL_PATH;
const read = (rel: string) => readFileSync(path.resolve(__dirname, "..", rel), "utf8");
const statusesFor = (over: Partial<PathCounts>) => evaluatePath(PATH, { ...EMPTY_PATH_COUNTS, ...over });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("AUTH_COOKIE_DOMAIN", "");
});

describe("F1: the quick start records its completion", () => {
  const now = new Date("2026-10-09T08:00:00.000Z");

  it("sets completedAt on a first run and keeps every other setting", () => {
    const out = quickstartSettingsAfterRun({ locale: "es", programName: "Old" }, { now });
    expect(out.locale).toBe("es");
    expect(out.programName).toBe("Old");
    expect((out.quickstart as Record<string, unknown>).completedAt).toBe(now.toISOString());
  });

  it("keeps the first completion on a later run", () => {
    const out = quickstartSettingsAfterRun(
      { quickstart: { completedAt: "2026-09-01T00:00:00.000Z" } },
      { now, programName: " New " },
    );
    expect((out.quickstart as Record<string, unknown>).completedAt).toBe("2026-09-01T00:00:00.000Z");
    expect(out.programName).toBe("New");
  });

  it("reads anything that is not an object as empty settings", () => {
    for (const current of [null, undefined, "x", [1]]) {
      const out = quickstartSettingsAfterRun(current, { now });
      expect((out.quickstart as Record<string, unknown>).completedAt).toBe(now.toISOString());
    }
  });

  it("marks the quick start step done for a template-only run (no vendors)", () => {
    const s = statusesFor({ quickstartCompleted: true, dataAssets: 9, processingActivities: 7 });
    expect(s.quickstart).toBe("done");
    expect(nextStep(PATH, s)?.step.id).not.toBe("quickstart");
  });
});

describe("F2: 'Every stage is done' only when every stage is", () => {
  it("names the stage still open when the last stage is finished first", () => {
    // Stage 6 done (an incident), stage 4 open (nothing assessed).
    const s = statusesFor({
      quickstartCompleted: true,
      jurisdictions: 1,
      dataAssets: 1,
      processingActivities: 1,
      vendors: 1,
      dsarRequests: 1,
      incidents: 1,
    });
    const respond = PATH.stages.findIndex((st) => st.id === "respond");
    expect(stageProgress(PATH.stages[respond], s).state).toBe("done");
    const open = stageAfterCelebration(PATH, s);
    expect(open).not.toBeNull();
    expect(PATH.stages[open!].id).toBe("assess");
  });

  it("says every stage is done only when no counted step is left", () => {
    const s = statusesFor({
      quickstartCompleted: true,
      jurisdictions: 1,
      dataAssets: 1,
      processingActivities: 1,
      vendors: 1,
      vendorsAssessed: 1,
      vendorAssessments: 1,
      assessments: 1,
      assessmentsApproved: 1,
      transfers: 1,
      dsarRequests: 1,
      incidents: 1,
    });
    expect(stageAfterCelebration(PATH, s)).toBeNull();
  });

  it("is what the step band reads", () => {
    const band = read("src/components/guided/step-band.tsx");
    expect(band).toContain("stageAfterCelebration(DPO_CENTRAL_PATH, statuses)");
    expect(band).not.toContain("celebrate + 1 < stages.length");
  });
});

describe("F3: legitimate-interest assessments are a step, not 'Coming'", () => {
  const lia = PATH.stages.flatMap((s) => s.steps).find((s) => s.id === "lia")!;

  it("opens the assessment form on the legitimate-interest template", () => {
    expect(lia.coming).toBeFalsy();
    expect(lia.href).toBe("/privacy/assessments/new?type=LIA");
    // The picker offers that same address as an included template.
    expect(read("src/app/(dashboard)/privacy/assessments/page.tsx")).toContain('{ type: "LIA", nameKey: "lia" }');
  });

  it("is optional: never counted, never the next step", () => {
    expect(lia.optional).toBe(true);
    expect(isCounted(lia)).toBe(false);
    const before = overallProgress(PATH, statusesFor({}));
    const after = overallProgress(PATH, statusesFor({ liaAssessments: 1, liaApproved: 1 }));
    expect(after).toEqual(before);
    expect(nextStep(PATH, statusesFor({}))?.step.id).not.toBe("lia");
  });

  it("is started by a draft and done once one is approved", () => {
    expect(statusesFor({}).lia).toBe("todo");
    expect(statusesFor({ liaAssessments: 1 }).lia).toBe("started");
    expect(statusesFor({ liaAssessments: 1, liaApproved: 1 }).lia).toBe("done");
  });

  it("is the current step only on the legitimate-interest form", () => {
    expect(currentStepId(PATH, "/privacy/assessments/new", "type=LIA")).toBe("lia");
    expect(currentStepId(PATH, "/privacy/assessments/new", "type=DPIA")).toBe("assessments");
    expect(currentStepId(PATH, "/privacy/assessments")).toBe("assessments");
  });

  it("is counted from the assessments' templates", () => {
    const counts = read("src/server/services/program/path-counts.ts");
    expect(counts).toContain('template: { type: "LIA" }');
  });
});

describe("F4: the dashboard's request queue shows a reference, not the database id", () => {
  it("derives a short reference in the reader's language", () => {
    expect(formatRequestRef("cmabcdefghij1234xyz9q")).toBe("REQ-4XYZ9Q");
    expect(formatRequestRef("cmabcdefghij1234xyz9q", "en")).toBe("REQ-4XYZ9Q");
    expect(formatRequestRef("cmabcdefghij1234xyz9q", "es")).toBe("SOL-4XYZ9Q");
    expect(formatRequestRef("cmabcdefghij1234xyz9q", "fr")).toBe("REQ-4XYZ9Q");
  });

  it("is what the dashboard shows, the full id only in the tooltip", () => {
    const page = read("src/app/(dashboard)/privacy/page.tsx");
    expect(page).toContain("formatRequestRef(dsar.publicId, locale)");
    expect(page).toContain("title={dsar.publicId}");
    expect(page).not.toContain(">{dsar.publicId}<");
  });
});

describe("F5: the vendors card counts every vendor it lists", () => {
  beforeEach(() => {
    const p = mocks.prisma;
    p.organizationMember.findUnique.mockResolvedValue({
      id: "m-1",
      userId: "user-1",
      organizationId: "org-1",
      role: "OWNER",
      organization: { id: "org-1", name: "Org", slug: "org" },
    });
    p.businessUnitMember.findMany.mockResolvedValue([]);
    p.dataAsset.count.mockResolvedValue(0);
    p.processingActivity.count.mockResolvedValue(0);
    p.dSARRequest.count.mockResolvedValue(0);
    p.assessment.count.mockResolvedValue(0);
    p.incident.count.mockResolvedValue(0);
    p.auditLog.findMany.mockResolvedValue([]);
    // Three prospective vendors: none active, three in all.
    p.vendor.count.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
      where.status === "ACTIVE" ? 0 : 3,
    );
  });

  it("returns the total beside the active count", async () => {
    const stats = await callerFor(organizationRouter, sessionFor("user-1")).getDashboardStats({
      organizationId: "org-1",
    });
    expect(stats.activeVendors).toBe(0);
    expect(stats.totalVendors).toBe(3);
  });

  it("says both figures on the card, in English and Spanish", () => {
    const page = read("src/app/(dashboard)/privacy/page.tsx");
    expect(page).toContain('tp("vendors.countLine", { total: dashboardStats.totalVendors, active: dashboardStats.activeVendors })');
    expect(en.pages.dashboard.vendors.countLine).toContain("{active}");
    expect(es.pages.dashboard.vendors.countLine).toContain("{active");
    expect(es.pages.dashboard.vendors.countLine).toContain("proveedores");
  });
});

describe("F6: the DPIA quick action is never cut short", () => {
  it("lets the label and the badge wrap instead of truncating the label", () => {
    const page = read("src/app/(dashboard)/privacy/page.tsx");
    const start = page.indexOf('href="/privacy/assessments/new?type=DPIA"');
    const block = page.slice(start, page.indexOf("</Link>", start));
    expect(block).toContain('<span className="min-w-0">{tp("quickActions.newDpia")}</span>');
    expect(block).not.toContain('<span className="truncate">{tp("quickActions.newDpia")}</span>');
    expect(block).toContain("whitespace-normal");
    expect(block).toContain("sm:h-auto");
  });
});

describe("F7: a blank client can be added in the Guided layout", () => {
  it("puts 'Add a client' on All clients, with the one new-organisation dialog", () => {
    const clients = read("src/app/(dashboard)/privacy/clients/page.tsx");
    expect(clients).toContain("<NewOrganizationDialog");
    expect(clients).toContain('t("addClient")');
    expect(en.portfolio.addClient).toBe("Add a client");
    expect(es.portfolio.addClient).toBe("Añadir un cliente");
  });

  it("is the same dialog Classic's switcher opens", () => {
    const dashboard = read("src/app/(dashboard)/privacy/page.tsx");
    expect(dashboard).toContain("<NewOrganizationDialog open={createOrgOpen}");
    expect(dashboard).not.toContain("trpc.organization.create.useMutation");
  });

  it("derives the slug from the name", () => {
    expect(organizationSlug("  Northside Dental, Clinic ")).toBe("northside-dental-clinic");
  });
});

describe("F8: a breach with no decision on notifying", () => {
  const now = new Date("2026-10-09T12:00:00.000Z");
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600 * 1000);
  const fresh = {
    status: "REPORTED",
    notificationRequired: false,
    discoveredAt: hoursAgo(2),
    notificationDeadline: null,
    notifications: [],
  };

  it("ends the window 72 hours after discovery unless the incident has its own deadline", () => {
    expect(breachWindowEnd(fresh).toISOString()).toBe(new Date(hoursAgo(2).getTime() + 72 * 3600 * 1000).toISOString());
    const own = new Date("2026-10-10T00:00:00.000Z");
    expect(breachWindowEnd({ ...fresh, notificationDeadline: own }).toISOString()).toBe(own.toISOString());
    expect(breachWindowOpenSince(now).toISOString()).toBe(hoursAgo(72).toISOString());
  });

  it("waits for a decision only while open, unmarked, unnotified and inside the window", () => {
    expect(awaitsNotificationDecision(fresh, now)).toBe(true);
    expect(awaitsNotificationDecision({ ...fresh, notificationRequired: true }, now)).toBe(false);
    expect(awaitsNotificationDecision({ ...fresh, notifications: [{}] }, now)).toBe(false);
    expect(awaitsNotificationDecision({ ...fresh, status: "CLOSED" }, now)).toBe(false);
    expect(awaitsNotificationDecision({ ...fresh, discoveredAt: hoursAgo(73) }, now)).toBe(false);
  });

  it("is its own category in Needs action, after breaches to notify", () => {
    const kinds = [...NEEDS_ACTION_KINDS];
    expect(kinds.indexOf("breach-decision")).toBe(kinds.indexOf("breach-window") + 1);
    const items = buildNeedsAction({
      reviewDue: 0,
      dsarDue: 0,
      breachWindow: 0,
      breachDecision: 1,
      assessmentApproval: 0,
    });
    expect(items).toEqual([{ kind: "breach-decision", count: 1, href: "/privacy/incidents" }]);
    for (const bundle of [en, es]) {
      expect(bundle.views.needsAction.kind["breach-decision"]).toBeTruthy();
      expect(bundle.views.needsAction.hint["breach-decision"]).toBeTruthy();
    }
  });

  it("is counted by the Needs action query for the whole organisation", async () => {
    const counts = {
      processingActivity: { count: vi.fn().mockResolvedValue(0) },
      dSARRequest: { count: vi.fn().mockResolvedValue(0) },
      incident: { count: vi.fn() },
      assessment: { count: vi.fn().mockResolvedValue(0) },
    };
    counts.incident.count.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
      where.notificationRequired === false ? 1 : 0,
    );
    const result = await collectNeedsAction(counts as never, "org-1", { all: true });
    expect(result.items.map((i) => i.kind)).toEqual(["breach-decision"]);
    expect(result.total).toBe(1);

    const undecided = counts.incident.count.mock.calls
      .map(([arg]) => arg.where)
      .find((w: Record<string, unknown>) => w.notificationRequired === false);
    expect(undecided.organizationId).toBe("org-1");
    expect(undecided.notifications).toEqual({ none: {} });
    expect(undecided.discoveredAt.gt).toBeInstanceOf(Date);
    expect(undecided.status).toEqual({ notIn: ["CLOSED", "FALSE_POSITIVE"] });
  });

  it("still counts with the rights-request module off, while requests are not counted", async () => {
    vi.stubEnv("NEXT_PUBLIC_DSAR_ENABLED", "false");
    const counts = {
      processingActivity: { count: vi.fn().mockResolvedValue(0) },
      dSARRequest: { count: vi.fn().mockResolvedValue(5) },
      incident: { count: vi.fn() },
      assessment: { count: vi.fn().mockResolvedValue(0) },
    };
    counts.incident.count.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
      where.notificationRequired === false ? 1 : 0,
    );
    const result = await collectNeedsAction(counts as never, "org-1", { all: true });
    expect(counts.dSARRequest.count).not.toHaveBeenCalled();
    expect(result.items.map((i) => i.kind)).toEqual(["breach-decision"]);
  });

  it("is left out of a department view, like the other organisation-wide categories", async () => {
    const counts = {
      processingActivity: { count: vi.fn().mockResolvedValue(0) },
      dSARRequest: { count: vi.fn() },
      incident: { count: vi.fn() },
      assessment: { count: vi.fn() },
    };
    const result = await collectNeedsAction(counts as never, "org-1", {
      all: false,
      businessUnitIds: ["bu-1"],
    });
    expect(counts.incident.count).not.toHaveBeenCalled();
    expect(result.items).toEqual([]);
  });

  it("shows the 72-hour clock in the incident page header, in English and Spanish", () => {
    const page = read("src/app/(dashboard)/privacy/incidents/[id]/page.tsx");
    expect(page).toContain("breachWindowEnd(incident)");
    expect(page).toContain('data-testid="incident-window-clock"');
    for (const bundle of [en, es]) {
      expect(bundle.pages.incidentDetail.windowClock.open).toContain("{date}");
      expect(bundle.pages.incidentDetail.windowClock.ended).toContain("{date}");
    }
  });
});
