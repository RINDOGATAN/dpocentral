// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Programme portability in a real browser (served as playwright.config.ts
 * says): one person downloads the whole programme from Settings; a second
 * person, in a new and empty organisation, checks that file and imports it as
 * drafts; then adds vendors from a CSV file through the column match.
 */

import AdmZip from "adm-zip";
import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";

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

test("take the programme out, bring it into an empty organisation, add a register from CSV", async ({ browser }, testInfo) => {
  const project = testInfo.project.name;
  const assetName = `Portable system ${project} ${stamp}`;

  // ── The source organisation: one system, then the download ────────────
  const source = await browser.newContext({ acceptDownloads: true, viewport: testInfo.project.use.viewport ?? undefined });
  const a = await source.newPage();
  await signInWithNewOrganisation(a, `porta-${project}-${stamp}@example.com`, `Portability A ${project} ${stamp}`);
  await a.goto("/privacy/data-inventory/new");
  await a.getByLabel(/asset name/i).fill(assetName);
  await a.getByRole("combobox").first().click();
  await a.getByRole("option").first().click();
  await a.getByRole("button", { name: /create asset/i }).click();
  await a.waitForURL(/\/privacy\/data-inventory$/);

  await a.goto("/privacy/settings");
  const exportCard = a.getByTestId("programme-export-card");
  await expect(exportCard.getByText("Take your programme with you")).toBeVisible();
  const [download] = await Promise.all([a.waitForEvent("download"), exportCard.getByTestId("programme-export-download").click()]);
  const zipPath = testInfo.outputPath("programme.zip");
  await download.saveAs(zipPath);
  const zip = new AdmZip(readFileSync(zipPath));
  const programme = JSON.parse(zip.getEntry("programme.json")!.getData().toString("utf8"));
  expect(programme.format).toBe("dpocentral-programme/1.0");
  expect(programme.dataAssets.map((x: { name: string }) => x.name)).toContain(assetName);
  expect(zip.getEntry("schema/LEEME.md")).toBeTruthy();
  await source.close();

  // ── A new, empty organisation: check, then import as drafts ───────────
  const target = await browser.newContext({ viewport: testInfo.project.use.viewport ?? undefined });
  const b = await target.newPage();
  await signInWithNewOrganisation(b, `portb-${project}-${stamp}@example.com`, `Portability B ${project} ${stamp}`);
  await b.goto("/privacy/settings");
  const importCard = b.getByTestId("programme-import-card");
  await expect(importCard.getByText("Import a programme")).toBeVisible();
  await importCard.locator("#import-file-programme").setInputFiles(zipPath);
  await importCard.getByRole("button", { name: "Check the file" }).click();
  const summary = importCard.getByTestId("import-summary");
  await expect(summary.getByText("What the import will do")).toBeVisible();
  await expect(summary.getByRole("row", { name: /Systems/ })).toBeVisible();
  await importCard.getByRole("button", { name: "Import as drafts" }).click();
  await expect(importCard.getByTestId("import-result")).toHaveText(/imported as (a )?drafts? to confirm/);
  await b.goto("/privacy/data-inventory");
  await expect(b.getByText(assetName).first()).toBeVisible();
  await expect(b.getByTestId("draft-badge").first()).toBeVisible();

  // ── One register from a CSV file, through the column match ────────────
  await b.goto("/privacy/settings");
  const card = b.getByTestId("programme-import-card");
  await card.getByRole("tab", { name: "One register (CSV)" }).click();
  await card.locator("#import-register").selectOption("vendors");
  await card.locator("#import-file-register").setInputFiles({
    name: "vendors.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(`Supplier;Criticality;Notes\nCSV vendor ${stamp};Alto;private\n`, "utf8"),
  });
  await card.getByRole("button", { name: "Check the file" }).click();
  const mapping = card.getByTestId("import-mapping");
  await expect(mapping.getByRole("combobox", { name: "Field: Supplier" })).toHaveValue("name");
  await expect(mapping.getByRole("combobox", { name: "Field: Notes" })).toHaveValue("");
  // At phone width the page is never wider than the window (tables scroll inside the card).
  const { scrollWidth, innerWidth } = await b.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
  await card.getByRole("button", { name: "Import as drafts" }).click();
  await expect(card.getByTestId("import-result")).toHaveText("1 record imported as a draft to confirm.");
  await b.goto("/privacy/vendors");
  await expect(b.getByText(`CSV vendor ${stamp}`).first()).toBeVisible();
  await target.close();
});
