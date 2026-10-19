// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Smaller security, integrity and locale fixes:
 *   - custom CSS on the public portal cannot load anything from elsewhere;
 *   - the public procedures that read (request status, public form,
 *     feedback) have a rate-limit bucket;
 *   - a malformed or oversized cross-app import is refused with a 4xx;
 *   - withdrawn requests are not counted as open on the client portfolio;
 *   - the billing page and the rights-request settings read their words from
 *     the message files, and the seeded form wording is shown in the
 *     member's language but stored as the English original;
 *   - the AI Sentinel sync writes only systems it sent, in the organisation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { sanitizeCss } from "@/lib/sanitize";
import { classifyRequest } from "@/lib/rate-limit-routes";
import { DEFAULT_INTAKE_TEXT, localizedIntakeText, storedIntakeText } from "@/lib/dsar-default-intake";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

const ROOT = path.resolve(__dirname, "..");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf-8");

describe("custom CSS on the public portal", () => {
  it("removes url(), image-set(), src() and escapes that spell them", () => {
    const out = sanitizeCss(
      "body{background:url(https://tracker.example/p.gif)} h1{background:image-set('x.png' 1x)} " +
        "@font-face{src: src(x)} p{background:\\75 rl(https://t.example)}",
    );
    expect(out).not.toMatch(/url\s*\(/i);
    expect(out).not.toMatch(/image-set\s*\(/i);
    expect(out).not.toMatch(/\bsrc\s*\(/i);
    expect(out).not.toContain("\\75");
  });

  it("is stable on a second pass and keeps ordinary CSS", () => {
    const once = sanitizeCss("h1 { color: #123; } a</style><script>");
    expect(sanitizeCss(once)).toBe(once);
    expect(once).toContain("color: #123;");
    expect(once).not.toContain("<");
  });
});

describe("rate-limit buckets for public reads", () => {
  it.each(["dsar.checkStatus", "dsar.getPublicForm", "feedback.submit"])("%s is counted", (proc) => {
    expect(classifyRequest(`/api/trpc/${proc}`, "GET")).toBe("publicRead");
  });
  it("submit and withdraw stay in the strict bucket, even batched with a read", () => {
    expect(classifyRequest("/api/trpc/dsar.getPublicForm,dsar.submitPublic", "POST")).toBe("dsarPublic");
  });
});

describe("cross-app import routes", () => {
  const OLD = process.env.DPC_IMPORT_API_KEYS;
  beforeEach(() => {
    process.env.DPC_IMPORT_API_KEYS = "k-test-1234567890";
  });
  afterEach(() => {
    process.env.DPC_IMPORT_API_KEYS = OLD;
  });
  const req = (url: string, body: string) =>
    new Request(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": "k-test-1234567890" },
      body,
    });

  it("malformed JSON is a 400, not an unhandled 500", async () => {
    vi.resetModules();
    const { POST: portfolio } = await import("@/app/api/import/portfolio-vendors/route");
    const { POST: check } = await import("@/app/api/import/check-account/route");
    const a = await portfolio(req("http://localhost/api/import/portfolio-vendors", "{not json"));
    const b = await check(req("http://localhost/api/import/check-account", "{not json"));
    expect(a.status).toBe(400);
    expect(b.status).toBe(400);
  });

  it("caps the vendors per push", () => {
    const src = read("src/app/api/import/portfolio-vendors/route.ts");
    expect(src).toMatch(/MAX_VENDORS_PER_PUSH = 500/);
    expect(src).toMatch(/vendors\.length > MAX_VENDORS_PER_PUSH/);
  });
});

describe("client portfolio", () => {
  it("open and overdue requests leave out withdrawn (CANCELLED) ones", () => {
    const src = read("src/server/routers/privacy/clients.ts");
    expect(src).not.toMatch(/notIn: \["COMPLETED", "REJECTED"\] \}/);
    expect(src.match(/notIn: \["COMPLETED", "REJECTED", "CANCELLED"\]/g)?.length).toBe(3);
  });
});

describe("billing page and rights-request settings in the member's language", () => {
  it("the billing page reads every word from pages.billing", () => {
    const src = read("src/app/(dashboard)/privacy/billing/page.tsx");
    expect(src).toContain('useTranslations("pages.billing")');
    for (const literal of [">Billing<", "Add-on Features", "Coming Soon", "Keep Feature", "Confirm Cancellation", "Renews {row", "&mdash;"]) {
      expect(src).not.toContain(literal);
    }
  });

  it("pages.billing has the same keys in English and Spanish", () => {
    const keys = (o: Record<string, unknown>, p = ""): string[] =>
      Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? keys(v as Record<string, unknown>, `${p}${k}.`) : [`${p}${k}`]));
    expect(keys(es.pages.billing).sort()).toEqual(keys(en.pages.billing).sort());
  });

  it("the settings page no longer carries English defaults", () => {
    const src = read("src/app/(dashboard)/privacy/dsar/settings/page.tsx");
    expect(src).not.toContain('"Data Subject Request"');
    expect(src).not.toContain('"Submit a request regarding your personal data"');
    expect(src).not.toContain("Thank you for your request.");
  });

  it("the seeded wording is shown in Spanish and saved as the English original", () => {
    const form = es.dsarPublic.form;
    const t = (k: "header.defaultTitle" | "header.defaultDescription" | "success.defaultThankYou") =>
      k === "header.defaultTitle"
        ? form.header.defaultTitle
        : k === "header.defaultDescription"
          ? form.header.defaultDescription
          : form.success.defaultThankYou;
    const shown = localizedIntakeText(DEFAULT_INTAKE_TEXT, t);
    expect(shown.title).toBe(form.header.defaultTitle);
    const saved = storedIntakeText(
      { title: shown.title, description: shown.description ?? "", thankYouMessage: shown.thankYouMessage ?? "" },
      t,
    );
    expect(saved).toEqual(DEFAULT_INTAKE_TEXT);
    // Text a person wrote is stored as written.
    expect(storedIntakeText({ title: "Mi formulario", description: "x", thankYouMessage: "y" }, t)).toEqual({
      title: "Mi formulario",
      description: "x",
      thankYouMessage: "y",
    });
  });
});

describe("AI Sentinel sync", () => {
  it("writes only the systems it sent, scoped to the organisation", () => {
    const src = read("src/server/routers/privacy/aiGovernance.ts");
    expect(src).toContain("if (!sentIds.has(mapping.dpcId)) continue;");
    expect(src).toMatch(/aISystem\.updateMany\(\{\s*where: \{ id: mapping\.dpcId, organizationId: ctx\.organization\.id \}/);
  });
});

describe("development login", () => {
  it("sets the cookie the session reader expects", () => {
    const src = read("src/app/api/auth/dev-login/route.ts");
    expect(src).toContain("sessionTokenCookieName()");
  });
});
