// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Smoke walk: the path a pilot user takes, in a real browser, at 1280 px and
 * at 390 px (see playwright.config.ts for how it is served).
 *
 * Landing -> local sign-in -> first-run screen -> main list -> one record of
 * each principal kind (data asset, vendor, request, incident, assessment),
 * each created, opened and edited -> exports -> sign-out.
 *
 * Every step asserts:
 *  - no response from the app answers 5xx;
 *  - no uncaught exception and no console error on the page;
 *  - no request to the app's own API answers 4xx, except those the step
 *    names as expected;
 *  - at 390 px, the page is no wider than the window.
 */

import { writeFileSync } from "node:fs";
import { test, expect, type Page, type BrowserContext, type Response } from "@playwright/test";

class Guard {
  private problems: string[] = [];
  private allowed: RegExp[] = [];

  constructor(private origin: string) {}

  attach(context: BrowserContext) {
    const watch = (page: Page) => {
      page.on("pageerror", (err) => this.problems.push(`uncaught exception: ${err.message}`));
      page.on("console", (msg) => {
        if (msg.type() !== "error") return;
        const text = msg.text();
        // The browser logs every 4xx/5xx as "Failed to load resource"; the
        // response listener below judges those against the step's allow-list.
        if (text.startsWith("Failed to load resource")) return;
        this.problems.push(`console error: ${text}`);
      });
    };
    context.pages().forEach(watch);
    context.on("page", watch);
    context.on("response", (res) => this.onResponse(res));
  }

  private onResponse(res: Response) {
    const url = res.url();
    if (!url.startsWith(this.origin)) return;
    const status = res.status();
    const path = url.slice(this.origin.length);
    if (status >= 500) {
      this.problems.push(`${status} ${res.request().method()} ${path}`);
      return;
    }
    if (status >= 400 && path.startsWith("/api/")) {
      const what = `${status} ${res.request().method()} ${path}`;
      if (!this.allowed.some((re) => re.test(what))) this.problems.push(what);
    }
  }

  begin(allow: RegExp[] = []) {
    this.problems = [];
    this.allowed = allow;
  }

  take(): string[] {
    const out = this.problems;
    this.problems = [];
    return out;
  }
}

const stamp = Date.now().toString(36);

test.describe.configure({ mode: "serial" });

