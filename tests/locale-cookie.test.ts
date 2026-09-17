/**
 * The language cookie contract shared by every todo.law app
 * (src/i18n/locale-cookie.ts, src/i18n/request.ts, src/middleware.ts).
 *
 * One cookie named `locale`; domain-wide on todo.law hosts, host-only
 * elsewhere; the last value wins; duplicates are collapsed; nothing is ever
 * written unless the visitor chose a language.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("next-intl/middleware", () => ({
  default: () => () => NextResponse.next(),
}));

let cookieHeader: string | null = null;
vi.mock("next/headers", () => ({
  headers: async () => new Headers(cookieHeader ? { cookie: cookieHeader } : {}),
}));
vi.mock("next-intl/server", () => ({
  getRequestConfig: (fn: unknown) => fn,
}));

import middleware from "@/middleware";
import { _resetRateLimitsForTests } from "@/lib/rate-limit";
import {
  isHostedHost,
  localeCookieCleanup,
  localeCookieWrites,
  localeFromCookieHeader,
  readLocaleCookie,
  writeLocaleCookie,
  cleanUpLocaleCookies,
} from "@/i18n/locale-cookie";
import requestConfig from "@/i18n/request";

const EXPIRE_HOST_ONLY = "locale=; Path=/; Max-Age=0; SameSite=Lax";
const EXPIRE_LEGACY = "NEXT_LOCALE=; Path=/; Max-Age=0; SameSite=Lax";

describe("hosted host detection", () => {
  it("accepts todo.law and its subdomains only", () => {
    expect(isHostedHost("todo.law")).toBe(true);
    expect(isHostedHost("dpocentral.todo.law")).toBe(true);
    expect(isHostedHost("DPOCENTRAL.TODO.LAW")).toBe(true);
    expect(isHostedHost("localhost")).toBe(false);
    expect(isHostedHost("dpo.example-firm.com")).toBe(false);
    expect(isHostedHost("nottodo.law")).toBe(false);
    expect(isHostedHost("")).toBe(false);
  });
});

describe("writer", () => {
  it("on a hosted host expires the host-only duplicate, then writes the domain-wide cookie", () => {
    const writes = localeCookieWrites("es", "dpocentral.todo.law");
    const hostOnly = writes.indexOf(EXPIRE_HOST_ONLY);
    const domain = writes.findIndex((c) => c.startsWith("locale=es;"));
    expect(hostOnly).toBeGreaterThanOrEqual(0);
    expect(domain).toBeGreaterThan(hostOnly);
    expect(writes[domain]).toBe(
      "locale=es; Path=/; Max-Age=31536000; SameSite=Lax; Domain=.todo.law"
    );
    expect(writes).toContain(EXPIRE_LEGACY);
  });

  it("elsewhere writes a host-only cookie", () => {
    const writes = localeCookieWrites("en", "localhost");
    expect(writes).toContain("locale=en; Path=/; Max-Age=31536000; SameSite=Lax");
    expect(writes.some((c) => /domain=/i.test(c))).toBe(false);
    expect(writes).not.toContain(EXPIRE_HOST_ONLY);
  });
});

describe("reader", () => {
  it("returns the last locale value", () => {
    expect(localeFromCookieHeader("locale=es; locale=en")).toBe("en");
    expect(localeFromCookieHeader("locale=en; other=1; locale=es")).toBe("es");
    expect(localeFromCookieHeader("locale=es")).toBe("es");
  });

  it("returns null when absent or unsupported", () => {
    expect(localeFromCookieHeader(null)).toBeNull();
    expect(localeFromCookieHeader("currency=EUR")).toBeNull();
    expect(localeFromCookieHeader("locale=fr")).toBeNull();
    expect(localeFromCookieHeader("xlocale=es")).toBeNull();
  });

  it("falls back to the legacy NEXT_LOCALE cookie only when locale is absent", () => {
    expect(localeFromCookieHeader("NEXT_LOCALE=es")).toBe("es");
    expect(localeFromCookieHeader("NEXT_LOCALE=es; locale=en")).toBe("en");
  });
});

describe("clean-up rule", () => {
  it("emits the expiry and the domain-wide re-write when two values arrive on a hosted host", () => {
    expect(localeCookieCleanup("locale=es; locale=en", "dpocentral.todo.law")).toEqual([
      EXPIRE_HOST_ONLY,
      "locale=en; Path=/; Max-Age=31536000; SameSite=Lax; Domain=.todo.law",
    ]);
  });

  it("emits nothing for a single value or off todo.law", () => {
    expect(localeCookieCleanup("locale=es", "dpocentral.todo.law")).toEqual([]);
    expect(localeCookieCleanup("", "dpocentral.todo.law")).toEqual([]);
    expect(localeCookieCleanup("locale=es; locale=en", "localhost")).toEqual([]);
  });
});

describe("browser helpers", () => {
  let jar: string[];
  let current: string;

  beforeEach(() => {
    jar = [];
    current = "";
    vi.stubGlobal("window", { location: { hostname: "dpocentral.todo.law" } });
    vi.stubGlobal("document", {
      get cookie() {
        return current;
      },
      set cookie(value: string) {
        jar.push(value);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the last value from document.cookie", () => {
    current = "locale=es; locale=en";
    expect(readLocaleCookie()).toBe("en");
  });

  it("writes through the shared writer, expiring the host-only duplicate first", () => {
    writeLocaleCookie("es");
    expect(jar).toEqual(localeCookieWrites("es", "dpocentral.todo.law"));
    expect(jar.indexOf(EXPIRE_HOST_ONLY)).toBeLessThan(jar.length - 1);
  });

  it("collapses duplicates on page load and leaves a single cookie alone", () => {
    current = "locale=es; locale=en";
    cleanUpLocaleCookies();
    expect(jar).toHaveLength(2);
    jar = [];
    current = "locale=en";
    cleanUpLocaleCookies();
    expect(jar).toEqual([]);
  });
});

describe("middleware", () => {
  beforeEach(() => {
    _resetRateLimitsForTests();
  });

  function get(url: string, cookie?: string) {
    return middleware(
      new NextRequest(url, { headers: cookie ? { cookie } : {} })
    ) as NextResponse;
  }

  function localeSetCookies(res: NextResponse) {
    return res.headers.getSetCookie().filter((c) => /^(locale|NEXT_LOCALE)=/.test(c));
  }

  it("writes no default locale cookie", () => {
    expect(localeSetCookies(get("https://dpocentral.todo.law/"))).toEqual([]);
    expect(localeSetCookies(get("https://dpocentral.todo.law/docs"))).toEqual([]);
    expect(localeSetCookies(get("http://localhost:3001/dsar/acme"))).toEqual([]);
  });

  it("emits both Set-Cookie headers when two locale values arrive", () => {
    const res = get("https://dpocentral.todo.law/docs", "locale=es; locale=en");
    expect(localeSetCookies(res)).toEqual([
      EXPIRE_HOST_ONLY,
      "locale=en; Path=/; Max-Age=31536000; SameSite=Lax; Domain=.todo.law",
    ]);
  });

  it("emits nothing when one locale value arrives", () => {
    const res = get("https://dpocentral.todo.law/docs", "locale=en");
    expect(localeSetCookies(res)).toEqual([]);
  });

  it("records a language chosen through a DSAR ?lang= link via the writer", () => {
    const res = get("https://dpocentral.todo.law/dsar/acme?lang=es");
    expect(localeSetCookies(res)).toEqual(localeCookieWrites("es", "dpocentral.todo.law"));
  });
});

describe("docs page language (src/i18n/request.ts)", () => {
  type Config = (args: { requestLocale: Promise<string | undefined> }) => Promise<{ locale: string }>;
  const resolve = (requestConfig as unknown as Config);

  afterEach(() => {
    cookieHeader = null;
  });

  it("renders English when the header carries locale=es; locale=en", async () => {
    cookieHeader = "locale=es; locale=en";
    const { locale } = await resolve({ requestLocale: Promise.resolve(undefined) });
    expect(locale).toBe("en");
  });

  it("renders Spanish when the order is reversed", async () => {
    cookieHeader = "locale=en; locale=es";
    const { locale } = await resolve({ requestLocale: Promise.resolve(undefined) });
    expect(locale).toBe("es");
  });

  it("renders English when no cookie and no Accept-Language are present", async () => {
    cookieHeader = null;
    const { locale } = await resolve({ requestLocale: Promise.resolve(undefined) });
    expect(locale).toBe("en");
  });
});
