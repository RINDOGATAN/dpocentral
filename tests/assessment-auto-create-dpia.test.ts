// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * A DPIA drafted automatically (from a processing activity, a vendor import or
 * an AI system) counts against the pilot tier's two free DPIAs like one
 * created by hand. With none left it falls back to an LIA, so the automatic
 * path cannot go around the server count.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/prisma", () => ({ default: {}, prisma: {} }));

import { createAssessmentFromActivity } from "@/server/services/assessment-auto-create";

function tx(createdDpias: number) {
  return {
    auditLog: {
      count: vi.fn().mockResolvedValue(createdDpias),
      create: vi.fn().mockResolvedValue({}),
    },
    assessment: {
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(async ({ data }) => ({ id: "a-1", ...data })),
    },
    assessmentTemplate: {
      findFirst: vi.fn().mockImplementation(async ({ where }) => ({
        id: `tpl-${where.type}`,
        type: where.type,
      })),
    },
  };
}

const params = (db: ReturnType<typeof tx>) => ({
  tx: db as never,
  organizationId: "org-1",
  userId: "user-1",
  processingActivityId: "pa-1",
  assessmentType: "DPIA" as const,
  reason: "High risk",
});

beforeEach(() => vi.stubEnv("VERCEL_ENV", "production"));
afterEach(() => vi.unstubAllEnvs());

describe("automatic DPIA drafts on the hosted pilot tier", () => {
  it("drafts a DPIA while one of the two is left, and records its type", async () => {
    const db = tx(1);
    const result = await createAssessmentFromActivity(params(db));
    expect(result.created).toBe(true);
    expect(db.assessment.create.mock.calls[0][0].data.templateId).toBe("tpl-DPIA");
    expect(db.auditLog.create.mock.calls[0][0].data.changes.templateType).toBe("DPIA");
  });

  it("falls back to an LIA once both are used", async () => {
    const db = tx(2);
    const result = await createAssessmentFromActivity(params(db));
    expect(result.created).toBe(true);
    expect(db.assessment.create.mock.calls[0][0].data.templateId).toBe("tpl-LIA");
  });

  it("is not capped on the kit", async () => {
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("AUTH_COOKIE_DOMAIN", "");
    const db = tx(9);
    await createAssessmentFromActivity(params(db));
    expect(db.assessment.create.mock.calls[0][0].data.templateId).toBe("tpl-DPIA");
  });
});
