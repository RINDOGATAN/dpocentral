// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The three portability routes, end to end over the in-memory database:
 *   GET  /api/export/programme
 *   POST /api/portability/programme
 *   POST /api/portability/register
 * Who may call them (owners and admins of the organisation, nobody else),
 * the separate box for rights requests, and the audit entries.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import AdmZip from "adm-zip";
import { memoryDb, type MemoryDb } from "./helpers/memory-db";
import { seedGlobals, seedProgramme, SOURCE_ORG, TARGET_ORG, REQUESTER_EMAIL } from "./helpers/programme-fixture";

const state = vi.hoisted(() => ({ db: null as unknown as MemoryDb, email: null as string | null }));

vi.mock("@/lib/prisma", () => {
  const proxy = new Proxy(
    {},
    {
      get: (_t, prop: string) => {
        const db = state.db as unknown as Record<string, unknown>;
        if (prop === "organizationMember") {
          const d = db.organizationMember as Record<string, unknown>;
          return {
            ...d,
            // The routes look the member up through the user's e-mail address.
            findFirst: async ({ where }: { where: { organizationId: string; user: { email: string } } }) => {
              const user = state.db.table("user").find((u) => u.email === where.user.email);
              const m = state.db.table("organizationMember").find((r) => r.organizationId === where.organizationId && r.userId === user?.id);
              if (!m) return null;
              return { ...m, organization: state.db.table("organization").find((o) => o.id === m.organizationId) };
            },
          };
        }
        return db[prop];
      },
    },
  );
  return { default: proxy, prisma: proxy };
});
vi.mock("@/lib/session-cookie", () => ({ getSessionToken: async () => (state.email ? { email: state.email } : null) }));
vi.mock("@/i18n/server-locale", () => ({ getCookieLocale: async () => null }));
vi.mock("@/server/services/program/document-facts", () => ({
  loadDocumentFacts: async () => {
    throw new Error("not in this test");
  },
}));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { GET as exportProgramme } from "@/app/api/export/programme/route";
import { POST as importProgramme } from "@/app/api/portability/programme/route";
import { POST as importRegister } from "@/app/api/portability/register/route";

let n = 0;
function as(role: string | null, org = SOURCE_ORG): string {
  const email = `person${++n}@example.test`;
  const id = `u-${n}`;
  state.db.insert("user", { id, email, name: `Person ${n}` });
  if (role) state.db.insert("organizationMember", { id: `m-${n}`, organizationId: org, userId: id, role });
  state.email = email;
  return id;
}

const get = (query: string) => exportProgramme(new Request(`http://localhost/api/export/programme?${query}`));

function form(fields: Record<string, string | Blob>, file?: { name: string; data: BlobPart }) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  if (file) f.set("file", new File([file.data], file.name));
  return new Request("http://localhost/api/portability/programme", { method: "POST", body: f });
}

beforeEach(() => {
  state.db = memoryDb();
  seedGlobals(state.db);
  seedProgramme(state.db, SOURCE_ORG, { prefix: "src" });
  state.db.insert("organization", { id: TARGET_ORG, name: "Target", slug: "target", pilotStartedAt: null });
});

