/**
 * Route handlers read the session under the cookie name auth.ts writes
 * (src/lib/session-cookie.ts). The smoke walk found every export answering
 * 401 on the self-hosted posture: the handlers looked for NextAuth's default
 * cookie name while local sign-in writes "dpocentral.session-token".
 *
 * Locks: the name per posture; no route handler calls getToken() directly.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { sessionTokenCookieName } from "@/lib/session-cookie";

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return routeFiles(full);
    return name === "route.ts" ? [full] : [];
  });
}

describe("session cookie name", () => {
  it("self-hosted local sign-in over http uses the app-prefixed name", () => {
    expect(
      sessionTokenCookieName({ NODE_ENV: "production", NEXTAUTH_URL: "http://localhost:8485" }, true)
    ).toBe("dpocentral.session-token");
  });

  it("local sign-in over https uses the secure app-prefixed name", () => {
    expect(
      sessionTokenCookieName({ NODE_ENV: "production", NEXTAUTH_URL: "https://dpo.firm.example" }, true)
    ).toBe("__Secure-dpocentral.session-token");
  });

  it("the hosted cross-app cookie keeps the NextAuth name", () => {
    expect(
      sessionTokenCookieName({ NODE_ENV: "production", AUTH_COOKIE_DOMAIN: ".todo.law" }, false)
    ).toBe("__Secure-next-auth.session-token");
  });

  it("with neither, NextAuth's default applies", () => {
    expect(sessionTokenCookieName({ NODE_ENV: "production" }, false)).toBeUndefined();
  });
});

describe("route handlers", () => {
  it("never read the session with a bare getToken()", () => {
    const offenders = routeFiles(path.join(__dirname, "..", "src", "app", "api")).filter((f) =>
      /\bgetToken\(/.test(readFileSync(f, "utf-8"))
    );
    expect(offenders).toEqual([]);
  });
});
