/**
 * The hosted pilot's promise, in one suite: a firm can ALWAYS read and
 * export what it holds. Neither a records ceiling nor the end of the 90-day
 * editing window ever refuses a read or an export. (The other halves, the
 * refusals themselves, are in pilot-caps.test.ts and pilot-dpia-cap.test.ts.)
 *
 * The real middleware chain of every procedure in the app router runs over
 * a Prisma stand-in that reports every count at 10 000, so the firm is at
 * EVERY ceiling at once. The pilot gate runs before a procedure's input is
 * parsed and before its handler touches the database, so any answer other
 * than a pilot refusal proves the gate let the call through. The stand-in
 * stops each handler at its first database call, which keeps the run
 * hermetic.
 *
 * Locks, on the hosted pilot:
 *  - at every ceiling, before the window ends: every query and every
 *    non-create mutation passes the pilot gate (only creates are capped);
 *  - after the window, at every ceiling: every query passes, and so do the
 *    mutations listed as exports;
 *  - export routes are GET routes and never consult the pilot state; the
 *    full data export answers 200 to a member of a read-only firm at every
 *    ceiling;
 *  - on the self-hosted kit the gate never refuses anything.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const state = vi.hoisted(() => ({
  organization: null as null | Record<string, unknown>,
  exportRows: false,
}));

/**
 * Prisma stand-in. What the gate needs answers (membership, counts, the
 * first-sign-in update); anything else means the handler was reached, and
 * throws. With exportRows, reads answer so the export route can finish.
 */
const prisma = vi.hoisted(() => {
  const model = (name: string) =>
    new Proxy(
      {},
      {
        get: (_t, method: string) => async (args?: { where?: Record<string, unknown> }) => {
          // Every count at 10 000: the firm is at every records ceiling at once.
          if (method === "count") return 10_000;
          if (name === "organizationMember" && (method === "findUnique" || method === "findFirst")) {
            return {
              id: "member-1",
              userId: "user-1",
              organizationId: "org-1",
              role: "OWNER",
              organization: state.organization,
            };
          }
          if (name === "organization" && method === "updateMany") return { count: 0 };
          if (state.exportRows) {
            if (method === "findMany") return [];
            if (method === "findUnique" || method === "findFirst") return state.organization;
          }
          void args;
          throw new Error("handler reached (test stand-in)");
        },
      }
    );
  return new Proxy(
    {},
    {
      get: (_t, name: string) => {
        if (name === "$transaction") {
          return async () => {
            throw new Error("handler reached (test stand-in)");
          };
        }
        if (name === "then") return undefined;
        return model(name);
      },
    }
  );
});

const getToken = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ default: prisma, prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next-auth/jwt", () => ({ getToken }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { appRouter } from "@/server/routers";
import { createInnerTRPCContext } from "@/server/trpc";
import {
  CAPPED_CREATE_PATHS,
  PILOT_CLOCK_START,
  PILOT_DAYS,
  READ_ONLY_ALLOWED_PATHS,
} from "@/server/services/pilot/caps";
import { GET as exportOrganizationData } from "@/app/api/export/organization-data/route";
import { sessionFor } from "./helpers";

const DAY = 24 * 60 * 60 * 1000;
const STARTED = new Date(PILOT_CLOCK_START.getTime() + 10 * DAY);

type Procedures = Record<string, { _def: { type: "query" | "mutation" | "subscription" } }>;
const procedures = (appRouter as unknown as { _def: { procedures: Procedures } })._def.procedures;
const paths = Object.keys(procedures).sort();
const queries = paths.filter((p) => procedures[p]._def.type === "query");
const mutations = paths.filter((p) => procedures[p]._def.type === "mutation");

function isPilotRefusal(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return e?.code === "FORBIDDEN" && /pilot/i.test(e.message ?? "");
}

/** Calls a procedure by path; returns the pilot refusal, or null if the gate let it through. */
async function gateAnswer(procedurePath: string): Promise<string | null> {
  const caller = appRouter.createCaller(
    createInnerTRPCContext({ session: sessionFor("user-1"), getCookie: () => undefined })
  ) as unknown as Record<string, unknown>;
  const fn = procedurePath.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], caller);
  try {
    await (fn as (input: unknown) => Promise<unknown>)({ organizationId: "org-1" });
    return null;
  } catch (err) {
    return isPilotRefusal(err) ? (err as Error).message : null;
  }
}

/** Any FORBIDDEN / UNAUTHORIZED answer at all, pilot or not. */
async function anyRefusal(procedurePath: string): Promise<boolean> {
  const caller = appRouter.createCaller(
    createInnerTRPCContext({ session: sessionFor("user-1"), getCookie: () => undefined })
  ) as unknown as Record<string, unknown>;
  const fn = procedurePath.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], caller);
  try {
    await (fn as (input: unknown) => Promise<unknown>)({ organizationId: "org-1" });
    return false;
  } catch (err) {
    const code = (err as { code?: string }).code;
    return code === "FORBIDDEN" || code === "UNAUTHORIZED";
  }
}

