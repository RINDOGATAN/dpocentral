// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Publishing the public rights-request form is a deliberate act: new
 * organisations get it switched off, the switch in the settings saves at once
 * and is audited, "Confirm and publish" records the activation of a form
 * published before activation was asked, and the settings page reads the form
 * whether it is on or off.
 *
 * Prisma is module-mocked: we assert on what the routers read and write.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    organizationMember: { findUnique: vi.fn() },
    organization: { findUnique: vi.fn() },
    dSARIntakeForm: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn(), findFirst: vi.fn() },
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
import { DEFAULT_INTAKE_FORM, ensureDefaultIntakeForm } from "@/server/services/dsar/defaultIntakeForm";
import {
  activationToRecord,
  DSAR_INTAKE_ACTIVATED,
  DSAR_INTAKE_DEACTIVATED,
} from "@/server/services/dsar/intake-activation";
import { callerFor, sessionFor } from "./helpers";

function as(role: string) {
  mocks.prisma.organizationMember.findUnique.mockResolvedValue({
    id: "member-a",
    userId: "user-a",
    organizationId: "org-a",
    role,
    organization: { id: "org-a", name: "Org A", slug: "org-a", pilotStartedAt: null },
    user: { locale: null },
  });
  return callerFor(dsarRouter, sessionFor("user-a")) as ReturnType<typeof dsarRouter.createCaller>;
}

const SEEDED = {
  id: "form-1",
  organizationId: "org-a",
  name: DEFAULT_INTAKE_FORM.name,
  slug: DEFAULT_INTAKE_FORM.slug,
  title: DEFAULT_INTAKE_FORM.title,
  description: DEFAULT_INTAKE_FORM.description,
  thankYouMessage: DEFAULT_INTAKE_FORM.thankYouMessage,
  privacyNoticeUrl: null,
  customCss: null,
  fields: [],
  enabledTypes: [...DEFAULT_INTAKE_FORM.enabledTypes],
  isActive: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.auditLog.create.mockResolvedValue({});
  mocks.prisma.auditLog.findFirst.mockResolvedValue(null);
  mocks.prisma.dSARIntakeForm.update.mockImplementation(async ({ data }) => ({ ...SEEDED, ...data }));
  mocks.prisma.dSARIntakeForm.create.mockImplementation(async ({ data }) => ({ ...SEEDED, ...data }));
});

const audited = () =>
  mocks.prisma.auditLog.create.mock.calls.map((c) => (c[0] as { data: { action: string } }).data.action);

describe("the seeded form", () => {
  it("is switched off and offers the six GDPR rights", async () => {
    mocks.prisma.dSARIntakeForm.findFirst.mockResolvedValue(null);
    await ensureDefaultIntakeForm(mocks.prisma as never, "org-a");
    const data = mocks.prisma.dSARIntakeForm.create.mock.calls[0]![0].data;
    expect(data.isActive).toBe(false);
    expect([...data.enabledTypes].sort()).toEqual(
      ["ACCESS", "ERASURE", "OBJECTION", "PORTABILITY", "RECTIFICATION", "RESTRICTION"].sort()
    );
  });
});

