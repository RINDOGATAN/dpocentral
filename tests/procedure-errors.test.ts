/**
 * Honest failure (cycle 14, item 2): what a person reads when a procedure
 * fails. The real tRPC error formatter runs over HTTP (fetch adapter), with
 * the test-only failure probe behind E2E_FAILURE_PROBE.
 *
 * Locks:
 *  - an unexpected failure answers a sentence the person can act on and a
 *    reference; none of the raw text reaches the browser; the log carries
 *    the real error under the same reference;
 *  - the message follows the locale cookie (Spanish);
 *  - a TRPCError written for people keeps its message;
 *  - invalid input names the fields instead of the validator's JSON;
 *  - without the flag the probe does not exist.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

const logged = vi.hoisted(() => ({ errors: [] as { message: string; error: unknown }[] }));

vi.mock("@/lib/prisma", () => ({ default: {}, prisma: {} }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: (message: string, error: unknown) => logged.errors.push({ message, error }),
  },
}));

import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createInnerTRPCContext, createTRPCRouter, publicProcedure } from "@/server/trpc";
import { diagnosticsRouter } from "@/server/routers/diagnostics";
import { PROBE_FAILURE_TEXT } from "@/lib/failure-probe";

const router = createTRPCRouter({
  diagnostics: diagnosticsRouter,
  deliberate: publicProcedure.query(() => {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Assessment template is missing — it may have been deleted",
    });
  }),
  validated: publicProcedure
    .input(z.object({ name: z.string().min(1), email: z.string().email() }))
    .mutation(() => "ok"),
});

async function call(path: string, opts: { locale?: string; body?: unknown } = {}) {
  const url = `http://localhost/api/trpc/${path}`;
  const req = opts.body
    ? new Request(url, { method: "POST", body: JSON.stringify({ json: opts.body }), headers: { "content-type": "application/json" } })
    : new Request(url);
  const res = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router,
    createContext: () =>
      createInnerTRPCContext({
        session: null,
        getCookie: (name) => (name === "locale" ? opts.locale : undefined),
      }) as never,
  });
  const text = await res.text();
  return { status: res.status, text, body: JSON.parse(text) };
}

beforeEach(() => {
  logged.errors.length = 0;
});
afterEach(() => vi.unstubAllEnvs());

describe("an unexpected failure", () => {
  it("answers a sentence to act on and a reference, and nothing raw", async () => {
    vi.stubEnv("E2E_FAILURE_PROBE", "true");
    const { status, text, body } = await call("diagnostics.failureProbe");
    expect(status).toBe(500);
    const error = body.error.json;
    expect(error.message).toMatch(/^Something went wrong on our side/);
    expect(error.message).toMatch(/try again/);
    expect(error.data.reference).toMatch(/^E-[0-9A-F]{8}$/);
    expect(error.message).toContain(error.data.reference);
    for (const raw of ["ECONNRESET", "10.0.0.7", "probe.ts", "Deliberate"]) {
      expect(text).not.toContain(raw);
    }
    expect(error.data.stack).toBeUndefined();
  });

  it("speaks Spanish to a Spanish reader", async () => {
    vi.stubEnv("E2E_FAILURE_PROBE", "true");
    const { body } = await call("diagnostics.failureProbe", { locale: "es" });
    expect(body.error.json.message).toMatch(/^Algo ha fallado por nuestra parte/);
    expect(body.error.json.message).toContain(body.error.json.data.reference);
  });

  it("is logged with the real error under the same reference", async () => {
    vi.stubEnv("E2E_FAILURE_PROBE", "true");
    const { body } = await call("diagnostics.failureProbe");
    const reference = body.error.json.data.reference;
    expect(logged.errors).toHaveLength(1);
    expect(logged.errors[0].message).toContain(reference);
    expect(logged.errors[0].message).toContain("diagnostics.failureProbe");
    expect((logged.errors[0].error as Error).message).toBe(PROBE_FAILURE_TEXT);
  });
});

describe("messages written for people", () => {
  it("a deliberate TRPCError keeps its message and gets no reference", async () => {
    const { body } = await call("deliberate");
    expect(body.error.json.message).toBe("Assessment template is missing — it may have been deleted");
    expect(body.error.json.data.reference).toBeNull();
  });

  it("invalid input names the fields, not the validator's JSON", async () => {
    const { status, body } = await call("validated", { body: { name: "", email: "nope" } });
    expect(status).toBe(400);
    expect(body.error.json.message).toBe(
      "Some of the information entered is not valid (name, email). Please correct it and try again."
    );
  });
});

describe("the probe", () => {
  it("does not exist without the flag", async () => {
    const { status, body } = await call("diagnostics.failureProbe");
    expect(status).toBe(404);
    expect(logged.errors).toHaveLength(0);
    expect(body.error.json.data.reference).toBeNull();
  });
});