async function refusedAmong(list: string[]): Promise<string[]> {
  const refused: string[] = [];
  for (const p of list) if (await gateAnswer(p)) refused.push(p);
  return refused;
}

function firmAtEveryCeiling(daysIntoPilot: number) {
  vi.setSystemTime(new Date(STARTED.getTime() + daysIntoPilot * DAY));
  state.organization = {
    id: "org-1",
    name: "Firm",
    slug: "firm",
    createdAt: STARTED,
    pilotStartedAt: STARTED,
    domain: null,
    settings: null,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.stubEnv("VERCEL_ENV", "production");
  state.exportRows = false;
  getToken.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("the app router, as the suite sees it", () => {
  it("has queries and mutations to check, and every capped path is a mutation", () => {
    expect(queries.length).toBeGreaterThan(50);
    expect(mutations.length).toBeGreaterThan(50);
    for (const p of Object.keys(CAPPED_CREATE_PATHS)) expect(procedures[p]?._def.type, p).toBe("mutation");
    for (const p of READ_ONLY_ALLOWED_PATHS) expect(procedures[p]?._def.type, p).toBe("mutation");
  });

  it("recognises a pilot refusal (the setup really is at every ceiling and read-only)", async () => {
    firmAtEveryCeiling(10);
    expect(await gateAnswer("vendor.create")).toMatch(/pilot limit/);
    firmAtEveryCeiling(PILOT_DAYS + 1);
    expect(await gateAnswer("vendor.update")).toMatch(/read-only/);
  });
});

describe("at every records ceiling, inside the 90 days", () => {
  it("every query passes the pilot gate", async () => {
    firmAtEveryCeiling(10);
    expect(await refusedAmong(queries)).toEqual([]);
  });

  it("every mutation that does not create a capped record passes too", async () => {
    firmAtEveryCeiling(10);
    const notCapped = mutations.filter((p) => !(p in CAPPED_CREATE_PATHS));
    expect(await refusedAmong(notCapped)).toEqual([]);
  });
});

describe("after the 90 days, at every records ceiling", () => {
  it("every query still passes the pilot gate: the clock never locks out reading", async () => {
    firmAtEveryCeiling(PILOT_DAYS + 365);
    expect(await refusedAmong(queries)).toEqual([]);
  });

  it("no query is refused for any reason (the owner reaches every read; platform admin aside)", async () => {
    firmAtEveryCeiling(PILOT_DAYS + 365);
    const refused: string[] = [];
    for (const p of queries.filter((q) => !q.startsWith("platformAdmin."))) {
      if (await anyRefusal(p)) refused.push(p);
    }
    expect(refused).toEqual([]);
  });

  it("the mutations that are exports still pass", async () => {
    firmAtEveryCeiling(PILOT_DAYS + 1);
    expect(await refusedAmong([...READ_ONLY_ALLOWED_PATHS])).toEqual([]);
  });
});

describe("exports", () => {
  const exportDir = path.join(__dirname, "..", "src", "app", "api", "export");
  const routes = (function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((n) => {
      const full = path.join(dir, n);
      return statSync(full).isDirectory() ? walk(full) : n === "route.ts" ? [full] : [];
    });
  })(exportDir);

  it("are GET routes that never consult the pilot state", () => {
    expect(routes.length).toBeGreaterThanOrEqual(10);
    for (const file of routes) {
      const src = readFileSync(file, "utf-8");
      expect(src, file).toMatch(/export async function GET/);
      expect(src, file).not.toMatch(/export async function (POST|PUT|PATCH|DELETE)/);
      expect(src, file).not.toMatch(/assertPilotWritable|isPilotReadOnly|assertPilotCapacity|pilot\/caps/);
    }
  });

  it("the full data export answers 200 to a member of a read-only firm at every ceiling", async () => {
    firmAtEveryCeiling(PILOT_DAYS + 365);
    state.exportRows = true;
    getToken.mockResolvedValue({ email: "user-1@test.example" });
    const res = await exportOrganizationData(
      new Request("http://localhost/api/export/organization-data?organizationId=org-1")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.organization.id).toBe("org-1");
  });
});

describe("the self-hosted kit", () => {
  it("never refuses anything at the pilot gate, however old or full", async () => {
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("AUTH_COOKIE_DOMAIN", "");
    firmAtEveryCeiling(PILOT_DAYS * 10);
    expect(await refusedAmong(paths)).toEqual([]);
  });
});