describe("the switch", () => {
  it("switching on saves at once and records the activation", async () => {
    mocks.prisma.dSARIntakeForm.findFirst.mockResolvedValue({ id: "form-1", isActive: false });
    await expect(as("OWNER").setIntakeActive({ organizationId: "org-a", active: true })).resolves.toEqual({
      active: true,
      recorded: true,
    });
    expect(mocks.prisma.dSARIntakeForm.update).toHaveBeenCalledWith({ where: { id: "form-1" }, data: { isActive: true } });
    expect(audited()).toEqual([DSAR_INTAKE_ACTIVATED]);
    const entry = mocks.prisma.auditLog.create.mock.calls[0]![0].data;
    expect(entry).toMatchObject({ organizationId: "org-a", userId: "user-a", changes: { isActive: true } });
  });

  it("switching off is allowed and recorded too", async () => {
    mocks.prisma.dSARIntakeForm.findFirst.mockResolvedValue({ id: "form-1", isActive: true });
    mocks.prisma.auditLog.findFirst.mockResolvedValue({ action: DSAR_INTAKE_ACTIVATED });
    await as("ADMIN").setIntakeActive({ organizationId: "org-a", active: false });
    expect(mocks.prisma.dSARIntakeForm.update).toHaveBeenCalledWith({ where: { id: "form-1" }, data: { isActive: false } });
    expect(audited()).toEqual([DSAR_INTAKE_DEACTIVATED]);
  });

  it("Confirm and publish: an active form with no recorded activation is recorded once, and nothing else changes", async () => {
    mocks.prisma.dSARIntakeForm.findFirst.mockResolvedValue({ id: "form-1", isActive: true });
    await expect(as("OWNER").setIntakeActive({ organizationId: "org-a", active: true })).resolves.toEqual({
      active: true,
      recorded: true,
    });
    expect(mocks.prisma.dSARIntakeForm.update).not.toHaveBeenCalled();
    expect(audited()).toEqual([DSAR_INTAKE_ACTIVATED]);

    // Repeated after the activation is on record: nothing is written.
    vi.clearAllMocks();
    mocks.prisma.dSARIntakeForm.findFirst.mockResolvedValue({ id: "form-1", isActive: true });
    mocks.prisma.auditLog.findFirst.mockResolvedValue({ action: DSAR_INTAKE_ACTIVATED });
    await expect(as("OWNER").setIntakeActive({ organizationId: "org-a", active: true })).resolves.toEqual({
      active: true,
      recorded: false,
    });
    expect(mocks.prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("only an owner or administrator can switch it", async () => {
    for (const role of ["PRIVACY_OFFICER", "MEMBER", "VIEWER"]) {
      await expect(as(role).setIntakeActive({ organizationId: "org-a", active: true })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    }
    expect(mocks.prisma.dSARIntakeForm.update).not.toHaveBeenCalled();
  });
});

describe("the settings page", () => {
  it("reads the form while it is switched off, with what step 4.1 needs", async () => {
    mocks.prisma.dSARIntakeForm.findFirst.mockResolvedValue(SEEDED);
    const form = await as("OWNER").getIntakeForm({ organizationId: "org-a" });
    expect(form).toMatchObject({ id: "form-1", isActive: false, activationRecorded: false, configured: false });
    const where = mocks.prisma.dSARIntakeForm.findFirst.mock.calls[0]![0].where;
    expect(where).toEqual({ organizationId: "org-a" });
  });

  it("saving the form without the flag keeps it as it is and records nothing", async () => {
    mocks.prisma.dSARIntakeForm.findFirst.mockResolvedValue(SEEDED);
    await as("OWNER").upsertIntakeForm({
      organizationId: "org-a",
      name: "Rights requests",
      slug: "request",
      title: "Exercise your rights",
      fields: [],
      enabledTypes: ["ACCESS"],
    });
    expect(mocks.prisma.dSARIntakeForm.update.mock.calls[0]![0].data.isActive).toBe(false);
    expect(mocks.prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("a change of the flag sent with the form is applied and recorded", async () => {
    mocks.prisma.dSARIntakeForm.findFirst.mockResolvedValue(SEEDED);
    await as("OWNER").upsertIntakeForm({
      organizationId: "org-a",
      name: "Rights requests",
      slug: "request",
      title: "Exercise your rights",
      fields: [],
      enabledTypes: ["ACCESS"],
      isActive: true,
    });
    expect(mocks.prisma.dSARIntakeForm.update.mock.calls[0]![0].data.isActive).toBe(true);
    expect(audited()).toEqual([DSAR_INTAKE_ACTIVATED]);
  });
});

describe("what is recorded", () => {
  it("a change always; a confirmation only while no activation is on record", () => {
    expect(activationToRecord(false, true, null)).toBe(DSAR_INTAKE_ACTIVATED);
    expect(activationToRecord(true, false, "activated")).toBe(DSAR_INTAKE_DEACTIVATED);
    expect(activationToRecord(true, true, null)).toBe(DSAR_INTAKE_ACTIVATED);
    expect(activationToRecord(true, true, "deactivated")).toBe(DSAR_INTAKE_ACTIVATED);
    expect(activationToRecord(true, true, "activated")).toBeNull();
    expect(activationToRecord(false, false, null)).toBeNull();
  });
});