test("a pilot user walks the product end to end", async ({ page, context, baseURL }, testInfo) => {
  const phone = (page.viewportSize()?.width ?? 1280) < 640;
  const guard = new Guard(baseURL!);
  guard.attach(context);
  const email = `smoke-${testInfo.project.name}-${stamp}@example.com`;

  async function step(name: string, fn: () => Promise<void>, allow: RegExp[] = []) {
    await test.step(name, async () => {
      guard.begin(allow);
      let failure: string | null = null;
      try {
        await fn();
      } catch (err) {
        const lines = (err as Error).message.split("\n");
        const waitingFor = lines.find((l) => l.includes("waiting for") || l.includes("Locator:"));
        failure = `step did not complete: ${lines[0]}${waitingFor ? ` (${waitingFor.trim()})` : ""}`;
        const snapshot = await page.locator("body").ariaSnapshot().catch(() => "(no snapshot)");
        const file = testInfo.outputPath(`step-${name.replace(/[^a-z0-9]+/gi, "-")}.txt`);
        writeFileSync(file, `${failure}\n${page.url()}\n${snapshot}\n`);
        await testInfo.attach(`page at "${name}"`, { path: file, contentType: "text/plain" });
      }
      await page.waitForLoadState("networkidle").catch(() => {});
      const problems = guard.take();
      if (failure) problems.push(failure);
      if (phone) {
        const { scrollWidth, innerWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));
        if (scrollWidth > innerWidth) {
          problems.push(`page wider than the window at 390 px: ${scrollWidth} > ${innerWidth} on ${page.url()}`);
        }
      }
      // Soft: the walk goes on, so one run reports every broken step.
      expect.soft(problems, `problems during "${name}"`).toEqual([]);
    });
  }

  /** Radix Select: open the trigger, pick the first (or the named) option. */
  async function choose(trigger: ReturnType<Page["locator"]>, option?: string | RegExp) {
    await trigger.click();
    const list = page.getByRole("option");
    await (option ? list.filter({ hasText: option }).first() : list.first()).click();
  }

  async function saveAndSee(button: string | RegExp) {
    await page.getByRole("button", { name: button }).click();
  }

  // ── Landing and sign-in ──────────────────────────────────────────────
  await step("landing page", async () => {
    const res = await page.goto("/");
    expect(res?.status()).toBeLessThan(400);
    await expect(page.locator("body")).toBeVisible();
  });

  await step("local sign-in", async () => {
    await page.goto("/sign-in");
    await page.locator("#local-email").fill(email);
    await page.locator("form").filter({ has: page.locator("#local-email") }).getByRole("button").click();
    await page.waitForURL("**/privacy**");
  });

  // ── First run ────────────────────────────────────────────────────────
  await step("first-run screen", async () => {
    await expect(page.locator("#onboarding-org-name")).toBeVisible();
    await page.getByText(/business owner/i).first().click();
    await page.locator("#onboarding-org-name").fill(`Smoke ${testInfo.project.name} ${stamp}`);
    await page.getByRole("button", { name: /get started/i }).click();
    await page.waitForURL("**/privacy/quickstart**");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  await step("main list (dashboard)", async () => {
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  });

  // ── Data asset ───────────────────────────────────────────────────────
  const assetName = `Smoke asset ${stamp}`;
  await step("data asset: create", async () => {
    await page.goto("/privacy/data-inventory/new");
    await page.getByLabel(/asset name/i).fill(assetName);
    await choose(page.getByRole("combobox").first());
    await saveAndSee(/create asset/i);
    await page.waitForURL(/\/privacy\/data-inventory$/);
    await expect(page.getByText(assetName).first()).toBeVisible();
  });

  await step("data asset: open", async () => {
    await page.getByText(assetName).first().click();
    await page.waitForURL(/\/privacy\/data-inventory\/(?!new$)[^/]+$/);
    await expect(page.getByText(assetName).first()).toBeVisible();
  });

  await step("data asset: edit", async () => {
    await page.goto(`${page.url()}/edit`);
    const description = page.getByLabel(/description/i).first();
    await description.fill("Edited by the smoke walk");
    await page.getByRole("button", { name: /save/i }).click();
    await page.waitForURL(/\/privacy\/data-inventory\/(?!new$)[^/]+$/);
    await expect(page.getByText("Edited by the smoke walk").first()).toBeVisible();
  });

  // ── Vendor ───────────────────────────────────────────────────────────
  const vendorName = `Smoke vendor ${stamp}`;
  await step("vendor: create", async () => {
    await page.goto("/privacy/vendors/new");
    await page.getByLabel(/vendor name/i).fill(vendorName);
    await saveAndSee(/create vendor/i);
    await page.waitForURL(/\/privacy\/vendors$/);
    await expect(page.getByText(vendorName).first()).toBeVisible();
  });

  await step("vendor: open", async () => {
    await page.getByText(vendorName).first().click();
    await page.waitForURL(/\/privacy\/vendors\/(?!new$)[^/]+$/);
    await expect(page.getByRole("heading", { name: vendorName })).toBeVisible();
  });

  await step("vendor: edit", async () => {
    await page.getByRole("button", { name: /edit/i }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("#edit-description").fill("Edited by the smoke walk");
    await dialog.getByRole("button", { name: /^save$/i }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Edited by the smoke walk").first()).toBeVisible();
  });

  // ── Data subject request ─────────────────────────────────────────────
  await step("request: create", async () => {
    await page.goto("/privacy/dsar/new");
    await page.getByRole("button", { name: /^access/i }).click();
    await page.getByLabel(/full name/i).fill("Smoke Requester");
    await page.getByLabel(/email address/i).fill(`requester-${stamp}@example.com`);
    await saveAndSee(/create request/i);
    await page.waitForURL(/\/privacy\/dsar\/(?!new$)[^/]+$/);
  });

  await step("request: open", async () => {
    await page.reload();
    await expect(page.getByText("Smoke Requester").first()).toBeVisible();
  });

  await step("request: edit (status)", async () => {
    await choose(page.getByRole("combobox").first(), /in progress/i);
    await expect(page.getByRole("combobox").first()).toContainText(/in progress/i);
  });

  // ── Incident ─────────────────────────────────────────────────────────
  const incidentTitle = `Smoke incident ${stamp}`;
  await step("incident: create", async () => {
    await page.goto("/privacy/incidents/new");
    await page.getByLabel(/incident title/i).fill(incidentTitle);
    const selects = page.getByRole("combobox");
    await choose(selects.nth(0));
    await choose(selects.nth(1));
    await saveAndSee(/report incident/i);
    await page.waitForURL(/\/privacy\/incidents\/(?!new$)[^/]+$/);
  });

  await step("incident: open", async () => {
    await page.reload();
    await expect(page.getByText(incidentTitle).first()).toBeVisible();
  });

  await step("incident: edit", async () => {
    await page.goto(`${page.url()}/edit`);
    await page.getByLabel(/incident title/i).fill(`${incidentTitle} edited`);
    await page.getByRole("button", { name: /save/i }).click();
    await page.waitForURL(/\/privacy\/incidents\/(?!new$)[^/]+$/);
    await expect(page.getByText(`${incidentTitle} edited`).first()).toBeVisible();
  });

  // ── Assessment ───────────────────────────────────────────────────────
  const assessmentName = `Smoke assessment ${stamp}`;
  await step("assessment: create", async () => {
    await page.goto("/privacy/assessments/new");
    await page.getByRole("heading", { name: /legitimate interest assessment/i }).click();
    await page.locator("form #name").fill(assessmentName);
    await page.locator("form button[type=submit]").click();
    await page.waitForURL(/\/privacy\/assessments\/(?!new$)[^/]+$/);
  });

  await step("assessment: open", async () => {
    await page.reload();
    await expect(page.getByText(assessmentName).first()).toBeVisible();
  });

  await step("assessment: edit (answer a question)", async () => {
    const questions = page.getByRole("tabpanel");
    // An unanswered question shows a read-only box; focusing it opens the editor.
    await questions.getByRole("textbox").first().click();
    await questions.locator("textarea:not([readonly])").first().fill("Answered by the smoke walk");
    await questions.getByRole("button", { name: /^save$/i }).first().click();
    await expect(page.getByText(/1 of \d+ questions answered/i).first()).toBeVisible();
    await page.reload();
    await expect(page.getByText("Answered by the smoke walk").first()).toBeVisible();
  });

  // ── Exports ──────────────────────────────────────────────────────────
  await step("export: vendor register PDF from the list", async () => {
    await page.goto("/privacy/vendors");
    await page.getByRole("button", { name: /export/i }).first().click();
    const exported = context.waitForEvent("response", (r) => r.url().includes("/api/export/vendor-register"));
    await page.getByRole("menuitem").first().click();
    const res = await exported;
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/pdf");
    for (const p of context.pages()) if (p !== page) await p.close();
  });

  await step("export: every record of the organisation", async () => {
    const orgId = await page.evaluate(() => localStorage.getItem("currentOrganizationId"));
    expect(orgId).toBeTruthy();
    const res = await page.request.get(`/api/export/organization-data?organizationId=${orgId}`);
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain(vendorName);
    expect(body).toContain(assetName);
  });

  // ── Sign-out ─────────────────────────────────────────────────────────
  await step("sign-out", async () => {
    await page.goto("/privacy");
    // The header renders one sign-out control per layout; use the visible one.
    await page.getByRole("button", { name: /sign out/i }).filter({ visible: true }).first().click();
    await page.waitForURL("**/sign-in**");
    await page.goto("/privacy");
    await page.waitForURL("**/sign-in**");
  });
});
