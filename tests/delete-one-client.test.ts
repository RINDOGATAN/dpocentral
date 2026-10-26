// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Deleting one client organisation ("All clients" row menu, and Settings):
 *  - only an owner of that organisation may delete it (the role is read in
 *    the organisation named by the input, not the one open);
 *  - only that organisation goes: the person's other organisations and the
 *    rest of the billing group stay;
 *  - on the hosted service the paid plan belongs to the billing group: one
 *    organisation of a group with others may go (the plan carries on), the
 *    group's last one may not while the plan runs, and an organisation with
 *    the rights-request upgrade active may not;
 *  - after deleting the organisation that was open, the app switches to
 *    another remaining one;
 *  - the copy names what is deleted and points to "All clients".
 *
 * Prisma is module-mocked with a small in-memory store.
 */

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

type Org = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  billingOwnerId: string | null;
  dsarModuleStatus: string | null;
  pilotStartedAt: Date | null;
};
type Member = { organizationId: string; userId: string; role: string };

const store = vi.hoisted(() => ({
  orgs: new Map<string, Org>(),
  members: [] as Member[],
  audit: [] as { organizationId: string | null; action: string; entityId: string }[],
}));

const mocks = vi.hoisted(() => {
  const tx = {
    organization: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => store.orgs.get(where.id) ?? null),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        store.orgs.delete(where.id);
        store.members = store.members.filter((m) => m.organizationId !== where.id);
        return { id: where.id };
      }),
    },
    assessment: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    assessmentTemplate: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    vendor: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    vendorQuestionnaire: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    auditLog: {
      deleteMany: vi.fn(async () => ({ count: 0 })),
      create: vi.fn(async ({ data }: { data: { organizationId: string | null; action: string; entityId: string } }) => {
        store.audit.push(data);
        return data;
      }),
    },
  };
  const prisma = {
    organizationMember: {
      findUnique: vi.fn(
        async ({ where }: { where: { organizationId_userId: { organizationId: string; userId: string } } }) => {
          const { organizationId, userId } = where.organizationId_userId;
          const m = store.members.find((x) => x.organizationId === organizationId && x.userId === userId);
          const organization = store.orgs.get(organizationId);
          return m && organization ? { id: `${organizationId}-${userId}`, ...m, organization } : null;
        }
      ),
    },
    organization: {
      // The pilot clock's first sign-in (enforcePilotCaps); nothing to record here.
      updateMany: vi.fn(async () => ({ count: 0 })),
      count: vi.fn(
        async ({ where }: { where: { billingOwnerId: string; id: { not: string } } }) =>
          [...store.orgs.values()].filter((o) => o.billingOwnerId === where.billingOwnerId && o.id !== where.id.not)
            .length
      ),
    },
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  return { prisma, tx };
});

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import en from "@/messages/en.json";
import es from "@/messages/es.json";
import {
  organizationDeletionRouter,
  deletionBlockedReason,
} from "@/server/routers/privacy/organizationDeletion";
import { ORGANIZATION_DELETED } from "@/server/services/organization/delete";
import { organizationAfterDeletion } from "@/lib/organization-after-deletion";
import { localizeServerMessage } from "@/lib/server-error-messages";
import { BUSINESS_NEEDS_ONE_ORGANIZATION } from "@/server/routers/privacy/user";
import { callerFor, sessionFor } from "./helpers";

const CONSULTANT = "user-consultant";
const COLLEAGUE = "user-colleague";

function org(id: string, name: string, over: Partial<Org> = {}): Org {
  return {
    id,
    name,
    slug: id,
    plan: "PILOT",
    billingOwnerId: CONSULTANT,
    dsarModuleStatus: null,
    pilotStartedAt: null,
    ...over,
  };
}

function seed(orgs: Org[], members: Member[]) {
  store.orgs = new Map(orgs.map((o) => [o.id, o]));
  store.members = members;
  store.audit = [];
}

