// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Creating a gated assessment type (F1 of the September browser round).
 *
 * Where a premium type is gated (Stripe on, outside the hosted pilot, no
 * licence), assessment.create answers FORBIDDEN with a sentence a person can
 * act on, and creates nothing. The new-assessment page shows that sentence
 * under the form and keeps what was typed; the type grid and the Guided home's
 * "Start a DPIA" quick action label a gated type instead of hiding it.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

const mocks = vi.hoisted(() => ({
  prisma: {
    organizationMember: {
      findUnique: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    auditLog: { create: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    skillPackage: { findFirst: vi.fn() },
    customerOrganization: { findFirst: vi.fn() },
    assessment: { create: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    assessmentTemplate: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    processingActivity: { count: vi.fn().mockResolvedValue(0) },
    vendor: { count: vi.fn().mockResolvedValue(0) },
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
// A fork with Stripe re-armed: the only posture where a type is gated.
vi.mock("@/config/features", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/config/features")>();
  return { ...real, features: { ...real.features, stripeEnabled: true } };
});

import { TRPCError } from "@trpc/server";
import { assessmentRouter } from "@/server/routers/privacy/assessment";
import { callerFor, sessionFor } from "./helpers";

const ROOT = path.resolve(__dirname, "..");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

const ORG = { id: "org-1", name: "Org", slug: "org", pilotStartedAt: null };
const PIA_TEMPLATE = { id: "system-pia-template", type: "PIA", organizationId: null };
const LIA_TEMPLATE = { id: "system-lia-template", type: "LIA", organizationId: null };

const create = (templateId: string) =>
  callerFor(assessmentRouter, sessionFor("user-1")).create({
    organizationId: ORG.id,
    templateId,
    name: "Loyalty programme",
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("AUTH_COOKIE_DOMAIN", "");
  mocks.prisma.organizationMember.findUnique.mockResolvedValue({
    id: "m-1",
    userId: "user-1",
    organizationId: ORG.id,
    role: "OWNER",
    organization: ORG,
  });
  mocks.prisma.skillPackage.findFirst.mockResolvedValue(null);
  mocks.prisma.customerOrganization.findFirst.mockResolvedValue(null);
  mocks.prisma.assessment.create.mockImplementation(async ({ data }) => ({ id: "asm-1", ...data }));
  mocks.prisma.auditLog.create.mockResolvedValue({});
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("assessment.create on a gated type", () => {
  // Since 29 September 2026 the DPIA is not gated here (two are free on the
  // pilot tier, tests/hosted-open-gates.test.ts); the PIA still is.
  it("answers FORBIDDEN with the reason, and creates nothing", async () => {
    mocks.prisma.assessmentTemplate.findFirst.mockResolvedValue(PIA_TEMPLATE);
    const err = await create(PIA_TEMPLATE.id).catch((e) => e);
    expect(err).toBeInstanceOf(TRPCError);
    expect(err.code).toBe("FORBIDDEN");
    expect(err.message).toMatch(/^PIA assessments require a premium license\. \S/);
    expect(mocks.prisma.assessment.create).not.toHaveBeenCalled();
    expect(mocks.prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("creates a free type (LIA) in the same posture", async () => {
    mocks.prisma.assessmentTemplate.findFirst.mockResolvedValue(LIA_TEMPLATE);
    await expect(create(LIA_TEMPLATE.id)).resolves.toMatchObject({ id: "asm-1" });
    expect(mocks.prisma.assessment.create).toHaveBeenCalledTimes(1);
  });
});

describe("the new-assessment page on a refusal", () => {
  const page = read("src/app/(dashboard)/privacy/assessments/new/page.tsx");
  const onError = page.slice(page.indexOf("onError:"), page.indexOf("const isTypeEntitled"));

  it("shows the server's message under the form, as an alert", () => {
    expect(page).toMatch(/role="alert"[\s\S]{0,400}createAssessment\.error\.message/);
    expect(onError).toContain("toast.error(error.message");
  });

  it("keeps the form values: nothing on the error path resets them", () => {
    expect(onError).not.toContain("setFormData");
    expect(onError).not.toContain("setSelectedType");
  });

  it("no button inside the form submits it by accident", () => {
    const form = page.slice(page.indexOf("<form"), page.indexOf("</form>"));
    const buttons = form.match(/<Button\b[^>]*>/g) ?? [];
    for (const b of buttons) {
      if (b.includes("setSelectedType")) expect(b).toContain('type="button"');
    }
    expect(form).toContain('type="submit"');
  });

  it("labels a gated type on the grid and on the form reached by a link", () => {
    expect(page).toContain("typeCardLockedLabel");
    expect(page).toMatch(/isTypeLocked\(selectedType\)[\s\S]{0,400}typeGatedNotice/);
  });
});

describe("the gated-type labels", () => {
  it("ships the labels in English and Spanish", () => {
    for (const bundle of [en, es]) {
      expect(bundle.pages.newAssessment.typeCardLockedLabel).toContain("{name}");
      expect(bundle.pages.newAssessment.typeGatedNotice).toContain("{name}");
    }
  });
});
