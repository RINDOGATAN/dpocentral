/**
 * Cycle 12, F3: the public DSAR limit is matched on the DECODED procedure
 * name, in the place a tRPC request always reaches.
 *
 * Two holes are locked here:
 *  - tRPC decodes the path, so "/api/trpc/dsar%2EsubmitPublic" reaches
 *    dsar.submitPublic; matched on the raw path it was counted nowhere;
 *  - the middleware matcher skips every path with a dot, which is every
 *    plain tRPC path, so the limit has to live in the tRPC route handler.
 *
 * The real route handler runs; the router behind it is a stub that records
 * what got through.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const reached = vi.hoisted(() => ({ calls: [] as string[] }));

vi.mock("@trpc/server/adapters/fetch", () => ({
  fetchRequestHandler: async ({ req }: { req: Request }) => {
    reached.calls.push(new URL(req.url).pathname);
    return new Response("{}", { status: 200 });
  },
}));
vi.mock("next-intl/middleware", () => ({ default: () => () => new Response(null) }));
vi.mock("@/server/routers", () => ({ appRouter: {} }));
vi.mock("@/server/trpc", () => ({ createTRPCContext: vi.fn() }));

import { POST } from "@/app/api/trpc/[trpc]/route";
import { classifyRequest } from "@/lib/rate-limit-routes";
import { _resetRateLimitsForTests } from "@/lib/rate-limit";
import { config as middlewareConfig } from "@/middleware";
import { tryToParsePath } from "next/dist/lib/try-to-parse-path";

function post(path: string, ip = "203.0.113.7") {
  return POST(
    new Request(`http://localhost:3001${path}`, {
      method: "POST",
      headers: { "x-forwarded-for": ip },
    })
  ) as Promise<Response>;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-20T10:00:00Z"));
  _resetRateLimitsForTests();
  reached.calls.length = 0;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  _resetRateLimitsForTests();
});

describe("classifyRequest matches the decoded procedure name", () => {
  it.each([
    "/api/trpc/dsar.submitPublic",
    "/api/trpc/dsar%2EsubmitPublic",
    "/api/trpc/dsar%2esubmitPublic",
    "/api/trpc/%64sar.submitPublic",
    "/api/trpc/dsar.submit%50ublic",
    "/api/trpc/dsar.list%2Cdsar%2EwithdrawPublic",
  ])("%s is the public DSAR bucket", (path) => {
    expect(classifyRequest(path, "POST")).toBe("dsarPublic");
  });

  it("a tRPC path that cannot be decoded is counted, not let through", () => {
    expect(classifyRequest("/api/trpc/dsar%E0%A4%A", "POST")).toBe("dsarPublic");
  });

  it("an encoded sign-in path is still the magic-link bucket", () => {
    expect(classifyRequest("/api/auth/signin/%65mail", "POST")).toBe("magicLink");
  });

  it("authenticated tRPC stays unlimited here", () => {
    expect(classifyRequest("/api/trpc/dsar.list", "GET")).toBeNull();
  });
});

describe("the tRPC route handler applies the public DSAR limit", () => {
  it("a stranger's percent-encoded calls are refused after 5 in 10 minutes", async () => {
    for (let i = 0; i < 5; i++) {
      expect((await post("/api/trpc/dsar%2EsubmitPublic")).status).toBe(200);
    }
    const refused = await post("/api/trpc/dsar%2EsubmitPublic");
    expect(refused.status).toBe(429);
    expect(refused.headers.get("Retry-After")).toBe("600");
    expect(reached.calls).toHaveLength(5); // the sixth never reached the router
  });

  it("plain and encoded spellings share ONE bucket", async () => {
    await post("/api/trpc/dsar.submitPublic");
    await post("/api/trpc/dsar%2EsubmitPublic");
    await post("/api/trpc/%64sar.submitPublic");
    await post("/api/trpc/dsar.withdrawPublic");
    await post("/api/trpc/dsar%2EwithdrawPublic");
    expect((await post("/api/trpc/dsar.submitPublic")).status).toBe(429);
  });

  it("the legitimate call still works, and another address has its own allowance", async () => {
    expect((await post("/api/trpc/dsar.submitPublic")).status).toBe(200);
    for (let i = 0; i < 5; i++) await post("/api/trpc/dsar.submitPublic", "198.51.100.1");
    expect((await post("/api/trpc/dsar.submitPublic", "198.51.100.1")).status).toBe(429);
    expect((await post("/api/trpc/dsar.submitPublic")).status).toBe(200);
  });

  it("the window reopens after 10 minutes", async () => {
    for (let i = 0; i < 6; i++) await post("/api/trpc/dsar.submitPublic");
    vi.advanceTimersByTime(10 * 60 * 1000 + 1);
    expect((await post("/api/trpc/dsar.submitPublic")).status).toBe(200);
  });

  it("authenticated tRPC traffic is never counted", async () => {
    for (let i = 0; i < 50; i++) {
      expect((await post("/api/trpc/dsar.list")).status).toBe(200);
    }
  });
});

describe("why the limit cannot live in the middleware alone", () => {
  it("the middleware matcher skips every dotted tRPC path", () => {
    const parsed = tryToParsePath(middlewareConfig.matcher[0]);
    const matcher = new RegExp(parsed.regexStr!);
    expect(matcher.test("/api/trpc/dsar.submitPublic")).toBe(false);
    expect(matcher.test("/api/trpc/dsar%2EsubmitPublic")).toBe(true);
  });
});
