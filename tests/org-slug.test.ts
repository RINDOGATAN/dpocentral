/**
 * The first-run screen derives the organisation slug from the name. The
 * smoke walk found that a second firm with the same name, a one-letter name
 * or a name without Latin letters could not get past it (a generic error).
 * availableSlug() now settles the slug on the server.
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ default: {}, prisma: {} }));

import { availableSlug } from "@/server/routers/privacy/organization";

function db(taken: string[]) {
  const set = new Set(taken);
  return {
    organization: {
      findUnique: vi.fn(async ({ where }: { where: { slug: string } }) =>
        set.has(where.slug) ? { id: "x" } : null
      ),
    },
  };
}

describe("availableSlug", () => {
  it("keeps a free slug as asked", async () => {
    expect(await availableSlug(db([]), "acme-corporation")).toBe("acme-corporation");
  });

  it("adds a short suffix when the slug is taken", async () => {
    const slug = await availableSlug(db(["acme"]), "acme");
    expect(slug).toMatch(/^acme-[a-f0-9]{5}$/);
  });

  it("turns a one-letter or empty slug into a valid one", async () => {
    expect(await availableSlug(db([]), "a")).toBe("a-org");
    expect(await availableSlug(db([]), "")).toBe("org");
    expect(await availableSlug(db([]), "--")).toBe("org");
  });

  it("stays within 50 characters of lowercase letters, digits and hyphens", async () => {
    const slug = await availableSlug(db(["x".repeat(44)]), "X".repeat(120));
    expect(slug.length).toBeLessThanOrEqual(50);
    expect(slug).toMatch(/^[a-z0-9-]+$/);
  });

  it("gives up with a message the person can act on", async () => {
    const always = { organization: { findUnique: vi.fn(async () => ({ id: "x" })) } };
    await expect(availableSlug(always, "acme")).rejects.toThrow(/different name/);
  });
});
