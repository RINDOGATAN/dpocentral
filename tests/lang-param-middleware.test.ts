/**
 * Shareable language links (`?lang=es|en`) on the public DSAR portal, the
 * sign-in page and the licence page, through the real middleware
 * (src/middleware.ts): the language is recorded in the `locale` cookie and
 * forwarded on the request, so the first render is already in that language.
 */

import { describe, it, expect, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("next-intl/middleware", () => ({
  default: () => () => NextResponse.next(),
}));

import middleware from "@/middleware";
import { langParamLocale, localeFromCookieHeader } from "@/i18n/locale-cookie";

function run(path: string, cookie?: string) {
  const headers: Record<string, string> = { "x-forwarded-for": "203.0.113.9" };
  if (cookie) headers.cookie = cookie;
  return middleware(new NextRequest(`https://dpo.example.com${path}`, { headers })) as NextResponse;
}

/** The cookie header the page will read (NextResponse.next forwards request headers this way). */
const forwardedCookie = (res: NextResponse) => res.headers.get("x-middleware-request-cookie");

describe("langParamLocale", () => {
  it("accepts es and en on /licenses, /sign-in and /dsar*", () => {
    expect(langParamLocale("/licenses", "es")).toBe("es");
    expect(langParamLocale("/sign-in", "en")).toBe("en");
    expect(langParamLocale("/dsar/acme", "es")).toBe("es");
  });
  it("ignores other paths and unknown languages", () => {
    expect(langParamLocale("/licensesx", "es")).toBeUndefined();
    expect(langParamLocale("/privacy", "es")).toBeUndefined();
    expect(langParamLocale("/licenses", "fr")).toBeUndefined();
    expect(langParamLocale("/licenses", null)).toBeUndefined();
  });
});

describe("middleware: ?lang= on the public pages", () => {
  it("records the language and forwards it for the first render", () => {
    const res = run("/licenses?lang=es");
    expect(res.headers.get("set-cookie") ?? "").toMatch(/(^|,\s*)locale=es/);
    expect(localeFromCookieHeader(forwardedCookie(res))).toBe("es");
  });

  it("overrides an earlier choice on the same request (last value wins)", () => {
    const res = run("/sign-in?lang=es", "locale=en");
    expect(localeFromCookieHeader(forwardedCookie(res))).toBe("es");
  });

  it("still works on the DSAR portal", () => {
    const res = run("/dsar/acme?lang=es");
    expect(res.headers.get("set-cookie") ?? "").toMatch(/(^|,\s*)locale=es/);
    expect(localeFromCookieHeader(forwardedCookie(res))).toBe("es");
  });

  it("writes nothing without the parameter", () => {
    const res = run("/licenses", "locale=en");
    expect(res.headers.get("set-cookie") ?? "").not.toMatch(/(^|,\s*)locale=es/);
    expect(localeFromCookieHeader(forwardedCookie(res))).toBe("en");
  });
});
