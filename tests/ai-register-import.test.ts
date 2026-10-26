// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * AI-assisted register import (src/server/services/portability/ai-import.ts
 * and POST /api/portability/register with ai=1 / aiAccepted): suggestions
 * are held to the closed lists, only the cells that need it are sent, the
 * cost is capped, and nothing is applied until the person accepts and
 * imports. chatComplete is a mock: no network.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { memoryDb, type MemoryDb } from "./helpers/memory-db";
import { seedGlobals, TARGET_ORG } from "./helpers/programme-fixture";

const state = vi.hoisted(() => ({
  db: null as unknown as MemoryDb,
  email: null as string | null,
  chat: [] as Array<{ system: string; user: string; json?: { name: string; schema: unknown } }>,
  replies: [] as Array<string | null>,
  gate: "ok" as "ok" | "ai_not_configured" | "ai_off",
  generations: 0,
  recorded: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/server/services/ai/llm-door", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/services/ai/llm-door")>()),
  chatComplete: vi.fn(async (params: { system: string; user: string; json?: { name: string; schema: unknown } }) => {
    state.chat.push(params);
    const content = state.replies.shift() ?? null;
    return content === null ? null : { content, model: "test-model", usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }, durationMs: 3 };
  }),
}));
vi.mock("@/server/services/ai/posture", async (importOriginal) => {
  const { TRPCError } = await import("@trpc/server");
  return {
    ...(await importOriginal<typeof import("@/server/services/ai/posture")>()),
    requireAiEngine: vi.fn(async () => {
      if (state.gate !== "ok") throw new TRPCError({ code: "PRECONDITION_FAILED", message: state.gate });
      return { settings: { posture: "cloud_us" }, engine: { kind: "anthropic", baseUrl: null, apiKey: "sk-ant-test-key", model: "m", label: "Anthropic (m)" } };
    }),
    assertAiRateLimit: vi.fn(async () => {
      if (state.generations >= 30) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "ai_rate_limited" });
    }),
    recordGeneration: vi.fn(async (_db: unknown, input: Record<string, unknown>) => {
      state.generations++;
      state.recorded.push(input);
      return { id: `g-${state.generations}` };
    }),
  };
});
vi.mock("@/lib/prisma", () => {
  const proxy = new Proxy(
    {},
    {
      get: (_t, prop: string) => {
        const db = state.db as unknown as Record<string, unknown>;
        if (prop === "organizationMember") {
          return {
            ...(db.organizationMember as Record<string, unknown>),
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

import { POST as importRegister } from "@/app/api/portability/register/route";
import {
  acceptedOverrides,
  AI_IMPORT_MAX_ROWS,
  classifyImport,
  cellsToClassify,
  parseJson,
} from "@/server/services/portability/ai-import";
import { catalogueIndex, csvImporter, suggestMapping, tableToProgramme } from "@/server/services/portability/csv-import";

const enc = (s: string) => new TextEncoder().encode(s);
const catalogue = catalogueIndex([
  { slug: "slack", name: "Slack" },
  { slug: "google-workspace", name: "Google Workspace" },
]);

beforeEach(() => {
  state.db = memoryDb();
  seedGlobals(state.db);
  state.db.insert("organization", { id: TARGET_ORG, name: "Target", slug: "target" });
  state.db.insert("user", { id: "u-owner", email: "importer@example.test" });
  state.db.insert("organizationMember", { id: "m-owner", organizationId: TARGET_ORG, userId: "u-owner", role: "OWNER" });
  state.db.insert("vendorCatalog", { id: "c1", slug: "slack", name: "Slack" });
  state.db.insert("vendorCatalog", { id: "c2", slug: "google-workspace", name: "Google Workspace" });
  state.email = "importer@example.test";
  state.chat = [];
  state.replies = [];
  state.gate = "ok";
  state.generations = 0;
  state.recorded = [];
});

const ctx = () => ({
  prisma: {} as never,
  organizationId: TARGET_ORG,
  userId: "u-owner",
  posture: "cloud_us" as const,
  engine: null,
});

const RAT = [
  "Name,Legal basis,Data subjects,Purpose,Keeping period,Tools,Private notes",
  "Payroll,Contract,staff and freelancers,pay people,five years after leaving,Slack; GSuite,SECRET-NOTE-1",
  "Newsletter,whatever we agreed,people who signed up,send news,until they unsubscribe,,SECRET-NOTE-2",
].join("\n");

describe("classifyImport: suggestions held to the lists", () => {
  it("proposes a field for an unmatched column and drops anything outside the allowed fields", async () => {
    const table = csvImporter.read(enc("Name,Legal basis,Who,Comments\nPayroll,Contract,staff,x\n"));
    const mapping = suggestMapping("processingActivities", table.headers);
    expect(mapping).toEqual(["name", "legalBasis", null, null]);
    state.replies = [
      JSON.stringify({ columns: [{ column: 2, field: "dataSubjects" }, { column: 3, field: "dataSubjects" }, { column: 0, field: "purpose" }, { column: 3, field: "passwords" }] }),
      JSON.stringify({ rows: [] }),
    ];
    const plain = tableToProgramme("processingActivities", table, mapping);
    const result = await classifyImport(ctx(), { register: "processingActivities", table, mapping, problems: plain.problems, notes: plain.notes, catalogue });
    expect(result.mapping).toEqual([{ column: 2, field: "dataSubjects" }]);
    // The column request carries headers and samples of unmatched columns only.
    expect(state.chat[0]!.user).toContain('"header":"Who"');
    expect(state.chat[0]!.user).not.toContain("Payroll");
    expect(state.chat[0]!.json?.name).toBe("column_matches");
  });

  it("keeps only allowed codes, countries, days and catalogue names; sends only the cells that need it", async () => {
    const table = csvImporter.read(enc(RAT));
    const mapping = suggestMapping("processingActivities", table.headers);
    expect(mapping).toEqual(["name", "legalBasis", "dataSubjects", "purpose", "retentionPeriod", "vendorNames", null]);
    const plain = tableToProgramme("processingActivities", table, mapping, new Date(), catalogue);
    state.replies = [
      // No unmatched field fits "Private notes": the model says null.
      JSON.stringify({ columns: [{ column: 6, field: null }] }),
      JSON.stringify({
        rows: [
          {
            row: 2,
            dataSubjects: ["EMPLOYEES", "CONTRACTORS", "ALIENS"],
            purposeCategory: "PAYROLL",
            retentionDays: 1825,
            vendorNames: [{ text: "GSuite", name: "Google Workspace" }, { text: "Slack", name: "Slack" }],
          },
          { row: 3, legalBasis: "BANANA", dataSubjects: ["SUBSCRIBERS"], retentionDays: 99999, purposeCategory: "WORLD_DOMINATION" },
          { row: 99, dataSubjects: ["CUSTOMERS"] },
        ],
      }),
    ];
    const result = await classifyImport(ctx(), { register: "processingActivities", table, mapping, problems: plain.problems, notes: plain.notes, catalogue });

    const by = (row: number, field: string) => result.cells.find((c) => c.row === row && c.field === field);
    expect(by(2, "dataSubjects")?.value).toEqual(["EMPLOYEES", "CONTRACTORS"]);
    expect(by(2, "purposeCategory")?.value).toBe("PAYROLL");
    expect(by(2, "retentionDays")?.value).toBe(1825);
    // Only the name not already linked was sent; "Slack" was matched without AI.
    expect(by(2, "vendorNames")?.value).toEqual(["GSuite\u0000google-workspace"]);
    expect(by(3, "legalBasis")).toBeUndefined();
    expect(by(3, "retentionDays")).toBeUndefined();
    expect(by(3, "purposeCategory")).toBeUndefined();
    expect(by(3, "dataSubjects")?.es).toBe("Suscriptores");
    expect(result.cells.some((c) => c.row === 99)).toBe(false);

    // What was sent: mapped cells only, never the unmapped column, ids or other data.
    const rowsCall = state.chat[1]!;
    expect(rowsCall.user).not.toContain("SECRET-NOTE");
    expect(rowsCall.user).toContain("five years after leaving");
    expect(rowsCall.json?.name).toBe("classified_rows");
    // The schema lists the allowed codes (structured output).
    expect(JSON.stringify(rowsCall.json?.schema)).toContain('"EMPLOYEES"');
    // Each call is recorded without text.
    expect(state.recorded).toHaveLength(2);
    expect(state.recorded[0]).toMatchObject({ feature: "import_classification", organizationId: TARGET_ORG, status: "ok" });
    expect(JSON.stringify(state.recorded)).not.toContain("staff");
  });

  it("caps the rows sent, in batches, and says how many were left", async () => {
    const lines = ["Name,Legal basis,Data subjects"];
    for (let i = 0; i < AI_IMPORT_MAX_ROWS + 30; i++) lines.push(`Activity ${i},Contract,people number ${i}`);
    const table = csvImporter.read(enc(lines.join("\n")));
    const mapping = suggestMapping("processingActivities", table.headers);
    const plain = tableToProgramme("processingActivities", table, mapping);
    expect(cellsToClassify("processingActivities", table, mapping, plain.problems, plain.notes)).toHaveLength(AI_IMPORT_MAX_ROWS + 30);
    state.replies = Array(10).fill(JSON.stringify({ rows: [] }));
    const result = await classifyImport(ctx(), { register: "processingActivities", table, mapping, problems: plain.problems, notes: plain.notes });
    expect(result.rowsSent).toBe(AI_IMPORT_MAX_ROWS);
    expect(result.rowsNotSent).toBe(30);
    expect(state.chat).toHaveLength(4);
    expect(state.chat.at(-1)!.user).not.toContain("people number 100");
  });

  it("stops at the hourly limit without calling the engine again", async () => {
    state.generations = 30;
    const table = csvImporter.read(enc(RAT));
    const mapping = suggestMapping("processingActivities", table.headers);
    const result = await classifyImport(ctx(), { register: "processingActivities", table, mapping, problems: [], notes: [] });
    expect(result.rateLimited).toBe(true);
    expect(state.chat).toHaveLength(0);
  });

  it("reads JSON in a fenced block, and nothing from prose", () => {
    expect(parseJson('```json\n{"rows":[]}\n```')).toEqual({ rows: [] });
    expect(parseJson("I cannot help")).toBeNull();
  });
});

describe("acceptedOverrides: checked again before use", () => {
  it("drops values outside the lists, unknown fields, unmapped sources and names not in the cell", () => {
    const table = csvImporter.read(enc(RAT));
    const mapping = suggestMapping("processingActivities", table.headers);
    const overrides = acceptedOverrides(
      "processingActivities",
      mapping,
      [
        { row: 2, field: "dataSubjects", value: ["EMPLOYEES", "HACKERS"] },
        { row: 2, field: "categories", value: ["HEALTH"] }, // categories is not mapped
        { row: 2, field: "notAField", value: "x" },
        { row: 3, field: "legalBasis", value: "CONSENT" },
        { row: 3, field: "retentionDays", value: -5 },
        { row: 2, field: "vendorNames", value: ["GSuite\u0000google-workspace", "Zoom\u0000slack", "GSuite\u0000not-a-slug"] },
      ],
      "es",
      catalogue,
      table,
    );
    expect(overrides.get(2)?.fields).toEqual({ dataSubjects: ["Empleados"] });
    expect(overrides.get(2)?.meta?.vendorLinks).toEqual({ GSuite: "google-workspace" });
    expect(overrides.get(3)?.fields).toEqual({ legalBasis: "CONSENT" });
    expect(overrides.get(3)?.meta?.aiSuggested).toEqual(["legalBasis"]);
  });
});

function form(fields: Record<string, string>, csv: string) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  f.set("file", new File([csv], "ropa.csv"));
  return new Request("http://localhost/api/portability/register", { method: "POST", body: f });
}

describe("POST /api/portability/register with AI", () => {
  const base = { organizationId: TARGET_ORG, register: "processingActivities", locale: "en" };

  it("without AI, says so in one hint and works as before", async () => {
    state.gate = "ai_not_configured";
    const res = await importRegister(form({ ...base, step: "check", ai: "1" }, RAT));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ai).toMatchObject({ available: false, code: "ai_not_configured", settingsPath: "/privacy/settings#ai-inference-key" });
    expect(body.ai.result).toBeUndefined();
    expect(state.chat).toHaveLength(0);
    expect(body.summary.registers.processingActivity.toCreate).toBe(1);
  });

  it("suggests on check, applies nothing until the person accepts and imports", async () => {
    state.replies = [
      JSON.stringify({ columns: [{ column: 6, field: null }] }),
      JSON.stringify({ rows: [{ row: 3, legalBasis: "CONSENT", dataSubjects: ["SUBSCRIBERS"] }] }),
    ];
    const check = await importRegister(form({ ...base, step: "check", ai: "1" }, RAT));
    const body = await check.json();
    expect(body.ai.available).toBe(true);
    const suggestions = body.ai.result.cells as Array<{ row: number; field: string; value: unknown }>;
    expect(suggestions.find((c) => c.row === 3 && c.field === "legalBasis")?.value).toBe("CONSENT");
    // The check counts the file as written: row 3 has no legal basis it can read.
    expect(body.summary.registers.processingActivity.toCreate).toBe(1);
    expect(state.db.table("processingActivity")).toHaveLength(0);

    // Import without accepting: as written.
    const plain = await importRegister(form({ ...base, step: "import" }, RAT));
    expect((await plain.json()).created).toBe(1);
    expect(state.db.table("processingActivity").map((a) => a.name)).toEqual(["Payroll"]);

    // Import with the accepted suggestions: row 3 arrives too, as a draft, marked.
    const accepted = suggestions.filter((c) => c.row === 3).map(({ row, field, value }) => ({ row, field, value }));
    const done = await importRegister(form({ ...base, step: "import", aiAccepted: JSON.stringify(accepted) }, RAT));
    expect(done.status).toBe(200);
    const newsletter = state.db.table("processingActivity").find((a) => a.name === "Newsletter")!;
    expect(newsletter).toMatchObject({ legalBasis: "CONSENT", dataSubjects: ["Subscribers"], provenance: "IMPORTED", confirmedAt: null });
    expect((newsletter.metadata as { aiSuggested: string[] }).aiSuggested.sort()).toEqual(["dataSubjects", "legalBasis"]);
    // No more engine calls at import.
    expect(state.chat).toHaveLength(2);
  });
});
