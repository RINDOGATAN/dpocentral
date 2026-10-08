// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * QA round (October 2026), seen in a browser (served as in playwright.config.ts).
 *
 * - The DSAR intake settings and the DPIA auto-fill page open without the
 *   error screen, and a request type switched off stays off after a reload.
 * - A colleague who already belongs to an organisation, with no persona of
 *   their own, lands in it and is not offered the screen that creates a new
 *   one. Written straight into the local test database, as a member added
 *   by an administrator would be.
 * - On a phone: a new request's page, with its long reference, fits the
 *   window and its "Add task" button can be tapped; the public pages that
 *   ran wider than a phone fit; the public pages offer the language switch.
 *
 * Both projects; the phone checks run in phone-390 only.
 */

import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const stamp = Date.now().toString(36);

function localDatabase(): boolean {
  const url = process.env.DATABASE_URL ?? "";
  return /@(localhost|127\.0\.0\.1|postgres)(:\d+)?\//.test(url);
}

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.locator("#local-email").fill(email);
  await page.locator("form").filter({ has: page.locator("#local-email") }).getByRole("button").click();
  await page.waitForURL("**/privacy**");
}

async function signInWithNewOrganisation(page: Page, who: string) {
  await signIn(page, `${who}-${stamp}@example.com`);
  await page.getByText(/business owner/i).first().click();
  await page.locator("#onboarding-org-name").fill(`QA round ${who} ${stamp}`);
  await page.getByRole("button", { name: /get started/i }).click();
  await page.waitForURL("**/privacy/quickstart**");
}

async function expectNoSidewaysScroll(page: Page, where: string) {
  await page.waitForLoadState("networkidle").catch(() => {});
  // The configured width, not innerWidth: mobile emulation widens the layout
  // viewport to fit oversized content, which would hide the overflow.
  const width = page.viewportSize()!.width;
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth, `${where}: page wider than the window (${scrollWidth} > ${width})`).toBeLessThanOrEqual(width);
}

function watchForErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    const text = m.text();
    if (m.type() === "error" && !text.startsWith("Failed to load resource") && !text.includes("[Report Only]")) {
      errors.push(text);
    }
  });
  return errors;
}

test("the DSAR intake settings open, and a request type switched off stays off", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1280", "desktop only");
  const errors = watchForErrors(page);
  await signInWithNewOrganisation(page, "intake");

  await page.goto("/privacy/dsar/settings");
  await expect(page.getByTestId("error-reference")).toHaveCount(0);
  const portability = page.getByTestId("dsar-type-PORTABILITY");
  await expect(portability).toHaveAttribute("role", "switch");
  await expect(portability).toHaveAttribute("aria-checked", "true");
  await portability.press("Space"); // a card answers the keyboard
  await expect(portability).toHaveAttribute("aria-checked", "false");
  await page.locator("form button[type=submit]").click();
  await expect(page.locator("form button[type=submit]")).toBeEnabled();
  await page.waitForLoadState("networkidle");

  await page.reload();
  await expect(page.getByTestId("dsar-type-PORTABILITY")).toHaveAttribute("aria-checked", "false");
  expect(errors).toEqual([]);
});

test("the DPIA auto-fill page opens", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1280", "desktop only");
  const errors = watchForErrors(page);
  await signInWithNewOrganisation(page, "autofill");
  await page.goto("/privacy/assessments/auto-fill");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByTestId("error-reference")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("a colleague added to an organisation lands in it, not on the first-run screen", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1280", "desktop only");
  test.skip(!localDatabase(), "writes the member into a local test database only");
  const prisma = new PrismaClient();
  const email = `colleague-${stamp}@example.com`;
  const orgName = `QA round colleague org ${stamp}`;
  try {
    const org = await prisma.organization.create({ data: { name: orgName, slug: `qa-round-colleague-${stamp}` } });
    // No persona (userType), as for anyone added by an administrator or by
    // email domain.
    const user = await prisma.user.create({ data: { email, name: "colleague" } });
    await prisma.organizationMember.create({ data: { organizationId: org.id, userId: user.id, role: "MEMBER" } });
  } finally {
    await prisma.$disconnect();
  }

  await signIn(page, email);
  await page.goto("/privacy");
  await expect(page.locator("#onboarding-org-name")).toHaveCount(0);
  await expect(page.getByText(orgName).first()).toBeVisible();
});

test("a new request's page fits a phone and its Add task button can be tapped", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone-390", "phone width only");
  await signInWithNewOrganisation(page, "phone-request");

  await page.goto("/privacy/dsar/new");
  await page.getByRole("button", { name: /^access/i }).first().click();
  await page.getByRole("textbox", { name: /full name/i }).fill(`Phone requester ${stamp}`);
  await page.getByRole("textbox", { name: /email/i }).fill(`phone-requester-${stamp}@example.com`);
  await page.getByRole("button", { name: /create request/i }).click();
  await page.waitForURL(/\/privacy\/dsar\/(?!new$)[^/]+$/);
  await expectNoSidewaysScroll(page, "request page");

  // It used to sit past the right edge of the card and the window.
  const add = page.getByRole("button", { name: /add task/i }).first();
  await add.scrollIntoViewIfNeeded();
  const box = (await add.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await add.click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.goto("/privacy/dsar");
  await expectNoSidewaysScroll(page, "request list");
});

test("the public pages fit a phone and offer the language switch", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone-390", "phone width only");
  for (const locale of ["en", "es"]) {
    await page.context().addCookies([{ name: "locale", value: locale, url: testInfo.project.use.baseURL ?? "http://localhost:3101" }]);
    for (const path of ["/docs", "/docs/dsar", "/docs/vendors", "/security"]) {
      await page.goto(path);
      await expectNoSidewaysScroll(page, `${path} (${locale})`);
    }
    await expect(page.getByTestId("public-language")).toBeVisible();
    await page.goto("/sign-in");
    await expect(page.getByTestId("auth-language")).toBeVisible();
    await expectNoSidewaysScroll(page, `/sign-in (${locale})`);
  }
});
