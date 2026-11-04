// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * F11 of the September browser round: the sign-in page shows only the
 * methods the server offers. A self-hosted instance with local sign-in and no
 * mail key or Google client shows the local form alone: no second e-mail form
 * and no Google button.
 */

import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { signInMethods, type SignInMethods } from "@/lib/sign-in-methods";

vi.mock("next-auth/react", () => ({ signIn: vi.fn() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));

import { SignInForm } from "@/app/(auth)/sign-in/sign-in-form";

const allOn = { devAuthEnabled: true, emailAuthEnabled: true, googleAuthEnabled: true };

function render(methods: SignInMethods, locale: "en" | "es" = "en") {
  return renderToStaticMarkup(
    createElement(
      NextIntlClientProvider,
      {
        locale,
        timeZone: "UTC",
        messages: locale === "en" ? en : es,
      } as unknown as ComponentProps<typeof NextIntlClientProvider>,
      createElement(SignInForm, { methods }),
    ),
  );
}

const count = (html: string, needle: string) => html.split(needle).length - 1;

describe("signInMethods", () => {
  it("offers nothing but local sign-in when no mail key and no Google client are set", () => {
    expect(signInMethods({}, allOn)).toEqual({ local: true, email: false, google: false });
  });

  it("offers the e-mail link only with a mail key", () => {
    expect(signInMethods({ RESEND_API_KEY: "re_x" }, allOn).email).toBe(true);
  });

  it("offers Google only with both the client id and the secret", () => {
    expect(signInMethods({ GOOGLE_CLIENT_ID: "id" }, allOn).google).toBe(false);
    expect(
      signInMethods({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "s" }, allOn).google,
    ).toBe(true);
  });

  it("a build flag set to off hides a method that is configured", () => {
    const env = { RESEND_API_KEY: "re_x", GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "s" };
    expect(
      signInMethods(env, { devAuthEnabled: false, emailAuthEnabled: false, googleAuthEnabled: false }),
    ).toEqual({ local: false, email: false, google: false });
  });

  it("src/lib/auth.ts registers the providers by the same rules", () => {
    const src = readFileSync(path.resolve(__dirname, "../src/lib/auth.ts"), "utf8");
    expect(src).toContain("googleConfigured()");
    expect(src).toContain("emailConfigured()");
  });
});

describe("the sign-in form", () => {
  it("local only: one e-mail form, no Google button, no magic-link note", () => {
    const html = render({ local: true, email: false, google: false });
    expect(count(html, "<form")).toBe(1);
    expect(html).toContain('id="local-email"');
    expect(html).not.toContain('id="email"');
    expect(html).not.toContain(en.auth.continueWithGoogle);
    expect(html).not.toContain(en.auth.noPasswordNeeded);
    expect(html).not.toContain(en.auth.orContinueWith);
  });

  it("everything configured: local form, e-mail form and Google", () => {
    const html = render({ local: true, email: true, google: true });
    expect(count(html, "<form")).toBe(2);
    expect(html).toContain(en.auth.continueWithGoogle);
    expect(html).toContain(en.auth.orContinueWith);
  });

  it("Google alone: the button without the 'or continue with' line", () => {
    const html = render({ local: false, email: false, google: true });
    expect(count(html, "<form")).toBe(0);
    expect(html).toContain(en.auth.continueWithGoogle);
    expect(html).not.toContain(en.auth.orContinueWith);
  });

  it("nothing configured: says so plainly, in both languages", () => {
    const none = { local: false, email: false, google: false };
    const htmlEn = render(none, "en");
    expect(count(htmlEn, "<form")).toBe(0);
    expect(htmlEn).toContain('data-testid="no-sign-in-method"');
    expect(htmlEn).toContain(en.auth.noSignInMethod);
    expect(render(none, "es")).toContain(es.auth.noSignInMethod);
  });
});
