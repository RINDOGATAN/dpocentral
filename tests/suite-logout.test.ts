/**
 * Signing out must actually sign you out (src/lib/suite-logout.ts,
 * /api/auth/cross-logout, /api/auth/suite-logout).
 *
 * Locks the four rules the fix stands on:
 *   1. every session cookie name is expired twice, with the domain and with
 *      no domain at all;
 *   2. a request carrying a host-only cookie ends with an empty cookie jar;
 *   3. the walk visits each sibling once and returns to the sign-in page;
 *   4. a sibling that fails does not block the local sign-out.
 *
 * The jar below models the part of a browser that matters here: a cookie is
 * identified by name AND domain, and an expiry only removes the one it names.
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

import {
  SESSION_COOKIE_NAMES,
  SIGNED_OUT_PATH,
  parentCookieDomain,
  parseDeadline,
  parseStep,
  safeReturnTo,
  sessionCookieExpiries,
  suiteLogoutHops,
  suiteLogoutStep,
} from "@/lib/suite-logout";
import { GET as crossLogoutGet, POST as crossLogoutPost } from "@/app/api/auth/cross-logout/route";
import { GET as suiteLogoutGet } from "@/app/api/auth/suite-logout/route";

const SESSION = "__Secure-next-auth.session-token";
const HOSTED = "https://dpocentral.todo.law";

afterEach(() => {
  vi.unstubAllEnvs();
});

// ----- a browser's cookie jar, keyed by name and domain -----

type Jar = Map<string, string>;

const key = (name: string, domain?: string) => `${name}|${domain ?? ""}`;

function applySetCookies(jar: Jar, headers: string[]): Jar {
  for (const header of headers) {
    const [pair, ...attributes] = header.split(/;\s*/);
    const at = pair.indexOf("=");
    const name = pair.slice(0, at);
    const value = pair.slice(at + 1);
    const domain = attributes
      .find((a) => a.toLowerCase().startsWith("domain="))
      ?.slice("domain=".length);
    const expired = attributes.some((a) => a.toLowerCase() === "max-age=0");
    if (expired) jar.delete(key(name, domain));
    else jar.set(key(name, domain), value);
  }
  return jar;
}

const setCookies = (res: Response) => res.headers.getSetCookie();

describe("the expiry of every session cookie name", () => {
  it("emits each name twice on the hosted cloud: with the domain and without it", () => {
    const writes = sessionCookieExpiries("dpocentral.todo.law", { secure: true });
    expect(writes).toHaveLength(SESSION_COOKIE_NAMES.length * 2);
    for (const name of SESSION_COOKIE_NAMES) {
      const mine = writes.filter((w) => w.startsWith(`${name}=;`));
      expect(mine, name).toHaveLength(2);
      expect(mine.filter((w) => /; Domain=\.todo\.law$/.test(w)), name).toHaveLength(1);
      expect(mine.filter((w) => !/domain=/i.test(w)), name).toHaveLength(1);
      for (const write of mine) {
        expect(write, name).toContain("Path=/");
        expect(write, name).toContain("Max-Age=0");
      }
    }
  });

  it("keeps Secure on every __Secure- name, which a browser would otherwise refuse", () => {
    for (const write of sessionCookieExpiries("localhost", { secure: false })) {
      if (write.startsWith("__Secure-")) expect(write).toContain("; Secure");
    }
  });

  it("emits one host-only expiry per name on a self-host, and no foreign domain", () => {
    const writes = sessionCookieExpiries("privacy.firm.example", { secure: true });
    expect(writes).toHaveLength(SESSION_COOKIE_NAMES.length);
    expect(writes.some((w) => /domain=/i.test(w))).toBe(false);
  });

  it("follows AUTH_COOKIE_DOMAIN when a deployment set one", () => {
    expect(parentCookieDomain("privacy.firm.example", { AUTH_COOKIE_DOMAIN: "firm.example" })).toBe(
      ".firm.example"
    );
    expect(parentCookieDomain("privacy.firm.example", {})).toBeUndefined();
    expect(parentCookieDomain("dpocentral.todo.law", {})).toBe(".todo.law");

    const writes = sessionCookieExpiries("privacy.firm.example", {
      secure: true,
      env: { AUTH_COOKIE_DOMAIN: ".firm.example" },
    });
    expect(writes.filter((w) => w.startsWith(`${SESSION}=;`))).toHaveLength(2);
  });
});

describe("a request carrying a host-only cookie", () => {
  it("is signed out: both cookies of that name are gone after POST", async () => {
    const jar: Jar = new Map([
      [key(SESSION), "host-only-token"],
      [key(SESSION, ".todo.law"), "suite-token"],
      [key("dpocentral.session-token"), "older-release-token"],
    ]);

    const res = await crossLogoutPost(
      new NextRequest(`${HOSTED}/api/auth/cross-logout`, {
        method: "POST",
        headers: { cookie: `${SESSION}=host-only-token` },
      })
    );

    expect(res.headers.get("Cache-Control")).toBe("no-store");
    applySetCookies(jar, setCookies(res));
    expect([...jar.keys()]).toEqual([]);
  });

  it("is signed out by the walk as well, on its very first response", async () => {
    const jar: Jar = new Map([[key(SESSION), "host-only-token"]]);
    const res = await suiteLogoutGet(new NextRequest(`${HOSTED}/api/auth/suite-logout`));
    applySetCookies(jar, setCookies(res));
    expect(jar.size).toBe(0);
  });
});

