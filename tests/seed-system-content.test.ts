/**
 * Hermetic unit tests for the guarded system-content upserts used by the
 * seeds (which existing self-host installs run on every boot). Prisma is a
 * plain mock — no database.
 *
 * Asserts:
 *  - version comparison is numeric per part ("1.10" > "1.9", "1.1.0" > "1.0");
 *  - a missing row is created, an older or equal system row is updated;
 *  - a newer row (e.g. installed from a signed skill package) is kept;
 *  - a row with the same id that is not a system row is never touched.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  compareVersions,
  upsertSystemQuestionnaire,
  upsertSystemTemplate,
} from "@/lib/seed-system-content";

const findUnique = vi.fn();
const create = vi.fn();
const update = vi.fn();
const delegate = {
  findUnique: (...a: unknown[]) => findUnique(...a),
  create: (...a: unknown[]) => create(...a),
  update: (...a: unknown[]) => update(...a),
};
const prisma = {
  assessmentTemplate: delegate,
  vendorQuestionnaire: delegate,
} as unknown as Parameters<typeof upsertSystemTemplate>[0];

const TIA = {
  type: "TIA" as const,
  name: "Transfer Impact Assessment (TIA)",
  version: "1.0",
  isSystem: true,
  isActive: true,
  sections: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  create.mockResolvedValue({});
  update.mockResolvedValue({});
});

describe("compareVersions", () => {
  it("compares dotted versions numerically", () => {
    expect(compareVersions("1.10", "1.9")).toBeGreaterThan(0);
    expect(compareVersions("1.1.0", "1.0")).toBeGreaterThan(0);
    expect(compareVersions("1.0", "1.0.0")).toBe(0);
    expect(compareVersions("1.0", "2.0")).toBeLessThan(0);
  });
});

describe("upsertSystemTemplate", () => {
  it("creates a missing row", async () => {
    findUnique.mockResolvedValue(null);
    expect(await upsertSystemTemplate(prisma, "system-tia-template", TIA)).toBe("created");
    expect(create).toHaveBeenCalledWith({ data: { id: "system-tia-template", ...TIA } });
    expect(update).not.toHaveBeenCalled();
  });

  it("updates an existing system row at an older or equal version", async () => {
    findUnique.mockResolvedValue({ version: "1.0", isSystem: true, organizationId: null });
    expect(await upsertSystemTemplate(prisma, "system-tia-template", TIA)).toBe("updated");
    expect(update).toHaveBeenCalledWith({ where: { id: "system-tia-template" }, data: TIA });
  });

  it("keeps a newer installed version", async () => {
    findUnique.mockResolvedValue({ version: "1.1.0", isSystem: true, organizationId: null });
    expect(await upsertSystemTemplate(prisma, "system-tia-template", TIA)).toBe("kept-newer");
    expect(update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("never touches a row that belongs to an organization", async () => {
    findUnique.mockResolvedValue({ version: "0.1", isSystem: false, organizationId: "org-1" });
    expect(await upsertSystemTemplate(prisma, "system-tia-template", TIA)).toBe("not-system");
    expect(update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});

describe("upsertSystemQuestionnaire", () => {
  it("does not downgrade the 2.0 questionnaire to an older seed copy", async () => {
    findUnique.mockResolvedValue({ version: "2.0", isSystem: true, organizationId: null });
    const v1 = { name: "Standard", version: "1.0", isSystem: true, isActive: true, sections: [] };
    expect(await upsertSystemQuestionnaire(prisma, "system-vendor-questionnaire", v1)).toBe(
      "kept-newer"
    );
    expect(update).not.toHaveBeenCalled();
  });
});
