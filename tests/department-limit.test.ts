// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * A member limited to one department (the owner's decision of 29 September
 * 2026): the selector shows the department, never "Whole organisation"; the
 * quick start, the organisation-wide progress and the organisation-wide
 * actions are not shown, in the sidebar or on the Guided home. The server
 * refuses the quick start to them and narrows the home's inventory counts.
 * The browser walk with the limited test user is e2e/round-2.spec.ts.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const mocks = vi.hoisted(() => ({
  prisma: {
    organizationMember: { findUnique: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    businessUnitMember: { findMany: vi.fn() },
    dataAsset: { count: vi.fn().mockResolvedValue(0) },
    processingActivity: { count: vi.fn().mockResolvedValue(0) },
    dSARRequest: { count: vi.fn().mockResolvedValue(0) },
    assessment: { count: vi.fn().mockResolvedValue(0) },
    incident: { count: vi.fn().mockResolvedValue(0) },
    vendor: { count: vi.fn().mockResolvedValue(0) },
    auditLog: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn() },
    organization: { updateMany: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import {
  departmentSwitchState,
  isLimitedMember,
  showsOrganisationWide,
} from "@/lib/department-limit";
import { withoutOrgWideSteps } from "@/components/guided/path";
import { DPO_CENTRAL_PATH } from "@/components/guided/path-config";
import { quickstartRouter } from "@/server/routers/privacy/quickstart";
import { organizationRouter } from "@/server/routers/privacy/organization";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { callerFor, sessionFor } from "./helpers";

const ORG = { id: "org-1", name: "Org", slug: "org", pilotStartedAt: null };
const SALES = { id: "bu-sales", name: "Sales" };
const HR = { id: "bu-hr", name: "HR" };

const limitedTo = (...ids: string[]) =>
  mocks.prisma.businessUnitMember.findMany.mockResolvedValue(ids.map((businessUnitId) => ({ businessUnitId })));

const read = (p: string) => readFileSync(path.resolve(__dirname, "..", p), "utf8");

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("AUTH_COOKIE_DOMAIN", "");
  mocks.prisma.organizationMember.findUnique.mockResolvedValue({
    id: "m-1",
    userId: "user-1",
    organizationId: ORG.id,
    role: "MEMBER",
    organization: ORG,
  });
  limitedTo();
});

describe("who is limited", () => {
  it("reads listForScope: null is the whole organisation, a list is a limit", () => {
    expect(isLimitedMember(null)).toBe(false);
    expect(isLimitedMember(["bu-sales"])).toBe(true);
    expect(isLimitedMember([])).toBe(true);
    expect(isLimitedMember(undefined)).toBeNull();
  });

  it("shows organisation-wide things only once known not to be limited", () => {
    expect(showsOrganisationWide(false)).toBe(true);
    expect(showsOrganisationWide(true)).toBe(false);
    expect(showsOrganisationWide(null)).toBe(false);
  });
});

describe("the department selector", () => {
  it("shows a limited member their department, never the whole organisation", () => {
    const state = departmentSwitchState({
      departments: [HR, SALES],
      myBusinessUnitIds: [SALES.id],
      stored: null,
    });
    expect(state).toEqual({ offerWholeOrganisation: false, choices: [SALES], value: SALES.id });
  });

  it("ignores a stored choice that is not the member's", () => {
    const state = departmentSwitchState({
      departments: [HR, SALES],
      myBusinessUnitIds: [SALES.id],
      stored: HR.id,
    });
    expect(state?.value).toBe(SALES.id);
  });

  it("keeps the whole organisation for an unlimited member", () => {
    const state = departmentSwitchState({
      departments: [HR, SALES],
      myBusinessUnitIds: null,
      stored: null,
    });
    expect(state).toEqual({ offerWholeOrganisation: true, choices: [HR, SALES], value: null });
  });

  it("draws nothing when there is nothing to offer", () => {
    expect(departmentSwitchState({ departments: [], myBusinessUnitIds: null, stored: null })).toBeNull();
    expect(
      departmentSwitchState({ departments: [HR], myBusinessUnitIds: ["gone"], stored: null })
    ).toBeNull();
  });
});

describe("the sidebar and the Guided home", () => {
  it("the limited path has no quick start, and keeps every stage", () => {
    const limited = withoutOrgWideSteps(DPO_CENTRAL_PATH);
    const ids = limited.stages.flatMap((s) => s.steps.map((step) => step.id));
    expect(ids).not.toContain("quickstart");
    expect(ids).toContain("applies");
    expect(limited.stages).toHaveLength(DPO_CENTRAL_PATH.stages.length);
  });

  it("the layout hides the organisation's progress and the quick start from a limited member", () => {
    const layout = read("src/components/guided/guided-layout.tsx");
    expect(layout).toContain("useMemberScope()");
    expect(layout).toContain("config: limited ? LIMITED_PATH : DPO_CENTRAL_PATH");
    expect(layout).toContain("showProgress: !limited");
    expect(layout).toContain("planLine: orgWide ?");
    expect(layout).toContain("statuses={orgWide ? statuses : null}");
    const menu = read("src/components/guided/path-menu.tsx");
    expect(menu).toContain("showProgress && (");
  });

  it("the home hides the quick start, the next step and the whole-programme actions", () => {
    const home = read("src/app/(dashboard)/privacy/page.tsx");
    expect(home).toContain("const { orgWide } = useMemberScope()");
    expect(home).toContain("if (!orgWide || !isEmptyOrg || fromQuickstart) return;");
    // Classic: the quick start card and its two whole-programme actions.
    expect(home).toContain("classic && showQuickstart && orgWide &&");
    // The quick start action and the whole-programme report.
    expect(home.match(/\{orgWide && \(/g)?.length).toBe(2);
    // Guided (decision d7): the organisation's figure, areas, documents and
    // next actions only for a member who sees the whole organisation.
    const guided = read("src/components/guided/guided-dashboard.tsx");
    expect(guided).toContain("const { orgWide } = useMemberScope()");
    expect(guided).toContain("{orgWide ? (");
  });

  it("the quick start page says why, in both languages", () => {
    const page = read("src/app/(dashboard)/privacy/quickstart/page.tsx");
    expect(page).toContain("if (limited) {");
    for (const bundle of [en, es]) {
      expect(bundle.pages.quickstart.limitedTitle).toBeTruthy();
      expect(bundle.pages.quickstart.limitedBody).toBeTruthy();
      expect(bundle.pages.quickstart.limitedBack).toBeTruthy();
    }
    expect(es.pages.quickstart.limitedBody).not.toBe(en.pages.quickstart.limitedBody);
  });
});

describe("on the server", () => {
  it("refuses the quick start to a limited member", async () => {
    limitedTo(SALES.id);
    await expect(
      callerFor(quickstartRouter, sessionFor("user-1")).execute({
        organizationId: ORG.id,
        industryId: "saas",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN", message: expect.stringMatching(/limited to your department/) });
  });

  it("narrows the home's inventory counts to the member's department", async () => {
    limitedTo(SALES.id);
    await callerFor(organizationRouter, sessionFor("user-1")).getDashboardStats({ organizationId: ORG.id });
    for (const count of [mocks.prisma.dataAsset.count, mocks.prisma.processingActivity.count]) {
      expect(count.mock.calls[0][0].where).toMatchObject({
        organizationId: ORG.id,
        AND: [{ businessUnitId: { in: [SALES.id] } }],
      });
    }
  });

  it("leaves an unlimited member's counts on the whole organisation", async () => {
    limitedTo();
    await callerFor(organizationRouter, sessionFor("user-1")).getDashboardStats({ organizationId: ORG.id });
    expect(mocks.prisma.dataAsset.count.mock.calls[0][0].where).toEqual({ organizationId: ORG.id });
  });
});