describe("the walk", () => {
  /** Follows the redirects, letting each sibling run the same endpoint code. */
  async function walk(start: string) {
    const visited: string[] = [];
    let url = start;
    for (let guard = 0; guard < 10; guard += 1) {
      const target = new URL(url);
      visited.push(target.host);
      const request = new NextRequest(url);
      const handler = target.pathname === "/api/auth/suite-logout" ? suiteLogoutGet : crossLogoutGet;
      const res = await handler(request);
      expect(res.status).toBe(303);
      const next = res.headers.get("location")!;
      if (new URL(next).pathname === "/sign-in") return { visited, landing: next };
      url = next;
    }
    throw new Error("the walk did not end");
  }

  it("visits each sibling once and returns to this product's sign-in page", async () => {
    const { visited, landing } = await walk(`${HOSTED}/api/auth/suite-logout`);
    expect(visited).toEqual([
      "dpocentral.todo.law",
      "dealroom.todo.law",
      "dpocentral.todo.law",
      "aisentinel.todo.law",
      "dpocentral.todo.law",
    ]);
    expect(landing).toBe(`${HOSTED}${SIGNED_OUT_PATH}`);
    // Each sibling is a hop exactly once.
    expect(visited.filter((host) => host === "dealroom.todo.law")).toHaveLength(1);
    expect(visited.filter((host) => host === "aisentinel.todo.law")).toHaveLength(1);
  });

  it("walks the siblings a deployment names in SUITE_LOGOUT_URLS, never itself", () => {
    vi.stubEnv("SUITE_LOGOUT_URLS", "https://a.example.com, https://dpocentral.todo.law");
    expect(suiteLogoutHops("dpocentral.todo.law", process.env)).toEqual([
      "https://a.example.com/api/auth/cross-logout",
    ]);
    expect(suiteLogoutHops("localhost", {})).toEqual([]);
  });

  it("does not become an open redirect", async () => {
    const hosts = ["dealroom.todo.law"];
    expect(safeReturnTo("https://evil.example.com/", HOSTED, hosts)).toBeNull();
    expect(safeReturnTo("//evil.example.com/", HOSTED, hosts)).toBeNull();
    expect(safeReturnTo("javascript:alert(1)", HOSTED, hosts)).toBeNull();
    expect(safeReturnTo("/privacy", HOSTED, hosts)).toBe(`${HOSTED}/privacy`);
    expect(safeReturnTo("https://dealroom.todo.law/x", HOSTED, hosts)).toBe(
      "https://dealroom.todo.law/x"
    );

    const res = await crossLogoutGet(
      new NextRequest(`${HOSTED}/api/auth/cross-logout?next=https%3A%2F%2Fevil.example.com%2F`)
    );
    expect(res.headers.get("location")).toBe(`${HOSTED}${SIGNED_OUT_PATH}`);
  });

  it("reads a step and a deadline, and never extends the budget", () => {
    expect(parseStep("2")).toBe(2);
    expect(parseStep("-1")).toBe(0);
    expect(parseStep("banana")).toBe(0);
    expect(parseDeadline("1000", 0, 10_000)).toBe(1000);
    expect(parseDeadline("999999999", 0, 10_000)).toBe(10_000);
    expect(parseDeadline(null, 500, 10_000)).toBe(10_500);
  });
});

describe("a sibling that fails", () => {
  const hops = [
    "https://dealroom.todo.law/api/auth/cross-logout",
    "https://aisentinel.todo.law/api/auth/cross-logout",
  ];

  it("does not block the local sign-out: the cookies are already expired", async () => {
    const jar: Jar = new Map([
      [key(SESSION), "host-only-token"],
      [key(SESSION, ".todo.law"), "suite-token"],
    ]);

    // The first response of the walk, the one the browser gets before any hop.
    const res = await suiteLogoutGet(new NextRequest(`${HOSTED}/api/auth/suite-logout`));
    applySetCookies(jar, setCookies(res));
    expect(jar.size).toBe(0);
    // ...and the browser is on its way to the first sibling, which never answers.
    expect(res.headers.get("location")).toContain("dealroom.todo.law");
  });

  it("ends the walk when a slow hop answers after the deadline", () => {
    const late = suiteLogoutStep({
      origin: HOSTED,
      hops,
      step: 1,
      deadline: 1_000,
      now: 9_000,
    });
    expect(late).toEqual({ url: `${HOSTED}${SIGNED_OUT_PATH}`, done: true });

    const inTime = suiteLogoutStep({ origin: HOSTED, hops, step: 1, deadline: 9_000, now: 1_000 });
    expect(inTime.done).toBe(false);
    expect(inTime.url).toContain("aisentinel.todo.law");
  });

  it("lands on the sign-in page when a hop sends back a step that is not a hop", () => {
    expect(
      suiteLogoutStep({ origin: HOSTED, hops, step: 7, deadline: 9_000, now: 0 })
    ).toEqual({ url: `${HOSTED}${SIGNED_OUT_PATH}`, done: true });
    expect(suiteLogoutStep({ origin: HOSTED, hops: [], step: 0, deadline: 9_000, now: 0 })).toEqual({
      url: `${HOSTED}${SIGNED_OUT_PATH}`,
      done: true,
    });
  });
});
