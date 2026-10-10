// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Phone width: the Guided screens at 390 px (served as in playwright.config.ts).
 *
 * The September browser round could not narrow its window, so this walk
 * covers what it missed: the quick start (each step and the result), the
 * Guided home, the path (the phone sheet) and a record's own page. On each,
 * the page must be no wider than the window. The walk also checks, on the
 * way, the round's fixes it passes through: the result screen links each
 * record to its own page, an activity's page reads Step 2.2, the home's
 * Data Inventory card names its counts, and an LIA is created.
 *
 * Runs in the phone-390 project only.
 */

import { test, expect, type Page } from "@playwright/test";

const stamp = Date.now().toString(36);

async function expectNoSidewaysScroll(page: Page, where: string) {
  await page.waitForLoadState("networkidle").catch(() => {});
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth, `${where}: page wider than the window (${scrollWidth} > ${innerWidth})`).toBeLessThanOrEqual(
    innerWidth
  );
}

test("the Guided screens fit a 390 px phone", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone-390", "phone width only");
  expect(page.viewportSize()?.width).toBe(390);

  // Sign in and create a client.
  await page.goto("/sign-in");
  await page.locator("#local-email").fill(`phone-${stamp}@example.com`);
  await page.locator("form").filter({ has: page.locator("#local-email") }).getByRole("button").click();
  await page.waitForURL("**/privacy**");
  await page.getByText(/business owner/i).first().click();
  await page.locator("#onboarding-org-name").fill(`Phone ${stamp}`);
  await page.getByRole("button", { name: /get started/i }).click();
  await page.waitForURL("**/privacy/quickstart**");

  // Quick start, step by step.
  await expect(page.getByRole("button", { name: /not sure yet: skip/i })).toBeVisible();
  await expectNoSidewaysScroll(page, "quick start: what applies");
  await page.getByRole("button", { name: /not sure yet: skip/i }).click();

  const industryPath = page.getByRole("button", { name: /start from industry template/i });
  await expect(industryPath).toBeVisible();
  await expectNoSidewaysScroll(page, "quick start: choose a path");
  await industryPath.press("Enter"); // a card button answers the keyboard
  await expect(industryPath).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /^continue$/i }).click();

  const firstTemplate = page.locator('[role="button"][aria-pressed]').first();
  await expect(firstTemplate).toBeVisible();
  await expectNoSidewaysScroll(page, "quick start: industry templates");
  await firstTemplate.click();
  await expect(firstTemplate).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /^review$/i }).click();

  await expect(page.getByRole("button", { name: /build my privacy program/i })).toBeVisible();
  await expectNoSidewaysScroll(page, "quick start: review");
  await page.getByRole("button", { name: /build my privacy program/i }).click();

  // The result: every record by name, each linking to its own page.
  const created = page.getByTestId("quickstart-created");
  await expect(created).toBeVisible({ timeout: 60_000 });
  await expectNoSidewaysScroll(page, "quick start: result");
  const hrefs = await created.getByRole("link").evaluateAll((links) =>
    links.map((a) => (a as HTMLAnchorElement).getAttribute("href") ?? "")
  );
  expect(hrefs.length).toBeGreaterThan(3);
  expect(hrefs.filter((h) => h.includes("?search="))).toEqual([]);
  expect(hrefs.some((h) => /^\/privacy\/data-inventory\/[^/?]+$/.test(h))).toBe(true);
  expect(hrefs.some((h) => /^\/privacy\/data-inventory\/activities\/[^/?]+$/.test(h))).toBe(true);
  expect(hrefs.some((h) => /^\/privacy\/data-inventory\/[^/?]+\?tab=flows$/.test(h))).toBe(true);

  // A record's own page: an activity, with its step.
  const activityHref = hrefs.find((h) => h.startsWith("/privacy/data-inventory/activities/"))!;
  await page.goto(activityHref);
  await expect(page.getByTestId("record-header")).toBeVisible();
  await expect(page.getByText("Step 2.2").first()).toBeVisible();
  await expect(page.getByText("Step 2.1")).toHaveCount(0);
  await expectNoSidewaysScroll(page, "activity page");

  // And an asset's own page.
  const assetHref = hrefs.find((h) => /^\/privacy\/data-inventory\/(?!activities\/)[^/?]+$/.test(h))!;
  await page.goto(assetHref);
  await expect(page.getByTestId("record-header")).toBeVisible();
  await expectNoSidewaysScroll(page, "asset page");

  // The Guided home: the six areas and the documents panel (decision d7
  // replaced the counters), the records of processing drafted by the quick start.
  await page.goto("/privacy");
  await expect(page.getByTestId("area-tiles").locator("li")).toHaveCount(6);
  await expect(page.getByTestId("doc-ropa")).toHaveAttribute("data-state", "draft");
  await expectNoSidewaysScroll(page, "Guided home");

  // The path, as a phone opens it.
  await page.getByRole("button", { name: /open the program path/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expectNoSidewaysScroll(page, "the path (phone sheet)");
  await page.keyboard.press("Escape");

  // An LIA is created, and opens (F2).
  await page.goto("/privacy/assessments/new");
  await page.getByRole("button", { name: /legitimate interest assessment/i }).click();
  await page.locator("form #name").fill(`Phone LIA ${stamp}`);
  await page.locator("form button[type=submit]").click();
  await page.waitForURL(/\/privacy\/assessments\/(?!new$)[^/]+$/);
  await expect(page.getByText(`Phone LIA ${stamp}`).first()).toBeVisible();
  await expectNoSidewaysScroll(page, "assessment page");
});
