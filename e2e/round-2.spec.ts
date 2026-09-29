// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Polish round 2 (the owner's decisions of 29 September 2026), seen in a
 * browser.
 *
 * - F11: the sign-in page shows only the methods the server offers. The walk
 *   runs with local sign-in and no mail key or Google client, so it shows the
 *   local form alone.
 * - M2: a member limited to one department sees that department in the
 *   selector (never "Whole organisation"), and no quick start, no
 *   organisation-wide progress and no organisation-wide actions. The limited
 *   member is written straight into the local test database (a department,
 *   a MEMBER row and the limit), as an administrator would set it up.
 * - M1: on the pilot tier (here, a build with NEXT_PUBLIC_STRIPE_ENABLED=true
 *   and no licence), two DPIAs are free and the third is refused plainly, with
 *   the link to the plans page.
 *
 * Desktop project only (phone-width.spec.ts covers 390 px).
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
  await page.locator("#onboarding-org-name").fill(`Round two ${who} ${stamp}`);
  await page.getByRole("button", { name: /get started/i }).click();
  await page.waitForURL("**/privacy/quickstart**");
}

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1280", "desktop only");
});

test("F11: with local sign-in only, the page shows the local form alone", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.locator("#local-email")).toBeVisible();
  await expect(page.locator("form")).toHaveCount(1);
  await expect(page.locator("#email")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /google/i })).toHaveCount(0);
  await expect(page.getByTestId("no-sign-in-method")).toHaveCount(0);
});

test("M2: a member limited to one department works inside it", async ({ page }) => {
  test.skip(!localDatabase(), "writes the limited member into a local test database only");
  const prisma = new PrismaClient();
  const email = `limited-${stamp}@example.com`;
  const department = `Marketing ${stamp}`;
  try {
    const org = await prisma.organization.create({
      data: { name: `Round two limited ${stamp}`, slug: `round-two-limited-${stamp}` },
    });
    const user = await prisma.user.create({
      data: { email, name: "limited", userType: "BUSINESS_OWNER" },
    });
    const member = await prisma.organizationMember.create({
      data: { organizationId: org.id, userId: user.id, role: "MEMBER" },
    });
    const unit = await prisma.businessUnit.create({
      data: { organizationId: org.id, name: department },
    });
    await prisma.businessUnit.create({ data: { organizationId: org.id, name: `Sales ${stamp}` } });
    await prisma.businessUnitMember.create({ data: { businessUnitId: unit.id, memberId: member.id } });
  } finally {
    await prisma.$disconnect();
  }

  await signIn(page, email);
  // An empty organisation sends an unlimited member to the quick start; a
  // limited member stays on the home.
  await page.goto("/privacy");
  await expect(page).toHaveURL(/\/privacy(\?|$)/);

  // The selector shows the member's department; "Whole organisation" and the
  // other department are not offered.
  const sw = page.getByTestId("department-switch");
  await expect(sw).toBeVisible();
  await expect(sw.getByRole("combobox")).toContainText(department);
  await sw.getByRole("combobox").click();
  await expect(page.getByRole("option", { name: department })).toBeVisible();
  await expect(page.getByRole("option", { name: /whole organi[sz]ation/i })).toHaveCount(0);
  await expect(page.getByRole("option", { name: `Sales ${stamp}` })).toHaveCount(0);
  await page.keyboard.press("Escape");

  // No quick start, no organisation-wide progress, no organisation-wide actions.
  await expect(page.locator('a[href="/privacy/quickstart"]')).toHaveCount(0);
  await expect(page.getByText(/overall/i)).toHaveCount(0);
  // The whole programme's report (the "Report Incident" quick action stays).
  await expect(
    page.getByRole("button", { name: /^(export report|privacy program report)$/i }),
  ).toHaveCount(0);

  // The quick start page itself says it is for the whole organisation.
  await page.goto("/privacy/quickstart");
  await expect(page.getByTestId("quickstart-limited")).toBeVisible();
});

test("M1: two DPIAs are free on the pilot tier; the third is refused with the plans link", async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_STRIPE_ENABLED !== "true", "no pilot tier on the kit");
  await signInWithNewOrganisation(page, "dpia");

  await page.goto("/privacy");
  await expect(page.getByTestId("dpia-free-note").first()).toContainText(
    "Free for a limited time: two DPIAs per organisation on the pilot tier",
  );

  for (const n of [1, 2]) {
    await page.goto("/privacy/assessments/new?type=DPIA");
    await expect(page.getByTestId("assessment-type-gated")).toHaveCount(0);
    await page.locator("form #name").fill(`Free DPIA ${n} ${stamp}`);
    await page.locator("form button[type=submit]").click();
    await page.waitForURL(/\/privacy\/assessments\/(?!new)[^/?]+/);
  }

  await page.goto("/privacy/assessments/new?type=DPIA");
  await page.locator("form #name").fill(`Third DPIA ${stamp}`);
  await page.locator("form button[type=submit]").click();
  const alert = page.getByTestId("assessment-create-error");
  await expect(alert).toBeVisible();
  await expect(alert).toContainText("already created the 2 DPIAs that the pilot tier includes free");
  await expect(alert).toContainText("https://www.todo.law/pricing");
  await expect(alert).not.toContainText(/€|\$|EUR/);
  await expect(page).toHaveURL(/\/privacy\/assessments\/new/);
});
