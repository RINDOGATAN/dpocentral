// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The account type: a business account works with one organisation, so the
 * switch to it is refused while the person belongs to more than one. The
 * switch to privacy professional is always allowed.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    organizationMember: { count: vi.fn() },
    user: { update: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { userRouter, BUSINESS_NEEDS_ONE_ORGANIZATION } from "@/server/routers/privacy/user";
import { localizeServerMessage } from "@/lib/server-error-messages";
import { callerFor, sessionFor } from "./helpers";

const caller = () => callerFor(userRouter, sessionFor("user-1"));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.user.update.mockImplementation(async ({ data }) => ({ id: "user-1", userType: data.userType }));
});

describe("switching to a business account", () => {
  it("is refused while the person belongs to more than one organisation", async () => {
    mocks.prisma.organizationMember.count.mockResolvedValue(2);
    await expect(caller().setUserType({ userType: "BUSINESS_OWNER" })).rejects.toThrow(BUSINESS_NEEDS_ONE_ORGANIZATION);
    expect(mocks.prisma.organizationMember.count).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    expect(mocks.prisma.user.update).not.toHaveBeenCalled();
  });

  it("is saved with one organisation (or none yet, as at onboarding)", async () => {
    for (const n of [1, 0]) {
      mocks.prisma.organizationMember.count.mockResolvedValue(n);
      await expect(caller().setUserType({ userType: "BUSINESS_OWNER" })).resolves.toEqual({
        id: "user-1",
        userType: "BUSINESS_OWNER",
      });
    }
  });

  it("never limits the switch to privacy professional", async () => {
    mocks.prisma.organizationMember.count.mockResolvedValue(5);
    await expect(caller().setUserType({ userType: "PRIVACY_PROFESSIONAL" })).resolves.toEqual({
      id: "user-1",
      userType: "PRIVACY_PROFESSIONAL",
    });
    expect(mocks.prisma.organizationMember.count).not.toHaveBeenCalled();
  });
});

describe("the message", () => {
  it("is answered in Spanish, with tú and no long dash", () => {
    const spanish = localizeServerMessage(BUSINESS_NEEDS_ONE_ORGANIZATION, "es");
    expect(spanish).toBe(es.serverErrors.exact.businessNeedsOneOrganization);
    expect(spanish).toContain("tienes que eliminar");
    expect(en.serverErrors.exact.businessNeedsOneOrganization).toBe(BUSINESS_NEEDS_ONE_ORGANIZATION);
  });

  it("is shown on the settings page in both languages", () => {
    const enNote = en.pages.settings.accountType.businessNeedsOneOrganization;
    const esNote = es.pages.settings.accountType.businessNeedsOneOrganization;
    expect(enNote).toContain("delete all your organizations but one");
    expect(esNote).toContain("eliminar todas tus organizaciones menos una");
    expect(`${enNote} ${esNote}`).not.toMatch(/[—–]/);
  });
});
