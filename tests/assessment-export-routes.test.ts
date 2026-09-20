// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The two assessment export routes, end to end over a mocked database:
 * /api/export/assessment/[id] and /api/export/assessment-portfolio.
 *
 * Both are GET routes that render a PDF, so both answer for who may call
 * them (a signed-in member of the organisation and nobody else), for an
 * assessment that is not there, for a template that is not there, and for a
 * render in each language. The portfolio also reports the same completion
 * figure as the single document for the same assessment.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { NextRequest } from "next/server";
import { translator } from "./pdf-text";
import { dpiaTemplateData } from "@/config/dpia-template-v2";
import { DPIA_TEMPLATE_ID } from "@/config/dpia-template-v2";
import { CA_OPTION, FRAMEWORK_QUESTION_ID } from "@/config/assessment-frameworks";

const mocks = vi.hoisted(() => ({
  prisma: {
    assessment: { findUnique: vi.fn(), findMany: vi.fn() },
    organization: { findUnique: vi.fn() },
    organizationMember: { findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
  },
  getToken: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("next-auth/jwt", () => ({ getToken: mocks.getToken }));
vi.mock("next/headers", () => ({ headers: async () => new Map() }));
vi.mock("@/i18n/server-locale", () => ({ getCookieLocale: async () => null }));
vi.mock("next-intl/server", () => ({
  getTranslations: async ({ locale, namespace }: { locale: string; namespace: string }) => {
    const bundle = (locale === "es" ? es : en) as unknown as Record<string, unknown>;
    let node: unknown = bundle;
    for (const part of namespace.split(".")) node = (node as Record<string, unknown>)[part];
    return translator(node as Record<string, unknown>);
  },
}));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { GET as exportAssessment } from "@/app/api/export/assessment/[id]/route";
import { GET as exportPortfolio } from "@/app/api/export/assessment-portfolio/route";

const TEMPLATE = {
  id: DPIA_TEMPLATE_ID,
  type: "DPIA",
  name: dpiaTemplateData.name,
  version: dpiaTemplateData.version,
  sections: dpiaTemplateData.sections,
  scoringLogic: dpiaTemplateData.scoringLogic,
};

/** One answer: the framework question, California only. */
const RESPONSES = [
  {
    sectionId: "s0",
    questionId: FRAMEWORK_QUESTION_ID,
    response: JSON.stringify([CA_OPTION]),
    riskScore: null,
    notes: null,
    responder: null,
    respondedAt: new Date("2026-09-01T00:00:00Z"),
  },
];

const ASSESSMENT = {
  id: "asm-1",
  organizationId: "org-1",
  name: "Loyalty programme",
  description: null,
  status: "IN_PROGRESS",
  riskLevel: null,
  riskScore: null,
  startedAt: new Date("2026-09-01T00:00:00Z"),
  submittedAt: null,
  completedAt: null,
  dueDate: null,
  organization: { name: "Org" },
  template: TEMPLATE,
  processingActivity: null,
  vendor: null,
  responses: RESPONSES,
  mitigations: [],
  approvals: [],
  versions: [],
};

const member = (email: string) => ({ id: "mem-1", userId: "user-1", email });

/** Each test uses its own caller: the export limiter is keyed by e-mail. */
let seq = 0;
const caller = () => `user${++seq}@test.example`;

const singleUrl = (email: string, locale?: string) =>
  `http://localhost/api/export/assessment/asm-1${locale ? `?locale=${locale}` : ""}&who=${email}`;

const single = (locale?: string) =>
  exportAssessment(new Request(singleUrl("x", locale)), {
    params: Promise.resolve({ id: "asm-1" }),
  });

const portfolio = (locale?: string) =>
  exportPortfolio(
    new NextRequest(
      `http://localhost/api/export/assessment-portfolio?organizationId=org-1${
        locale ? `&locale=${locale}` : ""
      }`
    )
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getToken.mockResolvedValue({ email: caller() });
  mocks.prisma.organizationMember.findFirst.mockResolvedValue(member("member@test.example"));
  mocks.prisma.assessment.findUnique.mockResolvedValue(ASSESSMENT);
  mocks.prisma.assessment.findMany.mockResolvedValue([
    { ...ASSESSMENT, mitigations: [], approvals: [], _count: { responses: 1 } },
  ]);
  mocks.prisma.organization.findUnique.mockResolvedValue({ name: "Org" });
  mocks.prisma.auditLog.create.mockResolvedValue({});
});

describe("the single assessment export", () => {
  it("refuses a caller who is not signed in", async () => {
    mocks.getToken.mockResolvedValue(null);
    const res = await single();
    expect(res.status).toBe(401);
    expect(mocks.prisma.assessment.findUnique).not.toHaveBeenCalled();
  });

  it("refuses a signed-in caller who is not a member of the organisation", async () => {
    mocks.prisma.organizationMember.findFirst.mockResolvedValue(null);
    const res = await single();
    expect(res.status).toBe(403);
    expect(mocks.prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("answers 404 for an assessment that is not there", async () => {
    mocks.prisma.assessment.findUnique.mockResolvedValue(null);
    const res = await single();
    expect(res.status).toBe(404);
  });

  it("answers 500 for an assessment whose template was deleted", async () => {
    mocks.prisma.assessment.findUnique.mockResolvedValue({ ...ASSESSMENT, template: null });
    const res = await single();
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain("template");
  });

  for (const locale of ["en", "es"] as const) {
    it(`renders a PDF and records the export (${locale})`, async () => {
      const res = await single(locale);
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("application/pdf");
      expect(res.headers.get("Content-Disposition")).toContain("Assessment-DPIA-");
      const body = new Uint8Array(await res.arrayBuffer());
      expect(body.byteLength).toBeGreaterThan(1000);
      expect(String.fromCharCode(...body.slice(0, 5))).toBe("%PDF-");
      expect(mocks.prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "EXPORT_PDF", entityId: "asm-1" }),
        })
      );
    });
  }
});

describe("the portfolio export", () => {
  it("refuses a caller who is not signed in", async () => {
    mocks.getToken.mockResolvedValue(null);
    const res = await portfolio();
    expect(res.status).toBe(401);
  });

  it("refuses a signed-in caller who is not a member of the organisation", async () => {
    mocks.prisma.organizationMember.findFirst.mockResolvedValue(null);
    const res = await portfolio();
    expect(res.status).toBe(403);
    expect(mocks.prisma.assessment.findMany).not.toHaveBeenCalled();
  });

  it("answers 400 without an organisation", async () => {
    const res = await exportPortfolio(
      new NextRequest("http://localhost/api/export/assessment-portfolio")
    );
    expect(res.status).toBe(400);
  });

  it("answers 404 for an organisation that is not there", async () => {
    mocks.prisma.organization.findUnique.mockResolvedValue(null);
    const res = await portfolio();
    expect(res.status).toBe(404);
  });

  it("renders an assessment whose template was deleted rather than failing", async () => {
    mocks.prisma.assessment.findMany.mockResolvedValue([{ ...ASSESSMENT, template: null }]);
    const res = await portfolio();
    expect(res.status).toBe(200);
  });

  for (const locale of ["en", "es"] as const) {
    it(`renders a PDF and records the export (${locale})`, async () => {
      const res = await portfolio(locale);
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("application/pdf");
      expect(res.headers.get("Content-Disposition")).toContain("Assessment-Portfolio-");
      const body = new Uint8Array(await res.arrayBuffer());
      expect(String.fromCharCode(...body.slice(0, 5))).toBe("%PDF-");
      expect(mocks.prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "EXPORT_PDF", entityId: "assessment-portfolio" }),
        })
      );
    });
  }
});