describe("GET /api/export/programme", () => {
  it("refuses the signed-out, non-members, and members who are not owners or admins", async () => {
    state.email = null;
    expect((await get(`organizationId=${SOURCE_ORG}`)).status).toBe(401);
    as(null);
    expect((await get(`organizationId=${SOURCE_ORG}`)).status).toBe(403);
    for (const role of ["VIEWER", "MEMBER", "PRIVACY_OFFICER"]) {
      as(role);
      expect((await get(`organizationId=${SOURCE_ORG}`)).status, role).toBe(403);
    }
    as("ADMIN", TARGET_ORG);
    expect((await get(`organizationId=${SOURCE_ORG}`)).status).toBe(403);
  });

  it("streams the ZIP for an admin and records the export first", async () => {
    const userId = as("ADMIN");
    const res = await get(`organizationId=${SOURCE_ORG}&locale=es`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/zip");
    expect(res.headers.get("Content-Disposition")).toMatch(/^attachment; filename="Programme-Org-src-\d{4}-\d{2}-\d{2}\.zip"$/);
    const zip = new AdmZip(Buffer.from(await res.arrayBuffer()));
    const programme = JSON.parse(zip.getEntry("programme.json")!.getData().toString("utf8"));
    expect(programme.dataAssets).toHaveLength(3);
    // The documents' states could not be worked out: left out, the export still whole.
    expect(programme.documents).toEqual([]);
    expect(zip.getEntry("csv/systems.csv")!.getData().toString("utf8")).toContain("Nombre");
    const audit = state.db.table("auditLog").filter((r) => r.action === "EXPORT_PROGRAMME");
    expect(audit).toEqual([expect.objectContaining({ organizationId: SOURCE_ORG, userId, changes: expect.objectContaining({ rightsRequests: false }) })]);
  });

  it("adds rights requests only with the separate box ticked", async () => {
    as("OWNER");
    expect((await get(`organizationId=${SOURCE_ORG}&includeRightsRequests=1`)).status).toBe(400);
    as("OWNER");
    const res = await get(`organizationId=${SOURCE_ORG}&includeRightsRequests=1&acknowledgePersonalData=1`);
    expect(res.status).toBe(200);
    const zip = new AdmZip(Buffer.from(await res.arrayBuffer()));
    expect(zip.getEntry("programme.json")!.getData().toString("utf8")).toContain(REQUESTER_EMAIL);
    expect(state.db.table("auditLog").filter((r) => r.action === "EXPORT_PROGRAMME").at(-1)!.changes).toMatchObject({ rightsRequests: true });
  });
});

describe("POST /api/portability/programme", () => {
  async function exported(): Promise<ArrayBuffer> {
    as("OWNER");
    return (await get(`organizationId=${SOURCE_ORG}&includeRightsRequests=1&acknowledgePersonalData=1`)).arrayBuffer();
  }

  it("refuses members who are not owners or admins", async () => {
    const zip = await exported();
    for (const role of ["VIEWER", "MEMBER", "PRIVACY_OFFICER"]) {
      as(role, TARGET_ORG);
      const res = await importProgramme(form({ organizationId: TARGET_ORG, step: "check" }, { name: "p.zip", data: zip }));
      expect(res.status, role).toBe(403);
    }
  });

  it("checks, then imports as drafts, and records the import", async () => {
    const zip = await exported();
    const userId = as("ADMIN", TARGET_ORG);
    const check = await importProgramme(form({ organizationId: TARGET_ORG, step: "check" }, { name: "p.zip", data: zip }));
    expect(check.status).toBe(200);
    const body = await check.json();
    expect(body.summary.canImport).toBe(true);
    expect(state.db.table("dataAsset").filter((r) => r.organizationId === TARGET_ORG)).toHaveLength(0);

    const done = await importProgramme(form({ organizationId: TARGET_ORG, step: "import" }, { name: "p.zip", data: zip }));
    expect(done.status).toBe(200);
    expect((await done.json()).created).toBeGreaterThan(0);
    expect(state.db.table("dataAsset").filter((r) => r.organizationId === TARGET_ORG && r.provenance === "IMPORTED")).toHaveLength(3);
    expect(state.db.table("dSARRequest").filter((r) => r.organizationId === TARGET_ORG)).toHaveLength(0);
    expect(state.db.table("auditLog").filter((r) => r.action === "IMPORT_PROGRAMME")).toEqual([expect.objectContaining({ organizationId: TARGET_ORG, userId })]);
  });

  it("needs the separate box for rights requests, and refuses a file that is not a programme", async () => {
    const zip = await exported();
    as("OWNER", TARGET_ORG);
    const noAck = await importProgramme(form({ organizationId: TARGET_ORG, step: "import", includeRightsRequests: "1" }, { name: "p.zip", data: zip }));
    expect(noAck.status).toBe(400);
    const withAck = await importProgramme(
      form({ organizationId: TARGET_ORG, step: "import", includeRightsRequests: "1", acknowledgePersonalData: "1" }, { name: "p.zip", data: zip }),
    );
    expect(withAck.status).toBe(200);
    expect(state.db.table("dSARRequest").filter((r) => r.organizationId === TARGET_ORG)).toHaveLength(1);
    const bad = await importProgramme(form({ organizationId: TARGET_ORG, step: "check" }, { name: "p.json", data: '{"format":"other/1"}' }));
    expect(bad.status).toBe(422);
  });

  it("answers 409 with the reasons when the organisation is not empty", async () => {
    const zip = await exported();
    as("OWNER", TARGET_ORG);
    state.db.insert("vendor", { id: "own", organizationId: TARGET_ORG, name: "Ours", provenance: "USER_ENTERED" });
    const res = await importProgramme(form({ organizationId: TARGET_ORG, step: "import" }, { name: "p.zip", data: zip }));
    expect(res.status).toBe(409);
    expect((await res.json()).summary.problems[0].code).toBe("not_empty");
  });
});

describe("POST /api/portability/register", () => {
  const csv = "Supplier;Website;Criticality\nAcme;https://acme.example;Alto\n";

  it("refuses members who are not owners or admins", async () => {
    as("MEMBER", TARGET_ORG);
    const res = await importRegister(form({ organizationId: TARGET_ORG, register: "vendors", step: "check" }, { name: "v.csv", data: csv }));
    expect(res.status).toBe(403);
  });

  it("suggests the match, takes the person's own, and imports drafts", async () => {
    as("OWNER", TARGET_ORG);
    const check = await importRegister(form({ organizationId: TARGET_ORG, register: "vendors", step: "check" }, { name: "v.csv", data: csv }));
    expect(check.status).toBe(200);
    const body = await check.json();
    expect(body.columns.headers).toEqual(["Supplier", "Website", "Criticality"]);
    expect(body.columns.mapping).toEqual(["name", "website", "riskTier"]);
    expect(body.columns.fields.find((f: { key: string }) => f.key === "name")).toMatchObject({ required: true, es: "Nombre" });
    expect(body.summary.registers.vendor.toCreate).toBe(1);

    const done = await importRegister(
      form({ organizationId: TARGET_ORG, register: "vendors", step: "import", mapping: JSON.stringify(["name", null, "riskTier"]) }, { name: "v.csv", data: csv }),
    );
    expect(done.status).toBe(200);
    const vendor = state.db.table("vendor").find((v) => v.organizationId === TARGET_ORG)!;
    expect(vendor).toMatchObject({ name: "Acme", riskTier: "HIGH", website: null, provenance: "IMPORTED", confirmedAt: null });
    expect(state.db.table("auditLog").at(-1)).toMatchObject({ action: "IMPORT_REGISTER" });
  });

  it("names a file it cannot read yet", async () => {
    as("OWNER", TARGET_ORG);
    const res = await importRegister(form({ organizationId: TARGET_ORG, register: "vendors", step: "check" }, { name: "v.xml", data: "<x/>" }));
    expect(res.status).toBe(415);
  });
});