const as = (userId: string) =>
  callerFor(organizationDeletionRouter, sessionFor(userId)) as ReturnType<
    typeof organizationDeletionRouter.createCaller
  >;

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("AUTH_COOKIE_DOMAIN", "");
  // A consultant who owns three clients; a colleague who is an admin of one.
  seed(
    [org("org-a", "Alpha Ltd"), org("org-b", "Bravo SL"), org("org-c", "Charlie Inc")],
    [
      { organizationId: "org-a", userId: CONSULTANT, role: "OWNER" },
      { organizationId: "org-b", userId: CONSULTANT, role: "OWNER" },
      { organizationId: "org-c", userId: CONSULTANT, role: "OWNER" },
      { organizationId: "org-b", userId: COLLEAGUE, role: "ADMIN" },
    ]
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("who may delete a client", () => {
  it("refuses a member who is not an owner of that client, and deletes nothing", async () => {
    await expect(as(COLLEAGUE).delete({ organizationId: "org-b", confirmName: "Bravo SL" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(as(COLLEAGUE).status({ organizationId: "org-b" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect(store.orgs.has("org-b")).toBe(true);
  });

  it("refuses a person who is not a member of that client at all", async () => {
    await expect(as(COLLEAGUE).delete({ organizationId: "org-a", confirmName: "Alpha Ltd" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(store.orgs.has("org-a")).toBe(true);
  });

  it("needs the client's exact name", async () => {
    await expect(as(CONSULTANT).delete({ organizationId: "org-b", confirmName: "bravo sl" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(store.orgs.has("org-b")).toBe(true);
  });
});

describe("deleting one client", () => {
  it("deletes only that organisation and leaves the others intact", async () => {
    await expect(as(CONSULTANT).delete({ organizationId: "org-b", confirmName: " Bravo SL " })).resolves.toEqual({
      deleted: true,
    });
    expect([...store.orgs.keys()].sort()).toEqual(["org-a", "org-c"]);
    expect(store.members.filter((m) => m.userId === CONSULTANT).map((m) => m.organizationId).sort()).toEqual([
      "org-a",
      "org-c",
    ]);
    // Every explicit delete was scoped to the deleted organisation.
    for (const model of ["assessment", "assessmentTemplate", "vendor", "vendorQuestionnaire", "auditLog"] as const) {
      for (const [args] of mocks.tx[model].deleteMany.mock.calls as unknown as [{ where: { organizationId: string } }][]) {
        expect(args.where.organizationId).toBe("org-b");
      }
    }
    expect(mocks.tx.organization.delete).toHaveBeenCalledTimes(1);
    expect(mocks.tx.organization.delete).toHaveBeenCalledWith({ where: { id: "org-b" } });
    // One audit entry, outside any organisation, naming who asked.
    expect(store.audit).toEqual([
      expect.objectContaining({ organizationId: null, action: ORGANIZATION_DELETED, entityId: "org-b", userId: CONSULTANT }),
    ]);
  });
});

describe("the paid plan belongs to the billing group (hosted)", () => {
  beforeEach(() => {
    vi.stubEnv("VERCEL_ENV", "production");
  });

  it("lets one client of a paid group go while others remain; the plan carries on", async () => {
    for (const o of store.orgs.values()) o.plan = "EU_CLOUD";
    await expect(as(CONSULTANT).status({ organizationId: "org-b" })).resolves.toMatchObject({
      canDelete: true,
      reason: null,
      hosted: true,
      planContinues: true,
    });
    await as(CONSULTANT).delete({ organizationId: "org-b", confirmName: "Bravo SL" });
    expect(store.orgs.get("org-a")?.plan).toBe("EU_CLOUD");
    expect(store.orgs.get("org-c")?.plan).toBe("EU_CLOUD");
  });

  it("keeps the group's last organisation while the plan runs", async () => {
    seed([org("org-a", "Alpha Ltd", { plan: "EU_CLOUD" })], [{ organizationId: "org-a", userId: CONSULTANT, role: "OWNER" }]);
    await expect(as(CONSULTANT).status({ organizationId: "org-a" })).resolves.toMatchObject({
      canDelete: false,
      reason: "paid-plan",
    });
    await expect(as(CONSULTANT).delete({ organizationId: "org-a", confirmName: "Alpha Ltd" })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(store.orgs.has("org-a")).toBe(true);
  });

  it("keeps an organisation whose rights-request upgrade is active", async () => {
    store.orgs.get("org-b")!.dsarModuleStatus = "ACTIVE";
    await expect(as(CONSULTANT).delete({ organizationId: "org-b", confirmName: "Bravo SL" })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(store.orgs.has("org-b")).toBe(true);
  });

  it("decides from the plan, the upgrade and the rest of the group; the kit is never limited", () => {
    expect(deletionBlockedReason({ plan: "EU_CLOUD" }, true, 2)).toBeNull();
    expect(deletionBlockedReason({ plan: "EU_CLOUD" }, true, 0)).toBe("paid-plan");
    expect(deletionBlockedReason({ plan: "PILOT", dsarModuleStatus: "ACTIVE" }, true, 0)).toBe("dsar-module");
    expect(deletionBlockedReason({ plan: "EU_CLOUD", dsarModuleStatus: "ACTIVE" }, false, 0)).toBeNull();
  });
});

describe("the organisation open after a deletion", () => {
  const orgs = [{ id: "org-a" }, { id: "org-b" }, { id: "org-c" }];

  it("keeps the open organisation when another one was deleted", () => {
    expect(organizationAfterDeletion(orgs, "org-b", "org-a")).toEqual({ kind: "keep" });
  });

  it("switches to a remaining organisation when the open one was deleted", () => {
    expect(organizationAfterDeletion(orgs, "org-a", "org-a")).toEqual({ kind: "switch", to: { id: "org-b" } });
    expect(organizationAfterDeletion(orgs, "org-b", null)).toEqual({ kind: "switch", to: { id: "org-a" } });
  });

  it("answers none when nothing remains", () => {
    expect(organizationAfterDeletion([{ id: "org-a" }], "org-a", "org-a")).toEqual({ kind: "none" });
  });
});

describe("the copy", () => {
  const all = (o: unknown): string => JSON.stringify(o);

  it("says Settings deletes only the organisation open now, and points to All clients", () => {
    expect(en.pages.settings.deleteOrganization.description).toContain("only the organization open now");
    expect(es.pages.settings.deleteOrganization.description).toContain("solo la organización abierta ahora");
    expect(en.pages.settings.deleteOrganization.otherClients).toContain("<link>All clients</link>");
    expect(es.pages.settings.deleteOrganization.otherClients).toContain("<link>Todos los clientes</link>");
  });

  it("links the business-account refusal to All clients", () => {
    expect(en.pages.settings.accountType.businessNeedsOneOrganization).toContain("<link>All clients</link>");
    expect(es.pages.settings.accountType.businessNeedsOneOrganization).toContain("<link>Todos los clientes</link>");
    expect(localizeServerMessage(BUSINESS_NEEDS_ONE_ORGANIZATION, "es")).toBe(
      es.serverErrors.exact.businessNeedsOneOrganization
    );
  });

  it("answers the deletion refusals in Spanish", () => {
    for (const key of ["orgDeletionPaidPlan", "orgDeletionDsarModule", "orgDeletionNameMismatch"] as const) {
      expect(localizeServerMessage(en.serverErrors.exact[key], "es")).toBe(es.serverErrors.exact[key]);
    }
  });

  it("offers both row actions in both languages, with tú and without long dashes", () => {
    expect(en.clientTemplate.titleNew).toBe("Create a new client from this one");
    expect(es.clientTemplate.titleNew).toBe("Crear un cliente nuevo a partir de este");
    expect(en.portfolio.menu.delete).toBe("Delete this client");
    expect(es.portfolio.menu.delete).toBe("Eliminar este cliente");
    const text = all([en.portfolio.delete, es.portfolio.delete, en.pages.settings.deleteOrganization, es.pages.settings.deleteOrganization]);
    expect(text).not.toMatch(/[—–]/);
    expect(all(es.portfolio.delete)).not.toMatch(/\busted\b/i);
  });
});
