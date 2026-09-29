// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Fixes from the September browser round, seen in a browser.
 *
 * - Sign-out: /api/auth/signout shows our own page, which signs out.
 * - All clients: a client card is reached with the keyboard, by name.
 * - A gated assessment type (only where one is gated: a build with
 *   NEXT_PUBLIC_STRIPE_ENABLED=true outside the hosted pilot, and a DPIA
 *   template installed): the home labels "Start a DPIA", the form says so,
 *   and a refusal shows the server's sentence and keeps what was typed.
 *
 * Desktop project only (phone-width.spec.ts covers 390 px).
 */

import { test, expect, type Page } from "@playwright/test";

const stamp = Date.now().toString(36);

async function signInWithClient(page: Page, who: string) {
  await page.goto("/sign-in");
  await page.locator("#local-email").fill(`${who}-${stamp}@example.com`);
  await page.locator("form").filter({ has: page.locator("#local-email") }).getByRole("button").click();
  await page.waitForURL("**/privacy**");
  await page.getByText(/business owner/i).first().click();
  await page.locator("#onboarding-org-name").fill(`Round one ${who} ${stamp}`);
  await page.getByRole("button", { name: /get started/i }).click();
  await page.waitForURL("**/privacy/quickstart**");
}

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1280", "desktop only");
});

test("sign-out from the library's address lands on our own page", async ({ page }) => {
  await signInWithClient(page, "signout");
  await page.goto("/api/auth/signout");
  await page.waitForURL("**/sign-out**");
  await expect(page.getByRole("heading", { name: /^sign out$/i })).toBeVisible();
  await page.getByRole("button", { name: /^sign out$/i }).click();
  await page.waitForURL("**/sign-in**");
  await page.goto("/privacy");
  await page.waitForURL("**/sign-in**");
});

test("a client card is reached with the keyboard, by its name", async ({ page }) => {
  await signInWithClient(page, "clients");
  await page.goto("/privacy/clients");
  const open = page.getByRole("button", { name: `Round one clients ${stamp}` });
  await expect(open).toBeVisible();
  await open.focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/privacy(\?|$|\/)/);
});

test("a gated type is labelled, and its refusal is shown with the form kept", async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_STRIPE_ENABLED !== "true", "no type is gated in this posture");
  await signInWithClient(page, "gated");

  await page.goto("/privacy");
  await expect(page.getByTestId("quick-action-dpia-gated")).toBeVisible();

  await page.goto("/privacy/assessments/new?type=DPIA");
  await expect(page.getByTestId("assessment-type-gated")).toBeVisible();
  const name = `Gated DPIA ${stamp}`;
  await page.locator("form #name").fill(name);
  await page.locator("form #description").fill("Kept after the refusal");
  await page.locator("form button[type=submit]").click();

  const alert = page.getByTestId("assessment-create-error");
  await expect(alert).toBeVisible();
  await expect(alert).toHaveAttribute("role", "alert");
  await expect(alert).toContainText("DPIA assessments require a premium license");
  await expect(page).toHaveURL(/\/privacy\/assessments\/new/);
  await expect(page.locator("form #name")).toHaveValue(name);
  await expect(page.locator("form #description")).toHaveValue("Kept after the refusal");
});
