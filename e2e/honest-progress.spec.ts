// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Honest progress (the owner's decisions of 9 October 2026), seen in a
 * browser:
 *
 * - the quick start's first step asks where the organisation operates (d8);
 * - after the quick start the records it made are drafts "to confirm" and the
 *   programme figure stays low (d2);
 * - the same figure, in the same words, on the dashboard, the menu, All
 *   clients and Reports, with no "Strong / Moderate" label on partial data (d3);
 * - confirming one record, then the rest together, raises the figure
 *   everywhere;
 * - the incidents list shows the short INC- reference, the incident tabs fit
 *   the window, and no quick action is cut.
 *
 * Runs in any project (desktop or phone width). HP_LOCALE=es walks it in
 * Spanish; HP_SHOTS=<dir> saves a screenshot at each stop. Writes one
 * incident straight into the local test database, so it is skipped against
 * any other database.
 */

import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const stamp = Date.now().toString(36);
const LOCALE = process.env.HP_LOCALE === "es" ? "es" : "en";
const SHOTS = process.env.HP_SHOTS ?? "";
const es = LOCALE === "es";

function localDatabase(): boolean {
  const url = process.env.DATABASE_URL ?? "";
  return /@(localhost|127\.0\.0\.1|postgres)(:\d+)?\//.test(url);
}

const FIGURE = (done: number, total: number) =>
  es ? `${done} de ${total} pasos confirmados` : `${done} of ${total} steps confirmed`;

async function shot(page: Page, name: string, project: string) {
  if (!SHOTS) return;
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.screenshot({ path: `${SHOTS}/${project}-${LOCALE}-${name}.png`, fullPage: true });
}

async function expectNoSidewaysScroll(page: Page, where: string) {
  await page.waitForLoadState("networkidle").catch(() => {});
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth, `${where}: page wider than the window`).toBeLessThanOrEqual(innerWidth);
}

