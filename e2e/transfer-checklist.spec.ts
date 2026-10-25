// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The transfer page in a real browser (served as playwright.config.ts says):
 * a transfer to the United States under SCC shows the Schrems II checklist in
 * the reader's language, each point can be answered and the answer stays, and
 * the Spanish screen says "SCC", never "CCT", and shows no English checklist.
 */

import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const stamp = Date.now().toString(36);

async function signInWithNewOrganisation(page: Page, email: string, orgName: string) {
  await page.goto("/sign-in");
  await page.locator("#local-email").fill(email);
  await page.locator("form").filter({ has: page.locator("#local-email") }).getByRole("button").click();
  await page.waitForURL("**/privacy**");
  await expect(page.locator("#onboarding-org-name")).toBeVisible();
  await page.getByText(/business owner/i).first().click();
  await page.locator("#onboarding-org-name").fill(orgName);
  await page.getByRole("button", { name: /get started/i }).click();
  await page.waitForURL("**/privacy/quickstart**");
}

test("the transfer checklist is translated, answerable and kept", async ({ browser }, testInfo) => {
  const project = testInfo.project.name;
  const orgName = `Transfers ${project} ${stamp}`;
  const context = await browser.newContext({ viewport: testInfo.project.use.viewport ?? undefined });
  const page = await context.newPage();
  await signInWithNewOrganisation(page, `transfers-${project}-${stamp}@example.com`, orgName);

  // One transfer to the United States under SCC, written straight to the
  // local test database (the page under test is the detail page).
  const prisma = new PrismaClient();
  const org = await prisma.organization.findFirstOrThrow({ where: { name: orgName } });
  const transfer = await prisma.dataTransfer.create({
    data: {
      organizationId: org.id,
      name: `Support access ${stamp}`,
      destinationCountry: "US",
      mechanism: "STANDARD_CONTRACTUAL_CLAUSES",
      complianceStatus: "PENDING",
    },
  });
  await prisma.$disconnect();

  // English
  await page.goto(`/privacy/transfers/${transfer.id}`);
  const summary = page.getByTestId("checklist-summary");
  await expect(summary).toContainText("13 points pending out of 13");
  await page.getByTestId("checklist-s2_1_map_transfers-DONE").click();
  await expect(summary).toContainText("12 points pending out of 13");
  await page.reload();
  await expect(page.getByTestId("checklist-summary")).toContainText("12 points pending out of 13");
  await page.screenshot({ path: testInfo.outputPath(`transfer-en-${project}.png`), fullPage: true });

  // Spanish
  await context.addCookies([{ name: "locale", value: "es", url: page.url() }]);
  await page.reload();
  await expect(page.getByTestId("checklist-summary")).toContainText("Quedan 12 puntos pendientes de 13");
  const body = await page.locator("main").innerText();
  expect(body).not.toMatch(/\bCCT\b/);
  expect(body).toContain("SCC");
  for (const english of ["Know your transfers", "Have you mapped", "Encryption in transit", "Supplementary measures"]) {
    expect(body).not.toContain(english);
  }
  await page.getByTestId("checklist-item-s2_3_assess_laws").getByRole("button").first().click();
  await expect(page.getByRole("link", { name: "Abrir la EIT" }).first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath(`transfer-es-${project}.png`), fullPage: true });
  await context.close();
});