/** The figure in the menu: the left menu on a desktop, the side sheet on a phone. */
async function menuFigure(page: Page): Promise<string> {
  const wide = (page.viewportSize()?.width ?? 0) >= 1024;
  if (wide) return (await page.getByTestId("menu-program-figure").first().innerText()).trim();
  await page.getByRole("button", { name: /open the program path|abrir la ruta del programa/i }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const text = (await dialog.getByTestId("menu-program-figure").innerText()).trim();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  return text;
}

/** The figure read in the four places; all four must say the same thing. */
async function figureEverywhere(page: Page): Promise<string> {
  await page.goto("/privacy");
  const card = page.getByTestId("program-figure-card").getByTestId("program-figure");
  await expect(card).toBeVisible();
  const dashboard = (await card.innerText()).trim();
  const menu = await menuFigure(page);

  await page.goto("/privacy/clients");
  const clients = (await page.getByTestId("program-figure").first().innerText()).trim();

  await page.goto("/privacy/reports");
  const reports = (await page.getByTestId("reports-headline").getByTestId("program-figure").innerText()).trim();

  expect([menu, clients, reports]).toEqual([dashboard, dashboard, dashboard]);
  return dashboard;
}

test("drafts count once confirmed, and one figure everywhere", async ({ page, context }, testInfo) => {
  test.skip(!localDatabase(), "writes an incident into a local test database only");
  const project = testInfo.project.name;
  const orgName = `Honest ${project} ${LOCALE} ${stamp}`;

  // Sign in and create the client (in English), then read in the walk's language.
  await page.goto("/sign-in");
  await page.locator("#local-email").fill(`honest-${project}-${LOCALE}-${stamp}@example.com`);
  await page.locator("form").filter({ has: page.locator("#local-email") }).getByRole("button").click();
  await page.waitForURL("**/privacy**");
  await page.getByText(/business owner/i).first().click();
  await page.locator("#onboarding-org-name").fill(orgName);
  await page.getByRole("button", { name: /get started/i }).click();
  await page.waitForURL("**/privacy/quickstart**");
  await context.addCookies([{ name: "locale", value: LOCALE, url: new URL(page.url()).origin }]);
  await page.reload();

  // d8: the first step asks where the organisation operates.
  await expect(page.getByTestId("jurisdiction-picker")).toBeVisible();
  await page.locator("#quickstart-place-CCPA").click();
  await page.locator("#quickstart-place-GDPR").click();
  await expect(page.locator("#quickstart-place-CCPA")).toHaveAttribute("data-state", "checked");
  await expectNoSidewaysScroll(page, "quick start: where you operate");
  await shot(page, "01-quickstart-places", project);
  await page.getByRole("button", { name: /^(save and continue|guardar y continuar)$/i }).click();

  // An industry template, as the walk's company would choose.
  const industryPath = page.getByRole("button", { name: /start from industry template|comenzar con una plantilla sectorial/i });
  await expect(industryPath).toBeVisible();
  await industryPath.press("Enter");
  await page.getByRole("button", { name: /^(continue|continuar)$/i }).click();
  const firstTemplate = page.locator('[role="button"][aria-pressed]').first();
  await expect(firstTemplate).toBeVisible();
  await firstTemplate.click();
  await page.getByRole("button", { name: /^(review|revisar)$/i }).click();
  await page.getByRole("button", { name: /build my privacy program|construir mi programa de privacidad/i }).click();

  // The result says the records are drafts, with the way to confirm them.
  const created = page.getByTestId("quickstart-created");
  await expect(created).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("drafts-notice")).toBeVisible();
  await shot(page, "02-quickstart-result", project);
  const hrefs = await created.getByRole("link").evaluateAll((links) =>
    links.map((a) => (a as HTMLAnchorElement).getAttribute("href") ?? ""),
  );
  const assetHref = hrefs.find((h) => /^\/privacy\/data-inventory\/(?!activities\/)[^/?]+$/.test(h))!;

  // d2 + d3: the figure stays low, and reads the same in the four places.
  const before = await figureEverywhere(page);
  expect(before).toBe(FIGURE(2, 10));
  await page.goto("/privacy");
  await expect(page.getByTestId("program-figure-card")).toContainText(es ? "por confirmar" : "to confirm");
  await expectNoSidewaysScroll(page, "dashboard");
  await shot(page, "03-dashboard-drafts", project);
  await page.goto("/privacy/reports");
  await expect(page.getByTestId("reports-score-label")).toHaveCount(0);
  await expect(page.getByTestId("reports-areas")).toBeVisible();
  await expectNoSidewaysScroll(page, "reports");
  await shot(page, "04-reports-drafts", project);
  await page.goto("/privacy/clients");
  await expectNoSidewaysScroll(page, "all clients");
  await shot(page, "05-clients-drafts", project);
  await page.goto("/privacy/data-inventory");
  await expect(page.getByTestId("drafts-notice")).toBeVisible();
  await expect(page.getByTestId("draft-badge").first()).toBeVisible();

  // Confirm one record on its own page.
  await page.goto(assetHref);
  await expect(page.getByTestId("draft-badge")).toBeVisible();
  await shot(page, "06-asset-to-confirm", project);
  await page.getByTestId("confirm-draft").click();
  await expect(page.getByTestId("draft-badge")).toHaveCount(0);
  await expect(page.getByTestId("confirm-draft")).toHaveCount(0);
  const afterOne = await figureEverywhere(page);
  expect(afterOne).toBe(FIGURE(3, 10));

  // Then the rest together, on the review page.
  await page.goto("/privacy/review");
  await expect(page.getByTestId("confirm-selected")).toBeVisible();
  await expectNoSidewaysScroll(page, "review and confirm");
  await shot(page, "07-review", project);
  await page.getByRole("button", { name: /^(select all|seleccionar todo)$/i }).click();
  await page.getByTestId("confirm-selected").click();
  await expect(page.getByTestId("review-empty")).toBeVisible();
  const after = await figureEverywhere(page);
  const [done] = after.match(/\d+/)!.map(Number);
  expect(done).toBeGreaterThan(3);
  expect(after).toBe(FIGURE(done, 10));
  await page.goto("/privacy");
  await expect(page.getByTestId("program-figure-card")).not.toContainText(es ? "por confirmar" : "to confirm");
  await shot(page, "08-dashboard-confirmed", project);

  // No quick action is cut: each label fits its button.
  const cut = await page.evaluate(() =>
    [...document.querySelectorAll("a[href] button")]
      .filter((b) => b.closest("[class*='card']") && b.scrollWidth > b.clientWidth + 1)
      .map((b) => b.textContent),
  );
  expect(cut, "cut buttons").toEqual([]);

  // The incidents list shows the short reference; the incident tabs fit.
  const prisma = new PrismaClient();
  let incidentId = "";
  let publicId = "";
  try {
    const org = await prisma.organization.findFirstOrThrow({ where: { name: orgName } });
    const incident = await prisma.incident.create({
      data: {
        organizationId: org.id,
        title: `Walk incident ${stamp}`,
        description: "Logged by the browser walk.",
        type: "DATA_BREACH",
        discoveredAt: new Date(),
      },
    });
    incidentId = incident.id;
    publicId = incident.publicId;
  } finally {
    await prisma.$disconnect();
  }
  await page.goto("/privacy/incidents");
  const ref = `INC-${publicId.slice(-6).toUpperCase()}`;
  await expect(page.getByText(ref).filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText(publicId, { exact: true })).toHaveCount(0);
  await shot(page, "09-incidents-list", project);
  await page.goto(`/privacy/incidents/${incidentId}`);
  const tabs = page.getByTestId("incident-tabs");
  await expect(tabs).toBeVisible();
  const clipped = await tabs.evaluate((list) => {
    const box = list.getBoundingClientRect();
    return [...list.querySelectorAll('[role="tab"]')]
      .filter((tab) => {
        const r = tab.getBoundingClientRect();
        return r.right > box.right + 1 || r.right > window.innerWidth || tab.scrollWidth > tab.clientWidth + 1;
      })
      .map((tab) => tab.textContent);
  });
  expect(clipped, "tabs cut off").toEqual([]);
  await expectNoSidewaysScroll(page, "incident page");
  await shot(page, "10-incident-tabs", project);
});
